// client/src/hooks/useBackgroundBlur.js
import { useState, useEffect, useRef, useCallback } from 'react';

const CAPTURE_FPS = 30;

export const useBackgroundBlur = (rawStream) => {
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [blurStream,  setBlurStream]  = useState(null);
  const [blurLoading, setBlurLoading] = useState(false);
  const [blurError,   setBlurError]   = useState(null);

  const modelRef     = useRef(null);
  const bodySegRef   = useRef(null);
  const animFrameRef = useRef(null);
  const canvasRef    = useRef(null);
  const videoElRef   = useRef(null);
  const offscreenRef = useRef(null);

  const loadModel = useCallback(async () => {
    if (modelRef.current) return modelRef.current;

    setBlurLoading(true);
    setBlurError(null);

    try {
      const tf = await import('@tensorflow/tfjs-core');
      await import('@tensorflow/tfjs-backend-webgl');
      const bodySegmentation = await import('@tensorflow-models/body-segmentation');

      await tf.setBackend('webgl');
      await tf.ready();

      const model = await bodySegmentation.createSegmenter(
        bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
        {
          runtime: 'tfjs',
          modelType: 'general',
        }
      );

      modelRef.current = model;
      bodySegRef.current = bodySegmentation;
      console.debug('[BackgroundBlur] Model loaded, backend:', tf.getBackend());
      return model;
    } catch (err) {
      console.error('[BackgroundBlur] Model load failed:', err);
      setBlurError('Background blur unavailable on this device.');
      return null;
    } finally {
      setBlurLoading(false);
    }
  }, []);

  const startRenderLoop = useCallback((model, videoEl, canvas) => {
    const bodySegmentation = bodySegRef.current;
    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas');
    }
    const offscreen = offscreenRef.current;
    const ctx = canvas.getContext('2d');

    const render = async () => {
      if (!videoEl || videoEl.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const w = videoEl.videoWidth;
      const h = videoEl.videoHeight;
      if (!w || !h) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== w)  canvas.width  = w;
      if (canvas.height !== h) canvas.height = h;

      try {
        const segmentations = await model.segmentPeople(videoEl, {
          flipHorizontal:   false,
          multiSegmentation: false,
          segmentBodyParts:  false,
        });

        // Draw blurred background
        ctx.filter = 'blur(18px) saturate(0.8)';
        ctx.drawImage(videoEl, 0, 0, w, h);
        ctx.filter = 'none';

        if (segmentations && segmentations.length > 0) {
          const foreground = { r: 255, g: 255, b: 255, a: 255 };
          const background = { r: 0,   g: 0,   b: 0,   a: 0   };
          const mask = await bodySegmentation.toBinaryMask(
            segmentations, foreground, background, false, 0.7
          );

          offscreen.width  = w;
          offscreen.height = h;
          const offCtx = offscreen.getContext('2d');
          offCtx.putImageData(mask, 0, 0);

          ctx.save();
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(offscreen, 0, 0);
          ctx.restore();

          const sharpCanvas = document.createElement('canvas');
          sharpCanvas.width  = w;
          sharpCanvas.height = h;
          const sharpCtx = sharpCanvas.getContext('2d');
          sharpCtx.drawImage(videoEl, 0, 0);
          sharpCtx.globalCompositeOperation = 'destination-in';
          sharpCtx.drawImage(offscreen, 0, 0);

          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(sharpCanvas, 0, 0);
          ctx.restore();
        }
      } catch {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      }

      if (animFrameRef.current !== null) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  const enableBlur = useCallback(async () => {
    if (!rawStream) return;

    const model = await loadModel();
    if (!model) return;

    const videoEl = document.createElement('video');
    videoEl.srcObject = rawStream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    await videoEl.play();
    videoElRef.current = videoEl;

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    canvasRef.current = canvas;

    const processedVideoStream = canvas.captureStream(CAPTURE_FPS);
    const audioTracks = rawStream.getAudioTracks();
    const combinedStream = new MediaStream([
      ...processedVideoStream.getVideoTracks(),
      ...audioTracks,
    ]);

    setBlurStream(combinedStream);
    setBlurEnabled(true);

    animFrameRef.current = 0;
    startRenderLoop(model, videoEl, canvas);
  }, [rawStream, loadModel, startRenderLoop]);

  const disableBlur = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animFrameRef.current = null;

    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }
    canvasRef.current = null;

    setBlurStream((prev) => {
      if (prev) prev.getVideoTracks().forEach((t) => t.stop());
      return null;
    });
    setBlurEnabled(false);
  }, []);

  const toggleBlur = useCallback(() => {
    if (blurEnabled) disableBlur();
    else enableBlur();
  }, [blurEnabled, disableBlur, enableBlur]);

  useEffect(() => {
    return () => {
      disableBlur();
    };
  }, [rawStream, disableBlur]);

  const activeStream = blurEnabled && blurStream ? blurStream : rawStream;

  return {
    activeStream,
    blurEnabled,
    blurLoading,
    blurError,
    toggleBlur,
  };
};
