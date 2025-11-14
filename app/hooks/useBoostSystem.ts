/**
 * 🎯 Hook React pour le Système de Boost SwapBack
 *
 * Ce hook fournit toutes les fonctionnalités du système de boost:
 * - Lecture du boost utilisateur
 * - Lock de tokens
 * - Swap avec rebate boosté
 * - Distribution de buyback
 *
 * @author SwapBack Team
 * @date October 26, 2025
 */

"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { useState, useEffect, useCallback } from "react";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Types
export interface UserNftData {
  user: PublicKey;
  level: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  amountLocked: BN;
  lockDuration: BN;
  boost: number; // Basis points (0-10000)
  mintTime: BN;
  isActive: boolean;
}

export interface GlobalStateData {
  authority: PublicKey;
  totalCommunityBoost: BN;
  activeLocksCount: BN;
  totalValueLocked: BN;
}

export interface LockParams {
  amount: number; // En tokens (sera converti en lamports)
  durationDays: number;
}

export interface ClaimBuybackParams {
  maxTokens: number; // Montant max de tokens à recevoir
}

// Configuration des Program IDs (à mettre à jour après déploiement)
// Utilise les Program IDs depuis les variables d'environnement avec résolution paresseuse
function getProgramIds() {
  return {
    swapback_cnft: new PublicKey(
      process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"
    ),
    swapback_router: new PublicKey(
      process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"
    ),
    swapback_buyback: new PublicKey(
      process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || "EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf"
    ),
  };
}

export function useBoostSystem() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [userNft, setUserNft] = useState<UserNftData | null>(null);
  const [globalState, setGlobalState] = useState<GlobalStateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Créer le provider Anchor
  const getProvider = useCallback(() => {
    if (!publicKey) return null;

    // Mock wallet pour read-only operations
    const wallet = {
      publicKey,
      signTransaction: async (tx: Transaction) => tx,
      signAllTransactions: async (txs: Transaction[]) => txs,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
  }, [connection, publicKey]);

  // Récupérer les données du NFT utilisateur
  const fetchUserNft = useCallback(async () => {
    if (!publicKey) {
      setUserNft(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Implémenter avec IDL chargé dynamiquement
      // Pour l'instant, on désactive cette fonctionnalité en production
      console.warn("fetchUserNft not implemented yet - needs IDL loading");
      setUserNft(null);
    } catch (err: unknown) {
      // NFT n'existe pas encore (première fois)
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || "Erreur lors de la récupération du NFT");
      console.error("Erreur fetchUserNft:", err);
    } finally {
      setLoading(false);
    }

    /* CODE DÉSACTIVÉ - À réactiver avec IDL chargé dynamiquement
    // const provider = getProvider();
    // if (!provider) throw new Error("Provider not available");
    // const cnftProgram = new Program(cnftIdl, getProgramIds().swapback_cnft, provider);
    // const [userNftPda] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("user_nft"), publicKey.toBuffer()],
    //   getProgramIds().swapback_cnft
    // );
    // const nftData = await cnftProgram.account.userNft.fetch(userNftPda);
    // const formattedData: UserNftData = {
    //   user: nftData.user,
    //   level: getLevelName(nftData.level),
    //   amountLocked: nftData.amountLocked,
    //   lockDuration: nftData.lockDuration,
    //   boost: nftData.boost,
    //   mintTime: nftData.mintTime,
    //   isActive: nftData.isActive,
    // };
    // setUserNft(formattedData);
    */
  }, [publicKey]);

  // Récupérer le GlobalState
  const fetchGlobalState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Implémenter avec IDL chargé dynamiquement
      console.warn("fetchGlobalState not implemented yet - needs IDL loading");
      setGlobalState(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || "Erreur lors de la récupération du GlobalState");
      console.error("Erreur fetchGlobalState:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Lock des tokens
  const lockTokens = useCallback(
    async ({ amount, durationDays }: LockParams) => {
      if (!publicKey || !sendTransaction) {
        throw new Error("Wallet non connecté");
      }

      setLoading(true);
      setError(null);

      try {
        const provider = getProvider();
        if (!provider) throw new Error("Provider not available");

        const cnftProgram = anchor.workspace.SwapbackCnft as Program;

        // Convertir les paramètres
        const amountLocked = new BN(amount * 1e9); // 9 decimals
        const lockDuration = new BN(durationDays * 86400); // Secondes

        // Dériver les PDAs
        const programIds = getProgramIds();
        const [globalStatePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("global_state")],
          programIds.swapback_cnft
        );

        const [collectionConfigPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("collection_config")],
          programIds.swapback_cnft
        );

        const [userNftPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user_nft"), publicKey.toBuffer()],
          programIds.swapback_cnft
        );

        // Créer la transaction
        const tx = await cnftProgram.methods
          .mintLevelNft(amountLocked, lockDuration)
          .accounts({
            collectionConfig: collectionConfigPda,
            globalState: globalStatePda,
            userNft: userNftPda,
            user: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .transaction();

        // Envoyer la transaction
        const signature = await sendTransaction(tx, connection);

        // Attendre la confirmation
        await connection.confirmTransaction(signature, "confirmed");

        console.log("✅ Lock réussi! Signature:", signature);

        // Rafraîchir les données
        await fetchUserNft();
        await fetchGlobalState();

        return signature;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Erreur lors du lock";
        setError(errorMsg);
        console.error("Erreur lockTokens:", err);
        throw new Error(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [
      publicKey,
      sendTransaction,
      connection,
      getProvider,
      fetchUserNft,
      fetchGlobalState,
    ]
  );

  // Unlock des tokens
  const unlockTokens = useCallback(async () => {
    if (!publicKey || !sendTransaction) {
      throw new Error("Wallet non connecté");
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      if (!provider) throw new Error("Provider not available");

      const cnftProgram = anchor.workspace.SwapbackCnft as Program;

      const programIds = getProgramIds();
      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        programIds.swapback_cnft
      );

      const [userNftPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), publicKey.toBuffer()],
        programIds.swapback_cnft
      );

      const tx = await cnftProgram.methods
        .updateNftStatus(false) // false = désactiver
        .accounts({
          userNft: userNftPda,
          globalState: globalStatePda,
          user: publicKey,
        })
        .transaction();

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      console.log("✅ Unlock réussi! Signature:", signature);

      await fetchUserNft();
      await fetchGlobalState();

      return signature;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erreur lors du unlock";
      setError(errorMsg);
      console.error("Erreur unlockTokens:", err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [
    publicKey,
    sendTransaction,
    connection,
    getProvider,
    fetchUserNft,
    fetchGlobalState,
  ]);

  // Claim des buybacks
  const claimBuyback = useCallback(
    async ({ maxTokens }: ClaimBuybackParams) => {
      if (!publicKey || !sendTransaction) {
        throw new Error("Wallet non connecté");
      }

      setLoading(true);
      setError(null);

      try {
        const provider = getProvider();
        if (!provider) throw new Error("Provider not available");

        const buybackProgram = anchor.workspace.SwapbackBuyback as Program;

        const maxTokensBN = new BN(maxTokens * 1e9);

        const programIds = getProgramIds();
        const [buybackStatePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("buyback_state")],
          programIds.swapback_buyback
        );

        const [globalStatePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("global_state")],
          programIds.swapback_cnft
        );

        const [userNftPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user_nft"), publicKey.toBuffer()],
          programIds.swapback_cnft
        );

        // Note: backVault et userBackAccount doivent être fournis
        // Ces comptes doivent être créés/récupérés au préalable

        const tx = await buybackProgram.methods
          .distributeBuyback(maxTokensBN)
          .accounts({
            buybackState: buybackStatePda,
            globalState: globalStatePda,
            userNft: userNftPda,
            // backVault: backVaultPda,
            // userBackAccount: userBackAccountPda,
            user: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .transaction();

        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, "confirmed");

        console.log("✅ Claim buyback réussi! Signature:", signature);

        return signature;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Erreur lors du claim";
        setError(errorMsg);
        console.error("Erreur claimBuyback:", err);
        throw new Error(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [publicKey, sendTransaction, connection, getProvider]
  );

  // Calculer le rebate boosté
  const calculateBoostedRebate = useCallback(
    (baseRebate: number): number => {
      if (!userNft || !userNft.isActive) {
        return baseRebate;
      }

      const boost = userNft.boost; // Basis points
      const multiplier = (10_000 + boost) / 10_000;
      return baseRebate * multiplier;
    },
    [userNft]
  );

  // Calculer la part de buyback estimée
  const calculateBuybackShare = useCallback(
    (totalBuyback: number): number => {
      if (!userNft || !globalState || !userNft.isActive) {
        return 0;
      }

      const distributable = totalBuyback * 0.5; // 50% distribué
      const userBoost = userNft.boost;
      const totalBoost = globalState.totalCommunityBoost.toNumber();

      if (totalBoost === 0) return 0;

      return (distributable * userBoost) / totalBoost;
    },
    [userNft, globalState]
  );

  // Charger les données au montage
  useEffect(() => {
    if (publicKey) {
      fetchUserNft();
      fetchGlobalState();
    }
  }, [publicKey, fetchUserNft, fetchGlobalState]);

  return {
    // Données
    userNft,
    globalState,
    loading,
    error,

    // Actions
    lockTokens,
    unlockTokens,
    claimBuyback,

    // Utilitaires
    calculateBoostedRebate,
    calculateBuybackShare,
    refreshData: () => {
      fetchUserNft();
      fetchGlobalState();
    },
  };
}

// Helper function pour convertir le niveau
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getLevelName(
  level: { bronze?: boolean; silver?: boolean; gold?: boolean; platinum?: boolean; diamond?: boolean }
): "bronze" | "silver" | "gold" | "platinum" | "diamond" {
  if (level.bronze) return "bronze";
  if (level.silver) return "silver";
  if (level.gold) return "gold";
  if (level.platinum) return "platinum";
  if (level.diamond) return "diamond";
  return "bronze";
}
