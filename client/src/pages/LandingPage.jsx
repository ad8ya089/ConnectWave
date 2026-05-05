import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import styles from "./LandingPage.module.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState("create"); // "create" | "join"

  const handleCreate = () => {
    if (!userName.trim()) return;
    const id = uuidv4().slice(0, 8);
    navigate(`/room/${id}?name=${encodeURIComponent(userName.trim())}`);
  };

  const handleJoin = () => {
    if (!userName.trim() || !roomId.trim()) return;
    navigate(`/room/${roomId.trim()}?name=${encodeURIComponent(userName.trim())}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.grid} />
      </div>

      <nav className={styles.nav}>
        <div className={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="var(--accent)" strokeWidth="1.5" />
            <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="var(--accent)" opacity="0.8" />
          </svg>
          <span>ConnectWave</span>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.badge}>✦ WebRTC Powered</div>
          <h1 className={styles.title}>
            Video calls,
            <br />
            <em>reimagined.</em>
          </h1>
          <p className={styles.subtitle}>
            Peer-to-peer video chat with room-based communication. No accounts, no friction — just connect.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === "create" ? styles.active : ""}`}
              onClick={() => setMode("create")}
            >
              Create Room
            </button>
            <button
              className={`${styles.tab} ${mode === "join" ? styles.active : ""}`}
              onClick={() => setMode("join")}
            >
              Join Room
            </button>
          </div>

          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Your Name</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Enter your display name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (mode === "create" ? handleCreate() : handleJoin())}
                maxLength={30}
              />
            </div>

            {mode === "join" && (
              <div className={styles.field}>
                <label className={styles.label}>Room ID</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Paste the room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
              </div>
            )}

            <button
              className={styles.btn}
              onClick={mode === "create" ? handleCreate : handleJoin}
              disabled={!userName.trim() || (mode === "join" && !roomId.trim())}
            >
              {mode === "create" ? "Create Room →" : "Join Room →"}
            </button>
          </div>
        </div>

        <div className={styles.features}>
          {[
            { icon: "⚡", title: "P2P Direct", desc: "Zero-latency WebRTC connections" },
            { icon: "🔒", title: "Private Rooms", desc: "Share ID to invite — no data stored" },
            { icon: "💬", title: "Live Chat", desc: "Text alongside your video call" },
            { icon: "🖥️", title: "Screen Share", desc: "Share your screen instantly" },
          ].map((f) => (
            <div key={f.title} className={styles.feature}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <strong>{f.title}</strong>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
