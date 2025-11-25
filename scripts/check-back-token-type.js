const { Connection, PublicKey } = require('@solana/web3.js');
const { getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = require('@solana/spl-token');

async function checkTokenType() {
  const connection = new Connection('https://api.devnet.solana.com');
  const mintAddress = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
  
  console.log('�� Checking token type...\n');
  
  // Try Token-2022 first
  try {
    const mintInfo = await getMint(connection, mintAddress, 'confirmed', TOKEN_2022_PROGRAM_ID);
    console.log('✅ Token Type: TOKEN-2022');
    console.log('   Extensions:', mintInfo.tlvData?.length || 0, 'bytes');
    console.log('   Can add Transfer Hook:', mintInfo.tlvData ? 'MAYBE' : 'NO');
    return 'token-2022';
  } catch (e) {
    // Not Token-2022, try standard
  }
  
  // Try standard Token Program
  try {
    const mintInfo = await getMint(connection, mintAddress, 'confirmed', TOKEN_PROGRAM_ID);
    console.log('❌ Token Type: STANDARD TOKEN PROGRAM');
    console.log('   Extensions: NOT SUPPORTED');
    console.log('   Can add Transfer Hook: ❌ IMPOSSIBLE');
    console.log('\n⚠️  Must create NEW Token-2022 mint');
    return 'standard';
  } catch (e) {
    console.error('❌ Token not found or error:', e.message);
    return null;
  }
}

checkTokenType().then(type => {
  if (type === 'standard') {
    console.log('\n📝 RECOMMENDATION:');
    console.log('   Create new Token-2022 mint with Transfer Hook');
    console.log('   Implement 1:1 migration contract');
    console.log('   Announce migration period (30 days)');
  } else if (type === 'token-2022') {
    console.log('\n📝 RECOMMENDATION:');
    console.log('   Try adding Transfer Hook extension');
    console.log('   If fails, create new mint');
  }
  process.exit(0);
});
