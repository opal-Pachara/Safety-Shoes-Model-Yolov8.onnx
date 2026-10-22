import React from 'react';
import { CameraView } from './CameraView';
import { StatsCards } from './StatsCards';
import { PreflightBanner } from './PreflightBanner';
import { ShieldCheck, AlertTriangle, Eye, ShieldAlert } from 'lucide-react';

export function Dashboard({
  videoRef,
  isDetecting,
  cameraStatus,
  errorMessage,
  currentDetections,
  stats,
  eventCounters,
  isSimulatedMode,
  setIsSimulatedMode,
  simulatedScenario,
  setSimulatedScenario,
  onStart,
  onStop,
  preflightData,
  isPreflightLoading,
  onRetryPreflight,
}) {
  return (
    <div className="dashboard-page">
      {/* Preflight readiness & risk banner */}
      <PreflightBanner
        preflightData={preflightData}
        isLoading={isPreflightLoading}
        onRetry={onRetryPreflight}
      />

      {/* Main Grid: Left is Camera feed & controls, Right is Operations panel */}
      <div className="dashboard-main-grid">
        <div className="camera-column">
          <CameraView
            videoRef={videoRef}
            isDetecting={isDetecting}
            cameraStatus={cameraStatus}
            errorMessage={errorMessage}
            currentDetections={currentDetections}
            stats={stats}
            isSimulatedMode={isSimulatedMode}
            setIsSimulatedMode={setIsSimulatedMode}
            simulatedScenario={simulatedScenario}
            setSimulatedScenario={setSimulatedScenario}
            onStart={onStart}
            onStop={onStop}
            preflightOk={preflightData?.status === 'ok'}
          />
        </div>

        <div className="stats-column">
          <StatsCards
            stats={stats}
            eventCounters={eventCounters}
            isDetecting={isDetecting}
          />

          {/* Quick Safety Guidelines card */}
          <div className="guide-card">
            <h4 className="guide-title">
              <ShieldAlert size={18} /> กฎการตัดสินผลและแจ้งเตือน
            </h4>
            <ul className="guide-list">
              <li className="guide-item item-safe">
                <ShieldCheck size={16} />
                <span>
                  <strong>safety_Shoes:</strong> สวมรองเท้าเซฟตี้ถูกต้อง — ผ่าน ไม่มีการแจ้งเตือน
                </span>
              </li>
              <li className="guide-item item-danger">
                <AlertTriangle size={16} />
                <span>
                  <strong>FlipFlops / other_Shoes / Normal_Shoes:</strong> ไม่ใช่รองเท้าเซฟตี้ — แจ้งเตือน Popup และเสียงทันที
                </span>
              </li>
              <li className="guide-item item-neutral">
                <Eye size={16} />
                <span>
                  <strong>ไม่พบรองเท้าในภาพ:</strong> ไม่แจ้งเตือน และ<strong>ห้ามสรุป</strong>ว่าผ่านหรือปลอดภัย
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
