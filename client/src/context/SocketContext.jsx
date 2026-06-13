import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const SIGNALING_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [socket,    setSocket]    = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Create socket with autoConnect: false
    // RoomPage calls socket.connect() explicitly after media is ready
    // This prevents the socket from connecting on LandingPage or LobbyPage
    const s = io(SIGNALING_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on('connect',    () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.disconnect();
      s.removeAllListeners();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

// Convenience hook — returns the socket directly for backward compatibility
export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider');
  return ctx.socket;
};

// Full context hook — for components that also need connected status
export const useSocketContext = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be used inside SocketProvider');
  return ctx;
};
