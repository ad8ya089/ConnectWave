// client/src/hooks/useAmbientMode.js
import { useState, useEffect, useRef, useCallback } from 'react';

// Pomodoro durations (seconds)
const WORK_DURATION_SEC  = 25 * 60; // 25 minutes
const BREAK_DURATION_SEC =  5 * 60; //  5 minutes

// How long a reaction pulse animation lasts (ms)
const REACTION_DURATION_MS = 2000;

// How long an ambient status message is visible (ms)
const STATUS_DURATION_MS = 5000;

// useAmbientMode
//
// socket: Socket.io socket
// roomId: string
//
// Returns all the ambient-mode state and controls needed by the UI.

export const useAmbientMode = (socket, roomId) => {
  // ── Ambient on/off ─────────────────────────────────────────────────────────
  const [ambientEnabled, setAmbientEnabled] = useState(false);

  const toggleAmbient = useCallback(() => {
    setAmbientEnabled((prev) => !prev);
  }, []);

  // ── Focus Timer ────────────────────────────────────────────────────────────
  const [timerPhase,     setTimerPhase]     = useState('work');  // 'work' | 'break'
  const [timerRunning,   setTimerRunning]   = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(WORK_DURATION_SEC);

  // We store startedAt + phase received from the server to recompute remaining time.
  // This avoids drift: all clients compute remaining from (serverTime + elapsed),
  // rather than each client running their own independent countdown.
  const timerStateRef = useRef({ startedAt: null, phase: 'work' });
  const timerTickRef  = useRef(null);

  const startTick = useCallback(() => {
    if (timerTickRef.current) return;
    timerTickRef.current = setInterval(() => {
      const { startedAt, phase } = timerStateRef.current;
      if (!startedAt) return;

      const duration = phase === 'work' ? WORK_DURATION_SEC : BREAK_DURATION_SEC;
      const elapsed  = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, duration - elapsed);

      setTimerRemaining(remaining);

      if (remaining === 0) {
        // Phase complete — switch automatically
        clearInterval(timerTickRef.current);
        timerTickRef.current = null;
        setTimerRunning(false);
        setTimerPhase((prev) => prev === 'work' ? 'break' : 'work');
        setTimerRemaining(phase === 'work' ? BREAK_DURATION_SEC : WORK_DURATION_SEC);
      }
    }, 1000);
  }, []);

  const stopTick = useCallback(() => {
    if (timerTickRef.current) {
      clearInterval(timerTickRef.current);
      timerTickRef.current = null;
    }
  }, []);

  // Local controls — emit to server, server rebroadcasts to all (including self)

  const startTimer = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit('ambient-timer-sync', {
      roomId,
      action: 'start',
      startedAt: Date.now(),
      phase: timerPhase,
    });
  }, [socket, roomId, timerPhase]);

  const pauseTimer = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit('ambient-timer-sync', {
      roomId,
      action: 'pause',
      startedAt: null,
      phase: timerPhase,
    });
  }, [socket, roomId, timerPhase]);

  const resetTimer = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit('ambient-timer-sync', {
      roomId,
      action: 'reset',
      startedAt: null,
      phase: 'work',
    });
  }, [socket, roomId]);

  // ── Reactions ──────────────────────────────────────────────────────────────
  // activeReactions: [{ id, fromSocketId, emoji, timestamp }]
  const [activeReactions, setActiveReactions] = useState([]);

  const sendReaction = useCallback((emoji) => {
    if (!socket || !roomId) return;
    socket.emit('ambient-reaction', { roomId, emoji });
  }, [socket, roomId]);

  // ── Status messages ────────────────────────────────────────────────────────
  // activeStatuses: [{ id, fromSocketId, message, timestamp }]
  const [activeStatuses, setActiveStatuses] = useState([]);

  const sendStatus = useCallback((message) => {
    if (!socket || !roomId) return;
    const safeMsg = String(message).slice(0, 40);
    socket.emit('ambient-status', { roomId, message: safeMsg });
  }, [socket, roomId]);

  // ── Socket event listeners ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    // Timer sync from server
    const handleTimerSync = ({ action, startedAt, phase, serverTime }) => {
      // Correct for network latency: adjust startedAt by the round-trip diff
      const latencyMs = Date.now() - serverTime;
      const adjustedStartedAt = startedAt ? startedAt + latencyMs : null;

      timerStateRef.current = { startedAt: adjustedStartedAt, phase };
      setTimerPhase(phase);

      if (action === 'start') {
        setTimerRunning(true);
        startTick();
      } else if (action === 'pause' || action === 'reset') {
        stopTick();
        setTimerRunning(false);
        if (action === 'reset') {
          setTimerRemaining(WORK_DURATION_SEC);
          setTimerPhase('work');
          timerStateRef.current = { startedAt: null, phase: 'work' };
        }
      }
    };

    // Reaction pulse — add to active reactions, auto-remove after animation
    const handleReaction = ({ from, emoji, timestamp }) => {
      const id = `${from}-${timestamp}`;
      setActiveReactions((prev) => [...prev, { id, fromSocketId: from, emoji, timestamp }]);
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== id));
      }, REACTION_DURATION_MS);
    };

    // Status message — add to active statuses, auto-remove after display duration
    const handleStatus = ({ from, message, timestamp }) => {
      const id = `${from}-${timestamp}`;
      setActiveStatuses((prev) => {
        // Replace previous status from same sender (one status per person at a time)
        const filtered = prev.filter((s) => s.fromSocketId !== from);
        return [...filtered, { id, fromSocketId: from, message, timestamp }];
      });
      setTimeout(() => {
        setActiveStatuses((prev) => prev.filter((s) => s.id !== id));
      }, STATUS_DURATION_MS);
    };

    socket.on('ambient-timer-sync', handleTimerSync);
    socket.on('ambient-reaction',   handleReaction);
    socket.on('ambient-status',     handleStatus);

    return () => {
      socket.off('ambient-timer-sync', handleTimerSync);
      socket.off('ambient-reaction',   handleReaction);
      socket.off('ambient-status',     handleStatus);
    };
  }, [socket, startTick, stopTick]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTick();
  }, [stopTick]);

  return {
    // Ambient on/off
    ambientEnabled,
    toggleAmbient,

    // Focus Timer
    timerPhase,
    timerRunning,
    timerRemaining,
    startTimer,
    pauseTimer,
    resetTimer,

    // Reactions
    activeReactions,
    sendReaction,

    // Status messages
    activeStatuses,
    sendStatus,
  };
};
