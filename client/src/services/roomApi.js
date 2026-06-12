// client/src/services/roomApi.js

const ROOM_SERVICE_URL = import.meta.env.VITE_ROOM_SERVICE_URL || 'http://localhost:4001';

// Generic fetch wrapper with error handling
const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${ROOM_SERVICE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    // Throw an error with the server's message so callers can display it
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
};

// -- Create a new room ---------------------------------------------------------
// Returns: { roomId, name, joinToken, hasPassword, maxPeers, createdAt }
export const createRoom = async ({ createdBy, name, password, maxPeers }) => {
  return apiFetch('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ createdBy, name, password, maxPeers }),
  });
};

// -- Get room info (no token - for pre-join lobby display) ---------------------
// Returns: { roomId, name, participantCount, maxPeers, hasPassword, isFull }
export const getRoomInfo = async (roomId) => {
  return apiFetch(`/api/rooms/${roomId}`);
};

// -- Join an existing room - validates and returns a join token ----------------
// Returns: { joinToken, roomId, name, participantCount }
export const joinRoom = async ({ roomId, userName, password }) => {
  return apiFetch(`/api/rooms/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ userName, password }),
  });
};

// -- Fetch TURN credentials from Room Service ---------------------------------
// Returns: { iceServers: [...], ttl: 3600 }
// Call this once per room join, before creating RTCPeerConnections.
// Credentials are valid for ttl seconds - cache them for the duration of the call.
export const getTurnCredentials = async (userName) => {
  return apiFetch(`/api/turn/credentials?userName=${encodeURIComponent(userName)}`);
};
