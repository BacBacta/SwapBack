const { Connection, PublicKey } = require('@solana/web3.js');

const connection = new Connection('https://api.devnet.solana.com');
const userNftPda = new PublicKey('Hzs1TSnU1EkSGyCCeMTDvkWAwPv2FUyg5yQpVV3p41xB');

(async () => {
  const accountInfo = await connection.getAccountInfo(userNftPda);
  if (!accountInfo) {
    console.log('❌ Compte non trouvé');
    return;
  }
  
  console.log('Taille compte:', accountInfo.data.length);
  console.log('Owner:', accountInfo.owner.toBase58());
  
  // Parser le bump (dernier byte)
  const bump = accountInfo.data.readUInt8(accountInfo.data.length - 1);
  console.log('Bump stocké dans le compte:', bump);
  
  // Vérifier que le PDA avec ce bump correspond
  const wallet = new PublicKey('578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf');
  const cnftProgram = new PublicKey('9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw');
  
  const [derivedPda, derivedBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_nft'), wallet.toBuffer()],
    cnftProgram
  );
  
  console.log('\nPDA dérivé (canonical):', derivedPda.toBase58());
  console.log('Bump dérivé (canonical):', derivedBump);
  console.log('Match:', derivedPda.toBase58() === userNftPda.toBase58());
  
  // Parser le user stocké dans le compte
  let offset = 8; // discriminator
  const userInAccount = new PublicKey(accountInfo.data.slice(offset, offset + 32));
  console.log('\nUser dans le compte:', userInAccount.toBase58());
  console.log('User wallet actuel:', wallet.toBase58());
  console.log('Match user:', userInAccount.toBase58() === wallet.toBase58());
})();
