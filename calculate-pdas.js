const { PublicKey } = require('@solana/web3.js');

const ROUTER_PROGRAM = 'yeKoCvFPTmgn5oCejqFVU5mUNdVbZSxwETCXDuBpfxn';
const BUYBACK_PROGRAM = 'DkaELUiGtTcFniZvHRicHn3RK11CsemDRW7h8qVQaiJi';

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║          📍 Calcul des PDAs Testnet SwapBack 📍         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// RouterState PDA
const [routerStatePda, routerBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('router_state')],
  new PublicKey(ROUTER_PROGRAM)
);
console.log('RouterState PDA:');
console.log(' Address:', routerStatePda.toString());
console.log(' Bump:   ', routerBump);
console.log('');

// BuybackState PDA  
const [buybackStatePda, buybackBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('buyback_state')],
  new PublicKey(BUYBACK_PROGRAM)
);
console.log('BuybackState PDA:');
console.log(' Address:', buybackStatePda.toString());
console.log(' Bump:   ', buybackBump);
console.log('');

// GlobalState PDA
const [globalStatePda, globalBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('global_state')],
  new PublicKey(ROUTER_PROGRAM)
);
console.log('GlobalState PDA:');
console.log(' Address:', globalStatePda.toString());
console.log(' Bump:   ', globalBump);
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('Ces PDAs seront utilisés pour initialiser les états');
console.log('═══════════════════════════════════════════════════════════');
