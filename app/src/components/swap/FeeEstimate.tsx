/**
 * FeeEstimate - Estimation des frais de transaction
 * 
 * Affiche:
 * - Base fee réseau
 * - Priority fee dynamique
 * - Total en SOL et USD
 * - Sélecteur de priorité (optionnel)
 * 
 * @author SwapBack Team
 * @date December 2025
 */

"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fuel, ChevronDown, Zap, Clock, Gauge } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export type PriorityLevel = 'low' | 'medium' | 'high' | 'turbo';

interface FeeEstimateProps {
  /** Prix SOL en USD */
  solPrice: number;
  /** Niveau de priorité sélectionné */
  priority?: PriorityLevel;
  /** Callback changement de priorité */
  onPriorityChange?: (priority: PriorityLevel) => void;
  /** Afficher le sélecteur de priorité */
  showPrioritySelector?: boolean;
  /** Mode compact */
  compact?: boolean;
  /** Classes CSS additionnelles */
  className?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

// Frais de base Solana (en SOL)
const BASE_FEE = 0.000005; // 5000 lamports

// Priority fees par niveau (en SOL) - basé sur les conditions actuelles
const PRIORITY_FEES: Record<PriorityLevel, number> = {
  low: 0.00001,     // ~10000 lamports - économique mais lent
  medium: 0.0001,   // ~100000 lamports - équilibré
  high: 0.0005,     // ~500000 lamports - rapide
  turbo: 0.002,     // ~2000000 lamports - priorité maximale
};

// Temps de confirmation estimés
const CONFIRMATION_TIMES: Record<PriorityLevel, string> = {
  low: '~30-60s',
  medium: '~10-20s',
  high: '~5-10s',
  turbo: '~1-3s',
};

// Labels et icônes
const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; icon: typeof Zap; color: string }> = {
  low: { label: 'Économique', icon: Clock, color: 'text-gray-400' },
  medium: { label: 'Standard', icon: Gauge, color: 'text-blue-400' },
  high: { label: 'Rapide', icon: Zap, color: 'text-yellow-400' },
  turbo: { label: 'Turbo', icon: Zap, color: 'text-orange-400' },
};

// ============================================================================
// COMPOSANT
// ============================================================================

export function FeeEstimate({
  solPrice,
  priority = 'medium',
  onPriorityChange,
  showPrioritySelector = false,
  compact = true,
  className = '',
}: FeeEstimateProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calcul des frais
  const fees = useMemo(() => {
    const baseFee = BASE_FEE;
    const priorityFee = PRIORITY_FEES[priority];
    const totalSol = baseFee + priorityFee;
    const totalUsd = totalSol * solPrice;

    return {
      baseFee,
      priorityFee,
      totalSol,
      totalUsd,
      confirmationTime: CONFIRMATION_TIMES[priority],
    };
  }, [priority, solPrice]);

  const config = PRIORITY_CONFIG[priority];
  const PriorityIcon = config.icon;

  if (compact) {
    return (
      <div className={`flex items-center justify-between text-xs ${className}`}>
        <div className="flex items-center gap-1.5 text-gray-400">
          <Fuel className="w-3 h-3" />
          <span>Network fee</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-300">
            ~{fees.totalSol.toFixed(6)} SOL
          </span>
          <span className="text-gray-500">
            (${fees.totalUsd.toFixed(4)})
          </span>
          {showPrioritySelector && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${config.color} hover:bg-white/5 transition-colors`}
            >
              <PriorityIcon className="w-3 h-3" />
              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Version étendue
  return (
    <div className={`bg-gray-800/30 rounded-xl p-3 ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Fuel className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Transaction Fee</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            ~${fees.totalUsd.toFixed(4)}
          </span>
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </div>
      </button>

      {/* Détails expandables */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-gray-700/50 space-y-3">
              {/* Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Base fee</span>
                  <span className="text-gray-400">{fees.baseFee.toFixed(6)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Priority fee</span>
                  <span className="text-gray-400">{fees.priorityFee.toFixed(6)} SOL</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-gray-700/30">
                  <span className="text-gray-400 font-medium">Total</span>
                  <span className="text-white font-medium">{fees.totalSol.toFixed(6)} SOL</span>
                </div>
              </div>

              {/* Priority Selector */}
              {showPrioritySelector && onPriorityChange && (
                <div className="space-y-2">
                  <span className="text-xs text-gray-500">Transaction Speed</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(Object.keys(PRIORITY_CONFIG) as PriorityLevel[]).map((level) => {
                      const levelConfig = PRIORITY_CONFIG[level];
                      const LevelIcon = levelConfig.icon;
                      const isSelected = priority === level;

                      return (
                        <button
                          key={level}
                          onClick={() => onPriorityChange(level)}
                          className={`
                            flex flex-col items-center gap-1 p-2 rounded-lg transition-colors
                            ${isSelected 
                              ? 'bg-emerald-500/20 border border-emerald-500/30' 
                              : 'bg-gray-800/50 hover:bg-gray-700/50 border border-transparent'
                            }
                          `}
                        >
                          <LevelIcon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : levelConfig.color}`} />
                          <span className={`text-[10px] font-medium ${isSelected ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {levelConfig.label}
                          </span>
                          <span className="text-[9px] text-gray-500">
                            {CONFIRMATION_TIMES[level]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Confirmation time */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Est. confirmation</span>
                <div className="flex items-center gap-1.5">
                  <PriorityIcon className={`w-3 h-3 ${config.color}`} />
                  <span className={config.color}>{fees.confirmationTime}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// HOOK pour récupérer le prix SOL
// ============================================================================

import { useState as useStateHook, useEffect as useEffectHook } from 'react';

export function useSolPrice() {
  const [solPrice, setSolPrice] = useStateHook<number>(0);
  const [loading, setLoading] = useStateHook(true);

  useEffectHook(() => {
    const fetchPrice = async () => {
      try {
        // Utiliser notre API interne pour éviter CORS
        const response = await fetch('/api/price?symbol=SOL');
        if (response.ok) {
          const data = await response.json();
          if (data.price) {
            setSolPrice(data.price);
          }
        }
      } catch (error) {
        console.warn('[useSolPrice] Failed to fetch SOL price:', error);
        // Fallback à un prix estimé
        setSolPrice(125);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    // Refresh toutes les 60 secondes
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  return { solPrice, loading };
}

export default FeeEstimate;
