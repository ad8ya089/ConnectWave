import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { LobbyProvider }  from './context/LobbyContext';

import LandingPage from './pages/LandingPage';
import LobbyPage   from './pages/LobbyPage';
import RoomPage    from './pages/RoomPage';

// Global styles — imports theme.css internally
import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      {/* LobbyProvider wraps everything — lobby state must survive
          navigation from /lobby/:id to /room/:id */}
      <LobbyProvider>
        {/* SocketProvider creates the socket with autoConnect: false.
            It wraps all routes so RoomPage can access the socket.
            LandingPage and LobbyPage never trigger a connection. */}
        <SocketProvider>
          <Routes>
            <Route path="/"               element={<LandingPage />} />
            <Route path="/lobby/:roomId"  element={<LobbyPage />} />
            <Route path="/room/:roomId"   element={<RoomPage />} />
            {/* Catch-all — redirect unknown routes to home */}
            <Route path="*"              element={<LandingPage />} />
          </Routes>
        </SocketProvider>
      </LobbyProvider>
    </BrowserRouter>
  );
}
