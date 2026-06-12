// chat-service/src/socket/chatHandler.js
'use strict';

const { nanoid }           = require('nanoid');
const { verifyJoinToken }  = require('../token');
const {
  cacheMessage,
  getCachedMessages,
  getCachedMessagesBefore,
  setTyping,
  clearTyping,
  getTyping,
  incrReaction,
  decrReaction,
  getReactions,
}                          = require('../redis');
const { enqueueMessage, enqueueReaction } = require('../writeQueue');
const {
  MAX_CACHED_MESSAGES,
  HISTORY_PAGE_SIZE,
  TYPING_TTL_MS,
  NODE_ENV,
}                          = require('../config');
const logger               = require('../logger');

// ── Token verification ─────────────────────────────────────────────────────────
// Re-uses the same JWT the client received from Room Service.
// Chat Service verifies it independently — no call to Room Service needed.

const requireToken = (socket, roomId, userName) => {
  if (NODE_ENV !== 'production') return true; // skip in dev

  const token = socket.handshake.auth?.chatToken;
  if (!token) return false;

  try {
    const payload = verifyJoinToken(token);
    return payload.roomId === roomId && payload.userName === userName;
  } catch {
    return false;
  }
};

module.exports = (io) => {
  // /chat namespace — separate from the signaling server's default namespace
  const chatNs = io.of('/chat');

  chatNs.on('connection', (socket) => {
    logger.debug('Chat socket connected', { socketId: socket.id });

    // Map of socketId → { roomId, userName } for cleanup on disconnect
    // Stored on socket object directly (not Redis) — scoped to this instance
    socket._chatMeta = null;

    // ── chat-join ────────────────────────────────────────────────────────────
    // Client joins a chat room and receives message history.
    // payload: { roomId, userName, chatToken? }

    socket.on('chat-join', async ({ roomId, userName, chatToken }) => {
      if (!roomId || !userName) return;

      const safeRoomId  = String(roomId).slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
      const safeUserName = String(userName).slice(0, 30);

      if (!safeRoomId) {
        socket.emit('chat-error', { message: 'Invalid room ID' });
        return;
      }

      // Attach token to socket for this check
      socket.handshake.auth = socket.handshake.auth || {};
      socket.handshake.auth.chatToken = chatToken;

      if (!requireToken(socket, safeRoomId, safeUserName)) {
        socket.emit('chat-error', { message: 'Invalid or expired token' });
        return;
      }

      socket.join(safeRoomId);
      socket._chatMeta = { roomId: safeRoomId, userName: safeUserName };

      // Load history from Redis cache (fast path)
      let history = [];
      try {
        history = await getCachedMessages(safeRoomId, HISTORY_PAGE_SIZE);

        // Attach current reaction counts to each historical message
        const reactions = await getReactions(safeRoomId);
        history = history.map((msg) => ({
          ...msg,
          reactions: reactions[msg.id] || {},
        }));
      } catch (err) {
        logger.error('Failed to load chat history', { error: err.message, roomId: safeRoomId });
      }

      // Send history to just this socket (not broadcast)
      socket.emit('chat-history', {
        messages: history,
        roomId:   safeRoomId,
      });

      logger.info('Chat join', {
        roomId:   safeRoomId,
        userName: safeUserName,
        historyCount: history.length,
      });
    });

    // ── chat-message ─────────────────────────────────────────────────────────
    // Client sends a message.
    // payload: { roomId, content, userName }
    //
    // Execution order (this is the eventual consistency pattern):
    //   1. Assign ID + timestamp
    //   2. Cache in Redis ZSET (synchronous)
    //   3. Broadcast to all room members including sender (synchronous)
    //   4. Enqueue Postgres write (asynchronous — returns immediately)
    //
    // The client receives the message back with its server-assigned ID,
    // which it uses to correlate reactions and read receipts.

    socket.on('chat-message', async ({ roomId, content, userName }) => {
      if (!roomId || !content || !userName) return;
      if (!socket._chatMeta || socket._chatMeta.roomId !== roomId) return;

      const safeContent  = String(content).slice(0, 500).trim();
      const safeUserName = String(userName).slice(0, 30);
      if (!safeContent) return;

      const message = {
        id:        nanoid(),           // unique, URL-safe message ID
        roomId,
        socketId:  socket.id,
        userName:  safeUserName,
        content:   safeContent,
        timestamp: Date.now(),
        reactions: {},
      };

      // 1. Cache in Redis (fast, synchronous in the handler)
      try {
        await cacheMessage(roomId, message, MAX_CACHED_MESSAGES);
      } catch (err) {
        logger.error('Redis cache write failed', { error: err.message });
        // Continue anyway — broadcast still happens
      }

      // 2. Broadcast to room (including sender — so sender gets server-assigned ID)
      chatNs.to(roomId).emit('chat-message', message);

      // 3. Enqueue async Postgres write — does NOT block the handler
      enqueueMessage({
        id:        message.id,
        roomId:    message.roomId,
        socketId:  message.socketId,
        userName:  message.userName,
        content:   message.content,
        timestamp: message.timestamp,
      });

      // 4. Clear typing indicator for this sender
      try {
        await clearTyping(roomId, socket.id);
        chatNs.to(roomId).emit('typing-update', {
          roomId,
          typing: await getTyping(roomId),
        });
      } catch {}

      logger.debug('Message sent', {
        messageId: message.id,
        roomId,
        userName: safeUserName,
        length:   safeContent.length,
      });
    });

    // ── typing-start ──────────────────────────────────────────────────────────
    // payload: { roomId, userName }

    socket.on('typing-start', async ({ roomId, userName }) => {
      if (!roomId || !userName) return;
      if (!socket._chatMeta || socket._chatMeta.roomId !== roomId) return;

      try {
        await setTyping(roomId, socket.id, String(userName).slice(0, 30));

        // Broadcast updated typing map to room
        chatNs.to(roomId).emit('typing-update', {
          roomId,
          typing: await getTyping(roomId),
        });

        // Auto-clear typing indicator after TTL
        // (in case the client doesn't send typing-stop)
        setTimeout(async () => {
          try {
            await clearTyping(roomId, socket.id);
            chatNs.to(roomId).emit('typing-update', {
              roomId,
              typing: await getTyping(roomId),
            });
          } catch {}
        }, TYPING_TTL_MS);
      } catch (err) {
        logger.error('typing-start failed', { error: err.message });
      }
    });

    // ── typing-stop ───────────────────────────────────────────────────────────
    // payload: { roomId }

    socket.on('typing-stop', async ({ roomId }) => {
      if (!roomId) return;
      try {
        await clearTyping(roomId, socket.id);
        chatNs.to(roomId).emit('typing-update', {
          roomId,
          typing: await getTyping(roomId),
        });
      } catch (err) {
        logger.error('typing-stop failed', { error: err.message });
      }
    });

    // ── message-react ─────────────────────────────────────────────────────────
    // Toggle an emoji reaction on a message.
    // payload: { roomId, messageId, emoji, action: 'add' | 'remove' }

    socket.on('message-react', async ({ roomId, messageId, emoji, action }) => {
      if (!roomId || !messageId || !emoji) return;
      if (!socket._chatMeta || socket._chatMeta.roomId !== roomId) return;

      const safeEmoji    = String(emoji).slice(0, 8);
      const safeAction   = action === 'remove' ? 'remove' : 'add';
      const delta        = safeAction === 'add' ? 1 : -1;

      try {
        // Update Redis reaction count
        const newCount = safeAction === 'add'
          ? await incrReaction(roomId, messageId, safeEmoji)
          : await decrReaction(roomId, messageId, safeEmoji);

        // Broadcast updated reaction to room
        chatNs.to(roomId).emit('reaction-update', {
          roomId,
          messageId,
          emoji:  safeEmoji,
          count:  newCount,
          action: safeAction,
        });

        // Async Postgres write
        enqueueReaction(messageId, safeEmoji, delta);
      } catch (err) {
        logger.error('message-react failed', { error: err.message });
      }
    });

    // ── read-receipt ──────────────────────────────────────────────────────────
    // Tell the room which message this user has read up to.
    // payload: { roomId, messageId }
    // Read receipts are Redis-only — never persisted to Postgres.

    socket.on('read-receipt', ({ roomId, messageId }) => {
      if (!roomId || !messageId) return;
      // Broadcast to room so other clients can show "seen" indicators
      socket.to(roomId).emit('read-receipt', {
        socketId:  socket.id,
        userName:  socket._chatMeta?.userName,
        messageId,
      });
    });

    // ── disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      if (!socket._chatMeta) return;
      const { roomId } = socket._chatMeta;

      try {
        await clearTyping(roomId, socket.id);
        chatNs.to(roomId).emit('typing-update', {
          roomId,
          typing: await getTyping(roomId),
        });
      } catch {}

      logger.debug('Chat socket disconnected', { socketId: socket.id, roomId });
    });
  });

  return chatNs;
};
