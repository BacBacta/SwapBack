/**
 * Favorites Tokens System Hook
 * LocalStorage persistence with import/export
 */

"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "swapback_favorite_tokens";

export interface FavoriteToken {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
  addedAt: number;
}

export function useFavoriteTokens() {
  const [favorites, setFavorites] = useState<FavoriteToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavorites(parsed);
      }
    } catch (error) {
      console.error("Failed to load favorites:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage whenever favorites change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error("Failed to save favorites:", error);
      }
    }
  }, [favorites, isLoading]);

  const addFavorite = useCallback((token: Omit<FavoriteToken, "addedAt">) => {
    setFavorites(prev => {
      // Check if already exists
      if (prev.some(fav => fav.address === token.address)) {
        return prev;
      }
      return [...prev, { ...token, addedAt: Date.now() }];
    });
  }, []);

  const removeFavorite = useCallback((address: string) => {
    setFavorites(prev => prev.filter(fav => fav.address !== address));
  }, []);

  const toggleFavorite = useCallback((token: Omit<FavoriteToken, "addedAt">) => {
    setFavorites(prev => {
      const exists = prev.find(fav => fav.address === token.address);
      if (exists) {
        return prev.filter(fav => fav.address !== token.address);
      }
      return [...prev, { ...token, addedAt: Date.now() }];
    });
  }, []);

  const isFavorite = useCallback((address: string) => {
    return favorites.some(fav => fav.address === address);
  }, [favorites]);

  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  const exportFavorites = useCallback(() => {
    const data = JSON.stringify(favorites, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `swapback-favorites-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [favorites]);

  const importFavorites = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (Array.isArray(data)) {
            setFavorites(data);
            resolve();
          } else {
            reject(new Error("Invalid format"));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, []);

  return {
    favorites,
    isLoading,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    exportFavorites,
    importFavorites,
    count: favorites.length
  };
}
