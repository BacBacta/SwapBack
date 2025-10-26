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

'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { useState, useEffect, useCallback } from 'react';
import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Types
export interface UserNftData {
  user: PublicKey;
  level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
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
const PROGRAM_IDS = {
  swapback_cnft: new PublicKey('CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH'),
  swapback_router: new PublicKey('3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap'),
  swapback_buyback: new PublicKey('71vALqj3cmQWDmq9bi9GYYDPQqpoRstej3snUbikpCHW'),
};

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

    return new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed' }
    );
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
      const provider = getProvider();
      if (!provider) throw new Error('Provider not available');

      // Charger le programme cNFT
      const cnftProgram = anchor.workspace.SwapbackCnft as Program;

      // Dériver le PDA du UserNft
      const [userNftPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_nft'), publicKey.toBuffer()],
        PROGRAM_IDS.swapback_cnft
      );

      // Récupérer les données
      const nftData = await cnftProgram.account.userNft.fetch(userNftPda);

      // Convertir les données
      const formattedData: UserNftData = {
        user: nftData.user,
        level: getLevelName(nftData.level),
        amountLocked: nftData.amountLocked,
        lockDuration: nftData.lockDuration,
        boost: nftData.boost,
        mintTime: nftData.mintTime,
        isActive: nftData.isActive,
      };

      setUserNft(formattedData);
    } catch (err: any) {
      // NFT n'existe pas encore (première fois)
      if (err.message?.includes('Account does not exist')) {
        setUserNft(null);
      } else {
        setError(err.message || 'Erreur lors de la récupération du NFT');
        console.error('Erreur fetchUserNft:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, getProvider]);

  // Récupérer le GlobalState
  const fetchGlobalState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      if (!provider) throw new Error('Provider not available');

      const cnftProgram = anchor.workspace.SwapbackCnft as Program;

      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')],
        PROGRAM_IDS.swapback_cnft
      );

      const stateData = await cnftProgram.account.globalState.fetch(globalStatePda);

      setGlobalState({
        authority: stateData.authority,
        totalCommunityBoost: stateData.totalCommunityBoost,
        activeLocksCount: stateData.activeLocksCount,
        totalValueLocked: stateData.totalValueLocked,
      });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la récupération du GlobalState');
      console.error('Erreur fetchGlobalState:', err);
    } finally {
      setLoading(false);
    }
  }, [connection, getProvider]);

  // Lock des tokens
  const lockTokens = useCallback(async ({ amount, durationDays }: LockParams) => {
    if (!publicKey || !sendTransaction) {
      throw new Error('Wallet non connecté');
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      if (!provider) throw new Error('Provider not available');

      const cnftProgram = anchor.workspace.SwapbackCnft as Program;

      // Convertir les paramètres
      const amountLocked = new BN(amount * 1e9); // 9 decimals
      const lockDuration = new BN(durationDays * 86400); // Secondes

      // Dériver les PDAs
      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')],
        PROGRAM_IDS.swapback_cnft
      );

      const [collectionConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('collection_config')],
        PROGRAM_IDS.swapback_cnft
      );

      const [userNftPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_nft'), publicKey.toBuffer()],
        PROGRAM_IDS.swapback_cnft
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
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ Lock réussi! Signature:', signature);

      // Rafraîchir les données
      await fetchUserNft();
      await fetchGlobalState();

      return signature;
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors du lock';
      setError(errorMsg);
      console.error('Erreur lockTokens:', err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [publicKey, sendTransaction, connection, getProvider, fetchUserNft, fetchGlobalState]);

  // Unlock des tokens
  const unlockTokens = useCallback(async () => {
    if (!publicKey || !sendTransaction) {
      throw new Error('Wallet non connecté');
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      if (!provider) throw new Error('Provider not available');

      const cnftProgram = anchor.workspace.SwapbackCnft as Program;

      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')],
        PROGRAM_IDS.swapback_cnft
      );

      const [userNftPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_nft'), publicKey.toBuffer()],
        PROGRAM_IDS.swapback_cnft
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
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ Unlock réussi! Signature:', signature);

      await fetchUserNft();
      await fetchGlobalState();

      return signature;
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors du unlock';
      setError(errorMsg);
      console.error('Erreur unlockTokens:', err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [publicKey, sendTransaction, connection, getProvider, fetchUserNft, fetchGlobalState]);

  // Claim des buybacks
  const claimBuyback = useCallback(async ({ maxTokens }: ClaimBuybackParams) => {
    if (!publicKey || !sendTransaction) {
      throw new Error('Wallet non connecté');
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      if (!provider) throw new Error('Provider not available');

      const buybackProgram = anchor.workspace.SwapbackBuyback as Program;

      const maxTokensBN = new BN(maxTokens * 1e9);

      const [buybackStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('buyback_state')],
        PROGRAM_IDS.swapback_buyback
      );

      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')],
        PROGRAM_IDS.swapback_cnft
      );

      const [userNftPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_nft'), publicKey.toBuffer()],
        PROGRAM_IDS.swapback_cnft
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
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ Claim buyback réussi! Signature:', signature);

      return signature;
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors du claim';
      setError(errorMsg);
      console.error('Erreur claimBuyback:', err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [publicKey, sendTransaction, connection, getProvider]);

  // Calculer le rebate boosté
  const calculateBoostedRebate = useCallback((baseRebate: number): number => {
    if (!userNft || !userNft.isActive) {
      return baseRebate;
    }

    const boost = userNft.boost; // Basis points
    const multiplier = (10_000 + boost) / 10_000;
    return baseRebate * multiplier;
  }, [userNft]);

  // Calculer la part de buyback estimée
  const calculateBuybackShare = useCallback((totalBuyback: number): number => {
    if (!userNft || !globalState || !userNft.isActive) {
      return 0;
    }

    const distributable = totalBuyback * 0.5; // 50% distribué
    const userBoost = userNft.boost;
    const totalBoost = globalState.totalCommunityBoost.toNumber();

    if (totalBoost === 0) return 0;

    return (distributable * userBoost) / totalBoost;
  }, [userNft, globalState]);

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
function getLevelName(level: any): 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' {
  if (level.bronze) return 'bronze';
  if (level.silver) return 'silver';
  if (level.gold) return 'gold';
  if (level.platinum) return 'platinum';
  if (level.diamond) return 'diamond';
  return 'bronze';
}
