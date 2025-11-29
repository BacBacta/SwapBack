const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = require('@solana/spl-token');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const CNFT_PROGRAM_ID = new PublicKey('EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP');
const BACK_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');

(async () => {
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority')],
    CNFT_PROGRAM_ID
  );
  
  console.log('Vault Authority:', vaultAuthority.toString());
  
  // Calculer avec Token2022
  const ataToken2022 = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  
  // Calculer avec TokenProgram
  const ataTokenProgram = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority,
    true,
    TOKEN_PROGRAM_ID
  );
  
  console.log('\nATA (Token2022):', ataToken2022.toString());
  console.log('ATA (TokenProgram):', ataTokenProgram.toString());
  
  // Vérifier lequel existe
  const info2022 = await connection.getAccountInfo(ataToken2022);
  const infoToken = await connection.getAccountInfo(ataTokenProgram);
  
  console.log('\nToken2022 ATA exists?', !!info2022, info2022 ? `(owner: ${info2022.owner.toString()})` : '');
  console.log('TokenProgram ATA exists?', !!infoToken, infoToken ? `(owner: ${infoToken.owner.toString()})` : '');
  
  console.log('\nExpected owner: Token2022 =', TOKEN_2022_PROGRAM_ID.toString());
})();
