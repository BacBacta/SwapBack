"use client";

/**
 * SimpleSwapCard - Interface de swap simplifiée
 * 
 * Design épuré avec les fonctionnalités essentielles uniquement.
 * Les options avancées sont accessibles via un panneau coulissant.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ArrowDownUp, Settings, Loader2, ChevronRight, Sparkles, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TokenSelectorModal } from "./TokenSelectorModal";
import { AdvancedOptionsPanel } from "./AdvancedOptionsPanel";
import { TransactionStatusModal, TransactionStatus } from "./TransactionStatusModal";
import { useTokenData } from "../hooks/useTokenData";
import { useSwapWithBoost } from "../hooks/useSwapWithBoost";
import { getApiUrl, API_ENDPOINTS } from "@/config/api";
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
  route: string[];
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
  
  // Hook pour exécuter les swaps
  const { executeSwap, loading: swapLoading, error: swapError } = useSwapWithBoost();

  // État principal
  const [inputToken, setInputToken] = useState<TokenInfo>(TOKENS.SOL);
  const [outputToken, setOutputToken] = useState<TokenInfo>(TOKENS.USDC);
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);

  // État des modales
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [showOutputSelector, setShowOutputSelector] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Paramètres (cachés par défaut)
  const [slippage, setSlippage] = useState(0.5);
  const [mevProtection, setMevProtection] = useState(false);

  // État de la transaction
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [lastSwapInput, setLastSwapInput] = useState<string>("");
  const [lastSwapOutput, setLastSwapOutput] = useState<string>("");

  // Token data
  const inputTokenData = useTokenData(inputToken.mint);
  const outputTokenData = useTokenData(outputToken.mint);

  // Vérifier si le solde est insuffisant
  const inputAmountNum = parseFloat(inputAmount) || 0;
  const hasInsufficientBalance = inputAmountNum > 0 && inputTokenData.balance !== null && inputAmountNum > inputTokenData.balance;

  // Calculer le montant en unités de base
  const amountInBaseUnits = useMemo(() => {
    const amount = parseFloat(inputAmount);
    if (!amount || !Number.isFinite(amount)) return 0;
    return Math.floor(amount * Math.pow(10, inputToken.decimals));
  }, [inputAmount, inputToken.decimals]);

  // Fetch quote avec debounce
  useEffect(() => {
    if (!amountInBaseUnits || amountInBaseUnits <= 0) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    const fetchQuote = async () => {
      setLoading(true);
      try {
        const response = await fetch(getApiUrl(API_ENDPOINTS.quote), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputMint: inputToken.mint,
            outputMint: outputToken.mint,
            amount: amountInBaseUnits.toString(),
            slippageBps: Math.round(slippage * 100),
          }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Quote failed");

        const data = await response.json();
        if (data.success && data.quote) {
          const outAmount = parseInt(data.quote.outAmount) || 0;
          const formatted = outAmount / Math.pow(10, outputToken.decimals);
          
          // Calculer le cashback (estimé à 0.14% du montant)
          const cashback = formatted * 0.0014;

          setQuote({
            outputAmount: data.quote.outAmount,
            outputAmountFormatted: formatted,
            priceImpact: parseFloat(data.quote.priceImpactPct) || 0,
            cashbackAmount: cashback,
            route: data.quote.routePlan?.map((r: { swapInfo?: { label?: string } }) => 
              r.swapInfo?.label || "DEX"
            ) || [],
          });
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Quote error:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(fetchQuote, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [amountInBaseUnits, inputToken.mint, outputToken.mint, outputToken.decimals, slippage]);

  // Inverser les tokens
  const handleSwapTokens = useCallback(() => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount("");
    setQuote(null);
  }, [inputToken, outputToken]);

  // Exécuter le swap
  const handleSwap = async () => {
    if (!connected || !publicKey) {
      toast.error("Connectez votre wallet pour swapper");
      return;
    }

    if (!quote || !amountInBaseUnits) {
      toast.error("Entrez un montant valide");
      return;
    }

    // Vérifier le solde avant d'exécuter
    if (hasInsufficientBalance) {
      toast.error(`Solde ${inputToken.symbol} insuffisant. Disponible: ${inputTokenData.balance?.toFixed(4) || 0}`);
      return;
    }

    setSwapping(true);
    setTxStatus('preparing');
    setTxSignature(null);
    setTxError(null);
    
    // Sauvegarder les montants pour l'affichage dans le modal
    setLastSwapInput(inputAmount);
    setLastSwapOutput(quote ? formatAmount(quote.outputAmountFormatted) : "0");
    setShowTxModal(true);
    
    try {
      // Étape 1: Préparation et signature
      setTxStatus('signing');
      
      // Petit délai pour montrer l'étape de signature (UX)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Étape 2: Envoi
      setTxStatus('sending');
      
      const result = await executeSwap(
        {
          inputMint: new PublicKey(inputToken.mint),
          outputMint: new PublicKey(outputToken.mint),
          amount: amountInBaseUnits,
          slippage: slippage,
        },
        0 // userBoostBP - could be fetched from user's lock status
      );

      if (result) {
        // Étape 3: Confirmation
        setTxStatus('confirming');
        
        // Attendre un peu pour simuler la confirmation blockchain
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setTxStatus('confirmed');
        setTxSignature(result.signature || null);
        
        // Mettre à jour avec le montant réel reçu (convertir depuis les unités de base)
        if (result.outputAmount) {
          const formattedOutput = result.outputAmount / Math.pow(10, outputToken.decimals);
          setLastSwapOutput(formatAmount(formattedOutput));
        }
        
        // Reset form après succès
        setInputAmount("");
        setQuote(null);
        
        // Rafraîchir les soldes après un swap réussi (avec délai pour laisser la blockchain se mettre à jour)
        setTimeout(() => {
          console.log("🔄 Refreshing balances after successful swap...");
          inputTokenData.refetch();
          outputTokenData.refetch();
        }, 2000);
      } else {
        setTxStatus('error');
        setTxError(swapError || "Erreur lors du swap");
      }
    } catch (error) {
      console.error("Swap error:", error);
      setTxStatus('error');
      setTxError(error instanceof Error ? error.message : "Erreur lors du swap");
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
              {/* Valeur USD */}
              {inputAmountNum > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {inputTokenData.usdPrice > 0 ? (
                    <>≈ ${(inputAmountNum * inputTokenData.usdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</>
                  ) : inputTokenData.loading ? (
                    <span className="animate-pulse">Chargement du prix...</span>
                  ) : null}
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
                  {/* Valeur USD output - utilise le prix du token output */}
                  {quote && quote.outputAmountFormatted > 0 && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {outputTokenData.usdPrice > 0 ? (
                        <>≈ ${(quote.outputAmountFormatted * outputTokenData.usdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</>
                      ) : outputTokenData.loading ? (
                        <span className="animate-pulse">Chargement...</span>
                      ) : null}
                    </div>
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
            </div>

            {/* Résumé cashback */}
            {quote && quote.cashbackAmount > 0.0001 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="cashback-highlight"
              >
                <div className="flex items-center justify-between text-sm w-full">
                  <span className="cashback-label">💰 Cashback SwapBack</span>
                  <span className="cashback-value">
                    +{formatAmount(quote.cashbackAmount)} {outputToken.symbol}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Message solde insuffisant */}
            {hasInsufficientBalance && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Solde insuffisant. Disponible: {inputTokenData.balance?.toFixed(4) || 0} {inputToken.symbol}
                </span>
              </div>
            )}

            {/* Bouton Swap */}
            <button
              onClick={handleSwap}
              disabled={!connected || !quote || swapping || hasInsufficientBalance}
              className={`
                w-full py-4 rounded-xl font-semibold text-lg transition-all
                ${connected && quote && !swapping && !hasInsufficientBalance
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
              ) : hasInsufficientBalance ? (
                "Solde insuffisant"
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

      {/* Modal d'état de transaction */}
      <TransactionStatusModal
        isOpen={showTxModal}
        status={txStatus}
        signature={txSignature}
        inputToken={inputToken}
        outputToken={outputToken}
        inputAmount={lastSwapInput || inputAmount || "0"}
        outputAmount={lastSwapOutput || "0"}
        onClose={() => {
          setShowTxModal(false);
          setTxStatus('idle');
          setTxSignature(null);
          setTxError(null);
        }}
        errorMessage={txError || undefined}
      />
    </>
  );
}

export default SimpleSwapCard;
