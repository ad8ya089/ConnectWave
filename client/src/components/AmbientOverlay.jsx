// client/src/components/AmbientOverlay.jsx
import styles from './AmbientOverlay.module.css';
import AmbientOrb        from './AmbientOrb';
import FocusTimer        from './FocusTimer';
import AmbientStatusBar  from './AmbientStatusBar';

// REACTION_EMOJIS — the options available in the reaction picker
const REACTION_EMOJIS = ['👋', '❤️', '👍', '😄', '🎉', '🙏'];

export default function AmbientOverlay({
  // Streams and peer info
  localStream,
  localUserName,
  mySocketId,
  remoteStreams,     // { socketId: MediaStream }
  peers,             // { socketId: { userName } }

  // Audio atmosphere
  peerClarityMap,    // { socketId: boolean }
  onClarityToggle,   // (socketId) => void

  // Reactions
  activeReactions,   // [{ id, fromSocketId, emoji, timestamp }]
  onSendReaction,    // (emoji) => void

  // Status
  activeStatuses,
  onSendStatus,

  // Focus Timer
  timerPhase,
  timerRunning,
  timerRemaining,
  onTimerStart,
  onTimerPause,
  onTimerReset,

  // Exit ambient mode
  onExit,
}) {
  // Find the reaction for each peer (most recent)
  const getReactionForPeer = (socketId) => {
    return activeReactions
      .filter((r) => r.fromSocketId === socketId)
      .sort((a, b) => b.timestamp - a.timestamp)[0] || null;
  };

  const allPeers = [
    // Local user first
    { socketId: mySocketId, stream: localStream, userName: localUserName, isLocal: true },
    // Remote peers
    ...Object.entries(remoteStreams).map(([socketId, stream]) => ({
      socketId,
      stream,
      userName: peers[socketId]?.userName || 'Peer',
      isLocal: false,
    })),
  ];

  return (
    <div className={styles.overlay}>
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.ambientBadge}>
          <span className={styles.ambientDot} />
          Ambient Mode
        </div>
        <button className={styles.exitBtn} onClick={onExit}>
          Exit Ambient ✕
        </button>
      </div>

      {/* ── Main content: orb cluster + right panel ──────────────────────── */}
      <div className={styles.main}>

        {/* Orb cluster */}
        <div
          className={styles.orbCluster}
          style={{ '--peer-count': allPeers.length }}
        >
          {allPeers.map(({ socketId, stream, userName, isLocal }) => (
            <div key={socketId} className={styles.orbSlot}>
              <AmbientOrb
                stream={stream}
                userName={userName}
                isLocal={isLocal}
                socketId={socketId}
                activeReaction={getReactionForPeer(socketId)}
                isClarity={!isLocal && !!peerClarityMap[socketId]}
                onClarityToggle={() => onClarityToggle(socketId)}
                onSendReaction={() => onSendReaction('👋')}
                ambientEnabled={true}
              />
            </div>
          ))}
        </div>

        {/* Right panel: timer + status + reactions */}
        <div className={styles.sidePanel}>
          <FocusTimer
            phase={timerPhase}
            running={timerRunning}
            remaining={timerRemaining}
            onStart={onTimerStart}
            onPause={onTimerPause}
            onReset={onTimerReset}
          />

          {/* Reaction picker */}
          <div className={styles.reactionPicker}>
            <p className={styles.pickerLabel}>React</p>
            <div className={styles.reactionBtns}>
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className={styles.reactionBtn}
                  onClick={() => onSendReaction(emoji)}
                  title={`Send ${emoji} to everyone`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <AmbientStatusBar
            activeStatuses={activeStatuses}
            peers={peers}
            mySocketId={mySocketId}
            onSendStatus={onSendStatus}
          />
        </div>
      </div>
    </div>
  );
}
