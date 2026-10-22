import React, { useEffect, useRef } from 'react';
import { Play, Square, VideoOff, Camera, AlertCircle, Sparkles, Sliders } from 'lucide-react';
import { drawDetections } from '../utils/canvasDraw';

export function CameraView({
  videoRef,
  isDetecting,
  cameraStatus,
  errorMessage,
  currentDetections,
  stats,
  isSimulatedMode,
  setIsSimulatedMode,
  simulatedScenario,
  setSimulatedScenario,
  onStart,
  onStop,
  preflightOk,
}) {
  const overlayCanvasRef = useRef(null);
  const simCanvasRef = useRef(null);

  // Redraw detections on overlay canvas whenever currentDetections change
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    const displayW = parent.clientWidth || 640;
    const displayH = parent.clientHeight || 480;

    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isDetecting && currentDetections && currentDetections.length > 0) {
      let origW = 640;
      let origH = 480;

      if (!isSimulatedMode && videoRef.current) {
        origW = videoRef.current.videoWidth || displayW;
        origH = videoRef.current.videoHeight || displayH;
      }

      const scaleX = displayW / origW;
      const scaleY = displayH / origH;

      drawDetections(ctx, currentDetections, scaleX, scaleY);
    }
  }, [currentDetections, isDetecting, isSimulatedMode, videoRef]);

  // Determine current frame status banner
  const getDetectionStatusBanner = () => {
    if (!isDetecting) {
      return (
        <div className="detection-status-pill status-stopped">
          <span>{isSimulatedMode ? 'โหมดจำลองหยุดทำงาน — กด "เริ่มจำลองกล้อง" เพื่อทดสอบ UAT' : 'กล้องหยุดทำงาน — กด "เริ่มตรวจจับสด" เพื่อเปิดกล้อง'}</span>
        </div>
      );
    }

    if (cameraStatus === 'reconnecting') {
      return (
        <div className="detection-status-pill status-reconnecting">
          <span>กำลังเชื่อมต่อกับ Backend ใหม่...</span>
        </div>
      );
    }

    if (!currentDetections || currentDetections.length === 0) {
      return (
        <div className="detection-status-pill status-none">
          <span>⚪ ไม่พบรองเท้าในภาพ (ยังไม่สามารถสรุปได้ว่าผ่านข้อกำหนด)</span>
        </div>
      );
    }

    const hasViolation = currentDetections.some((d) => d.is_violation);
    const hasSafety = currentDetections.some((d) => d.class_name === 'safety_Shoes');

    if (hasViolation) {
      const violationClasses = Array.from(
        new Set(currentDetections.filter((d) => d.is_violation).map((d) => d.class_name))
      );
      return (
        <div className="detection-status-pill status-violation">
          <span>🚨 ตรวจพบรองเท้าผิดกฎ: {violationClasses.join(', ')}</span>
        </div>
      );
    }

    if (hasSafety) {
      return (
        <div className="detection-status-pill status-compliant">
          <span>✅ ตรวจพบรองเท้าเซฟตี้ (สวมถูกต้อง)</span>
        </div>
      );
    }

    return (
      <div className="detection-status-pill status-none">
        <span>⚪ ไม่พบรองเท้าในภาพ</span>
      </div>
    );
  };

  const SIMULATION_SCENARIOS = [
    { id: 'flipflops', label: '🚨 คนขับสวมรองเท้าแตะ (FlipFlops)', file: 'sample_flipflops.jpg' },
    { id: 'safety_shoes', label: '✅ คนขับสวมรองเท้าเซฟตี้ (safety_Shoes)', file: 'sample_safety_shoes.jpg' },
    { id: 'other_shoes', label: '🚨 คนขับสวมรองเท้าผ้าใบ (other_Shoes)', file: 'sample_other_shoes.jpg' },
    { id: 'no_shoes', label: '⚪ พื้นว่าง/ไม่พบรองเท้า (No Shoes)', file: 'sample_no_shoes.jpg' },
  ];

  return (
    <div className="camera-container">
      {/* Feed Mode Switcher (Webcam vs Simulation) */}
      <div className="feed-mode-bar">
        <span className="feed-mode-label">แหล่งสัญญาณภาพ:</span>
        <div className="feed-mode-buttons">
          <button
            className={`btn-feed-mode ${!isSimulatedMode ? 'active' : ''}`}
            onClick={() => {
              if (isDetecting) onStop();
              setIsSimulatedMode(false);
            }}
          >
            <Camera size={14} /> กล้อง USB จริง (Webcam)
          </button>
          <button
            className={`btn-feed-mode ${isSimulatedMode ? 'active' : ''}`}
            onClick={() => {
              if (isDetecting) onStop();
              setIsSimulatedMode(true);
            }}
          >
            <Sparkles size={14} /> จำลองกล้อง / Mock Feed (สำหรับ UAT)
          </button>
        </div>
      </div>

      {/* Simulated Scenario Chooser (Visible only in Simulated Mode) */}
      {isSimulatedMode && (
        <div className="simulated-scenario-bar">
          <span className="scenario-label">สถานการณ์จำลอง:</span>
          <select
            className="scenario-select"
            value={simulatedScenario}
            onChange={(e) => setSimulatedScenario(e.target.value)}
          >
            {SIMULATION_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="scenario-hint">
            * สลับสถานการณ์ขณะรันได้ทันที (เช่น สลับไป "ไม่พบรองเท้า" เพื่อดูการสิ้นสุดเหตุการณ์ 3 วิ)
          </span>
        </div>
      )}

      {/* Video Viewport Frame */}
      <div className="video-viewport">
        {/* Real HTML Video (Active when webcam mode is on) */}
        {!isSimulatedMode && (
          <video
            ref={videoRef}
            className={`video-feed ${isDetecting ? 'active' : 'hidden'}`}
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Simulated Image (Active when simulation mode is on) */}
        {isSimulatedMode && (
          <img
            src={`/api/samples/${
              simulatedScenario === 'safety_shoes'
                ? 'sample_safety_shoes.jpg'
                : simulatedScenario === 'other_shoes'
                ? 'sample_other_shoes.jpg'
                : simulatedScenario === 'no_shoes'
                ? 'sample_no_shoes.jpg'
                : 'sample_flipflops.jpg'
            }`}
            alt="Simulated frame"
            className={`video-feed sim-image-feed ${isDetecting ? 'active' : 'dimmed'}`}
          />
        )}

        {/* Real-time Bounding Box Canvas Overlay */}
        <canvas
          ref={overlayCanvasRef}
          className={`overlay-canvas ${isDetecting ? 'active' : 'hidden'}`}
        />

        {/* Placeholder when not detecting and in Webcam mode */}
        {!isDetecting && !isSimulatedMode && (
          <div className="camera-placeholder">
            <Camera size={64} className="placeholder-icon" />
            <h4 className="placeholder-title">กล้องตรวจจับ USB Webcam</h4>
            <p className="placeholder-desc">
              ระบบจะขออนุญาตใช้งานกล้องผ่านเบราว์เซอร์ Safari/Chrome บน Mac
              และส่งภาพไปประมวลผลบน AI Backend
            </p>
            {errorMessage && (
              <div className="error-alert">
                <AlertCircle size={18} />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Live FPS & Latency Overlay Badge */}
        {isDetecting && (
          <div className="video-stats-overlay">
            <span className="live-dot" />
            <span>{isSimulatedMode ? 'MOCK FEED ~2 FPS' : 'LIVE WEBCAM ~2 FPS'}</span>
            {stats.lastLatencyMs > 0 && <span>• {stats.lastLatencyMs}ms</span>}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="camera-status-bar">{getDetectionStatusBanner()}</div>

      {/* Primary Action Controls */}
      <div className="camera-controls">
        {!isDetecting ? (
          <button
            id="start-detection-btn"
            className="btn-control btn-start"
            onClick={onStart}
            disabled={!preflightOk}
          >
            <Play size={20} />
            <span>{isSimulatedMode ? 'เริ่มจำลองกล้อง (Start Simulated Feed)' : 'เริ่มตรวจจับสด (Start Detection)'}</span>
          </button>
        ) : (
          <button
            id="stop-detection-btn"
            className="btn-control btn-stop"
            onClick={onStop}
          >
            <Square size={20} />
            <span>{isSimulatedMode ? 'หยุดจำลอง (Stop Simulated Feed)' : 'หยุดตรวจจับ (Stop Detection)'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
