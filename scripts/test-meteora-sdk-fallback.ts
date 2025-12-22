import { Connection, PublicKey } from '@solana/web3.js';
import { createRequire } from 'node:module';

const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const METEORA_SOL_USDC_LBPAIR = new PublicKey('5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6');

async function loadMeteoraDLMMClass(): Promise<any> {
  try {
    const mod: any = await import("@meteora-ag/dlmm");
    return mod?.DLMM ?? mod?.default ?? mod;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isNode = typeof process !== "undefined" && !!process.versions?.node;
    const missingBnExport = msg.includes("export named 'BN'") || msg.includes('export named "BN"');
    console.log('ESM import failed, isNode:', isNode, 'missingBnExport:', missingBnExport);
    if (isNode && missingBnExport) {
      console.log('Trying CJS fallback...');
      const req = createRequire(import.meta.url);
      // Load the CJS entry (dist/index.js) which uses require('@coral-xyz/anchor') where BN exists.
      const mod: any = req("@meteora-ag/dlmm");
      return mod?.DLMM ?? mod?.default ?? mod;
    }
    throw e;
  }
}

async function testMeteoraSdk() {
  const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
  
  console.log('Loading Meteora DLMM SDK...');
  const DLMM = await loadMeteoraDLMMClass();
  
  console.log('DLMM class:', typeof DLMM, 'create:', typeof DLMM?.create);
  
  if (!DLMM?.create) {
    throw new Error('DLMM.create not found');
  }
  
  console.log('Creating DLMM instance for lb_pair:', METEORA_SOL_USDC_LBPAIR.toBase58());
  
  try {
    const dlmm = await DLMM.create(connection, METEORA_SOL_USDC_LBPAIR);
    console.log('DLMM instance created!');
    console.log('tokenX mint:', dlmm.tokenX?.mint?.address?.toBase58?.() ?? dlmm.tokenX?.publicKey?.toBase58?.());
    console.log('tokenY mint:', dlmm.tokenY?.mint?.address?.toBase58?.() ?? dlmm.tokenY?.publicKey?.toBase58?.());
    console.log('reserveX:', dlmm.tokenX?.reserve?.toBase58?.());
    console.log('reserveY:', dlmm.tokenY?.reserve?.toBase58?.());
    
    // Test getBinArrayForSwap
    console.log('\nTesting getBinArrayForSwap (swapForY=true, depth=5)...');
    const binArraysTrue = await dlmm.getBinArrayForSwap(true, 5);
    console.log('Bin arrays (swapForY=true):', binArraysTrue.length);
    
    console.log('\nTesting getBinArrayForSwap (swapForY=false, depth=5)...');
    const binArraysFalse = await dlmm.getBinArrayForSwap(false, 5);
    console.log('Bin arrays (swapForY=false):', binArraysFalse.length);
    
    if (binArraysTrue.length > 0 || binArraysFalse.length > 0) {
      console.log('\n✅ Meteora SDK working correctly!');
    } else {
      console.log('\n❌ No bin arrays found for either direction!');
    }
  } catch (e) {
    console.error('Error creating DLMM instance:', e);
  }
}

testMeteoraSdk().catch(console.error);
