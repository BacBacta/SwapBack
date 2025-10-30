import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { JupiterService } from "@swapback/sdk";
import type { JupiterQuote } from "@swapback/sdk";

/**
 * Hook personnalisé pour interagir avec Jupiter V6 API
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

  // Créer une instance de JupiterService avec mémoïsation
  const jupiterService = useMemo(() => {
    return new JupiterService(connection);
  }, [connection]);

  // Vérifier si le wallet est connecté et prêt
  const isReady = useMemo(() => {
    return (
      wallet.connected &&
      wallet.publicKey !== null &&
      wallet.signTransaction !== undefined
    );
  }, [wallet.connected, wallet.publicKey, wallet.signTransaction]);

  /**
   * Obtenir un quote de Jupiter pour un swap
   *
   * @param inputMint - Adresse du token d'entrée
   * @param outputMint - Adresse du token de sortie
   * @param amount - Montant en lamports/smallest unit
   * @param slippageBps - Slippage en basis points (50 = 0.5%)
   * @param onlyDirectRoutes - Utiliser uniquement des routes directes
   * @returns Quote de Jupiter ou null en cas d'erreur
   */
  const getQuote = async (
    inputMint: string,
    outputMint: string,
    amount: number | string,
    slippageBps: number = 50,
    onlyDirectRoutes: boolean = false
  ): Promise<JupiterQuote | null> => {
    try {
      const quote = await jupiterService.getQuote(
        inputMint,
        outputMint,
        amount,
        slippageBps,
        onlyDirectRoutes
      );
      return quote;
    } catch (error) {
      console.error("❌ Erreur lors de la récupération du quote:", error);
      return null;
    }
  };

  /**
   * Exécuter un swap via Jupiter
   *
   * @param inputMint - Adresse du token d'entrée
   * @param outputMint - Adresse du token de sortie
   * @param amount - Montant en lamports/smallest unit
   * @param slippageBps - Slippage en basis points (50 = 0.5%)
   * @param priorityFee - Priority fee optionnelle en lamports
   * @returns Signature de la transaction ou null en cas d'erreur
   */
  const executeSwap = async (
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
      // Fonction de signature pour Jupiter
      const signTransaction = async (transaction: VersionedTransaction) => {
        if (!wallet.signTransaction) {
          throw new Error("Wallet ne supporte pas la signature de transaction");
        }
        return await wallet.signTransaction(transaction);
      };

      const signature = await jupiterService.executeSwap(
        inputMint,
        outputMint,
        amount,
        wallet.publicKey,
        signTransaction,
        slippageBps,
        priorityFee
      );

      console.log("✅ Swap exécuté avec succès:", signature);
      return signature;
    } catch (error) {
      console.error("❌ Erreur lors de l'exécution du swap:", error);
      return null;
    }
  };

  /**
   * Obtenir la transaction de swap sans l'exécuter
   *
   * @param quote - Quote Jupiter
   * @param wrapUnwrapSOL - Wrap/unwrap SOL automatiquement
   * @param priorityFee - Priority fee optionnelle
   * @returns Transaction base64 ou null
   */
  const getSwapTransaction = async (
    quote: JupiterQuote,
    wrapUnwrapSOL: boolean = true,
    priorityFee?: number
  ): Promise<string | null> => {
    if (!wallet.publicKey) {
      console.error("❌ Wallet non connecté");
      return null;
    }

    try {
      const response = await jupiterService.getSwapTransaction(
        quote,
        wallet.publicKey,
        wrapUnwrapSOL,
        priorityFee
      );
      return response.swapTransaction;
    } catch (error) {
      console.error("❌ Erreur lors de la création de la transaction:", error);
      return null;
    }
  };

  /**
   * Obtenir les tokens supportés par Jupiter
   *
   * @returns Liste des tokens ou tableau vide
   */
  const getSupportedTokens = async () => {
    try {
      const tokens = await jupiterService.getSupportedTokens();
      return tokens;
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des tokens:", error);
      return [];
    }
  };

  /**
   * Parser les informations de route d'un quote
   *
   * @param quote - Quote Jupiter
   * @returns Informations de route formatées
   */
  const parseRouteInfo = (quote: JupiterQuote) => {
    return jupiterService.parseRouteInfo(quote);
  };

  /**
   * Calculer le prix effectif d'un quote
   *
   * @param quote - Quote Jupiter
   * @param inputDecimals - Décimales du token d'entrée
   * @param outputDecimals - Décimales du token de sortie
   * @returns Prix effectif
   */
  const calculateEffectivePrice = (
    quote: JupiterQuote,
    inputDecimals: number,
    outputDecimals: number
  ) => {
    return jupiterService.calculateEffectivePrice(
      quote,
      inputDecimals,
      outputDecimals
    );
  };

  return {
    // État
    isReady,
    walletAddress: wallet.publicKey?.toBase58() || null,

    // Méthodes principales
    getQuote,
    executeSwap,
    getSwapTransaction,

    // Méthodes utilitaires
    getSupportedTokens,
    parseRouteInfo,
    calculateEffectivePrice,

    // Service direct (pour usage avancé)
    jupiterService,
  };
}
