#!/usr/bin/env -S npx tsx
import { Connection, VersionedTransaction } from '@solana/web3.js';

const {
  INPUT_MINT,
  OUTPUT_MINT,
  AMOUNT,
  SLIPPAGE_BPS = '50',
  USER_PK,
  JUPITER_API = 'https://public.jupiterapi.com',
  RPC = 'https://api.mainnet-beta.solana.com',
  SIMULATE = '0',
} = process.env;

if (!INPUT_MINT || !OUTPUT_MINT || !AMOUNT || !USER_PK) {
  console.error('Missing INPUT_MINT, OUTPUT_MINT, AMOUNT, or USER_PK env vars.');
  process.exit(1);
}

const slippageBps = Number(SLIPPAGE_BPS);
if (!Number.isFinite(slippageBps) || slippageBps <= 0) {
  console.error(`Invalid SLIPPAGE_BPS value: ${SLIPPAGE_BPS}`);
  process.exit(1);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatLamports(value: bigint, decimals: number): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const integer = value / divisor;
  const fraction = value % divisor;
  return `${integer}.${fraction.toString().padStart(decimals, '0')}`.replace(/\.0+$/, '');
}

(async () => {
  console.log('📡 Fetching Jupiter quote...');
  const quoteUrl = `${JUPITER_API}/quote?inputMint=${INPUT_MINT}&outputMint=${OUTPUT_MINT}` +
    `&amount=${AMOUNT}&slippageBps=${slippageBps}`;
  const quote = await fetchJson<any>(quoteUrl);

  const outAmount = BigInt(quote.outAmount);
  const computedMin = (outAmount * BigInt(10000 - slippageBps)) / BigInt(10000);
  const jupiterThreshold = BigInt(quote.otherAmountThreshold ?? quote.outAmount);
  const deficit = computedMin > jupiterThreshold ? computedMin - jupiterThreshold : 0n;

  console.log('\n=== Jupiter Quote Diagnostics ===');
  console.log('Output amount (raw):', quote.outAmount);
  console.log('Other amount threshold:', quote.otherAmountThreshold ?? 'n/a');
  console.log('Computed minOut (router):', computedMin.toString());
  console.log('Threshold difference (lamports):', deficit.toString());
  console.log('Router minOut > Jupiter threshold ?', computedMin > jupiterThreshold);

  console.log('\n📡 Fetching Jupiter swap transaction...');
  const swapBody = {
    quoteResponse: quote,
    userPublicKey: USER_PK,
    wrapAndUnwrapSol: true,
    useSharedAccounts: true,
    dynamicComputeUnitLimit: true,
  };
  const swapRes = await fetchJson<any>(`${JUPITER_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(swapBody),
  });

  if (!swapRes.swapTransaction) {
    console.error('Swap response missing swapTransaction');
    process.exit(1);
  }

  console.log('Swap transaction length (base64 chars):', swapRes.swapTransaction.length);

  if (SIMULATE === '1') {
    console.log('\n🔬 Simulating swap transaction via RPC...');
    const connection = new Connection(RPC, 'confirmed');
    const tx = VersionedTransaction.deserialize(Buffer.from(swapRes.swapTransaction, 'base64'));
    const sim = await connection.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
    });
    console.log(JSON.stringify(sim, null, 2));
  }

  if (computedMin > jupiterThreshold) {
    console.error('\n⚠️ Router minOut exceeds Jupiter threshold. Native router will throw 0x1770.');
    process.exit(2);
  }

  console.log('\n✅ Router minOut <= Jupiter threshold. Native router may proceed.');
})();
