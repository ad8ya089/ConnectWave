// chat-service/src/redis.js
const { Redis } = require('ioredis');
const { REDIS_URL } = require('./config');
const logger = require('./logger');

const createClient = (role) => {
  const client = new Redis(REDIS_URL, {
    retryStrategy: (times) => Math.min(times * 100, 10000),
    lazyConnect: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });
  client.on('connect',      () => logger.info(`Chat Service Redis [${role}] connected`));
  client.on('error',   (err) => logger.error(`Chat Service Redis [${role}] error`, { error: err.message }));
  client.on('reconnecting', () => logger.warn(`Chat Service Redis [${role}] reconnecting`));
  return client;
};

const pubClient   = createClient('pub');
const subClient   = pubClient.duplicate();
const cacheClient = pubClient.duplicate();

// ── Redis key schema ──────────────────────────────────────────────────────────
//
// chat:{roomId}:messages   → ZSET, score = timestamp (ms), value = JSON message
// chat:{roomId}:typing     → HASH, field = socketId, value = userName
// chat:{roomId}:reactions  → HASH, field = messageId:emoji, value = count (string)

const CHAT_MESSAGES_KEY = (roomId) => `chat:${roomId}:messages`;
const CHAT_TYPING_KEY   = (roomId) => `chat:${roomId}:typing`;
const REACTION_KEY      = (roomId) => `chat:${roomId}:reactions`;

// ── Cache helpers ─────────────────────────────────────────────────────────────

// Add a message to the ZSET, trim to MAX_CACHED_MESSAGES
const cacheMessage = async (roomId, message, maxCached) => {
  const key   = CHAT_MESSAGES_KEY(roomId);
  const score = message.timestamp;
  const value = JSON.stringify(message);

  const multi = cacheClient.multi();
  multi.zadd(key, score, value);
  // Keep only the most recent maxCached messages — remove oldest
  // ZREMRANGEBYRANK removes by position, 0 = oldest
  multi.zremrangebyrank(key, 0, -(maxCached + 1));
  // Rolling 24h TTL on the cache key
  multi.expire(key, 24 * 60 * 60);
  await multi.exec();
};

// Get the N most recent messages from cache, newest last
const getCachedMessages = async (roomId, count) => {
  const key  = CHAT_MESSAGES_KEY(roomId);
  // ZRANGE with REV gets highest scores first, LIMIT offset count
  const raw  = await cacheClient.zrange(key, 0, count - 1, 'REV');
  // Reverse so oldest is first (chronological order for display)
  return raw.reverse().map((s) => JSON.parse(s));
};

// Get messages before a timestamp (for infinite scroll / pagination)
const getCachedMessagesBefore = async (roomId, beforeTimestamp, count) => {
  const key = CHAT_MESSAGES_KEY(roomId);
  // ZRANGEBYSCORE with -inf to (beforeTimestamp - 1), newest first
  const raw = await cacheClient.zrangebyscore(
    key,
    '-inf',
    beforeTimestamp - 1,
    'LIMIT', 0, count
  );
  return raw.map((s) => JSON.parse(s));
};

// Typing indicators — Redis HASH with per-field TTL via Lua
const setTyping = async (roomId, socketId, userName) => {
  await cacheClient.hset(CHAT_TYPING_KEY(roomId), socketId, userName);
  // Expire the whole key if idle — individual field TTL needs Lua
  await cacheClient.expire(CHAT_TYPING_KEY(roomId), 10);
};

const clearTyping = async (roomId, socketId) => {
  await cacheClient.hdel(CHAT_TYPING_KEY(roomId), socketId);
};

const getTyping = async (roomId) => {
  return cacheClient.hgetall(CHAT_TYPING_KEY(roomId)) || {};
};

// Reactions — increment/decrement counts in Redis HASH
const incrReaction = async (roomId, messageId, emoji) => {
  const key   = REACTION_KEY(roomId);
  const field = `${messageId}:${emoji}`;
  const count = await cacheClient.hincrby(key, field, 1);
  await cacheClient.expire(key, 24 * 60 * 60);
  return count;
};

const decrReaction = async (roomId, messageId, emoji) => {
  const key   = REACTION_KEY(roomId);
  const field = `${messageId}:${emoji}`;
  const count = await cacheClient.hincrby(key, field, -1);
  if (count <= 0) await cacheClient.hdel(key, field);
  return Math.max(0, count);
};

const getReactions = async (roomId) => {
  const key = REACTION_KEY(roomId);
  const raw = await cacheClient.hgetall(key) || {};
  // Transform { "msgId:emoji": "3" } → { msgId: { emoji: 3 } }
  const result = {};
  for (const [field, countStr] of Object.entries(raw)) {
    const colonIdx = field.lastIndexOf(':');
    const msgId    = field.slice(0, colonIdx);
    const emoji    = field.slice(colonIdx + 1);
    if (!result[msgId]) result[msgId] = {};
    result[msgId][emoji] = parseInt(countStr, 10);
  }
  return result;
};

module.exports = {
  pubClient,
  subClient,
  cacheClient,
  cacheMessage,
  getCachedMessages,
  getCachedMessagesBefore,
  setTyping,
  clearTyping,
  getTyping,
  incrReaction,
  decrReaction,
  getReactions,
  CHAT_MESSAGES_KEY,
  CHAT_TYPING_KEY,
  REACTION_KEY,
};
