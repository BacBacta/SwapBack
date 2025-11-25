#!/usr/bin/env node
/**
 * Deposit USDC directly into buyback vault for testing
 * Bypasses router/Jupiter to manually fund the vault
 */

const anchor = require('@coral-xyz/anchor');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

const BUYBACK_PROGRAM_ID = new anchor.web3.PublicKey('F8S1r81FcTsSBb9vP3jFNuVoTMYNrxaCptbvkzSXcEce');
const USDC_MINT = new anchor.web3.PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

async function main() {
  const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME || '', '.config/solana/id.json');
  
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found: ${walletPath}`);
  }

  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const walletKeypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new anchor.web3.Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, '..', 'target', 'idl', 'swapback_buyback.json');
  if (!fs.existsSync(idlPath)) {
    throw new Error('IDL not found. Run `anchor build` first.');
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const sanitizedIdl = {
    ...idl,
    address: BUYBACK_PROGRAM_ID.toString(),
    accounts: [],
  };

  // Anchor infers the program ID from idl.address
  const program = new anchor.Program(sanitizedIdl, provider);

  const [usdcVault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('usdc_vault')],
    BUYBACK_PROGRAM_ID
  );

  // Get user's USDC token account
  const userUsdcAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    wallet.publicKey
  );

  console.log('💰 Depositing USDC to Buyback Vault');
  console.log('   Wallet       :', wallet.publicKey.toString());
  console.log('   User USDC ATA:', userUsdcAccount.toString());
  console.log('   Vault PDA    :', usdcVault.toString());

  // Check user balance
  try {
    const balance = await connection.getTokenAccountBalance(userUsdcAccount);
    console.log('   User Balance :', balance.value.uiAmount, 'USDC');
    
    if (!balance.value.uiAmount || balance.value.uiAmount === 0) {
      console.log('\n⚠️  No USDC in wallet!');
      console.log('   You need to get devnet USDC first.');
      console.log('   Try: spl-token transfer 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU 100 <your-wallet> --fund-recipient --url devnet');
      return;
    }
  } catch (error) {
    console.error('❌ Failed to check balance:', error.message);
    return;
  }

  // Amount to deposit (100 USDC)
  const amount = new anchor.BN(100 * 1_000_000);

  try {
    const txSig = await program.methods
      .depositUsdc(amount)
      .accounts({
        buybackState: anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from('buyback_state')],
          BUYBACK_PROGRAM_ID
        )[0],
        sourceUsdc: userUsdcAccount,
        usdcVault,
        depositor: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log('\n✅ Deposit successful!');
    console.log('   Transaction:', txSig);
    console.log('   Amount     :', 100, 'USDC');

    // Verify vault balance
    const vaultBalance = await connection.getTokenAccountBalance(usdcVault);
    console.log('\n📊 Vault Balance After Deposit:', vaultBalance.value.uiAmount, 'USDC');
  } catch (error) {
    console.error('\n❌ Deposit failed:', error.message);
    if (error.logs) {
      console.error('Program logs:', error.logs.join('\n'));
    }
  }
}

main().catch((err) => {
  console.error('❌ Script error:', err.message);
  process.exit(1);
});
