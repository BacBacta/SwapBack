import { useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { lamportsToUiSafe, bnToNumberWithFallback } from '@/lib/bnUtils';
import { getBackTokenMint, TOKEN_DECIMALS } from '@/config/constants';

// Buyback Program addresses (devnet)
export const BUYBACK_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || '746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6'
);
export const [BUYBACK_STATE_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('buyback_state')],
  BUYBACK_PROGRAM_ID
);
export const [USDC_VAULT_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('usdc_vault')],
  BUYBACK_PROGRAM_ID
);
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT || 'BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR'
);
export const BACK_TOKEN_MINT = getBackTokenMint();

export interface BuybackState {
  authority: PublicKey;
  backMint: PublicKey;
  usdcVault: PublicKey;
  minBuybackAmount: number; // USDC (decimal)
  totalUsdcSpent: number; // USDC (decimal)
  totalBackBurned: number; // BACK (decimal)
  buybackCount: number;
  bump: number;
  vaultBalance?: number; // Current vault balance (USDC)
  canExecute?: boolean; // True if vault >= threshold
  progressPercent?: number; // Progress toward threshold (0-100)
}

/**
 * Hook to read buyback state from on-chain account
 * Refreshes every 10 seconds
 */
export function useBuybackState() {
  const { connection } = useConnection();

  // Fetch buyback state account data
  const { data: buybackState, isLoading: isLoadingState, error: stateError } = useQuery({
    queryKey: ['buyback-state', BUYBACK_STATE_PDA.toBase58()],
    queryFn: async (): Promise<Omit<BuybackState, 'vaultBalance' | 'canExecute' | 'progressPercent'>> => {
      const accountInfo = await connection.getAccountInfo(BUYBACK_STATE_PDA);
      if (!accountInfo) {
        throw new Error('Buyback state account not found');
      }

      const data = accountInfo.data;
      const minLength = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
      if (data.length < minLength) {
        throw new Error(`Invalid buyback state data: expected ${minLength} bytes, got ${data.length}`);
      }

      const readU64ToBN = (offset: number) => {
        if (offset + 8 > data.length) {
          throw new Error(`Invalid buffer read at offset ${offset}`);
        }
        return new BN(data.readBigUInt64LE(offset).toString());
      };

      return {
        authority: new PublicKey(data.slice(8, 40)),
        backMint: new PublicKey(data.slice(40, 72)),
        usdcVault: new PublicKey(data.slice(72, 104)),
        minBuybackAmount: lamportsToUiSafe(readU64ToBN(104), 6),
        totalUsdcSpent: lamportsToUiSafe(readU64ToBN(112), 6),
        totalBackBurned: lamportsToUiSafe(readU64ToBN(120), TOKEN_DECIMALS),
        buybackCount: bnToNumberWithFallback(readU64ToBN(128), 0),
        bump: data[136],
      };
    },
    refetchInterval: 10_000, // Refresh every 10s
    staleTime: 5_000,
  });

  // Fetch USDC vault balance separately
  const { data: vaultBalance, isLoading: isLoadingVault } = useQuery({
    queryKey: ['vault-balance', USDC_VAULT_PDA.toBase58()],
    queryFn: async (): Promise<number> => {
      try {
        const balance = await connection.getTokenAccountBalance(USDC_VAULT_PDA);
        return balance.value.uiAmount || 0;
      } catch (error) {
        console.error('Error fetching vault balance:', error);
        return 0;
      }
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  // Combine data and calculate derived values
  const combinedState: BuybackState | null = buybackState
    ? {
        ...buybackState,
        vaultBalance: vaultBalance || 0,
        canExecute: (vaultBalance || 0) >= buybackState.minBuybackAmount,
        progressPercent: Math.min(
          ((vaultBalance || 0) / buybackState.minBuybackAmount) * 100,
          100
        ),
      }
    : null;

  return {
    buybackState: combinedState,
    isLoading: isLoadingState || isLoadingVault,
    error: stateError,
    refetch: () => {
      // Trigger manual refetch if needed
    },
  };
}
