import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useMedia } from "../hooks/useMedia";
import { useWebRTC } from "../hooks/useWebRTC";
import { useChat } from "../hooks/useChat";
import { useAmbientMode } from "../hooks/useAmbientMode";
import { useAudioAtmosphere } from "../hooks/useAudioAtmosphere";
import { useSocket } from "../context/SocketContext";
import { useLobby } from "../context/LobbyContext";
import VideoGrid from "../components/VideoGrid";
import Controls from "../components/Controls";
import ChatPanel from "../components/ChatPanel";
import RoomHeader from "../components/RoomHeader";
import AmbientOverlay from "../components/AmbientOverlay";
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

  // ── Ambient mode ──────────────────────────────────────────────────────────
  const {
    ambientEnabled,
    toggleAmbient,
    timerPhase,
    timerRunning,
    timerRemaining,
    startTimer,
    pauseTimer,
    resetTimer,
    activeReactions,
    sendReaction,
    activeStatuses,
    sendStatus,
  } = useAmbientMode(socket, roomId);

  const {
    connectPeerAudio,
    disconnectPeerAudio,
    togglePeerClarity,
    peerClarityMap,
  } = useAudioAtmosphere(ambientEnabled);

  // remoteStreams is { socketId: { stream, userName, ... } }. Ambient components
  // want a plain socketId -> MediaStream map and a socketId -> { userName } map.
  const remoteStreamMap = useMemo(() => {
    const map = {};
    Object.entries(remoteStreams).forEach(([id, info]) => {
      if (info?.stream) map[id] = info.stream;
    });
    return map;
  }, [remoteStreams]);

  const peers = useMemo(() => {
    const map = {};
    Object.entries(remoteStreams).forEach(([id, info]) => {
      map[id] = { userName: info?.userName || "Peer" };
    });
    return map;
  }, [remoteStreams]);

  // Route peer audio through the Web Audio atmosphere pipeline only while
  // ambient mode is active. When it's off, the VideoGrid <video> elements play
  // the audio normally; during ambient we mute them (mutedRemote) so audio
  // flows solely through the filtered pipeline (no double playback).
  useEffect(() => {
    if (!ambientEnabled) return;
    const ids = Object.keys(remoteStreamMap);
    ids.forEach((id) => connectPeerAudio(id, remoteStreamMap[id]));
    return () => {
      ids.forEach((id) => disconnectPeerAudio(id));
    };
  }, [ambientEnabled, remoteStreamMap, connectPeerAudio, disconnectPeerAudio]);

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
    <>
      {/* Ambient overlay — rendered on top of everything when active */}
      {ambientEnabled && (
        <AmbientOverlay
          localStream={localStream}
          localUserName={userName}
          mySocketId={socket?.id}
          remoteStreams={remoteStreamMap}
          peers={peers}
          peerClarityMap={peerClarityMap}
          onClarityToggle={togglePeerClarity}
          activeReactions={activeReactions}
          onSendReaction={sendReaction}
          activeStatuses={activeStatuses}
          onSendStatus={sendStatus}
          timerPhase={timerPhase}
          timerRunning={timerRunning}
          timerRemaining={timerRemaining}
          onTimerStart={startTimer}
          onTimerPause={pauseTimer}
          onTimerReset={resetTimer}
          onExit={toggleAmbient}
        />
      )}

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
            mutedRemote={ambientEnabled}
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
          ambientEnabled={ambientEnabled}
          onToggleAmbient={toggleAmbient}
        />
      </div>
    </>
  );
}
