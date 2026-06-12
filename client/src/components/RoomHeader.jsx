// client/src/components/RoomHeader.jsx
import { useState } from 'react';
import styles from './RoomHeader.module.css';

export default function RoomHeader({
  roomId,
  roomName,
  participantCount,
  theme,
  onToggleTheme,
  connectionStatus,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/lobby/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusColor = {
    good:       'var(--success)',
    fair:       'var(--warning)',
    poor:       'var(--danger)',
    connecting: 'var(--text-3)',
  }[connectionStatus] || 'var(--text-3)';

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="var(--accent)" strokeWidth="1.5" />
            <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="var(--accent)" opacity="0.8" />
          </svg>
        </div>
        <div className={styles.roomInfo}>
          <span className={styles.roomName}>{roomName || `Room ${roomId}`}</span>
          <div className={styles.meta}>
            <span
              className={styles.statusDot}
              style={{ background: statusColor }}
              title={`Connection: ${connectionStatus}`}
            />
            <span className={styles.participantCount}>
              {participantCount} participant{participantCount !== 1 ? 's' : ''}
            </span>
            <span className={styles.roomId}>#{roomId}</span>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <button
          className={styles.actionBtn}
          onClick={handleCopyLink}
          title="Copy room link"
        >
          {copied ? '✓ Copied!' : '🔗 Copy link'}
        </button>

        <button
          className={styles.iconBtn}
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
