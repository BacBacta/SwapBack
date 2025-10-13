'use client';

import React, { useState, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { useCNFT } from '../hooks/useCNFT';

// Configuration
const BACK_TOKEN_MINT = new PublicKey('nKnrana1TdBHZGmVbNkpN1Dazj8285VftqCnkHCG8sh');
const ROUTER_PROGRAM_ID = new PublicKey('FPK46poe53iX6Bcv3q8cgmc1jm7dJKQ9Qs9oESFxGN55');
const CNFT_PROGRAM_ID = new PublicKey('FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8');

interface UnlockInterfaceProps {
  onUnlockSuccess?: () => void;
}

export default function UnlockInterface({ onUnlockSuccess }: Readonly<UnlockInterfaceProps>) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { cnftData, lockData, isLoading: isCNFTLoading, levelName, refresh } = useCNFT();

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Couleur du badge selon le niveau
  const levelColor = useMemo(() => {
    switch (levelName) {
      case 'Gold':
        return 'text-yellow-400 border-yellow-400 bg-yellow-400/10';
      case 'Silver':
        return 'text-gray-300 border-gray-300 bg-gray-300/10';
      case 'Bronze':
        return 'text-orange-400 border-orange-400 bg-orange-400/10';
      default:
        return 'text-gray-400 border-gray-400 bg-gray-400/10';
    }
  }, [levelName]);

  // Calcul du temps restant en heures et minutes
  const timeRemaining = useMemo(() => {
    if (!lockData?.unlockTime) return null;

    const now = Math.floor(Date.now() / 1000);
    const unlockTimestamp = Number(lockData.unlockTime);
    const secondsRemaining = unlockTimestamp - now;

    if (secondsRemaining <= 0) {
      return { canUnlock: true, display: 'Déverrouillage disponible !' };
    }

    const days = Math.floor(secondsRemaining / 86400);
    const hours = Math.floor((secondsRemaining % 86400) / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);

    let displayParts = [];
    if (days > 0) displayParts.push(`${days}j`);
    if (hours > 0) displayParts.push(`${hours}h`);
    if (minutes > 0) displayParts.push(`${minutes}m`);

    return {
      canUnlock: false,
      display: displayParts.join(' ') || '< 1m',
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

    const progress = Math.min(100, Math.max(0, (elapsed / estimatedTotalDuration) * 100));
    return Math.round(progress);
  }, [lockData]);

  // Fonction pour déverrouiller les tokens
  const handleUnlock = async () => {
    if (!publicKey) {
      setError('Veuillez connecter votre wallet');
      return;
    }

    if (!timeRemaining?.canUnlock) {
      setError('La période de verrouillage n\'est pas encore terminée');
      return;
    }

    setIsUnlocking(true);
    setError(null);
    setSuccess(null);

    try {
      // Dériver les PDAs
      const [userStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_state'), publicKey.toBuffer()],
        ROUTER_PROGRAM_ID
      );

      const [userNftPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_nft'), publicKey.toBuffer()],
        CNFT_PROGRAM_ID
      );

      const [lockStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lock_state'), publicKey.toBuffer()],
        CNFT_PROGRAM_ID
      );

      // Obtenir l'ATA de l'utilisateur pour $BACK
      const userTokenAccount = await getAssociatedTokenAddress(
        BACK_TOKEN_MINT,
        publicKey
      );

      // Obtenir l'ATA du vault
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        ROUTER_PROGRAM_ID
      );

      const vaultTokenAccount = await getAssociatedTokenAddress(
        BACK_TOKEN_MINT,
        vaultPda,
        true // allowOwnerOffCurve
      );

      // Créer l'instruction unlock_back
      // Note: Ceci est une simulation, l'IDL réel du programme serait nécessaire
      const instruction = {
        programId: ROUTER_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: userStatePda, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
          { pubkey: vaultPda, isSigner: false, isWritable: false },
          { pubkey: BACK_TOKEN_MINT, isSigner: false, isWritable: false },
          { pubkey: userNftPda, isSigner: false, isWritable: true },
          { pubkey: lockStatePda, isSigner: false, isWritable: true },
          { pubkey: CNFT_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([
          0x02, // Instruction discriminator pour unlock_back (à déterminer selon l'IDL)
        ]),
      };

      const transaction = new Transaction().add(instruction as any);

      // Envoyer la transaction
      const signature = await sendTransaction(transaction, connection);

      // Attendre la confirmation
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      const unlockedAmount = lockData?.amount ? Number(lockData.amount) / 1_000_000_000 : 0;
      const successMessage = `✅ Déverrouillage réussi ! ${unlockedAmount > 0 ? unlockedAmount + ' $BACK' : 'Tokens'} récupérés. Signature : ${signature.slice(0, 8)}...`;
      setSuccess(successMessage);

      // Callback de succès
      if (onUnlockSuccess) {
        onUnlockSuccess();
      }

      // Rafraîchir les données du cNFT
      setTimeout(() => {
        refresh();
      }, 2000);
    } catch (err: any) {
      console.error('Erreur lors du déverrouillage:', err);
      setError(
        err.message || 'Échec du déverrouillage. Veuillez réessayer.'
      );
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
          <h3 className="text-xl font-bold text-white mb-2">
            Aucun verrouillage actif
          </h3>
          <p className="text-gray-400">
            Vous n&apos;avez pas de tokens $BACK verrouillés actuellement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">
        🔓 Déverrouiller $BACK
      </h2>

      {/* Informations du lock */}
      <div className="mb-6 p-4 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-300">Montant verrouillé :</span>
          <span className="text-white font-bold text-lg">
            {lockData.amount ? (Number(lockData.amount) / 1_000_000_000).toLocaleString() : '0'} $BACK
          </span>
        </div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-300">Niveau du cNFT :</span>
          <span
            className={`px-3 py-1 rounded-full border font-bold ${levelColor}`}
          >
            {levelName || 'Unknown'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Boost actif :</span>
          <span className="text-green-400 font-bold text-lg">
            +{lockData.boost || 0}%
          </span>
        </div>
      </div>

      {/* Compte à rebours */}
      <div className="mb-6 p-6 bg-gray-700 rounded-lg">
        <div className="text-center mb-4">
          <div className="text-gray-400 text-sm mb-2">Temps restant</div>
          <div
            className={`text-3xl font-bold ${
              timeRemaining?.canUnlock ? 'text-green-400' : 'text-yellow-400'
            }`}
          >
            {timeRemaining?.display || 'Calcul...'}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="relative w-full h-4 bg-gray-600 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${lockProgress}%` }}
          />
        </div>
        <div className="text-center text-gray-400 text-sm mt-2">
          {lockProgress}% écoulé
        </div>
      </div>

      {/* Messages d'erreur et de succès */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-300">
          {success}
        </div>
      )}

      {/* Bouton de déverrouillage */}
      <button
        onClick={handleUnlock}
        disabled={isUnlocking || !publicKey || !timeRemaining?.canUnlock}
        className={`w-full py-3 rounded-lg font-bold text-white transition ${
          isUnlocking || !publicKey || !timeRemaining?.canUnlock
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-500'
        }`}
      >
        {(() => {
          if (isUnlocking) {
            return (
              <span className="flex items-center justify-center">
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
                Déverrouillage en cours...
              </span>
            );
          }
          if (!publicKey) return 'Connecter le wallet';
          if (!timeRemaining?.canUnlock) return `⏳ Disponible dans ${timeRemaining?.display}`;
          return '🔓 Déverrouiller maintenant';
        })()}
      </button>

      {/* Informations supplémentaires */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h4 className="text-blue-300 font-bold mb-2">ℹ️ Informations</h4>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>• Le déverrouillage rendra vos tokens $BACK disponibles</li>
          <li>• Votre cNFT sera désactivé après le déverrouillage</li>
          <li>• Vous pourrez reverrouiller des tokens à tout moment</li>
          <li>• Le boost ne sera plus actif après le déverrouillage</li>
        </ul>
      </div>
    </div>
  );
}
