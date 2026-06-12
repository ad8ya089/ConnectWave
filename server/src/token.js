// server/src/token.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');

const verifyJoinToken = (token) => {
  // Returns { roomId, userName, iat, exp } or throws
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
};

module.exports = { verifyJoinToken };
