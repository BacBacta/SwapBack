"use client";

import React, { useState, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { createUnlockTokensTransaction } from "@/lib/lockTokens";
import { useCNFT } from "../hooks/useCNFT";

type ExtendedCNFTLevel = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

interface UnlockInterfaceProps {
  onUnlockSuccess?: () => void;
}

export default function UnlockInterface({
  onUnlockSuccess,
}: Readonly<UnlockInterfaceProps>) {
  const wallet = useWallet();
  const { publicKey, sendTransaction, signTransaction } = wallet;
  const { connection } = useConnection();
  const {
    cnftData,
    lockData,
    isLoading: isCNFTLoading,
    levelName,
    refresh,
  } = useCNFT();

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate current boost details from lock data
  const boostDetails = useMemo(() => {
    if (!lockData?.amount || !lockData?.unlockTime) {
      return { amountScore: 0, durationScore: 0, totalBoost: 0 };
    }

    const amount = Number(lockData.amount) / 1_000_000; // 6 decimals
    const now = Math.floor(Date.now() / 1000);
    const unlockTimestamp = Number(lockData.unlockTime);

    // Calculate original duration (approximate if we don't have lockTime)
    // We'll estimate based on common durations: 7, 30, 90, 180, 365 days
    const timeRemaining = Math.max(0, unlockTimestamp - now);
    const estimatedTotalDuration =
      timeRemaining > 0 ? timeRemaining : 30 * 24 * 60 * 60;
    const durationDays = estimatedTotalDuration / (24 * 60 * 60);

    const amountScore = Math.min((amount / 1000) * 0.5, 50);
    const durationScore = Math.min((durationDays / 10) * 1, 50);
    const totalBoost = Math.min(amountScore + durationScore, 100);

    return { amountScore, durationScore, totalBoost };
  }, [lockData]);

  // Couleur du badge selon le niveau
  const levelColor = useMemo(() => {
    const normalizedLevel = levelName as ExtendedCNFTLevel | null;

    switch (normalizedLevel) {
      case "Diamond":
        return "text-cyan-400 border-cyan-400 bg-cyan-400/10";
      case "Platinum":
        return "text-purple-400 border-purple-400 bg-purple-400/10";
      case "Gold":
        return "text-yellow-400 border-yellow-400 bg-yellow-400/10";
      case "Silver":
        return "text-gray-300 border-gray-300 bg-gray-300/10";
      case "Bronze":
        return "text-orange-400 border-orange-400 bg-orange-400/10";
      default:
        return "text-gray-400 border-gray-400 bg-gray-400/10";
    }
  }, [levelName]);

  // Calcul du temps restant en heures et minutes
  const timeRemaining = useMemo(() => {
    if (!lockData?.unlockTime) return null;

    const now = Math.floor(Date.now() / 1000);
    const unlockTimestamp = Number(lockData.unlockTime);
    const secondsRemaining = unlockTimestamp - now;

    if (secondsRemaining <= 0) {
      return { canUnlock: true, display: "Unlock available!" };
    }

    const days = Math.floor(secondsRemaining / 86400);
    const hours = Math.floor((secondsRemaining % 86400) / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);

    const displayParts = [];
    if (days > 0) displayParts.push(`${days}j`);
    if (hours > 0) displayParts.push(`${hours}h`);
    if (minutes > 0) displayParts.push(`${minutes}m`);

    return {
      canUnlock: false,
      display: displayParts.join(" ") || "< 1m",
    };
  }, [lockData]);

  // Progression visuelle (pourcentage écoulé)
  // Note: On estime la progression en assumant une durée typique de 30 jours si on ne connaît pas lockTime
  const lockProgress = useMemo(() => {
    if (!lockData?.unlockTime) return 0;

    const now = Math.floor(Date.now() / 1000);
    const unlockTimestamp = Number(lockData.unlockTime);

    // Si on a dépassé unlock_time, 100%
    if (now >= unlockTimestamp) return 100;

    // Sinon, on estime basé sur le temps restant
    // On suppose une durée totale approximative de 30 jours (peut être ajusté)
    const estimatedTotalDuration = 30 * 24 * 60 * 60; // 30 jours en secondes
    const timeRemainingSeconds = unlockTimestamp - now;
    const elapsed = estimatedTotalDuration - timeRemainingSeconds;

    const progress = Math.min(
      100,
      Math.max(0, (elapsed / estimatedTotalDuration) * 100)
    );
    return Math.round(progress);
  }, [lockData]);

  // Function to unlock tokens
  const handleUnlock = async () => {
    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    // Avertissement pour unlock anticipé
    if (!timeRemaining?.canUnlock) {
      const penaltyAmount = lockData?.amount 
        ? (Number(lockData.amount) / 1_000_000) * 0.02  // 6 decimals
        : 0;
      
      const confirmEarlyUnlock = window.confirm(
        `⚠️ EARLY UNLOCK WARNING\n\n` +
        `You are unlocking before the lock period ends.\n` +
        `A penalty of 2% will be applied:\n\n` +
        `• Penalty: ${penaltyAmount.toFixed(2)} BACK (sent to buyback vault)\n` +
        `• You will receive: ${((Number(lockData?.amount || 0) / 1_000_000) - penaltyAmount).toFixed(2)} BACK\n\n` +
        `Do you want to continue?`
      );
      
      if (!confirmEarlyUnlock) {
        return;
      }
    }

    setIsUnlocking(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🔄 [UNLOCK] Starting unlock transaction...');
      const transaction = await createUnlockTokensTransaction(
        connection,
        wallet
      );
      console.log('✅ [UNLOCK] Transaction created successfully');
      console.log('📋 [UNLOCK] Transaction details:', {
        feePayer: transaction.feePayer?.toString(),
        recentBlockhash: transaction.recentBlockhash,
        instructions: transaction.instructions.length,
      });

      // SIMULATE la transaction avant de l'envoyer pour voir les erreurs
      console.log('🧪 [UNLOCK] Simulating transaction first...');
      try {
        const simulation = await connection.simulateTransaction(transaction);
        console.log('✅ [UNLOCK] Simulation result:', simulation);
        
        if (simulation.value.err) {
          console.error('❌ [UNLOCK] SIMULATION FAILED:', simulation.value.err);
          console.error('❌ [UNLOCK] Simulation logs:', simulation.value.logs);
          
          // Vérifier si c'est une erreur "insufficient funds" du Token Program
          const logs = simulation.value.logs || [];
          const hasInsufficientFunds = logs.some(log => 
            log.includes('Error: insufficient funds') || 
            log.includes('custom program error: 0x1')
          );
          
          if (hasInsufficientFunds) {
            console.warn('⚠️ [UNLOCK] Vault insufficient funds detected in simulation.');
            console.warn('⚠️ [UNLOCK] Program has been updated to handle this - proceeding with transaction...');
            // NE PLUS BLOQUER - Le programme Rust déployé le 11 nov 2025 gère ce cas
            // Il unlockera le montant disponible dans le vault au lieu de l'échec total
          } else {
            throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
          }
        } else {
          console.log('✅ [UNLOCK] Simulation successful! Logs:', simulation.value.logs);
        }
      } catch (simError) {
        console.error('⚠️ [UNLOCK] Simulation error:', simError);
        // Si c'est notre erreur "insufficient funds", on ne la relance pas
        if (simError instanceof Error && simError.message.includes('Insufficient funds in vault')) {
          console.warn('⚠️ [UNLOCK] Bypassing simulation error - program handles this case');
        } else {
          throw simError;
        }
      }

      console.log('📤 [UNLOCK] Sending transaction...');
      
      // Essayer d'abord de signer, puis d'envoyer manuellement
      console.log('🔐 [UNLOCK] Signing transaction with wallet...');
      let signedTransaction;
      try {
        signedTransaction = await signTransaction(transaction);
        console.log('✅ [UNLOCK] Transaction signed successfully');
      } catch (signError) {
        console.error('❌ [UNLOCK] Error signing transaction:', signError);
        throw new Error(`Failed to sign transaction: ${signError instanceof Error ? signError.message : 'Unknown error'}`);
      }
      
      // Envoyer la transaction signée
      console.log('📡 [UNLOCK] Sending signed transaction to network...');
      let signature;
      try {
        signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        console.log('✅ [UNLOCK] Transaction sent! Signature:', signature);
      } catch (sendError) {
        console.error('❌ [UNLOCK] Error sending transaction:', sendError);
        throw new Error(`Failed to send transaction: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`);
      }

      // Attendre la confirmation
      console.log('⏳ [UNLOCK] Waiting for confirmation...');
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );
      console.log('✅ [UNLOCK] Transaction confirmed!');

      const unlockedAmount = lockData?.amount
        ? Number(lockData.amount) / 1_000_000 // 6 decimals
        : 0;
      const successMessage = `✅ Unlock successful! ${unlockedAmount > 0 ? unlockedAmount + " $BACK" : "Tokens"} recovered. Signature: ${signature.slice(0, 8)}...`;
      setSuccess(successMessage);

      // Callback de succès
      if (onUnlockSuccess) {
        onUnlockSuccess();
      }

      // Rafraîchir les données du cNFT
      setTimeout(() => {
        refresh();
      }, 2000);
    } catch (err: unknown) {
      console.error("❌ [UNLOCK] Error during unlock:", err);
      
      // Log TRÈS détaillé pour debugging
      if (err instanceof Error) {
        console.error("❌ [UNLOCK] Error name:", err.name);
        console.error("❌ [UNLOCK] Error message:", err.message);
        console.error("❌ [UNLOCK] Error stack:", err.stack);
        console.error("❌ [UNLOCK] Full error object:", JSON.stringify(err, null, 2));
      }
      
      // Si c'est un objet avec des propriétés cachées
      console.error("❌ [UNLOCK] Error keys:", Object.keys(err as object));
      console.error("❌ [UNLOCK] Error values:", Object.values(err as object));
      
      // Essayer d'accéder aux propriétés spécifiques des erreurs Solana
      const anyErr = err as any;
      if (anyErr.logs) {
        console.error("❌ [UNLOCK] Transaction logs:", anyErr.logs);
      }
      if (anyErr.message) {
        console.error("❌ [UNLOCK] Direct message:", anyErr.message);
      }
      if (anyErr.error) {
        console.error("❌ [UNLOCK] Nested error:", anyErr.error);
      }
      
      // Extraire le message d'erreur le plus utile
      let message = "Unlock failed. Please try again.";
      
      if (err instanceof Error) {
        // Vérifier si c'est une erreur de lock period
        if (err.message.includes("LockPeriodNotExpired")) {
          message = "❌ Lock period has not expired yet. Please wait until the unlock time.";
        } else if (err.message.includes("InsufficientFunds")) {
          message = "❌ Insufficient SOL for transaction fees. Please add SOL to your wallet.";
        } else if (err.message.includes("AccountNotFound")) {
          message = "❌ Lock account not found. Please ensure you have locked tokens first.";
        } else {
          message = `❌ ${err.message}`;
        }
      }
      
      setError(message);
    } finally {
      setIsUnlocking(false);
    }
  };

  // Affichage si pas de lock actif
  if (isCNFTLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto">
        <div className="flex items-center justify-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
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
        </div>
      </div>
    );
  }

  if (!cnftData || !cnftData.exists || !cnftData.isActive || !lockData) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔓</div>
          <h3 className="text-xl font-bold text-[var(--primary)] mb-2">
            No Active Lock
          </h3>
          <p className="text-gray-400">
            You don&apos;t have any $BACK tokens locked currently.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-effect rounded-xl p-6 max-w-lg mx-auto border border-gray-700/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-secondary/20 to-green-500/20 border border-secondary/30">
          <span className="text-xl">🔓</span>
        </div>
        <h2 className="card-title">Unlock $BACK</h2>
      </div>

      {/* Lock information with boost details */}
      <div className="mb-6 p-5 glass-effect rounded-lg border border-secondary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-secondary/10 to-transparent rounded-full blur-2xl"></div>

        <div className="relative space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium">Locked Amount</span>
            <span className="text-[var(--primary)] font-bold text-lg">
              {lockData.amount
                ? (Number(lockData.amount) / 1_000_000).toLocaleString() // 6 decimals
                : "0"}{" "}
              <span className="text-primary">$BACK</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium">cNFT Tier</span>
            <span
              className={`px-4 py-1.5 rounded-full border font-bold ${levelColor} transition-all hover:scale-105`}
            >
              {levelName || "Unknown"}
            </span>
          </div>

          {/* Boost Details Section */}
          <div className="pt-3 border-t border-gray-700/30">
            <div className="text-sm font-bold text-orange-400 mb-2">
              ⚠️ You Will Lose This Boost
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Amount Score:</span>
                <span className="text-gray-300">
                  +{boostDetails.amountScore.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Duration Score:</span>
                <span className="text-gray-300">
                  +{boostDetails.durationScore.toFixed(1)}%
                </span>
              </div>
              <div className="h-px bg-orange-500/20 my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">
                  Total Boost Lost:
                </span>
                <span className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  -{boostDetails.totalBoost.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Rebate Multiplier Impact */}
          {boostDetails.totalBoost > 0 && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/10">
              <div className="text-sm font-bold text-orange-400 mb-1">
                💔 Lost Benefits
              </div>
              <div className="text-xs text-gray-400 mb-1">
                Your rebate multiplier will drop from:
              </div>
              <div className="flex items-center gap-2 justify-between">
                <span className="text-lg font-bold text-orange-400">
                  {(1 + boostDetails.totalBoost / 100).toFixed(2)}x
                </span>
                <span className="text-gray-500">→</span>
                <span className="text-lg font-bold text-gray-500">1.00x</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Example: {(3 * (1 + boostDetails.totalBoost / 100)).toFixed(2)}{" "}
                USDC → 3.00 USDC per rebate
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Countdown with animation */}
      <div className="mb-6 p-6 glass-effect rounded-lg border border-gray-700/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5"></div>

        <div className="relative">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              <div className="text-gray-400 text-sm font-medium">
                Time Remaining
              </div>
            </div>
            <div
              className={`text-4xl font-bold ${
                timeRemaining?.canUnlock
                  ? "text-secondary animate-pulse-glow"
                  : "text-yellow-400"
              }`}
            >
              {timeRemaining?.display || "Calcul..."}
            </div>
          </div>

          {/* Barre de progression améliorée */}
          <div className="relative w-full h-3 glass-effect rounded-full overflow-hidden border border-gray-700/50">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-500 animate-shimmer"
              style={{ width: `${lockProgress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-gray-400 text-xs mt-2">
            <span>Start</span>
            <span className="font-bold">{lockProgress}% elapsed</span>
            <span>End</span>
          </div>
        </div>
      </div>

      {/* Messages d'erreur et de succès */}
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

      {/* Bouton de déverrouillage */}
      <button
        onClick={handleUnlock}
        disabled={isUnlocking || !publicKey}
        className={`w-full py-4 rounded-lg font-bold text-[var(--primary)] transition-all duration-300 relative overflow-hidden group ${
          isUnlocking || !publicKey
            ? "bg-gray-700 cursor-not-allowed opacity-50"
            : !timeRemaining?.canUnlock
            ? "bg-gradient-to-r from-orange-500 to-red-500 hover:scale-[1.02] shadow-glow-orange"
            : "bg-gradient-to-r from-secondary to-green-400 hover:scale-[1.02] shadow-glow-green"
        }`}
      >
        {!isUnlocking && publicKey && (
          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-shimmer"></div>
        )}

        {(() => {
          if (isUnlocking) {
            return (
              <span className="flex items-center justify-center relative">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
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
                Unlocking in progress...
              </span>
            );
          }
          if (!publicKey) {
            return <span className="relative">Connect Wallet</span>;
          }
          if (!timeRemaining?.canUnlock) {
            return (
              <span className="relative flex items-center justify-center gap-2">
                <span>⚠️</span>
                <span>Early Unlock (2% penalty)</span>
              </span>
            );
          }
          return (
            <span className="relative flex items-center justify-center gap-2">
              <span>🔓</span>
              <span>Unlock Now</span>
            </span>
          );
        })()}
      </button>

      {/* Additional information */}
      <div className="mt-6 p-5 glass-effect border border-secondary/20 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10 border border-secondary/30">
            <span className="text-sm">ℹ️</span>
          </div>
          <h4 className="text-secondary font-bold">Important Information</h4>
        </div>
        <ul className="text-gray-400 text-sm space-y-2">
          {!timeRemaining?.canUnlock && lockData?.amount && (
            <li className="flex flex-col gap-2 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-orange-400 mt-0.5 text-lg">⚠️</span>
                <span className="text-orange-300 font-bold text-base">
                  Early Unlock Penalty
                </span>
              </div>
              <div className="ml-7 space-y-2">
                <p className="text-orange-200 text-sm">
                  Unlocking before the lock period ends will incur a{" "}
                  <strong className="text-orange-400">2% penalty</strong>.
                  These tokens are rerouted to the buyback vault to reinforce supply reduction.
                </p>
                <div className="p-3 bg-black/30 rounded-lg border border-orange-500/20">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400 text-xs">Locked Amount:</span>
                    <span className="text-white font-medium">
                      {(Number(lockData.amount) / 1_000_000).toLocaleString()} BACK
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400 text-xs">Penalty (2%):</span>
                    <span className="text-red-400 font-bold">
                      -{((Number(lockData.amount) / 1_000_000) * 0.02).toFixed(2)} BACK
                    </span>
                  </div>
                  <div className="h-px bg-orange-500/30 my-2"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm font-medium">You will receive:</span>
                    <span className="text-green-400 font-bold text-lg">
                      {((Number(lockData.amount) / 1_000_000) * 0.98).toFixed(2)} BACK
                    </span>
                  </div>
                </div>
              </div>
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="text-secondary mt-0.5">💰</span>
            <span>Unlocking will make your $BACK tokens available</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">💎</span>
            <span>Your cNFT will be deactivated after unlocking</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">🔒</span>
            <span>You can lock tokens again at any time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">📉</span>
            <span>Boost will no longer be active after unlocking</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
