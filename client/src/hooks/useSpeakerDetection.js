// client/src/hooks/useSpeakerDetection.js
import { useRef, useEffect, useState, useCallback } from 'react';

const SPEAKING_THRESHOLD = 12;
const POLL_INTERVAL_MS = 500;
const SILENCE_COUNT_THRESHOLD = 3;

export const useSpeakerDetection = ({ remoteStreams, localStream, mySocketId, enabled = true }) => {
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const audioCtxRef  = useRef(null);
  const analysersRef = useRef({});
  const intervalRef  = useRef(null);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const buildAnalyser = useCallback((stream, socketId) => {
    if (!stream || !stream.getAudioTracks().length) return;
    const ctx      = getCtx();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);
    analysersRef.current[socketId] = { analyser, source, silenceCount: 0 };
  }, [getCtx]);

  const measureRms = (analyser) => {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sumSq = 0;
    for (let i = 0; i < data.length; i++) {
      const deviation = data[i] - 128;
      sumSq += deviation * deviation;
    }
    return Math.sqrt(sumSq / data.length);
  };

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      const entries = Object.entries(analysersRef.current);
      if (!entries.length) return;

      let maxRms      = SPEAKING_THRESHOLD;
      let maxSocketId = null;

      for (const [socketId, { analyser }] of entries) {
        const rms = measureRms(analyser);
        if (rms > maxRms) {
          maxRms      = rms;
          maxSocketId = socketId;
        }
        analysersRef.current[socketId].silenceCount =
          rms > SPEAKING_THRESHOLD ? 0 : (analysersRef.current[socketId].silenceCount + 1);
      }

      setActiveSpeakerId((prev) => {
        if (maxSocketId) return maxSocketId;
        if (prev && analysersRef.current[prev]?.silenceCount >= SILENCE_COUNT_THRESHOLD) {
          return null;
        }
        return prev;
      });
    }, POLL_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    const allStreams = {
      ...(mySocketId && localStream ? { [mySocketId]: localStream } : {}),
      ...remoteStreams,
    };

    for (const socketId of Object.keys(analysersRef.current)) {
      if (!allStreams[socketId]) {
        try {
          analysersRef.current[socketId].source.disconnect();
          analysersRef.current[socketId].analyser.disconnect();
        } catch {}
        delete analysersRef.current[socketId];
      }
    }

    for (const [socketId, stream] of Object.entries(allStreams)) {
      if (!analysersRef.current[socketId]) {
        buildAnalyser(stream, socketId);
      }
    }

    if (Object.keys(analysersRef.current).length > 0) {
      startPolling();
    }

    return () => {};
  }, [remoteStreams, localStream, mySocketId, enabled, buildAnalyser, startPolling, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
      for (const { source, analyser } of Object.values(analysersRef.current)) {
        try { source.disconnect(); analyser.disconnect(); } catch {}
      }
      analysersRef.current = {};
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, [stopPolling]);

  return { activeSpeakerId };
};
