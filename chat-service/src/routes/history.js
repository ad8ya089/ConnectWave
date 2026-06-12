// chat-service/src/routes/history.js
'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { getCachedMessagesBefore } = require('../redis');
const { getMessageHistory }       = require('../db');
const { HISTORY_PAGE_SIZE }       = require('../config');
const logger                      = require('../logger');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/chat/:roomId/history
// Query params:
//   before (optional) — Unix timestamp ms — return messages before this time
//   limit  (optional) — number of messages (max 100, default HISTORY_PAGE_SIZE)
//
// Strategy:
//   1. Try Redis cache first (covers recent messages, sub-millisecond)
//   2. Fall back to Postgres for older messages (cache miss or very old)

router.get('/:roomId/history', limiter, async (req, res) => {
  try {
    const { roomId }  = req.params;
    const before      = req.query.before ? parseInt(req.query.before, 10) : null;
    const limit       = Math.min(parseInt(req.query.limit, 10) || HISTORY_PAGE_SIZE, 100);

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    let messages = [];

    // Try Redis cache first
    if (before) {
      messages = await getCachedMessagesBefore(roomId, before, limit);
    }

    // If cache returned fewer messages than requested, fall back to Postgres
    if (messages.length < limit) {
      messages = await getMessageHistory(roomId, before, limit);
    }

    return res.json({
      messages,
      roomId,
      count:   messages.length,
      hasMore: messages.length === limit,
    });
  } catch (err) {
    logger.error('History fetch failed', { error: err.message, roomId: req.params.roomId });
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
