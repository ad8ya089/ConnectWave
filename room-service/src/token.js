// room-service/src/token.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JOIN_TOKEN_TTL_SEC } = require('./config');

// A join token is a short-lived JWT that proves the client:
// 1. Called Room Service and passed validation (room exists, not full, correct password)
// 2. Has permission to join a specific room as a specific userName
//
// The signaling server verifies this token on 'join-room' before admitting the peer.
// This prevents someone from spamming 'join-room' events directly to bypass capacity checks.
//
// Payload: { roomId, userName, iat, exp }

const signJoinToken = (roomId, userName) => {
  return jwt.sign(
    { roomId, userName },
    JWT_SECRET,
    {
      expiresIn: JOIN_TOKEN_TTL_SEC,
      algorithm: 'HS256',
    }
  );
};

const verifyJoinToken = (token) => {
  // Returns decoded payload or throws (jwt.JsonWebTokenError / jwt.TokenExpiredError)
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
};

module.exports = { signJoinToken, verifyJoinToken };
