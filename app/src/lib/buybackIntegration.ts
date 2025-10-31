import { Connection } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { depositUsdc } from '@swapback/sdk/src/buyback';

const MIN_DEPOSIT_AMOUNT = 1_000_000; // 1 USDC minimum

export interface BuybackDepositResult {
  signature?: string;
  amount: number; // USDC amount deposited (lamports)
  skipped: boolean;
  reason?: string;
}

/**
 * Deposit USDC fees to buyback vault
 * Non-blocking: errors won't fail the swap transaction
 * @param connection Solana connection
 * @param wallet User wallet
 * @param feeAmount Total fee amount in USDC lamports
 * @returns Deposit result
 */
export async function depositToBuybackVault(
  connection: Connection,
  wallet: WalletContextState,
  feeAmount: number
): Promise<BuybackDepositResult> {
  // Calculate 25% of fees
  const depositAmount = Math.floor(feeAmount * 0.25);

  // Skip if amount too small
  if (depositAmount < MIN_DEPOSIT_AMOUNT) {
    console.log(`⏭️  Buyback deposit skipped: ${depositAmount} < ${MIN_DEPOSIT_AMOUNT} lamports`);
    return {
      skipped: true,
      amount: depositAmount,
      reason: `Amount too small (${(depositAmount / 1e6).toFixed(2)} USDC < 1 USDC)`,
    };
  }

  if (!wallet.publicKey || !wallet.signTransaction) {
    return {
      skipped: true,
      amount: depositAmount,
      reason: 'Wallet not connected',
    };
  }

  try {
    console.log(`💰 Depositing ${(depositAmount / 1e6).toFixed(2)} USDC to buyback vault...`);
    
    // Use real Anchor SDK function
    const signature = await depositUsdc(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
      },
      depositAmount
    );

    console.log(`✅ Buyback deposit successful: ${signature}`);

    return {
      signature,
      amount: depositAmount,
      skipped: false,
    };
  } catch (error) {
    console.error('❌ Buyback deposit failed (non-blocking):', error);
    // Don't throw - non-blocking error
    return {
      skipped: true,
      amount: depositAmount,
      reason: `Deposit failed: ${(error as Error).message}`,
    };
  }
}
