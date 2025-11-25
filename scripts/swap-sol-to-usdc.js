#!/usr/bin/env node
/**
 * Utility: swap SOL -> USDC (devnet) using Jupiter v6 API.
 * Produces USDC in the local CLI wallet to fund the buyback vault during integration tests.
 *
 * Usage:
 *   SOL_AMOUNT=0.8 node scripts/swap-sol-to-usdc.js
 */

const { Connection, Keypair, VersionedTransaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const INPUT_MINT = 'So11111111111111111111111111111111111111112';
const OUTPUT_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet USDC
const JUP_API = 'https://quote-api.jup.ag/v6';
const SOL_AMOUNT = Number(process.env.SOL_AMOUNT || '0.8');
const SLIPPAGE_BPS = Number(process.env.Slippage_BPS || process.env.SLIPPAGE_BPS || '100');

function loadKeypair() {
  const keypairPath = path.join(process.env.HOME || '', '.config', 'solana', 'id.json');
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Solana CLI keypair not found at ${keypairPath}`);
  }
  const secret = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function fetchQuote(amountLamports) {
  const params = new URLSearchParams({
    inputMint: INPUT_MINT,
    outputMint: OUTPUT_MINT,
    amount: amountLamports.toString(),
    slippageBps: SLIPPAGE_BPS.toString(),
    asLegacyTransaction: 'false',
    onlyDirectRoutes: 'false',
  });
  return fetchJson(`${JUP_API}/quote?${params.toString()}`);
}

async function fetchSwapTransaction(quote, userPublicKey) {
  const res = await fetch(`${JUP_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      computeUnitPriceMicroLamports: 'auto',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Swap request failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function main() {
  if (!Number.isFinite(SOL_AMOUNT) || SOL_AMOUNT <= 0) {
    throw new Error('SOL_AMOUNT must be a positive number');
  }

  const amountLamports = Math.floor(SOL_AMOUNT * 1e9);
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = loadKeypair();

  console.log('🚀 Swapping SOL → USDC on devnet');
  console.log('   Wallet  :', wallet.publicKey.toBase58());
  console.log('   Amount  :', SOL_AMOUNT, 'SOL');
  console.log('   Slippage:', SLIPPAGE_BPS / 100, '%');

  const quote = await fetchQuote(amountLamports);
  console.log('✅ Quote received');
  console.log('   In Amount :', Number(quote.inAmount) / 1e9, 'SOL');
  console.log('   Out Amount:', Number(quote.outAmount) / 1e6, 'USDC');
  console.log('   Route     :', quote.routePlan?.map((r) => r.swapInfo?.label).join(' -> ') || 'N/A');

  const swapResponse = await fetchSwapTransaction(quote, wallet.publicKey.toBase58());
  if (!swapResponse.swapTransaction) {
    throw new Error('swapTransaction missing in response');
  }

  const tx = VersionedTransaction.deserialize(Buffer.from(swapResponse.swapTransaction, 'base64'));
  tx.sign([wallet]);

  console.log('📝 Sending transaction...');
  const signature = await connection.sendTransaction(tx, { maxRetries: 3 });
  await connection.confirmTransaction(signature, 'confirmed');

  console.log('🎉 Swap confirmed!');
  console.log('   Signature:', signature);
  console.log('   Explorer : https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
}

main().catch((err) => {
  console.error('❌ Swap failed:', err.message);
  if (err?.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
