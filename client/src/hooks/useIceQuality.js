// client/src/hooks/useIceQuality.js
import { useState, useCallback } from 'react';

// Maps RTCPeerConnection.iceConnectionState to a display quality level
// RTCIceConnectionState values: 'new' | 'checking' | 'connected' | 'completed'
//                               | 'failed' | 'disconnected' | 'closed'
const deriveQuality = (iceState, statsRtt) => {
  if (!iceState || iceState === 'new')           return 'idle';
  if (iceState === 'checking')                   return 'connecting';
  if (iceState === 'failed')                     return 'failed';
  if (iceState === 'closed')                     return 'closed';
  if (iceState === 'disconnected')               return 'disconnected';

  // connected or completed — check RTT if available
  if (iceState === 'connected' || iceState === 'completed') {
    if (statsRtt === null || statsRtt === undefined) return 'good'; // no stats yet
    if (statsRtt < 150)  return 'good';    // <150ms — excellent
    if (statsRtt < 350)  return 'fair';    // 150–350ms — usable
    return 'poor';                          // >350ms — degraded
  }

  return 'idle';
};

// useIceQuality
// Maintains a Map of { socketId -> { iceState, rtt, quality } }
// and provides an updater that RTCPeerConnection event handlers call.
//
// Usage:
//   const { peerQualities, updateIceState, updateRtt } = useIceQuality();
//
// Then in your peer connection setup:
//   pc.oniceconnectionstatechange = () => updateIceState(socketId, pc.iceConnectionState);
//
// And in your stats polling:
//   updateRtt(socketId, rttMs);

export const useIceQuality = () => {
  const [peerQualities, setPeerQualities] = useState({}); // { socketId: { iceState, rtt, quality } }

  const updateIceState = useCallback((socketId, iceState) => {
    setPeerQualities((prev) => {
      const existing = prev[socketId] || {};
      const rtt = existing.rtt ?? null;
      return {
        ...prev,
        [socketId]: {
          ...existing,
          iceState,
          quality: deriveQuality(iceState, rtt),
        },
      };
    });
  }, []);

  const updateRtt = useCallback((socketId, rtt) => {
    setPeerQualities((prev) => {
      const existing = prev[socketId] || {};
      const iceState = existing.iceState ?? 'connected';
      return {
        ...prev,
        [socketId]: {
          ...existing,
          rtt,
          quality: deriveQuality(iceState, rtt),
        },
      };
    });
  }, []);

  const removePeer = useCallback((socketId) => {
    setPeerQualities((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }, []);

  return { peerQualities, updateIceState, updateRtt, removePeer };
};
