// chat-service/src/token.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');

const verifyJoinToken = (token) => {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
};

module.exports = { verifyJoinToken };
