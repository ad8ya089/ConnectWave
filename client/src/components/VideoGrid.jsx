// client/src/components/VideoGrid.jsx
import { useState, useCallback } from 'react';
import styles    from './VideoGrid.module.css';
import VideoTile from './VideoTile';

export default function VideoGrid({
  localStream,
  localUserName,
  mySocketId,
  localAudioEnabled,
  localVideoEnabled,
  remoteStreams,
  peers,
  peerQualities,
  activeSpeakerId,
  mutedRemote = false,
}) {
  const [pinnedId, setPinnedId] = useState(null);

  const handleDoubleClick = useCallback((socketId) => {
    setPinnedId((prev) => (prev === socketId ? null : socketId));
  }, []);

  const localTile = {
    socketId:     mySocketId || 'local',
    stream:       localStream,
    userName:     localUserName,
    isLocal:      true,
    audioEnabled: localAudioEnabled,
    videoEnabled: localVideoEnabled,
  };

  const remoteTiles = Object.entries(remoteStreams).map(([socketId, info]) => {
    const streamInfo = info?.stream ? info : { stream: info, userName: 'Peer' };
    return {
      socketId,
      stream:       streamInfo.stream,
      userName:     peers[socketId]?.userName ?? streamInfo.userName ?? 'Peer',
      isLocal:      false,
      audioEnabled: peers[socketId]?.audioEnabled ?? streamInfo.audioEnabled ?? true,
      videoEnabled: peers[socketId]?.videoEnabled ?? streamInfo.videoEnabled ?? true,
    };
  });

  const allTiles = [localTile, ...remoteTiles];

  const effectiveSpotlightId =
    pinnedId ||
    (activeSpeakerId && allTiles.length > 1 ? activeSpeakerId : null);

  const isSpotlightMode = !!effectiveSpotlightId;

  const spotlightTile = allTiles.find((t) => t.socketId === effectiveSpotlightId);
  const stripTiles    = allTiles.filter((t) => t.socketId !== effectiveSpotlightId);

  const renderTile = (tile, inSpotlight = false) => {
    const qInfo = peerQualities?.[tile.socketId] || {};
    const speaking = activeSpeakerId === tile.socketId;

    return (
      <div
        key={tile.socketId}
        className={inSpotlight ? styles.spotlightSlot : styles.gridSlot}
      >
        <VideoTile
          stream={tile.stream}
          userName={tile.userName}
          isLocal={tile.isLocal}
          audioEnabled={tile.audioEnabled}
          videoEnabled={tile.videoEnabled}
          isSpeaking={speaking}
          isPinned={pinnedId === tile.socketId}
          isSpotlight={inSpotlight}
          onDoubleClick={() => handleDoubleClick(tile.socketId)}
          quality={qInfo.quality}
          rtt={qInfo.rtt}
          muted={!tile.isLocal && mutedRemote}
        />
      </div>
    );
  };

  if (!isSpotlightMode) {
    return (
      <div className={styles.grid}>
        {allTiles.map((tile) => renderTile(tile, false))}
      </div>
    );
  }

  return (
    <div className={styles.spotlightLayout}>
      <div className={styles.spotlightMain}>
        {spotlightTile && renderTile(spotlightTile, true)}
      </div>

      {stripTiles.length > 0 && (
        <div className={styles.strip}>
          {stripTiles.map((tile) => renderTile(tile, false))}
        </div>
      )}
    </div>
  );
}
