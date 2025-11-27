/**
 * Sound Effects Hook (Optional)
 * Click sounds, swap success, error beeps with toggle
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "swapback_sound_enabled";
const VOLUME_KEY = "swapback_sound_volume";

export type SoundType = 'click' | 'success' | 'error' | 'warning' | 'notification';

interface SoundConfig {
  frequency: number;
  duration: number;
  volume: number;
  type: OscillatorType;
}

const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  click: { frequency: 800, duration: 50, volume: 0.1, type: 'sine' },
  success: { frequency: 523.25, duration: 150, volume: 0.15, type: 'sine' }, // C5
  error: { frequency: 200, duration: 200, volume: 0.2, type: 'square' },
  warning: { frequency: 440, duration: 100, volume: 0.15, type: 'triangle' }, // A4
  notification: { frequency: 659.25, duration: 100, volume: 0.12, type: 'sine' }, // E5
};

export function useSoundEffects() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    const enabled = localStorage.getItem(STORAGE_KEY);
    const vol = localStorage.getItem(VOLUME_KEY);
    
    if (enabled !== null) {
      setIsEnabled(enabled === 'true');
    }
    if (vol !== null) {
      setVolume(parseFloat(vol));
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isEnabled));
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [isEnabled, volume]);

  // Initialize AudioContext on first interaction
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((type: SoundType) => {
    if (!isEnabled) return;

    try {
      const ctx = getAudioContext();
      const config = SOUND_CONFIGS[type];
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = config.type;
      oscillator.frequency.value = config.frequency;
      
      gainNode.gain.setValueAtTime(config.volume * volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration / 1000);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + config.duration / 1000);
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  }, [isEnabled, volume, getAudioContext]);

  const playClick = useCallback(() => playSound('click'), [playSound]);
  const playSuccess = useCallback(() => playSound('success'), [playSound]);
  const playError = useCallback(() => playSound('error'), [playSound]);
  const playWarning = useCallback(() => playSound('warning'), [playSound]);
  const playNotification = useCallback(() => playSound('notification'), [playSound]);

  const toggleSound = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  const setVolumeLevel = useCallback((level: number) => {
    setVolume(Math.max(0, Math.min(1, level)));
  }, []);

  return {
    isEnabled,
    volume,
    playClick,
    playSuccess,
    playError,
    playWarning,
    playNotification,
    toggleSound,
    setVolume: setVolumeLevel
  };
}
