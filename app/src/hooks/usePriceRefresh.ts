/**
 * usePriceRefresh Hook
 * Auto-refresh swap quotes every N seconds
 * Displays countdown timer "Price valid for X seconds"
 */

import { useState, useEffect, useCallback, useRef } from "react";

interface UsePriceRefreshOptions {
  refreshInterval?: number; // milliseconds (default: 3000 = 3s)
  enabled?: boolean;
  onRefresh?: () => Promise<void>;
}

interface UsePriceRefreshReturn {
  secondsUntilRefresh: number;
  isRefreshing: boolean;
  manualRefresh: () => Promise<void>;
  lastUpdated: Date | null;
}

export const usePriceRefresh = ({
  refreshInterval = 3000,
  enabled = true,
  onRefresh,
}: UsePriceRefreshOptions): UsePriceRefreshReturn => {
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(
    Math.floor(refreshInterval / 1000)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const manualRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastUpdated(new Date());
      setSecondsUntilRefresh(Math.floor(refreshInterval / 1000));
    } catch (error) {
      console.error("Price refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, refreshInterval]);

  useEffect(() => {
    if (!enabled || !onRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    // Initial fetch
    manualRefresh();

    // Setup auto-refresh interval
    intervalRef.current = setInterval(() => {
      manualRefresh();
    }, refreshInterval);

    // Setup countdown timer (updates every second)
    countdownRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          return Math.floor(refreshInterval / 1000);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [enabled, onRefresh, refreshInterval, manualRefresh]);

  return {
    secondsUntilRefresh,
    isRefreshing,
    manualRefresh,
    lastUpdated,
  };
};
