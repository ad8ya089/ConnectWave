// client/src/components/ConnectionBadge.jsx
import styles from './ConnectionBadge.module.css';

// quality: 'idle' | 'connecting' | 'good' | 'fair' | 'poor' | 'failed' | 'disconnected' | 'closed'
// rtt: number (ms) or null

const QUALITY_CONFIG = {
  idle:         { label: '',            icon: null,  color: 'neutral' },
  connecting:   { label: 'Connecting',  icon: '○',   color: 'neutral' },
  good:         { label: 'Good',        icon: '●●●', color: 'good'    },
  fair:         { label: 'Fair',        icon: '●●○', color: 'fair'    },
  poor:         { label: 'Poor',        icon: '●○○', color: 'poor'    },
  failed:       { label: 'Failed',      icon: '✕',   color: 'failed'  },
  disconnected: { label: 'Reconnecting',icon: '↻',   color: 'neutral' },
  closed:       { label: '',            icon: null,  color: 'neutral' },
};

export default function ConnectionBadge({ quality = 'idle', rtt = null }) {
  const config = QUALITY_CONFIG[quality] ?? QUALITY_CONFIG.idle;

  if (!config.icon) return null; // Don't render for idle/closed

  return (
    <div
      className={`${styles.badge} ${styles[config.color]}`}
      title={rtt !== null ? `${rtt}ms latency` : config.label}
      aria-label={`Connection: ${config.label}${rtt !== null ? `, ${rtt}ms` : ''}`}
    >
      <span className={styles.icon} aria-hidden="true">{config.icon}</span>
      <span className={styles.label}>{config.label}</span>
      {rtt !== null && quality !== 'connecting' && (
        <span className={styles.rtt}>{rtt}ms</span>
      )}
    </div>
  );
}
