"use client";

/**
 * SimpleLockCard - Interface Lock/Unlock simplifiée
 * 
 * Design épuré :
 * - Onglets discrets
 * - Formulaire minimaliste
 * - Avantages en section collapsible
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lock, 
  Unlock, 
  ChevronDown, 
  Loader2,
  Clock,
  TrendingUp,
  Award,
  Info,
  Coins
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useBoostSystem } from "@/hooks/useBoostSystem";
import toast from "react-hot-toast";

type TabId = "lock" | "unlock";

interface LockPosition {
  amount: number;
  duration: number;
  endDate: Date;
  rewards: number;
  tier: string;
}

const DURATION_OPTIONS = [
  { days: 7, label: "7 jours", boost: "5%" },
  { days: 30, label: "30 jours", boost: "10%" },
  { days: 90, label: "90 jours", boost: "15%" },
  { days: 365, label: "1 an", boost: "20%" },
];

export function SimpleLockCard() {
  const { connected, publicKey } = useWallet();
  const { 
    userLock, 
    lockTokens, 
    unlockTokens, 
    loading: boostLoading,
    error: boostError,
    refreshData
  } = useBoostSystem();
  
  const [activeTab, setActiveTab] = useState<TabId>("lock");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [showBenefits, setShowBenefits] = useState(false);
  
  // Derive locked position from on-chain data
  const lockedPosition: LockPosition | null = userLock?.isActive ? {
    amount: userLock.amountLocked / 1e9, // Convert from lamports
    duration: Math.floor(userLock.lockDuration / 86400), // Convert seconds to days
    endDate: new Date((userLock.lockTime + userLock.lockDuration) * 1000),
    rewards: userLock.boost / 100, // Convert bps to %
    tier: userLock.level.charAt(0).toUpperCase() + userLock.level.slice(1)
  } : null;
  
  const totalLocked = lockedPosition?.amount || 0;

  const handleLock = async () => {
    if (!connected) {
      toast.error("Connectez votre wallet");
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Entrez un montant valide");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Verrouillage en cours...");
    try {
      const signature = await lockTokens({
        amount: parseFloat(amount),
        durationDays: duration
      });
      toast.success(`${amount} BACK verrouillés pour ${duration} jours`, { id: toastId });
      setAmount("");
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors du verrouillage";
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (position: LockPosition) => {
    setLoading(true);
    const toastId = toast.loading("Déverrouillage en cours...");
    try {
      const signature = await unlockTokens();
      toast.success(`${position.amount} BACK déverrouillés`, { id: toastId });
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors du déverrouillage";
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const selectedBoost = DURATION_OPTIONS.find(d => d.days === duration)?.boost || "0%";

  return (
    <div className="w-full max-w-lg mx-auto theme-light">
      <div className="space-y-4">
        
        {/* Résumé si tokens verrouillés */}
        {totalLocked > 0 && (
          <div className="card-simple">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Total verrouillé</div>
                <div className="text-2xl font-bold text-white">{totalLocked.toLocaleString()} BACK</div>
              </div>
              <div className="w-12 h-12 bg-emerald-500/15 rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>
        )}

        {/* Card principale */}
        <div className="card-simple">
          {/* Onglets simples */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab("lock")}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors
                ${activeTab === "lock" 
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
                }
              `}
            >
              <Lock className="w-4 h-4" />
              Verrouiller
            </button>
            <button
              onClick={() => setActiveTab("unlock")}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors
                ${activeTab === "unlock" 
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
                }
              `}
            >
              <Unlock className="w-4 h-4" />
              Déverrouiller
            </button>
          </div>

          {/* Tab: Lock */}
          {activeTab === "lock" && (
            <div className="space-y-4">
              {/* Montant */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Montant à verrouiller</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="input-simple pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    BACK
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setAmount((1000 * pct / 100).toString())} // Mock balance
                      className="flex-1 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg text-gray-400"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Durée */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Durée</label>
                <div className="grid grid-cols-2 gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      onClick={() => setDuration(opt.days)}
                      className={`
                        p-3 rounded-lg text-left transition-colors
                        ${duration === opt.days 
                          ? "bg-emerald-500/15 border border-emerald-500/30" 
                          : "bg-white/5 border border-transparent hover:bg-white/10"
                        }
                      `}
                    >
                      <div className={`font-medium ${duration === opt.days ? "text-emerald-400" : "text-white"}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-emerald-400">+{opt.boost} boost</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Résumé */}
              {amount && parseFloat(amount) > 0 && (
                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Montant</span>
                    <span className="text-white">{amount} BACK</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Durée</span>
                    <span className="text-white">{DURATION_OPTIONS.find(d => d.days === duration)?.label}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                    <span className="text-gray-400">Boost estimé</span>
                    <span className="text-emerald-400 font-medium">{selectedBoost}</span>
                  </div>
                </div>
              )}

              {/* Bouton Lock */}
              <button
                onClick={handleLock}
                disabled={!connected || !amount || loading}
                className="btn-simple w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verrouillage...
                  </>
                ) : !connected ? (
                  "Connecter le wallet"
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Verrouiller
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tab: Unlock */}
          {activeTab === "unlock" && (
            <div className="space-y-4">
              {lockedPositions.length === 0 ? (
                <div className="text-center py-8">
                  <Coins className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-2">Aucun token verrouillé</p>
                  <button
                    onClick={() => setActiveTab("lock")}
                    className="text-emerald-400 text-sm hover:underline"
                  >
                    Verrouiller des tokens
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {lockedPositions.map((position, index) => (
                    <div 
                      key={index}
                      className="bg-white/5 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium text-white">{position.amount.toLocaleString()} BACK</div>
                          <div className="text-sm text-gray-400">{position.tier}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400">+{position.rewards} BACK</div>
                          <div className="text-xs text-gray-500">récompenses</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm mb-3">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Expire le
                        </span>
                        <span className="text-white">{position.endDate.toLocaleDateString()}</span>
                      </div>
                      
                      <button
                        onClick={() => handleUnlock(position)}
                        disabled={loading || new Date() < position.endDate}
                        className={`
                          w-full py-2 rounded-lg text-sm font-medium transition-colors
                          ${new Date() >= position.endDate 
                            ? "btn-simple" 
                            : "bg-white/5 text-gray-500 cursor-not-allowed"
                          }
                        `}
                      >
                        {new Date() < position.endDate ? "Verrouillé" : "Déverrouiller"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avantages (collapsible) */}
        <div className="card-simple !p-0 overflow-hidden">
          <button
            onClick={() => setShowBenefits(!showBenefits)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-white">Avantages du staking</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showBenefits ? "rotate-180" : ""}`} />
          </button>
          
          <AnimatePresence>
            {showBenefits && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 border-t border-white/5 space-y-3">
                  <BenefitItem 
                    icon={<TrendingUp className="w-5 h-5" />}
                    title="APY Dynamique"
                    description="Jusqu'à 20% de boost selon le montant et la durée"
                  />
                  <BenefitItem 
                    icon={<Clock className="w-5 h-5" />}
                    title="Durée Flexible"
                    description="De 7 jours à plus d'un an"
                  />
                  <BenefitItem 
                    icon={<Award className="w-5 h-5" />}
                    title="Niveaux de Récompenses"
                    description="Bronze → Argent → Or → Diamant"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function BenefitItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="text-emerald-400 flex-shrink-0">{icon}</div>
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
    </div>
  );
}

export default SimpleLockCard;
