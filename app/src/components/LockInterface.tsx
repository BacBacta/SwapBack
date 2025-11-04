'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { createLockTokensTransaction } from '@/lib/lockTokens';
// Fallback: import { createLockTransaction } from '@/lib/cnft';

// Configuration du token $BACK - Utilise les variables d'environnement
const BACK_TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_BACK_MINT || '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'
);

// Types pour les niveaux de cNFT - Étendus
type CNFTLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

// Seuils pour les niveaux (en nombre de jours) - Visuels uniquement
const LEVEL_THRESHOLDS = {
  Bronze: 7,
  Silver: 30,
  Gold: 90,
  Platinum: 180,
  Diamond: 365,
};

// Fonction de calcul du boost dynamique
const calculateDynamicBoost = (amount: number, durationDays: number): number => {
  // Score du montant (max 50)
  const amountScore = Math.min((amount / 1000) * 0.5, 50);
  
  // Score de la durée (max 50)
  const durationScore = Math.min((durationDays / 10) * 1, 50);
  
  // Boost total (max 100%)
  const totalBoost = Math.min(amountScore + durationScore, 100);
  
  return Math.round(totalBoost * 10) / 10; // Arrondi à 1 décimale
};

// Calcul de la part de buyback de l'utilisateur
const calculateBuybackShare = (userBoost: number, totalCommunityBoost: number): number => {
  if (totalCommunityBoost === 0) return 0;
  return (userBoost / totalCommunityBoost) * 100;
};

interface LockInterfaceProps {
  onLockSuccess?: () => void;
}

export default function LockInterface({ onLockSuccess }: Readonly<LockInterfaceProps>) {
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;
  const { connection } = useConnection();

  const [amount, setAmount] = useState<string>('');
  const [duration, setDuration] = useState<string>('30'); // Days
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calcul du niveau basé sur la durée et le montant (visuel uniquement)
  const predictedLevel: CNFTLevel = useMemo(() => {
    const days = parseInt(duration) || 0;
    const amt = parseFloat(amount) || 0;
    
    if (amt >= 100000 && days >= LEVEL_THRESHOLDS.Diamond) return 'Diamond' as CNFTLevel;
    if (amt >= 50000 && days >= LEVEL_THRESHOLDS.Platinum) return 'Platinum' as CNFTLevel;
    if (amt >= 10000 && days >= LEVEL_THRESHOLDS.Gold) return 'Gold';
    if (amt >= 1000 && days >= LEVEL_THRESHOLDS.Silver) return 'Silver';
    return 'Bronze';
  }, [duration, amount]);

  // Calcul du boost basé sur le montant ET la durée (DYNAMIQUE)
  const predictedBoost = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    const days = parseInt(duration) || 0;
    return calculateDynamicBoost(amt, days);
  }, [amount, duration]);
  
  // Détails du calcul du boost pour affichage
  const boostDetails = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    const days = parseInt(duration) || 0;
    
    const amountScore = Math.min((amt / 1000) * 0.5, 50);
    const durationScore = Math.min((days / 10) * 1, 50);
    
    return { amountScore, durationScore };
  }, [amount, duration]);

  // Couleur du badge selon le niveau
  const levelColor = useMemo(() => {
    switch (predictedLevel) {
      case 'Gold':
        return 'text-yellow-400 border-yellow-400 bg-yellow-400/10';
      case 'Silver':
        return 'text-gray-300 border-gray-300 bg-gray-300/10';
      case 'Bronze':
        return 'text-orange-400 border-orange-400 bg-orange-400/10';
    }
  }, [predictedLevel]);

  // Récupérer le solde de $BACK
  useEffect(() => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    const fetchBalance = async () => {
      try {
        const ata = await getAssociatedTokenAddress(
          BACK_TOKEN_MINT,
          publicKey,
          false, // allowOwnerOffCurve
          TOKEN_2022_PROGRAM_ID // Token-2022 pour BACK
        );

        const tokenAccount = await connection.getTokenAccountBalance(ata);
        const bal = tokenAccount.value.uiAmount || 0;
        setBalance(bal);
      } catch (err) {
        console.error('Erreur lors de la récupération du solde:', err);
        setBalance(0);
      }
    };

    fetchBalance();
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]); // connection est stable

  // Amount validation
  const amountError = useMemo(() => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt)) return null;
    if (amt <= 0) return 'Amount must be greater than 0';
    if (amt > balance) return 'Insufficient balance';
    return null;
  }, [amount, balance]);

  // Duration validation
  const durationError = useMemo(() => {
    const days = parseInt(duration);
    if (!duration || isNaN(days)) return null;
    if (days < LEVEL_THRESHOLDS.Bronze)
      return `Minimum duration is ${LEVEL_THRESHOLDS.Bronze} days`;
    if (days > 365) return 'Maximum duration is 365 days';
    return null;
  }, [duration]);

  // Function to lock tokens
  const handleLock = async () => {
    if (!publicKey) {
      setError('Please connect your wallet');
      return;
    }

    if (amountError || durationError) {
      setError('Please correct form errors');
      return;
    }

    const amt = parseFloat(amount);
    const days = parseInt(duration);

    if (!amt || !days) {
      setError('Please fill all fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🔍 [LOCK DEBUG] Starting lock process...');
      console.log('🔍 [LOCK DEBUG] Amount:', amt, 'Days:', days);
      
      const durationSeconds = days * 24 * 60 * 60;
      console.log('🔍 [LOCK DEBUG] Duration in seconds:', durationSeconds);
      
      // Utiliser la nouvelle fonction avec transfert de tokens
      console.log('🔍 [LOCK DEBUG] Creating lock transaction...');
      const transaction = await createLockTokensTransaction(connection, wallet, {
        amount: amt,
        duration: durationSeconds,
      });
      console.log('✅ [LOCK DEBUG] Transaction created successfully');

      console.log('🔍 [LOCK DEBUG] Sending transaction...');
      const signature = await sendTransaction(transaction, connection);
      console.log('✅ [LOCK DEBUG] Transaction sent:', signature);

      console.log('✅ [LOCK DEBUG] Transaction sent:', signature);

      // Attendre la confirmation (méthode moderne)
      console.log('🔍 [LOCK DEBUG] Waiting for confirmation...');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      console.log('✅ [LOCK DEBUG] Transaction confirmed!');

      setSuccess(
        `✅ Lock réussi ! ${amt} BACK verrouillés pour ${days} jours. Signature: ${signature.slice(0, 8)}...`
      );
      setAmount('');

      // Callback de succès
      if (onLockSuccess) {
        onLockSuccess();
      }

      // Rafraîchir le solde
      setTimeout(async () => {
        if (!publicKey) return;
        const ata = await getAssociatedTokenAddress(BACK_TOKEN_MINT, publicKey);
        const tokenAccount = await connection.getTokenAccountBalance(ata);
        const bal = tokenAccount.value.uiAmount || 0;
        setBalance(bal);
      }, 2000);
    } catch (err: unknown) {
      console.error('❌ [LOCK ERROR] Error during lock:', err);
      console.error('❌ [LOCK ERROR] Error stack:', err instanceof Error ? err.stack : 'No stack');
      
      let message = 'Lock failed. Please try again.';
      
      if (err instanceof Error) {
        message = err.message;
        console.error('❌ [LOCK ERROR] Error message:', message);
        
        // Vérifier les erreurs spécifiques
        if (message.includes('User rejected')) {
          message = '❌ Transaction cancelled by user';
        } else if (message.includes('insufficient')) {
          message = '❌ Insufficient balance';
        } else if (message.includes('AccountNotFound')) {
          message = '❌ Token account not found. Do you have BACK tokens?';
        } else if (message.includes('0x1')) {
          message = '❌ Program error: Account not initialized. Please contact support.';
        }
      }
      
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Bouton de montant rapide
  const quickAmounts = [100, 500, 1000, 5000];

  return (
    <div className="glass-effect rounded-xl p-6 max-w-lg mx-auto border border-gray-700/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary-dark/20 border border-primary/30">
          <span className="text-xl">🔒</span>
        </div>
        <h2 className="card-title">
          Lock $BACK
        </h2>
      </div>

      {/* Avertissement Lock avec transfert on-chain */}
      <div className="mb-6 p-4 glass-effect rounded-lg border border-green-500/30 bg-green-500/5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✅</span>
          <div className="flex-1">
            <h3 className="text-green-400 font-bold mb-1">Lock avec transfert on-chain</h3>
            <p className="text-gray-300 text-sm">
              Les tokens BACK sont transférés vers un PDA de verrouillage sécurisé. Vous pourrez les récupérer après la période de lock.
            </p>
          </div>
        </div>
      </div>

      {/* Balance display */}
      <div className="mb-6 p-4 glass-effect rounded-lg border border-primary/10">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Available Balance</span>
          <span className="text-[var(--primary)] font-bold text-lg">
            {balance.toLocaleString()} <span className="text-primary">$BACK</span>
          </span>
        </div>
      </div>

      {/* Amount field */}
      <div className="mb-6">
        <label className="block text-gray-300 mb-2 font-medium">
          Amount to Lock
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={`w-full px-4 py-3 glass-effect text-[var(--primary)] rounded-lg focus:outline-none focus:ring-2 transition-all ${
              amountError
                ? 'border border-red-500/50 focus:ring-red-500/50 focus:border-red-500'
                : 'border border-gray-700/50 focus:ring-primary/50 focus:border-primary'
            }`}
            disabled={isLoading}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary font-semibold text-sm">
            $BACK
          </div>
        </div>
        {amountError && (
          <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
            <span>⚠️</span>
            {amountError}
          </p>
        )}

        {/* Boutons de montant rapide */}
        <div className="flex gap-2 mt-3">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => setAmount(amt.toString())}
              className="flex-1 px-3 py-2 glass-effect border border-gray-700/50 hover:border-primary/30 text-[var(--primary)] rounded-lg text-sm transition-all hover:scale-105"
              disabled={isLoading}
            >
              {amt.toLocaleString()}
            </button>
          ))}
          <button
            onClick={() => setAmount(balance.toString())}
            className="px-4 py-2 bg-gradient-to-r from-primary to-primary-dark text-[var(--primary)] rounded-lg text-sm font-semibold transition-all hover:scale-105 hover:shadow-glow"
            disabled={isLoading}
          >
            Max
          </button>
        </div>
      </div>

      {/* Duration field */}
      <div className="mb-6">
        <label className="block text-gray-300 mb-2 font-medium">
          Lock Duration (days)
        </label>
        <div className="relative">
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
            className={`w-full px-4 py-3 glass-effect text-[var(--primary)] rounded-lg focus:outline-none focus:ring-2 transition-all ${
              durationError
                ? 'border border-red-500/50 focus:ring-red-500/50 focus:border-red-500'
                : 'border border-gray-700/50 focus:ring-primary/50 focus:border-primary'
            }`}
            disabled={isLoading}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
            days
          </div>
        </div>
        {durationError && (
          <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
            <span>⚠️</span>
            {durationError}
          </p>
        )}

        {/* Boutons de durée rapide */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <button
            onClick={() => setDuration('7')}
            className="px-3 py-2 glass-effect border border-orange-500/20 hover:border-orange-500/40 text-orange-400 rounded-lg text-sm font-medium transition-all hover:scale-105"
            disabled={isLoading}
          >
            7j
          </button>
          <button
            onClick={() => setDuration('30')}
            className="px-3 py-2 glass-effect border border-gray-500/20 hover:border-gray-400/40 text-gray-300 rounded-lg text-sm font-medium transition-all hover:scale-105"
            disabled={isLoading}
          >
            30j
          </button>
          <button
            onClick={() => setDuration('90')}
            className="px-3 py-2 glass-effect border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-400 rounded-lg text-sm font-medium transition-all hover:scale-105"
            disabled={isLoading}
          >
            90j
          </button>
          <button
            onClick={() => setDuration('180')}
            className="px-3 py-2 glass-effect border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-400 rounded-lg text-sm font-medium transition-all hover:scale-105"
            disabled={isLoading}
          >
            180j
          </button>
        </div>
      </div>

      {/* Tier and boost preview - ENHANCED with calculation details */}
      <div className="mb-6 p-5 glass-effect rounded-lg border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-primary/10 to-transparent rounded-full blur-2xl"></div>
        
        <div className="relative space-y-4">
          {/* Visual Tier */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium">Visual Tier</span>
            <span
              className={`px-4 py-1.5 rounded-full border font-bold ${levelColor} transition-all hover:scale-105`}
            >
              {predictedLevel}
            </span>
          </div>
          
          {/* Boost Calculation Details */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-secondary/5 to-transparent border border-secondary/10">
            <div className="text-sm font-bold text-secondary mb-2">🎯 Boost Calculation</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Amount Score:</span>
                <span className="text-gray-200">+{boostDetails.amountScore.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Duration Score:</span>
                <span className="text-gray-200">+{boostDetails.durationScore.toFixed(1)}%</span>
              </div>
              <div className="h-px bg-secondary/20 my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">Total Boost:</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-secondary to-green-400 bg-clip-text text-transparent">
                  +{predictedBoost.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Rebate Multiplier Impact */}
          {predictedBoost > 0 && (
            <>
              <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
                <div className="text-sm font-bold text-primary mb-2">💰 Rebate Multiplier</div>
                <div className="text-xs text-gray-400 mb-1">
                  Your rebates will be multiplied by:
                </div>
                <div className="text-2xl font-bold text-primary">
                  {(1 + predictedBoost / 100).toFixed(2)}x
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Example: Base 3 USDC → {(3 * (1 + predictedBoost / 100)).toFixed(2)} USDC
                </div>
              </div>
              
              {/* Buyback Share Estimation */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-green-500/5 to-transparent border border-green-500/10">
                <div className="text-sm font-bold text-green-400 mb-2">🔥 Buyback Allocation</div>
                <div className="text-xs text-gray-400 mb-2">
                  Your share of buyback tokens (burned):
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-green-400">
                    {calculateBuybackShare(predictedBoost, 10000).toFixed(3)}%
                  </span>
                  <span className="text-xs text-gray-500">
                    (estimated*)
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  * Based on current community total boost
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error and success messages */}
      {error && (
        <div className="mb-4 p-4 glass-effect border border-red-500/30 rounded-lg text-red-300 animate-slide-up">
          <div className="flex items-start gap-3">
            <span className="text-2xl">❌</span>
            <div className="flex-1">
              <p className="font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 glass-effect border border-green-500/30 rounded-lg text-green-300 animate-slide-up">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div className="flex-1">
              <p className="font-medium">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bouton de verrouillage */}
      <button
        onClick={handleLock}
        disabled={
          isLoading ||
          !publicKey ||
          !!amountError ||
          !!durationError ||
          !amount ||
          !duration
        }
        className={`w-full py-4 rounded-lg font-bold text-[var(--primary)] transition-all duration-300 relative overflow-hidden group ${
          isLoading ||
          !publicKey ||
          !!amountError ||
          !!durationError ||
          !amount ||
          !duration
            ? 'bg-gray-700 cursor-not-allowed opacity-50'
            : 'bg-gradient-to-r from-primary to-primary-dark hover:scale-[1.02] shadow-glow'
        }`}
      >
        {!isLoading && !(
          !publicKey ||
          !!amountError ||
          !!durationError ||
          !amount ||
          !duration
        ) && (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent animate-shimmer"></div>
        )}
        
        {isLoading ? (
          <span className="flex items-center justify-center relative">
            <svg
              className="animate-spin h-5 w-5 mr-3"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Locking in progress...
          </span>
        ) : !publicKey ? (
          <span className="relative">Connect Wallet</span>
        ) : (
          <span className="relative flex items-center justify-center gap-2">
            <span>🔒</span>
            <span>Lock $BACK</span>
          </span>
        )}
      </button>

      {/* Additional information */}
      <div className="mt-6 p-5 glass-effect border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border border-primary/30">
            <span className="text-sm">ℹ️</span>
          </div>
          <h4 className="text-primary font-bold">Important Information</h4>
        </div>
        <ul className="text-gray-400 text-sm space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-0.5">🥉</span>
            <span>Bronze (7-29d): +5% boost on your rebates</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">🥈</span>
            <span>Silver (30-89d): +10% boost on your rebates</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">🥇</span>
            <span>Gold (90d+): +20% boost on your rebates</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">🔒</span>
            <span>Tokens will be locked until the end of the period</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-secondary mt-0.5">💎</span>
            <span>You will receive a cNFT representing your lock</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
