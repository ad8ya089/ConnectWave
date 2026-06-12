// chat-service/src/writeQueue.js
const { insertMessage, upsertReaction } = require('./db');
const { WRITE_RETRY_DELAY_MS, WRITE_MAX_RETRIES } = require('./config');
const logger = require('./logger');

// In-memory queue — array of { type, payload, retries }
// For production at scale this would be a Redis list or a proper job queue (BullMQ).
// For ConnectWave's scale, in-memory is fine and simpler.
// The queue is drained sequentially to avoid hammering Postgres on reconnect.

const queue = [];
let draining = false;

// Add a message write job to the queue
const enqueueMessage = (message) => {
  queue.push({ type: 'message', payload: message, retries: 0 });
  drain();
};

// Add a reaction upsert job to the queue
const enqueueReaction = (messageId, emoji, delta) => {
  queue.push({ type: 'reaction', payload: { messageId, emoji, delta }, retries: 0 });
  drain();
};

const drain = async () => {
  if (draining || queue.length === 0) return;
  draining = true;

  while (queue.length > 0) {
    const job = queue[0];

    try {
      if (job.type === 'message') {
        await insertMessage(job.payload);
      } else if (job.type === 'reaction') {
        const { messageId, emoji, delta } = job.payload;
        await upsertReaction(messageId, emoji, delta);
      }
      // Success — remove from queue
      queue.shift();
    } catch (err) {
      job.retries++;
      logger.warn('Write queue job failed', {
        type:    job.type,
        retries: job.retries,
        error:   err.message,
      });

      if (job.retries >= WRITE_MAX_RETRIES) {
        logger.error('Write queue job exhausted retries, dropping', {
          type:    job.type,
          payload: job.payload,
        });
        queue.shift(); // drop the job
        continue;
      }

      // Exponential backoff before retry
      const delay = WRITE_RETRY_DELAY_MS * Math.pow(2, job.retries - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  draining = false;
};

// Expose queue length for health check
const getQueueLength = () => queue.length;

module.exports = { enqueueMessage, enqueueReaction, getQueueLength };
