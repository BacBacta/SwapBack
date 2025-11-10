"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { createLockTokensTransaction } from "@/lib/lockTokens";
// Fallback: import { createLockTransaction } from '@/lib/cnft';

// Lazy load BACK_TOKEN_MINT to avoid module-level env access
let _backTokenMint: PublicKey | null = null;
function getBackTokenMint(): PublicKey {
  if (!_backTokenMint) {
    _backTokenMint = new PublicKey(
      process.env.NEXT_PUBLIC_BACK_MINT ||
        "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
    );
  }
  return _backTokenMint;
}

// Types pour les niveaux de cNFT - Étendus
type CNFTLevel = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

// Seuils pour les niveaux (en nombre de jours) - Visuels uniquement
const LEVEL_THRESHOLDS = {
  Bronze: 7,
  Silver: 30,
  Gold: 90,
  Platinum: 180,
  Diamond: 365,
};

// Fonction de calcul du boost dynamique
// MUST match the Rust program (lib.rs calculate_boost function)
// Boost maximum = 20% (2000 basis points)
// - Score montant: (amount / 10,000) * 100, max 1000 BP (10%)
// - Score durée: (days / 5) * 10, max 1000 BP (10%)
// - Total: max 2000 BP (20%)
const calculateDynamicBoost = (
  amount: number,
  durationDays: number
): number => {
  // Amount score: (amount / 10000) * 100, max 1000 basis points (10%)
  // 100k tokens = 1000 BP max
  const amountScore = Math.min((amount / 10000) * 100, 1000);

  // Duration score: (days / 5) * 10, max 1000 basis points (10%)
  // 365 days = 730 BP ≈ 7.3%, 500 days = 1000 BP (10%)
  const durationScore = Math.min((durationDays / 5) * 10, 1000);

  // Total boost: max 2000 basis points (20%)
  const totalBoostBps = Math.min(amountScore + durationScore, 2000);

  // Convert basis points to percentage
  return Math.round(totalBoostBps) / 100; // 1000 BP = 10%
};

// Calcul de la part de buyback de l'utilisateur
const calculateBuybackShare = (
  userBoost: number,
  totalCommunityBoost: number
): number => {
  if (totalCommunityBoost === 0) return 0;
  return (userBoost / totalCommunityBoost) * 100;
};

interface LockInterfaceProps {
  onLockSuccess?: () => void;
}

export default function LockInterface({
  onLockSuccess,
}: Readonly<LockInterfaceProps>) {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { connection } = useConnection();

  const [amount, setAmount] = useState<string>("");
  const [duration, setDuration] = useState<string>("30"); // Days
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExistingNft, setHasExistingNft] = useState<boolean>(false);
  const [currentNftData, setCurrentNftData] = useState<{
    amount: number;
    unlockTime: number;
    level: CNFTLevel;
    boost: number;
  } | null>(null);

  // Calcul du niveau basé sur la durée et le montant CUMULÉ (visuel uniquement)
  // Seuils MUST match the Rust program (lib.rs)
  const predictedLevel: CNFTLevel = useMemo(() => {
    const days = parseInt(duration) || 0;
    const amt = parseFloat(amount) || 0;
    
    // Si NFT existe, calculer avec le montant CUMULÉ
    const totalAmount = currentNftData ? currentNftData.amount + amt : amt;

    // Diamond: 100,000+ BACK AND 365+ days
    if (totalAmount >= 100000 && days >= LEVEL_THRESHOLDS.Diamond)
      return "Diamond" as CNFTLevel;
    // Platinum: 50,000+ BACK AND 180+ days
    if (totalAmount >= 50000 && days >= LEVEL_THRESHOLDS.Platinum)
      return "Platinum" as CNFTLevel;
    // Gold: 10,000+ BACK AND 90+ days
    if (totalAmount >= 10000 && days >= LEVEL_THRESHOLDS.Gold) return "Gold";
    // Silver: 1,000+ BACK AND 30+ days
    if (totalAmount >= 1000 && days >= LEVEL_THRESHOLDS.Silver) return "Silver";
    // Bronze: default (100+ BACK AND 7+ days recommended)
    return "Bronze";
  }, [duration, amount, currentNftData]);

  // Niveau affiché : TOUJOURS utiliser la prédiction basée sur le montant cumulé
  const displayLevel: CNFTLevel = useMemo(() => {
    return predictedLevel;
  }, [predictedLevel]);

  // Calcul du boost basé sur le montant CUMULÉ ET la durée (DYNAMIQUE)
  const predictedBoost = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    const days = parseInt(duration) || 0;
    
    // Si NFT existe, calculer avec le montant CUMULÉ
    const totalAmount = currentNftData ? currentNftData.amount + amt : amt;
    
    return calculateDynamicBoost(totalAmount, days);
  }, [amount, duration, currentNftData]);

  // Détails du calcul du boost pour affichage
  const boostDetails = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    const days = parseInt(duration) || 0;
    
    // Si NFT existe, calculer avec le montant CUMULÉ
    const totalAmount = currentNftData ? currentNftData.amount + amt : amt;

    // Amount score: (amount / 10000) * 100, max 1000 BP (10%)
    const amountScoreBps = Math.min((totalAmount / 10000) * 100, 1000);
    // Duration score: (days / 5) * 10, max 1000 BP (10%)
    const durationScoreBps = Math.min((days / 5) * 10, 1000);

    return { 
      amountScore: amountScoreBps / 100,  // Convert to percentage
      durationScore: durationScoreBps / 100 
    };
  }, [amount, duration, currentNftData]);

  // Couleur du badge selon le niveau (utilise le niveau réel du NFT si disponible)
  const levelColor = useMemo(() => {
    const level = currentNftData ? currentNftData.level : predictedLevel;
    switch (level) {
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
    }
  }, [currentNftData, predictedLevel]);

  // Récupérer le solde de $BACK
  useEffect(() => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    const fetchBalance = async () => {
      try {
        const ata = await getAssociatedTokenAddress(
          getBackTokenMint(),
          publicKey,
          false, // allowOwnerOffCurve
          TOKEN_2022_PROGRAM_ID // Token-2022 pour BACK
        );

        // Pour Token-2022, on utilise getAccountInfo et on parse manuellement
        const accountInfo = await connection.getAccountInfo(ata);
        if (!accountInfo) {
          setBalance(0);
          return;
        }

        // Parser les données du compte Token-2022
        // Format Token-2022 account: [mint(32), owner(32), amount(8), ...]
        const data = accountInfo.data;
        if (data.length < 72) { // Taille minimale d'un compte token
          setBalance(0);
          return;
        }

        // Amount commence à l'offset 64 (32 + 32) pour Token-2022
        const amount = data.readBigUInt64LE(64);
        const bal = Number(amount) / Math.pow(10, 9); // 9 décimales pour BACK
        setBalance(bal);
      } catch (err) {
        console.error("Error fetching balance:", err);
        setBalance(0);
      }
    };

    const checkExistingNft = async () => {
      try {
        const CNFT_PROGRAM_ID = new PublicKey(
          process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID ||
            "2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G"
        );

        const [userNftPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user_nft"), publicKey.toBuffer()],
          CNFT_PROGRAM_ID
        );

        const accountInfo = await connection.getAccountInfo(userNftPda);

        if (accountInfo && accountInfo.data.length > 0) {
          // Le NFT existe, lire ses données
          setHasExistingNft(true);

          try {
            // Decoder les données du NFT (structure selon le programme Rust)
            // Structure UserNft:
            // - discriminator: 8 bytes (Anchor)
            // - user: Pubkey (32 bytes)
            // - level: LockLevel enum (1 byte)
            // - amount_locked: u64 (8 bytes)
            // - lock_duration: i64 (8 bytes)
            // - boost: u16 (2 bytes)
            // - mint_time: i64 (8 bytes)
            // - is_active: bool (1 byte)
            // - bump: u8 (1 byte)
            
            const data = accountInfo.data;
            
            let offset = 8; // Skip discriminator
            
            // user: Pubkey (32 bytes) - skip
            offset += 32;
            
            // level: enum (1 byte)
            const levelByte = data.readUInt8(offset);
            offset += 1;
            
            // amount_locked: u64 (8 bytes)
            const amountLocked = Number(data.readBigUInt64LE(offset)) / 1_000_000_000;
            offset += 8;
            
            // lock_duration: i64 (8 bytes)
            const lockDuration = Number(data.readBigInt64LE(offset)); // en secondes
            offset += 8;
            
            // boost: u16 (2 bytes) - en basis points
            const boostBps = data.readUInt16LE(offset);
            offset += 2;
            
            // mint_time: i64 (8 bytes)
            const mintTime = Number(data.readBigInt64LE(offset));
            offset += 8;
            
            // is_active: bool (1 byte)
            const isActive = data.readUInt8(offset) !== 0;
            
            // Calculer unlock_time = mint_time + lock_duration
            const unlockTime = mintTime + lockDuration;
            
            const levelNames: CNFTLevel[] = [
              "Bronze",
              "Silver",
              "Gold",
              "Platinum",
              "Diamond",
            ];
            const level = levelNames[Math.min(levelByte, 4)] || "Bronze";
            const boost = boostBps / 100; // Convertir basis points en pourcentage

            setCurrentNftData({
              amount: amountLocked,
              unlockTime,
              level,
              boost,
            });

            console.log("📊 Current NFT data:", {
              amount: amountLocked,
              lockDuration: `${lockDuration / 86400} days`,
              mintTime: new Date(mintTime * 1000).toISOString(),
              unlockTime: new Date(unlockTime * 1000).toISOString(),
              level,
              boost: `${boost}%`,
              boostBps,
              isActive,
            });
          } catch (decodeErr) {
            console.error("Error decoding NFT data:", decodeErr);
            // Even if decoding fails, allow the lock
            setCurrentNftData(null);
          }
        } else {
          setHasExistingNft(false);
          setCurrentNftData(null);
        }
      } catch (err) {
        console.error("Error checking existing NFT:", err);
        setHasExistingNft(false);
        setCurrentNftData(null);
      }
    };

    fetchBalance();
    checkExistingNft();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(() => {
      fetchBalance();
      checkExistingNft();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]); // connection est stable

  // Amount validation
  const amountError = useMemo(() => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt)) return null;
    if (amt <= 0) return "Amount must be greater than 0";
    if (amt > balance) return "Insufficient balance";
    return null;
  }, [amount, balance]);

  // Duration validation
  const durationError = useMemo(() => {
    const days = parseInt(duration);
    if (!duration || isNaN(days)) return null;
    if (days < LEVEL_THRESHOLDS.Bronze)
      return `Minimum duration is ${LEVEL_THRESHOLDS.Bronze} days`;
    if (days > 365) return "Maximum duration is 365 days";
    return null;
  }, [duration]);

  // Function to lock tokens
  const handleLock = async () => {
    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    if (amountError || durationError) {
      setError("Please correct form errors");
      return;
    }

    const amt = parseFloat(amount);
    const days = parseInt(duration);

    if (!amt || !days) {
      setError("Please fill all fields");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    console.log("═══════════════════════════════════════");
    console.log("🚀 LOCK PROCESS STARTED");
    console.log("═══════════════════════════════════════");

    try {
      console.log("🔍 [LOCK DEBUG] Starting lock process...");
      console.log("🔍 [LOCK DEBUG] Amount:", amt, "Days:", days);
      console.log("🔍 [LOCK DEBUG] Wallet public key:", publicKey.toString());
      console.log("🔍 [LOCK DEBUG] Wallet object:", wallet);

      const durationSeconds = days * 24 * 60 * 60;
      console.log("🔍 [LOCK DEBUG] Duration in seconds:", durationSeconds);

      // Variable pour stocker la signature
      let signature: string;

      // Utiliser la nouvelle fonction avec transfert de tokens
      console.log("🔍 [LOCK DEBUG] Creating lock transaction...");
      try {
        const transaction = await createLockTokensTransaction(
          connection,
          wallet,
          {
            amount: amt,
            duration: durationSeconds,
          }
        );
        console.log("✅ [LOCK DEBUG] Transaction created successfully");
        console.log(
          "🔍 [LOCK DEBUG] Transaction instructions:",
          transaction.instructions.length
        );

        // Obtenir le blockhash JUSTE AVANT de signer
        console.log("🔍 [LOCK DEBUG] Getting latest blockhash...");
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        console.log(
          "✅ [LOCK DEBUG] Blockhash obtained:",
          blockhash.slice(0, 8) + "..."
        );

        // IMPORTANT: Définir le feePayer et recentBlockhash AVANT d'envoyer au wallet
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = blockhash;

        console.log("🔍 [LOCK DEBUG] Transaction details:", {
          feePayer: transaction.feePayer?.toString(),
          recentBlockhash: transaction.recentBlockhash,
          signatures: transaction.signatures.length,
        });

        // Approche alternative : signer puis envoyer manuellement pour capturer l'erreur
        console.log(
          "🔍 [LOCK DEBUG] Asking wallet to sign transaction..."
        );
        console.log("🔍 [LOCK DEBUG] Wallet supports signing:", !!wallet.signTransaction);
        
        if (!wallet.signTransaction) {
          console.error("❌ Wallet does not support transaction signing");
          throw new Error("Wallet does not support transaction signing");
        }
        
        let signedTx: Transaction;
        try {
          console.log("⏳ [LOCK DEBUG] Waiting for user signature (check your wallet popup)...");
          
          // Créer une promesse avec timeout pour la signature
          const signPromise = wallet.signTransaction(transaction);
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Signature timeout after 60s - Did you approve the transaction in your wallet?")), 60000)
          );
          
          signedTx = await Promise.race([signPromise, timeoutPromise]);
          console.log("✅ [LOCK DEBUG] Transaction signed successfully");
        } catch (signError: unknown) {
          const error = signError as Error;
          console.error("❌ [LOCK DEBUG] Signature error:", signError);
          console.error("❌ [LOCK DEBUG] Error details:", {
            message: error?.message,
            name: error?.name,
          });
          
          // Message plus clair pour l'utilisateur
          if (error?.message?.includes("User rejected") || error?.message?.includes("rejected")) {
            throw new Error("Transaction cancelled by user");
          } else if (error?.message?.includes("timeout")) {
            throw new Error("Signature timeout - Please approve the transaction in your wallet");
          }
          
          throw new Error(`Signature failed: ${error?.message || 'Unknown error'}`);
        }
        
        console.log("🔍 [LOCK DEBUG] Sending signed transaction to network...");
        try {
          signature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3,
          });
          console.log(
            "✅ [LOCK DEBUG] Transaction sent to network:",
            signature
          );
        } catch (sendError: unknown) {
          const error = sendError as Error & { logs?: string[] };
          console.error("❌ [LOCK DEBUG] Send transaction error:", sendError);
          console.error("❌ [LOCK DEBUG] Send error details:", {
            message: error?.message,
            logs: error?.logs,
          });
          throw new Error(`Send failed: ${error?.message || 'Unknown error'}`);
        }

        // Attendre la confirmation
        console.log("🔍 [LOCK DEBUG] Waiting for confirmation...");
        try {
          await connection.confirmTransaction(
            {
              signature,
              blockhash,
              lastValidBlockHeight,
            },
            "confirmed"
          );
          console.log("✅ [LOCK DEBUG] Transaction confirmed!");
        } catch (confirmError: unknown) {
          const error = confirmError as Error;
          console.error("❌ [LOCK DEBUG] Confirmation error:", confirmError);
          console.error("❌ [LOCK DEBUG] Confirmation error details:", {
            message: error?.message,
            signature: signature,
          });
          throw new Error(`Confirmation failed: ${error?.message || 'Unknown error'}`);
        }
      } catch (txError) {
        console.error(
          "❌ [LOCK DEBUG] Transaction creation/send error:",
          txError
        );
        throw txError;
      }
      console.log("✅ [LOCK DEBUG] Transaction confirmed!");

      setSuccess(
        `✅ Lock successful! ${amt} BACK locked for ${days} days. Signature: ${signature.slice(0, 8)}...`
      );
      setAmount("");

      // Rafraîchir immédiatement les données du NFT après le lock
      setTimeout(async () => {
        if (!publicKey) return;
        
        try {
          // Rafraîchir le solde
          const ata = await getAssociatedTokenAddress(
            getBackTokenMint(),
            publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
          );
          
          // Pour Token-2022, utiliser getAccountInfo
          const accountInfo = await connection.getAccountInfo(ata);
          let bal = 0;
          if (accountInfo && accountInfo.data.length >= 72) {
            const amount = accountInfo.data.readBigUInt64LE(64);
            bal = Number(amount) / Math.pow(10, 9);
          }
          
          setBalance(bal);

          // Rafraîchir les données du NFT
          const CNFT_PROGRAM_ID = new PublicKey(
            process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID ||
              "2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G"
          );

          const [userNftPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("user_nft"), publicKey.toBuffer()],
            CNFT_PROGRAM_ID
          );

          const nftAccountInfo = await connection.getAccountInfo(userNftPda);

          if (nftAccountInfo && nftAccountInfo.data.length > 0) {
            const data = nftAccountInfo.data;
            let offset = 8; // Skip discriminator
            offset += 32; // Skip user pubkey
            
            const levelByte = data.readUInt8(offset);
            offset += 1;
            
            const amountLocked = Number(data.readBigUInt64LE(offset)) / 1_000_000_000;
            offset += 8;
            
            const lockDuration = Number(data.readBigInt64LE(offset));
            offset += 8;
            
            const boostBps = data.readUInt16LE(offset);
            offset += 2;
            
            const mintTime = Number(data.readBigInt64LE(offset));
            offset += 8;
            
            const unlockTime = mintTime + lockDuration;
            
            const levelNames: CNFTLevel[] = [
              "Bronze",
              "Silver",
              "Gold",
              "Platinum",
              "Diamond",
            ];
            const level = levelNames[Math.min(levelByte, 4)] || "Bronze";
            const boost = boostBps / 100;

            setCurrentNftData({
              amount: amountLocked,
              unlockTime,
              level,
              boost,
            });

            console.log("🔄 NFT data refreshed after lock:", {
              amount: amountLocked,
              lockDuration: `${lockDuration / 86400} days`,
              level,
              boost: `${boost}%`,
            });
          }
        } catch (err) {
          console.error("Error refreshing after lock:", err);
        }
      }, 2000);

      // Callback de succès
      if (onLockSuccess) {
        onLockSuccess();
      }
    } catch (err: unknown) {
      console.error("❌ [LOCK ERROR] Error during lock:", err);
      console.error("❌ [LOCK ERROR] Error type:", typeof err);
      console.error(
        "❌ [LOCK ERROR] Error stack:",
        err instanceof Error ? err.stack : "No stack"
      );

      let message = "Lock failed. Please try again.";

      if (err instanceof Error) {
        console.error("❌ [LOCK ERROR] Error message:", err.message);
        console.error("❌ [LOCK ERROR] Error name:", err.name);

        // Afficher l'erreur complète pour debug
        message = `❌ ${err.message}`;

        // Check for specific errors with clearer messages
        if (err.message.includes("User rejected")) {
          message = "❌ Transaction cancelled by user";
        } else if (err.message.includes("insufficient")) {
          message = "❌ Insufficient balance";
        } else if (err.message.includes("AccountNotFound")) {
          message = "❌ Token account not found. Do you have BACK tokens?";
        } else if (err.message.includes("0x1") || err.message.includes("Account not initialized")) {
          message =
            "❌ Global state not initialized. The program may need to be set up first. Please try again in a few moments.";
        } else if (err.message.includes("Blockhash not found")) {
          message = "❌ Transaction expired. Please try again.";
        }
      } else {
        // Si ce n'est pas une Error standard, afficher l'objet complet
        console.error(
          "❌ [LOCK ERROR] Non-Error object:",
          JSON.stringify(err, null, 2)
        );
        message = `❌ Unexpected error: ${JSON.stringify(err)}`;
      }

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Boutons de montant rapide - Adaptés pour supply de 1B
  const quickAmounts = [100000, 500000, 1000000, 5000000];

  return (
    <div className="glass-effect rounded-xl p-6 max-w-lg mx-auto border border-gray-700/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary-dark/20 border border-primary/30">
          <span className="text-xl">🔒</span>
        </div>
        <h2 className="card-title">Lock $BACK</h2>
      </div>

      {/* Information sur les locks multiples */}
      {/* Current NFT Information */}
      {/* Balance display */}
      <div className="mb-6 p-4 glass-effect rounded-lg border border-primary/10">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Available Balance</span>
          <span className="text-[var(--primary)] font-bold text-lg">
            {balance.toLocaleString()}{" "}
            <span className="text-primary">$BACK</span>
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
                ? "border border-red-500/50 focus:ring-red-500/50 focus:border-red-500"
                : "border border-gray-700/50 focus:ring-primary/50 focus:border-primary"
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
                ? "border border-red-500/50 focus:ring-red-500/50 focus:border-red-500"
                : "border border-gray-700/50 focus:ring-primary/50 focus:border-primary"
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
            onClick={() => setDuration("7")}
            className="px-3 py-2 glass-effect border border-orange-500/20 hover:border-orange-500/40 text-orange-400 rounded-lg text-sm font-medium transition-all hover:scale-105"
            disabled={isLoading}
          >
            7j
          </button>
          <button
            onClick={() => setDuration("30")}
            className="px-3 py-2 glass-effect border border-gray-500/20 hover:border-gray-400/40 text-gray-300 rounded-lg text-sm font-medium transition-all hover:scale-105"
            disabled={isLoading}
          >
            30j
          </button>
          <button
            onClick={() => setDuration("90")}
            className="px-3 py-2 glass-effect border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-400 rounded-lg text-sm font-medium transition-all hover:scale-105"
            disabled={isLoading}
          >
            90j
          </button>
          <button
            onClick={() => setDuration("180")}
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
              {displayLevel}
            </span>
          </div>

          {/* Boost Calculation Details */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-secondary/5 to-transparent border border-secondary/10">
            <div className="text-sm font-bold text-secondary mb-2">
              🎯 Boost Calculation (Max 20%)
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Amount Score (max 10%):</span>
                <span className="text-gray-200">
                  +{boostDetails.amountScore.toFixed(2)}%
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 ml-2">
                💡 Max atteint à 5M tokens
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Duration Score (max 10%):</span>
                <span className="text-gray-200">
                  +{boostDetails.durationScore.toFixed(2)}%
                </span>
              </div>
              <div className="h-px bg-secondary/20 my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">Total Boost:</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-secondary to-green-400 bg-clip-text text-transparent">
                  +{predictedBoost.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Rebate Multiplier Impact */}
          {predictedBoost > 0 && (
            <>
              <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
                <div className="text-sm font-bold text-primary mb-2">
                  💰 Rebate Multiplier
                </div>
                <div className="text-xs text-gray-400 mb-1">
                  Your rebates will be multiplied by:
                </div>
                <div className="text-2xl font-bold text-primary">
                  {(1 + predictedBoost / 100).toFixed(3)}x
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Example: Base 10 USDC →{" "}
                  {(10 * (1 + predictedBoost / 100)).toFixed(2)} USDC
                </div>
              </div>

              {/* Buyback Share Estimation */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-green-500/5 to-transparent border border-green-500/10">
                <div className="text-sm font-bold text-green-400 mb-2">
                  🔥 Buyback Allocation
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  Your share of buyback tokens (burned):
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-green-400">
                    {calculateBuybackShare(predictedBoost, 10000).toFixed(3)}%
                  </span>
                  <span className="text-xs text-gray-500">(estimated*)</span>
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
            ? "bg-gray-700 cursor-not-allowed opacity-50"
            : "bg-gradient-to-r from-primary to-primary-dark hover:scale-[1.02] shadow-glow"
        }`}
      >
        {!isLoading &&
          !(
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
            Locking in progress...
          </span>
        ) : !publicKey ? (
          <span className="relative">Connect Wallet</span>
        ) : (
          <span className="relative flex items-center justify-center gap-2">
            <span>🔒</span>
            <span>{hasExistingNft ? "Update Lock" : "Lock $BACK"}</span>
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
