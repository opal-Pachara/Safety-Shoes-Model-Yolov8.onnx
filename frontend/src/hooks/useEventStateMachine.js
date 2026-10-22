import { useState, useRef, useCallback, useEffect } from 'react';
import { captureAnnotatedSnapshot } from '../utils/canvasDraw';

/**
 * State machine for debouncing violation events:
 * - Starts new event on first violation detection
 * - Plays sound and records history entry ONCE per event
 * - Keeps event active until NO violations are detected continuously for 3 SECONDS (3000ms)
 * - Temporary loss of detection (< 3s) does NOT trigger new alerts
 * - Only stored in React State (resets on refresh)
 */
export function useEventStateMachine({ playAlertSound }) {
  const [eventHistory, setEventHistory] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [popupEvent, setPopupEvent] = useState(null);
  const [eventCounters, setEventCounters] = useState({
    other_Shoes: 0,
    FlipFlops: 0,
    Normal_Shoes: 0,
    total: 0,
  });

  const inEventRef = useRef(false);
  const lastViolationTimeRef = useRef(0);
  const currentEventRef = useRef(null);

  // Check event expiration (3 seconds of no violations)
  useEffect(() => {
    const timer = setInterval(() => {
      if (inEventRef.current) {
        const elapsed = Date.now() - lastViolationTimeRef.current;
        if (elapsed >= 3000) {
          // Event resolved
          inEventRef.current = false;
          currentEventRef.current = null;
          setActiveEvent(null);
        }
      }
    }, 500);

    return () => clearInterval(timer);
  }, []);

  const processFrameDetections = useCallback(
    async ({ detections, sourceElement, origW, origH }) => {
      const violations = detections.filter((d) => d.is_violation);
      const now = Date.now();

      if (violations.length > 0) {
        lastViolationTimeRef.current = now;

        const violationClasses = Array.from(new Set(violations.map((v) => v.class_name)));
        const maxConf = Math.max(...violations.map((v) => v.confidence));

        if (!inEventRef.current) {
          // === NEW EVENT TRIGGERED ===
          inEventRef.current = true;

          // Capture evidence image
          let snapshot = null;
          if (sourceElement && origW && origH) {
            snapshot = await captureAnnotatedSnapshot(sourceElement, detections, origW, origH);
          }

          const newEvent = {
            id: `evt-${now}-${Math.floor(Math.random() * 1000)}`,
            timestamp: now,
            timeFormatted: new Date(now).toLocaleTimeString('th-TH', { hour12: false }),
            dateFormatted: new Date(now).toLocaleDateString('th-TH'),
            classes: violationClasses,
            maxConfidence: maxConf,
            evidence: snapshot,
            detections: [...detections],
          };

          currentEventRef.current = newEvent;
          setActiveEvent(newEvent);
          setPopupEvent(newEvent);

          // Add to React-only Event History (newest first)
          setEventHistory((prev) => [newEvent, ...prev]);

          // Update per-class counters
          setEventCounters((prev) => {
            const updated = { ...prev, total: prev.total + 1 };
            violationClasses.forEach((cls) => {
              if (updated[cls] !== undefined) {
                updated[cls] += 1;
              } else {
                updated[cls] = 1;
              }
            });
            return updated;
          });

          // Play sound alert once per event
          if (playAlertSound) {
            playAlertSound();
          }
        } else {
          // === ONGOING EVENT ===
          // Event already active, keep extending timeout and track any additional classes
          if (currentEventRef.current) {
            const existingClasses = new Set(currentEventRef.current.classes);
            let hasNewClass = false;
            violationClasses.forEach((c) => {
              if (!existingClasses.has(c)) {
                existingClasses.add(c);
                hasNewClass = true;
              }
            });

            if (hasNewClass) {
              const updatedClasses = Array.from(existingClasses);
              currentEventRef.current.classes = updatedClasses;
              // Also update state representation
              setActiveEvent((prev) => (prev ? { ...prev, classes: updatedClasses } : null));
            }
          }
        }
      } else {
        // No violations in this frame
        if (inEventRef.current) {
          const elapsed = now - lastViolationTimeRef.current;
          if (elapsed >= 3000) {
            inEventRef.current = false;
            currentEventRef.current = null;
            setActiveEvent(null);
          }
        }
      }
    },
    [playAlertSound]
  );

  const dismissPopup = useCallback(() => {
    setPopupEvent(null);
  }, []);

  const resetEvents = useCallback(() => {
    inEventRef.current = false;
    currentEventRef.current = null;
    setActiveEvent(null);
    setPopupEvent(null);
    setEventHistory([]);
    setEventCounters({
      other_Shoes: 0,
      FlipFlops: 0,
      Normal_Shoes: 0,
      total: 0,
    });
  }, []);

  return {
    eventHistory,
    activeEvent,
    popupEvent,
    eventCounters,
    dismissPopup,
    processFrameDetections,
    resetEvents,
    isEventActive: inEventRef.current,
  };
}
