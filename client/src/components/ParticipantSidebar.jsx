// client/src/components/ParticipantSidebar.jsx
import { useState } from 'react';
import styles from './ParticipantSidebar.module.css';

const SORT_JOIN  = 'join';
const SORT_ALPHA = 'alpha';

export default function ParticipantSidebar({
  open,
  localUserName,
  mySocketId,
  peers,
  localAudioEnabled,
  localVideoEnabled,
  localScreenSharing = false,
  onClose,
}) {
  const [sortMode, setSortMode] = useState(SORT_JOIN);

  const localEntry = {
    socketId:      mySocketId || 'local',
    userName:      localUserName,
    audioEnabled:  localAudioEnabled,
    videoEnabled:  localVideoEnabled,
    screenSharing: localScreenSharing,
    isLocal:       true,
  };

  const remoteEntries = Object.entries(peers).map(([socketId, info]) => ({
    socketId,
    userName:      info.userName      || 'Peer',
    audioEnabled:  info.audioEnabled  ?? true,
    videoEnabled:  info.videoEnabled  ?? true,
    screenSharing: info.screenSharing ?? false,
    isLocal:       false,
  }));

  const allParticipants = [localEntry, ...remoteEntries];

  const sorted = sortMode === SORT_ALPHA
    ? [...allParticipants].sort((a, b) => a.userName.localeCompare(b.userName))
    : allParticipants;

  return (
    <div className={`${styles.sidebar} ${open ? styles.open : styles.closed}`}>
      <div className={styles.sidebarInner}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span>Participants</span>
            <span className={styles.count}>{allParticipants.length}</span>
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.sortBtn} ${sortMode === SORT_ALPHA ? styles.sortActive : ''}`}
              onClick={() => setSortMode((m) => (m === SORT_JOIN ? SORT_ALPHA : SORT_JOIN))}
              title={sortMode === SORT_JOIN ? 'Sort alphabetically' : 'Sort by join order'}
            >
              {sortMode === SORT_JOIN ? 'A–Z' : '1–2'}
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close sidebar">✕</button>
          </div>
        </div>

        <ul className={styles.list}>
          {sorted.map((p) => (
            <li key={p.socketId} className={styles.item}>
              <div className={styles.avatar}>
                {p.userName[0]?.toUpperCase() || '?'}
              </div>

              <div className={styles.nameBlock}>
                <span className={styles.name}>
                  {p.userName}
                  {p.isLocal && <span className={styles.youLabel}> (you)</span>}
                </span>
              </div>

              <div className={styles.statusIcons}>
                {!p.audioEnabled && (
                  <span className={styles.iconOff} title="Microphone off">🔇</span>
                )}
                {!p.videoEnabled && (
                  <span className={styles.iconOff} title="Camera off">🚫</span>
                )}
                {p.screenSharing && (
                  <span className={styles.iconOn} title="Sharing screen">🖥️</span>
                )}
                {p.audioEnabled && p.videoEnabled && (
                  <span className={styles.iconOn} title="Microphone on">🎤</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
