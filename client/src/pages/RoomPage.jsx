// client/src/pages/RoomPage.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import styles from './RoomPage.module.css';

import { useMedia }            from '../hooks/useMedia';
import { useWebRTC }           from '../hooks/useWebRTC';
import { useChat }             from '../hooks/useChat';
import { useAmbientMode }      from '../hooks/useAmbientMode';
import { useAudioAtmosphere }  from '../hooks/useAudioAtmosphere';
import { useSpeakerDetection } from '../hooks/useSpeakerDetection';
import { useTheme }            from '../hooks/useTheme';
import { useLobby }            from '../context/LobbyContext';
import { useSocket }           from '../context/SocketContext';
import { getRoomInfo }         from '../services/roomApi';

import RoomHeader         from '../components/RoomHeader';
import VideoGrid          from '../components/VideoGrid';
import ControlsBar        from '../components/ControlsBar';
import ParticipantSidebar from '../components/ParticipantSidebar';
import ChatPanel          from '../components/ChatPanel';
import AmbientOverlay     from '../components/AmbientOverlay';

export default function RoomPage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { lobbyState, clearLobbyState } = useLobby();
  const { theme, toggleTheme } = useTheme();

  const userName = lobbyState.userName || searchParams.get('name') || 'Anonymous';

  const joinTokenRef = useRef(sessionStorage.getItem(`joinToken:${roomId}`) || '');
  const screenStreamRef = useRef(null);

  const [roomName, setRoomName] = useState('');
  const [joined, setJoined] = useState(false);
  const [peers, setPeers] = useState({});
  const [screenSharing, setScreenSharing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadBaselineRef = useRef(0);
  const unreadInitRef = useRef(false);

  const {
    localStream,
    initMedia,
    stopAllMedia,
    audioEnabled,
    videoEnabled,
    error,
    toggleAudio,
    toggleVideo,
  } = useMedia({
    cameraDeviceId: lobbyState.cameraDeviceId,
    micDeviceId:    lobbyState.micDeviceId,
    initialAudioOn: lobbyState.audioEnabled,
    initialVideoOn: lobbyState.videoEnabled,
  });

  const { remoteStreams, peerQualities, replaceTrack } = useWebRTC({ roomId, userName, localStream });

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

  const remoteStreamMap = useMemo(() => {
    const map = {};
    Object.entries(remoteStreams).forEach(([id, info]) => {
      if (info?.stream) map[id] = info.stream;
    });
    return map;
  }, [remoteStreams]);

  const { activeSpeakerId } = useSpeakerDetection({
    remoteStreams: remoteStreamMap,
    localStream,
    mySocketId: socket?.id,
    enabled: joined && !ambientEnabled,
  });

  const {
    connectPeerAudio,
    disconnectPeerAudio,
    togglePeerClarity,
    peerClarityMap,
  } = useAudioAtmosphere(ambientEnabled);

  const {
    messages,
    typingDisplay,
    historyLoading,
    loadingMore,
    hasMore,
    chatSocketId,
    sendMessage,
    onTyping,
    sendReaction: sendChatReaction,
    sendReadReceipt,
    loadMoreHistory,
  } = useChat({
    roomId,
    userName,
    joinToken: joinTokenRef.current,
  });

  useEffect(() => {
    if (historyLoading) return;
    if (!unreadInitRef.current) {
      unreadInitRef.current = true;
      unreadBaselineRef.current = messages.length;
      return;
    }
    if (messages.length > unreadBaselineRef.current) {
      if (!chatOpen) {
        setUnreadCount((c) => c + (messages.length - unreadBaselineRef.current));
      }
      unreadBaselineRef.current = messages.length;
    }
  }, [messages.length, historyLoading, chatOpen]);

  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  useEffect(() => {
    getRoomInfo(roomId)
      .then((data) => setRoomName(data.name || ''))
      .catch(() => {});
  }, [roomId]);

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
      if (!stream || !socket) return;

      // Connect socket now (was autoConnect: false)
      if (!socket.connected) {
        socket.connect();
        await new Promise((resolve) => {
          if (socket.connected) { resolve(); return; }
          socket.once('connect', resolve);
          setTimeout(resolve, 5000);
        });
      }

      const tokenKey = `joinToken:${roomId}`;
      const joinToken = sessionStorage.getItem(tokenKey);
      sessionStorage.removeItem(tokenKey);

      socket.emit('join-room', { roomId, userName, joinToken });
      clearLobbyState();
      setJoined(true);
    };
    setup();
    return () => {
      stopAllMedia();
      socket?.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = ({ socketId, userName: peerName }) => {
      setPeers((prev) => ({
        ...prev,
        [socketId]: {
          userName:      peerName,
          audioEnabled:  true,
          videoEnabled:  true,
          screenSharing: false,
        },
      }));
    };

    const handleUserLeft = ({ socketId }) => {
      setPeers((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      disconnectPeerAudio(socketId);
    };

    const handleRoomPeers = (peerList) => {
      const peerMap = {};
      peerList.forEach(({ socketId, userName: peerName }) => {
        peerMap[socketId] = {
          userName:      peerName,
          audioEnabled:  true,
          videoEnabled:  true,
          screenSharing: false,
        };
      });
      setPeers(peerMap);
    };

    const handlePeerAudioToggle = ({ socketId, enabled }) => {
      setPeers((prev) => ({
        ...prev,
        [socketId]: { ...(prev[socketId] || {}), audioEnabled: enabled },
      }));
    };

    const handlePeerVideoToggle = ({ socketId, enabled }) => {
      setPeers((prev) => ({
        ...prev,
        [socketId]: { ...(prev[socketId] || {}), videoEnabled: enabled },
      }));
    };

    const handlePeerScreenShare = ({ socketId, sharing }) => {
      setPeers((prev) => ({
        ...prev,
        [socketId]: { ...prev[socketId], screenSharing: sharing },
      }));
    };

    const handleRoomFull = ({ max }) => {
      alert(`Room is full (${max} participants max). Returning to home.`);
      navigate('/');
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('room-peers', handleRoomPeers);
    socket.on('peer-audio-toggle', handlePeerAudioToggle);
    socket.on('peer-video-toggle', handlePeerVideoToggle);
    socket.on('peer-screen-share', handlePeerScreenShare);
    socket.on('room-full', handleRoomFull);

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('room-peers', handleRoomPeers);
      socket.off('peer-audio-toggle', handlePeerAudioToggle);
      socket.off('peer-video-toggle', handlePeerVideoToggle);
      socket.off('peer-screen-share', handlePeerScreenShare);
      socket.off('room-full', handleRoomFull);
    };
  }, [socket, navigate, disconnectPeerAudio]);

  const handleToggleAudio = useCallback(() => {
    toggleAudio();
    socket?.emit('toggle-audio', { roomId, enabled: !audioEnabled });
  }, [toggleAudio, audioEnabled, socket, roomId]);

  const handleToggleVideo = useCallback(() => {
    toggleVideo();
    socket?.emit('toggle-video', { roomId, enabled: !videoEnabled });
  }, [toggleVideo, videoEnabled, socket, roomId]);

  const handleToggleScreen = useCallback(async () => {
    if (screenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const cameraTrack = localStream?.getVideoTracks()[0];
      if (cameraTrack) await replaceTrack(cameraTrack, cameraTrack);
      setScreenSharing(false);
      socket?.emit('screen-share-stopped', { roomId });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false,
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        const cameraTrack = localStream?.getVideoTracks()[0];
        if (cameraTrack) await replaceTrack(cameraTrack, screenTrack);

        screenTrack.onended = () => { handleToggleScreen(); };
        setScreenSharing(true);
        socket?.emit('screen-share-started', { roomId });
      } catch (err) {
        if (err.name !== 'NotAllowedError') {
          console.error('[RoomPage] Screen share error:', err);
        }
      }
    }
  }, [screenSharing, roomId, socket, localStream, replaceTrack]);

  const handleLeave = useCallback(() => {
    stopAllMedia();
    socket?.disconnect();
    navigate('/');
  }, [stopAllMedia, socket, navigate]);

  const connectionStatus = (() => {
    const qualities = Object.values(peerQualities);
    if (!qualities.length || !joined) return 'connecting';
    if (qualities.every((q) => q.quality === 'good')) return 'good';
    if (qualities.some((q) => q.quality === 'poor')) return 'poor';
    return 'fair';
  })();

  const participantCount = 1 + Object.keys(remoteStreams).length;

  const ambientPeers = useMemo(() => {
    const map = { ...peers };
    Object.entries(remoteStreams).forEach(([id, info]) => {
      map[id] = {
        ...map[id],
        userName: map[id]?.userName || info?.userName || 'Peer',
      };
    });
    return map;
  }, [peers, remoteStreams]);

  if (error) {
    return (
      <div className={styles.error}>
        <h2>Camera/Mic Access Denied</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Go Back</button>
      </div>
    );
  }

  return (
    <div className={styles.room}>
      {ambientEnabled && (
        <AmbientOverlay
          localStream={localStream}
          localUserName={userName}
          mySocketId={socket?.id}
          remoteStreams={remoteStreamMap}
          peers={ambientPeers}
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

      <RoomHeader
        roomId={roomId}
        roomName={roomName}
        participantCount={participantCount}
        theme={theme}
        onToggleTheme={toggleTheme}
        connectionStatus={connectionStatus}
      />

      <div className={styles.content}>
        <ParticipantSidebar
          open={sidebarOpen}
          localUserName={userName}
          mySocketId={socket?.id}
          peers={peers}
          localAudioEnabled={audioEnabled}
          localVideoEnabled={videoEnabled}
          localScreenSharing={screenSharing}
          onClose={() => setSidebarOpen(false)}
        />

        <div className={styles.videoArea}>
          <VideoGrid
            localStream={localStream}
            localUserName={userName}
            mySocketId={socket?.id}
            localAudioEnabled={audioEnabled}
            localVideoEnabled={videoEnabled}
            remoteStreams={remoteStreams}
            peers={peers}
            peerQualities={peerQualities}
            activeSpeakerId={activeSpeakerId}
            mutedRemote={ambientEnabled}
          />

          <ControlsBar
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            screenSharing={screenSharing}
            ambientEnabled={ambientEnabled}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onToggleScreen={handleToggleScreen}
            onToggleAmbient={toggleAmbient}
            onLeave={handleLeave}
            participantCount={participantCount}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            sidebarOpen={sidebarOpen}
            onToggleChat={() => setChatOpen((v) => !v)}
            chatOpen={chatOpen}
            unreadCount={unreadCount}
          />
        </div>

        {chatOpen && (
          <div className={styles.chatPane}>
            <ChatPanel
              messages={messages}
              typingDisplay={typingDisplay}
              historyLoading={historyLoading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onSendMessage={sendMessage}
              onTyping={onTyping}
              onReact={sendChatReaction}
              onLoadMore={loadMoreHistory}
              onReadReceipt={sendReadReceipt}
              mySocketId={chatSocketId}
              userName={userName}
            />
          </div>
        )}
      </div>
    </div>
  );
}
