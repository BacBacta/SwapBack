"use client";

/**
 * SimpleSettingsCard - Interface Settings simplifiée
 * 
 * Design épuré :
 * - Sections avec labels clairs
 * - Advanced section collapsible
 * - Tooltips pour les paramètres
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, 
  Bell, 
  Shield, 
  ChevronDown, 
  Info,
  Check
} from "lucide-react";
import toast from "react-hot-toast";

interface SettingsState {
  slippage: number;
  deadline: number;
  txAlerts: boolean;
  dcaAlerts: boolean;
  expertMode: boolean;
  mevProtection: boolean;
  priorityFee: string;
}

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0, 3.0];

export function SimpleSettingsCard() {
  const [settings, setSettings] = useState<SettingsState>(() => {
    // Load settings from localStorage on init
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("swapback_settings");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Ignore parse errors
        }
      }
    }
    return {
      slippage: 0.5,
      deadline: 20,
      txAlerts: true,
      dcaAlerts: true,
      expertMode: false,
      mevProtection: true,
      priorityFee: "auto",
    };
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customSlippage, setCustomSlippage] = useState("");
  const [saved, setSaved] = useState(true); // Start as saved since we loaded from storage

  // Auto-save on settings change (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const timer = setTimeout(() => {
      localStorage.setItem("swapback_settings", JSON.stringify(settings));
      setSaved(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("swapback_settings", JSON.stringify(settings));
    }
    toast.success("Paramètres sauvegardés");
    setSaved(true);
  }, [settings]);

  const handleSlippagePreset = (value: number) => {
    updateSetting("slippage", value);
    setCustomSlippage("");
  };

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      updateSetting("slippage", parsed);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto theme-light">
      <div className="space-y-4">
        
        {/* Section: Général */}
        <div className="card-simple">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            Général
          </h2>
          
          <div className="space-y-5">
            {/* Slippage */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm text-gray-400">Tolérance au slippage</label>
                <Tooltip text="Écart de prix maximal accepté lors d'un swap" />
              </div>
              <div className="flex gap-2">
                {SLIPPAGE_PRESETS.map((value) => (
                  <button
                    key={value}
                    onClick={() => handleSlippagePreset(value)}
                    className={`
                      flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                      ${settings.slippage === value && !customSlippage
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                      }
                    `}
                  >
                    {value}%
                  </button>
                ))}
                <input
                  type="text"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippage(e.target.value)}
                  placeholder="Custom"
                  className="input-simple w-20 text-center text-sm"
                />
              </div>
            </div>

            {/* Deadline */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm text-gray-400">Délai d'expiration</label>
                <Tooltip text="Minutes avant qu'une transaction n'expire" />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.deadline}
                  onChange={(e) => updateSetting("deadline", parseInt(e.target.value) || 20)}
                  min={1}
                  max={60}
                  className="input-simple w-24 text-center"
                />
                <span className="text-gray-400 text-sm">minutes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Notifications */}
        <div className="card-simple">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-400" />
            Notifications
          </h2>
          
          <div className="space-y-4">
            <ToggleSetting
              label="Alertes de transaction"
              description="Notification quand une transaction est confirmée"
              value={settings.txAlerts}
              onChange={(v) => updateSetting("txAlerts", v)}
            />
            <ToggleSetting
              label="Exécution DCA"
              description="Notification quand un ordre DCA est exécuté"
              value={settings.dcaAlerts}
              onChange={(v) => updateSetting("dcaAlerts", v)}
            />
          </div>
        </div>

        {/* Section: Avancé (collapsible) */}
        <div className="card-simple !p-0 overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-400" />
              <span className="font-semibold text-white">Avancé</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
          
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 border-t border-white/5 space-y-4">
                  <ToggleSetting
                    label="Mode Expert"
                    description="Activer les fonctionnalités avancées de trading"
                    value={settings.expertMode}
                    onChange={(v) => updateSetting("expertMode", v)}
                  />
                  <ToggleSetting
                    label="Protection MEV"
                    description="Protéger contre le front-running (recommandé)"
                    value={settings.mevProtection}
                    onChange={(v) => updateSetting("mevProtection", v)}
                  />
                  
                  {/* Priority Fee */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm text-gray-400">Frais de priorité</label>
                      <Tooltip text="Frais supplémentaires pour accélérer les transactions" />
                    </div>
                    <div className="flex gap-2">
                      {["auto", "low", "medium", "high"].map((level) => (
                        <button
                          key={level}
                          onClick={() => updateSetting("priorityFee", level)}
                          className={`
                            flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors
                            ${settings.priorityFee === level
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-white/5 text-gray-400 hover:bg-white/10"
                            }
                          `}
                        >
                          {level === "auto" ? "Auto" : level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bouton Save */}
        <button
          onClick={handleSave}
          className="btn-simple w-full flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" />
              Sauvegardé
            </>
          ) : (
            "Sauvegarder les paramètres"
          )}
        </button>
      </div>
    </div>
  );
}

// Toggle Switch
function ToggleSetting({ 
  label, 
  description, 
  value, 
  onChange 
}: { 
  label: string; 
  description: string; 
  value: boolean; 
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-white text-sm">{label}</div>
        <div className="text-xs text-gray-400">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`
          relative w-11 h-6 rounded-full transition-colors flex-shrink-0
          ${value ? "bg-emerald-500" : "bg-white/20"}
        `}
      >
        <span 
          className={`
            absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
            ${value ? "left-6" : "left-1"}
          `}
        />
      </button>
    </div>
  );
}

// Tooltip
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-gray-500 hover:text-gray-400"
      >
        <Info className="w-4 h-4" />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 text-white text-xs rounded-lg whitespace-nowrap shadow-lg"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SimpleSettingsCard;
