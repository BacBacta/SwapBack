const { Connection, PublicKey } = require('@solana/web3.js');

async function analyzeRouterData() {
  const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  
  // RouterState initialisé pour l'ancien programme
  const routerState = new PublicKey('7nGEn5zY78G1X97VynadEbHRPkNtHmR69TGwWqymqeSs');
  const account = await conn.getAccountInfo(routerState);
  
  if (!account) {
    console.log('Account not found');
    return;
  }
  
  const data = account.data;
  console.log('=== ROUTERSTATE DATA ANALYSIS ===');
  console.log('Total size:', data.length, 'bytes');
  console.log('');
  
  // RouterState layout from state/router_state.rs:
  // 8 discriminator
  // 32 authority
  // 1+32 pending_authority (Option<Pubkey>)
  // 1 is_paused
  // 8 paused_at
  // 2+2+2+2+2 = 10 bytes (percentages)
  // 32+32+32+32 = 128 bytes (wallets)
  // 8*7 = 56 bytes (metrics)
  // 1 dynamic_slippage_enabled
  // 1 bump
  
  let offset = 0;
  
  // Discriminator (8 bytes)
  console.log('Discriminator:', data.slice(offset, offset + 8).toString('hex'));
  offset += 8;
  
  // Authority (32 bytes)
  const authority = new PublicKey(data.slice(offset, offset + 32));
  console.log('Authority:', authority.toString());
  offset += 32;
  
  // Pending authority Option<Pubkey> (1 + 32 = 33 bytes)
  const hasPending = data[offset] === 1;
  console.log('Has Pending Authority:', hasPending);
  offset += 1;
  if (hasPending) {
    const pending = new PublicKey(data.slice(offset, offset + 32));
    console.log('Pending Authority:', pending.toString());
  }
  offset += 32;
  
  // is_paused (1 byte)
  const isPaused = data[offset] === 1;
  console.log('Is Paused:', isPaused);
  offset += 1;
  
  // paused_at (8 bytes i64)
  const pausedAt = data.readBigInt64LE(offset);
  console.log('Paused At:', pausedAt.toString());
  offset += 8;
  
  // rebate_percentage (2 bytes u16)
  const rebatePct = data.readUInt16LE(offset);
  console.log('Rebate Percentage:', rebatePct, 'bps (', (rebatePct/100).toFixed(1), '%)');
  offset += 2;
  
  // treasury_percentage (2 bytes u16)
  const treasuryPct = data.readUInt16LE(offset);
  console.log('Treasury Percentage:', treasuryPct, 'bps (', (treasuryPct/100).toFixed(1), '%)');
  offset += 2;
  
  // boost_vault_percentage (2 bytes u16)
  const boostPct = data.readUInt16LE(offset);
  console.log('Boost Vault Percentage:', boostPct, 'bps (', (boostPct/100).toFixed(1), '%)');
  offset += 2;
  
  console.log('');
  console.log('=== NPI DISTRIBUTION ===');
  console.log('Total:', rebatePct + treasuryPct + boostPct, 'bps');
  console.log('  Rebates:', rebatePct/100, '%');
  console.log('  Treasury:', treasuryPct/100, '%');
  console.log('  Boost:', boostPct/100, '%');
  
  // treasury_from_fees_bps (2 bytes u16)
  const treasuryFromFees = data.readUInt16LE(offset);
  console.log('');
  console.log('=== PLATFORM FEE DISTRIBUTION ===');
  console.log('Treasury from Fees:', treasuryFromFees, 'bps (', (treasuryFromFees/100).toFixed(1), '%)');
  offset += 2;
  
  // buyburn_from_fees_bps (2 bytes u16)
  const buyburnFromFees = data.readUInt16LE(offset);
  console.log('Buy/Burn from Fees:', buyburnFromFees, 'bps (', (buyburnFromFees/100).toFixed(1), '%)');
  offset += 2;
  
  // Wallets (4 x 32 bytes)
  console.log('');
  console.log('=== CONFIGURED WALLETS ===');
  const treasury = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const boost = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const buyback = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const npiVault = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  const defaultPk = '11111111111111111111111111111111';
  console.log('Treasury:', treasury.toString() === defaultPk ? '❌ NOT SET' : treasury.toString());
  console.log('Boost Vault:', boost.toString() === defaultPk ? '❌ NOT SET' : boost.toString());
  console.log('Buyback:', buyback.toString() === defaultPk ? '❌ NOT SET' : buyback.toString());
  console.log('NPI Vault:', npiVault.toString() === defaultPk ? '❌ NOT SET' : npiVault.toString());
  
  // Metrics (7 x 8 bytes)
  console.log('');
  console.log('=== METRICS ===');
  const totalVolume = data.readBigUInt64LE(offset);
  console.log('Total Volume:', totalVolume.toString());
  offset += 8;
  
  const totalNpi = data.readBigUInt64LE(offset);
  console.log('Total NPI:', totalNpi.toString());
  offset += 8;
  
  const totalRebatesPaid = data.readBigUInt64LE(offset);
  console.log('Total Rebates Paid:', totalRebatesPaid.toString());
  offset += 8;
  
  const totalTreasuryFromNpi = data.readBigUInt64LE(offset);
  console.log('Total Treasury from NPI:', totalTreasuryFromNpi.toString());
  offset += 8;
  
  const totalBoostVault = data.readBigUInt64LE(offset);
  console.log('Total Boost Vault:', totalBoostVault.toString());
  offset += 8;
  
  // dynamic_slippage_enabled (1 byte)
  const dynamicSlippage = data[offset] === 1;
  console.log('');
  console.log('Dynamic Slippage Enabled:', dynamicSlippage);
  offset += 1;
  
  // total_treasury_from_fees (8 bytes)
  const totalTreasuryFromFees = data.readBigUInt64LE(offset);
  console.log('Total Treasury from Fees:', totalTreasuryFromFees.toString());
  offset += 8;
  
  // total_buyburn (8 bytes)
  const totalBuyburn = data.readBigUInt64LE(offset);
  console.log('Total Buy/Burn:', totalBuyburn.toString());
  offset += 8;
  
  // Bump (1 byte)
  const bump = data[offset];
  console.log('');
  console.log('Bump:', bump);
  console.log('Final offset:', offset + 1, '/', data.length);
  
  // Check rebate vault
  console.log('');
  console.log('=== REBATE VAULT CHECK ===');
  const oldProgramId = new PublicKey('5K7kKoYd1E2S2gycBMeAeyXnxdbVgAEqJWKERwW8FTMf');
  const [rebateVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('rebate_vault')],
    oldProgramId
  );
  console.log('Rebate Vault PDA:', rebateVault.toString());
  
  const rebateVaultAccount = await conn.getAccountInfo(rebateVault);
  if (rebateVaultAccount) {
    console.log('Status: ✅ INITIALISÉ');
    console.log('Balance:', rebateVaultAccount.lamports / 1e9, 'SOL');
  } else {
    console.log('Status: ❌ NON INITIALISÉ');
  }
  
  // Check avec l'autre seed possible
  const [rebateVault2] = PublicKey.findProgramAddressSync(
    [Buffer.from('rebate_vault'), routerState.toBuffer()],
    oldProgramId
  );
  console.log('');
  console.log('Rebate Vault PDA (with state):', rebateVault2.toString());
  const rebateVault2Account = await conn.getAccountInfo(rebateVault2);
  if (rebateVault2Account) {
    console.log('Status: ✅ INITIALISÉ');
  } else {
    console.log('Status: ❌ NON INITIALISÉ');
  }
}

analyzeRouterData().catch(console.error);
