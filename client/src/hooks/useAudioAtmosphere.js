// client/src/hooks/useAudioAtmosphere.js
import { useRef, useCallback, useEffect, useState } from 'react';

// Cutoff frequency for the low-pass filter in ambient mode (Hz).
// 800Hz passes low-frequency vocal rumble but cuts intelligible speech
// (human speech intelligibility starts at ~1kHz).
const AMBIENT_LOWPASS_HZ = 800;

// Normal mode: let all frequencies through (20kHz = effectively bypassed)
const NORMAL_LOWPASS_HZ = 20000;

// Reverb impulse response length (seconds) — longer = more cavernous
const REVERB_DURATION_SEC = 1.5;

// useAudioAtmosphere
//
// ambientEnabled: boolean — when true, apply atmosphere filters
//
// Returns:
//   connectPeerAudio(socketId, stream) — call this when a new peer's stream arrives
//   disconnectPeerAudio(socketId)      — call on peer disconnect
//   togglePeerClarity(socketId)        — toggle full-clarity for one peer
//   peerClarityMap                     — { socketId: boolean } (true = clarity mode)

export const useAudioAtmosphere = (ambientEnabled) => {
  const audioCtxRef     = useRef(null);
  const peerNodesRef    = useRef({}); // { socketId: { source, filter, gainNode } }
  const reverbNodeRef   = useRef(null);
  const masterGainRef   = useRef(null);

  const [peerClarityMap, setPeerClarityMap] = useState({}); // { socketId: boolean }

  // ── Get or create AudioContext ─────────────────────────────────────────────
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // AudioContext starts suspended — resume on user gesture
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // ── Build a synthetic reverb impulse response ──────────────────────────────
  // We synthesise the impulse response mathematically rather than loading
  // an audio file — no extra network requests, works offline.
  // This creates a soft room-reverb effect suitable for ambient murmur.

  const createReverbNode = useCallback((ctx) => {
    const convolver = ctx.createConvolver();
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * REVERB_DURATION_SEC;
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponentially decaying white noise — standard reverb IR formula
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }, []);

  // ── Connect a peer's audio stream ──────────────────────────────────────────

  const connectPeerAudio = useCallback((socketId, stream) => {
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;

    const ctx = getAudioCtx();

    // Disconnect existing nodes for this peer if any
    if (peerNodesRef.current[socketId]) {
      try {
        peerNodesRef.current[socketId].source.disconnect();
      } catch { /* already disconnected */ }
    }

    // Source node — reads from the peer's MediaStream
    const source = ctx.createMediaStreamSource(stream);

    // Low-pass filter — the core of the ambient effect
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = ambientEnabled ? AMBIENT_LOWPASS_HZ : NORMAL_LOWPASS_HZ;
    filter.Q.value = 0.5; // gentle rolloff

    // Per-peer gain node — allows per-peer volume control
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1.0;

    // Create shared reverb + master gain if not yet created
    if (!reverbNodeRef.current) {
      reverbNodeRef.current = createReverbNode(ctx);
      reverbNodeRef.current.connect(ctx.destination);
    }
    if (!masterGainRef.current) {
      masterGainRef.current = ctx.createGain();
      masterGainRef.current.gain.value = ambientEnabled ? 0.4 : 1.0;
      masterGainRef.current.connect(ctx.destination);
    }

    // Signal chain:
    // source → filter → gainNode → masterGain → destination (speakers)
    //                           ↘ reverb → destination (blended in)
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGainRef.current);

    if (ambientEnabled) {
      // Also route through reverb at lower gain for spatial effect
      gainNode.connect(reverbNodeRef.current);
    }

    peerNodesRef.current[socketId] = { source, filter, gainNode };
  }, [ambientEnabled, getAudioCtx, createReverbNode]);

  // ── Disconnect a peer's audio nodes ────────────────────────────────────────

  const disconnectPeerAudio = useCallback((socketId) => {
    const nodes = peerNodesRef.current[socketId];
    if (!nodes) return;
    try {
      nodes.source.disconnect();
      nodes.filter.disconnect();
      nodes.gainNode.disconnect();
    } catch { /* already disconnected */ }
    delete peerNodesRef.current[socketId];
    setPeerClarityMap((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }, []);

  // ── Toggle clarity for a specific peer ─────────────────────────────────────
  // Temporarily bypasses the low-pass filter for one peer so you can hear
  // them clearly while others remain in ambient murmur.

  const togglePeerClarity = useCallback((socketId) => {
    const nodes = peerNodesRef.current[socketId];
    if (!nodes) return;

    setPeerClarityMap((prev) => {
      const wasClarity = !!prev[socketId];
      const nowClarity = !wasClarity;

      // Update filter frequency for this peer
      nodes.filter.frequency.setTargetAtTime(
        nowClarity ? NORMAL_LOWPASS_HZ : AMBIENT_LOWPASS_HZ,
        audioCtxRef.current.currentTime,
        0.05 // smooth transition over 50ms
      );
      // Boost gain slightly when in clarity mode
      nodes.gainNode.gain.setTargetAtTime(
        nowClarity ? 1.4 : 1.0,
        audioCtxRef.current.currentTime,
        0.05
      );

      return { ...prev, [socketId]: nowClarity };
    });
  }, []);

  // ── React to ambientEnabled changes ────────────────────────────────────────

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const targetFilterHz = ambientEnabled ? AMBIENT_LOWPASS_HZ : NORMAL_LOWPASS_HZ;
    const targetMasterGain = ambientEnabled ? 0.4 : 1.0;

    // Update all peer filters smoothly (skip peers in clarity mode)
    Object.entries(peerNodesRef.current).forEach(([socketId, nodes]) => {
      const isClarity = peerClarityMap[socketId];
      if (!isClarity) {
        nodes.filter.frequency.setTargetAtTime(targetFilterHz, ctx.currentTime, 0.3);
      }
      // (Re)route reverb send based on ambient state
      try {
        if (ambientEnabled && reverbNodeRef.current) {
          nodes.gainNode.connect(reverbNodeRef.current);
        } else if (reverbNodeRef.current) {
          nodes.gainNode.disconnect(reverbNodeRef.current);
        }
      } catch { /* connection may already be in the desired state */ }
    });

    // Update master gain
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(targetMasterGain, ctx.currentTime, 0.3);
    }
  }, [ambientEnabled, peerClarityMap]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      Object.keys(peerNodesRef.current).forEach(disconnectPeerAudio);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, [disconnectPeerAudio]);

  return {
    connectPeerAudio,
    disconnectPeerAudio,
    togglePeerClarity,
    peerClarityMap,
  };
};
