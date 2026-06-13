require('dotenv').config();

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

const optional = (key, fallback) => process.env[key] || fallback;

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '4000'), 10),

  // Redis — required in production (Railway has no localhost Redis)
  REDIS_URL: isProduction
    ? required('REDIS_URL')
    : optional('REDIS_URL', 'redis://localhost:6379'),

  // CORS
  CLIENT_URL: optional('CLIENT_URL', 'http://localhost:5173'),

  // JWT - shared secret with Room Service (which signs join tokens)
  JWT_SECRET: optional('JWT_SECRET', 'dev-secret-change-in-production'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),
  RATE_LIMIT_MAX: parseInt(optional('RATE_LIMIT_MAX', '100'), 10),

  // Room settings
  MAX_PEERS_PER_ROOM: parseInt(optional('MAX_PEERS_PER_ROOM', '12'), 10),
  ROOM_TTL_SECONDS: parseInt(optional('ROOM_TTL_SECONDS', String(24 * 60 * 60)), 10),

  // Instance identity (useful for debugging which instance handled a request)
  INSTANCE_ID: optional('INSTANCE_ID', `instance-${Math.random().toString(36).slice(2, 7)}`),
};
