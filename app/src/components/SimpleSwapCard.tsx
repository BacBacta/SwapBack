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

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ArrowDownUp, Settings, Loader2, ChevronRight, Sparkles, Zap, Clock, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TokenSelectorModal } from "./TokenSelectorModal";
import { AdvancedOptionsPanel } from "./AdvancedOptionsPanel";
import { TransactionStatusModal, TransactionStatus } from "./TransactionStatusModal";
import { SwapModeSelector, RouteVisualization, SingleTokenFiat, SIMPLE_MODE_CONFIG, ADVANCED_MODE_CONFIG, type SwapModeConfig } from "./swap";
import { useTokenData } from "../hooks/useTokenData";
import { useNativeSwap } from "../hooks/useNativeSwap";
import { useEnhancedNativeSwap } from "../hooks/useEnhancedNativeSwap";
import toast from "react-hot-toast";

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
  /** Optionnel: minOut (en unités token) recommandé par la venue sélectionnée */
  minOutAmountFormatted?: number;
  priceImpact: number;
  cashbackAmount: number;
  npiAmount: number;
  route: string[];
  venues: string[];
  isNativeRoute: boolean;
  bestVenue?: string;
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
  
  // Debug: Log au montage du composant
  useEffect(() => {
    console.log('🔵 [SimpleSwapCard] Component mounted', {
      connected,
      publicKey: publicKey?.toBase58()?.slice(0, 8) + '...',
    });
  }, [connected, publicKey]);
  
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
    // 🔥 Vrai routage natif
    useTrueNativeRouting,
    setUseTrueNativeRouting,
    executeTrueNativeSwap,
    trueNativeRoute,
  } = useNativeSwap();
  
  // Hook amélioré pour slippage EMA, simulation, cache
  const {
    mode: swapMode,
    setSwapMode,
    slippageEstimator,
    getAnalytics,
  } = useEnhancedNativeSwap();
  
  // État pour la config du mode (détails, slippage, simulation, etc.)
  const [modeConfig, setModeConfig] = useState<SwapModeConfig>(SIMPLE_MODE_CONFIG);
  
  // État pour afficher la visualisation des routes
  const [showRouteViz, setShowRouteViz] = useState(false);

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
  
  // État du modal de statut de transaction (style Jupiter)
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txErrorMessage, setTxErrorMessage] = useState<string | undefined>();
  const [outputAmountForModal, setOutputAmountForModal] = useState<string>('');
  
  // Historique des 5 dernières transactions
  const [recentTxs, setRecentTxs] = useState<RecentTransaction[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Ref pour rafraîchissement prix USD
  const priceRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Ref pour rafraîchissement quote swap
  const quoteRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const quoteFetchSeqRef = useRef(0);
  const quoteInFlightRef = useRef(false);
  const quoteRef = useRef<QuoteResult | null>(null);

  // Paramètres (cachés par défaut)
  const [slippage, setSlippage] = useState(slippageConfig.BASE_SLIPPAGE_BPS / 100); // Utiliser config dynamique
  const [mevProtection, setMevProtection] = useState(useMevProtection);

  // Parsing robuste des montants utilisateur (ex: locale FR "0,01" => 0.01)
  const parseUserAmount = useCallback((raw: string): number => {
    if (!raw) return 0;
    const normalized = raw.trim().replace(/\s+/g, "").replace(/,/g, ".");
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  }, []);

  // Token data
  const inputTokenData = useTokenData(inputToken.mint);
  const outputTokenData = useTokenData(outputToken.mint);
  
  // Charger l'historique des transactions depuis localStorage
  useEffect(() => {
    if (publicKey) {
      const storageKey = `swapback_recent_txs_${publicKey.toString()}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as RecentTransaction[];
          setRecentTxs(parsed.slice(0, 5));
        } catch (e) {
          console.warn("Failed to parse recent txs:", e);
        }
      }
    }
  }, [publicKey]);
  
  // Sauvegarder une nouvelle transaction dans l'historique
  const saveTransaction = useCallback((tx: RecentTransaction) => {
    if (!publicKey) return;
    
    setRecentTxs(prev => {
      const updated = [tx, ...prev].slice(0, 5);
      const storageKey = `swapback_recent_txs_${publicKey.toString()}`;
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }, [publicKey]);
  
  // Rafraîchissement automatique des prix USD toutes les 10 secondes
  useEffect(() => {
    // Clear previous interval
    if (priceRefreshIntervalRef.current) {
      clearInterval(priceRefreshIntervalRef.current);
    }
    
    // Rafraîchir les prix toutes les 10 secondes pendant qu'on a un montant
    if (inputAmount && parseUserAmount(inputAmount) > 0) {
      priceRefreshIntervalRef.current = setInterval(() => {
        // Les hooks useTokenData vont automatiquement rafraîchir
        // On force un re-render léger en mettant à jour un timestamp
        inputTokenData.refetch?.();
        outputTokenData.refetch?.();
      }, 10000);
    }
    
    return () => {
      if (priceRefreshIntervalRef.current) {
        clearInterval(priceRefreshIntervalRef.current);
      }
    };
  }, [inputAmount, inputTokenData, outputTokenData]);

  // Garder une ref à jour de la dernière quote (évite de relancer l'effet de fetch)
  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);

  // Calculer le montant en unités de base
  const amountInBaseUnits = useMemo(() => {
    const amount = parseUserAmount(inputAmount);
    if (!amount || !Number.isFinite(amount)) return 0;
    const lamports = Math.floor(amount * Math.pow(10, inputToken.decimals));
    return Number.isFinite(lamports) && lamports > 0 ? lamports : 0;
  }, [inputAmount, inputToken.decimals]);

  // Fetch quote via le ROUTER NATIF (pas Jupiter!)
  // Note: Le wallet n'est PAS requis pour afficher les quotes (seulement pour exécuter)
  useEffect(() => {
    console.log('🔍 [SimpleSwapCard] Quote effect triggered:', {
      amountInBaseUnits,
      publicKey: publicKey?.toBase58()?.slice(0, 8) || 'not-connected',
      inputMint: inputToken.mint.slice(0, 8) + '...',
      outputMint: outputToken.mint.slice(0, 8) + '...',
    });
    
    if (!amountInBaseUnits || amountInBaseUnits <= 0) {
      console.log('❌ [SimpleSwapCard] No amount, skipping quote fetch');
      setQuote(null);
      return;
    }
    
    // Wallet n'est plus requis pour les quotes - supprimé la vérification publicKey

    // Clear previous interval
    if (quoteRefreshIntervalRef.current) {
      clearInterval(quoteRefreshIntervalRef.current);
      quoteRefreshIntervalRef.current = null;
    }

    const seq = ++quoteFetchSeqRef.current;
    const controller = new AbortController();
    const fetchNativeQuote = async () => {
      if (controller.signal.aborted) return;
      if (quoteInFlightRef.current) {
        console.log('⏳ [SimpleSwapCard] Quote already in flight, skipping');
        return;
      }

      console.log('🚀 [SimpleSwapCard] Starting quote fetch...');
      quoteInFlightRef.current = true;
      const shouldShowLoading = !quoteRef.current;
      if (shouldShowLoading) setLoading(true);

      try {
        console.log('📤 [SimpleSwapCard] Calling venue-quotes API with:', {
          inputMint: inputToken.mint,
          outputMint: outputToken.mint,
          amount: amountInBaseUnits,
          slippageBps: Math.round(slippage * 100),
        });
        
        // ============================================================
        // APPEL À /api/venue-quotes (inclut TOUTES les venues: Orca, Raydium, 
        // Meteora, Phoenix, PumpSwap, Jupiter, etc.)
        // ============================================================
        const slippageBps = Math.round(slippage * 100);
        const url = `/api/venue-quotes?inputMint=${inputToken.mint}&outputMint=${outputToken.mint}&amount=${amountInBaseUnits}&slippageBps=${slippageBps}`;
        
        // Timeout 25s pour cold start Vercel + latence multi-DEX
        const response = await fetch(url, { 
          signal: AbortSignal.timeout(25000),
          cache: 'no-store'
        });
        
        if (!response.ok) {
          console.error('[SimpleSwapCard] venue-quotes API error:', response.status);
          setQuote(null);
          return;
        }
        
        const data = await response.json();
        console.log('📥 [SimpleSwapCard] venue-quotes response:', data);
        
        // Récupérer toutes les quotes (natives + Jupiter benchmark)
        const allQuotes = [...(data.quotes || [])];
        
        // Ajouter Jupiter comme fallback si aucune quote native
        if (data.jupiterBenchmark && data.jupiterBenchmark.outputAmount > 0) {
          allQuotes.push({
            venue: 'JUPITER',
            outputAmount: data.jupiterBenchmark.outputAmount,
            priceImpactBps: data.jupiterBenchmark.priceImpactBps || 0,
            source: 'jupiter',
          });
        }
        
        // Trier par meilleur output
        allQuotes.sort((a: any, b: any) => (b.outputAmount ?? 0) - (a.outputAmount ?? 0));
        
        const bestQuote = allQuotes[0];
        
        if (bestQuote && bestQuote.outputAmount > 0 && !controller.signal.aborted && seq === quoteFetchSeqRef.current) {
          const formatted = bestQuote.outputAmount / Math.pow(10, outputToken.decimals);
          const priceImpactBps = bestQuote.priceImpactBps ?? 0;
          
          setQuote({
            outputAmount: bestQuote.outputAmount.toString(),
            outputAmountFormatted: formatted,
            minOutAmountFormatted: undefined,
            priceImpact: priceImpactBps / 100,
            cashbackAmount: bestQuote.venue !== 'JUPITER' ? formatted * 0.003 : 0, // Rebate seulement pour routes natives
            npiAmount: 0,
            route: [bestQuote.venue],
            venues: allQuotes.map((q: any) => q.venue),
            isNativeRoute: bestQuote.venue !== 'JUPITER',
            bestVenue: bestQuote.venue,
            dynamicSlippageBps: slippageBps,
            slippageBreakdown: undefined,
          } as QuoteResult);
        } else if (!controller.signal.aborted && seq === quoteFetchSeqRef.current) {
          console.log('❌ [SimpleSwapCard] No valid quotes from venue-quotes API');
          setQuote(null);
        }
      } catch (error) {
        console.error("❌ [SimpleSwapCard] Quote fetch error:", error);
        if ((error as Error).name !== "AbortError") {
          console.error("Native quote error:", error);
          // Ne pas afficher d'erreur si la quote échoue silencieusement
        }
      } finally {
        console.log('🏁 [SimpleSwapCard] Quote fetch finished');
        quoteInFlightRef.current = false;
        if (!controller.signal.aborted && seq === quoteFetchSeqRef.current) {
          // Éviter le flicker: on n'affiche le loader que lors du premier fetch
          if (!quoteRef.current) {
            setLoading(false);
          }
        }
      }
    };

    const timeout = setTimeout(fetchNativeQuote, 300);

    // Auto-refresh quote toutes les 30s (évite collision avec timeout 25s)
    quoteRefreshIntervalRef.current = setInterval(() => {
      void fetchNativeQuote();
    }, 30_000);

    return () => {
      clearTimeout(timeout);
      if (quoteRefreshIntervalRef.current) {
        clearInterval(quoteRefreshIntervalRef.current);
        quoteRefreshIntervalRef.current = null;
      }
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

  // Exécuter le swap via ROUTES NATIVES avec modal de statut style Jupiter
  const handleSwap = async () => {
    if (!connected || !publicKey) {
      toast.error("Connectez votre wallet pour swapper");
      return;
    }

    if (!quote || !amountInBaseUnits) {
      toast.error("Entrez un montant valide");
      return;
    }

    // Ouvrir le modal et commencer la séquence
    setTxModalOpen(true);
    setTxStatus('preparing');
    setTxSignature(null);
    setTxErrorMessage(undefined);
    setOutputAmountForModal(quote.outputAmountFormatted.toLocaleString(undefined, { maximumFractionDigits: 6 }));
    setSwapping(true);
    
    try {
      // Callback de progression pour mettre à jour le modal en temps réel
      const onProgress = (status: 'preparing' | 'signing' | 'sending' | 'confirming' | 'confirmed') => {
        setTxStatus(status);
      };
      
      // Étape 1: Préparation (brief)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Choisir entre le vrai routage natif et le routage via Jupiter CPI
      let result;
      const swapParams = {
        inputMint: new PublicKey(inputToken.mint),
        outputMint: new PublicKey(outputToken.mint),
        amount: amountInBaseUnits,
        slippageBps: Math.round(slippage * 100),
        useMevProtection: mevProtection,
        onProgress, // Callback pour mise à jour du statut en temps réel
      };
      
      // 🔥 Toujours utiliser le VRAI routage natif - appelle directement les DEX
      console.log("[SimpleSwapCard] Using TRUE NATIVE routing (direct DEX CPI)...");
      result = await executeTrueNativeSwap(swapParams, 0);
      
      console.log("[SimpleSwapCard] Swap result:", result);
      
      // Si on arrive ici, le swap est terminé
      if (result && result.signature) {
        console.log("[SimpleSwapCard] Swap SUCCESS with signature:", result.signature);
        // Mettre à jour le status à confirmed IMMÉDIATEMENT
        setTxStatus('confirmed');
        
        // Mettre à jour la signature immédiatement
        setTxSignature(result.signature);
        
        const outputFormatted = result.outputAmount / Math.pow(10, outputToken.decimals);
        setOutputAmountForModal(outputFormatted.toLocaleString(undefined, { maximumFractionDigits: 6 }));
        
        // Sauvegarder dans l'historique
        saveTransaction({
          signature: result.signature,
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol,
          inputAmount: inputAmount,
          outputAmount: outputFormatted.toLocaleString(undefined, { maximumFractionDigits: 6 }),
          timestamp: Date.now(),
          status: 'success',
        });
        
        // Reset form après succès
        setInputAmount("");
        setQuote(null);
        
        // Rafraîchir les balances
        inputTokenData.refetch?.();
        outputTokenData.refetch?.();
      } else {
        throw new Error(swapError || "Erreur lors du swap");
      }
    } catch (error) {
      console.error("Native swap error:", error);
      setTxStatus('error');
      const errorMsg = error instanceof Error ? error.message : "Erreur lors du swap natif";
      setTxErrorMessage(errorMsg);
      
      // Ne pas sauvegarder dans l'historique si l'utilisateur a annulé
      if (!errorMsg.toLowerCase().includes('user rejected') && !errorMsg.toLowerCase().includes('cancelled')) {
        saveTransaction({
          signature: '',
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol,
          inputAmount: inputAmount,
          outputAmount: '0',
          timestamp: Date.now(),
          status: 'failed',
        });
      }
    } finally {
      setSwapping(false);
    }
  };
  
  // Fermer le modal de transaction
  const handleCloseTxModal = () => {
    setTxModalOpen(false);
    setTxStatus('idle');
    setTxSignature(null);
    setTxErrorMessage(undefined);
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
          
          {/* Header avec mode toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-white">Swap</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Mode Simple/Avancé */}
              <SwapModeSelector
                mode={swapMode}
                onModeChange={(newMode) => {
                  setSwapMode(newMode);
                  setModeConfig(newMode === 'simple' ? SIMPLE_MODE_CONFIG : ADVANCED_MODE_CONFIG);
                }}
                config={modeConfig}
                onConfigChange={(newConfig) => {
                  setModeConfig(newConfig);
                  if (newConfig.mode !== swapMode) {
                    setSwapMode(newConfig.mode);
                  }
                }}
              />
              <button
                onClick={() => setShowAdvanced(true)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Paramètres avancés"
              >
                <Settings className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Corps */}
          <div className="space-y-3">
            
            {/* Input Token */}
            <div className="token-input-wrapper">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Vous payez</span>
                {inputTokenData.balance !== null && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const half = (inputTokenData.balance || 0) / 2;
                        setInputAmount(half.toString());
                      }}
                      className="half-btn text-xs px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                      HALF
                    </button>
                    <button
                      onClick={() => setInputAmount(inputTokenData.balance?.toString() || "")}
                      className="max-btn"
                    >
                      MAX: {formatAmount(inputTokenData.balance || 0)}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputAmount}
                  onChange={(e) => {
                    // Accepte "." ou "," comme séparateur décimal.
                    const value = e.target.value.replace(/[^0-9.,\s]/g, "");
                    const dotCount = (value.match(/\./g) || []).length;
                    const commaCount = (value.match(/,/g) || []).length;
                    if (dotCount + commaCount <= 1) {
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
              {/* Valeur USD en temps réel avec SingleTokenFiat */}
              {inputAmount && parseUserAmount(inputAmount) > 0 && (
                <SingleTokenFiat
                  tokenSymbol={inputToken.symbol}
                  amount={parseUserAmount(inputAmount)}
                  compact
                  className="mt-1"
                />
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
              {/* Valeur USD en temps réel pour l'output avec SingleTokenFiat */}
              {quote && quote.outputAmountFormatted > 0 && (
                <SingleTokenFiat
                  tokenSymbol={outputToken.symbol}
                  amount={quote.outputAmountFormatted}
                  compact
                  className="mt-1"
                />
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

                {/* V1.1: Indicateur multi-hop (2 legs) */}
                {trueNativeRoute?.multiHop && (
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span>Multi-hop via USDC</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] bg-white/5 border border-white/10 text-gray-300 px-2 py-0.5 rounded-full font-medium">
                        {trueNativeRoute.multiHop.firstLeg.route.venue}
                      </span>
                      <span className="text-[10px] text-gray-600">→</span>
                      <span className="text-[10px] bg-white/5 border border-white/10 text-gray-300 px-2 py-0.5 rounded-full font-medium">
                        {trueNativeRoute.multiHop.secondLeg.route.venue}
                      </span>
                    </div>
                  </div>
                )}

                {/* Visualisation des routes améliorée en mode avancé */}
                {swapMode === 'advanced' && quote.venues && quote.venues.length > 0 ? (
                  <RouteVisualization
                    inputToken={{
                      symbol: inputToken.symbol,
                      amount: parseUserAmount(inputAmount) || 0,
                      logoURI: inputToken.logoURI,
                    }}
                    outputToken={{
                      symbol: outputToken.symbol,
                      amount: quote.outputAmountFormatted,
                      logoURI: outputToken.logoURI,
                    }}
                    venues={quote.venues.map((venue, i) => ({
                      venue: venue,
                      weight: 100 / quote.venues.length,
                      outputAmount: quote.outputAmountFormatted / quote.venues.length,
                      priceImpactBps: Math.floor((quote.priceImpact || 0) * 100 / quote.venues.length),
                      latencyMs: 0,
                      estimatedNpiBps: 10,
                    }))}
                    marketBenchmark={quote.npiAmount > 0 ? {
                      outputAmount: quote.outputAmountFormatted - quote.npiAmount,
                      priceImpactBps: Math.floor((quote.priceImpact || 0) * 100),
                    } : undefined}
                    estimatedRebate={quote.cashbackAmount || 0}
                    estimatedNpi={quote.npiAmount || 0}
                    compact
                  />
                ) : (
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
                )}
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

                  {quote.bestVenue === "RAYDIUM_AMM" &&
                    typeof quote.minOutAmountFormatted === "number" &&
                    Number.isFinite(quote.minOutAmountFormatted) && (
                      <div className="flex justify-between">
                        <span>Min reçu (Raydium):</span>
                        <span className="text-gray-300">
                          {formatAmount(quote.minOutAmountFormatted)} {outputToken.symbol}
                        </span>
                      </div>
                    )}
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
              ) : !inputAmount || parseUserAmount(inputAmount) === 0 ? (
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
        trueNativeMode={true}
        onTrueNativeModeChange={() => {}}
        quote={quote}
        inputToken={inputToken}
        outputToken={outputToken}
        recentTransactions={recentTxs}
      />
      
      {/* Modal de statut de transaction (style Jupiter) */}
      <TransactionStatusModal
        isOpen={txModalOpen}
        status={txStatus}
        signature={txSignature}
        inputToken={inputToken}
        outputToken={outputToken}
        inputAmount={inputAmount || '0'}
        outputAmount={outputAmountForModal}
        inputUsdValue={parseFloat(inputAmount || '0') * inputTokenData.usdPrice}
        outputUsdValue={parseFloat(outputAmountForModal.replace(/,/g, '') || '0') * outputTokenData.usdPrice}
        onClose={handleCloseTxModal}
        errorMessage={txErrorMessage}
      />
      
    </>
  );
}

export default SimpleSwapCard;
