import { useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Buyback Program addresses (devnet)
export const BUYBACK_PROGRAM_ID = new PublicKey('92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir');
export const BUYBACK_STATE_PDA = new PublicKey('74N3kmNZiRSJCFaYBFjmiQGMwv8vx3aJvMMKJECLNUNM');
export const USDC_VAULT_PDA = new PublicKey('HiBn2KFwVUDuW9z1aiYcR1jVyBjSMirqzSQ7vpaLQKDT');
export const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
export const BACK_TOKEN_MINT = new PublicKey('3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE');

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

      // Parse BuybackState struct (offsets validated from lib.rs)
      // 8 bytes: discriminator
      // 32 bytes: authority (8-40)
      // 32 bytes: back_mint (40-72)
      // 32 bytes: usdc_vault (72-104)
      // 8 bytes: min_buyback_amount (104-112)
      // 8 bytes: total_usdc_spent (112-120)
      // 8 bytes: total_back_burned (120-128)
      // 8 bytes: buyback_count (128-136)
      // 1 byte: bump (136-137)

      return {
        authority: new PublicKey(data.slice(8, 40)),
        backMint: new PublicKey(data.slice(40, 72)),
        usdcVault: new PublicKey(data.slice(72, 104)),
        // Safe conversion: divide in BN first, then convert smaller values
        minBuybackAmount: (() => {
          const bn = new BN(data.slice(104, 112), 'le');
          return bn.div(new BN(1e6)).toNumber() + (bn.mod(new BN(1e6)).toNumber() / 1e6);
        })(),
        totalUsdcSpent: (() => {
          const bn = new BN(data.slice(112, 120), 'le');
          return bn.div(new BN(1e6)).toNumber() + (bn.mod(new BN(1e6)).toNumber() / 1e6);
        })(),
        totalBackBurned: (() => {
          const bn = new BN(data.slice(120, 128), 'le');
          return bn.div(new BN(1e9)).toNumber() + (bn.mod(new BN(1e9)).toNumber() / 1e9);
        })(),
        // buybackCount safe: counter will never exceed MAX_SAFE_INTEGER
        buybackCount: new BN(data.slice(128, 136), 'le').toNumber(),
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
