// client/src/components/FocusTimer.jsx
import styles from './FocusTimer.module.css';

// Format seconds as MM:SS
const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function FocusTimer({
  phase,        // 'work' | 'break'
  running,      // boolean
  remaining,    // seconds
  onStart,
  onPause,
  onReset,
}) {
  const TOTAL = phase === 'work' ? 25 * 60 : 5 * 60;
  const progress = ((TOTAL - remaining) / TOTAL) * 100; // 0–100

  return (
    <div className={styles.timer}>
      {/* Phase label */}
      <div className={`${styles.phase} ${phase === 'break' ? styles.breakPhase : ''}`}>
        {phase === 'work' ? '🎯 Focus' : '☕ Break'}
      </div>

      {/* Circular progress ring */}
      <div className={styles.ringWrapper}>
        <svg className={styles.ring} viewBox="0 0 100 100">
          {/* Background track */}
          <circle
            cx="50" cy="50" r="44"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="4"
          />
          {/* Progress arc */}
          <circle
            cx="50" cy="50" r="44"
            fill="none"
            stroke={phase === 'break' ? 'rgba(72,199,116,0.7)' : 'rgba(0,210,190,0.7)'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        {/* Time display in center of ring */}
        <div className={styles.timeDisplay}>
          <span className={styles.time}>{formatTime(remaining)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {running ? (
          <button className={styles.btn} onClick={onPause} title="Pause timer">
            ⏸
          </button>
        ) : (
          <button className={`${styles.btn} ${styles.primary}`} onClick={onStart} title="Start timer">
            ▶
          </button>
        )}
        <button className={`${styles.btn} ${styles.ghost}`} onClick={onReset} title="Reset timer">
          ↺
        </button>
      </div>

      <p className={styles.hint}>
        {running ? 'Timer synced with room' : 'Start to sync with everyone'}
      </p>
    </div>
  );
}
