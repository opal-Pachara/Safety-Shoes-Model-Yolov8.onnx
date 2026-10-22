import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { EventHistory } from './components/EventHistory';
import { UploadTest } from './components/UploadTest';
import { SettingsModal } from './components/SettingsModal';
import { AlertPopup } from './components/AlertPopup';
import { useSound } from './hooks/useSound';
import { useEventStateMachine } from './hooks/useEventStateMachine';
import { useCamera } from './hooks/useCamera';
import { fetchPreflight } from './utils/api';

export function App() {
  // Navigation tab
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'history' | 'upload'

  // Settings in React State ONLY (resets on refresh per requirement)
  const [thresholds, setThresholds] = useState({
    safety_Shoes: 0.50,
    other_Shoes: 0.50,
    FlipFlops: 0.50,
    Normal_Shoes: 0.50,
  });
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Preflight state
  const [preflightData, setPreflightData] = useState(null);
  const [isPreflightLoading, setIsPreflightLoading] = useState(true);

  // Live detection frame states
  const [currentDetections, setCurrentDetections] = useState([]);

  // Audio Hook
  const { playAlertSound, initAudio } = useSound(isSoundEnabled);

  // Event State Machine Hook (tracks events, popup, history)
  const {
    eventHistory,
    popupEvent,
    eventCounters,
    dismissPopup,
    processFrameDetections,
    resetEvents,
  } = useEventStateMachine({ playAlertSound });

  // Camera Hook
  const handleDetectionsReceived = useCallback(
    ({ detections, imageWidth, imageHeight, videoElement }) => {
      setCurrentDetections(detections);

      // Pass to event state machine to process violations
      processFrameDetections({
        detections,
        sourceElement: videoElement,
        origW: imageWidth,
        origH: imageHeight,
      });
    },
    [processFrameDetections]
  );

  const {
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
  } = useCamera({
    thresholds,
    onDetectionsReceived: handleDetectionsReceived,
    onError: (err) => console.warn('Camera error caught in App:', err),
  });

  // Handle starting detection and unlocking AudioContext
  const handleStart = () => {
    initAudio();
    startDetection();
  };

  const handleStop = () => {
    stopDetection();
    setCurrentDetections([]);
  };

  // Run preflight check on mount
  const checkPreflight = useCallback(async () => {
    setIsPreflightLoading(true);
    try {
      const data = await fetchPreflight();
      setPreflightData(data);
    } catch (err) {
      console.warn('Preflight check failed:', err);
      setPreflightData({
        status: 'error',
        error_message: err.message || 'ไม่สามารถเชื่อมต่อ Backend API ได้',
      });
    } finally {
      setIsPreflightLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPreflight();
  }, [checkPreflight]);

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        eventCount={eventHistory.length}
        backendStatus={
          isPreflightLoading
            ? 'checking'
            : preflightData?.status === 'ok'
            ? 'ok'
            : 'error'
        }
        isSoundEnabled={isSoundEnabled}
        onToggleSound={() => setIsSoundEnabled((prev) => !prev)}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            videoRef={videoRef}
            isDetecting={isDetecting}
            cameraStatus={cameraStatus}
            errorMessage={errorMessage}
            currentDetections={currentDetections}
            stats={stats}
            eventCounters={eventCounters}
            isSimulatedMode={isSimulatedMode}
            setIsSimulatedMode={setIsSimulatedMode}
            simulatedScenario={simulatedScenario}
            setSimulatedScenario={setSimulatedScenario}
            onStart={handleStart}
            onStop={handleStop}
            preflightData={preflightData}
            isPreflightLoading={isPreflightLoading}
            onRetryPreflight={checkPreflight}
          />
        )}

        {activeTab === 'history' && (
          <EventHistory
            eventHistory={eventHistory}
            eventCounters={eventCounters}
            onClearHistory={resetEvents}
          />
        )}

        {activeTab === 'upload' && (
          <UploadTest thresholds={thresholds} />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        thresholds={thresholds}
        setThresholds={setThresholds}
        isSoundEnabled={isSoundEnabled}
        setIsSoundEnabled={setIsSoundEnabled}
      />

      {/* Real-time Violation Alert Popup */}
      <AlertPopup event={popupEvent} onClose={dismissPopup} />
    </div>
  );
}

export default App;
