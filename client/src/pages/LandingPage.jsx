// client/src/pages/LandingPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LandingPage.module.css';
import { createRoom, joinRoom } from '../services/roomApi';

export default function LandingPage() {
  const navigate = useNavigate();
  const [userName, setUserName]   = useState('');
  const [roomId, setRoomId]       = useState('');
  const [roomName, setRoomName]   = useState('');
  const [password, setPassword]   = useState('');
  const [mode, setMode]           = useState('create'); // 'create' | 'join'
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const clearError = () => setError('');

  const handleCreate = async () => {
    if (!userName.trim()) return;
    setLoading(true);
    clearError();
    try {
      const { roomId, joinToken } = await createRoom({
        createdBy: userName.trim(),
        name: roomName.trim() || undefined,
        password: password.trim() || undefined,
      });

      // Store join token in sessionStorage - not in URL (security)
      // RoomPage reads it from here and clears it after use
      sessionStorage.setItem(`joinToken:${roomId}`, joinToken);

      navigate(`/room/${roomId}?name=${encodeURIComponent(userName.trim())}`);
    } catch (err) {
      setError(err.message || 'Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!userName.trim() || !roomId.trim()) return;
    setLoading(true);
    clearError();
    try {
      const { joinToken } = await joinRoom({
        roomId: roomId.trim(),
        userName: userName.trim(),
        password: password.trim() || undefined,
      });

      sessionStorage.setItem(`joinToken:${roomId.trim()}`, joinToken);

      navigate(`/room/${roomId.trim()}?name=${encodeURIComponent(userName.trim())}`);
    } catch (err) {
      // Map specific HTTP statuses to user-friendly messages
      if (err.status === 404) setError('Room not found. Check the Room ID and try again.');
      else if (err.status === 401) setError('Incorrect password.');
      else if (err.status === 409) setError('This room is full.');
      else setError(err.message || 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key !== 'Enter' || loading) return;
    mode === 'create' ? handleCreate() : handleJoin();
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
            Video calls,<br />
            <em>reimagined.</em>
          </h1>
          <p className={styles.subtitle}>
            Peer-to-peer video chat with room-based communication.
            No accounts, no friction — just connect.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === 'create' ? styles.active : ''}`}
              onClick={() => { setMode('create'); clearError(); }}
            >
              Create Room
            </button>
            <button
              className={`${styles.tab} ${mode === 'join' ? styles.active : ''}`}
              onClick={() => { setMode('join'); clearError(); }}
            >
              Join Room
            </button>
          </div>

          <div className={styles.form}>
            {error && (
              <div className={styles.errorBanner}>{error}</div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Your Name</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Enter your display name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={handleKey}
                maxLength={30}
                disabled={loading}
              />
            </div>

            {mode === 'join' && (
              <div className={styles.field}>
                <label className={styles.label}>Room ID</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Paste the room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                />
              </div>
            )}

            {mode === 'create' && (
              <div className={styles.field}>
                <label className={styles.label}>Room Name <span className={styles.optional}>(optional)</span></label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Design Review, Team Standup"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  onKeyDown={handleKey}
                  maxLength={120}
                  disabled={loading}
                />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>
                Password <span className={styles.optional}>(optional)</span>
              </label>
              <input
                className={styles.input}
                type="password"
                placeholder={mode === 'create' ? 'Set a room password' : 'Enter room password if required'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKey}
                maxLength={100}
                disabled={loading}
              />
            </div>

            <button
              className={styles.btn}
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={loading || !userName.trim() || (mode === 'join' && !roomId.trim())}
            >
              {loading
                ? (mode === 'create' ? 'Creating...' : 'Joining...')
                : (mode === 'create' ? 'Create Room →' : 'Join Room →')}
            </button>
          </div>
        </div>

        <div className={styles.features}>
          {[
            { icon: '⚡', title: 'P2P Direct',    desc: 'Zero-latency WebRTC connections' },
            { icon: '🔒', title: 'Private Rooms',  desc: 'Password-protect your rooms' },
            { icon: '💬', title: 'Live Chat',      desc: 'Text alongside your video call' },
            { icon: '🖥️', title: 'Screen Share',   desc: 'Share your screen instantly' },
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
