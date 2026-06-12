// client/src/components/VideoTile.jsx
import { useRef, useEffect } from 'react';
import styles from './VideoTile.module.css';
import ConnectionBadge from './ConnectionBadge';

export default function VideoTile({
  stream,
  userName      = 'Peer',
  isLocal       = false,
  audioEnabled  = true,
  videoEnabled  = true,
  isSpeaking    = false,
  isPinned      = false,
  isSpotlight   = false,
  onDoubleClick,
  quality       = 'idle',
  rtt           = null,
  muted         = false,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`
        ${styles.tile}
        ${isSpeaking  ? styles.speaking  : ''}
        ${isPinned    ? styles.pinned    : ''}
        ${isSpotlight ? styles.spotlight : ''}
      `}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? (isPinned ? 'Double-click to unpin' : 'Double-click to pin') : undefined}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted}
        className={`${styles.video} ${!videoEnabled ? styles.videoHidden : ''} ${isLocal ? styles.mirrored : ''}`}
      />

      {!videoEnabled && (
        <div className={styles.noVideo}>
          <div className={styles.avatar}>{initials}</div>
          <span className={styles.noVideoLabel}>{userName}</span>
        </div>
      )}

      {isSpeaking && <div className={styles.speakingRing} />}

      {isPinned && (
        <div className={styles.pinBadge} title="Pinned">📌</div>
      )}

      <div className={styles.overlay}>
        <div className={styles.nameRow}>
          {!audioEnabled && (
            <span className={styles.micOff} title="Microphone off">🔇</span>
          )}
          <span className={styles.name}>{isLocal ? `${userName} (you)` : userName}</span>
        </div>
      </div>

      {!isLocal && (
        <div className={styles.qualityBadge}>
          <ConnectionBadge quality={quality} rtt={rtt} />
        </div>
      )}
    </div>
  );
}
