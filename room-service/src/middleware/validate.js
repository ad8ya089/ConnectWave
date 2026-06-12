// room-service/src/middleware/validate.js

// Allowed characters in room IDs - alphanumeric, underscore and hyphen only
const ROOM_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const USERNAME_RE = /^.{1,30}$/;

const validateCreateRoom = (req, res, next) => {
  const { createdBy, name, password } = req.body;

  if (!createdBy || !USERNAME_RE.test(createdBy)) {
    return res.status(400).json({ error: 'createdBy must be 1-30 characters' });
  }
  if (name !== undefined && (typeof name !== 'string' || name.length > 120)) {
    return res.status(400).json({ error: 'name must be a string under 120 characters' });
  }
  if (password !== undefined && (typeof password !== 'string' || password.length > 100)) {
    return res.status(400).json({ error: 'password must be under 100 characters' });
  }
  next();
};

const validateJoinRoom = (req, res, next) => {
  const { userName, password } = req.body;
  const { roomId } = req.params;

  if (!ROOM_ID_RE.test(roomId)) {
    return res.status(400).json({ error: 'Invalid room ID format' });
  }
  if (!userName || !USERNAME_RE.test(userName)) {
    return res.status(400).json({ error: 'userName must be 1-30 characters' });
  }
  if (password !== undefined && typeof password !== 'string') {
    return res.status(400).json({ error: 'password must be a string' });
  }
  next();
};

module.exports = { validateCreateRoom, validateJoinRoom };
