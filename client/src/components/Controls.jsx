import styles from "./Controls.module.css";

const Btn = ({ onClick, active, danger, title, children, badge }) => (
  <button
    className={`${styles.btn} ${active ? styles.active : ""} ${danger ? styles.danger : ""}`}
    onClick={onClick}
    title={title}
  >
    {children}
    {badge > 0 && <span className={styles.badge}>{badge}</span>}
  </button>
);

export default function Controls({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  unread,
  chatOpen,
  onToggleAudio,
  onToggleVideo,
  onScreenShare,
  onToggleChat,
  onLeave,
  ambientEnabled,
  onToggleAmbient,
}) {
  return (
    <div className={styles.bar}>
      <div className={styles.group}>
        <Btn onClick={onToggleAudio} active={!audioEnabled} title={audioEnabled ? "Mute" : "Unmute"}>
          {audioEnabled ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </Btn>

        <Btn onClick={onToggleVideo} active={!videoEnabled} title={videoEnabled ? "Stop Video" : "Start Video"}>
          {videoEnabled ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          )}
        </Btn>

        <Btn onClick={onScreenShare} active={isScreenSharing} title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </Btn>
      </div>

      <button className={styles.leave} onClick={onLeave} title="Leave Call">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 16.29 7.71 14.56 6.46 12.55A19.79 19.79 0 0 1 3.39 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.36 9.91" />
          <line x1="23" y1="1" x2="1" y2="23" />
        </svg>
        Leave
      </button>

      <div className={styles.group}>
        <Btn
          onClick={onToggleAmbient}
          active={ambientEnabled}
          title={ambientEnabled ? "Exit Ambient Mode" : "Enter Ambient Mode"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </Btn>

        <Btn onClick={onToggleChat} active={chatOpen} badge={chatOpen ? 0 : unread} title="Chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Btn>
      </div>
    </div>
  );
}
