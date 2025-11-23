"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { type Idl, BorshAccountsCoder, BN } from "@coral-xyz/anchor";
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
  totalPenaltiesCollected: number;
}

const LAMPORTS_PER_BACK = 1_000_000_000; // 9 decimals (Token-2022)
const LAMPORTS_PER_BACK_BN = new BN(LAMPORTS_PER_BACK);
const MAX_SAFE_BN = new BN(Number.MAX_SAFE_INTEGER);

const toBN = (value: unknown, fieldName: string): BN => {
  try {
    if (!value) {
      return new BN(0);
    }

    if (BN.isBN(value)) {
      return value as BN;
    }

    if (typeof value === "bigint") {
      return new BN(value.toString());
    }

    if (typeof value === "number") {
      return new BN(value);
    }

    if (typeof value === "string" && value.length > 0) {
      return new BN(value);
    }

    const candidate = value as { toString?: () => string };
    if (typeof candidate?.toString === "function") {
      const stringValue = candidate.toString();
      if (stringValue) {
        return new BN(stringValue);
      }
    }

    console.warn(`[useGlobalState] Unable to parse BN for ${fieldName}`, value);
    return new BN(0);
  } catch (conversionError) {
    console.error(`[useGlobalState] Failed to convert ${fieldName} to BN`, conversionError);
    return new BN(0);
  }
};

const toSafeNumber = (bnValue: BN, fieldName: string): number => {
  if (bnValue.gt(MAX_SAFE_BN)) {
    console.warn(`[useGlobalState] ${fieldName} exceeds JS number range, clamping`, {
      value: bnValue.toString(),
    });
    return Number.MAX_SAFE_INTEGER;
  }

  return bnValue.toNumber();
};

const decodeCounterField = (value: unknown, fieldName: string): number => {
  return toSafeNumber(toBN(value, fieldName), fieldName);
};

const decodeLamportsField = (value: unknown, fieldName: string): number => {
  const bnValue = toBN(value, fieldName);
  const whole = bnValue.div(LAMPORTS_PER_BACK_BN);
  const remainder = bnValue.mod(LAMPORTS_PER_BACK_BN);

  const safeWhole = toSafeNumber(whole, `${fieldName}.whole`);
  const fractional = remainder.toNumber() / LAMPORTS_PER_BACK;

  return safeWhole + fractional;
};

const toSnakeCase = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
};

const getDecodedField = (
  decoded: Record<string, unknown>,
  fieldName: string
): unknown => {
  if (fieldName in decoded) {
    return decoded[fieldName];
  }

  const snakeKey = toSnakeCase(fieldName);
  if (snakeKey in decoded) {
    return decoded[snakeKey];
  }

  return undefined;
};

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

      const decodedRecord = decoded as Record<string, unknown>;

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
        authority: formatPubkeyField(
          "authority",
          getDecodedField(decodedRecord, "authority")
        ),
        treasuryWallet: formatPubkeyField(
          "treasuryWallet",
          getDecodedField(decodedRecord, "treasuryWallet")
        ),
        boostVaultWallet: formatPubkeyField(
          "boostVaultWallet",
          getDecodedField(decodedRecord, "boostVaultWallet")
        ),
        buybackWallet: formatPubkeyField(
          "buybackWallet",
          getDecodedField(decodedRecord, "buybackWallet")
        ),
        npiVaultWallet: formatPubkeyField(
          "npiVaultWallet",
          getDecodedField(decodedRecord, "npiVaultWallet")
        ),
        totalCommunityBoost: decodeCounterField(
          getDecodedField(decodedRecord, "totalCommunityBoost"),
          "totalCommunityBoost"
        ),
        activeLocksCount: decodeCounterField(
          getDecodedField(decodedRecord, "activeLocksCount"),
          "activeLocksCount"
        ),
        totalValueLocked: decodeLamportsField(
          getDecodedField(decodedRecord, "totalValueLocked"),
          "totalValueLocked"
        ),
        totalSwapVolume: decodeLamportsField(
          getDecodedField(decodedRecord, "totalSwapVolume"),
          "totalSwapVolume"
        ),
        totalSwapFeesCollected: decodeLamportsField(
          decoded.totalSwapFeesCollected,
          "totalSwapFeesCollected"
        ),
        swapTreasuryAccrued: decodeLamportsField(
          getDecodedField(decodedRecord, "swapTreasuryAccrued"),
          "swapTreasuryAccrued"
        ),
        swapBuybackAccrued: decodeLamportsField(
          getDecodedField(decodedRecord, "swapBuybackAccrued"),
          "swapBuybackAccrued"
        ),
        totalNpiVolume: decodeLamportsField(
          getDecodedField(decodedRecord, "totalNpiVolume"),
          "totalNpiVolume"
        ),
        npiUserDistributed: decodeLamportsField(
          getDecodedField(decodedRecord, "npiUserDistributed"),
          "npiUserDistributed"
        ),
        npiTreasuryAccrued: decodeLamportsField(
          getDecodedField(decodedRecord, "npiTreasuryAccrued"),
          "npiTreasuryAccrued"
        ),
        npiBoostVaultAccrued: decodeLamportsField(
          getDecodedField(decodedRecord, "npiBoostVaultAccrued"),
          "npiBoostVaultAccrued"
        ),
        npiBoostVaultDistributed: decodeLamportsField(
          getDecodedField(decodedRecord, "npiBoostVaultDistributed"),
          "npiBoostVaultDistributed"
        ),
        totalPenaltiesCollected: decodeLamportsField(
          getDecodedField(decodedRecord, "totalPenaltiesCollected") ?? 0,
          "totalPenaltiesCollected"
        ),
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
