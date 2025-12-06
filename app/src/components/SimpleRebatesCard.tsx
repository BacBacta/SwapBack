"use client";

/**
 * SimpleRebatesCard - Interface Rebates simplifiée
 * 
 * Design épuré :
 * - Stats principales en hero
 * - Bouton claim prominent
 * - Historique en section collapsible
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gift, 
  Flame, 
  TrendingUp, 
  Clock, 
  ChevronDown, 
  Loader2,
  Coins,
  ExternalLink,
  CheckCircle
} from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import toast from "react-hot-toast";

interface RebateData {
  unclaimedRebate: number;
  totalClaimed: number;
  totalVolume: number;
  totalSwaps: number;
}

interface ClaimEvent {
  amount: number;
  timestamp: Date;
  txSignature: string;
}

export function SimpleRebatesCard() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [rebateData, setRebateData] = useState<RebateData | null>(null);
  const [claimHistory, setClaimHistory] = useState<ClaimEvent[]>([]);

  // Fetch rebate data
  useEffect(() => {
    const fetchData = async () => {
      if (!connected || !publicKey) {
        setRebateData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // TODO: Fetch real data from on-chain
        // Mock data for now
        await new Promise(r => setTimeout(r, 500));
        setRebateData({
          unclaimedRebate: 25.5,
          totalClaimed: 150.75,
          totalVolume: 15000,
          totalSwaps: 42,
        });
        setClaimHistory([
          { amount: 12.5, timestamp: new Date('2025-12-01'), txSignature: 'abc123...' },
          { amount: 8.25, timestamp: new Date('2025-11-28'), txSignature: 'def456...' },
        ]);
      } catch (error) {
        console.error("Error fetching rebate data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [connected, publicKey, connection]);

  const handleClaim = async () => {
    if (!connected || !rebateData || rebateData.unclaimedRebate <= 0) {
      return;
    }

    setClaiming(true);
    try {
      // TODO: Implement actual claim transaction
      await new Promise(r => setTimeout(r, 2000));
      toast.success(`${rebateData.unclaimedRebate.toFixed(2)} USDC réclamés !`);
      
      // Update local state
      setRebateData({
        ...rebateData,
        totalClaimed: rebateData.totalClaimed + rebateData.unclaimedRebate,
        unclaimedRebate: 0,
      });
    } catch (error) {
      toast.error("Erreur lors de la réclamation");
    } finally {
      setClaiming(false);
    }
  };

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(decimals);
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto theme-light">
        <div className="card-simple p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="w-full max-w-lg mx-auto theme-light">
        <div className="card-simple text-center py-12">
          <Gift className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">Connectez votre wallet</p>
          <p className="text-sm text-gray-500">pour voir vos rebates</p>
        </div>
      </div>
    );
  }

  const hasRebates = rebateData && (rebateData.unclaimedRebate > 0 || rebateData.totalClaimed > 0);

  return (
    <div className="w-full max-w-lg mx-auto theme-light">
      <div className="space-y-4">
        
        {/* Hero - Rebates à réclamer */}
        <div className="card-simple">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4">
              <Gift className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-1">
              {rebateData ? formatNumber(rebateData.unclaimedRebate) : "0.00"} USDC
            </h2>
            <p className="text-gray-400">À réclamer</p>
          </div>

          {/* Bouton Claim */}
          <button
            onClick={handleClaim}
            disabled={claiming || !rebateData || rebateData.unclaimedRebate <= 0}
            className={`
              w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
              ${rebateData && rebateData.unclaimedRebate > 0 
                ? "btn-simple" 
                : "bg-white/5 text-gray-500 cursor-not-allowed"
              }
            `}
          >
            {claiming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Réclamation...
              </>
            ) : rebateData && rebateData.unclaimedRebate > 0 ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Réclamer mes rebates
              </>
            ) : (
              "Aucun rebate à réclamer"
            )}
          </button>
        </div>

        {/* Stats */}
        {hasRebates && (
          <div className="grid grid-cols-3 gap-3">
            <div className="card-simple !p-3 text-center">
              <div className="text-lg font-bold text-white">
                ${formatNumber(rebateData?.totalClaimed || 0)}
              </div>
              <div className="text-xs text-gray-400">Total réclamé</div>
            </div>
            <div className="card-simple !p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">
                {rebateData?.totalSwaps || 0}
              </div>
              <div className="text-xs text-gray-400">Swaps</div>
            </div>
            <div className="card-simple !p-3 text-center">
              <div className="text-lg font-bold text-white">
                ${formatNumber(rebateData?.totalVolume || 0)}
              </div>
              <div className="text-xs text-gray-400">Volume</div>
            </div>
          </div>
        )}

        {/* Comment ça marche */}
        {!hasRebates && (
          <div className="card-simple">
            <h3 className="font-medium text-white mb-4">Comment gagner des rebates ?</h3>
            <div className="space-y-3">
              <Step number={1} text="Effectuez des swaps sur SwapBack" />
              <Step number={2} text="Recevez 70% des frais en cashback" />
              <Step number={3} text="Réclamez vos USDC accumulés" />
            </div>
          </div>
        )}

        {/* Historique (collapsible) */}
        {claimHistory.length > 0 && (
          <div className="card-simple !p-0 overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-white">Historique</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`} />
            </button>
            
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0 border-t border-white/5 space-y-2">
                    {claimHistory.map((event, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-white">
                            +{event.amount.toFixed(2)} USDC
                          </div>
                          <div className="text-xs text-gray-400">
                            {event.timestamp.toLocaleDateString()}
                          </div>
                        </div>
                        <a
                          href={`https://solscan.io/tx/${event.txSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-emerald-400"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 bg-emerald-500/15 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-emerald-400 text-sm font-bold">{number}</span>
      </div>
      <span className="text-gray-300 text-sm">{text}</span>
    </div>
  );
}

export default SimpleRebatesCard;
