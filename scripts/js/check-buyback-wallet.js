const { Connection, PublicKey } = require('@solana/web3.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const CNFT_PROGRAM_ID = new PublicKey('EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP');

(async () => {
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    CNFT_PROGRAM_ID
  );
  
  console.log('GlobalState PDA:', globalState.toString());
  
  const gsInfo = await connection.getAccountInfo(globalState);
  if (!gsInfo) {
    console.log('ERROR: GlobalState not found');
    return;
  }
  
  // Parser le buyback_wallet (offset 8 + 32*3 = 104)
  const buybackWallet = new PublicKey(gsInfo.data.slice(104, 136));
  console.log('\nBuyback Wallet from GlobalState:', buybackWallet.toString());
  
  const buybackInfo = await connection.getAccountInfo(buybackWallet);
  console.log('Buyback Wallet exists?', !!buybackInfo);
  if (buybackInfo) {
    console.log('  Owner:', buybackInfo.owner.toString());
    console.log('  Size:', buybackInfo.data.length, 'bytes');
  } else {
    console.log('  ERROR: Buyback wallet account does not exist!');
  }
})();
