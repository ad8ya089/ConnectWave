import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useMedia } from "../hooks/useMedia";
import { useWebRTC } from "../hooks/useWebRTC";
import { useChat } from "../hooks/useChat";
import { useSocket } from "../context/SocketContext";
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
  const userName = searchParams.get("name") || "Anonymous";

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
  } = useMedia();

  const { remoteStreams } = useWebRTC({ roomId, userName, localStream });
  const { messages, unread, chatOpen, sendMessage, openChat, closeChat } = useChat(roomId, userName);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const setup = async () => {
      const stream = await initMedia();
      if (stream) {
        socket.emit("join-room", { roomId, userName });
        setJoined(true);
      }
    };
    setup();
  }, []);

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
