"use client";

import { useMemo } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import routerIdl from "@/idl/swapback_router.json";
import { PROGRAM_IDS } from "@/constants/programIds";

const ROUTER_PROGRAM_ID = PROGRAM_IDS.routerProgram;

const DEFAULT_CONFIG = {
  rebateBps: 7000,
  treasuryBps: 1500,
  boostVaultBps: 1500,
  treasuryFromFeesBps: 8500,
  buyburnFromFeesBps: 1500,
};

export interface RouterConfigView {
  rebateBps: number;
  treasuryBps: number;
  boostVaultBps: number;
  treasuryFromFeesBps: number;
  buyburnFromFeesBps: number;
  updatedAt?: number;
}

function getProgram(connection: ReturnType<typeof useConnection>["connection"]) {
  if (!connection) return null;
  const dummyKeypair = Keypair.generate();
  const provider = new AnchorProvider(
    connection,
    new Wallet(dummyKeypair),
    { commitment: "confirmed" }
  );
  return new Program(routerIdl as Idl, provider);
}

export function useRouterConfig() {
  const { connection } = useConnection();

  const program = useMemo(() => getProgram(connection), [connection]);

  return useQuery<RouterConfigView>({
    queryKey: ["router-config"],
    enabled: Boolean(program),
    queryFn: async () => {
      if (!program) return DEFAULT_CONFIG;

      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_config")],
        ROUTER_PROGRAM_ID
      );

      try {
        const account = await (program.account as any).routerConfig.fetch(configPda);
        return {
          rebateBps: Number(account.rebateBps ?? DEFAULT_CONFIG.rebateBps),
          treasuryBps: Number(account.treasuryBps ?? DEFAULT_CONFIG.treasuryBps),
          boostVaultBps: Number(account.boostVaultBps ?? DEFAULT_CONFIG.boostVaultBps),
          treasuryFromFeesBps: Number(
            account.treasuryFromFeesBps ?? DEFAULT_CONFIG.treasuryFromFeesBps
          ),
          buyburnFromFeesBps: Number(
            account.buyburnFromFeesBps ?? DEFAULT_CONFIG.buyburnFromFeesBps
          ),
          updatedAt: Date.now(),
        };
      } catch (err) {
        console.warn("⚠️ Impossible de fetch router_config, fallback valeurs par défaut", err);
        return DEFAULT_CONFIG;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
