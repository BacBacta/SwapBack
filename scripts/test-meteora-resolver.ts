import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { createRequire } from 'node:module';

const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const METEORA_SOL_USDC_LBPAIR = new PublicKey('5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6');
const METEORA_DLMM_PROGRAM = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');

// Charger le SDK Meteora en CJS (contourne le problème ESM/Anchor/BN)
const req = createRequire(import.meta.url);
const DLMM = req('@meteora-ag/dlmm');

async function testGetMeteoraAccounts() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  console.log('RPC:', rpcUrl);
  const connection = new Connection(rpcUrl);
  const user = Keypair.generate().publicKey;

  console.log('DLMM class:', typeof DLMM, 'create:', typeof DLMM.create);

  // Vérifier le bitmap extension
  const [binArrayBitmapExtension] = PublicKey.findProgramAddressSync(
    [Buffer.from('bitmap'), METEORA_SOL_USDC_LBPAIR.toBuffer()],
    METEORA_DLMM_PROGRAM
  );

  console.log('\n1. Checking bitmap extension...');
  const bitmapInfo = await connection.getAccountInfo(binArrayBitmapExtension);
  console.log('   Bitmap exists:', !!bitmapInfo);

  if (!bitmapInfo) {
    console.log('❌ Bitmap extension missing - resolver will return null');
    return;
  }

  console.log('\n2. Creating DLMM instance...');
  const dlmm = await DLMM.create(connection, METEORA_SOL_USDC_LBPAIR);
  console.log('   DLMM created!');
  
  const tokenXMint = dlmm?.tokenX?.mint?.address ?? dlmm?.tokenX?.publicKey;
  const tokenYMint = dlmm?.tokenY?.mint?.address ?? dlmm?.tokenY?.publicKey;
  
  console.log('   tokenX mint:', tokenXMint?.toBase58?.());
  console.log('   tokenY mint:', tokenYMint?.toBase58?.());
  console.log('   reserveX:', dlmm?.tokenX?.reserve?.toBase58?.());
  console.log('   reserveY:', dlmm?.tokenY?.reserve?.toBase58?.());

  // Déterminer la direction du swap
  const inputIsX = WSOL_MINT.equals(tokenXMint);
  const swapForY = inputIsX;
  console.log('\n3. Swap direction: swapForY =', swapForY, '(SOL is tokenX:', inputIsX, ')');

  console.log('\n4. Getting bin arrays for swap...');
  try {
    const binArrays = await dlmm.getBinArrayForSwap(swapForY, 5);
    console.log('   Bin arrays found:', binArrays.length);
    if (binArrays.length > 0) {
      console.log('   First bin array:', binArrays[0].publicKey.toBase58());
    }
    
    if (binArrays.length === 0) {
      console.log('❌ No bin arrays - resolver will return null');
    } else {
      console.log('\n✅ All checks passed! getMeteoraAccounts should succeed');
    }
  } catch (e) {
    console.error('❌ Error getting bin arrays:', e);
  }
}

testGetMeteoraAccounts().catch(console.error);
