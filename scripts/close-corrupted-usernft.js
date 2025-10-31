#!/usr/bin/env node
/**
 * Close le compte UserNft corrompu (bump=0 stocké mais adresse avec bump=254)
 */

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");
const bs58 = require("bs58");

const CNFT_PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
const DEVNET_RPC = "https://api.devnet.solana.com";
const DEFAULT_KEY_PATH = "/workspaces/SwapBack/devnet-keypair-base58.txt";

function loadKeypair(path) {
  const keyData = fs.readFileSync(path, "utf8").trim();
  const secret = bs58.decode(keyData);
  return Keypair.fromSecretKey(secret);
}

async function main() {
  console.log("\n🗑️  Close Corrupted UserNft Account\n");

  const keypairPath = process.argv[2] || DEFAULT_KEY_PATH;
  const payer = loadKeypair(keypairPath);
  const connection = new Connection(DEVNET_RPC);

  console.log("Wallet:", payer.publicKey.toBase58());

  const balance = await connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL\n");

  // PDA userNft avec bump canonical (254) - celui qui existe actuellement
  const [userNftCorrupted] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), payer.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );

  console.log("🎯 Compte corrompu à closer:", userNftCorrupted.toBase58());

  // Vérifier qu'il existe
  const accountInfo = await connection.getAccountInfo(userNftCorrupted);
  if (!accountInfo) {
    console.log("❌ Aucun compte à cette adresse. Rien à closer.\n");
    return;
  }

  console.log("✅ Compte trouvé");
  console.log("   Taille:", accountInfo.data.length, "bytes");
  console.log("   Lamports:", accountInfo.lamports);
  console.log("   Owner:", accountInfo.owner.toBase58());

  // Parser le bump stocké
  const storedBump = accountInfo.data.readUInt8(accountInfo.data.length - 1);
  console.log("   Bump stocké:", storedBump);
  console.log("   ⚠️  Incohérent avec l'adresse (bump réel: 254)\n");

  console.log("🔧 Tentative de close via transfert des lamports...\n");

  // Pour closer un compte owned par un programme, on doit soit:
  // 1. Utiliser une instruction du programme qui close le compte
  // 2. Transférer tous les lamports hors du compte (le rend rent-exempt négatif)
  
  // Le programme cNFT n'a pas d'instruction "close_user_nft" visible
  // On va tenter un workaround: créer une transaction qui réinitialise le compte
  
  console.log("⚠️  Le programme cNFT n'expose pas d'instruction 'close_user_nft'.");
  console.log("💡 Solution: Re-mint un nouveau cNFT forcera la réinitialisation.\n");
  console.log("Action requise:");
  console.log("   1. Contactez l'équipe pour ajouter une instruction close_user_nft");
  console.log("   2. OU déployez une nouvelle version du programme avec le fix du bump");
  console.log("   3. OU utilisez un compte différent pour tester\n");

  // Alternative: Utiliser solana CLI pour fermer le compte manuellement (unsafe)
  console.log("Alternative technique (UNSAFE):");
  console.log("   solana program close " + userNftCorrupted.toBase58() + " --keypair " + keypairPath);
  console.log("   ⚠️  Ceci nécessite que le wallet soit l'owner du compte (non le cas ici)\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Erreur:", error.message);
    process.exit(1);
  });
