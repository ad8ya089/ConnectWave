// chat-service/src/config.js
require('dotenv').config();

const optional = (key, fallback) => process.env[key] || fallback;

module.exports = {
  NODE_ENV:    optional('NODE_ENV', 'development'),
  PORT:        parseInt(optional('PORT', '4002'), 10),

  REDIS_URL:   optional('REDIS_URL', 'redis://localhost:6379'),
  DATABASE_URL: optional('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/connectwave'),

  // Same JWT secret — Chat Service verifies tokens issued by Room Service
  JWT_SECRET:  optional('JWT_SECRET', 'dev-secret-change-in-production'),

  CLIENT_URL:  optional('CLIENT_URL', 'http://localhost:5173'),

  // Redis ZSET config
  // Each room gets a sorted set of messages scored by timestamp.
  // We cap it at MAX_CACHED_MESSAGES — older messages live only in Postgres.
  MAX_CACHED_MESSAGES: parseInt(optional('MAX_CACHED_MESSAGES', '100'), 10),

  // How many messages to return on initial room join
  HISTORY_PAGE_SIZE: parseInt(optional('HISTORY_PAGE_SIZE', '50'), 10),

  // How long a typing indicator stays active (ms) before auto-clearing
  TYPING_TTL_MS: parseInt(optional('TYPING_TTL_MS', '4000'), 10),

  // Write queue — how long to wait before retrying a failed Postgres write (ms)
  WRITE_RETRY_DELAY_MS: parseInt(optional('WRITE_RETRY_DELAY_MS', '2000'), 10),
  WRITE_MAX_RETRIES:    parseInt(optional('WRITE_MAX_RETRIES', '5'), 10),

  RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),
  RATE_LIMIT_MAX:       parseInt(optional('RATE_LIMIT_MAX', '120'), 10),
};
