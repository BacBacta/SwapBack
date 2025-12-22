/**
 * usePersistedState - Hook pour persister les préférences utilisateur
 * 
 * Sauvegarde automatiquement dans localStorage avec:
 * - Hydration sécurisée (SSR compatible)
 * - Validation de type
 * - Expiration optionnelle
 * 
 * @author SwapBack Team
 * @date December 2025
 */

import { useState, useEffect, useCallback } from 'react';

interface PersistedStateOptions<T> {
  /** Clé de stockage */
  key: string;
  /** Valeur par défaut */
  defaultValue: T;
  /** Durée de vie en ms (optionnel) */
  ttl?: number;
  /** Validation custom (optionnel) */
  validate?: (value: unknown) => value is T;
}

interface StoredValue<T> {
  value: T;
  timestamp: number;
}

/**
 * Hook pour persister un état dans localStorage
 * Compatible SSR avec hydration sécurisée
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  options?: { ttl?: number; validate?: (value: unknown) => value is T }
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const ttl = options?.ttl;
  const validate = options?.validate;

  // Initialiser avec la valeur par défaut (SSR safe)
  const [state, setState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrater depuis localStorage après le montage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(`swapback_${key}`);
      if (stored) {
        const parsed: StoredValue<T> = JSON.parse(stored);
        
        // Vérifier l'expiration
        if (ttl && Date.now() - parsed.timestamp > ttl) {
          localStorage.removeItem(`swapback_${key}`);
          setIsHydrated(true);
          return;
        }

        // Validation optionnelle
        if (validate && !validate(parsed.value)) {
          localStorage.removeItem(`swapback_${key}`);
          setIsHydrated(true);
          return;
        }

        setState(parsed.value);
      }
    } catch (error) {
      console.warn(`[usePersistedState] Failed to load ${key}:`, error);
    }
    
    setIsHydrated(true);
  }, [key, ttl, validate]);

  // Persister les changements
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    try {
      const toStore: StoredValue<T> = {
        value: state,
        timestamp: Date.now(),
      };
      localStorage.setItem(`swapback_${key}`, JSON.stringify(toStore));
    } catch (error) {
      console.warn(`[usePersistedState] Failed to save ${key}:`, error);
    }
  }, [key, state, isHydrated]);

  // Reset function
  const reset = useCallback(() => {
    setState(defaultValue);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`swapback_${key}`);
    }
  }, [key, defaultValue]);

  return [state, setState, reset];
}

// ============================================================================
// PRÉFÉRENCES SWAP PRÉDÉFINIES
// ============================================================================

export interface SwapPreferences {
  slippage: number;
  mevProtection: boolean;
  autoRefresh: boolean;
  showAdvancedDetails: boolean;
  preferredMode: 'simple' | 'advanced';
}

const DEFAULT_SWAP_PREFERENCES: SwapPreferences = {
  slippage: 0.5,
  mevProtection: true,
  autoRefresh: true,
  showAdvancedDetails: false,
  preferredMode: 'simple',
};

/**
 * Hook spécialisé pour les préférences de swap
 */
export function useSwapPreferences() {
  const [preferences, setPreferences, resetPreferences] = usePersistedState<SwapPreferences>(
    'swap_preferences',
    DEFAULT_SWAP_PREFERENCES,
    {
      ttl: 30 * 24 * 60 * 60 * 1000, // 30 jours
      validate: (value): value is SwapPreferences => {
        if (typeof value !== 'object' || value === null) return false;
        const v = value as Record<string, unknown>;
        return (
          typeof v.slippage === 'number' &&
          typeof v.mevProtection === 'boolean' &&
          typeof v.autoRefresh === 'boolean' &&
          typeof v.showAdvancedDetails === 'boolean' &&
          (v.preferredMode === 'simple' || v.preferredMode === 'advanced')
        );
      },
    }
  );

  const updatePreference = useCallback(<K extends keyof SwapPreferences>(
    key: K,
    value: SwapPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, [setPreferences]);

  return {
    preferences,
    setPreferences,
    updatePreference,
    resetPreferences,
  };
}

// ============================================================================
// FAVORIS TOKENS
// ============================================================================

/**
 * Hook pour gérer les tokens favoris
 */
export function useFavoriteTokens() {
  const [favorites, setFavorites, resetFavorites] = usePersistedState<string[]>(
    'favorite_tokens',
    ['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
  );

  const addFavorite = useCallback((mint: string) => {
    setFavorites(prev => prev.includes(mint) ? prev : [...prev, mint]);
  }, [setFavorites]);

  const removeFavorite = useCallback((mint: string) => {
    setFavorites(prev => prev.filter(m => m !== mint));
  }, [setFavorites]);

  const toggleFavorite = useCallback((mint: string) => {
    setFavorites(prev => 
      prev.includes(mint) 
        ? prev.filter(m => m !== mint) 
        : [...prev, mint]
    );
  }, [setFavorites]);

  const isFavorite = useCallback((mint: string) => {
    return favorites.includes(mint);
  }, [favorites]);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    resetFavorites,
  };
}

// ============================================================================
// TOKENS RÉCENTS
// ============================================================================

const MAX_RECENT_TOKENS = 10;

/**
 * Hook pour gérer les tokens récemment utilisés
 */
export function useRecentTokens() {
  const [recentTokens, setRecentTokens] = usePersistedState<string[]>(
    'recent_tokens',
    [],
  );

  const addRecentToken = useCallback((mint: string) => {
    setRecentTokens(prev => {
      // Retirer si déjà présent puis ajouter au début
      const filtered = prev.filter(m => m !== mint);
      return [mint, ...filtered].slice(0, MAX_RECENT_TOKENS);
    });
  }, [setRecentTokens]);

  return {
    recentTokens,
    addRecentToken,
  };
}

export default usePersistedState;
