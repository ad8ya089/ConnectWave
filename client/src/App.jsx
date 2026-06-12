import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import { LobbyProvider } from "./context/LobbyContext";
import LandingPage from "./pages/LandingPage";
import LobbyPage from "./pages/LobbyPage";
import RoomPage from "./pages/RoomPage";

export default function App() {
  return (
    <SocketProvider>
      <LobbyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/lobby/:roomId" element={<LobbyPage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
          </Routes>
        </BrowserRouter>
      </LobbyProvider>
    </SocketProvider>
  );
}
