// room-service/src/index.js
'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config');
const logger = require('./logger');
const { redis } = require('./redis');
const { pool, migrate, cleanupInactiveRooms } = require('./db');
const roomsRouter = require('./routes/rooms');
const turnRouter = require('./routes/turn');

const app = express();

const corsOrigins = [process.env.CLIENT_URL, 'http://localhost:5173'].filter(Boolean);

app.use(helmet());
app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST'] }));
app.use(express.json());

// -- Health check --------------------------------------------------------------

app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'room-service',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// -- Routes --------------------------------------------------------------------

app.use('/api/rooms', roomsRouter);
app.use('/api/turn', turnRouter);

// 404 fallthrough
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// -- Scheduled cleanup ---------------------------------------------------------
// Every 6 hours, delete Postgres rows for rooms that have been inactive
// for longer than ROOM_INACTIVE_TTL seconds.
// This keeps the rooms table small without needing a cron job or external scheduler.

const startCleanupInterval = () => {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      await cleanupInactiveRooms(config.ROOM_INACTIVE_TTL);
    } catch (err) {
      logger.error('Cleanup interval error', { error: err.message });
    }
  }, SIX_HOURS);
};

// -- Start ---------------------------------------------------------------------

const start = async () => {
  try {
    // Verify Redis
    await redis.ping();
    logger.info('Redis connection verified');

    // Run DB migration (idempotent - safe on every startup)
    await migrate();

    // Start listening
    app.listen(config.PORT, () => {
      logger.info('Room Service started', {
        port: config.PORT,
        env: config.NODE_ENV,
      });
    });

    startCleanupInterval();
  } catch (err) {
    logger.error('Room Service failed to start', { error: err.message });
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}`);
  await pool.end();
  await redis.quit();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();
