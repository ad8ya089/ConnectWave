'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./src/config');
const logger = require('./src/logger');
const { pubClient, subClient } = require('./src/redis');
const rateLimiter = require('./src/middleware/rateLimiter');
const { verifyJoinToken } = require('./src/token');

// ---------------------------------------------------------------------------
// App + HTTP server
// ---------------------------------------------------------------------------

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // CSP handled by Nginx
app.use(cors({ origin: config.CLIENT_URL, methods: ['GET', 'POST'] }));
app.use(express.json());
app.use('/api', rateLimiter); // rate limit only REST routes, not socket upgrades

// ---------------------------------------------------------------------------
// Health check endpoint
// Used by Docker, Nginx upstream health checks, and monitoring.
// Returns 503 if Redis is not connected.
// ---------------------------------------------------------------------------

app.get('/health', async (req, res) => {
  try {
    await pubClient.ping(); // will throw if Redis is down
    res.json({
      status: 'ok',
      instanceId: config.INSTANCE_ID,
      uptime: Math.floor(process.uptime()),
      connections: io ? io.engine.clientsCount : 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({ status: 'error', error: 'Redis unavailable' });
  }
});

// ---------------------------------------------------------------------------
// Room info / validation now lives in the Room Service microservice.
// The signaling server no longer exposes /api/rooms - it only verifies the
// join token that Room Service issued (see the join-room handler below).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Socket.io server
// ---------------------------------------------------------------------------

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
  // Connection state recovery: if a client briefly disconnects and reconnects
  // within 2 minutes, Socket.io restores their session and missed events.
  // This is a Socket.io v4.6+ feature and requires NO extra infrastructure.
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
});

// ---------------------------------------------------------------------------
// Redis adapter - THIS IS THE KEY CHANGE
//
// Without the adapter: each Socket.io instance only knows about sockets
// connected to itself. socket.to(roomId).emit() only reaches peers on the
// same instance. With two instances and 4 people, 2 people won't get events.
//
// With the adapter: when you call socket.to(roomId).emit(), the adapter
// publishes the event to a Redis channel. Every other instance subscribed
// to that channel receives it and forwards it to the correct local sockets.
// From the application code's perspective, nothing changes - you still just
// call socket.to(roomId).emit(). The adapter handles the fan-out invisibly.
// ---------------------------------------------------------------------------

io.adapter(createAdapter(pubClient, subClient));

// ---------------------------------------------------------------------------
// Room state helpers
//
// We store room membership in Redis Sets (key: room:{roomId}:sockets)
// so all instances see consistent state. Each socket entry is stored as
// a JSON string with { socketId, userName } so we can recover userName
// without a second lookup.
//
// We also keep a per-socket key (socket:{socketId}:meta) with the room
// and userName so we can clean up on disconnect without needing to scan.
//
// Redis key schema:
//   room:{roomId}:sockets  -> Set of socketId strings
//   socket:{socketId}:meta -> Hash { roomId, userName }
//
// TTL: room sets get a rolling TTL reset on every join. If a room sits
// empty for ROOM_TTL_SECONDS, Redis auto-deletes the key.
// ---------------------------------------------------------------------------

const ROOM_KEY = (roomId) => `room:${roomId}:sockets`;
const SOCKET_META_KEY = (socketId) => `socket:${socketId}:meta`;

async function addPeerToRoom(roomId, socketId, userName) {
  const multi = pubClient.multi();
  multi.sadd(ROOM_KEY(roomId), socketId);
  multi.expire(ROOM_KEY(roomId), config.ROOM_TTL_SECONDS);
  multi.hset(SOCKET_META_KEY(socketId), { roomId, userName });
  multi.expire(SOCKET_META_KEY(socketId), config.ROOM_TTL_SECONDS);
  await multi.exec();
}

async function removePeerFromRoom(roomId, socketId) {
  const multi = pubClient.multi();
  multi.srem(ROOM_KEY(roomId), socketId);
  multi.del(SOCKET_META_KEY(socketId));
  await multi.exec();
}

async function getRoomPeers(roomId) {
  // Returns array of socketId strings currently in the room
  return pubClient.smembers(ROOM_KEY(roomId));
}

async function getSocketMeta(socketId) {
  return pubClient.hgetall(SOCKET_META_KEY(socketId));
  // Returns { roomId, userName } or null
}

// ---------------------------------------------------------------------------
// Socket event handlers
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  logger.debug('Socket connected', { socketId: socket.id, instanceId: config.INSTANCE_ID });

  // -- join-room -------------------------------------------------------------
  socket.on('join-room', async ({ roomId, userName, joinToken }) => {
    if (!roomId || !userName) {
      socket.emit('error', { message: 'roomId and userName are required' });
      return;
    }

    // -- Token validation ----------------------------------------------------
    // Every client must present a valid join token issued by Room Service.
    // This ensures:
    //   - The room was validated (exists, not full, correct password)
    //   - The capacity check happened at most JOIN_TOKEN_TTL_SEC seconds ago
    //   - We're not accepting arbitrary socket connections that bypass Room Service
    //
    // In development (NODE_ENV !== 'production'), token validation is optional
    // so you can test signaling without running Room Service every time.

    if (config.NODE_ENV === 'production') {
      if (!joinToken) {
        socket.emit('error', { message: 'Join token required' });
        return;
      }
      try {
        const payload = verifyJoinToken(joinToken);
        // Token must be for this room and this userName
        if (payload.roomId !== roomId || payload.userName !== userName) {
          socket.emit('error', { message: 'Join token mismatch' });
          return;
        }
      } catch (err) {
        socket.emit('error', {
          message: err.name === 'TokenExpiredError'
            ? 'Join token expired. Please rejoin the room.'
            : 'Invalid join token',
        });
        return;
      }
    }

    // Sanitize inputs (same as before)
    const safeRoomId = String(roomId).slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
    const safeUserName = String(userName).slice(0, 30);

    if (!safeRoomId) {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }

    // Capacity re-check (belt-and-suspenders - Room Service already checked,
    // but the token could be a few seconds old and someone else joined)
    const currentCount = await pubClient.scard(ROOM_KEY(safeRoomId));
    if (currentCount >= config.MAX_PEERS_PER_ROOM) {
      socket.emit('room-full', { roomId: safeRoomId, max: config.MAX_PEERS_PER_ROOM });
      return;
    }

    // Get existing peers BEFORE adding self, so we can send them to the joiner
    const existingSocketIds = await getRoomPeers(safeRoomId);

    // Join the Socket.io room (this works across instances via the adapter)
    socket.join(safeRoomId);

    // Persist to Redis
    await addPeerToRoom(safeRoomId, socket.id, safeUserName);

    // Tell every existing peer that someone new joined
    // socket.to() broadcasts to all OTHER sockets in the room (excludes sender)
    // With the Redis adapter, this reaches peers on OTHER instances too
    socket.to(safeRoomId).emit('user-joined', {
      socketId: socket.id,
      userName: safeUserName,
    });

    // Send the new joiner the list of existing peers so they can initiate offers
    // We need userName for each existing peer - fetch from Redis meta keys
    const existingPeers = await Promise.all(
      existingSocketIds
        .filter((id) => id !== socket.id)
        .map(async (id) => {
          const meta = await getSocketMeta(id);
          return { socketId: id, userName: meta?.userName || 'Peer' };
        })
    );

    socket.emit('room-peers', existingPeers);

    logger.info('Peer joined room', {
      roomId: safeRoomId,
      userName: safeUserName,
      socketId: socket.id,
      totalPeers: currentCount + 1,
      instanceId: config.INSTANCE_ID,
    });
  });

  // -- WebRTC signaling ------------------------------------------------------
  // These are relayed peer-to-peer. The adapter ensures that even if the
  // sender and receiver are on different instances, the event is delivered.

  socket.on('offer', ({ to, offer }) => {
    if (!to || !offer) return;
    socket.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    if (!to || !answer) return;
    socket.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    if (!to || !candidate) return;
    socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // -- Chat ------------------------------------------------------------------

  socket.on('chat-message', ({ roomId, message, userName }) => {
    if (!roomId || !message || !userName) return;
    const safeMessage = String(message).slice(0, 500);

    io.to(roomId).emit('chat-message', {
      from: socket.id,
      userName,
      message: safeMessage,
      timestamp: Date.now(),
    });
  });

  // -- Media state -----------------------------------------------------------

  socket.on('toggle-audio', ({ roomId, enabled }) => {
    if (!roomId) return;
    socket.to(roomId).emit('peer-audio-toggle', { socketId: socket.id, enabled });
  });

  socket.on('toggle-video', ({ roomId, enabled }) => {
    if (!roomId) return;
    socket.to(roomId).emit('peer-video-toggle', { socketId: socket.id, enabled });
  });

  // -- Screen share ----------------------------------------------------------

  socket.on('screen-share-started', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('peer-screen-share', { socketId: socket.id, sharing: true });
  });

  socket.on('screen-share-stopped', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('peer-screen-share', { socketId: socket.id, sharing: false });
  });

  // -- Disconnect ------------------------------------------------------------

  socket.on('disconnect', async (reason) => {
    logger.debug('Socket disconnected', { socketId: socket.id, reason });

    const meta = await getSocketMeta(socket.id);
    if (!meta?.roomId) return; // socket never joined a room (e.g. disconnected before join-room)

    const { roomId, userName } = meta;

    // Tell remaining peers this person left
    socket.to(roomId).emit('user-left', { socketId: socket.id, userName });

    // Remove from Redis
    await removePeerFromRoom(roomId, socket.id);

    logger.info('Peer left room', { roomId, userName, socketId: socket.id, reason });
  });

  // -- Error handler ---------------------------------------------------------

  socket.on('error', (err) => {
    logger.error('Socket error', { socketId: socket.id, error: err.message });
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// On SIGTERM (sent by Docker / Kubernetes when stopping a container), we:
// 1. Stop accepting new connections
// 2. Close Redis connections
// 3. Exit cleanly
// This prevents connection-reset errors for users mid-call during deployments.
// ---------------------------------------------------------------------------

const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
  });
  try {
    await pubClient.quit();
    await subClient.quit();
    logger.info('Redis connections closed');
  } catch (err) {
    logger.error('Error closing Redis', { error: err.message });
  }
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Start server - wait for Redis to be ready before accepting connections
// ---------------------------------------------------------------------------

const start = async () => {
  try {
    // Verify Redis is reachable before opening the server
    await pubClient.ping();
    logger.info('Redis connection verified');

    server.listen(config.PORT, () => {
      logger.info('Signaling server started', {
        port: config.PORT,
        instanceId: config.INSTANCE_ID,
        env: config.NODE_ENV,
        maxPeersPerRoom: config.MAX_PEERS_PER_ROOM,
      });
    });
  } catch (err) {
    logger.error('Failed to start server - Redis unreachable', { error: err.message });
    process.exit(1);
  }
};

start();
