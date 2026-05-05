import { useState } from "react";
import styles from "./RoomHeader.module.css";

export default function RoomHeader({ roomId, userName, peerCount }) {
  const [copied, setCopied] = useState(false);

  const copyRoom = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.header}>
      <div className={styles.logo}>
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke="var(--accent)" strokeWidth="1.5" />
          <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="var(--accent)" opacity="0.8" />
        </svg>
        <span>ConnectWave</span>
      </div>

      <div className={styles.center}>
        <div className={styles.roomInfo}>
          <span className={styles.dot} />
          <span className={styles.roomId}>{roomId}</span>
          <button className={styles.copy} onClick={copyRoom} title="Copy Room ID">
            {copied ? "✓ Copied" : "Copy ID"}
          </button>
        </div>
        <span className={styles.peers}>
          {peerCount + 1} participant{peerCount !== 0 ? "s" : ""}
        </span>
      </div>

      <div className={styles.user}>
        <div className={styles.avatar}>{userName[0]?.toUpperCase()}</div>
        <span>{userName}</span>
      </div>
    </div>
  );
}
