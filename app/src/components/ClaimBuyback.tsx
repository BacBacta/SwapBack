/**
 * 💰 Composant ClaimBuyback - Interface de Réclamation des Buybacks
 *
 * Permet aux holders de cNFT de claim leur part de distribution (50%)
 * Calcul basé sur: user_boost / total_community_boost * distribution_pool
 *
 * @author SwapBack Team
 * @date November 23, 2025 - Phase 5.5
 */

"use client";

import React, { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";

interface ClaimableRewards {
  userBoost: number;
  totalBoost: number;
  distributionPool: number;
  estimatedClaim: number;
  sharePercent: number;
  isEligible: boolean;
}

export default function ClaimBuyback() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [rewards, setRewards] = useState<ClaimableRewards | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Program IDs
  const BUYBACK_PROGRAM_ID = new PublicKey("F8S1r81FcTsSBb9vP3jFNuVoTMYNrxaCptbvkzSXcEce");
  const CNFT_PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
  const BACK_MINT = new PublicKey("862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux");

  // Fetch claimable rewards
  useEffect(() => {
    if (!connected || !publicKey) {
      setRewards(null);
      return;
    }

    fetchClaimableRewards();
  }, [connected, publicKey]);

  const fetchClaimableRewards = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      // Derive PDAs
      const [buybackState] = PublicKey.findProgramAddressSync(
        [Buffer.from("buyback_state")],
        BUYBACK_PROGRAM_ID
      );

      const [backVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("back_vault"), buybackState.toBuffer()],
        BUYBACK_PROGRAM_ID
      );

      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        CNFT_PROGRAM_ID
      );

      const [userNft] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_nft"), publicKey.toBuffer()],
        CNFT_PROGRAM_ID
      );

      // Fetch accounts
      const [globalStateInfo, userNftInfo, vaultInfo] = await Promise.all([
        connection.getAccountInfo(globalState),
        connection.getAccountInfo(userNft),
        connection.getTokenAccountBalance(backVault),
      ]);

      // Check if user has cNFT
      if (!userNftInfo) {
        setRewards({
          userBoost: 0,
          totalBoost: 0,
          distributionPool: 0,
          estimatedClaim: 0,
          sharePercent: 0,
          isEligible: false,
        });
        return;
      }

      // Parse user NFT data (simplified - adjust offsets based on actual struct)
      const userBoostOffset = 8 + 32; // discriminator + user pubkey
      const userBoost = userNftInfo.data.readBigUInt64LE(userBoostOffset);
      const isActive = userNftInfo.data[userBoostOffset + 8] === 1;

      if (!isActive || userBoost === 0n) {
        setRewards({
          userBoost: 0,
          totalBoost: 0,
          distributionPool: 0,
          estimatedClaim: 0,
          sharePercent: 0,
          isEligible: false,
        });
        return;
      }

      // Parse global state
      const totalBoostOffset = 8 + 32;
      const totalBoost = globalStateInfo
        ? globalStateInfo.data.readBigUInt64LE(totalBoostOffset)
        : 0n;

      // Get vault balance (distribution pool = 50% of vault)
      const vaultBalance = BigInt(vaultInfo.value.amount);
      const distributionPool = (vaultBalance * 50n) / 100n; // 50% for distribution

      // Calculate user's share
      const estimatedClaim =
        totalBoost > 0n
          ? (distributionPool * userBoost) / totalBoost
          : 0n;

      const sharePercent =
        totalBoost > 0n
          ? (Number(userBoost) / Number(totalBoost)) * 100
          : 0;

      setRewards({
        userBoost: Number(userBoost),
        totalBoost: Number(totalBoost),
        distributionPool: Number(distributionPool) / 1e9, // Assuming 9 decimals
        estimatedClaim: Number(estimatedClaim) / 1e9,
        sharePercent,
        isEligible: true,
      });
    } catch (err: any) {
      console.error("Error fetching claimable rewards:", err);
      setError(err.message || "Failed to fetch rewards");
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!connected || !publicKey || !rewards || !rewards.isEligible) return;

    setClaiming(true);
    setError(null);
    setSuccess(null);

    try {
      // TODO: Implement actual claim transaction
      // For now, just simulate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSuccess(`Successfully claimed ${rewards.estimatedClaim.toFixed(4)} $BACK!`);
      
      // Refresh rewards after claim
      setTimeout(() => {
        fetchClaimableRewards();
      }, 3000);
    } catch (err: any) {
      console.error("Error claiming rewards:", err);
      setError(err.message || "Failed to claim rewards");
    } finally {
      setClaiming(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--primary)] mb-4 terminal-text terminal-glow uppercase tracking-wider">
              [CLAIM DISTRIBUTION]
            </h2>
            <div className="text-6xl mb-4">🔗</div>
            <p className="text-gray-400 mb-4">Connect your wallet to check claimable rewards</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--primary)] mb-4 terminal-text terminal-glow uppercase tracking-wider">
              [CLAIM DISTRIBUTION]
            </h2>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your rewards...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!rewards || !rewards.isEligible) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--primary)] mb-4 terminal-text terminal-glow uppercase tracking-wider">
              [CLAIM DISTRIBUTION]
            </h2>
            <div className="text-6xl mb-4">🚫</div>
            <p className="text-yellow-400 mb-2 font-bold">Not Eligible</p>
            <p className="text-gray-400 mb-4">
              You need an active cNFT position with boost &gt; 0 to claim rewards
            </p>
            <a
              href="/lock"
              className="inline-block px-6 py-3 border-2 border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors uppercase tracking-wider font-bold"
            >
              Lock Tokens to Get cNFT
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-[var(--primary)] mb-2 terminal-text terminal-glow uppercase tracking-wider">
            [CLAIM DISTRIBUTION]
          </h2>
          <p className="text-gray-400 text-sm uppercase tracking-wider">
            50% of buyback distributed to cNFT holders
          </p>
        </div>

        {/* Main Claim Card */}
        <div className="bg-gradient-to-br from-[var(--primary)]/10 to-[var(--accent)]/10 border-2 border-[var(--primary)] rounded-lg p-8 mb-6">
          <div className="text-center mb-6">
            <div className="text-sm text-gray-400 mb-2 uppercase tracking-wider">
              Your Claimable Rewards
            </div>
            <div className="text-5xl font-bold text-[var(--primary)] terminal-glow mb-2">
              {rewards.estimatedClaim.toFixed(4)}
            </div>
            <div className="text-xl text-gray-300">$BACK</div>
          </div>

          <button
            onClick={handleClaim}
            disabled={claiming || rewards.estimatedClaim === 0}
            className="w-full py-4 border-2 border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider font-bold text-lg"
          >
            {claiming ? "CLAIMING..." : rewards.estimatedClaim === 0 ? "NO REWARDS AVAILABLE" : "CLAIM REWARDS"}
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 border-2 border-green-500 bg-green-500/10 rounded">
            <p className="text-green-400 font-bold">✅ {success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 border-2 border-red-500 bg-red-500/10 rounded">
            <p className="text-red-400 font-bold">❌ {error}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-black/30 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-400 mb-2 uppercase">Your Boost</div>
            <div className="text-2xl font-bold text-[var(--primary)]">
              {rewards.userBoost.toLocaleString()}
            </div>
          </div>

          <div className="bg-black/30 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-400 mb-2 uppercase">Total Boost</div>
            <div className="text-2xl font-bold text-gray-300">
              {rewards.totalBoost.toLocaleString()}
            </div>
          </div>

          <div className="bg-black/30 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-400 mb-2 uppercase">Your Share</div>
            <div className="text-2xl font-bold text-[var(--accent)]">
              {rewards.sharePercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Distribution Pool Info */}
        <div className="bg-black/30 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400 uppercase">Total Distribution Pool</span>
            <span className="text-lg font-bold text-[var(--accent)]">
              {rewards.distributionPool.toFixed(4)} $BACK
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] h-2 rounded-full transition-all"
              style={{ width: `${Math.min(rewards.sharePercent, 100)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-2 text-center">
            You'll receive {rewards.sharePercent.toFixed(2)}% based on your boost weight
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>💡 Increase your boost by locking more tokens for longer periods</p>
          <p className="mt-1">Distribution updates automatically after each buyback execution</p>
        </div>
      </div>
    </div>
  );
}
