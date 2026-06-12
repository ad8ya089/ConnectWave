// client/src/components/ChatMessage.jsx
import { useState } from 'react';
import styles from './ChatMessage.module.css';

const REACTION_OPTIONS = ['👍', '❤️', '😄', '😮', '😢', '👏'];

// Format Unix ms timestamp to HH:MM
const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ChatMessage({
  message,       // { id, userName, content, timestamp, reactions, seenBy }
  isOwn,         // boolean — is this the local user's message?
  onReact,       // (messageId, emoji, action) => void
  myReactions,   // Set<emoji> — emojis this user has already reacted with
}) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReact = (emoji) => {
    const action = myReactions?.has(emoji) ? 'remove' : 'add';
    onReact(message.id, emoji, action);
    setShowPicker(false);
  };

  const reactionEntries = Object.entries(message.reactions || {}).filter(([, count]) => count > 0);

  return (
    <div className={`${styles.wrapper} ${isOwn ? styles.own : styles.other}`}>
      {/* Sender name — only shown for others */}
      {!isOwn && (
        <span className={styles.senderName}>{message.userName}</span>
      )}

      <div className={styles.bubbleRow}>
        <div className={`${styles.bubble} ${isOwn ? styles.ownBubble : styles.otherBubble}`}>
          <p className={styles.content}>{message.content}</p>
          <span className={styles.time}>{formatTime(message.timestamp)}</span>
        </div>

        {/* Reaction trigger */}
        <button
          className={styles.reactTrigger}
          onClick={() => setShowPicker((v) => !v)}
          aria-label="Add reaction"
          title="Add reaction"
        >
          😊
        </button>
      </div>

      {/* Emoji picker — appears on trigger click */}
      {showPicker && (
        <div className={`${styles.picker} ${isOwn ? styles.pickerLeft : styles.pickerRight}`}>
          {REACTION_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              className={`${styles.pickerBtn} ${myReactions?.has(emoji) ? styles.reacted : ''}`}
              onClick={() => handleReact(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Reaction counts */}
      {reactionEntries.length > 0 && (
        <div className={styles.reactions}>
          {reactionEntries.map(([emoji, count]) => (
            <button
              key={emoji}
              className={`${styles.reactionChip} ${myReactions?.has(emoji) ? styles.reacted : ''}`}
              onClick={() => handleReact(emoji)}
              title={`${count} reaction${count !== 1 ? 's' : ''}`}
            >
              {emoji} <span className={styles.reactionCount}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Seen by indicators */}
      {isOwn && message.seenBy && Object.keys(message.seenBy).length > 0 && (
        <div className={styles.seenBy}>
          ✓✓ Seen by {Object.values(message.seenBy).join(', ')}
        </div>
      )}
    </div>
  );
}
