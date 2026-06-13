// client/src/services/chatApi.js

const CHAT_SERVICE_URL = import.meta.env.VITE_CHAT_SERVICE_URL || '';

const apiFetch = async (path, options = {}) => {
  const res  = await fetch(`${CHAT_SERVICE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const err    = new Error(data.error || `HTTP ${res.status}`);
    err.status   = res.status;
    throw err;
  }
  return data;
};

// Fetch paginated message history
// before: Unix timestamp ms (for infinite scroll — get messages before this time)
export const fetchHistory = async (roomId, { before, limit } = {}) => {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (limit)  params.set('limit', limit);
  return apiFetch(`/api/chat/${roomId}/history?${params}`);
};
