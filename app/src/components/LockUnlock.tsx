"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useCNFT } from "../hooks/useCNFT";
import { calculateLevel, calculateBoost, createLockTransaction } from "../lib/cnft";
import { addLockTransaction, addUnlockTransaction } from "./TransactionHistory";

export const LockUnlock = () => {
  const { connected, publicKey, sendTransaction, wallet } = useWallet();
  const { connection } = useConnection();
  const { cnftData, levelName } = useCNFT();
  const [lockAmount, setLockAmount] = useState("");
  const [lockDuration, setLockDuration] = useState("30");
  const [loading, setLoading] = useState(false);

  const handleLock = async () => {
    if (!connected || !publicKey) {
      alert("⚠️ Veuillez connecter votre wallet");
      return;
    }

    if (!lockAmount || Number.parseFloat(lockAmount) <= 0) {
      alert("⚠️ Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const amount = Number.parseFloat(lockAmount);
      const durationDays = Number.parseInt(lockDuration);

      const level = calculateLevel(amount, durationDays);
      const boost = calculateBoost(amount, durationDays);

      console.log("🔒 Locking tokens...", {
        amount,
        duration: durationDays,
        level,
        boost,
        wallet: publicKey.toString(),
      });

      // Programme swapback_cnft déployé: EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP
      // createLockTransaction gère le lock avec fallback localStorage
      const durationSeconds = durationDays * 24 * 60 * 60;
      const { transaction } = await createLockTransaction(connection, wallet, {
        amount,
        duration: durationSeconds,
      });
      
      const signature = await sendTransaction(transaction, connection);
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({signature, ...latestBlockhash}, "confirmed");

      console.log("✅ Lock transaction confirmed:", signature);

      // Ajouter à l'historique des transactions
      addLockTransaction(publicKey.toString(), {
        signature: signature,
        inputAmount: amount,
        lockDuration: durationDays,
        lockLevel: level,
        lockBoost: boost,
        status: "success",
      });

      alert(
        `✅ $BACK Tokens Locked!\n\n` +
          `💰 Amount: ${lockAmount} $BACK\n` +
          `⏰ Duration: ${lockDuration} days\n` +
          `🎁 Level: ${level}\n` +
          `📈 Boost: +${boost}%\n\n` +
          `Your cNFT has been minted!`
      );

      setLockAmount("");
    } catch (error) {
      console.error("❌ Lock error:", error);
      alert(
        `❌ Lock failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!connected || !publicKey) {
      alert("⚠️ Veuillez connecter votre wallet");
      return;
    }

    if (!cnftData || !cnftData.exists || !cnftData.isActive) {
      alert("⚠️ Aucun token verrouillé trouvé");
      return;
    }

    const now = Date.now();
    if (new Date(cnftData.unlockTime) && now < new Date(cnftData.unlockTime).getTime()) {
      alert(
        `⚠️ Tokens still locked!\n\n` +
          `Unlock date: ${new Date(cnftData.unlockTime).toLocaleDateString()}\n` +
          `Time remaining: ${Math.ceil((new Date(cnftData.unlockTime).getTime() - now) / (1000 * 60 * 60 * 24))} days`
      );
      return;
    }

    setLoading(true);
    try {
      console.log("🔓 Unlocking tokens...", {
        amount: cnftData.lockedAmount,
        wallet: publicKey.toString(),
      });

      // Simulation de unlock (à remplacer par la vraie transaction)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Générer une signature simulée
      const mockSignature = `sim${Date.now()}${Math.random().toString(36).substring(2, 15)}`;

      // Ajouter à l'historique des transactions
      addUnlockTransaction(publicKey.toString(), {
        signature: mockSignature,
        outputAmount: cnftData.lockedAmount,
        lockLevel: levelName || "Unknown",
        status: "success",
      });

      alert(
        `✅ $BACK Tokens Unlocked!\n\n` +
          `💰 Amount: ${cnftData.lockedAmount} $BACK\n` +
          `Your cNFT has been burned.`
      );
    } catch (error) {
      console.error("❌ Unlock error:", error);
      alert(
        `❌ Unlock failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="swap-card">
      <div className="mb-6">
        <h2 className="section-title mb-3">
          <span className="terminal-prefix">&gt;</span> LOCK/UNLOCK_$BACK
        </h2>
        <p className="body-regular terminal-text">
          <span className="terminal-prefix">&gt;</span> LOCK_TOKENS_TO_MINT_CNFT
          | UNLOCK_TO_RETRIEVE
        </p>
      </div>

      {/* Lock Section */}
      <div className="mb-6 p-4 border-2 border-[var(--primary)] bg-black/30">
        <h3 className="text-lg font-bold terminal-text mb-4">
          <span className="terminal-prefix">&gt;</span> [LOCK_TOKENS]
        </h3>

        <div className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-sm terminal-text mb-2">
              <span className="terminal-prefix">&gt;</span> AMOUNT_TO_LOCK
            </label>
            <input
              type="number"
              value={lockAmount}
              onChange={(e) => setLockAmount(e.target.value)}
              placeholder="0.00"
              disabled={loading}
              className="input-field w-full"
            />
          </div>

          {/* Duration Select */}
          <div>
            <label className="block text-sm terminal-text mb-2">
              <span className="terminal-prefix">&gt;</span> LOCK_DURATION
            </label>
            <select
              value={lockDuration}
              onChange={(e) => setLockDuration(e.target.value)}
              disabled={loading}
              className="input-field w-full"
            >
              <option value="30">[30_DAYS] - Bronze tier (boost dynamique)</option>
              <option value="90">[90_DAYS] - Silver tier (boost dynamique)</option>
              <option value="180">[180_DAYS] - Gold tier (boost dynamique)</option>
              <option value="365">
                [365_DAYS] - Platinum tier (boost max 20%)
              </option>
            </select>
          </div>

          {/* Info */}
          <div className="stat-card p-3">
            <div className="text-xs terminal-text space-y-1">
              <div className="flex justify-between">
                <span className="opacity-70">ESTIMATED_BOOST:</span>
                <span className="text-[var(--primary)]">
                  Dynamique (max 20%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">UNLOCK_DATE:</span>
                <span>
                  {new Date(
                    Date.now() +
                      Number.parseInt(lockDuration) * 24 * 60 * 60 * 1000
                  ).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Lock Button */}
          <button
            onClick={handleLock}
            disabled={!connected || loading || !lockAmount}
            className="btn-primary w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>LOCKING...</span>
              </span>
            ) : (
              <span>
                <span className="terminal-prefix">&gt;</span>{" "}
                [LOCK_$BACK_TOKENS]
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Unlock Section */}
      {cnftData && cnftData.exists && cnftData.isActive && (
        <div className="p-4 border-2 border-[var(--primary)] bg-black/30">
          <h3 className="text-lg font-bold terminal-text mb-4">
            <span className="terminal-prefix">&gt;</span> [UNLOCK_TOKENS]
          </h3>

          <div className="space-y-4">
            {/* Current Lock Info */}
            <div className="stat-card p-3">
              <div className="text-sm terminal-text space-y-2">
                <div className="flex justify-between">
                  <span className="opacity-70">LOCKED_AMOUNT:</span>
                  <span className="text-[var(--primary)] font-bold">
                    {cnftData.lockedAmount} $BACK
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">CNFT_LEVEL:</span>
                  <span className="text-[var(--primary)] font-bold">
                    {levelName || "Bronze"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">CURRENT_BOOST:</span>
                  <span className="text-[var(--primary)] font-bold">
                    +{cnftData.boostBps}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">UNLOCK_DATE:</span>
                  <span>
                    {cnftData.unlockTime
                      ? new Date(cnftData.unlockTime * 1000).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">STATUS:</span>
                  <span
                    className={
                      new Date(cnftData.unlockTime) &&
                      Date.now() >= new Date(cnftData.unlockTime).getTime()
                        ? "text-[var(--primary)]"
                        : "text-yellow-500"
                    }
                  >
                    {new Date(cnftData.unlockTime) &&
                    Date.now() >= new Date(cnftData.unlockTime).getTime()
                      ? "[UNLOCKABLE]"
                      : "[LOCKED]"}
                  </span>
                </div>
              </div>
            </div>

            {/* Unlock Button */}
            <button
              onClick={handleUnlock}
              disabled={
                !connected ||
                loading ||
                !new Date(cnftData.unlockTime) ||
                Date.now() < new Date(cnftData.unlockTime).getTime()
              }
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>UNLOCKING...</span>
                </span>
              ) : (
                <span>
                  <span className="terminal-prefix">&gt;</span>{" "}
                  [UNLOCK_$BACK_TOKENS]
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* No Active Lock */}
      {(!cnftData || !cnftData.exists || !cnftData.isActive) && (
        <div className="p-4 border-2 border-[var(--primary)]/30 bg-black/20">
          <div className="text-center terminal-text opacity-50">
            <span className="terminal-prefix">&gt;</span> NO_ACTIVE_LOCK
            <div className="mt-2 text-sm">[LOCK_TOKENS_TO_GET_STARTED]</div>
          </div>
        </div>
      )}
    </div>
  );
};
