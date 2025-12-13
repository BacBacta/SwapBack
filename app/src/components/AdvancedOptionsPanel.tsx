"use client";

/**
 * AdvancedOptionsPanel - Panneau coulissant pour les options avancées
 * 
 * Contient tous les paramètres avancés :
 * - Slippage
 * - Protection MEV
 * - Comparaison des routeurs
 * - Diagnostics de route
 * - Historique
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Shield, 
  Zap, 
  BarChart3, 
  Clock, 
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info
} from "lucide-react";

interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI?: string;
}

interface QuoteResult {
  outputAmount: string;
  outputAmountFormatted: number;
  priceImpact: number;
  cashbackAmount: number;
  route: string[];
}

// Interface pour l'historique des transactions
interface RecentTransaction {
  signature: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  timestamp: number;
  status: 'success' | 'failed';
}

interface AdvancedOptionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  slippage: number;
  onSlippageChange: (value: number) => void;
  mevProtection: boolean;
  onMevProtectionChange: (value: boolean) => void;
  quote: QuoteResult | null;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  recentTransactions?: RecentTransaction[];
}

type TabId = "routing" | "protection" | "history";

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0, 3.0];

export function AdvancedOptionsPanel({
  isOpen,
  onClose,
  slippage,
  onSlippageChange,
  mevProtection,
  onMevProtectionChange,
  quote,
  inputToken,
  outputToken,
  recentTransactions = [],
}: AdvancedOptionsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("routing");
  const [customSlippage, setCustomSlippage] = useState("");

  const tabs = [
    { id: "routing" as TabId, label: "Routage", icon: Zap },
    { id: "protection" as TabId, label: "Protection", icon: Shield },
    { id: "history" as TabId, label: "Historique", icon: Clock },
  ];

  const handleSlippagePreset = (value: number) => {
    onSlippageChange(value);
    setCustomSlippage("");
  };

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      onSlippageChange(parsed);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel coulissant */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-zinc-900 border-l border-white/10 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Options avancées</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors
                    ${activeTab === tab.id 
                      ? "text-emerald-400 border-b-2 border-emerald-400" 
                      : "text-gray-400 hover:text-gray-300"
                    }
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contenu des tabs */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "routing" && (
                <div className="space-y-6">
                  {/* Slippage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Tolérance de slippage
                    </label>
                    <div className="flex gap-2 mb-3">
                      {SLIPPAGE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleSlippagePreset(preset)}
                          className={`
                            flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                            ${slippage === preset && !customSlippage
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                            }
                          `}
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customSlippage}
                        onChange={(e) => handleCustomSlippage(e.target.value)}
                        placeholder="Personnalisé"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                    {slippage > 5 && (
                      <div className="flex items-center gap-2 mt-2 text-amber-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Slippage élevé - risque de front-running
                      </div>
                    )}
                  </div>

                  {/* Route info */}
                  {quote && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Route optimale
                      </label>
                      <div className="bg-gray-800/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-300">{inputToken.symbol}</span>
                          {quote.route.map((hop, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                              <span className="px-2 py-1 bg-gray-700 rounded text-xs text-emerald-400">
                                {hop}
                              </span>
                            </div>
                          ))}
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-300">{outputToken.symbol}</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between text-sm">
                          <span className="text-gray-400">Price impact</span>
                          <span className={quote.priceImpact > 1 ? "text-amber-400" : "text-gray-300"}>
                            {quote.priceImpact.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comparaison routeurs */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Comparaison des routeurs
                    </label>
                    <div className="space-y-2">
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <div>
                            <div className="font-medium text-white">SwapBack</div>
                            <div className="text-xs text-gray-400">+0.14% cashback</div>
                          </div>
                        </div>
                        <span className="text-sm text-emerald-400">Recommandé</span>
                      </div>
                      <div className="bg-gray-800/50 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <BarChart3 className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-300">Jupiter</div>
                            <div className="text-xs text-gray-500">Standard</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "protection" && (
                <div className="space-y-6">
                  {/* MEV Protection */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-300">
                        Protection MEV
                      </label>
                      <button
                        onClick={() => onMevProtectionChange(!mevProtection)}
                        className={`
                          relative w-12 h-6 rounded-full transition-colors
                          ${mevProtection ? "bg-emerald-500" : "bg-gray-700"}
                        `}
                      >
                        <motion.div
                          animate={{ x: mevProtection ? 24 : 2 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full"
                        />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Protège contre le front-running en utilisant des bundles Jito privés.
                      Recommandé pour les swaps &gt;$1000.
                    </p>
                    {mevProtection && (
                      <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm">
                        <Shield className="w-4 h-4" />
                        Protection activée via Jito
                      </div>
                    )}
                  </div>

                  {/* Canal d'exécution */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Canal d'exécution
                    </label>
                    <div className="space-y-2">
                      <button className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-left">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-white">Auto (recommandé)</div>
                            <div className="text-xs text-gray-400">Optimise automatiquement</div>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                      </button>
                      <button className="w-full bg-gray-800/50 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors">
                        <div className="font-medium text-gray-300">Jito Bundle</div>
                        <div className="text-xs text-gray-500">Protection MEV maximale</div>
                      </button>
                      <button className="w-full bg-gray-800/50 rounded-xl p-4 text-left hover:bg-gray-800 transition-colors">
                        <div className="font-medium text-gray-300">RPC Public</div>
                        <div className="text-xs text-gray-500">Standard, pas de protection</div>
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex gap-3">
                      <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-300">
                        La protection MEV empêche les bots de profiter de votre transaction.
                        Elle ajoute une légère latence mais protège vos gains.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-4">
                  {recentTransactions.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">
                        Aucune transaction récente
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Vos 5 derniers swaps apparaîtront ici
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                        <span>5 dernières transactions</span>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">
                          {recentTransactions.length}
                        </span>
                      </div>
                      {recentTransactions.map((tx, index) => (
                        <div
                          key={tx.signature || index}
                          className="bg-gray-800/50 rounded-xl p-4 hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-2.5 h-2.5 rounded-full ${tx.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              <div>
                                <div className="flex items-center gap-1.5 text-sm">
                                  <span className="text-gray-300">{tx.inputAmount}</span>
                                  <span className="text-gray-500">{tx.inputToken}</span>
                                  <ChevronRight className="w-3 h-3 text-gray-500" />
                                  <span className="text-white font-medium">{tx.outputAmount}</span>
                                  <span className="text-gray-500">{tx.outputToken}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {new Date(tx.timestamp).toLocaleString('fr-FR', { 
                                    day: '2-digit', 
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                              </div>
                            </div>
                            {tx.signature && (
                              <a
                                href={`https://solscan.io/tx/${tx.signature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors group"
                                title="Voir sur Solscan"
                              >
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  className="w-4 h-4 text-gray-400 group-hover:text-white" 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  strokeWidth="2" 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round"
                                >
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-800">
              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium text-white transition-colors"
              >
                Appliquer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AdvancedOptionsPanel;
