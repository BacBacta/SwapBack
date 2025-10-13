'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

// Configuration du token $BACK
const BACK_TOKEN_MINT = new PublicKey('nKnrana1TdBHZGmVbNkpN1Dazj8285VftqCnkHCG8sh');
const ROUTER_PROGRAM_ID = new PublicKey('FPK46poe53iX6Bcv3q8cgmc1jm7dJKQ9Qs9oESFxGN55');
const CNFT_PROGRAM_ID = new PublicKey('FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8');

// Types pour les niveaux de cNFT
type CNFTLevel = 'Bronze' | 'Silver' | 'Gold';

// Seuils pour les niveaux (en nombre de jours)
const LEVEL_THRESHOLDS = {
  Bronze: 7,
  Silver: 30,
  Gold: 90,
};

// Boost associés aux niveaux (en pourcentage)
const LEVEL_BOOSTS = {
  Bronze: 5,
  Silver: 10,
  Gold: 20,
};

interface LockInterfaceProps {
  onLockSuccess?: () => void;
}

export default function LockInterface({ onLockSuccess }: Readonly<LockInterfaceProps>) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [amount, setAmount] = useState<string>('');
  const [duration, setDuration] = useState<string>('30'); // Jours
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calcul du niveau basé sur la durée
  const predictedLevel: CNFTLevel = useMemo(() => {
    const days = parseInt(duration) || 0;
    if (days >= LEVEL_THRESHOLDS.Gold) return 'Gold';
    if (days >= LEVEL_THRESHOLDS.Silver) return 'Silver';
    return 'Bronze';
  }, [duration]);

  // Calcul du boost basé sur le niveau
  const predictedBoost = useMemo(() => {
    return LEVEL_BOOSTS[predictedLevel];
  }, [predictedLevel]);

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
    const fetchBalance = async () => {
      if (!publicKey) return;

      try {
        const ata = await getAssociatedTokenAddress(
          BACK_TOKEN_MINT,
          publicKey
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
  }, [publicKey, connection]);

  // Validation du montant
  const amountError = useMemo(() => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt)) return null;
    if (amt <= 0) return 'Le montant doit être supérieur à 0';
    if (amt > balance) return 'Solde insuffisant';
    return null;
  }, [amount, balance]);

  // Validation de la durée
  const durationError = useMemo(() => {
    const days = parseInt(duration);
    if (!duration || isNaN(days)) return null;
    if (days < LEVEL_THRESHOLDS.Bronze)
      return `La durée minimale est de ${LEVEL_THRESHOLDS.Bronze} jours`;
    if (days > 365) return 'La durée maximale est de 365 jours';
    return null;
  }, [duration]);

  // Fonction pour verrouiller les tokens
  const handleLock = async () => {
    if (!publicKey) {
      setError('Veuillez connecter votre wallet');
      return;
    }

    if (amountError || durationError) {
      setError('Veuillez corriger les erreurs du formulaire');
      return;
    }

    const amt = parseFloat(amount);
    const days = parseInt(duration);

    if (!amt || !days) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Convertir le montant en unités de base (9 décimales)
      const amountLamports = new BN(amt * 1_000_000_000);

      // Calculer unlock_time (timestamp Unix en secondes)
      const currentTime = Math.floor(Date.now() / 1000);
      const unlockTime = new BN(currentTime + days * 24 * 60 * 60);

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

      // Obtenir l'ATA du vault (PDA du programme router)
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        ROUTER_PROGRAM_ID
      );

      const vaultTokenAccount = await getAssociatedTokenAddress(
        BACK_TOKEN_MINT,
        vaultPda,
        true // allowOwnerOffCurve
      );

      // Créer l'instruction lock_back
      // Note: Ceci est une simulation, l'IDL réel du programme serait nécessaire
      // Pour l'instant, on utilise une instruction manuelle

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
          // Instruction discriminator pour lock_back (à déterminer selon l'IDL)
          // Pour l'instant, on simule
          0x01, // Exemple de discriminator
          ...amountLamports.toArray('le', 8),
          ...unlockTime.toArray('le', 8),
        ]),
      };

      const transaction = new Transaction().add(instruction as any);

      // Envoyer la transaction
      const signature = await sendTransaction(transaction, connection);

      // Attendre la confirmation (méthode moderne)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      setSuccess(
        `✅ Verrouillage réussi ! Signature : ${signature.slice(0, 8)}...`
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
    } catch (err: any) {
      console.error('Erreur lors du verrouillage:', err);
      setError(
        err.message || 'Échec du verrouillage. Veuillez réessayer.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Bouton de montant rapide
  const quickAmounts = [100, 500, 1000, 5000];

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">
        🔒 Verrouiller $BACK
      </h2>

      {/* Affichage du solde */}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Solde disponible :</span>
          <span className="text-white font-bold text-lg">
            {balance.toLocaleString()} $BACK
          </span>
        </div>
      </div>

      {/* Champ de montant */}
      <div className="mb-6">
        <label className="block text-gray-300 mb-2 font-medium">
          Montant à verrouiller
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className={`w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 ${
            amountError
              ? 'border-2 border-red-500 focus:ring-red-500'
              : 'focus:ring-blue-500'
          }`}
          disabled={isLoading}
        />
        {amountError && (
          <p className="text-red-400 text-sm mt-1">{amountError}</p>
        )}

        {/* Boutons de montant rapide */}
        <div className="flex gap-2 mt-3">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => setAmount(amt.toString())}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition"
              disabled={isLoading}
            >
              {amt}
            </button>
          ))}
          <button
            onClick={() => setAmount(balance.toString())}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition"
            disabled={isLoading}
          >
            Max
          </button>
        </div>
      </div>

      {/* Champ de durée */}
      <div className="mb-6">
        <label className="block text-gray-300 mb-2 font-medium">
          Durée de verrouillage (jours)
        </label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="30"
          className={`w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 ${
            durationError
              ? 'border-2 border-red-500 focus:ring-red-500'
              : 'focus:ring-blue-500'
          }`}
          disabled={isLoading}
        />
        {durationError && (
          <p className="text-red-400 text-sm mt-1">{durationError}</p>
        )}

        {/* Boutons de durée rapide */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setDuration('7')}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition"
            disabled={isLoading}
          >
            7j
          </button>
          <button
            onClick={() => setDuration('30')}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition"
            disabled={isLoading}
          >
            30j
          </button>
          <button
            onClick={() => setDuration('90')}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition"
            disabled={isLoading}
          >
            90j
          </button>
          <button
            onClick={() => setDuration('180')}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition"
            disabled={isLoading}
          >
            180j
          </button>
        </div>
      </div>

      {/* Prévisualisation du niveau et du boost */}
      <div className="mb-6 p-4 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-300">Niveau prédit :</span>
          <span
            className={`px-3 py-1 rounded-full border font-bold ${levelColor}`}
          >
            {predictedLevel}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Boost prédit :</span>
          <span className="text-green-400 font-bold text-lg">
            +{predictedBoost}%
          </span>
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
        className={`w-full py-3 rounded-lg font-bold text-white transition ${
          isLoading ||
          !publicKey ||
          !!amountError ||
          !!durationError ||
          !amount ||
          !duration
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500'
        }`}
      >
        {isLoading ? (
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
            Verrouillage en cours...
          </span>
        ) : !publicKey ? (
          'Connecter le wallet'
        ) : (
          '🔒 Verrouiller $BACK'
        )}
      </button>

      {/* Informations supplémentaires */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h4 className="text-blue-300 font-bold mb-2">ℹ️ Informations</h4>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>• Bronze (7-29j) : +5% de boost</li>
          <li>• Silver (30-89j) : +10% de boost</li>
          <li>• Gold (90j+) : +20% de boost</li>
          <li>• Les tokens seront verrouillés jusqu&apos;à la fin de la période</li>
          <li>• Vous recevrez un cNFT représentant votre lock</li>
        </ul>
      </div>
    </div>
  );
}
