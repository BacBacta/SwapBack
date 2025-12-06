"use client";

/**
 * SimpleDCACard - Interface DCA simplifiée
 * 
 * Design épuré avec révélation progressive :
 * - Formulaire en étapes collapsibles
 * - Ordres existants en liste compacte
 * - Pas de style terminal
 */

import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  List, 
  ChevronDown, 
  ChevronRight,
  Clock, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Coins,
  Calendar,
  Target,
  ArrowRight
} from "lucide-react";
import {
  useDcaPlans,
  useCreateDcaPlan,
  useDcaStats,
} from "../hooks/useDCA";
import { frequencyToSeconds, type DCAFrequency } from "../lib/dca";
import toast from "react-hot-toast";

// Token mints
const TOKEN_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BACK: process.env.NEXT_PUBLIC_BACK_MINT || "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux",
};

const TOKENS = [
  { symbol: "SOL", name: "Solana", icon: "◎" },
  { symbol: "USDC", name: "USD Coin", icon: "$" },
  { symbol: "USDT", name: "Tether", icon: "$" },
  { symbol: "BACK", name: "SwapBack", icon: "↺" },
];

const FREQUENCIES: { value: DCAFrequency; label: string; description: string }[] = [
  { value: "hourly", label: "Toutes les heures", description: "Pour les traders actifs" },
  { value: "daily", label: "Quotidien", description: "Recommandé pour la plupart" },
  { value: "weekly", label: "Hebdomadaire", description: "Investissement régulier" },
  { value: "monthly", label: "Mensuel", description: "Stratégie long terme" },
];

type TabId = "create" | "orders";

export function SimpleDCACard() {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<TabId>("create");
  
  // Form state
  const [inputToken, setInputToken] = useState("SOL");
  const [outputToken, setOutputToken] = useState("USDC");
  const [amountPerOrder, setAmountPerOrder] = useState("");
  const [frequency, setFrequency] = useState<DCAFrequency>("daily");
  const [totalOrders, setTotalOrders] = useState("10");
  const [currentStep, setCurrentStep] = useState(1);
  
  // Hooks
  const { data: dcaPlans = [], isLoading: plansLoading } = useDcaPlans();
  const { createPlan, isCreating } = useCreateDcaPlan();
  const stats = useDcaStats();

  // Calculs
  const totalInvestment = useMemo(() => {
    const amount = parseFloat(amountPerOrder) || 0;
    const orders = parseInt(totalOrders) || 0;
    return amount * orders;
  }, [amountPerOrder, totalOrders]);

  const isFormValid = useMemo(() => {
    return (
      inputToken !== outputToken &&
      parseFloat(amountPerOrder) > 0 &&
      parseInt(totalOrders) > 0
    );
  }, [inputToken, outputToken, amountPerOrder, totalOrders]);

  // Handlers
  const handleCreateDCA = async () => {
    if (!connected || !publicKey) {
      toast.error("Connectez votre wallet");
      return;
    }

    if (!isFormValid) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    try {
      const inputMint = TOKEN_MINTS[inputToken];
      const outputMint = TOKEN_MINTS[outputToken];
      const intervalSeconds = frequencyToSeconds(frequency);
      const minOut = Math.max(1, Math.floor(parseFloat(amountPerOrder) * 0.99 * 1000000));

      await createPlan({
        tokenIn: new PublicKey(inputMint),
        tokenOut: new PublicKey(outputMint),
        amountPerSwap: parseFloat(amountPerOrder),
        totalSwaps: parseInt(totalOrders),
        intervalSeconds,
        minOutPerSwap: minOut,
        expiresAt: 0,
      });

      toast.success("Plan DCA créé avec succès !");
      setAmountPerOrder("");
      setTotalOrders("10");
      setCurrentStep(1);
      setActiveTab("orders");
    } catch (error) {
      console.error("DCA creation error:", error);
      toast.error("Erreur lors de la création du plan");
    }
  };

  const goToStep = (step: number) => {
    if (step < currentStep || (step === 2 && inputToken && outputToken) || (step === 3 && amountPerOrder)) {
      setCurrentStep(step);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto theme-light">
      {/* Card principale */}
      <div className="card-simple">
        
        {/* Tabs simples */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("create")}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors
              ${activeTab === "create" 
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                : "bg-white/5 text-gray-400 hover:bg-white/10"
              }
            `}
          >
            <Plus className="w-4 h-4" />
            Créer
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors
              ${activeTab === "orders" 
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                : "bg-white/5 text-gray-400 hover:bg-white/10"
              }
            `}
          >
            <List className="w-4 h-4" />
            Mes ordres
            {dcaPlans.length > 0 && (
              <span className="bg-emerald-500 text-black text-xs px-1.5 py-0.5 rounded-full">
                {dcaPlans.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab: Créer */}
        {activeTab === "create" && (
          <div className="space-y-4">
            
            {/* Étape 1: Tokens */}
            <div 
              className={`border rounded-xl overflow-hidden transition-colors ${
                currentStep === 1 ? "border-emerald-500/30" : "border-white/10"
              }`}
            >
              <button
                onClick={() => goToStep(1)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${currentStep > 1 ? "bg-emerald-500 text-black" : "bg-white/10 text-white"}
                  `}>
                    {currentStep > 1 ? <CheckCircle className="w-5 h-5" /> : "1"}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">Tokens</div>
                    {currentStep > 1 && (
                      <div className="text-sm text-gray-400">{inputToken} → {outputToken}</div>
                    )}
                  </div>
                </div>
                {currentStep === 1 ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              </button>
              
              <AnimatePresence>
                {currentStep === 1 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Input Token */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">J'investis</label>
                          <select
                            value={inputToken}
                            onChange={(e) => setInputToken(e.target.value)}
                            className="input-simple"
                          >
                            {TOKENS.map((t) => (
                              <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Output Token */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Pour acheter</label>
                          <select
                            value={outputToken}
                            onChange={(e) => setOutputToken(e.target.value)}
                            className="input-simple"
                          >
                            {TOKENS.filter(t => t.symbol !== inputToken).map((t) => (
                              <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setCurrentStep(2)}
                        disabled={inputToken === outputToken}
                        className="btn-simple w-full"
                      >
                        Continuer
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Étape 2: Montant et fréquence */}
            <div 
              className={`border rounded-xl overflow-hidden transition-colors ${
                currentStep === 2 ? "border-emerald-500/30" : "border-white/10"
              }`}
            >
              <button
                onClick={() => goToStep(2)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5"
                disabled={currentStep < 2}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${currentStep > 2 ? "bg-emerald-500 text-black" : currentStep === 2 ? "bg-white/20 text-white" : "bg-white/5 text-gray-500"}
                  `}>
                    {currentStep > 2 ? <CheckCircle className="w-5 h-5" /> : "2"}
                  </div>
                  <div className="text-left">
                    <div className={`font-medium ${currentStep >= 2 ? "text-white" : "text-gray-500"}`}>
                      Montant & Fréquence
                    </div>
                    {currentStep > 2 && (
                      <div className="text-sm text-gray-400">
                        {amountPerOrder} {inputToken} / {FREQUENCIES.find(f => f.value === frequency)?.label}
                      </div>
                    )}
                  </div>
                </div>
                {currentStep === 2 ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              </button>
              
              <AnimatePresence>
                {currentStep === 2 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 space-y-4">
                      {/* Montant */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Montant par ordre</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={amountPerOrder}
                            onChange={(e) => setAmountPerOrder(e.target.value)}
                            placeholder="0.00"
                            className="input-simple pr-16"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                            {inputToken}
                          </span>
                        </div>
                        
                        {/* Quick amounts */}
                        <div className="flex gap-2 mt-2">
                          {[0.1, 0.5, 1, 5].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setAmountPerOrder(amt.toString())}
                              className="flex-1 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                            >
                              {amt} {inputToken}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Fréquence */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Fréquence</label>
                        <div className="grid grid-cols-2 gap-2">
                          {FREQUENCIES.map((f) => (
                            <button
                              key={f.value}
                              onClick={() => setFrequency(f.value)}
                              className={`
                                p-3 rounded-lg text-left transition-colors
                                ${frequency === f.value 
                                  ? "bg-emerald-500/15 border border-emerald-500/30" 
                                  : "bg-white/5 border border-transparent hover:bg-white/10"
                                }
                              `}
                            >
                              <div className={`font-medium ${frequency === f.value ? "text-emerald-400" : "text-white"}`}>
                                {f.label}
                              </div>
                              <div className="text-xs text-gray-500">{f.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setCurrentStep(3)}
                        disabled={!amountPerOrder || parseFloat(amountPerOrder) <= 0}
                        className="btn-simple w-full"
                      >
                        Continuer
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Étape 3: Confirmation */}
            <div 
              className={`border rounded-xl overflow-hidden transition-colors ${
                currentStep === 3 ? "border-emerald-500/30" : "border-white/10"
              }`}
            >
              <button
                onClick={() => goToStep(3)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5"
                disabled={currentStep < 3}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${currentStep === 3 ? "bg-white/20 text-white" : "bg-white/5 text-gray-500"}
                  `}>
                    3
                  </div>
                  <div className={`font-medium ${currentStep >= 3 ? "text-white" : "text-gray-500"}`}>
                    Confirmer
                  </div>
                </div>
                {currentStep === 3 ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              </button>
              
              <AnimatePresence>
                {currentStep === 3 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 space-y-4">
                      {/* Nombre d'ordres */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Nombre d'ordres</label>
                        <input
                          type="number"
                          value={totalOrders}
                          onChange={(e) => setTotalOrders(e.target.value)}
                          min="1"
                          max="100"
                          className="input-simple"
                        />
                      </div>
                      
                      {/* Résumé */}
                      <div className="bg-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Stratégie</span>
                          <span className="text-white font-medium">
                            {inputToken} → {outputToken}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Par ordre</span>
                          <span className="text-white font-medium">
                            {amountPerOrder || "0"} {inputToken}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Fréquence</span>
                          <span className="text-white font-medium">
                            {FREQUENCIES.find(f => f.value === frequency)?.label}
                          </span>
                        </div>
                        <div className="border-t border-white/10 pt-3 flex justify-between">
                          <span className="text-gray-400">Total</span>
                          <span className="text-emerald-400 font-bold">
                            {totalInvestment.toFixed(4)} {inputToken}
                          </span>
                        </div>
                      </div>
                      
                      {/* Bouton créer */}
                      <button
                        onClick={handleCreateDCA}
                        disabled={!connected || !isFormValid || isCreating}
                        className="btn-simple w-full flex items-center justify-center gap-2"
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Création...
                          </>
                        ) : !connected ? (
                          "Connecter le wallet"
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            Créer le plan DCA
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Tab: Ordres */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {/* Stats rapides */}
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{stats.activePlans || 0}</div>
                  <div className="text-xs text-gray-400">Actifs</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-emerald-400">{stats.totalExecuted || 0}</div>
                  <div className="text-xs text-gray-400">Exécutés</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{stats.totalInvested?.toFixed(2) || "0"}</div>
                  <div className="text-xs text-gray-400">Investi</div>
                </div>
              </div>
            )}
            
            {/* Liste des ordres */}
            {plansLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : dcaPlans.length === 0 ? (
              <div className="text-center py-12">
                <Coins className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">Aucun plan DCA actif</p>
                <button
                  onClick={() => setActiveTab("create")}
                  className="btn-simple"
                >
                  Créer un plan
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {dcaPlans.map((plan: { id: string; tokenIn?: string; tokenOut?: string; amountPerSwap?: number; frequency?: string; completedSwaps?: number; totalSwaps?: number; status?: string; nextExecution?: number }, index: number) => (
                  <DCAOrderRow key={plan.id || index} plan={plan} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Composant pour afficher un ordre DCA
function DCAOrderRow({ plan }: { plan: { id: string; tokenIn?: string; tokenOut?: string; amountPerSwap?: number; frequency?: string; completedSwaps?: number; totalSwaps?: number; status?: string; nextExecution?: number } }) {
  const [expanded, setExpanded] = useState(false);
  
  const progress = plan.totalSwaps ? ((plan.completedSwaps || 0) / plan.totalSwaps) * 100 : 0;
  const isActive = plan.status === "active";
  
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400" : "bg-gray-500"}`} />
          <div className="text-left">
            <div className="font-medium text-white">
              {plan.tokenIn || "?"} → {plan.tokenOut || "?"}
            </div>
            <div className="text-sm text-gray-400">
              {plan.amountPerSwap || 0} / {plan.frequency || "daily"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-white">{plan.completedSwaps || 0}/{plan.totalSwaps || 0}</div>
            <div className="text-xs text-gray-500">{progress.toFixed(0)}%</div>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-white/5 space-y-3">
              {/* Progress bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Prochaine exécution</span>
                  <div className="text-white">
                    {plan.nextExecution 
                      ? new Date(plan.nextExecution * 1000).toLocaleDateString()
                      : "—"
                    }
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Statut</span>
                  <div className={isActive ? "text-emerald-400" : "text-gray-400"}>
                    {isActive ? "Actif" : "Terminé"}
                  </div>
                </div>
              </div>
              
              {isActive && (
                <button className="w-full py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  Annuler le plan
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SimpleDCACard;
