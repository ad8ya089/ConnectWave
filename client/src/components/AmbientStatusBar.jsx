// client/src/components/AmbientStatusBar.jsx
import { useState } from 'react';
import styles from './AmbientStatusBar.module.css';

// Pre-set status phrases — quick-send buttons
const QUICK_STATUSES = [
  '☕ grabbing coffee',
  '🎧 deep focus',
  '📖 reading',
  '💬 back in 5',
  '🚶 stepping away',
  '✅ done for now',
];

export default function AmbientStatusBar({
  activeStatuses,  // [{ id, fromSocketId, message, timestamp }]
  peers,           // { socketId: { userName } }
  mySocketId,
  onSendStatus,
}) {
  const [customText, setCustomText] = useState('');
  const [expanded,   setExpanded]   = useState(false);

  const handleSend = (message) => {
    if (!message.trim()) return;
    onSendStatus(message.trim());
    setCustomText('');
    setExpanded(false);
  };

  return (
    <div className={styles.bar}>
      {/* Active status messages — float up from here */}
      <div className={styles.statusStream}>
        {activeStatuses.map((s) => {
          const senderName = s.fromSocketId === mySocketId
            ? 'You'
            : (peers[s.fromSocketId]?.userName || 'Someone');
          return (
            <div key={s.id} className={styles.statusPill}>
              <span className={styles.senderName}>{senderName}</span>
              <span className={styles.statusText}>{s.message}</span>
            </div>
          );
        })}
      </div>

      {/* Send controls */}
      <div className={styles.sendArea}>
        {/* Quick status buttons */}
        <div className={styles.quickBtns}>
          {QUICK_STATUSES.map((phrase) => (
            <button
              key={phrase}
              className={styles.quickBtn}
              onClick={() => handleSend(phrase)}
              title={`Send "${phrase}"`}
            >
              {phrase}
            </button>
          ))}

          <button
            className={`${styles.quickBtn} ${styles.customToggle}`}
            onClick={() => setExpanded((v) => !v)}
          >
            ✏️ Custom
          </button>
        </div>

        {/* Custom text input — expandable */}
        {expanded && (
          <div className={styles.customInput}>
            <input
              type="text"
              className={styles.input}
              placeholder="What's on your mind? (40 chars)"
              value={customText}
              onChange={(e) => setCustomText(e.target.value.slice(0, 40))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend(customText);
                if (e.key === 'Escape') setExpanded(false);
              }}
              autoFocus
              maxLength={40}
            />
            <button
              className={styles.sendBtn}
              onClick={() => handleSend(customText)}
              disabled={!customText.trim()}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
