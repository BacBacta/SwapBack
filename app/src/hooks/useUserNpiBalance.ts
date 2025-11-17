"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import cnftIdl from "@/idl/swapback_cnft.json";
import { getNpiMint } from "@/lib/lockTokens";

const LAMPORTS_PER_NPI = 1_000_000_000; // NPI SLP 9 decimals

interface UserNpiBalanceState {
  pendingNpi: number;
  totalClaimed: number;
  hasBalance: boolean;
  pda: PublicKey | null;
}

function getCnftProgramId(): PublicKey {
  const envVar = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID;
  if (!envVar) {
    throw new Error("NEXT_PUBLIC_CNFT_PROGRAM_ID missing");
  }
  return new PublicKey(envVar);
}

export function useUserNpiBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [state, setState] = useState<UserNpiBalanceState>({
    pendingNpi: 0,
    totalClaimed: 0,
    hasBalance: false,
    pda: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const programId = useMemo(() => {
    try {
      return getCnftProgramId();
    } catch (err) {
      console.error("CNFT program id missing", err);
      return null;
    }
  }, []);

  const coder = useMemo(() => new BorshAccountsCoder(cnftIdl as Idl), []);

  const fetchBalance = useCallback(async () => {
    if (!connection || !publicKey || !programId) {
      setState((prev) => ({ ...prev, hasBalance: false, pendingNpi: 0 }));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_npi_balance"), publicKey.toBuffer()],
        programId
      );

      const accountInfo = await connection.getAccountInfo(pda, "confirmed");

      if (!accountInfo) {
        setState({ pendingNpi: 0, totalClaimed: 0, hasBalance: false, pda });
        return;
      }

      const decoded = coder.decode("UserNpiBalance", accountInfo.data);

      setState({
        pendingNpi: Number(decoded.pendingNpi) / LAMPORTS_PER_NPI,
        totalClaimed: Number(decoded.totalClaimed) / LAMPORTS_PER_NPI,
        hasBalance: decoded.pendingNpi > 0,
        pda,
      });
    } catch (err) {
      console.error("Failed to fetch user NPI balance", err);
      setError(err as Error);
      setState((prev) => ({ ...prev, hasBalance: false }));
    } finally {
      setIsLoading(false);
    }
  }, [connection, publicKey, programId, coder]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    ...state,
    isLoading,
    error,
    refresh: fetchBalance,
    npiMint: getNpiMint(),
  };
}