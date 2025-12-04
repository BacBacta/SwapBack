/**
 * API Configuration
 * Centralizes API endpoints for production/development
 */

// En production sur Vercel, utiliser Fly.io pour éviter les problèmes DNS
// En développement local, utiliser l'API locale
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = typeof window !== 'undefined' && window.location?.hostname?.includes('vercel.app');

// URL de l'API backend (Fly.io en production, local en dev)
export const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  (isProduction || isVercel ? 'https://swapback-api.fly.dev' : '');

/**
 * Construit l'URL complète pour un endpoint API
 */
export function getApiUrl(path: string): string {
  // Si API_BASE_URL est vide, utiliser le chemin relatif (API locale Next.js)
  if (!API_BASE_URL) {
    return path;
  }
  
  // Sinon, construire l'URL complète vers Fly.io
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Endpoints API disponibles
 */
export const API_ENDPOINTS = {
  quote: '/api/swap/quote',
  health: '/api/health',
} as const;
