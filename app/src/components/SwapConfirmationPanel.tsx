"use client";

/**
 * SwapConfirmationPanel - Panneau unifié de confirmation et comparaison
 * 
 * Remplace les multiples modales par un panneau coulissant unique qui affiche :
 * - Résumé du swap
 * - Comparaison des prix (SwapBack vs Jupiter)
 * - Impact de prix
 * - Bouton de confirmation
 */

import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Shield, 
  Zap,
  ArrowRight,
  Loader2,
  ExternalLink
} from "lucide-react";
import { BottomSheet } from "./ui/BottomSheet";

interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI?: string;
}

interface QuoteComparison {
  swapback: {
    outputAmount: number;
    cashback: number;
    netAmount: number;
    priceImpact: number;
    fee: number;
  };
  jupiter?: {
    outputAmount: number;
    priceImpact: number;
    fee: number;
  };
}

interface SwapConfirmationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  quote: QuoteComparison | null;
  loading?: boolean;
  mevProtection: boolean;
  slippage: number;
}

export function SwapConfirmationPanel({
  isOpen,
  onClose,
  onConfirm,
  inputToken,
  outputToken,
  inputAmount,
  quote,
  loading = false,
  mevProtection,
  slippage,
}: SwapConfirmationPanelProps) {
  
  // Calculer les avantages SwapBack
  const savings = quote && quote.jupiter 
    ? (quote.swapback.netAmount - quote.jupiter.outputAmount)
    : 0;
  
  const isBetter = savings > 0;
  const priceImpactHigh = quote && quote.swapback.priceImpact > 3;

  const formatAmount = (amount: number, decimals: number = 6) => {
    if (amount === 0) return "0";
    if (amount < 0.000001) return "<0.000001";
    return amount.toLocaleString(undefined, { 
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals 
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="theme-light">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Confirmer le swap</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-4 space-y-4">
          
          {/* Résumé du swap */}
          <div className="card-simple p-4">
            <div className="flex items-center justify-between">
              {/* From */}
              <div className="flex items-center gap-3">
                {inputToken.logoURI && (
                  <img src={inputToken.logoURI} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div>
                  <div className="text-lg font-semibold text-white">{inputAmount}</div>
                  <div className="text-sm text-gray-400">{inputToken.symbol}</div>
                </div>
              </div>

              <ArrowRight className="w-6 h-6 text-emerald-400" />

              {/* To */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-lg font-semibold text-white">
                    {quote ? formatAmount(quote.swapback.netAmount) : "..."}
                  </div>
                  <div className="text-sm text-gray-400">{outputToken.symbol}</div>
                </div>
                {outputToken.logoURI && (
                  <img src={outputToken.logoURI} alt="" className="w-10 h-10 rounded-full" />
                )}
              </div>
            </div>
          </div>

          {/* Comparaison avec Jupiter */}
          {quote && quote.jupiter && (
            <div className="card-simple p-4">
              <div className="label-clean mb-3">Comparaison</div>
              
              {/* SwapBack */}
              <div className={`quote-row mb-2 ${isBetter ? 'selected' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-black" />
                  </div>
                  <span className="quote-source">SwapBack</span>
                  {isBetter && <span className="quote-tag">Meilleur</span>}
                </div>
                <div className="text-right">
                  <div className="quote-amount">{formatAmount(quote.swapback.netAmount)}</div>
                  <div className="text-xs text-emerald-400">
                    +{formatAmount(quote.swapback.cashback)} cashback
                  </div>
                </div>
              </div>

              {/* Jupiter */}
              <div className={`quote-row ${!isBetter ? 'selected' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-purple-500 rounded-full" />
                  <span className="quote-source">Jupiter</span>
                </div>
                <div className="text-right">
                  <div className="quote-amount">{formatAmount(quote.jupiter.outputAmount)}</div>
                </div>
              </div>

              {/* Économies */}
              {isBetter && (
                <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span>Vous économisez {formatAmount(savings)} {outputToken.symbol}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Détails de la transaction */}
          <div className="card-simple p-4 space-y-2">
            <div className="label-clean mb-2">Détails</div>
            
            <div className="info-row">
              <span>Impact de prix</span>
              <span className={`value ${priceImpactHigh ? 'text-orange-400' : ''}`}>
                {quote ? `${quote.swapback.priceImpact.toFixed(2)}%` : "..."}
                {priceImpactHigh && <AlertTriangle className="inline w-4 h-4 ml-1" />}
              </span>
            </div>
            
            <div className="info-row">
              <span>Slippage max</span>
              <span className="value">{slippage}%</span>
            </div>
            
            <div className="info-row">
              <span>Frais réseau</span>
              <span className="value">~0.0001 SOL</span>
            </div>
            
            {mevProtection && (
              <div className="info-row">
                <span className="flex items-center gap-1">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Protection MEV
                </span>
                <span className="value text-emerald-400">Activée</span>
              </div>
            )}
          </div>

          {/* Avertissement prix impact */}
          {priceImpactHigh && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="flex items-start gap-2 text-orange-400 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Impact de prix élevé</div>
                  <div className="text-orange-300/80">
                    Cette transaction a un impact de prix supérieur à 3%. 
                    Considérez de réduire le montant.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="btn-simple-secondary flex-1"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || !quote}
              className={`
                btn-simple flex-1 flex items-center justify-center gap-2
                ${priceImpactHigh ? 'bg-orange-500 hover:bg-orange-400' : ''}
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

export default SwapConfirmationPanel;
