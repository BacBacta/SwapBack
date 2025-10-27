/**
 * Dump complet des données du UserNft
 * Pour debugger le champ is_active
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const NETWORK = "https://api.devnet.solana.com";
const CNFT_PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");

async function main() {
  const connection = new Connection(NETWORK, "confirmed");

  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const { Keypair } = require("@solana/web3.js");
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const [userNftPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), payer.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );

  console.log(`\nUserNft PDA: ${userNftPDA.toString()}`);

  const accountInfo = await connection.getAccountInfo(userNftPDA);
  if (!accountInfo) {
    console.log("❌ Compte non trouvé");
    return;
  }

  console.log(`\n📊 Informations du compte:`);
  console.log(`   Owner: ${accountInfo.owner.toString()}`);
  console.log(`   Lamports: ${accountInfo.lamports}`);
  console.log(`   Data length: ${accountInfo.data.length} bytes`);
  console.log(`   Executable: ${accountInfo.executable}`);

  // Dump hexadécimal
  console.log(`\n🔍 Données hexadécimales:`);
  console.log(accountInfo.data.toString("hex"));

  // Analyse de la structure UserNft
  console.log(`\n📋 Structure UserNft (69 bytes total):`);
  console.log(`   [0-7]    Discriminator: ${accountInfo.data.subarray(0, 8).toString("hex")}`);
  console.log(`   [8-39]   User (Pubkey): ${new PublicKey(accountInfo.data.subarray(8, 40)).toString()}`);
  console.log(`   [40]     Level: ${accountInfo.data.readUInt8(40)}`);
  console.log(`   [41-48]  Amount Locked: ${accountInfo.data.readBigUInt64LE(41)} (${(Number(accountInfo.data.readBigUInt64LE(41)) / 1e9).toFixed(2)} BACK)`);
  console.log(`   [49-56]  Lock Duration: ${accountInfo.data.readBigInt64LE(49)} sec (${(Number(accountInfo.data.readBigInt64LE(49)) / 86400).toFixed(0)} days)`);
  console.log(`   [57-58]  Boost: ${accountInfo.data.readUInt16LE(57)} bp`);
  console.log(`   [59-66]  Mint Time: ${accountInfo.data.readBigInt64LE(59)} (${new Date(Number(accountInfo.data.readBigInt64LE(59)) * 1000).toISOString()})`);
  console.log(`   [67]     Is Active: ${accountInfo.data.readUInt8(67)} (${accountInfo.data.readUInt8(67) === 1 ? 'true' : 'false'})`);
  console.log(`   [68]     Bump: ${accountInfo.data.readUInt8(68)}`);

  // Visualisation bit par bit pour is_active
  console.log(`\n🔬 Analyse détaillée is_active (byte 67):`);
  const isActiveByte = accountInfo.data.readUInt8(67);
  console.log(`   Valeur: ${isActiveByte}`);
  console.log(`   Binaire: ${isActiveByte.toString(2).padStart(8, '0')}`);
  console.log(`   Hex: 0x${isActiveByte.toString(16).padStart(2, '0')}`);
  console.log(`   Booléen: ${isActiveByte !== 0}`);

  // Vérifier aussi l'offset 65 au cas où
  console.log(`\n🔍 Vérification offset 65 (utilisé dans le script précédent):`);
  const isActiveAt65 = accountInfo.data.readUInt8(65);
  console.log(`   Valeur à l'offset 65: ${isActiveAt65}`);
  console.log(`   Booléen: ${isActiveAt65 !== 0}`);
}

main().catch(console.error);
