"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { type Idl, BorshAccountsCoder } from "@coral-xyz/anchor";
import cnftIdl from "@/idl/swapback_cnft.json";
import { getCnftProgramId } from "@/config/constants";

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
      console.debug("[useGlobalState] CNFT program", programId.toBase58());

      const coder = new BorshAccountsCoder(cnftIdl as Idl);

      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        programId
      );
      console.debug("[useGlobalState] GlobalState PDA", globalStatePda.toBase58());

      const accountInfo = await connection.getAccountInfo(globalStatePda);

      if (!accountInfo) {
        console.warn("GlobalState account not found - program may not be initialized");
        setGlobalState(null);
        return;
      }

      console.debug("[useGlobalState] GlobalState size", accountInfo.data.length);

      // Decode the account data
      let decoded;
      try {
        decoded = coder.decode("GlobalState", accountInfo.data);
      } catch (decodeError) {
        console.error("[useGlobalState] Failed to decode GlobalState", decodeError);
        setError(
          decodeError instanceof Error
            ? decodeError
            : new Error("Unable to decode GlobalState")
        );
        return;
      }

      const formatPubkeyField = (fieldName: string, value: unknown): string => {
        try {
          if (!value) {
            console.warn(`[useGlobalState] Missing ${fieldName} in decoded account`);
            return "";
          }

          if (value instanceof PublicKey) {
            return value.toBase58();
          }

          if (typeof value === "string") {
            return value;
          }

          const candidate = value as { toBase58?: () => string; toString?: () => string };
          if (typeof candidate.toBase58 === "function") {
            return candidate.toBase58();
          }

          if (typeof candidate.toString === "function") {
            return candidate.toString();
          }

          console.warn(`[useGlobalState] Unable to format ${fieldName}, unexpected type`, value);
          return "";
        } catch (formatErr) {
          console.error(`[useGlobalState] Failed to format ${fieldName}`, formatErr);
          return "";
        }
      };

      setGlobalState({
        authority: formatPubkeyField("authority", decoded.authority),
        treasuryWallet: formatPubkeyField("treasuryWallet", decoded.treasuryWallet),
        boostVaultWallet: formatPubkeyField("boostVaultWallet", decoded.boostVaultWallet),
        buybackWallet: formatPubkeyField("buybackWallet", decoded.buybackWallet),
        npiVaultWallet: formatPubkeyField("npiVaultWallet", decoded.npiVaultWallet),
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
