// client/src/components/AmbientOrb.jsx
import { useRef, useEffect } from 'react';
import styles from './AmbientOrb.module.css';
import { useMotionDetection } from '../hooks/useMotionDetection';

// AmbientOrb renders a single participant as a glowing circular orb.
//
// Props:
//   stream:        MediaStream — the participant's video stream
//   userName:      string
//   isLocal:       boolean — local user's orb (no clarity toggle, no incoming audio)
//   socketId:      string — used as reaction target key
//   activeReaction: { emoji, timestamp } | null — current reaction for this peer
//   isClarity:     boolean — is this peer's audio in clarity mode?
//   onClarityToggle: () => void
//   onSendReaction:  () => void — click on local orb sends reaction
//   ambientEnabled:  boolean

export default function AmbientOrb({
  stream,
  userName,
  isLocal = false,
  socketId,
  activeReaction = null,
  isClarity = false,
  onClarityToggle,
  onSendReaction,
  ambientEnabled,
}) {
  const videoRef = useRef(null);

  // Motion detection — runs on the stream to drive pulse animation
  const { motionLevel, isMoving } = useMotionDetection(stream, ambientEnabled);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Derive CSS custom property for glow intensity from motion level
  // motionLevel 0.0 → glow 0, motionLevel 1.0 → glow 1
  const glowIntensity = ambientEnabled ? motionLevel : 0;

  const handleClick = () => {
    if (isLocal && onSendReaction) {
      onSendReaction();
    } else if (!isLocal && onClarityToggle) {
      onClarityToggle();
    }
  };

  return (
    <div
      className={`
        ${styles.orb}
        ${isMoving && ambientEnabled ? styles.moving : ''}
        ${isClarity ? styles.clarity : ''}
        ${activeReaction ? styles.reacting : ''}
      `}
      style={{ '--glow-intensity': glowIntensity }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={
        isLocal
          ? 'Click to send a reaction'
          : `${userName} — click to toggle clarity`
      }
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      title={
        isLocal
          ? 'Click to send a reaction'
          : isClarity
            ? `${userName} — Full clarity (click to return to ambient)`
            : `${userName} — Ambient audio (click for full clarity)`
      }
    >
      {/* Video circle */}
      <div className={styles.videoWrapper}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted // Audio is routed through the Web Audio atmosphere pipeline,
                // so the orb's own <video> element is always muted to avoid
                // double playback / echo.
          className={styles.video}
        />
        {/* Glow ring — intensity driven by motion */}
        <div
          className={styles.glowRing}
          style={{
            opacity: glowIntensity * 0.9,
            transform: `scale(${1 + glowIntensity * 0.15})`,
          }}
        />
      </div>

      {/* Reaction emoji overlay */}
      {activeReaction && (
        <div className={styles.reactionOverlay} key={activeReaction.timestamp}>
          <span className={styles.reactionEmoji}>{activeReaction.emoji}</span>
        </div>
      )}

      {/* Clarity mode indicator — ring turns blue-white */}
      {isClarity && (
        <div className={styles.clarityRing} />
      )}

      {/* Name tag */}
      <div className={styles.nameTag}>
        {userName}
        {isClarity && <span className={styles.clarityDot}>◉</span>}
      </div>

      {/* Breathing ring — always on in ambient mode, pulse speed driven by motion */}
      {ambientEnabled && (
        <div
          className={`${styles.breathRing} ${isMoving ? styles.breathFast : ''}`}
        />
      )}
    </div>
  );
}
