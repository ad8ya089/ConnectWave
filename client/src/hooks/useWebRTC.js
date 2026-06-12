import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext";
import { useIceQuality } from "./useIceQuality";
import { getTurnCredentials } from "../services/roomApi";

// Fallback ICE config used when TURN credential fetch fails.
// STUN-only — works for most home/mobile networks.
const STUN_ONLY_ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// How often to poll WebRTC stats for RTT measurement (milliseconds)
const STATS_POLL_INTERVAL_MS = 4000;

// How long to wait for ICE gathering before giving up and sending what we have
const ICE_GATHERING_TIMEOUT_MS = 8000;

export function useWebRTC({ roomId, userName, localStream }) {
  const socket = useSocket();
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> { stream, userName }

  // ICE server config — fetched from Room Service on mount.
  // Used for all RTCPeerConnection instantiations in this session.
  const iceConfigRef = useRef(STUN_ONLY_ICE);

  // Stats polling interval handle
  const statsIntervalRef = useRef(null);

  // ICE quality tracking
  const { peerQualities, updateIceState, updateRtt, removePeer } = useIceQuality();

  // ── Fetch TURN credentials ──────────────────────────────────────────────────
  // Called once when the hook mounts (i.e. when RoomPage mounts).
  // Credentials are stored in iceConfigRef and used for all subsequent
  // RTCPeerConnection instantiations in this session.
  // If the fetch fails, we fall back to STUN-only silently.
  useEffect(() => {
    let cancelled = false;
    const fetchIceConfig = async () => {
      try {
        const { iceServers } = await getTurnCredentials(userName);
        if (cancelled) return;
        iceConfigRef.current = { iceServers };
        console.debug("[WebRTC] TURN credentials fetched successfully", { count: iceServers.length });
      } catch (err) {
        console.warn("[WebRTC] TURN credential fetch failed, falling back to STUN-only:", err.message);
        iceConfigRef.current = STUN_ONLY_ICE;
      }
    };
    fetchIceConfig();
    return () => {
      cancelled = true;
    };
  }, [userName]);

  // ── Stats polling ───────────────────────────────────────────────────────────
  // Every STATS_POLL_INTERVAL_MS, iterate all active peer connections,
  // call getStats(), find the active "candidate-pair" report, and extract
  // currentRoundTripTime (in seconds, convert to ms). Drives the RTT-based
  // quality indicator (good/fair/poor).
  const startStatsPolling = useCallback(() => {
    if (statsIntervalRef.current) return; // already running

    statsIntervalRef.current = setInterval(async () => {
      for (const [socketId, pc] of Object.entries(peersRef.current)) {
        if (pc.connectionState === "closed") continue;

        try {
          const stats = await pc.getStats();
          stats.forEach((report) => {
            // The 'candidate-pair' report with state 'succeeded' is the active pair
            if (
              report.type === "candidate-pair" &&
              report.state === "succeeded" &&
              report.currentRoundTripTime !== undefined
            ) {
              const rttMs = Math.round(report.currentRoundTripTime * 1000);
              updateRtt(socketId, rttMs);
            }
          });
        } catch {
          // getStats() can throw if connection is in a bad state — ignore
        }
      }
    }, STATS_POLL_INTERVAL_MS);
  }, [updateRtt]);

  const stopStatsPolling = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  const createPeer = useCallback(
    (targetId, isInitiator) => {
      const pc = new RTCPeerConnection(iceConfigRef.current);

      // Add local tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      }

      // ICE candidates
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit("ice-candidate", { to: targetId, candidate });
        }
      };

      // Remote stream
      pc.ontrack = ({ streams }) => {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetId]: { ...prev[targetId], stream: streams[0] },
        }));
      };

      // ── ICE gathering timeout ───────────────────────────────────────────────
      // Some networks (very restricted symmetric NAT) never complete ICE
      // gathering. After ICE_GATHERING_TIMEOUT_MS, stop waiting — trickle ICE
      // means candidates can still arrive via signaling after the offer/answer.
      let iceGatheringTimer = null;
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "gathering") {
          iceGatheringTimer = setTimeout(() => {
            console.warn(`[WebRTC] ICE gathering timeout for peer ${targetId}`);
          }, ICE_GATHERING_TIMEOUT_MS);
        } else if (pc.iceGatheringState === "complete") {
          if (iceGatheringTimer) {
            clearTimeout(iceGatheringTimer);
            iceGatheringTimer = null;
          }
        }
      };

      // ── ICE connection state changes ────────────────────────────────────────
      // Primary signal for connection health. Maps to the quality indicator and
      // handles failed/disconnected connections.
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.debug(`[WebRTC] ICE state for ${targetId}:`, state);

        updateIceState(targetId, state);

        if (state === "connected" || state === "completed") {
          // Start stats polling when at least one connection is up
          startStatsPolling();
        }

        if (state === "failed") {
          // ICE restart: ask the browser to try new ICE candidates.
          // This triggers a new offer/answer cycle with fresh candidates.
          // Effective when network conditions changed mid-call (WiFi -> cellular).
          console.warn(`[WebRTC] ICE failed for ${targetId}, attempting restart`);
          pc.restartIce();
        }

        if (state === "disconnected") {
          // 'disconnected' is often transient (brief network hiccup).
          // Give it 10 seconds to recover before warning.
          setTimeout(() => {
            if (pc.iceConnectionState === "disconnected") {
              console.warn(`[WebRTC] Peer ${targetId} still disconnected after 10s`);
            }
          }, 10000);
        }
      };

      pc.onconnectionstatechange = () => {
        console.debug(`[WebRTC] Connection state for ${targetId}:`, pc.connectionState);
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[targetId];
            return next;
          });
          delete peersRef.current[targetId];
          removePeer(targetId);
        }
      };

      peersRef.current[targetId] = pc;

      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit("offer", { to: targetId, offer: pc.localDescription });
          });
      }

      return pc;
    },
    [localStream, socket, updateIceState, startStatsPolling, removePeer]
  );

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.on("room-peers", (peers) => {
      peers.forEach(({ socketId, userName: peerName }) => {
        setRemoteStreams((prev) => ({ ...prev, [socketId]: { userName: peerName } }));
        createPeer(socketId, true);
      });
    });

    socket.on("user-joined", ({ socketId, userName: peerName }) => {
      setRemoteStreams((prev) => ({ ...prev, [socketId]: { userName: peerName } }));
      createPeer(socketId, false);
    });

    socket.on("offer", async ({ from, offer }) => {
      let pc = peersRef.current[from];
      if (!pc) pc = createPeer(from, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, answer: pc.localDescription });
    });

    socket.on("answer", async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("ICE error", e);
        }
      }
    });

    socket.on("user-left", ({ socketId }) => {
      peersRef.current[socketId]?.close();
      delete peersRef.current[socketId];
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      removePeer(socketId);
    });

    socket.on("peer-audio-toggle", ({ socketId, enabled }) => {
      setRemoteStreams((prev) =>
        prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], audioEnabled: enabled } } : prev
      );
    });

    socket.on("peer-video-toggle", ({ socketId, enabled }) => {
      setRemoteStreams((prev) =>
        prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], videoEnabled: enabled } } : prev
      );
    });

    return () => {
      socket.off("room-peers");
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-left");
      socket.off("peer-audio-toggle");
      socket.off("peer-video-toggle");

      stopStatsPolling();
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
    };
  }, [socket, roomId, createPeer, removePeer, stopStatsPolling]);

  return { remoteStreams, peerQualities };
}
