// room-service/src/routes/rooms.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

const { createRoom, getRoomById, touchRoom } = require('../db');
const { getLiveCount } = require('../redis');
const { signJoinToken } = require('../token');
const { validateCreateRoom, validateJoinRoom } = require('../middleware/validate');
const { createRoomLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { MAX_PEERS_PER_ROOM, ROOM_ID_LENGTH } = require('../config');
const logger = require('../logger');

const router = express.Router();

// -- POST /api/rooms -----------------------------------------------------------
// Create a new room.
//
// Body: { createdBy: string, name?: string, password?: string, maxPeers?: number }
// Response: { roomId, name, joinToken, hasPassword, maxPeers, createdAt }
//
// The joinToken in the response is for the creator - they can join immediately
// without a separate validate call. Other participants call POST /api/rooms/:id/join.

router.post('/', createRoomLimiter, validateCreateRoom, async (req, res) => {
  try {
    const { createdBy, password, maxPeers } = req.body;
    const name = req.body.name?.trim() || `${createdBy}'s Room`;
    const resolvedMaxPeers = Math.min(
      parseInt(maxPeers, 10) || MAX_PEERS_PER_ROOM,
      MAX_PEERS_PER_ROOM
    );

    // Generate a short, URL-safe room ID (e.g. "a3Kx9mQz")
    const roomId = nanoid(ROOM_ID_LENGTH);

    // Hash password if provided
    let passwordHash = null;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const room = await createRoom({
      id: roomId,
      name,
      passwordHash,
      createdBy,
      maxPeers: resolvedMaxPeers,
    });

    // Issue a join token for the creator immediately
    const joinToken = signJoinToken(roomId, createdBy);

    logger.info('Room created', { roomId, createdBy, hasPassword: !!passwordHash });

    return res.status(201).json({
      roomId: room.id,
      name: room.name,
      joinToken,         // Creator can join immediately with this token
      hasPassword: !!passwordHash,
      maxPeers: room.max_peers,
      createdAt: room.created_at,
    });
  } catch (err) {
    logger.error('Create room failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to create room' });
  }
});

// -- GET /api/rooms/:roomId ----------------------------------------------------
// Get room info (does not issue a join token - call /join for that).
// Used by the pre-join lobby to show room name, participant count, password status.
//
// Response: { roomId, name, participantCount, maxPeers, hasPassword, isFull }

router.get('/:roomId', apiLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    const room = await getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Live count comes from Redis (signaling server writes here)
    const participantCount = await getLiveCount(roomId);

    return res.json({
      roomId: room.id,
      name: room.name,
      participantCount,
      maxPeers: room.max_peers,
      hasPassword: !!room.password_hash,
      isFull: participantCount >= room.max_peers,
      createdBy: room.created_by,
      createdAt: room.created_at,
    });
  } catch (err) {
    logger.error('Get room failed', { error: err.message, roomId: req.params.roomId });
    return res.status(500).json({ error: 'Failed to fetch room info' });
  }
});

// -- POST /api/rooms/:roomId/join ----------------------------------------------
// Validate a join attempt and issue a short-lived join token.
//
// Body: { userName: string, password?: string }
// Response: { joinToken, roomId, name, participantCount }
//
// Checks (in order):
//   1. Room exists in Postgres
//   2. Room is not at capacity (live count from Redis)
//   3. Password is correct (if room has one)
//   4. Issue JWT join token
//
// The client then passes joinToken to the signaling server's join-room event.
// The signaling server verifies the token before admitting the socket.

router.post('/:roomId/join', apiLimiter, validateJoinRoom, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userName, password } = req.body;

    // 1. Room must exist
    const room = await getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found. Check the room ID and try again.' });
    }

    // 2. Capacity check
    const participantCount = await getLiveCount(roomId);
    if (participantCount >= room.max_peers) {
      return res.status(409).json({
        error: 'Room is full',
        participantCount,
        maxPeers: room.max_peers,
      });
    }

    // 3. Password check
    if (room.password_hash) {
      if (!password) {
        return res.status(401).json({ error: 'This room requires a password.' });
      }
      const valid = await bcrypt.compare(password.trim(), room.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
    }

    // 4. Issue join token (valid for JOIN_TOKEN_TTL_SEC seconds)
    const joinToken = signJoinToken(roomId, userName);

    // Update last_active so we know this room is still in use
    await touchRoom(roomId);

    logger.info('Join token issued', { roomId, userName });

    return res.json({
      joinToken,
      roomId: room.id,
      name: room.name,
      participantCount,
      maxPeers: room.max_peers,
    });
  } catch (err) {
    logger.error('Join room failed', { error: err.message, roomId: req.params.roomId });
    return res.status(500).json({ error: 'Failed to process join request' });
  }
});

module.exports = router;
