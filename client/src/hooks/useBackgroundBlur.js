// client/src/hooks/useBackgroundBlur.js
import { useState, useEffect, useRef, useCallback } from 'react';

// useBackgroundBlur
//
// Takes a raw camera MediaStream and returns either:
//   - The original stream (when blur is disabled)
//   - A new MediaStream with background blurred (when blur is enabled)
//
// The blur works by:
//   1. Drawing each video frame from a hidden <video> element
//   2. Running TF.js body segmentation to get a person mask
//   3. Using bodySegmentation.drawBokehEffect() to blur the background while
//      keeping the segmented person sharp
//   4. Capturing that canvas as a MediaStream via captureStream()
//
// This runs entirely in the browser — no video data leaves the device.
// Performance: ~15–25 FPS on mid-range hardware with the WebGL backend.
// The original stream's audio tracks are carried through unchanged.
//
// The TF.js model + WebGL backend (~several MB) are loaded lazily via dynamic
// import — they are only downloaded the first time blur is enabled.

const FOREGROUND_THRESHOLD = 0.5; // confidence above which a pixel is "person"
const BACKGROUND_BLUR_AMOUNT = 12; // px of blur applied to the background
const EDGE_BLUR_AMOUNT = 4;        // px of feathering on the person/background edge
const CAPTURE_FPS = 30;

export const useBackgroundBlur = (rawStream) => {
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [blurStream,  setBlurStream]  = useState(null);
  const [blurLoading, setBlurLoading] = useState(false); // true while model loads
  const [blurError,   setBlurError]   = useState(null);

  const segmenterRef = useRef(null);  // the TF.js segmenter instance
  const bodySegRef   = useRef(null);  // the body-segmentation module namespace
  const animFrameRef = useRef(null);
  const canvasRef    = useRef(null);
  const videoElRef   = useRef(null);  // hidden video element to read frames from

  // ── Load model lazily ────────────────────────────────────────────────────
  const loadModel = useCallback(async () => {
    if (segmenterRef.current) return segmenterRef.current;

    setBlurLoading(true);
    setBlurError(null);

    try {
      // Dynamic imports — these chunks are only downloaded when blur is first
      // enabled. Vite code-splits them into separate bundles automatically.
      const [tf, bodySegmentation] = await Promise.all([
        import('@tensorflow/tfjs-core'),
        import('@tensorflow-models/body-segmentation'),
      ]);

      // tfjs-converter is required by the tfjs runtime to load the model graph.
      await import('@tensorflow/tfjs-converter');

      // WebGL backend (GPU-accelerated). If it fails to register, tf.ready()
      // will fall back to whatever backend is available.
      await import('@tensorflow/tfjs-backend-webgl');
      try {
        await tf.setBackend('webgl');
      } catch {
        // leave default backend
      }
      await tf.ready();

      const segmenter = await bodySegmentation.createSegmenter(
        bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
        {
          runtime: 'tfjs',
          modelType: 'general', // 'general' balances speed vs quality
        }
      );

      segmenterRef.current = segmenter;
      bodySegRef.current = bodySegmentation;
      console.debug('[BackgroundBlur] Model loaded, backend:', tf.getBackend());
      return segmenter;
    } catch (err) {
      console.error('[BackgroundBlur] Model load failed:', err);
      setBlurError('Background blur unavailable on this device.');
      return null;
    } finally {
      setBlurLoading(false);
    }
  }, []);

  // ── Rendering loop ────────────────────────────────────────────────────────
  // Runs at display refresh rate (requestAnimationFrame). For each frame:
  // segment people, then draw the bokeh (blurred background) effect to canvas.
  const startRenderLoop = useCallback((segmenter, videoEl, canvas) => {
    const bodySeg = bodySegRef.current;

    const render = async () => {
      if (!videoElRef.current || videoEl.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const { videoWidth: w, videoHeight: h } = videoEl;
      if (w && canvas.width !== w)  canvas.width  = w;
      if (h && canvas.height !== h) canvas.height = h;

      try {
        const segmentation = await segmenter.segmentPeople(videoEl, {
          flipHorizontal: false,
          multiSegmentation: false,
          segmentBodyParts: false,
        });

        await bodySeg.drawBokehEffect(
          canvas,
          videoEl,
          segmentation,
          FOREGROUND_THRESHOLD,
          BACKGROUND_BLUR_AMOUNT,
          EDGE_BLUR_AMOUNT,
          false // flipHorizontal — mirroring is handled in CSS for the preview
        );
      } catch (err) {
        // Transient segmentation errors — draw the raw frame as a fallback
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      }

      // Continue only if still running (animFrameRef cleared by disableBlur)
      if (animFrameRef.current !== null) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  // ── Enable blur ───────────────────────────────────────────────────────────
  const enableBlur = useCallback(async () => {
    if (!rawStream) return;

    const segmenter = await loadModel();
    if (!segmenter) return; // model load failed — error already set

    // Hidden video element to read frames from the raw stream
    const videoEl = document.createElement('video');
    videoEl.srcObject = rawStream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    await videoEl.play();
    videoElRef.current = videoEl;

    // Output canvas — source of the blurred stream
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    canvasRef.current = canvas;

    // Capture the canvas as a MediaStream
    const processedVideoStream = canvas.captureStream(CAPTURE_FPS);

    // Combine processed video with the ORIGINAL audio tracks (audio is never
    // processed — we just carry it through unchanged).
    const audioTracks = rawStream.getAudioTracks();
    const combinedStream = new MediaStream([
      ...processedVideoStream.getVideoTracks(),
      ...audioTracks,
    ]);

    setBlurStream(combinedStream);
    setBlurEnabled(true);

    // Mark the loop as active before starting so render() keeps scheduling.
    animFrameRef.current = 0;
    startRenderLoop(segmenter, videoEl, canvas);
  }, [rawStream, loadModel, startRenderLoop]);

  // ── Disable blur ──────────────────────────────────────────────────────────
  const disableBlur = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animFrameRef.current = null;

    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }
    if (canvasRef.current) {
      canvasRef.current = null;
    }
    setBlurStream((prev) => {
      // Stop only the canvas-derived video track; never stop the shared audio
      // tracks (they belong to rawStream and are reused).
      if (prev) prev.getVideoTracks().forEach((t) => t.stop());
      return null;
    });
    setBlurEnabled(false);
  }, []);

  const toggleBlur = useCallback(() => {
    if (blurEnabled) disableBlur();
    else enableBlur();
  }, [blurEnabled, disableBlur, enableBlur]);

  // Cleanup on unmount or when rawStream changes
  useEffect(() => {
    return () => {
      disableBlur();
    };
  }, [rawStream, disableBlur]);

  // The stream to actually use:
  // - If blur is on: blurStream (processed canvas stream + original audio)
  // - If blur is off: rawStream (original, untouched)
  const activeStream = blurEnabled && blurStream ? blurStream : rawStream;

  return {
    activeStream,    // use this in the preview and as the local stream for WebRTC
    blurEnabled,
    blurLoading,
    blurError,
    toggleBlur,
  };
};
