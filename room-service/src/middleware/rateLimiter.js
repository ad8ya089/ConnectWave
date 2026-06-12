// room-service/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } = require('../config');

// Strict limiter for room creation (prevent room-flood abuse)
const createRoomLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 10,   // max 10 room creations per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many rooms created. Please wait before creating another.' },
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

module.exports = { createRoomLimiter, apiLimiter };
