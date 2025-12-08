const { Connection, PublicKey } = require('@solana/web3.js');

const ROUTER_PROGRAM_ID = new PublicKey('5HR9WsW81YySSst7qUSdqxnXc2X4NVfJNANDfvWnZUXW');
const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  
  const [routerStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    ROUTER_PROGRAM_ID
  );
  
  console.log('RouterState PDA:', routerStatePda.toBase58());
  
  const accountInfo = await connection.getAccountInfo(routerStatePda);
  
  if (!accountInfo) {
    console.log('\n[X] RouterState NOT INITIALIZED!');
    return;
  }
  
  console.log('\n[OK] RouterState EXISTS!');
  console.log('Data size:', accountInfo.data.length, 'bytes');
  console.log('Owner:', accountInfo.owner.toBase58());
  
  const data = accountInfo.data;
  let offset = 8;
  
  const authority = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
  const treasuryWallet = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
  const buybackWallet = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
  const boostVault = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
  const npiVault = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
  
  const isPaused = data[offset] === 1; offset += 1;
  const rebatePercent = data.readUInt16LE(offset); offset += 2;
  const treasuryPercent = data.readUInt16LE(offset); offset += 2;
  const boostPercent = data.readUInt16LE(offset); offset += 2;
  
  const totalVolume = Number(data.readBigUInt64LE(offset)); offset += 8;
  const totalFees = Number(data.readBigUInt64LE(offset)); offset += 8;
  const totalRebatesDistributed = Number(data.readBigUInt64LE(offset));
  
  console.log('\n=== Configuration ===');
  console.log('Authority:', authority.toBase58());
  console.log('\n--- Wallets ---');
  console.log('Treasury:', treasuryWallet.toBase58());
  console.log('Buyback:', buybackWallet.toBase58());
  console.log('Boost Vault:', boostVault.toBase58());
  console.log('NPI Vault:', npiVault.toBase58());
  console.log('\n--- Percentages ---');
  console.log('Rebate:', rebatePercent / 100, '%');
  console.log('Treasury:', treasuryPercent / 100, '%');
  console.log('Boost:', boostPercent / 100, '%');
  console.log('\n--- Status ---');
  console.log('Paused:', isPaused);
  console.log('Volume USDC:', totalVolume / 1e6);
  console.log('Fees USDC:', totalFees / 1e6);
  console.log('Rebates Distributed USDC:', totalRebatesDistributed / 1e6);
  
  const [rebateVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('rebate_vault')],
    ROUTER_PROGRAM_ID
  );
  console.log('\n=== Rebate Vault ===');
  console.log('PDA:', rebateVaultPda.toBase58());
  
  const rebateVaultInfo = await connection.getAccountInfo(rebateVaultPda);
  if (rebateVaultInfo) {
    console.log('[OK] Vault exists, lamports:', rebateVaultInfo.lamports);
    if (rebateVaultInfo.data.length === 165) {
      const amount = Number(rebateVaultInfo.data.readBigUInt64LE(64));
      console.log('USDC Balance:', amount / 1e6);
    }
  } else {
    console.log('[X] Rebate Vault not initialized');
  }
}

main().catch(console.error);
