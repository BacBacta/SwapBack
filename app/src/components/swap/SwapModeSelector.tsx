"use client";

/**
 * 🎛️ Swap Mode Selector
 * 
 * Permet de basculer entre:
 * - Mode Simple: Interface épurée, paramètres automatiques
 * - Mode Avancé: Contrôle total sur slippage, venues, simulation
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Settings2, ChevronDown, Zap, Shield, BarChart3, Eye } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export type SwapMode = 'simple' | 'advanced';

export interface SwapModeConfig {
  mode: SwapMode;
  /** Afficher les détails de route */
  showRouteDetails: boolean;
  /** Afficher le breakdown du slippage */
  showSlippageBreakdown: boolean;
  /** Afficher la simulation pre-swap */
  showSimulation: boolean;
  /** Afficher les équivalents fiat */
  showFiatEquivalent: boolean;
  /** Afficher les métriques de performance */
  showPerformanceMetrics: boolean;
  /** Afficher le graphique de route */
  showRouteChart: boolean;
}

export interface SwapModeSelectorProps {
  mode: SwapMode;
  onModeChange: (mode: SwapMode) => void;
  config: SwapModeConfig;
  onConfigChange: (config: SwapModeConfig) => void;
}

// ============================================================================
// DEFAULT CONFIGS
// ============================================================================

export const SIMPLE_MODE_CONFIG: SwapModeConfig = {
  mode: 'simple',
  showRouteDetails: false,
  showSlippageBreakdown: false,
  showSimulation: false,
  showFiatEquivalent: true,
  showPerformanceMetrics: false,
  showRouteChart: false,
};

export const ADVANCED_MODE_CONFIG: SwapModeConfig = {
  mode: 'advanced',
  showRouteDetails: true,
  showSlippageBreakdown: true,
  showSimulation: true,
  showFiatEquivalent: true,
  showPerformanceMetrics: true,
  showRouteChart: true,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function SwapModeSelector({ 
  mode, 
  onModeChange, 
  config, 
  onConfigChange 
}: SwapModeSelectorProps) {
  const [showOptions, setShowOptions] = useState(false);
  
  const handleModeChange = (newMode: SwapMode) => {
    onModeChange(newMode);
    onConfigChange(newMode === 'simple' ? SIMPLE_MODE_CONFIG : ADVANCED_MODE_CONFIG);
  };
  
  const toggleOption = (key: keyof Omit<SwapModeConfig, 'mode'>) => {
    onConfigChange({
      ...config,
      [key]: !config[key],
    });
  };
  
  return (
    <div className="relative">
      {/* Mode Toggle Buttons */}
      <div className="flex items-center gap-2 p-1 bg-gray-800/50 rounded-xl border border-gray-700/50">
        {/* Simple Mode */}
        <motion.button
          onClick={() => handleModeChange('simple')}
          className={`
            relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            transition-colors duration-200
            ${mode === 'simple' 
              ? 'text-white' 
              : 'text-gray-400 hover:text-gray-200'
            }
          `}
          whileTap={{ scale: 0.98 }}
        >
          {mode === 'simple' && (
            <motion.div
              layoutId="modeIndicator"
              className="absolute inset-0 bg-gradient-to-r from-green-600/80 to-emerald-600/80 rounded-lg"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Sparkles className="w-4 h-4 relative z-10" />
          <span className="relative z-10">Simple</span>
        </motion.button>
        
        {/* Advanced Mode */}
        <motion.button
          onClick={() => handleModeChange('advanced')}
          className={`
            relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            transition-colors duration-200
            ${mode === 'advanced' 
              ? 'text-white' 
              : 'text-gray-400 hover:text-gray-200'
            }
          `}
          whileTap={{ scale: 0.98 }}
        >
          {mode === 'advanced' && (
            <motion.div
              layoutId="modeIndicator"
              className="absolute inset-0 bg-gradient-to-r from-blue-600/80 to-purple-600/80 rounded-lg"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Settings2 className="w-4 h-4 relative z-10" />
          <span className="relative z-10">Avancé</span>
        </motion.button>
        
        {/* Options Toggle (only in advanced mode) */}
        {mode === 'advanced' && (
          <motion.button
            onClick={() => setShowOptions(!showOptions)}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <ChevronDown 
              className={`w-4 h-4 transition-transform duration-200 ${showOptions ? 'rotate-180' : ''}`} 
            />
          </motion.button>
        )}
      </div>
      
      {/* Advanced Options Panel */}
      <AnimatePresence>
        {mode === 'advanced' && showOptions && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <div className="bg-gray-800/95 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 shadow-xl">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Affichage
              </h4>
              
              <div className="grid grid-cols-2 gap-2">
                <OptionToggle
                  icon={<BarChart3 className="w-4 h-4" />}
                  label="Détails route"
                  active={config.showRouteDetails}
                  onClick={() => toggleOption('showRouteDetails')}
                />
                <OptionToggle
                  icon={<Zap className="w-4 h-4" />}
                  label="Slippage détaillé"
                  active={config.showSlippageBreakdown}
                  onClick={() => toggleOption('showSlippageBreakdown')}
                />
                <OptionToggle
                  icon={<Eye className="w-4 h-4" />}
                  label="Simulation"
                  active={config.showSimulation}
                  onClick={() => toggleOption('showSimulation')}
                />
                <OptionToggle
                  icon={<Shield className="w-4 h-4" />}
                  label="Performance"
                  active={config.showPerformanceMetrics}
                  onClick={() => toggleOption('showPerformanceMetrics')}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface OptionToggleProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function OptionToggle({ icon, label, active, onClick }: OptionToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-sm
        transition-all duration-200
        ${active 
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
          : 'bg-gray-700/30 text-gray-400 border border-transparent hover:bg-gray-700/50'
        }
      `}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSwapMode() {
  const [mode, setMode] = useState<SwapMode>('simple');
  const [config, setConfig] = useState<SwapModeConfig>(SIMPLE_MODE_CONFIG);
  
  // Persister le mode dans localStorage
  useEffect(() => {
    const stored = localStorage.getItem('swapback_swap_mode');
    if (stored === 'simple' || stored === 'advanced') {
      setMode(stored);
      setConfig(stored === 'simple' ? SIMPLE_MODE_CONFIG : ADVANCED_MODE_CONFIG);
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem('swapback_swap_mode', mode);
  }, [mode]);
  
  return {
    mode,
    setMode,
    config,
    setConfig,
    isSimple: mode === 'simple',
    isAdvanced: mode === 'advanced',
  };
}

export default SwapModeSelector;
