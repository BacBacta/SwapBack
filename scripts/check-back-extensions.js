const { Connection, PublicKey } = require('@solana/web3.js');
const { 
  getMint, 
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getExtensionData,
  getExtensionTypes
} = require('@solana/spl-token');

async function checkExtensions() {
  const connection = new Connection('https://api.devnet.solana.com');
  const mintAddress = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
  
  console.log('🔍 Analyzing Token-2022 Extensions...\n');
  
  try {
    const mintInfo = await getMint(
      connection, 
      mintAddress, 
      'confirmed', 
      TOKEN_2022_PROGRAM_ID
    );
    
    console.log('📊 Mint Info:');
    console.log('   Supply:', mintInfo.supply.toString());
    console.log('   Decimals:', mintInfo.decimals);
    console.log('   Mint Authority:', mintInfo.mintAuthority?.toString() || 'None');
    console.log('   Freeze Authority:', mintInfo.freezeAuthority?.toString() || 'None');
    
    // Get all extension types
    const extensions = getExtensionTypes(mintInfo.tlvData);
    
    console.log('\n📦 Current Extensions:');
    if (extensions.length === 0) {
      console.log('   ✅ No extensions yet - Can add Transfer Hook!');
    } else {
      extensions.forEach(ext => {
        console.log(`   - ${ExtensionType[ext]}`);
      });
    }
    
    // Check if Transfer Hook already exists
    const hasTransferHook = extensions.includes(ExtensionType.TransferHook);
    
    console.log('\n🎯 Transfer Hook Status:');
    if (hasTransferHook) {
      console.log('   ⚠️  Transfer Hook ALREADY EXISTS');
      try {
        const hookData = getExtensionData(
          ExtensionType.TransferHook,
          mintInfo.tlvData
        );
        console.log('   Current Hook Program:', hookData.toString('hex'));
      } catch (e) {
        console.log('   Could not read hook data');
      }
    } else {
      console.log('   ✅ Transfer Hook NOT SET - Can be added!');
    }
    
    console.log('\n📝 RECOMMENDATION:');
    if (hasTransferHook) {
      console.log('   ⚠️  Transfer Hook already configured');
      console.log('   → Check if it needs updating');
      console.log('   → May need mint authority to change');
    } else {
      console.log('   ✅ Safe to add Transfer Hook extension');
      console.log('   → Deploy hook program first');
      console.log('   → Then attach to this mint');
      console.log('   → NO new token needed!');
    }
    
    console.log('\n🔐 Authority Check:');
    if (mintInfo.mintAuthority) {
      console.log('   ✅ Mint authority exists - Can add extensions');
    } else {
      console.log('   ❌ No mint authority - CANNOT modify token');
      console.log('   → Would need to create new token');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkExtensions();
