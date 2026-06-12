// chat-service/src/db.js
const { Pool } = require('pg');
const { DATABASE_URL, NODE_ENV } = require('./config');
const logger = require('./logger');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => logger.error('Chat Service Postgres pool error', { error: err.message }));

// ── Schema ────────────────────────────────────────────────────────────────────
//
// messages:  durable message store
// reactions: durable reaction store (emoji + count per message)
//
// Key design decision: reactions are stored BOTH in Redis (fast, ephemeral counts)
// and Postgres (durable). Redis is the source of truth for live display;
// Postgres is authoritative for historical view.

const MIGRATE_SQL = `
  CREATE TABLE IF NOT EXISTS messages (
    id           VARCHAR(21)   PRIMARY KEY,   -- nanoid
    room_id      VARCHAR(64)   NOT NULL,
    socket_id    VARCHAR(64)   NOT NULL,
    user_name    VARCHAR(30)   NOT NULL,
    content      TEXT          NOT NULL,
    timestamp    BIGINT        NOT NULL,       -- Unix ms
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp
    ON messages (room_id, timestamp DESC);

  CREATE TABLE IF NOT EXISTS message_reactions (
    message_id   VARCHAR(21)   NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    emoji        VARCHAR(8)    NOT NULL,
    count        INTEGER       NOT NULL DEFAULT 0,
    PRIMARY KEY (message_id, emoji)
  );

  CREATE INDEX IF NOT EXISTS idx_reactions_message
    ON message_reactions (message_id);
`;

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query(MIGRATE_SQL);
    logger.info('Chat Service Postgres migration complete');
  } finally {
    client.release();
  }
};

// ── Query helpers ─────────────────────────────────────────────────────────────

// Insert a single message — called by the write queue, not the hot path
const insertMessage = async ({ id, roomId, socketId, userName, content, timestamp }) => {
  await pool.query(
    `INSERT INTO messages (id, room_id, socket_id, user_name, content, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [id, roomId, socketId, userName, content, timestamp]
  );
};

// Paginated history from Postgres (used when Redis cache is cold or scrolling far back)
const getMessageHistory = async (roomId, beforeTimestamp, limit) => {
  const { rows } = await pool.query(
    `SELECT id, room_id, socket_id, user_name, content, timestamp
     FROM messages
     WHERE room_id = $1
       AND ($2::BIGINT IS NULL OR timestamp < $2)
     ORDER BY timestamp DESC
     LIMIT $3`,
    [roomId, beforeTimestamp || null, limit]
  );
  // Return in chronological order (oldest first)
  return rows.reverse().map((r) => ({
    id:        r.id,
    roomId:    r.room_id,
    socketId:  r.socket_id,
    userName:  r.user_name,
    content:   r.content,
    timestamp: parseInt(r.timestamp, 10),
  }));
};

// Upsert a reaction count in Postgres
const upsertReaction = async (messageId, emoji, delta) => {
  await pool.query(
    `INSERT INTO message_reactions (message_id, emoji, count)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, emoji)
     DO UPDATE SET count = GREATEST(0, message_reactions.count + $3)`,
    [messageId, emoji, delta]
  );
};

module.exports = { pool, migrate, insertMessage, getMessageHistory, upsertReaction };
