/**
 * QuoteCountdown - Indicateur de validité de la quote avec countdown
 * 
 * Affiche:
 * - Temps restant avant refresh
 * - Barre de progression circulaire
 * - Animation pulse quand proche de l'expiration
 * 
 * @author SwapBack Team
 * @date December 2025
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, RefreshCw } from "lucide-react";

interface QuoteCountdownProps {
  /** Durée totale entre les refreshes (en secondes) */
  refreshInterval: number;
  /** Timestamp de la dernière quote */
  lastQuoteTime: number | null;
  /** Si une quote est en cours de chargement */
  isLoading: boolean;
  /** Callback pour forcer un refresh */
  onRefresh?: () => void;
  /** Variant compact ou full */
  variant?: 'compact' | 'full';
  /** Classes CSS additionnelles */
  className?: string;
}

export function QuoteCountdown({
  refreshInterval = 30,
  lastQuoteTime,
  isLoading,
  onRefresh,
  variant = 'compact',
  className = '',
}: QuoteCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(refreshInterval);

  // Calculer le temps restant
  useEffect(() => {
    if (!lastQuoteTime) {
      setTimeLeft(refreshInterval);
      return;
    }

    const updateTimeLeft = () => {
      const elapsed = Math.floor((Date.now() - lastQuoteTime) / 1000);
      const remaining = Math.max(0, refreshInterval - elapsed);
      setTimeLeft(remaining);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [lastQuoteTime, refreshInterval]);

  // Calculer le pourcentage pour la barre
  const percentage = useMemo(() => {
    return (timeLeft / refreshInterval) * 100;
  }, [timeLeft, refreshInterval]);

  // Couleur basée sur le temps restant
  const color = useMemo(() => {
    if (timeLeft > 20) return 'emerald';
    if (timeLeft > 10) return 'yellow';
    return 'orange';
  }, [timeLeft]);

  const colorClasses = {
    emerald: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500',
      ring: 'stroke-emerald-500',
    },
    yellow: {
      text: 'text-yellow-400',
      bg: 'bg-yellow-500',
      ring: 'stroke-yellow-500',
    },
    orange: {
      text: 'text-orange-400',
      bg: 'bg-orange-500',
      ring: 'stroke-orange-500',
    },
  };

  const currentColors = colorClasses[color];

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
        <span className="text-xs text-gray-400">Updating...</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={onRefresh}
        className={`flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors group ${className}`}
        title="Click to refresh quote"
      >
        {/* Mini circular progress */}
        <div className="relative w-4 h-4">
          <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-gray-700"
            />
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeDasharray={`${(percentage / 100) * 37.7} 37.7`}
              className={currentColors.ring}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          </svg>
        </div>
        <span className={`text-xs ${currentColors.text} group-hover:text-white transition-colors`}>
          {timeLeft}s
        </span>
      </button>
    );
  }

  // Full variant
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Clock className={`w-4 h-4 ${currentColors.text}`} />
        <span className="text-xs text-gray-400">Quote refreshes in</span>
      </div>
      
      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${currentColors.bg} rounded-full`}
            initial={{ width: '100%' }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </div>
        <span className={`text-xs font-medium ${currentColors.text} min-w-[24px] text-right`}>
          {timeLeft}s
        </span>
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Refresh now"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// HOOK useQuoteCountdown
// ============================================================================

interface UseQuoteCountdownOptions {
  refreshInterval?: number;
  onRefresh: () => void;
  isEnabled?: boolean;
}

export function useQuoteCountdown({
  refreshInterval = 30,
  onRefresh,
  isEnabled = true,
}: UseQuoteCountdownOptions) {
  const [lastQuoteTime, setLastQuoteTime] = useState<number | null>(null);

  // Marquer le timestamp de la dernière quote
  const markQuoteReceived = () => {
    setLastQuoteTime(Date.now());
  };

  // Auto-refresh quand le temps est écoulé
  useEffect(() => {
    if (!isEnabled || !lastQuoteTime) return;

    const checkRefresh = () => {
      const elapsed = (Date.now() - lastQuoteTime) / 1000;
      if (elapsed >= refreshInterval) {
        onRefresh();
        setLastQuoteTime(Date.now());
      }
    };

    const interval = setInterval(checkRefresh, 1000);
    return () => clearInterval(interval);
  }, [isEnabled, lastQuoteTime, refreshInterval, onRefresh]);

  // Reset
  const reset = () => {
    setLastQuoteTime(null);
  };

  return {
    lastQuoteTime,
    markQuoteReceived,
    reset,
  };
}

export default QuoteCountdown;
