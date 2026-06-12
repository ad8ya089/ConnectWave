// client/src/hooks/useMotionDetection.js
import { useEffect, useRef, useState, useCallback } from 'react';

// SAMPLE_WIDTH/HEIGHT: resolution of the motion detection canvas.
// Lower = faster, less accurate. 80×45 is plenty for presence detection.
const SAMPLE_WIDTH  = 80;
const SAMPLE_HEIGHT = 45;
const SAMPLE_PIXELS = SAMPLE_WIDTH * SAMPLE_HEIGHT;

// PIXEL_DIFF_THRESHOLD: how much a pixel's luminance must change (0–255) to count as "moved"
const PIXEL_DIFF_THRESHOLD = 18;

// MOTION_THRESHOLD: fraction of pixels that must change to register as "motion"
// 0.03 = 3% of pixels — sensitive enough for typing/gesturing, ignores noise
const MOTION_THRESHOLD = 0.03;

// POLL_INTERVAL_MS: how often to sample a frame
const POLL_INTERVAL_MS = 200;

// MOTION_DECAY_MS: how long motion level takes to decay back to 0 after movement stops
const MOTION_DECAY_MS = 2000;

// useMotionDetection
//
// stream: MediaStream (the remote peer's video stream, or local stream)
// enabled: boolean — pause detection when ambient mode is off (save CPU)
//
// Returns: { motionLevel: 0.0–1.0, isMoving: boolean }
//
// motionLevel drives the orb glow intensity (CSS custom property)
// isMoving drives the faster pulse animation class

export const useMotionDetection = (stream, enabled = true) => {
  const [motionLevel, setMotionLevel] = useState(0);
  const [isMoving,    setIsMoving]    = useState(false);

  const canvasRef      = useRef(null);
  const videoElRef     = useRef(null);
  const prevDataRef    = useRef(null); // previous frame pixel data
  const intervalRef    = useRef(null);
  const lastMotionRef  = useRef(0);   // timestamp of last detected motion
  const decayTimerRef  = useRef(null);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (decayTimerRef.current) {
      clearTimeout(decayTimerRef.current);
      decayTimerRef.current = null;
    }
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }
    prevDataRef.current = null;
    setMotionLevel(0);
    setIsMoving(false);
  }, []);

  useEffect(() => {
    if (!stream || !enabled) {
      stopDetection();
      return;
    }

    // Create a tiny canvas for frame sampling
    const canvas = document.createElement('canvas');
    canvas.width  = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Hidden video element to read stream frames from
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {}); // may fail if stream has no video track
    videoElRef.current = video;

    const sampleFrame = () => {
      if (!video || video.readyState < 2) return; // not ready yet

      // Draw current frame downsampled to our tiny canvas
      ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);

      // Read pixel data as flat Uint8ClampedArray [R,G,B,A, R,G,B,A, ...]
      const { data: currentData } = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);

      if (!prevDataRef.current) {
        // First frame — nothing to compare against yet
        prevDataRef.current = currentData;
        return;
      }

      // Count changed pixels by comparing luminance (Y = 0.299R + 0.587G + 0.114B)
      let changedPixels = 0;
      for (let i = 0; i < currentData.length; i += 4) {
        const prevLum = 0.299 * prevDataRef.current[i] + 0.587 * prevDataRef.current[i + 1] + 0.114 * prevDataRef.current[i + 2];
        const currLum = 0.299 * currentData[i]         + 0.587 * currentData[i + 1]         + 0.114 * currentData[i + 2];
        if (Math.abs(currLum - prevLum) > PIXEL_DIFF_THRESHOLD) {
          changedPixels++;
        }
      }

      prevDataRef.current = currentData;

      // Calculate motion ratio (0.0 – 1.0)
      const ratio = changedPixels / SAMPLE_PIXELS;
      const moving = ratio > MOTION_THRESHOLD;

      if (moving) {
        lastMotionRef.current = Date.now();
        // Scale level: 0.03 ratio → 0.3 level, 0.15+ ratio → 1.0 level
        const level = Math.min(1.0, (ratio - MOTION_THRESHOLD) / 0.12 + 0.3);
        setMotionLevel(level);
        setIsMoving(true);

        // Reset the decay timer
        if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
        decayTimerRef.current = setTimeout(() => {
          setMotionLevel(0);
          setIsMoving(false);
        }, MOTION_DECAY_MS);
      }
    };

    intervalRef.current = setInterval(sampleFrame, POLL_INTERVAL_MS);

    return () => stopDetection();
  }, [stream, enabled, stopDetection]);

  return { motionLevel, isMoving };
};
