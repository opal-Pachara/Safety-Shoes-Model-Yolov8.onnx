import { useRef, useCallback } from 'react';

/**
 * Hook to play a short alert chime using Web Audio API
 */
export function useSound(isSoundEnabled = true) {
  const audioCtxRef = useRef(null);

  // Initialize or resume AudioContext on user gesture
  const initAudio = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current && AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch (err) {
      console.warn('AudioContext initialization note:', err);
    }
  }, []);

  const playAlertSound = useCallback(() => {
    if (!isSoundEnabled) return;

    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const now = ctx.currentTime;

      // Two-tone warning beep: 880Hz (A5) then 659Hz (E5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(880, now + 0.12);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659, now + 0.14);
      osc2.frequency.setValueAtTime(659, now + 0.28);

      // Volume envelope
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.12);
      gainNode.gain.setValueAtTime(0.001, now + 0.13);
      gainNode.gain.exponentialRampToValueAtTime(0.4, now + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.13);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.32);
    } catch (err) {
      console.warn('Could not play alert audio (browser policy):', err);
    }
  }, [isSoundEnabled, initAudio]);

  return { playAlertSound, initAudio };
}
