import { useState, useRef, useEffect, useCallback } from "react";

// useMedia
// Acquires camera + microphone access via getUserMedia.
//
// Accepts optional deviceIds so the user's device selection from the lobby is
// used when creating the call stream, plus initialAudioOn/initialVideoOn so a
// user who muted in the lobby enters the room already muted.
//
// Screen-sharing is preserved from the original implementation.
export function useMedia({
  cameraDeviceId = null,
  micDeviceId    = null,
  initialAudioOn = true,
  initialVideoOn = true,
} = {}) {
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(initialAudioOn);
  const [videoEnabled, setVideoEnabled] = useState(initialVideoOn);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const streamRef = useRef(null);

  const initMedia = useCallback(async () => {
    setMediaLoading(true);
    setError(null);
    try {
      const constraints = {
        audio: micDeviceId
          ? { deviceId: { exact: micDeviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
        video: cameraDeviceId
          ? { deviceId: { exact: cameraDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Apply the lobby's initial mute / video-off state. We keep the tracks
      // (so peers receive silence / a black frame) but disable them.
      stream.getAudioTracks().forEach((t) => { t.enabled = initialAudioOn; });
      stream.getVideoTracks().forEach((t) => { t.enabled = initialVideoOn; });
      setAudioEnabled(initialAudioOn);
      setVideoEnabled(initialVideoOn);

      setLocalStream(stream);
      return stream;
    } catch (err) {
      const friendlyMessage =
        err.name === "NotAllowedError"  ? "Camera/mic permission denied. Please allow access in your browser settings." :
        err.name === "NotFoundError"    ? "No camera or microphone found." :
        err.name === "NotReadableError" ? "Camera or microphone is already in use by another app." :
                                          `Media error: ${err.message}`;
      setError(friendlyMessage);
      console.error("[useMedia]", err);
      return null;
    } finally {
      setMediaLoading(false);
    }
  }, [cameraDeviceId, micDeviceId, initialAudioOn, initialVideoOn]);

  const toggleAudio = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return audioEnabled;
    const enabled = !audioEnabled;
    stream.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setAudioEnabled(enabled);
    return enabled;
  }, [audioEnabled]);

  const toggleVideo = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return videoEnabled;
    const enabled = !videoEnabled;
    stream.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setVideoEnabled(enabled);
    return enabled;
  }, [videoEnabled]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      setIsScreenSharing(true);
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      return stream;
    } catch (err) {
      console.error("Screen share error:", err);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScreenShare = useCallback(() => {
    setScreenStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setIsScreenSharing(false);
  }, []);

  // Stop the camera/mic stream only (releases the hardware — green light off).
  const stopMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  // Stop both camera/mic and screen-share streams.
  const stopAllMedia = useCallback(() => {
    stopMedia();
    setScreenStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setIsScreenSharing(false);
  }, [stopMedia]);

  // Cleanup on unmount — release the hardware.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return {
    localStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    error,
    mediaError: error,
    mediaLoading,
    initMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    stopMedia,
    stopAllMedia,
  };
}
