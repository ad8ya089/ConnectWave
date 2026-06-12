// client/src/pages/LobbyPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styles from './LobbyPage.module.css';
import { useDevices }          from '../hooks/useDevices';
import { useMedia }            from '../hooks/useMedia';
import { useBackgroundBlur }   from '../hooks/useBackgroundBlur';
import { useLobby }            from '../context/LobbyContext';
import { getRoomInfo, joinRoom } from '../services/roomApi';
import DeviceSelector          from '../components/DeviceSelector';

export default function LobbyPage() {
  const { roomId }           = useParams();
  const [searchParams]       = useSearchParams();
  const navigate             = useNavigate();
  const { updateLobbyState } = useLobby();

  // ── Room info ─────────────────────────────────────────────────────────────
  const [roomInfo,      setRoomInfo]      = useState(null);
  const [roomInfoError, setRoomInfoError] = useState('');
  const [roomLoading,   setRoomLoading]   = useState(true);

  // ── User identity ─────────────────────────────────────────────────────────
  const [userName, setUserName] = useState(searchParams.get('name') || '');
  const [password, setPassword] = useState('');

  // ── Device selection ──────────────────────────────────────────────────────
  const [selectedCamera,  setSelectedCamera]  = useState('');
  const [selectedMic,     setSelectedMic]     = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');

  // ── Join state ────────────────────────────────────────────────────────────
  const [joining,   setJoining]   = useState(false);
  const [joinError, setJoinError] = useState('');

  // ── Media ─────────────────────────────────────────────────────────────────
  const {
    localStream,
    initMedia,
    stopMedia,
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
    mediaError,
  } = useMedia({
    cameraDeviceId: selectedCamera || null,
    micDeviceId:    selectedMic    || null,
    initialAudioOn: true,
    initialVideoOn: true,
  });

  // ── Background blur ───────────────────────────────────────────────────────
  const {
    activeStream,
    blurEnabled,
    blurLoading,
    blurError,
    toggleBlur,
  } = useBackgroundBlur(localStream);

  // ── Device enumeration ────────────────────────────────────────────────────
  const { cameras, microphones, speakers } = useDevices();

  // ── Preview video ref ─────────────────────────────────────────────────────
  const previewVideoRef = useRef(null);

  // ── On mount: fetch room info + init camera ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const info = await getRoomInfo(roomId);
        setRoomInfo(info);
      } catch (err) {
        setRoomInfoError(
          err.status === 404
            ? 'Room not found. It may have expired or the ID is wrong.'
            : 'Could not load room info.'
        );
      } finally {
        setRoomLoading(false);
      }

      await initMedia();
    };
    init();

    // Stop camera when leaving the lobby (release the green light)
    return () => stopMedia();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update preview when the active stream changes ─────────────────────────
  useEffect(() => {
    if (previewVideoRef.current && activeStream) {
      previewVideoRef.current.srcObject = activeStream;
    }
  }, [activeStream]);

  // ── Re-init media when device selection changes ───────────────────────────
  const prevDevicesRef = useRef({ camera: '', mic: '' });

  useEffect(() => {
    const prev = prevDevicesRef.current;
    if (
      (selectedCamera && selectedCamera !== prev.camera) ||
      (selectedMic    && selectedMic    !== prev.mic)
    ) {
      prevDevicesRef.current = { camera: selectedCamera, mic: selectedMic };
      stopMedia();
      initMedia(); // re-init with the new device IDs (initMedia identity tracks them)
    }
  }, [selectedCamera, selectedMic]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Default device selections once devices are enumerated ─────────────────
  useEffect(() => {
    if (cameras.length     && !selectedCamera)  setSelectedCamera(cameras[0].deviceId);
    if (microphones.length && !selectedMic)     setSelectedMic(microphones[0].deviceId);
    if (speakers.length    && !selectedSpeaker) setSelectedSpeaker(speakers[0].deviceId);
  }, [cameras, microphones, speakers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply speaker selection (Chromium only) ───────────────────────────────
  useEffect(() => {
    if (!selectedSpeaker || !previewVideoRef.current) return;
    const el = previewVideoRef.current;
    if (typeof el.setSinkId === 'function') {
      el.setSinkId(selectedSpeaker).catch(() => {});
    }
  }, [selectedSpeaker]);

  // ── Join handler ──────────────────────────────────────────────────────────
  const handleJoin = useCallback(async () => {
    if (!userName.trim()) return;
    setJoining(true);
    setJoinError('');

    try {
      // A token may already be stored (creator flow from LandingPage).
      const existingToken = sessionStorage.getItem(`joinToken:${roomId}`);

      let joinToken;
      if (existingToken) {
        joinToken = existingToken;
      } else {
        // Joiner — call Room Service to validate and get a token.
        if (roomInfo?.hasPassword && !password.trim()) {
          setJoinError('This room requires a password.');
          setJoining(false);
          return;
        }
        const result = await joinRoom({
          roomId,
          userName: userName.trim(),
          password: password.trim() || undefined,
        });
        joinToken = result.joinToken;
      }

      sessionStorage.setItem(`joinToken:${roomId}`, joinToken);

      updateLobbyState({
        userName:        userName.trim(),
        cameraDeviceId:  selectedCamera  || null,
        micDeviceId:     selectedMic     || null,
        speakerDeviceId: selectedSpeaker || null,
        audioEnabled,
        videoEnabled,
        blurEnabled,
      });

      // Release the lobby preview hardware before RoomPage acquires it.
      stopMedia();

      navigate(`/room/${roomId}`);
    } catch (err) {
      if (err.status === 401)      setJoinError('Incorrect password.');
      else if (err.status === 409) setJoinError('Room is full.');
      else if (err.status === 404) setJoinError('Room not found.');
      else setJoinError(err.message || 'Failed to join room.');
    } finally {
      setJoining(false);
    }
  }, [
    userName, password, roomId, roomInfo,
    selectedCamera, selectedMic, selectedSpeaker,
    audioEnabled, videoEnabled, blurEnabled,
    updateLobbyState, stopMedia, navigate,
  ]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !joining) handleJoin();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>

      <button className={styles.back} onClick={() => navigate('/')}>
        ← Back
      </button>

      <div className={styles.layout}>

        {/* ── Left: Camera preview ─────────────────────────────────────── */}
        <div className={styles.previewSection}>
          <div className={styles.previewWrapper}>
            {mediaError ? (
              <div className={styles.previewError}>
                <span className={styles.previewErrorIcon}>⚠</span>
                <p>{mediaError}</p>
              </div>
            ) : (
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className={`${styles.preview} ${!videoEnabled ? styles.previewHidden : ''}`}
              />
            )}

            {!videoEnabled && !mediaError && (
              <div className={styles.videoOffOverlay}>
                <div className={styles.avatarCircle}>
                  {userName ? userName[0].toUpperCase() : '?'}
                </div>
                <span>Camera off</span>
              </div>
            )}

            <div className={styles.previewControls}>
              <button
                className={`${styles.controlBtn} ${!audioEnabled ? styles.controlOff : ''}`}
                onClick={toggleAudio}
                title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {audioEnabled ? '🎤' : '🔇'}
              </button>

              <button
                className={`${styles.controlBtn} ${!videoEnabled ? styles.controlOff : ''}`}
                onClick={toggleVideo}
                title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {videoEnabled ? '📷' : '🚫'}
              </button>

              <button
                className={`${styles.controlBtn} ${blurEnabled ? styles.controlActive : ''} ${blurLoading ? styles.controlLoading : ''}`}
                onClick={toggleBlur}
                disabled={blurLoading || !!blurError || !videoEnabled}
                title={
                  blurError    ? blurError :
                  blurLoading  ? 'Loading blur model...' :
                  blurEnabled  ? 'Disable background blur' :
                                 'Enable background blur'
                }
              >
                {blurLoading ? '⏳' : '✨'}
              </button>
            </div>

            {blurEnabled && (
              <div className={styles.blurBadge}>✨ Background blur on</div>
            )}
            {blurError && (
              <div className={styles.blurErrorBadge}>{blurError}</div>
            )}
          </div>

          <div className={styles.deviceSelectors}>
            <DeviceSelector
              devices={cameras}
              value={selectedCamera}
              onChange={setSelectedCamera}
              label="Camera"
              icon="📷"
              disabled={!videoEnabled}
            />
            <DeviceSelector
              devices={microphones}
              value={selectedMic}
              onChange={setSelectedMic}
              label="Microphone"
              icon="🎤"
              disabled={!audioEnabled}
            />
            <DeviceSelector
              devices={speakers}
              value={selectedSpeaker}
              onChange={setSelectedSpeaker}
              label="Speaker"
              icon="🔊"
            />
          </div>
        </div>

        {/* ── Right: Room info + join form ──────────────────────────────── */}
        <div className={styles.joinSection}>

          <div className={styles.roomInfo}>
            {roomLoading ? (
              <div className={styles.roomInfoSkeleton}>
                <div className={styles.skeletonLine} style={{ width: '60%' }} />
                <div className={styles.skeletonLine} style={{ width: '40%' }} />
              </div>
            ) : roomInfoError ? (
              <div className={styles.roomInfoError}>{roomInfoError}</div>
            ) : roomInfo ? (
              <>
                <h1 className={styles.roomName}>{roomInfo.name}</h1>
                <div className={styles.roomMeta}>
                  <span className={styles.participantCount}>
                    <span className={styles.countDot} />
                    {roomInfo.participantCount === 0
                      ? 'Empty — be the first to join'
                      : `${roomInfo.participantCount} of ${roomInfo.maxPeers} in the room`}
                  </span>
                  {roomInfo.hasPassword && (
                    <span className={styles.passwordBadge}>🔒 Password protected</span>
                  )}
                  {roomInfo.isFull && (
                    <span className={styles.fullBadge}>Room full</span>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className={styles.divider} />

          <div className={styles.form}>
            <h2 className={styles.formTitle}>Ready to join?</h2>

            {joinError && (
              <div className={styles.errorBanner}>{joinError}</div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Your Name</label>
              <input
                className={styles.input}
                type="text"
                placeholder="How should we call you?"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={handleKey}
                maxLength={30}
                disabled={joining}
              />
            </div>

            {roomInfo?.hasPassword && (
              <div className={styles.field}>
                <label className={styles.label}>Room Password</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Enter password to join"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={joining}
                />
              </div>
            )}

            <div className={styles.joinSummary}>
              <span className={`${styles.summaryChip} ${!audioEnabled ? styles.chipOff : ''}`}>
                {audioEnabled ? '🎤 Mic on' : '🔇 Mic off'}
              </span>
              <span className={`${styles.summaryChip} ${!videoEnabled ? styles.chipOff : ''}`}>
                {videoEnabled ? '📷 Camera on' : '🚫 Camera off'}
              </span>
              {blurEnabled && (
                <span className={styles.summaryChip}>✨ Blur on</span>
              )}
            </div>

            <button
              className={styles.joinBtn}
              onClick={handleJoin}
              disabled={
                joining ||
                !userName.trim() ||
                roomInfo?.isFull ||
                !!roomInfoError
              }
            >
              {joining ? 'Joining...' : 'Join Now →'}
            </button>

            {roomInfo?.isFull && (
              <p className={styles.fullNote}>
                This room is full. Ask the host to let someone leave first.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
