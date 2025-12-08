"use client";

/**
 * SimpleSwapCard - Interface de swap simplifiée avec Routes Natives SwapBack
 * 
 * Utilise EXCLUSIVEMENT les venues natives (Raydium, Orca, Meteora, Phoenix)
 * au lieu de Jupiter pour générer du NPI et distribuer des rebates.
 * 
 * @author SwapBack Team
 * @date December 8, 2025 - Migration vers routes natives
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ArrowDownUp, Settings, Loader2, ChevronRight, Sparkles, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TokenSelectorModal } from "./TokenSelectorModal";
import { AdvancedOptionsPanel } from "./AdvancedOptionsPanel";
import { useTokenData } from "../hooks/useTokenData";
import { useNativeSwap } from "../hooks/useNativeSwap";
import toast from "react-hot-toast";

// Types
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
  npiAmount: number;
  route: string[];
  venues: string[];
  isNativeRoute: boolean;
  dynamicSlippageBps?: number;
  slippageBreakdown?: {
    slippageBps: number;
    baseComponent: number;
    sizeComponent: number;
    volatilityComponent: number;
  };
}

// Token addresses
const TOKENS: Record<string, TokenInfo> = {
  SOL: {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
  },
};

export function SimpleSwapCard() {
  const { connected, publicKey } = useWallet();
  const wallet = useWallet();
  
  // Hook pour exécuter les swaps NATIFS (pas Jupiter!)
  const { 
    getSwapQuote, 
    executeSwap, 
    loading: swapLoading, 
    quoteLoading,
    error: swapError,
    currentQuote: nativeQuote,
    getSupportedVenues,
    useMevProtection,
    setUseMevProtection,
    slippageConfig,
    minVenueScore,
  } = useNativeSwap();

  // État principal
  const [inputToken, setInputToken] = useState<TokenInfo>(TOKENS.SOL);
  const [outputToken, setOutputToken] = useState<TokenInfo>(TOKENS.USDC);
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [showSlippageDetails, setShowSlippageDetails] = useState(false);

  // État des modales
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [showOutputSelector, setShowOutputSelector] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Paramètres (cachés par défaut)
  const [slippage, setSlippage] = useState(slippageConfig.BASE_SLIPPAGE_BPS / 100); // Utiliser config dynamique
  const [mevProtection, setMevProtection] = useState(useMevProtection);

  // Token data
  const inputTokenData = useTokenData(inputToken.mint);
  const outputTokenData = useTokenData(outputToken.mint);

  // Calculer le montant en unités de base
  const amountInBaseUnits = useMemo(() => {
    const amount = parseFloat(inputAmount);
    if (!amount || !Number.isFinite(amount)) return 0;
    return Math.floor(amount * Math.pow(10, inputToken.decimals));
  }, [inputAmount, inputToken.decimals]);

  // Fetch quote via le ROUTER NATIF (pas Jupiter!)
  useEffect(() => {
    if (!amountInBaseUnits || amountInBaseUnits <= 0 || !publicKey) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    const fetchNativeQuote = async () => {
      setLoading(true);
      try {
        // Utiliser le router NATIF SwapBack
        const nativeResult = await getSwapQuote(
          {
            inputMint: new PublicKey(inputToken.mint),
            outputMint: new PublicKey(outputToken.mint),
            amount: amountInBaseUnits,
            slippageBps: Math.round(slippage * 100),
          },
          0 // userBoostBps - peut être récupéré depuis le statut de lock
        );

        if (nativeResult && !controller.signal.aborted) {
          const formatted = nativeResult.outputAmount / Math.pow(10, outputToken.decimals);
          const cashbackFormatted = nativeResult.boostedRebate / Math.pow(10, outputToken.decimals);
          const npiFormatted = nativeResult.estimatedNpi / Math.pow(10, outputToken.decimals);

          setQuote({
            outputAmount: nativeResult.outputAmount.toString(),
            outputAmountFormatted: formatted,
            priceImpact: nativeResult.priceImpactBps / 100,
            cashbackAmount: cashbackFormatted,
            npiAmount: npiFormatted,
            route: nativeResult.venues.map(v => v.venue),
            venues: nativeResult.venues.map(v => v.venue),
            isNativeRoute: true,
            dynamicSlippageBps: nativeResult.dynamicSlippageBps,
            slippageBreakdown: nativeResult.slippageResult,
          } as QuoteResult);
          
          // Mettre à jour le slippage avec la valeur dynamique calculée
          if (nativeResult.dynamicSlippageBps && !slippage) {
            setSlippage(nativeResult.dynamicSlippageBps / 100);
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Native quote error:", error);
          // Ne pas afficher d'erreur si la quote échoue silencieusement
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const timeout = setTimeout(fetchNativeQuote, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [amountInBaseUnits, inputToken.mint, outputToken.mint, outputToken.decimals, slippage, publicKey, getSwapQuote]);

  // Inverser les tokens
  const handleSwapTokens = useCallback(() => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount("");
    setQuote(null);
  }, [inputToken, outputToken]);

  // Exécuter le swap via ROUTES NATIVES
  const handleSwap = async () => {
    if (!connected || !publicKey) {
      toast.error("Connectez votre wallet pour swapper");
      return;
    }

    if (!quote || !amountInBaseUnits) {
      toast.error("Entrez un montant valide");
      return;
    }

    setSwapping(true);
    const toastId = toast.loading("Swap via routes natives SwapBack...");
    
    try {
      const result = await executeSwap(
        {
          inputMint: new PublicKey(inputToken.mint),
          outputMint: new PublicKey(outputToken.mint),
          amount: amountInBaseUnits,
          slippageBps: Math.round(slippage * 100),
          useMevProtection: mevProtection,
        },
        0 // userBoostBP - could be fetched from user's lock status
      );

      if (result) {
        const outputFormatted = result.outputAmount / Math.pow(10, outputToken.decimals);
        const rebateFormatted = result.rebateAmount / Math.pow(10, outputToken.decimals);
        
        toast.success(
          <div className="flex flex-col">
            <span>✅ Swap réussi via {result.venues.join(", ")}!</span>
            <span className="text-sm opacity-80">
              {outputFormatted.toLocaleString()} {outputToken.symbol} reçus
            </span>
            {rebateFormatted > 0 && (
              <span className="text-emerald-400 text-sm">
                +{rebateFormatted.toFixed(4)} rebate NPI 💰
              </span>
            )}
          </div>,
          { id: toastId, duration: 5000 }
        );
        
        // Reset form après succès
        setInputAmount("");
        setQuote(null);
        
        // Rafraîchir les balances
        inputTokenData.refetch?.();
        outputTokenData.refetch?.();
      } else {
        toast.error(swapError || "Erreur lors du swap", { id: toastId });
      }
    } catch (error) {
      console.error("Native swap error:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors du swap natif",
        { id: toastId }
      );
    } finally {
      setSwapping(false);
    }
  };

  // Sélection token depuis modal
  const handleSelectInputToken = (token: TokenInfo) => {
    if (token.mint === outputToken.mint) {
      handleSwapTokens();
    } else {
      setInputToken(token);
    }
    setShowInputSelector(false);
    setInputAmount("");
    setQuote(null);
  };

  const handleSelectOutputToken = (token: TokenInfo) => {
    if (token.mint === inputToken.mint) {
      handleSwapTokens();
    } else {
      setOutputToken(token);
    }
    setShowOutputSelector(false);
    setQuote(null);
  };

  // Formater le montant affiché
  const formatAmount = (amount: number, decimals: number = 4) => {
    if (amount === 0) return "0";
    if (amount < 0.0001) return "<0.0001";
    return amount.toLocaleString(undefined, { 
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals 
    });
  };

  return (
    <>
      <div className="w-full max-w-md mx-auto theme-light">
        {/* Card principale - Thème simplifié */}
        <div className="card-simple">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-white">Swap</span>
            </div>
            <button
              onClick={() => setShowAdvanced(true)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Paramètres avancés"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Corps */}
          <div className="space-y-3">
            
            {/* Input Token */}
            <div className="token-input-wrapper">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Vous payez</span>
                {inputTokenData.balance !== null && (
                  <button
                    onClick={() => setInputAmount(inputTokenData.balance?.toString() || "")}
                    className="max-btn"
                  >
                    MAX: {formatAmount(inputTokenData.balance || 0)}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, "");
                    if (value.split(".").length <= 2) {
                      setInputAmount(value);
                    }
                  }}
                  placeholder="0"
                  className="token-input-field flex-1"
                />
                <button
                  onClick={() => setShowInputSelector(true)}
                  className="token-selector-btn"
                >
                  {inputToken.logoURI && (
                    <img src={inputToken.logoURI} alt="" className="w-6 h-6 rounded-full" />
                  )}
                  <span className="font-medium text-white">{inputToken.symbol}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              {/* Valeur USD en temps réel */}
              {inputAmount && parseFloat(inputAmount) > 0 && inputTokenData.usdPrice > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  ≈ ${(parseFloat(inputAmount) * inputTokenData.usdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              )}
            </div>

            {/* Bouton swap */}
            <div className="flex justify-center -my-1 relative z-10">
              <button
                onClick={handleSwapTokens}
                className="swap-arrow-btn"
              >
                <ArrowDownUp className="w-5 h-5" />
              </button>
            </div>

            {/* Output Token */}
            <div className="token-input-wrapper">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Vous recevez</span>
                {quote?.cashbackAmount && quote.cashbackAmount > 0.0001 && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    +{formatAmount(quote.cashbackAmount)} cashback
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      <span className="text-gray-500">Calcul...</span>
                    </div>
                  ) : (
                    <span className="text-2xl font-medium text-white">
                      {quote ? formatAmount(quote.outputAmountFormatted) : "0"}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowOutputSelector(true)}
                  className="token-selector-btn"
                >
                  {outputToken.logoURI && (
                    <img src={outputToken.logoURI} alt="" className="w-6 h-6 rounded-full" />
                  )}
                  <span className="font-medium text-white">{outputToken.symbol}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              {/* Valeur USD en temps réel pour l'output */}
              {quote && quote.outputAmountFormatted > 0 && outputTokenData.usdPrice > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  ≈ ${(quote.outputAmountFormatted * outputTokenData.usdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              )}
            </div>

            {/* Résumé cashback et route native */}
            {quote && quote.cashbackAmount > 0.0001 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="cashback-highlight"
              >
                <div className="flex items-center justify-between text-sm w-full">
                  <span className="cashback-label">💰 Rebate NPI SwapBack</span>
                  <span className="cashback-value">
                    +{formatAmount(quote.cashbackAmount)} {outputToken.symbol}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Indicateur Route Native */}
            {quote && quote.isNativeRoute && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">Route Native SwapBack</span>
                  {mevProtection && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                      🛡️ MEV Protected
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {quote.venues.map((venue, i) => (
                    <span 
                      key={i}
                      className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium"
                    >
                      ✓ {venue}
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-1 mt-2 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>NPI généré:</span>
                    {(quote.npiAmount || 0) > 0 ? (
                      <span className="text-emerald-400">+{formatAmount(quote.npiAmount)} {outputToken.symbol}</span>
                    ) : (
                      <span className="text-gray-400">0 (prix marché optimal)</span>
                    )}
                  </div>
                  
                  {/* Slippage dynamique avec breakdown */}
                  <button 
                    onClick={() => setShowSlippageDetails(!showSlippageDetails)}
                    className="flex justify-between hover:text-gray-300 transition-colors"
                  >
                    <span>Slippage ({quote.dynamicSlippageBps ? 'dynamique' : 'fixe'}):</span>
                    <span className="text-gray-300">
                      {quote.dynamicSlippageBps 
                        ? `${(quote.dynamicSlippageBps / 100).toFixed(2)}%`
                        : `${slippage.toFixed(2)}%`
                      }
                      {quote.slippageBreakdown && ' ▼'}
                    </span>
                  </button>
                  
                  {/* Détails du slippage dynamique */}
                  {showSlippageDetails && quote.slippageBreakdown && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-white/5 rounded-lg p-2 mt-1 text-xs"
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Base:</span>
                        <span>{(quote.slippageBreakdown.baseComponent / 100).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Size Impact:</span>
                        <span>{(quote.slippageBreakdown.sizeComponent / 100).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Volatilité:</span>
                        <span>{(quote.slippageBreakdown.volatilityComponent / 100).toFixed(2)}%</span>
                      </div>
                    </motion.div>
                  )}
                  
                  <div className="flex justify-between">
                    <span>Price Impact:</span>
                    <span className={quote.priceImpact > 1 ? 'text-yellow-400' : 'text-gray-300'}>
                      {quote.priceImpact.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bouton Swap */}
            <button
              onClick={handleSwap}
              disabled={!connected || !quote || swapping}
              className={`
                w-full py-4 rounded-xl font-semibold text-lg transition-all
                ${connected && quote && !swapping
                  ? "btn-simple"
                  : "bg-zinc-800 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              {swapping ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Swap en cours...
                </span>
              ) : !connected ? (
                "Connecter le wallet"
              ) : !inputAmount || parseFloat(inputAmount) === 0 ? (
                "Entrez un montant"
              ) : !quote ? (
                "Calcul du prix..."
              ) : (
                "Swap"
              )}
            </button>
          </div>

          {/* Footer - Options avancées (minimisé) */}
          <button
            onClick={() => setShowAdvanced(true)}
            className="w-full py-3 mt-4 border-t border-white/5 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Options avancées
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal sélection token input */}
      <TokenSelectorModal
        isOpen={showInputSelector}
        onClose={() => setShowInputSelector(false)}
        onSelect={(token) => handleSelectInputToken({
          symbol: token.symbol,
          name: token.name,
          mint: token.address,
          decimals: token.decimals,
          logoURI: token.logoURI,
        })}
        selectedToken={inputToken.mint}
        title="Sélectionner un token"
      />

      {/* Modal sélection token output */}
      <TokenSelectorModal
        isOpen={showOutputSelector}
        onClose={() => setShowOutputSelector(false)}
        onSelect={(token) => handleSelectOutputToken({
          symbol: token.symbol,
          name: token.name,
          mint: token.address,
          decimals: token.decimals,
          logoURI: token.logoURI,
        })}
        selectedToken={outputToken.mint}
        title="Sélectionner un token"
      />

      {/* Panneau options avancées */}
      <AdvancedOptionsPanel
        isOpen={showAdvanced}
        onClose={() => setShowAdvanced(false)}
        slippage={slippage}
        onSlippageChange={setSlippage}
        mevProtection={mevProtection}
        onMevProtectionChange={setMevProtection}
        quote={quote}
        inputToken={inputToken}
        outputToken={outputToken}
      />
    </>
  );
}

export default SimpleSwapCard;
