"use client";

/**
 * SimpleRebatesCard - Interface Rebates simplifiée
 * 
 * Design épuré :
 * - Stats principales en hero
 * - Bouton claim prominent
 * - Historique en section collapsible
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gift, 
  Flame, 
  TrendingUp, 
  Clock, 
  ChevronDown, 
  Loader2,
  Coins,
  ExternalLink,
  CheckCircle
} from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import toast from "react-hot-toast";

interface RebateData {
  unclaimedRebate: number;
  totalClaimed: number;
  totalVolume: number;
  totalSwaps: number;
}

interface ClaimEvent {
  amount: number;
  timestamp: Date;
  txSignature: string;
}

const ROUTER_PROGRAM_ID_STR =
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID ||
  "APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN";

const USDC_MINT_STR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const CLAIM_REWARDS_DISCRIMINATOR = Buffer.from([
  4, 144, 132, 71, 116, 23, 151, 80,
]);

export function SimpleRebatesCard() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [rebateData, setRebateData] = useState<RebateData | null>(null);
  const [claimHistory, setClaimHistory] = useState<ClaimEvent[]>([]);
  const [rebateAccountMissing, setRebateAccountMissing] = useState(false);

  const fetchSeq = useRef(0);

  const routerProgramId = useMemo(
    () => new PublicKey(ROUTER_PROGRAM_ID_STR),
    []
  );

  const usdcMint = useMemo(() => new PublicKey(USDC_MINT_STR), []);

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current;

    if (!connected || !publicKey) {
      console.log('[SimpleRebatesCard] Not connected or no publicKey');
      if (seq === fetchSeq.current) {
        setRebateData(null);
        setLoading(false);
      }
      return;
    }

    console.log('[SimpleRebatesCard] Starting fetchData...');
    console.log('[SimpleRebatesCard] RPC endpoint:', connection.rpcEndpoint);
    console.log('[SimpleRebatesCard] Wallet:', publicKey.toBase58().substring(0, 8) + '...');

    setLoading(true);
    const startTime = Date.now();

    try {
      // Derive UserRebate PDA
      const [userRebatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_rebate"), publicKey.toBuffer()],
        routerProgramId
      );
      console.log('[SimpleRebatesCard] UserRebate PDA:', userRebatePDA.toBase58().substring(0, 8) + '...');

      console.log('[SimpleRebatesCard] Calling getAccountInfo...');
      const accountInfo = await connection.getAccountInfo(userRebatePDA, "confirmed");
      console.log('[SimpleRebatesCard] getAccountInfo completed in', Date.now() - startTime, 'ms');

      if (seq !== fetchSeq.current) {
        return;
      }

      setRebateAccountMissing(!accountInfo);

      if (accountInfo && accountInfo.data.length >= 81) {
        console.log('[SimpleRebatesCard] Account found, parsing data...');
        // Layout: discriminator(8) + user(32) + unclaimed(8) + total_claimed(8) + total_swaps(8) + ...
        const data = accountInfo.data;
        let offset = 8; // Skip discriminator
        offset += 32; // Skip user pubkey

        const unclaimedRebate = Number(data.readBigUInt64LE(offset)) / 1e6; // USDC 6 decimals
        offset += 8;

        const totalClaimed = Number(data.readBigUInt64LE(offset)) / 1e6;
        offset += 8;

        const totalSwaps = Number(data.readBigUInt64LE(offset));
        offset += 8;

        // Estimate volume from rebates (0.1% rebate rate)
        const totalVolume = (unclaimedRebate + totalClaimed) * 1000;

        console.log('[SimpleRebatesCard] Parsed data:', { unclaimedRebate, totalClaimed, totalSwaps, totalVolume });

        setRebateData({
          unclaimedRebate,
          totalClaimed,
          totalVolume,
          totalSwaps,
        });
      } else {
        console.log('[SimpleRebatesCard] No account found or insufficient data length');
        // No account - user has never swapped
        setRebateData({
          unclaimedRebate: 0,
          totalClaimed: 0,
          totalVolume: 0,
          totalSwaps: 0,
        });
      }

      // Fetch claim history from signatures (simplified)
      // In production, use proper indexer
      setClaimHistory([]);
      console.log('[SimpleRebatesCard] fetchData completed successfully in', Date.now() - startTime, 'ms');
    } catch (error: unknown) {
      if (seq !== fetchSeq.current) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';

      console.error('[SimpleRebatesCard] ERROR in fetchData:');
      console.error('[SimpleRebatesCard] Error name:', errorName);
      console.error('[SimpleRebatesCard] Error message:', errorMessage);
      console.error('[SimpleRebatesCard] RPC endpoint:', connection.rpcEndpoint);
      console.error('[SimpleRebatesCard] Time elapsed:', Date.now() - startTime, 'ms');

      // Check for specific error types
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        console.error('[SimpleRebatesCard] ⚠️ RATE LIMITED (429) - RPC is blocking requests');
      }
      if (errorMessage.includes('fetch failed') || errorMessage.includes('network')) {
        console.error('[SimpleRebatesCard] ⚠️ NETWORK ERROR - Check RPC endpoint');
      }

      console.error('[SimpleRebatesCard] Full error:', error);
      setRebateData(null);
    } finally {
      if (seq === fetchSeq.current) {
        setLoading(false);
      }
    }
  }, [connected, publicKey, connection, routerProgramId]);

  // Fetch rebate data from on-chain
  useEffect(() => {
    // Delay initial fetch to avoid burst of requests on page load
    const timeoutId = setTimeout(fetchData, 300);
    
    return () => clearTimeout(timeoutId);
  }, [fetchData]);

  const handleClaim = async () => {
    if (!connected || !publicKey || !signTransaction || !rebateData || rebateData.unclaimedRebate <= 0) {
      return;
    }

    setClaiming(true);
    const toastId = toast.loading("Réclamation en cours...");
    try {
      const { Transaction, TransactionInstruction } = await import("@solana/web3.js");
      const {
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        getAssociatedTokenAddressSync,
        createAssociatedTokenAccountIdempotentInstruction,
      } = await import("@solana/spl-token");

      // PDAs (must match IDL: claim_rewards)
      const [statePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_state")],
        routerProgramId
      );

      const [userRebatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_rebate"), publicKey.toBuffer()],
        routerProgramId
      );

      const [rebateVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("rebate_vault"), statePda.toBuffer()],
        routerProgramId
      );

      const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, publicKey);

      const transaction = new Transaction();

      // Ensure user ATA exists (idempotent)
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          publicKey,
          userUsdcAta,
          publicKey,
          usdcMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      const claimInstruction = new TransactionInstruction({
        programId: routerProgramId,
        keys: [
          { pubkey: statePda, isSigner: false, isWritable: true },
          { pubkey: userRebatePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: userUsdcAta, isSigner: false, isWritable: true },
          { pubkey: rebateVaultPda, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: CLAIM_REWARDS_DISCRIMINATOR,
      });

      transaction.add(claimInstruction);

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signedTx = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
      });

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );

      toast.success(`${rebateData.unclaimedRebate.toFixed(2)} USDC réclamés !`, { id: toastId });
      
      // Update local state
      setRebateData({
        ...rebateData,
        totalClaimed: rebateData.totalClaimed + rebateData.unclaimedRebate,
        unclaimedRebate: 0,
      });

      // Add to history
      setClaimHistory(prev => [
        { amount: rebateData.unclaimedRebate, timestamp: new Date(), txSignature: signature },
        ...prev
      ]);

      // Re-sync with chain (handles partial claims / delayed indexing)
      fetchData();
    } catch (error) {
      console.error("Claim error:", error);
      const message = error instanceof Error ? error.message : "Erreur lors de la réclamation";
      toast.error(message, { id: toastId });
    } finally {
      setClaiming(false);
    }
  };

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(decimals);
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto theme-light">
        <div className="card-simple p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="w-full max-w-lg mx-auto theme-light">
        <div className="card-simple text-center py-12">
          <Gift className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">Connectez votre wallet</p>
          <p className="text-sm text-gray-500">pour voir vos rebates</p>
        </div>
      </div>
    );
  }

  const hasRebates = rebateData && (rebateData.unclaimedRebate > 0 || rebateData.totalClaimed > 0);

  return (
    <div className="w-full max-w-lg mx-auto theme-light">
      <div className="space-y-4">
        
        {/* Hero - Rebates à réclamer */}
        <div className="card-simple">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4">
              <Gift className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-1">
              {rebateData ? formatNumber(rebateData.unclaimedRebate) : "0.00"} USDC
            </h2>
            <p className="text-gray-400">À réclamer</p>
          </div>

          {rebateAccountMissing && (
            <div className="mb-4 rounded-xl bg-white/5 p-4 text-sm text-gray-300">
              <div className="font-medium text-white mb-1">Compte rebates non détecté</div>
              <div className="text-gray-400">
                Le programme ne peut créditer des rebates que si votre compte on-chain <span className="text-gray-300">user_rebate</span> existe.
                Si vos swaps ont été exécutés sans ce compte, les rebates ne peuvent pas apparaître ici.
              </div>
            </div>
          )}

          {/* Bouton Claim */}
          <button
            onClick={handleClaim}
            disabled={claiming || !rebateData || rebateData.unclaimedRebate <= 0}
            className={`
              w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
              ${rebateData && rebateData.unclaimedRebate > 0 
                ? "btn-simple" 
                : "bg-white/5 text-gray-500 cursor-not-allowed"
              }
            `}
          >
            {claiming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Réclamation...
              </>
            ) : rebateData && rebateData.unclaimedRebate > 0 ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Réclamer mes rebates
              </>
            ) : (
              "Aucun rebate à réclamer"
            )}
          </button>
        </div>

        {/* Stats */}
        {hasRebates && (
          <div className="grid grid-cols-3 gap-3">
            <div className="card-simple !p-3 text-center">
              <div className="text-lg font-bold text-white">
                ${formatNumber(rebateData?.totalClaimed || 0)}
              </div>
              <div className="text-xs text-gray-400">Total réclamé</div>
            </div>
            <div className="card-simple !p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">
                {rebateData?.totalSwaps || 0}
              </div>
              <div className="text-xs text-gray-400">Swaps</div>
            </div>
            <div className="card-simple !p-3 text-center">
              <div className="text-lg font-bold text-white">
                ${formatNumber(rebateData?.totalVolume || 0)}
              </div>
              <div className="text-xs text-gray-400">Volume</div>
            </div>
          </div>
        )}

        {/* Comment ça marche */}
        {!hasRebates && (
          <div className="card-simple">
            <h3 className="font-medium text-white mb-4">Comment gagner des rebates ?</h3>
            <div className="space-y-3">
              <Step number={1} text="Effectuez des swaps sur SwapBack" />
              <Step number={2} text="Recevez 70% des frais en cashback" />
              <Step number={3} text="Réclamez vos USDC accumulés" />
            </div>
          </div>
        )}

        {/* Historique (collapsible) */}
        {claimHistory.length > 0 && (
          <div className="card-simple !p-0 overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-white">Historique</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`} />
            </button>
            
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0 border-t border-white/5 space-y-2">
                    {claimHistory.map((event, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-white">
                            +{event.amount.toFixed(2)} USDC
                          </div>
                          <div className="text-xs text-gray-400">
                            {event.timestamp.toLocaleDateString()}
                          </div>
                        </div>
                        <a
                          href={`https://solscan.io/tx/${event.txSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-emerald-400"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 bg-emerald-500/15 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-emerald-400 text-sm font-bold">{number}</span>
      </div>
      <span className="text-gray-300 text-sm">{text}</span>
    </div>
  );
}

export default SimpleRebatesCard;
