const { Redis } = require('ioredis');
const { REDIS_URL, INSTANCE_ID } = require('./config');
const logger = require('./logger');

const createClient = (role) => {
  const client = new Redis(REDIS_URL, {
    // Retry with exponential backoff, up to 10 seconds between retries
    retryStrategy: (times) => Math.min(times * 100, 10000),
    lazyConnect: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => logger.info(`Redis ${role} client connected`, { instanceId: INSTANCE_ID }));
  client.on('error', (err) => logger.error(`Redis ${role} client error`, { error: err.message }));
  client.on('reconnecting', () => logger.warn(`Redis ${role} client reconnecting`));

  return client;
};

// pubClient: used for publishing events and all regular Redis commands (GET, SET, etc.)
// subClient: dedicated subscription connection - must NOT be used for regular commands
const pubClient = createClient('pub');
const subClient = pubClient.duplicate();
// duplicate() creates a second connection with the same config but a clean state,
// which is required by ioredis when using one client for subscribe mode.

module.exports = { pubClient, subClient };
