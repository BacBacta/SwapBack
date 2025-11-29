/**
 * Feature Flags Hook for A/B Testing
 * LocalStorage-based feature flag system
 */

"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "swapback_feature_flags";

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  variant?: string;
  description?: string;
}

const DEFAULT_FLAGS: FeatureFlag[] = [
  { key: "sound_effects", enabled: false, description: "Enable sound effects" },
  { key: "router_comparison", enabled: true, description: "Show router comparison modal" },
  { key: "favorites_panel", enabled: true, description: "Show favorites tokens panel" },
  { key: "keyboard_shortcuts", enabled: true, description: "Enable keyboard shortcuts" },
  { key: "pull_to_refresh", enabled: true, description: "Enable pull-to-refresh gesture" },
  { key: "haptic_feedback", enabled: true, description: "Enable haptic feedback on mobile" },
  { key: "animations_enhanced", enabled: true, description: "Enhanced micro-interactions" },
  { key: "analytics_tracking", enabled: false, description: "Enable analytics tracking" },
];

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(DEFAULT_FLAGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFlags(parsed);
      }
    } catch (error) {
      console.error("Failed to load feature flags:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
      } catch (error) {
        console.error("Failed to save feature flags:", error);
      }
    }
  }, [flags, isLoading]);

  const isEnabled = useCallback((key: string): boolean => {
    const flag = flags.find(f => f.key === key);
    return flag?.enabled ?? false;
  }, [flags]);

  const getVariant = useCallback((key: string): string | undefined => {
    const flag = flags.find(f => f.key === key);
    return flag?.variant;
  }, [flags]);

  const enableFlag = useCallback((key: string) => {
    setFlags(prev => prev.map(f => 
      f.key === key ? { ...f, enabled: true } : f
    ));
  }, []);

  const disableFlag = useCallback((key: string) => {
    setFlags(prev => prev.map(f => 
      f.key === key ? { ...f, enabled: false } : f
    ));
  }, []);

  const toggleFlag = useCallback((key: string) => {
    setFlags(prev => prev.map(f => 
      f.key === key ? { ...f, enabled: !f.enabled } : f
    ));
  }, []);

  const setVariant = useCallback((key: string, variant: string) => {
    setFlags(prev => prev.map(f => 
      f.key === key ? { ...f, variant } : f
    ));
  }, []);

  const resetFlags = useCallback(() => {
    setFlags(DEFAULT_FLAGS);
  }, []);

  // Analytics tracking helper - Mixpanel integration in app/src/lib/analytics.ts
  const trackEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
    if (!isEnabled('analytics_tracking')) return;
    console.log('[Analytics]', eventName, properties);
  }, [isEnabled]);

  return {
    flags,
    isLoading,
    isEnabled,
    getVariant,
    enableFlag,
    disableFlag,
    toggleFlag,
    setVariant,
    resetFlags,
    trackEvent
  };
}
