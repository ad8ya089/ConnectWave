// client/src/context/LobbyContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';

// What the user configures in the lobby before joining
const defaultLobbyState = {
  userName:        '',
  cameraDeviceId:  null,
  micDeviceId:     null,
  speakerDeviceId: null,
  audioEnabled:    true,
  videoEnabled:    true,
  blurEnabled:     false,
};

const LobbyContext = createContext(null);

const SESSION_KEY = 'connectwave:lobbyState';

export const LobbyProvider = ({ children }) => {
  const [lobbyState, setLobbyState] = useState(() => {
    // Rehydrate from sessionStorage in case of a page refresh between lobby and room
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? { ...defaultLobbyState, ...JSON.parse(saved) } : defaultLobbyState;
    } catch {
      return defaultLobbyState;
    }
  });

  const updateLobbyState = useCallback((updates) => {
    setLobbyState((prev) => {
      const next = { ...prev, ...updates };
      // Persist so RoomPage can read it after navigation
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearLobbyState = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setLobbyState(defaultLobbyState);
  }, []);

  return (
    <LobbyContext.Provider value={{ lobbyState, updateLobbyState, clearLobbyState }}>
      {children}
    </LobbyContext.Provider>
  );
};

export const useLobby = () => {
  const ctx = useContext(LobbyContext);
  if (!ctx) throw new Error('useLobby must be used inside LobbyProvider');
  return ctx;
};
