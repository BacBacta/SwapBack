import { useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { lamportsToUiSafe, bnToNumberWithFallback } from '@/lib/bnUtils';
import { TOKEN_DECIMALS, DEFAULT_BACK_MINT } from '@/config/constants';

// Buyback Program addresses - use safe defaults
const BUYBACK_PROGRAM_ID_STR = process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || '746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6';
const USDC_MINT_STR = process.env.NEXT_PUBLIC_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BACK_MINT_STR = process.env.NEXT_PUBLIC_BACK_MINT || DEFAULT_BACK_MINT;

// Lazy-loaded PublicKeys to avoid SSR issues
let _buybackProgramId: PublicKey | null = null;
let _buybackStatePda: PublicKey | null = null;
let _usdcVaultPda: PublicKey | null = null;
let _usdcMint: PublicKey | null = null;
let _backTokenMint: PublicKey | null = null;

export function getBuybackProgramId(): PublicKey {
  if (!_buybackProgramId) {
    _buybackProgramId = new PublicKey(BUYBACK_PROGRAM_ID_STR);
  }
  return _buybackProgramId;
}

export function getBuybackStatePda(): PublicKey {
  if (!_buybackStatePda) {
    [_buybackStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('buyback_state')],
      getBuybackProgramId()
    );
  }
  return _buybackStatePda;
}

export function getUsdcVaultPda(): PublicKey {
  if (!_usdcVaultPda) {
    [_usdcVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('usdc_vault')],
      getBuybackProgramId()
    );
  }
  return _usdcVaultPda;
}

export function getUsdcMint(): PublicKey {
  if (!_usdcMint) {
    _usdcMint = new PublicKey(USDC_MINT_STR);
  }
  return _usdcMint;
}

export function getBackMint(): PublicKey {
  if (!_backTokenMint) {
    _backTokenMint = new PublicKey(BACK_MINT_STR);
  }
  return _backTokenMint;
}

// DO NOT use module-level PublicKey constants - they cause SSR errors
// Use the getter functions instead: getBuybackProgramId(), getUsdcMint(), getBackMint(), etc.

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

  // Get PDAs lazily to avoid SSR issues
  const buybackStatePda = getBuybackStatePda();
  const usdcVaultPda = getUsdcVaultPda();

  // Fetch buyback state account data
  const { data: buybackState, isLoading: isLoadingState, error: stateError } = useQuery({
    queryKey: ['buyback-state', buybackStatePda.toBase58()],
    queryFn: async (): Promise<Omit<BuybackState, 'vaultBalance' | 'canExecute' | 'progressPercent'>> => {
      const accountInfo = await connection.getAccountInfo(buybackStatePda);
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
    queryKey: ['vault-balance', usdcVaultPda.toBase58()],
    queryFn: async (): Promise<number> => {
      try {
        const balance = await connection.getTokenAccountBalance(usdcVaultPda);
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
