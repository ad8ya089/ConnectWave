// client/src/pages/LandingPage.jsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LandingPage.module.css';
import { createRoom } from '../services/roomApi';

export default function LandingPage() {
  const navigate = useNavigate();
  const cardRef = useRef(null);

  const [userName, setUserName]   = useState('');
  const [roomId, setRoomId]       = useState('');
  const [roomName, setRoomName]   = useState('');
  const [password, setPassword]   = useState('');
  const [mode, setMode]           = useState('create');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const clearError = () => setError('');

  const selectMode = (nextMode) => {
    setMode(nextMode);
    clearError();
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

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

      sessionStorage.setItem(`joinToken:${roomId}`, joinToken);
      navigate(`/lobby/${roomId}?name=${encodeURIComponent(userName.trim())}`);
    } catch (err) {
      setError(err.message || 'Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!userName.trim() || !roomId.trim()) return;
    navigate(`/lobby/${roomId.trim()}?name=${encodeURIComponent(userName.trim())}`);
  };

  const handleKey = (e) => {
    if (e.key !== 'Enter' || loading) return;
    mode === 'create' ? handleCreate() : handleJoin();
  };

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.navLogo}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="13" stroke="#3b82f6" strokeWidth="1.5" />
            <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="#3b82f6" opacity="0.9" />
          </svg>
          <span>ConnectWave</span>
        </div>
        <button type="button" className={styles.signIn}>Sign in</button>
      </header>

      <section className={styles.left}>
        <div className={styles.heroInner}>
          <span className={styles.pill}>No account required · Free forever</span>

          <h1 className={styles.headline}>
            Video calls that
            <br />
            just <span className={styles.accentWord}>work.</span>
          </h1>

          <p className={styles.subtitle}>
            Connect instantly with anyone. No downloads, no accounts, no friction — just share a link and start talking.
          </p>

          <div className={styles.ctaRow}>
            <button
              type="button"
              className={styles.heroPrimary}
              onClick={() => selectMode('create')}
            >
              Start a meeting
            </button>
            <button
              type="button"
              className={`${styles.heroSecondary} ${mode === 'join' ? styles.heroSecondaryActive : ''}`}
              onClick={() => selectMode('join')}
            >
              Join with a code
            </button>
          </div>

          <div className={styles.socialProof}>
            <div className={styles.avatarStack}>
              <div className={`${styles.avatar} ${styles.avatarBlue}`}>A</div>
              <div className={`${styles.avatar} ${styles.avatarPurple}`}>T</div>
              <div className={`${styles.avatar} ${styles.avatarGreen}`}>D</div>
            </div>
            <span>Trusted by students, teams, and developers worldwide.</span>
          </div>
        </div>
      </section>

      <section className={styles.right}>
        <div className={styles.card} ref={cardRef}>
          <h2 className={styles.cardTitle}>Get started</h2>
          <p className={styles.cardSubtitle}>Create a room or join an existing one</p>

          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${mode === 'create' ? styles.tabActive : ''}`}
              onClick={() => { setMode('create'); clearError(); }}
            >
              Create
            </button>
            <button
              type="button"
              className={`${styles.tab} ${mode === 'join' ? styles.tabActive : ''}`}
              onClick={() => { setMode('join'); clearError(); }}
            >
              Join
            </button>
          </div>

          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Your name</label>
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
                <label className={styles.label}>
                  Room name <span className={styles.optional}>(optional)</span>
                </label>
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
              type="button"
              className={styles.submitBtn}
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={loading || !userName.trim() || (mode === 'join' && !roomId.trim())}
            >
              {loading
                ? (mode === 'create' ? 'Creating...' : 'Joining...')
                : (mode === 'create' ? 'Create meeting' : 'Join meeting')}
            </button>

            {error && (
              <div className={styles.errorBanner}>{error}</div>
            )}
          </div>
        </div>
      </section>

      <footer className={styles.featureStrip}>
        {[
          { icon: '🔒', label: 'End-to-end encrypted' },
          { icon: '⚡', label: 'Sub-100ms latency' },
          { icon: '🖥️', label: 'Screen sharing' },
          { icon: '💬', label: 'Live chat' },
        ].map((f) => (
          <div key={f.label} className={styles.featureItem}>
            <span className={styles.featureIcon}>{f.icon}</span>
            <span>{f.label}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}
