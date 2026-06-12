// client/src/components/ControlsBar.jsx
import styles from './ControlsBar.module.css';

function ControlBtn({ onClick, active, danger, disabled, title, children, label }) {
  return (
    <button
      className={`
        ${styles.btn}
        ${active   ? styles.active  : ''}
        ${danger   ? styles.danger  : ''}
        ${disabled ? styles.disabled : ''}
      `}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      <span className={styles.btnIcon}>{children}</span>
      {label && <span className={styles.btnLabel}>{label}</span>}
    </button>
  );
}

export default function ControlsBar({
  audioEnabled      = true,
  videoEnabled      = true,
  screenSharing     = false,
  ambientEnabled    = false,
  onToggleAudio,
  onToggleVideo,
  onToggleScreen,
  onToggleAmbient,
  onLeave,
  participantCount  = 1,
  onToggleSidebar,
  sidebarOpen       = false,
  onToggleChat,
  chatOpen          = false,
  unreadCount       = 0,
}) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.pill}>
        <div className={styles.group}>
          <ControlBtn
            onClick={onToggleSidebar}
            active={sidebarOpen}
            title={sidebarOpen ? 'Close participant list' : 'Open participant list'}
          >
            👥
          </ControlBtn>
          <span className={styles.countBadge}>{participantCount}</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.group}>
          <ControlBtn
            onClick={onToggleAudio}
            danger={!audioEnabled}
            title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            label={audioEnabled ? 'Mute' : 'Unmute'}
          >
            {audioEnabled ? '🎤' : '🔇'}
          </ControlBtn>

          <ControlBtn
            onClick={onToggleVideo}
            danger={!videoEnabled}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            label={videoEnabled ? 'Stop video' : 'Start video'}
          >
            {videoEnabled ? '📷' : '🚫'}
          </ControlBtn>

          <ControlBtn
            onClick={onToggleScreen}
            active={screenSharing}
            title={screenSharing ? 'Stop screen sharing' : 'Share your screen'}
            label={screenSharing ? 'Stop share' : 'Share'}
          >
            🖥️
          </ControlBtn>
        </div>

        <div className={styles.divider} />

        <div className={styles.group}>
          <ControlBtn
            onClick={onToggleChat}
            active={chatOpen}
            title={chatOpen ? 'Close chat' : 'Open chat'}
          >
            <span className={styles.chatIconWrapper}>
              💬
              {unreadCount > 0 && (
                <span className={styles.unreadBadge}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
          </ControlBtn>

          <ControlBtn
            onClick={onToggleAmbient}
            active={ambientEnabled}
            title={ambientEnabled ? 'Exit Ambient Mode' : 'Enter Ambient Mode'}
          >
            🌙
          </ControlBtn>

          <div className={styles.leaveSeparator} />
          <button
            className={styles.leaveBtn}
            onClick={onLeave}
            title="Leave call"
            aria-label="Leave call"
          >
            📞 Leave
          </button>
        </div>
      </div>
    </div>
  );
}
