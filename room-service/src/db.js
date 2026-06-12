// room-service/src/db.js
const { Pool } = require('pg');
const { DATABASE_URL, NODE_ENV } = require('./config');
const logger = require('./logger');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,               // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Postgres pool error', { error: err.message });
});

// -- Schema --------------------------------------------------------------------
//
// rooms table stores durable room metadata.
// Live participant counts come from Redis (fast), not Postgres (authoritative).
//
// password_hash: bcrypt hash of the room password, NULL if no password set.
// created_by:   userName of the creator (not a real user ID - no auth yet).
// last_active:  updated whenever someone joins; used to clean up old rooms.

const MIGRATE_SQL = `
  CREATE TABLE IF NOT EXISTS rooms (
    id              VARCHAR(64)   PRIMARY KEY,
    name            VARCHAR(120)  NOT NULL,
    password_hash   VARCHAR(255)  NULL,
    created_by      VARCHAR(30)   NOT NULL,
    max_peers       SMALLINT      NOT NULL DEFAULT 12,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    last_active     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_rooms_last_active ON rooms (last_active);
`;

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query(MIGRATE_SQL);
    logger.info('Postgres migration complete');
  } finally {
    client.release();
  }
};

// -- Query helpers -------------------------------------------------------------

const createRoom = async ({ id, name, passwordHash, createdBy, maxPeers }) => {
  const { rows } = await pool.query(
    `INSERT INTO rooms (id, name, password_hash, created_by, max_peers)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, created_by, max_peers, created_at`,
    [id, name, passwordHash || null, createdBy, maxPeers]
  );
  return rows[0];
};

const getRoomById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, name, password_hash, created_by, max_peers, created_at, last_active
     FROM rooms WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

const touchRoom = async (id) => {
  await pool.query(
    `UPDATE rooms SET last_active = NOW() WHERE id = $1`,
    [id]
  );
};

// Delete rooms that have been inactive for longer than ttlSeconds
const cleanupInactiveRooms = async (ttlSeconds) => {
  const { rowCount } = await pool.query(
    `DELETE FROM rooms
     WHERE last_active < NOW() - ($1 || ' seconds')::INTERVAL`,
    [ttlSeconds]
  );
  if (rowCount > 0) logger.info(`Cleaned up ${rowCount} inactive rooms`);
  return rowCount;
};

module.exports = { pool, migrate, createRoom, getRoomById, touchRoom, cleanupInactiveRooms };

// Allow running migrations directly: `node src/db.js migrate`
if (require.main === module && process.argv[2] === 'migrate') {
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', { error: err.message });
      process.exit(1);
    });
}
