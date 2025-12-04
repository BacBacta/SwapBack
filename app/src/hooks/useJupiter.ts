import { useMemo, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

/**
 * Jupiter Quote type (matches API response)
 */
export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

/**
 * Route information for display
 */
export interface RouteInfo {
  totalSteps: number;
  inputAmount: string;
  outputAmount: string;
  priceImpactPct: number;
  steps: Array<{
    stepNumber: number;
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  }>;
}

/**
 * Hook personnalisé pour interagir avec Jupiter V6 API
 * Utilise les API routes internes pour éviter les problèmes CORS
 *
 * @returns {Object} - Méthodes pour obtenir des quotes et exécuter des swaps
 *
 * @example
 * const { getQuote, executeSwap, isReady } = useJupiter();
 *
 * // Obtenir un quote
 * const quote = await getQuote(SOL_MINT, USDC_MINT, amount);
 *
 * // Exécuter un swap
 * const signature = await executeSwap(SOL_MINT, USDC_MINT, amount);
 */
export function useJupiter() {
  const { connection } = useConnection();
  const wallet = useWallet();

  // Vérifier si le wallet est connecté et prêt
  const isReady = useMemo(() => {
    return (
      wallet.connected &&
      wallet.publicKey !== null &&
      wallet.signTransaction !== undefined
    );
  }, [wallet.connected, wallet.publicKey, wallet.signTransaction]);

  /**
   * Obtenir un quote via notre API interne (évite CORS)
   */
  const getQuote = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number | string,
    slippageBps: number = 50,
    onlyDirectRoutes: boolean = false
  ): Promise<JupiterQuote | null> => {
    try {
      const response = await fetch('/api/swap/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount: amount.toString(),
          slippageBps,
          userPublicKey: wallet.publicKey?.toBase58(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ Quote API error:", error);
        return null;
      }

      const data = await response.json();
      if (data.success && data.quote) {
        return data.quote as JupiterQuote;
      }
      return null;
    } catch (error) {
      console.error("❌ Erreur lors de la récupération du quote:", error);
      return null;
    }
  }, [wallet.publicKey]);

  /**
   * Exécuter un swap via Jupiter (utilise l'API /api/swap)
   */
  const executeSwap = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number | string,
    slippageBps: number = 50,
    priorityFee?: number
  ): Promise<string | null> => {
    if (!isReady || !wallet.publicKey || !wallet.signTransaction) {
      console.error("❌ Wallet non connecté ou non prêt");
      return null;
    }

    try {
      // Étape 1: Obtenir la transaction de swap via notre API
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount: amount.toString(),
          slippageBps,
          userPublicKey: wallet.publicKey.toBase58(),
          priorityFee,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ Swap API error:", error);
        return null;
      }

      const data = await response.json();
      if (!data.success || !data.swapTransaction) {
        console.error("❌ No swap transaction returned");
        return null;
      }

      // Étape 2: Deserialiser et signer la transaction
      const swapTransactionBuf = Buffer.from(data.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Signer avec le wallet
      const signedTransaction = await wallet.signTransaction(transaction);

      // Étape 3: Envoyer la transaction
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      );

      // Confirmer la transaction
      await connection.confirmTransaction(signature, 'confirmed');

      console.log("✅ Swap exécuté avec succès:", signature);
      return signature;
    } catch (error) {
      console.error("❌ Erreur lors de l'exécution du swap:", error);
      return null;
    }
  }, [isReady, wallet, connection]);

  /**
   * Obtenir les tokens supportés via notre API
   */
  const getSupportedTokens = useCallback(async (): Promise<string[]> => {
    try {
      const response = await fetch('/api/tokens?limit=500');
      if (!response.ok) return [];
      
      const data = await response.json();
      if (data.success && data.tokens) {
        return data.tokens.map((t: { address: string }) => t.address);
      }
      return [];
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des tokens:", error);
      return [];
    }
  }, []);

  /**
   * Parser les informations de route d'un quote
   */
  const parseRouteInfo = useCallback((quote: JupiterQuote): RouteInfo => {
    const routes = quote.routePlan ?? [];
    
    return {
      totalSteps: routes.length,
      inputAmount: quote.inAmount ?? "0",
      outputAmount: quote.outAmount ?? "0",
      priceImpactPct: parseFloat(quote.priceImpactPct ?? "0"),
      steps: routes.map((route, index) => ({
        stepNumber: index + 1,
        ammKey: route.swapInfo?.ammKey ?? "Unknown",
        label: route.swapInfo?.label ?? `Step ${index + 1}`,
        inputMint: route.swapInfo?.inputMint ?? "",
        outputMint: route.swapInfo?.outputMint ?? "",
        inAmount: route.swapInfo?.inAmount ?? "0",
        outAmount: route.swapInfo?.outAmount ?? "0",
        feeAmount: route.swapInfo?.feeAmount ?? "0",
        feeMint: route.swapInfo?.feeMint ?? "",
      })),
    };
  }, []);

  /**
   * Calculer le prix effectif d'un quote
   */
  const calculateEffectivePrice = useCallback((
    quote: JupiterQuote,
    inputDecimals: number,
    outputDecimals: number
  ): number => {
    const inAmount = parseFloat(quote.inAmount) / Math.pow(10, inputDecimals);
    const outAmount = parseFloat(quote.outAmount) / Math.pow(10, outputDecimals);
    return outAmount / inAmount;
  }, []);

  return {
    // État
    isReady,
    walletAddress: wallet.publicKey?.toBase58() || null,

    // Méthodes principales
    getQuote,
    executeSwap,

    // Méthodes utilitaires
    getSupportedTokens,
    parseRouteInfo,
    calculateEffectivePrice,
  };
}
