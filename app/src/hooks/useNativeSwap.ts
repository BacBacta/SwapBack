/**
 * 🔄 Hook pour Swaps Natifs SwapBack
 *
 * Ce hook utilise EXCLUSIVEMENT les venues natives (Raydium, Orca, Meteora, Phoenix)
 * via le programme router on-chain SwapBack.
 * 
 * Avantages:
 * - Génère du NPI (Native Price Improvement)
 * - Distribue des rebates aux utilisateurs
 * - Utilise le scoring des venues on-chain
 * - Supporte le boost cNFT
 *
 * @author SwapBack Team
 * @date December 8, 2025
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SendTransactionError, VersionedTransaction } from "@solana/web3.js";
import { 
  getNativeRouter, 
  type NativeRouteQuote, 
  type NativeSwapResult,
  type VenueQuote,
  type SlippageResult,
  calculateDynamicSlippage,
  checkOracleDivergence,
  SLIPPAGE_CONFIG,
  MIN_VENUE_SCORE,
  MAX_ORACLE_DIVERGENCE_BPS,
} from "@/lib/native-router";
import { 
  TrueNativeSwap,
  type TrueNativeRoute,
  type TrueNativeSwapResult,
} from "@/lib/native-router/true-native-swap";
import { toPublicKey } from "@/lib/native-router/utils/publicKeyUtils";
import { 
  isNativeSwapAvailable, 
  hasOracleForPair,
  NATIVE_SWAP_UNAVAILABLE_MESSAGE 
} from "@/config/oracles";
import { 
  decideSwapRoute, 
  formatRouteDecisionForLog,
  getUIMessageForReason,
  type SwapRouteDecision,
} from "@/lib/swap-routing";
import { useBoostCalculations } from "./useBoostCalculations";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface NativeSwapParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: number; // En lamports
  slippageBps?: number; // Default: dynamique
  useMevProtection?: boolean; // Activer Jito bundle
  /** Callback de progression pour UI */
  onProgress?: (status: 'preparing' | 'signing' | 'sending' | 'confirming' | 'confirmed') => void;
}

export interface NativeSwapQuote {
  // Montants
  inputAmount: number;
  outputAmount: number;
  netOutputAmount: number; // Après frais + rebates
  slippageBpsUsed: number;
  
  // Route
  venues: VenueQuote[];
  bestVenue: string;
  
  // Économie
  priceImpactBps: number;
  estimatedRebate: number;
  estimatedNpi: number;
  platformFeeBps: number;
  
  // Slippage dynamique
  slippageResult?: SlippageResult;
  dynamicSlippageBps: number;
  
  // Boost
  baseRebate: number;
  boostedRebate: number;
  boostBps: number;
  extraGain: number;
  
  // Méta
  timestamp: number;
  expiresAt: number;

  /** Optionnel: minOut recommandé par le DEX pour la venue sélectionnée (ex Raydium otherAmountThreshold) */
  selectedMinOutAmount?: number;
}

export interface SwapHistoryEntry {
  signature: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  venues: string[];
  rebateAmount: number;
  boostApplied: number;
  timestamp: number;
}

// ============================================================================
// HOOK
// ============================================================================

export function useNativeSwap() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { calculateBoostedRebate } = useBoostCalculations();

  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSwapResult, setLastSwapResult] = useState<NativeSwapResult | null>(null);
  const [currentQuote, setCurrentQuote] = useState<NativeSwapQuote | null>(null);
  const [useMevProtection, setUseMevProtection] = useState(false);
  const [useTrueNativeRouting, setUseTrueNativeRouting] = useState(false);
  const [trueNativeRoute, setTrueNativeRoute] = useState<TrueNativeRoute | null>(null);
  
  // Vérifier si les swaps natifs sont disponibles
  const nativeSwapEnabled = useMemo(() => {
    return isNativeSwapAvailable();
  }, []);

  // Router natif (legacy)
  const nativeRouter = useMemo(() => {
    return getNativeRouter(connection);
  }, [connection]);

  // Vrai routeur natif (appelle directement les DEX)
  const trueNativeSwap = useMemo(() => {
    return new TrueNativeSwap(connection);
  }, [connection]);

  /**
   * Obtenir une quote de swap via les venues natives
   */
  const getSwapQuote = useCallback(
    async (
      params: NativeSwapParams,
      userBoostBps: number = 0
    ): Promise<NativeSwapQuote | null> => {
      if (!publicKey) {
        setError("Veuillez connecter votre wallet");
        return null;
      }

      setQuoteLoading(true);
      setError(null);

      try {
        // Normaliser les PublicKey pour éviter les erreurs toBase58
        const safeInputMint = toPublicKey(params.inputMint);
        const safeOutputMint = toPublicKey(params.outputMint);
        const inputMintStr = safeInputMint.toBase58();
        const outputMintStr = safeOutputMint.toBase58();
        
        // ============================================================
        // Décision de routing centralisée via decideSwapRoute
        // ============================================================
        const routeDecision = decideSwapRoute({
          inputMint: inputMintStr,
          outputMint: outputMintStr,
          hasJupiterCpi: true,
        });
        
        // Log structuré de la décision
        logger.debug("useNativeSwap", "Route decision", formatRouteDecisionForLog(routeDecision));
        
        // Si route != native, retourner null avec message approprié
        if (routeDecision.route !== "native") {
          const uiMessage = getUIMessageForReason(routeDecision.reason);
          setError(uiMessage);
          return null;
        }
        
        logger.info("useNativeSwap", "Fetching native quote", {
          inputMint: inputMintStr,
          outputMint: outputMintStr,
          amount: params.amount,
          boostBps: userBoostBps,
        });

        const slippageBps = params.slippageBps ?? SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;

        // Récupérer la meilleure route native via TrueNativeSwap (cohérent avec executeTrueNativeSwap)
        const route = await trueNativeSwap.getBestNativeRoute({
          inputMint: safeInputMint,
          outputMint: safeOutputMint,
          amountIn: params.amount,
          minAmountOut: 0,
          slippageBps,
          userPublicKey: publicKey,
        });

        if (!route || route.allQuotes.length === 0) {
          logger.error("useNativeSwap", "No native venues available", {
            inputMint: inputMintStr,
            outputMint: outputMintStr,
            amount: params.amount,
            routeReturned: route ? "yes (but empty quotes)" : "null",
            allQuotesLength: route?.allQuotes?.length ?? 0,
          });
          throw new Error("Aucune venue native disponible pour cette paire");
        }

        setTrueNativeRoute(route);

        // Calculer le slippage dynamique si non fourni
        let dynamicSlippageBps = params.slippageBps ?? SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
        let slippageResult: SlippageResult | undefined;
        
        if (!params.slippageBps) {
          // Estimer la volatilité
          const volatilityBps = 100; // 1% par défaut, pourrait venir de l'oracle
          const poolTvl = 10_000_000_000_000; // 10M par défaut
          
          slippageResult = calculateDynamicSlippage({
            swapAmount: params.amount,
            poolTvl,
            volatilityBps,
          });
          dynamicSlippageBps = slippageResult.slippageBps;
          
          logger.info("useNativeSwap", "Dynamic slippage", {
            base: slippageResult.baseComponent,
            size: slippageResult.sizeComponent,
            volatility: slippageResult.volatilityComponent,
            total: slippageResult.slippageBps,
          });
        }

        // Estimations (alignées avec executeTrueNativeSwap)
        const estimatedNpi = Math.floor(route.outputAmount * 0.001);
        const estimatedRebate = Math.floor(estimatedNpi * 0.7);

        // Calculer les rebates avec boost
        const baseRebate = estimatedRebate;
        const rebateCalc = calculateBoostedRebate(estimatedRebate, userBoostBps);

        const venues: VenueQuote[] = route.allQuotes.map((q) => ({
          venue: q.venue,
          venueProgramId: q.venueProgramId,
          inputAmount: q.inputAmount,
          outputAmount: q.outputAmount,
          priceImpactBps: q.priceImpactBps,
          accounts: q.accounts.accounts,
          instructionData: q.accounts.data,
          estimatedNpiBps: 0,
          latencyMs: q.latencyMs,
        }));

        const quote: NativeSwapQuote = {
          // Montants
          inputAmount: route.inputAmount,
          outputAmount: route.outputAmount,
          netOutputAmount: route.outputAmount,
          
          // Route
          venues,
          bestVenue: route.venue,
          
          // Économie
          priceImpactBps: route.priceImpactBps,
          estimatedRebate,
          estimatedNpi,
          platformFeeBps: route.platformFeeBps,
          
          // Slippage dynamique
          slippageResult,
          dynamicSlippageBps,
          slippageBpsUsed: dynamicSlippageBps,
          
          // Boost
          baseRebate,
          boostedRebate: rebateCalc.boostedRebate,
          boostBps: userBoostBps,
          extraGain: rebateCalc.extraGain,
          
          // Méta
          timestamp: Date.now(),
          expiresAt: Date.now() + 30000, // 30 secondes de validité

          selectedMinOutAmount:
            route.venue === "RAYDIUM_AMM"
              ? (route.allQuotes.find((q) => q.venue === route.venue)?.minOutAmount ?? undefined)
              : undefined,
        };

        setCurrentQuote(quote);

        logger.info("useNativeSwap", "Native quote received", {
          bestVenue: quote.bestVenue,
          outputAmount: quote.outputAmount,
          netOutput: quote.netOutputAmount,
          rebate: quote.boostedRebate,
          venueCount: quote.venues.length,
        });

        return quote;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors de la quote";
        logger.error("useNativeSwap", "Quote error", { error: message });
        setError(message);
        return null;
      } finally {
        setQuoteLoading(false);
      }
    },
    [publicKey, trueNativeSwap, calculateBoostedRebate]
  );

  /**
   * Exécuter un swap via les venues natives
   */
  const executeSwap = useCallback(
    async (
      params: NativeSwapParams,
      userBoostBps: number = 0
    ): Promise<NativeSwapResult | null> => {
      if (!publicKey || !signTransaction) {
        setError("Veuillez connecter votre wallet");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Obtenir une quote fraîche si nécessaire
        let quote = currentQuote;
        if (!quote || quote.expiresAt < Date.now()) {
          quote = await getSwapQuote(params, userBoostBps);
        }

        if (!quote) {
          throw new Error("Impossible d'obtenir une quote");
        }

        // Rafraîchir si l'utilisateur a changé le slippage depuis la dernière quote
        if (
          typeof params.slippageBps === "number" &&
          typeof quote.slippageBpsUsed === "number" &&
          quote.slippageBpsUsed !== params.slippageBps
        ) {
          logger.info("useNativeSwap", "Slippage changed since last quote, refetching", {
            previousSlippageBps: quote.slippageBpsUsed,
            requestedSlippageBps: params.slippageBps,
          });
          quote = await getSwapQuote(params, userBoostBps);
          if (!quote) {
            throw new Error("Impossible d'obtenir une quote (slippage mismatch)");
          }
        }

        logger.info("useNativeSwap", "Executing native swap", {
          inputAmount: quote.inputAmount,
          outputAmount: quote.outputAmount,
          venues: quote.venues.map(v => v.venue),
          boostBps: userBoostBps,
          mevProtection: params.useMevProtection ?? useMevProtection,
        });

        // 2. Calculer le min output avec slippage (utiliser dynamique si disponible)
        const slippageBps =
          params.slippageBps ??
          quote.dynamicSlippageBps ??
          quote.slippageBpsUsed ??
          SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
        const minAmountOut = Math.floor(quote.outputAmount * (10000 - slippageBps) / 10000);

        logger.info("useNativeSwap", "Prepared slippage thresholds", {
          quoteTimestamp: quote.timestamp,
          quoteExpiresAt: quote.expiresAt,
          quoteOutputAmount: quote.outputAmount,
          appliedSlippageBps: slippageBps,
          quoteSlippageBpsUsed: quote.slippageBpsUsed,
          minAmountOut,
        });

        // Notifier: on va demander la signature
        params.onProgress?.('signing');
        console.log("[useNativeSwap] Calling nativeRouter.executeSwap...");

        // Normaliser les PublicKey pour l'exécution
        const safeInputMint = toPublicKey(params.inputMint);
        const safeOutputMint = toPublicKey(params.outputMint);

        // 3. Exécuter via le router natif (avec MEV protection si activée)
        const result = await nativeRouter.executeSwap(
          {
            inputMint: safeInputMint,
            outputMint: safeOutputMint,
            amountIn: params.amount,
            minAmountOut,
            slippageBps,
            userPublicKey: publicKey,
            boostBps: userBoostBps,
            useJitoBundle: params.useMevProtection ?? useMevProtection,
          },
          async (tx: VersionedTransaction) => {
            // L'utilisateur est en train de signer dans son wallet
            console.log("[useNativeSwap] Waiting for wallet signature...");
            const signed = await signTransaction(tx);
            console.log("[useNativeSwap] Transaction signed, sending...");
            // Une fois signé, on passe à l'envoi
            params.onProgress?.('sending');
            return signed;
          }
        );

        console.log("[useNativeSwap] executeSwap returned:", result);

        // Notifier: confirmation en cours
        params.onProgress?.('confirming');

        logger.info("useNativeSwap", "Native swap executed successfully", {
          signature: result.signature,
          venues: result.venues,
          outputAmount: result.outputAmount,
          rebate: result.rebateAmount,
        });

        // Calculer le rebate boosted final
        const rebateCalc = calculateBoostedRebate(result.rebateAmount, userBoostBps);

        const finalResult: NativeSwapResult = {
          ...result,
          rebateAmount: rebateCalc.boostedRebate,
        };

        setLastSwapResult(finalResult);
        setCurrentQuote(null); // Invalider la quote
        
        // Notifier: confirmé!
        params.onProgress?.('confirmed');

        return finalResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors du swap";
        logger.error("useNativeSwap", "Swap error", { error: message });
        const normalized = message.toLowerCase();
        if (
          normalized.includes("too large") ||
          normalized.includes("1644") ||
          normalized.includes("1232") ||
          normalized.includes("trop volumineuse")
        ) {
          setError(
            "Transaction trop volumineuse pour le router natif. " +
            "Réduisez le montant puis réessayez."
          );
        } else if (
          normalized.includes("0x177e") ||
          normalized.includes("slippage") ||
          normalized.includes("slippage exceeded") ||
          normalized.includes("custom:30") ||
          normalized.includes("0x1e") ||
          normalized.includes("exceeds desired slippage")
        ) {
          setError(
            "Le prix a bougé pendant la simulation (slippage dépassé). " +
            "Actualisez la quote ou augmentez légèrement le slippage."
          );
        } else if (normalized.includes("native_slippage_gate")) {
          setError(
            "Le swap natif ne peut pas respecter ce slippage. " +
            "Relancez une quote fraîche ou augmentez légèrement le slippage."
          );
        } else {
          setError(message);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, currentQuote, getSwapQuote, nativeRouter, calculateBoostedRebate]
  );

  /**
  * 🔥 Exécuter un swap via le VRAI routage natif (direct DEX CPI)
   * Appelle directement les DEX (Orca, Raydium, Meteora) via le mode Dynamic Plan
   */
  const executeTrueNativeSwap = useCallback(
    async (
      params: NativeSwapParams,
      userBoostBps: number = 0
    ): Promise<NativeSwapResult | null> => {
      if (!publicKey || !signTransaction) {
        setError("Veuillez connecter votre wallet");
        return null;
      }

      // Garde-fou: éviter d'envoyer un swap à 0 lamport (souvent dû à un parsing/arrondi UI)
      // qui provoque InvalidAmount (6014) côté programme on-chain.
      if (!Number.isFinite(params.amount) || params.amount <= 0) {
        setError(
          "Montant invalide ou trop petit (arrondi à 0). " +
            "Augmentez le montant et vérifiez le séparateur décimal (utilisez \".\" ou \" ,\")."
        );
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // Normaliser les PublicKey en entrée
        const safeInputMint = toPublicKey(params.inputMint);
        const safeOutputMint = toPublicKey(params.outputMint);

        // Gating oracle AVANT toute signature
        if (!hasOracleForPair(safeInputMint.toBase58(), safeOutputMint.toBase58())) {
          throw new Error(
            "Cette paire n'est pas supportée par le swap natif (oracle manquant)."
          );
        }

        logger.info("useNativeSwap", "🔥 Executing TRUE native swap (direct DEX CPI)", {
          inputMint: safeInputMint.toBase58().slice(0, 8),
          outputMint: safeOutputMint.toBase58().slice(0, 8),
          amount: params.amount,
        });

        params.onProgress?.('preparing');

        // Calculer le min output avec slippage
        const slippageBps = params.slippageBps ?? SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
        
        // Obtenir la meilleure route native
        const route = await trueNativeSwap.getBestNativeRoute({
          inputMint: safeInputMint,
          outputMint: safeOutputMint,
          amountIn: params.amount,
          minAmountOut: 0, // Sera calculé après
          slippageBps,
          userPublicKey: publicKey,
        });

        if (!route) {
          throw new Error(
            "Aucune venue native disponible. Cette paire n'est pas supportée " +
            "par les DEX natifs (Orca, Raydium, Meteora)."
          );
        }

        // Sécurité: Phoenix (CLOB) nécessite une quote orderbook. Tant que ce n'est
        // pas implémenté, on refuse d'exécuter Phoenix pour éviter les IOC failures 0xF.
        if (route.venue === 'PHOENIX') {
          throw new Error(
            "Phoenix est temporairement désactivé pour le swap natif (quote orderbook non implémentée). " +
            "Veuillez réessayer: une autre venue (Meteora/Orca/Raydium) sera utilisée si disponible."
          );
        }

        setTrueNativeRoute(route);

        const minAmountOut = Math.floor(route.outputAmount * (10000 - slippageBps) / 10000);

        logger.info("useNativeSwap", "True native route found", {
          venue: route.venue,
          outputAmount: route.outputAmount,
          minAmountOut,
          priceImpactBps: route.priceImpactBps,
        });

        const build = async () =>
          trueNativeSwap.buildNativeSwapTransaction({
            inputMint: safeInputMint,
            outputMint: safeOutputMint,
            amountIn: params.amount,
            // minAmountOut est dérivé côté builder depuis route.outputAmount + slippageBps
            // pour éviter toute divergence en cas de re-quote.
            minAmountOut: 0,
            slippageBps,
            userPublicKey: publicKey,
            routeOverride: route,
          });

        // Construire la transaction
        let result = await build();

        if (!result) {
          throw new Error("Impossible de construire la transaction native");
        }

        // Simulation AVANT signature (SIMULATE FIRST)
        const sim = await connection.simulateTransaction(result.transaction, {
          sigVerify: false,
          // Simuler EXACTEMENT ce qui sera signé/envoyé.
          replaceRecentBlockhash: false,
        });

        if (sim.value.err) {
          const logsTail = sim.value.logs?.slice(-30) ?? [];
          throw new Error(
            `Simulation du swap natif échouée: ${JSON.stringify(sim.value.err)}` +
              (logsTail.length ? `\nLogs (tail):\n${logsTail.join("\n")}` : "")
          );
        }

        // Signer
        params.onProgress?.('signing');
        const signedTx = await signTransaction(result.transaction);

        const sendAndConfirm = async (ctx: {
          signed: VersionedTransaction;
          blockhash: string;
          lastValidBlockHeight: number;
        }): Promise<string> => {
          // Envoyer
          params.onProgress?.('sending');
          const signature = await connection.sendTransaction(ctx.signed, {
            // Skip preflight car on a déjà simulé nous-mêmes
            skipPreflight: true,
            preflightCommitment: 'confirmed',
            maxRetries: 3,
          });

          logger.info("useNativeSwap", "True native tx sent", {
            signature,
            blockhash: ctx.blockhash,
            lastValidBlockHeight: ctx.lastValidBlockHeight,
          });

          // Confirmer (avec contexte blockhash pour éviter les faux négatifs)
          params.onProgress?.('confirming');
          const confirmation = await connection.confirmTransaction(
            {
              signature,
              blockhash: ctx.blockhash,
              lastValidBlockHeight: ctx.lastValidBlockHeight,
            },
            'confirmed'
          );

          if (confirmation.value.err) {
            // Essayer de récupérer des logs on-chain pour diagnostic
            let logsTail: string[] = [];
            try {
              const tx = await connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              });
              logsTail = tx?.meta?.logMessages?.slice(-40) ?? [];
            } catch {
              logsTail = [];
            }

            throw new Error(
              `Transaction failed: ${JSON.stringify(confirmation.value.err)}` +
                (logsTail.length ? `\nLogs (tail):\n${logsTail.join("\n")}` : "")
            );
          }

          return signature;
        };

        let signature: string;
        try {
          signature = await sendAndConfirm({
            signed: signedTx,
            blockhash: result.blockhash,
            lastValidBlockHeight: result.lastValidBlockHeight,
          });
        } catch (sendErr) {
          let msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
          // Si l'échec vient du préflight (simulation RPC) après signature,
          // récupérer les logs complets pour isoler le programme/instruction fautif.
          if (sendErr instanceof SendTransactionError) {
            try {
              const logs = await sendErr.getLogs(connection);
              if (logs?.length) {
                msg += `\nLogs (preflight):\n${logs.join("\n")}`;
              }
            } catch {
              // ignore
            }
          }
          const normalizedSend = msg.toLowerCase();

          // Cas fréquent: l'utilisateur a mis trop de temps → blockhash expiré
          if (
            normalizedSend.includes('blockhash not found') ||
            normalizedSend.includes('blockhashnotfound') ||
            normalizedSend.includes('transactionexpiredblockheightexceeded') ||
            normalizedSend.includes('expired')
          ) {
            logger.warn("useNativeSwap", "Blockhash expired after signature; rebuilding once", {
              error: msg,
            });

            // Rebuild + re-simulate + re-sign (1x)
            result = await build();
            if (!result) {
              throw new Error("Impossible de reconstruire la transaction native");
            }

            const sim2 = await connection.simulateTransaction(result.transaction, {
              sigVerify: false,
              replaceRecentBlockhash: false,
            });
            if (sim2.value.err) {
              const logsTail2 = sim2.value.logs?.slice(-30) ?? [];
              throw new Error(
                `Simulation du swap natif échouée (retry): ${JSON.stringify(sim2.value.err)}` +
                  (logsTail2.length ? `\nLogs (tail):\n${logsTail2.join("\n")}` : "")
              );
            }

            params.onProgress?.('signing');
            const signedTx2 = await signTransaction(result.transaction);
            signature = await sendAndConfirm({
              signed: signedTx2,
              blockhash: result.blockhash,
              lastValidBlockHeight: result.lastValidBlockHeight,
            });
          } else {
            throw sendErr;
          }
        }

        // Succès !
        params.onProgress?.('confirmed');

        const swapResult: NativeSwapResult = {
          signature,
          inputAmount: params.amount,
          outputAmount: route.outputAmount,
          inputMint: safeInputMint.toBase58(),
          outputMint: safeOutputMint.toBase58(),
          venues: [route.venue],
          rebateAmount: calculateBoostedRebate(route.outputAmount * 0.001, userBoostBps).boostedRebate,
          boostApplied: userBoostBps,
          npiGenerated: route.outputAmount * 0.001,
          success: true,
        };

        setLastSwapResult(swapResult);

        logger.info("useNativeSwap", "🔥 TRUE native swap completed!", {
          signature,
          venue: route.venue,
          outputAmount: route.outputAmount,
        });

        return swapResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors du swap natif";
        const normalized = message.toLowerCase();

        // Log detailed error for debugging
        logger.error("useNativeSwap", "True native swap error", {
          error: message,
          stack: err instanceof Error ? err.stack : null,
          inputMint: params.inputMint?.toString?.() ?? "unknown",
          outputMint: params.outputMint?.toString?.() ?? "unknown",
          venue: trueNativeRoute?.venue,
        });

        // Check for specific error types and provide helpful messages
        if (normalized.includes("0xbc4") || normalized.includes("3012") || normalized.includes("accountnotinitialized")) {
          setError(
            "Compte token non initialisé. Assurez-vous d'avoir un compte wSOL " +
            "ou le token source dans votre wallet."
          );
        } else if (normalized.includes("0x1772") || normalized.includes("oraclestale")) {
          setError(
            "Oracle obsolète ou non disponible pour cette paire. " +
            "Cette paire n'est pas supportée par le routage natif."
          );
        } else if (
          normalized.includes("amountoutbelowminimum") ||
          normalized.includes("0x1794") ||
          normalized.includes("6036")
        ) {
          setError(
            "Le minimum reçu (minOut) est trop élevé pour l'état actuel du pool Orca. " +
            "Actualisez la quote et/ou augmentez légèrement le slippage."
          );
        } else if (normalized.includes("0x65") || normalized.includes("instructionfallbacknotfound")) {
          // Warning: pas de fallback automatique
          logger.warn("useNativeSwap", "Dynamic Plan instruction error", {
            venue: trueNativeRoute?.venue,
          });
          setError(
            "Erreur d'instruction Dynamic Plan. " +
            "Veuillez réessayer ou contacter le support."
          );
        } else if (normalized.includes("insufficient") || normalized.includes("0x1")) {
          setError(
            "Solde insuffisant pour effectuer ce swap. " +
            "Vérifiez que vous avez assez de tokens."
          );
        } else {
          setError(message);
        }

        if (err instanceof Error) {
          console.error("[useNativeSwap] True native swap exception", err);
        } else {
          console.error("[useNativeSwap] True native swap exception", { err });
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, connection, trueNativeSwap, calculateBoostedRebate]
  );

  /**
   * Comparer les routes natives disponibles
   */
  const compareRoutes = useCallback(
    async (params: NativeSwapParams): Promise<VenueQuote[] | null> => {
      try {
        setError(null);

        const quotes = await nativeRouter.getMultiVenueQuotes(
          params.inputMint,
          params.outputMint,
          params.amount
        );

        if (quotes.length === 0) {
          throw new Error("Aucune route native disponible");
        }

        return quotes;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors de la comparaison";
        setError(message);
        return null;
      }
    },
    [nativeRouter]
  );

  /**
   * Estimer les gains de rebates sur une période
   */
  const estimateRebateGains = useCallback(
    (
      monthlySwapVolume: number,
      boostBps: number,
      averageNpiBps: number = 10 // 0.1% NPI moyen
    ) => {
      // NPI mensuel estimé
      const monthlyNpi = monthlySwapVolume * averageNpiBps / 10000;
      
      // Rebate = 70% du NPI
      const baseMonthlyRebate = monthlyNpi * 0.7;
      
      // Appliquer le boost
      const rebateCalc = calculateBoostedRebate(baseMonthlyRebate, boostBps);

      return {
        base: {
          daily: baseMonthlyRebate / 30,
          monthly: baseMonthlyRebate,
          yearly: baseMonthlyRebate * 12,
        },
        boosted: {
          daily: rebateCalc.boostedRebate / 30,
          monthly: rebateCalc.boostedRebate,
          yearly: rebateCalc.boostedRebate * 12,
        },
        extra: {
          daily: rebateCalc.extraGain / 30,
          monthly: rebateCalc.extraGain,
          yearly: rebateCalc.extraGain * 12,
        },
        boostMultiplier: rebateCalc.multiplier,
        estimatedNpi: {
          daily: monthlyNpi / 30,
          monthly: monthlyNpi,
          yearly: monthlyNpi * 12,
        },
      };
    },
    [calculateBoostedRebate]
  );

  /**
   * Obtenir les venues supportées
   */
  const getSupportedVenues = useCallback(() => {
    return [
      { name: "Raydium", type: "AMM", npiEstimate: 10, minScore: MIN_VENUE_SCORE },
      { name: "Raydium CLMM", type: "CLMM", npiEstimate: 12, minScore: MIN_VENUE_SCORE },
      { name: "Orca Whirlpool", type: "CLMM", npiEstimate: 12, minScore: MIN_VENUE_SCORE },
      { name: "Meteora DLMM", type: "DLMM", npiEstimate: 15, minScore: MIN_VENUE_SCORE },
      { name: "Phoenix", type: "CLOB", npiEstimate: 8, minScore: MIN_VENUE_SCORE },
      { name: "Lifinity", type: "Oracle AMM", npiEstimate: 10, minScore: MIN_VENUE_SCORE },
      { name: "Sanctum", type: "LST", npiEstimate: 5, minScore: MIN_VENUE_SCORE },
      { name: "Saber", type: "StableSwap", npiEstimate: 3, minScore: MIN_VENUE_SCORE },
    ];
  }, []);
  
  /**
   * Obtenir la configuration de slippage
   */
  const getSlippageConfig = useCallback(() => {
    return {
      ...SLIPPAGE_CONFIG,
      description: {
        base: "Slippage de base appliqué à tous les swaps",
        max: "Slippage maximum autorisé",
        sizeThreshold: "Seuil d'impact sur le pool avant ajustement",
        volatilityDivisor: "Facteur de division de la volatilité",
      },
    };
  }, []);
  
  /**
   * Valider la divergence oracle
   */
  const validateOraclePrices = useCallback((price1: number, price2: number) => {
    const result = checkOracleDivergence(price1, price2);
    
    if (!result.isValid) {
      logger.warn("useNativeSwap", "Oracle divergence too high", {
        price1,
        price2,
        divergenceBps: result.divergenceBps,
        maxAllowed: MAX_ORACLE_DIVERGENCE_BPS,
      });
    }
    
    return result;
  }, []);

  /**
   * Vérifie si une paire est supportée pour le swap natif
   * Utilise decideSwapRoute pour une décision cohérente
   */
  const isPairSupported = useCallback(
    (inputMint: PublicKey | string, outputMint: PublicKey | string): boolean => {
      const inputStr = typeof inputMint === "string" ? inputMint : inputMint.toString();
      const outputStr = typeof outputMint === "string" ? outputMint : outputMint.toString();
      
      const decision = decideSwapRoute({
        inputMint: inputStr,
        outputMint: outputStr,
        hasJupiterCpi: true,
      });
      
      return decision.route === "native";
    },
    []
  );

  return {
    // État
    loading,
    quoteLoading,
    error,
    lastSwapResult,
    currentQuote,
    nativeSwapEnabled,
    
    // MEV Protection
    useMevProtection,
    setUseMevProtection,

    // Actions principales
    getSwapQuote,
    executeSwap,
    
    // Utilitaires
    compareRoutes,
    estimateRebateGains,
    getSupportedVenues,
    getSlippageConfig,
    validateOraclePrices,
    isPairSupported,
    
    // 🔥 Vrai routage natif (direct DEX CPI)
    useTrueNativeRouting,
    setUseTrueNativeRouting,
    executeTrueNativeSwap,
    trueNativeRoute,
    
    // Configuration
    slippageConfig: SLIPPAGE_CONFIG,
    minVenueScore: MIN_VENUE_SCORE,
    maxOracleDivergence: MAX_ORACLE_DIVERGENCE_BPS,
    
    // Réinitialisation
    clearError: () => setError(null),
    clearQuote: () => setCurrentQuote(null),
  };
}

export default useNativeSwap;
