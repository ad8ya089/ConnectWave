// room-service/src/routes/turn.js
'use strict';

const express = require('express');
const crypto = require('crypto'); // built-in Node.js module — no install needed
const { TURN_SECRET, TURN_HOST, TURN_PORT, TURN_TTL_SEC } = require('../config');
const { apiLimiter } = require('../middleware/rateLimiter');
const logger = require('../logger');

const router = express.Router();

// ── GET /api/turn/credentials ─────────────────────────────────────────────────
// Returns short-lived TURN credentials for the requesting client.
// Called by the client once per room join, before initiating WebRTC.
//
// Query params: ?userName=Aditya  (used as part of the HMAC username)
//
// Response:
// {
//   iceServers: [
//     { urls: ['stun:stun.l.google.com:19302'] },
//     { urls: ['turn:<host>:<port>', 'turn:<host>:<port>?transport=tcp'],
//       username: '1718000000:Aditya',
//       credential: 'base64-hmac-string' }
//   ],
//   ttl: 3600
// }

router.get('/credentials', apiLimiter, (req, res) => {
  try {
    const userName = String(req.query.userName || 'user').slice(0, 30);

    // Expiry = current Unix timestamp + TTL
    const expiry = Math.floor(Date.now() / 1000) + TURN_TTL_SEC;

    // TURN username format: "<expiry>:<userName>"
    // Coturn extracts the expiry from the username to enforce TTL
    const turnUsername = `${expiry}:${userName}`;

    // HMAC-SHA1 of the username, keyed with the shared secret
    // Base64-encoded — this is the credential sent to Coturn
    const credential = crypto
      .createHmac('sha1', TURN_SECRET)
      .update(turnUsername)
      .digest('base64');

    const iceServers = [
      // STUN first — free, no relay, used whenever possible
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
        ],
      },
      // TURN UDP — primary relay method, lowest latency
      {
        urls: [
          `turn:${TURN_HOST}:${TURN_PORT}`,
          // TCP fallback — used when UDP is blocked (corporate firewalls)
          `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`,
        ],
        username: turnUsername,
        credential,
      },
    ];

    logger.debug('TURN credentials issued', { userName, expiry });

    return res.json({
      iceServers,
      ttl: TURN_TTL_SEC,
    });
  } catch (err) {
    logger.error('TURN credential generation failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate TURN credentials' });
  }
});

module.exports = router;
