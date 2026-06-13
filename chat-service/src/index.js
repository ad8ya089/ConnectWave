// chat-service/src/index.js
'use strict';

const express          = require('express');
const http             = require('http');
const { Server }       = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const cors             = require('cors');
const helmet           = require('helmet');

const config           = require('./config');
const logger           = require('./logger');
const { pubClient, subClient } = require('./redis');
const { pool, migrate }       = require('./db');
const { getQueueLength }      = require('./writeQueue');
const historyRouter           = require('./routes/history');
const registerChatHandler     = require('./socket/chatHandler');

const app    = express();
const server = http.createServer(app);

const corsOrigins = [process.env.CLIENT_URL, 'http://localhost:5173'].filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST'] }));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  try {
    await pubClient.ping();
    await pool.query('SELECT 1');
    res.json({
      status:      'ok',
      service:     'chat-service',
      uptime:      Math.floor(process.uptime()),
      queueLength: getQueueLength(),
      timestamp:   new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// ── REST routes ───────────────────────────────────────────────────────────────

app.use('/api/chat', historyRouter);

app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────

const io = new Server(server, {
  cors: { origin: corsOrigins, methods: ['GET', 'POST'] },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

// Redis adapter — Chat Service runs its own Socket.io cluster
// with the same Redis instance, separate namespace from signaling
io.adapter(createAdapter(pubClient, subClient));

// Register all chat socket handlers under /chat namespace
registerChatHandler(io);

// ── Start ─────────────────────────────────────────────────────────────────────

const start = async () => {
  try {
    await pubClient.ping();
    logger.info('Chat Service Redis verified');

    await migrate();

    server.listen(config.PORT, () => {
      logger.info('Chat Service started', { port: config.PORT, env: config.NODE_ENV });
    });
  } catch (err) {
    logger.error('Chat Service failed to start', { error: err.message });
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  logger.info(`Received ${signal}`);
  server.close(() => logger.info('Chat Service HTTP server closed'));
  await pubClient.quit();
  await subClient.quit();
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();
