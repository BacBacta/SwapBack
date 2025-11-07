import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnchorProvider, Program, BN, Wallet, Idl } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { toast } from 'react-hot-toast';
import { trackBuyback } from '@/lib/analytics';
import { parseBuybackTransaction } from '@/lib/parsers';
import { getExplorerTxUrl } from '@/utils/explorer';

import {
  BUYBACK_STATE_PDA,
  USDC_VAULT_PDA,
  BACK_TOKEN_MINT,
} from './useBuybackState';

interface ExecuteBuybackParams {
  usdcAmount: number; // Amount in USDC (e.g., 5 for 5 USDC)
  minBackAmount?: number; // Minimum BACK tokens expected (slippage protection)
}

/**
 * Load the Buyback program IDL
 * Loads from src/idl folder (bundled with app)
 */
let cachedBuybackIdl: Idl | null = null;

async function loadBuybackIdl(): Promise<Idl> {
  // Return cached IDL if available
  if (cachedBuybackIdl) {
    return cachedBuybackIdl;
  }

  try {
    // Load IDL from bundled source (works in browser)
    const idl = await import('@/idl/swapback_buyback.json');
    cachedBuybackIdl = idl.default as Idl;
    return cachedBuybackIdl;
  } catch (error) {
    console.error('Error loading Buyback IDL:', error);
    throw new Error('Buyback IDL not found. Please ensure swapback_buyback.json is in /src/idl/');
  }
}

/**
 * Hook to execute a buyback transaction
 * Burns USDC from vault and receives $BACK tokens
 */
export function useExecuteBuyback() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ usdcAmount, minBackAmount = 0 }: ExecuteBuybackParams) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      // Load buyback program IDL
      const idl = await loadBuybackIdl();

      // Create Anchor provider
      const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'confirmed' }
      );

      // Initialize program
      const program = new Program(idl, provider);

      // Get user's $BACK token account
      const userBackAccount = await getAssociatedTokenAddress(
        BACK_TOKEN_MINT,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      // Convert amounts to BN (lamports)
      const usdcAmountBN = new BN(usdcAmount * 1e6);
      const minBackAmountBN = new BN(minBackAmount * 1e9);

      console.log('🔥 Executing buyback:', {
        usdcAmount,
        minBackAmount,
        userBackAccount: userBackAccount.toBase58(),
      });

      // Execute buyback transaction
      interface BuybackMethods {
        executeBuyback: (usdcAmount: BN, minBackAmount: BN) => {
          accounts: (accounts: Record<string, unknown>) => {
            rpc: () => Promise<string>;
          };
        };
      }
      
      const signature = await (program.methods as unknown as BuybackMethods)
        .executeBuyback(usdcAmountBN, minBackAmountBN)
        .accounts({
          buybackState: BUYBACK_STATE_PDA,
          usdcVault: USDC_VAULT_PDA,
          backMint: BACK_TOKEN_MINT,
          userBackAccount,
          executor: wallet.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      console.log('✅ Buyback executed:', signature);

      // Fetch transaction to parse logs and get actual BACK burned amount
      let backBurned = 0;
      try {
        const tx = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
        
        if (tx && tx.meta && tx.meta.logMessages) {
          const parsed = parseBuybackTransaction(tx.meta.logMessages);
          if (parsed.success) {
            backBurned = parsed.backBurned;
            console.log(`🔥 Parsed from logs: ${backBurned} BACK burned`);
          }
        }
      } catch (logError) {
        console.warn('Could not parse transaction logs:', logError);
        // Continue with default value
      }

      // Track buyback analytics with actual values
      trackBuyback({
        usdcAmount: usdcAmountBN.toNumber(),
        backBurned, // ✅ Real value parsed from logs
        executor: wallet.publicKey.toString(),
        signature,
      });

      return {
        signature,
        usdcAmount,
        backBurned, // Include in return value
        explorerUrl: getExplorerTxUrl(signature),
      };
    },
    onSuccess: (data: { signature: string; usdcAmount: number; backBurned: number; explorerUrl: string }) => {
      const burnedText = data.backBurned > 0 
        ? ` • 🔥 ${data.backBurned.toLocaleString()} BACK burned` 
        : '';
      
      toast.success(
        `Buyback executed! ${data.usdcAmount} USDC used${burnedText}`,
        { duration: 5000 }
      );

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['buyback-state'] });
      queryClient.invalidateQueries({ queryKey: ['vault-balance'] });
    },
    onError: (error: Error) => {
      console.error('❌ Buyback execution failed:', error);
      toast.error(`Buyback failed: ${error.message.slice(0, 100)}`, { duration: 5000 });
    },
  });

  return {
    executeBuyback: mutation.mutate,
    executeBuybackAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
  };
}
