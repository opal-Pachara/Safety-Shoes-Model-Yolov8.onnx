import { useState, useRef, useCallback, useEffect } from 'react';
import { detectFrame } from '../utils/api';

/**
 * Camera Hook for Safari / Mac USB Webcam & Simulated Feed:
 * - Handles camera stream lifecycle
 * - Supports Simulated Mock Feed for UAT testing without physical camera/shoes
 * - Captures frames and sends to backend at ~2 FPS (every 450-500ms)
 * - Strict NO-OVERLAP: skips new frame if previous inference request is still in-flight
 * - Discards stale responses after Stop is clicked
 * - Tracks processing stats (latency, frame counts, reconnects)
 */
export function useCamera({
  thresholds,
  onDetectionsReceived,
  onError,
}) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle'); // 'idle' | 'ready' | 'detecting' | 'error' | 'reconnecting'
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSimulatedMode, setIsSimulatedMode] = useState(false);
  const [simulatedScenario, setSimulatedScenario] = useState('flipflops');

  const [stats, setStats] = useState({
    processedFrames: 0,
    avgLatencyMs: 0,
    lastLatencyMs: 0,
    lastBackendTimeMs: 0,
    reconnectCount: 0,
    lastDetectedClass: null,
  });

  const videoRef = useRef(null);
  const simulatedImageRef = useRef(null);
  const streamRef = useRef(null);
  const loopTimeoutRef = useRef(null);
  const isInFlightRef = useRef(false);
  const isCancelledRef = useRef(false);
  const latencyHistoryRef = useRef([]);

  // Hidden offscreen canvas for frame extraction
  const captureCanvasRef = useRef(null);

  // Initialize offscreen canvas and simulated image cache
  useEffect(() => {
    captureCanvasRef.current = document.createElement('canvas');
  }, []);

  // Update simulated image when scenario changes
  useEffect(() => {
    const scenarioToFilename = {
      flipflops: 'sample_flipflops.jpg',
      safety_shoes: 'sample_safety_shoes.jpg',
      other_shoes: 'sample_other_shoes.jpg',
      no_shoes: 'sample_no_shoes.jpg',
    };

    const filename = scenarioToFilename[simulatedScenario] || 'sample_flipflops.jpg';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `/api/samples/${filename}`;
    simulatedImageRef.current = img;
  }, [simulatedScenario]);

  // Stop camera tracks and frame loop
  const stopDetection = useCallback(() => {
    isCancelledRef.current = true;
    isInFlightRef.current = false;

    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsDetecting(false);
    setCameraStatus('ready');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  // Capture single frame blob from real video OR simulated image
  const getFrameBlob = useCallback(() => {
    const canvas = captureCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (isSimulatedMode) {
      // === SIMULATED MOCK FEED ===
      const simImg = simulatedImageRef.current;
      if (!simImg || !simImg.complete || simImg.naturalWidth === 0) return null;

      const w = simImg.naturalWidth;
      const h = simImg.naturalHeight;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.drawImage(simImg, 0, 0, w, h);

      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => resolve({ blob, width: w, height: h, sourceElement: simImg }),
          'image/jpeg',
          0.85
        );
      });
    } else {
      // === REAL WEBCAM FEED ===
      const video = videoRef.current;
      if (!video || video.readyState < 2) return null;

      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.drawImage(video, 0, 0, w, h);

      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => resolve({ blob, width: w, height: h, sourceElement: video }),
          'image/jpeg',
          0.85
        );
      });
    }
  }, [isSimulatedMode]);

  // Single inference frame step
  const processNextFrame = useCallback(async () => {
    if (isCancelledRef.current) return;

    // Strict no-overlap: if previous request is in flight, wait 100ms and check again
    if (isInFlightRef.current) {
      loopTimeoutRef.current = setTimeout(processNextFrame, 100);
      return;
    }

    const frameData = await getFrameBlob();
    if (!frameData || !frameData.blob) {
      loopTimeoutRef.current = setTimeout(processNextFrame, 200);
      return;
    }

    isInFlightRef.current = true;
    const clientStartTime = performance.now();

    try {
      const response = await detectFrame(frameData.blob, thresholds);

      // Check if user clicked Stop while request was in-flight
      if (isCancelledRef.current) {
        isInFlightRef.current = false;
        return;
      }

      const clientLatency = Math.round(performance.now() - clientStartTime);

      // Update latency history (rolling window of 10)
      latencyHistoryRef.current.push(clientLatency);
      if (latencyHistoryRef.current.length > 10) {
        latencyHistoryRef.current.shift();
      }
      const avgLat = Math.round(
        latencyHistoryRef.current.reduce((a, b) => a + b, 0) / latencyHistoryRef.current.length
      );

      // Update statistics
      setStats((prev) => {
        let lastClass = prev.lastDetectedClass;
        if (response.detections && response.detections.length > 0) {
          lastClass = response.detections[0].class_name;
        }
        return {
          ...prev,
          processedFrames: prev.processedFrames + 1,
          avgLatencyMs: avgLat,
          lastLatencyMs: clientLatency,
          lastBackendTimeMs: response.backend_time_ms,
          lastDetectedClass: lastClass,
        };
      });

      // Pass detections to callback
      if (onDetectionsReceived) {
        onDetectionsReceived({
          detections: response.detections || [],
          imageWidth: frameData.width,
          imageHeight: frameData.height,
          videoElement: frameData.sourceElement,
        });
      }

      setCameraStatus('detecting');
      setErrorMessage(null);
    } catch (err) {
      console.warn('Inference error:', err);
      if (!isCancelledRef.current) {
        setStats((prev) => ({ ...prev, reconnectCount: prev.reconnectCount + 1 }));
        setCameraStatus('reconnecting');
        setErrorMessage(`การเชื่อมต่อมีปัญหา: ${err.message}`);
        if (onError) onError(err);
      }
    } finally {
      isInFlightRef.current = false;

      // Schedule next frame at ~2 FPS (450ms target interval)
      if (!isCancelledRef.current) {
        loopTimeoutRef.current = setTimeout(processNextFrame, 450);
      }
    }
  }, [getFrameBlob, thresholds, onDetectionsReceived, onError]);

  // Start detection (Real webcam or Simulated feed)
  const startDetection = useCallback(async () => {
    isCancelledRef.current = false;
    setErrorMessage(null);

    if (isSimulatedMode) {
      // Start simulated feed directly without requesting hardware webcam
      setIsDetecting(true);
      setCameraStatus('detecting');
      loopTimeoutRef.current = setTimeout(processNextFrame, 300);
      return;
    }

    setCameraStatus('reconnecting');

    try {
      // Request webcam with Safari/Mac friendly constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        await videoRef.current.play();
      }

      setIsDetecting(true);
      setCameraStatus('detecting');

      // Kick off frame loop
      loopTimeoutRef.current = setTimeout(processNextFrame, 300);
    } catch (err) {
      console.error('Camera permission/access error:', err);
      let msg = 'ไม่สามารถเข้าถึงกล้องได้: ';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg += 'กรุณาอนุญาตสิทธิ์การใช้งานกล้องในเบราว์เซอร์ Safari/Chrome (หรือเปลี่ยนไปใช้ "โหมดจำลองกล้อง / Mock Feed")';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg += 'ไม่พบกล้อง USB Webcam (สามารถเปิด "โหมดจำลองกล้อง / Mock Feed" เพื่อทดสอบได้)';
      } else {
        msg += err.message || 'เกิดข้อผิดพลาดในการเปิดกล้อง';
      }
      setErrorMessage(msg);
      setCameraStatus('error');
      stopDetection();
      if (onError) onError(err);
    }
  }, [isSimulatedMode, processNextFrame, stopDetection, onError]);

  return {
    videoRef,
    isDetecting,
    cameraStatus,
    errorMessage,
    stats,
    isSimulatedMode,
    setIsSimulatedMode,
    simulatedScenario,
    setSimulatedScenario,
    startDetection,
    stopDetection,
  };
}
