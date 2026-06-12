import { useRef, useEffect } from "react";
import styles from "./VideoGrid.module.css";
import ConnectionBadge from "./ConnectionBadge";

function VideoTile({
  stream,
  name,
  muted = false,
  audioEnabled = true,
  videoEnabled = true,
  isLocal = false,
  quality = "idle",
  rtt = null,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={styles.tile}>
      {stream && videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`${styles.video} ${isLocal ? styles.mirrored : ""}`}
        />
      ) : (
        <div className={styles.avatar}>
          <span>{name?.[0]?.toUpperCase() || "?"}</span>
        </div>
      )}
      <div className={styles.overlay}>
        <span className={styles.name}>
          {name}
          {isLocal && " (You)"}
        </span>
        {!audioEnabled && (
          <span className={styles.mutedIcon} title="Muted">
            🔇
          </span>
        )}
      </div>
      {!audioEnabled && <div className={styles.mutedBar} />}
      {/* Connection quality badge — remote peers only, top-right corner */}
      {!isLocal && quality && (
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
          <ConnectionBadge quality={quality} rtt={rtt} />
        </div>
      )}
    </div>
  );
}

export default function VideoGrid({ localStream, localName, remoteStreams, audioEnabled, videoEnabled, peerQualities = {}, mutedRemote = false }) {
  const peers = Object.entries(remoteStreams);
  const totalCount = 1 + peers.length;

  const gridClass =
    totalCount === 1
      ? styles.grid1
      : totalCount === 2
      ? styles.grid2
      : totalCount <= 4
      ? styles.grid4
      : styles.gridMany;

  return (
    <div className={`${styles.grid} ${gridClass}`}>
      <VideoTile
        stream={localStream}
        name={localName}
        muted
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isLocal
      />
      {peers.map(([socketId, { stream, userName, audioEnabled: peerAudio = true, videoEnabled: peerVideo = true }]) => {
        const qualityInfo = peerQualities[socketId] || {};
        return (
          <VideoTile
            key={socketId}
            stream={stream}
            name={userName || "Peer"}
            muted={mutedRemote}
            audioEnabled={peerAudio}
            videoEnabled={peerVideo}
            quality={qualityInfo.quality || "idle"}
            rtt={qualityInfo.rtt ?? null}
          />
        );
      })}
    </div>
  );
}
