"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, type Idl } from "@coral-xyz/anchor";
import cnftIdl from "@/idl/swapback_cnft.json";

interface GlobalStateData {
  authority: string;
  treasuryWallet: string;
  boostVaultWallet: string;
  buybackWallet: string;
  npiVaultWallet: string;
  totalCommunityBoost: number;
  activeLocksCount: number;
  totalValueLocked: number;
  totalSwapVolume: number;
  totalSwapFeesCollected: number;
  swapTreasuryAccrued: number;
  swapBuybackAccrued: number;
  totalNpiVolume: number;
  npiUserDistributed: number;
  npiTreasuryAccrued: number;
  npiBoostVaultAccrued: number;
  npiBoostVaultDistributed: number;
}

function getCnftProgramId(): PublicKey {
  const envVar = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID;
  if (!envVar) {
    throw new Error("NEXT_PUBLIC_CNFT_PROGRAM_ID is not configured");
  }
  return new PublicKey(envVar);
}

const LAMPORTS_PER_BACK = 1_000_000; // 6 decimals

export function useGlobalState() {
  const { connection } = useConnection();
  const [globalState, setGlobalState] = useState<GlobalStateData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchGlobalState = useCallback(async () => {
    if (!connection) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const programId = getCnftProgramId();
      
      // Create a minimal provider for reading accounts
      const provider = new AnchorProvider(
        connection,
        {} as any, // No wallet needed for reading
        { commitment: "confirmed" }
      );

      const program = new Program(cnftIdl as Idl, provider);

      // Inject BorshAccountsCoder if missing
      if (!(program as any)._coder?.accounts) {
        const { BorshAccountsCoder } = await import("@coral-xyz/anchor");
        (program as any)._coder = (program as any)._coder || {};
        (program as any)._coder.accounts = new BorshAccountsCoder(cnftIdl as Idl);
      }

      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        programId
      );

      const accountInfo = await connection.getAccountInfo(globalStatePda);

      if (!accountInfo) {
        console.warn("GlobalState account not found - program may not be initialized");
        setGlobalState(null);
        return;
      }

      // Decode the account data
      const decoded = (program as any).coder.accounts.decode(
        "GlobalState",
        accountInfo.data
      );

      setGlobalState({
        authority: decoded.authority.toString(),
        treasuryWallet: decoded.treasuryWallet.toString(),
        boostVaultWallet: decoded.boostVaultWallet.toString(),
        buybackWallet: decoded.buybackWallet.toString(),
        npiVaultWallet: decoded.npiVaultWallet.toString(),
        totalCommunityBoost: Number(decoded.totalCommunityBoost),
        activeLocksCount: Number(decoded.activeLocksCount),
        totalValueLocked: Number(decoded.totalValueLocked) / LAMPORTS_PER_BACK,
        totalSwapVolume: Number(decoded.totalSwapVolume) / LAMPORTS_PER_BACK,
        totalSwapFeesCollected: Number(decoded.totalSwapFeesCollected) / LAMPORTS_PER_BACK,
        swapTreasuryAccrued: Number(decoded.swapTreasuryAccrued) / LAMPORTS_PER_BACK,
        swapBuybackAccrued: Number(decoded.swapBuybackAccrued) / LAMPORTS_PER_BACK,
        totalNpiVolume: Number(decoded.totalNpiVolume) / LAMPORTS_PER_BACK,
        npiUserDistributed: Number(decoded.npiUserDistributed) / LAMPORTS_PER_BACK,
        npiTreasuryAccrued: Number(decoded.npiTreasuryAccrued) / LAMPORTS_PER_BACK,
        npiBoostVaultAccrued: Number(decoded.npiBoostVaultAccrued) / LAMPORTS_PER_BACK,
        npiBoostVaultDistributed: Number(decoded.npiBoostVaultDistributed) / LAMPORTS_PER_BACK,
      });
    } catch (err) {
      console.error("Error fetching GlobalState:", err);
      setError(err as Error);
      setGlobalState(null);
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchGlobalState();
  }, [fetchGlobalState]);

  const refresh = async () => {
    await fetchGlobalState();
  };

  return {
    globalState,
    isLoading,
    error,
    refresh,
  };
}
