import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC({ roomId, userName, localStream }) {
  const socket = useSocket();
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> { stream, userName }

  const createPeer = useCallback(
    (targetId, isInitiator) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

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

      pc.onconnectionstatechange = () => {
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[targetId];
            return next;
          });
          delete peersRef.current[targetId];
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
    [localStream, socket]
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

      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
    };
  }, [socket, roomId, createPeer]);

  return { remoteStreams };
}
