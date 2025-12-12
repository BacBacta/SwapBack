#!/usr/bin/env -S npx tsx
import { Connection, VersionedTransaction } from '@solana/web3.js';

const RPC = process.env.RPC ?? 'https://api.mainnet-beta.solana.com';
const SWAP_TX_B64 = process.env.SWAP_TX_B64;
const JUP_PROGRAM = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

if (!SWAP_TX_B64) {
  console.error('Missing SWAP_TX_B64 env var (base64 swapTransaction from Jupiter).');
  process.exit(1);
}

(async () => {
  const tx = VersionedTransaction.deserialize(Buffer.from(SWAP_TX_B64, 'base64'));
  const msg = tx.message;
  const staticKeys = msg.staticAccountKeys;

  console.log('--- TX META ---');
  console.log('Version:', tx.version);
  console.log('Static account count:', staticKeys.length);
  console.log('Instructions:', msg.compiledInstructions.length);
  console.log('ALTs:', msg.addressTableLookups?.length ?? 0);

  const jupIdx = staticKeys.findIndex(k => k.toBase58() === JUP_PROGRAM);
  const jupIx = msg.compiledInstructions.find(
    ix => staticKeys[ix.programIdIndex]?.toBase58() === JUP_PROGRAM,
  );
  if (jupIx) {
    console.log('\n--- JUPITER IX ---');
    console.log('Program index:', jupIdx);
    console.log('Account indexes:', jupIx.accountKeyIndexes);
    console.log('Data length:', jupIx.data.length);
    console.log('First 4 bytes (hex):', Buffer.from(jupIx.data.slice(0, 4)).toString('hex'));
    console.log('Jupiter present in its own accounts:', jupIx.accountKeyIndexes.includes(jupIdx));
  } else {
    console.log('\n(No Jupiter instruction found)');
  }

  console.log('\n--- SIMULATION ---');
  const connection = new Connection(RPC, 'confirmed');
  const sim = await connection.simulateTransaction(tx, {
    replaceRecentBlockhash: true,
    sigVerify: false,
  });
  console.log(JSON.stringify(sim, null, 2));
})();