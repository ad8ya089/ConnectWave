// room-service/src/config.js
require('dotenv').config();

const optional = (key, fallback) => process.env[key] || fallback;
const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

module.exports = {
  NODE_ENV:           optional('NODE_ENV', 'development'),
  PORT:               parseInt(optional('PORT', '4001'), 10),

  // Redis - same instance as signaling server
  // Room Service reads participant counts from the same Redis keys
  // that the signaling server writes (room:{roomId}:sockets Sets)
  REDIS_URL:          optional('REDIS_URL', 'redis://localhost:6379'),

  // Postgres - durable storage for room metadata
  DATABASE_URL:       optional('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/connectwave'),

  // JWT - shared secret between Room Service (signs) and Signaling Server (verifies)
  // Must be the same value in both services' env vars
  JWT_SECRET:         optional('JWT_SECRET', 'dev-secret-change-in-production'),
  JOIN_TOKEN_TTL_SEC: parseInt(optional('JOIN_TOKEN_TTL_SEC', '300'), 10), // 5 minutes

  // CORS
  CLIENT_URL:         optional('CLIENT_URL', 'http://localhost:5173'),
  SIGNALING_URL:      optional('SIGNALING_URL', 'http://localhost:4000'),

  // Room settings
  MAX_PEERS_PER_ROOM: parseInt(optional('MAX_PEERS_PER_ROOM', '12'), 10),
  ROOM_ID_LENGTH:     parseInt(optional('ROOM_ID_LENGTH', '8'), 10),
  // How long a room stays in Postgres after it goes empty (seconds)
  ROOM_INACTIVE_TTL:  parseInt(optional('ROOM_INACTIVE_TTL', String(24 * 60 * 60)), 10),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),
  RATE_LIMIT_MAX:       parseInt(optional('RATE_LIMIT_MAX', '60'), 10),

  // TURN server — credentials endpoint
  // TURN_SECRET must match static-auth-secret in coturn/turnserver.conf
  TURN_SECRET:     optional('TURN_SECRET', 'dev-turn-secret-change-in-production'),
  TURN_HOST:       optional('TURN_HOST', 'localhost'),
  TURN_PORT:       parseInt(optional('TURN_PORT', '3478'), 10),
  // How long (seconds) the TURN credential is valid
  // Keep short — TURN traffic costs bandwidth, limit exposure
  TURN_TTL_SEC:    parseInt(optional('TURN_TTL_SEC', '3600'), 10), // 1 hour
};
