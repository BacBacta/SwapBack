import { useCallback } from 'react';

interface HapticFeedback {
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  error: () => void;
  warning: () => void;
}

export function useHaptic(): HapticFeedback {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  return {
    light: () => vibrate(10),
    medium: () => vibrate(20),
    heavy: () => vibrate(40),
    success: () => vibrate([10, 50, 10]),
    error: () => vibrate([40, 50, 40, 50, 40]),
    warning: () => vibrate([20, 100, 20]),
  };
}
