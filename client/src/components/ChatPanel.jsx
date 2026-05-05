import { useState, useRef, useEffect } from "react";
import styles from "./ChatPanel.module.css";

export default function ChatPanel({ messages, onSend, onClose, mySocketId }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Chat</h3>
        <button className={styles.close} onClick={onClose} title="Close">✕</button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>No messages yet. Say hi! 👋</div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.from === mySocketId;
          return (
            <div key={i} className={`${styles.msg} ${isMe ? styles.mine : ""}`}>
              {!isMe && <span className={styles.sender}>{msg.userName}</span>}
              <div className={styles.bubble}>{msg.message}</div>
              <span className={styles.time}>{formatTime(msg.timestamp)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.input}>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          maxLength={500}
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={!text.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
