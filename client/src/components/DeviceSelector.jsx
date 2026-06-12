// client/src/components/DeviceSelector.jsx
import styles from './DeviceSelector.module.css';

// devices: [{ deviceId, label }]
// value: currently selected deviceId
// onChange: (deviceId) => void
// label: string ("Camera" | "Microphone" | "Speaker")
// icon: string emoji or SVG

export default function DeviceSelector({ devices, value, onChange, label, icon, disabled }) {
  if (!devices || devices.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>
        <span className={styles.icon}>{icon}</span>
        {label}
      </label>
      <select
        className={styles.select}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
  );
}
