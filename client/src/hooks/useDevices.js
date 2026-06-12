// client/src/hooks/useDevices.js
import { useState, useEffect, useCallback } from 'react';

// useDevices
// Returns lists of available cameras, microphones, and speakers.
// Re-fetches whenever the device list changes (USB webcam plugged in, etc.)
//
// Note: device labels are only available after the user has granted
// camera/mic permission at least once. Before permission, labels are empty
// strings. Call this hook AFTER getUserMedia has been called once.

export const useDevices = () => {
  const [cameras,     setCameras]     = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [speakers,    setSpeakers]    = useState([]);
  const [loading,     setLoading]     = useState(true);

  const enumerate = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      setCameras(
        devices
          .filter((d) => d.kind === 'videoinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${i + 1}`,
          }))
      );

      setMicrophones(
        devices
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${i + 1}`,
          }))
      );

      // Speaker selection (setSinkId) is only supported in Chromium browsers.
      // We still enumerate and show them — gracefully skip setSinkId on Firefox.
      setSpeakers(
        devices
          .filter((d) => d.kind === 'audiooutput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Speaker ${i + 1}`,
          }))
      );
    } catch (err) {
      console.error('[useDevices] enumeration failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    enumerate();

    // Re-enumerate when a device is added or removed
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerate);
    };
  }, [enumerate]);

  return { cameras, microphones, speakers, loading, refresh: enumerate };
};
