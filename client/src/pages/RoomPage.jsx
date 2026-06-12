import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useMedia } from "../hooks/useMedia";
import { useWebRTC } from "../hooks/useWebRTC";
import { useChat } from "../hooks/useChat";
import { useSocket } from "../context/SocketContext";
import { useLobby } from "../context/LobbyContext";
import VideoGrid from "../components/VideoGrid";
import Controls from "../components/Controls";
import ChatPanel from "../components/ChatPanel";
import RoomHeader from "../components/RoomHeader";
import styles from "./RoomPage.module.css";

export default function RoomPage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { lobbyState, clearLobbyState } = useLobby();

  // Prefer the name configured in the lobby; fall back to the URL param.
  const userName = lobbyState.userName || searchParams.get("name") || "Anonymous";

  const {
    localStream,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    error,
    initMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    stopAllMedia,
  } = useMedia({
    cameraDeviceId: lobbyState.cameraDeviceId,
    micDeviceId:    lobbyState.micDeviceId,
    initialAudioOn: lobbyState.audioEnabled,
    initialVideoOn: lobbyState.videoEnabled,
  });

  const { remoteStreams, peerQualities } = useWebRTC({ roomId, userName, localStream });
  const { messages, unread, chatOpen, sendMessage, openChat, closeChat } = useChat(roomId, userName);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const setup = async () => {
      const stream = await initMedia();
      if (!stream) return;

      // Read join token from sessionStorage (written by the lobby / LandingPage)
      // Clear it immediately after reading - one-time use
      const tokenKey = `joinToken:${roomId}`;
      const joinToken = sessionStorage.getItem(tokenKey);
      sessionStorage.removeItem(tokenKey);

      // The socket is created with autoConnect:false so the lobby holds no
      // connection — open it now, right before joining.
      if (socket && !socket.connected) socket.connect();

      // Emit join-room with the token
      // In development (no Room Service running), token will be undefined -
      // the signaling server accepts undefined tokens in non-production mode
      socket.emit("join-room", { roomId, userName, joinToken });

      // Lobby choices have been consumed — clear them.
      clearLobbyState();
      setJoined(true);
    };
    setup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return;
    const handleRoomFull = ({ max }) => {
      alert(`This room is full (max ${max} participants). Please try again later.`);
      navigate("/");
    };
    socket.on("room-full", handleRoomFull);
    return () => socket.off("room-full", handleRoomFull);
  }, [socket, navigate]);

  const handleLeave = useCallback(() => {
    stopAllMedia();
    socket.disconnect();
    navigate("/");
  }, [stopAllMedia, socket, navigate]);

  const handleToggleAudio = () => {
    const enabled = toggleAudio();
    socket.emit("toggle-audio", { roomId, enabled });
  };

  const handleToggleVideo = () => {
    const enabled = toggleVideo();
    socket.emit("toggle-video", { roomId, enabled });
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      socket.emit("screen-share-stopped", { roomId });
    } else {
      const stream = await startScreenShare();
      if (stream) socket.emit("screen-share-started", { roomId });
    }
  };

  if (error) {
    return (
      <div className={styles.error}>
        <h2>Camera/Mic Access Denied</h2>
        <p>{error}</p>
        <button onClick={() => navigate("/")}>Go Back</button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <RoomHeader roomId={roomId} userName={userName} peerCount={Object.keys(remoteStreams).length} />

      <div className={styles.body}>
        <VideoGrid
          localStream={localStream}
          localName={userName}
          remoteStreams={remoteStreams}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          peerQualities={peerQualities}
        />
        {chatOpen && (
          <ChatPanel
            messages={messages}
            onSend={sendMessage}
            onClose={closeChat}
            mySocketId={socket?.id}
          />
        )}
      </div>

      <Controls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isScreenSharing={isScreenSharing}
        unread={unread}
        chatOpen={chatOpen}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onScreenShare={handleScreenShare}
        onToggleChat={chatOpen ? closeChat : openChat}
        onLeave={handleLeave}
      />
    </div>
  );
}
