// room-service/src/redis.js
const { Redis } = require('ioredis');
const { REDIS_URL } = require('./config');
const logger = require('./logger');

const redis = new Redis(REDIS_URL, {
  retryStrategy: (times) => Math.min(times * 100, 10000),
  lazyConnect: false,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
});

redis.on('connect',      () => logger.info('Room Service Redis connected'));
redis.on('error',   (err) => logger.error('Room Service Redis error', { error: err.message }));
redis.on('reconnecting', () => logger.warn('Room Service Redis reconnecting'));

// Helper: get live participant count for a room
// Reads the same Set that the signaling server writes to
const ROOM_KEY = (roomId) => `room:${roomId}:sockets`;

const getLiveCount = async (roomId) => {
  return redis.scard(ROOM_KEY(roomId));
};

module.exports = { redis, getLiveCount, ROOM_KEY };
