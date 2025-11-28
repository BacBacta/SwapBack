"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  GiftIcon,
  FireIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

// Program IDs as strings to avoid SSR/prerender issues
const ROUTER_PROGRAM_ID_STR = "7F9qGZPvbTDbF5cfJ2X4Y9NRvumwGKPW7JsX1hTfgUDj";
const CNFT_PROGRAM_ID_STR = "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP";

interface UserRebateData {
  user: string;
  unclaimedRebate: number;
  totalClaimed: number;
  totalSwaps: number;
  totalVolume: number;
  lastSwapTimestamp: number;
  lastClaimTimestamp: number;
}

interface UserBurnData {
  totalBurned: number;
  burnEvents: {
    amount: number;
    timestamp: number;
    txSignature: string;
  }[];
}

interface ClaimHistory {
  amount: number;
  timestamp: number;
  txSignature: string;
}

export default function MyRebatesPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [rebateData, setRebateData] = useState<UserRebateData | null>(null);
  const [burnData, setBurnData] = useState<UserBurnData | null>(null);
  const [claimHistory, setClaimHistory] = useState<ClaimHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create PublicKeys inside component using useMemo to avoid SSR issues
  const ROUTER_PROGRAM_ID = useMemo(() => {
    try {
      return new PublicKey(ROUTER_PROGRAM_ID_STR);
    } catch {
      return null;
    }
  }, []);

  // Fetch user rebate data from on-chain
  const fetchUserRebateData = useCallback(async () => {
    if (!publicKey || !ROUTER_PROGRAM_ID) {
      setRebateData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Derive UserRebate PDA
      const [userRebatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_rebate"), publicKey.toBuffer()],
        ROUTER_PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(userRebatePDA);

      if (accountInfo && accountInfo.data.length >= 80) {
        // Parse UserRebate account data
        const data = accountInfo.data;
        let offset = 8; // Skip discriminator

        const user = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        const unclaimedRebate = Number(data.readBigUInt64LE(offset)) / 1e6;
        offset += 8;

        const totalClaimed = Number(data.readBigUInt64LE(offset)) / 1e6;
        offset += 8;

        const totalSwaps = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const lastSwapTimestamp = Number(data.readBigInt64LE(offset));
        offset += 8;

        const lastClaimTimestamp = Number(data.readBigInt64LE(offset));

        const estimatedVolume = (unclaimedRebate + totalClaimed) * 1000;

        setRebateData({
          user: user.toString(),
          unclaimedRebate,
          totalClaimed,
          totalSwaps,
          totalVolume: estimatedVolume,
          lastSwapTimestamp,
          lastClaimTimestamp,
        });
      } else {
        setRebateData({
          user: publicKey.toString(),
          unclaimedRebate: 0,
          totalClaimed: 0,
          totalSwaps: 0,
          totalVolume: 0,
          lastSwapTimestamp: 0,
          lastClaimTimestamp: 0,
        });
      }

      await fetchBurnData();

    } catch (err) {
      console.error("Error fetching rebate data:", err);
      setRebateData({
        user: publicKey?.toString() || "",
        unclaimedRebate: 0,
        totalClaimed: 0,
        totalSwaps: 0,
        totalVolume: 0,
        lastSwapTimestamp: 0,
        lastClaimTimestamp: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connection, ROUTER_PROGRAM_ID]);

  // Fetch burn data (early unlock penalties)
  const fetchBurnData = useCallback(async () => {
    if (!publicKey) return;

    try {
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 50 });
      
      let totalBurned = 0;
      const burnEvents: { amount: number; timestamp: number; txSignature: string }[] = [];

      for (const sig of signatures.slice(0, 20)) {
        try {
          const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (tx?.meta?.logMessages) {
            const burnLog = tx.meta.logMessages.find(
              (log) => log.includes("early_unlock") || log.includes("penalty") || log.includes("burned")
            );
            if (burnLog) {
              const match = burnLog.match(/(\d+)/);
              if (match) {
                const amount = parseInt(match[1]) / 1e9;
                if (amount > 0 && amount < 1e9) {
                  totalBurned += amount;
                  burnEvents.push({
                    amount,
                    timestamp: sig.blockTime || 0,
                    txSignature: sig.signature,
                  });
                }
              }
            }
          }
        } catch {
          // Skip failed transaction parses
        }
      }

      setBurnData({ totalBurned, burnEvents });
    } catch (err) {
      console.error("Error fetching burn data:", err);
      setBurnData({ totalBurned: 0, burnEvents: [] });
    }
  }, [publicKey, connection]);

  // Claim rebates
  const handleClaimRebates = async () => {
    if (!publicKey || !signTransaction || !rebateData || rebateData.unclaimedRebate <= 0 || !ROUTER_PROGRAM_ID) {
      return;
    }

    setIsClaiming(true);

    try {
      const [userRebatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_rebate"), publicKey.toBuffer()],
        ROUTER_PROGRAM_ID
      );

      const [rebateVaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("rebate_vault")],
        ROUTER_PROGRAM_ID
      );

      const discriminator = Buffer.from([0x9d, 0x12, 0x8f, 0x5e, 0x2a, 0x7c, 0x3b, 0x4d]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userRebatePDA, isSigner: false, isWritable: true },
          { pubkey: rebateVaultPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
        ],
        programId: ROUTER_PROGRAM_ID,
        data: discriminator,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signedTx = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      await connection.confirmTransaction(signature, "confirmed");

      toast.success(`Successfully claimed ${rebateData.unclaimedRebate.toFixed(2)} USDC!`);

      setClaimHistory(prev => [{
        amount: rebateData.unclaimedRebate,
        timestamp: Date.now() / 1000,
        txSignature: signature,
      }, ...prev]);

      await fetchUserRebateData();

    } catch (err) {
      console.error("Error claiming rebates:", err);
      toast.error("Failed to claim rebates. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

  useEffect(() => {
    fetchUserRebateData();
  }, [fetchUserRebateData]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Never";
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (!publicKey) {
    return (
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-2xl p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center">
            <GiftIcon className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400">
            Connect your wallet to view your rebates, trading volume, and claim history.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <GiftIcon className="w-8 h-8 text-emerald-400" />
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            My Rebates
          </h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base">
          Track your rewards, volume, and burned tokens
        </p>
      </motion.div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500"></div>
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3"
        >
          <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
          <p className="text-red-300">{error}</p>
        </motion.div>
      )}

      {!isLoading && rebateData && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Unclaimed Rebates */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <SparklesIcon className="w-5 h-5 text-emerald-400" />
                <span className="text-gray-400 text-sm">Unclaimed Rebates</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {formatUSD(rebateData.unclaimedRebate)}
              </p>
              {rebateData.unclaimedRebate > 0 && (
                <p className="text-xs text-emerald-300/70 mt-1">Available to claim</p>
              )}
            </motion.div>

            {/* Total Claimed */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-cyan-400" />
                <span className="text-gray-400 text-sm">Total Claimed</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatUSD(rebateData.totalClaimed)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Lifetime earnings</p>
            </motion.div>

            {/* Trading Volume */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <ChartBarIcon className="w-5 h-5 text-blue-400" />
                <span className="text-gray-400 text-sm">Trading Volume</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatUSD(rebateData.totalVolume)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{rebateData.totalSwaps} swaps</p>
            </motion.div>

            {/* Tokens Burned */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <FireIcon className="w-5 h-5 text-orange-400" />
                <span className="text-gray-400 text-sm">Tokens Burned</span>
              </div>
              <p className="text-2xl font-bold text-orange-400">
                {burnData?.totalBurned.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "0"} BACK
              </p>
              <p className="text-xs text-orange-300/70 mt-1">From early unlocks</p>
            </motion.div>
          </div>

          {/* Claim Button */}
          {rebateData.unclaimedRebate > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-gray-900 to-gray-950 border border-emerald-500/30 rounded-xl p-6"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Claim Your Rebates</h3>
                  <p className="text-gray-400 text-sm">
                    You have {formatUSD(rebateData.unclaimedRebate)} in unclaimed rebates
                  </p>
                </div>
                <button
                  onClick={handleClaimRebates}
                  disabled={isClaiming}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {isClaiming ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      <span>Claiming...</span>
                    </>
                  ) : (
                    <>
                      <BanknotesIcon className="w-5 h-5" />
                      <span>Claim {formatUSD(rebateData.unclaimedRebate)}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Activity Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-bold text-white">Activity</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                    <ArrowTrendingUpIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Last Swap</p>
                    <p className="text-gray-500 text-sm">Trading activity</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  {formatDate(rebateData.lastSwapTimestamp)}
                </p>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <GiftIcon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Last Claim</p>
                    <p className="text-gray-500 text-sm">Rebate collection</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  {formatDate(rebateData.lastClaimTimestamp)}
                </p>
              </div>

              {burnData && burnData.burnEvents.length > 0 && (
                <div className="pt-2">
                  <p className="text-gray-400 text-sm mb-3">Recent Burns (Early Unlock Penalties)</p>
                  <div className="space-y-2">
                    {burnData.burnEvents.slice(0, 5).map((event) => (
                      <div
                        key={event.txSignature}
                        className="flex items-center justify-between py-2 px-3 bg-orange-500/5 border border-orange-500/20 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <FireIcon className="w-4 h-4 text-orange-400" />
                          <span className="text-orange-300 font-medium">
                            -{event.amount.toFixed(2)} BACK
                          </span>
                        </div>
                        <a
                          href={`https://explorer.solana.com/tx/${event.txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 text-xs hover:text-emerald-400 transition-colors"
                        >
                          {formatDate(event.timestamp)}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Claim History */}
          {claimHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-xl p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Claim History</h3>
              </div>

              <div className="space-y-2">
                {claimHistory.map((claim) => (
                  <div
                    key={claim.txSignature}
                    className="flex items-center justify-between py-3 px-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        <BanknotesIcon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-emerald-400 font-bold">
                        +{formatUSD(claim.amount)}
                      </span>
                    </div>
                    <a
                      href={`https://explorer.solana.com/tx/${claim.txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 text-sm hover:text-emerald-400 transition-colors"
                    >
                      {formatDate(claim.timestamp)} →
                    </a>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Refresh Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="flex justify-center"
          >
            <button
              onClick={fetchUserRebateData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </motion.div>
        </>
      )}

      {/* Empty State */}
      {!isLoading && rebateData && rebateData.totalSwaps === 0 && rebateData.unclaimedRebate === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-xl p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center">
            <ArrowTrendingUpIcon className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Activity Yet</h2>
          <p className="text-gray-400 mb-4">
            Start trading on SwapBack to earn rebates and rewards!
          </p>
          <a
            href="/app/swap"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-cyan-600 transition-all"
          >
            Start Trading
          </a>
        </motion.div>
      )}
    </div>
  );
}
