const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

const BACK_TOKEN_MINT = new PublicKey("3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn");
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com"\;

async function checkBalance(walletAddress) {
  const connection = new Connection(RPC_URL, 'confirmed');
  const publicKey = new PublicKey(walletAddress);
  
  console.log("\n🔍 VÉRIFICATION SOLDE $BACK TOKEN");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Wallet: ${walletAddress}`);
  console.log(`🪙 Token Mint: ${BACK_TOKEN_MINT.toString()}`);
  console.log(`🌐 Network: ${RPC_URL}`);
  console.log("");

  try {
    // Vérifier le solde SOL
    const solBalance = await connection.getBalance(publicKey);
    console.log(`💰 SOL Balance: ${(solBalance / 1e9).toFixed(4)} SOL`);
    
    // Calculer l'adresse du compte token associé
    const ata = await getAssociatedTokenAddress(
      BACK_TOKEN_MINT,
      publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    
    console.log(`📦 Associated Token Account: ${ata.toString()}`);
    console.log("");

    // Vérifier si le compte existe
    const accountInfo = await connection.getAccountInfo(ata);
    
    if (!accountInfo) {
      console.log("❌ PROBLÈME DÉTECTÉ:");
      console.log("   Le compte token $BACK n'existe pas encore!");
      console.log("");
      console.log("📋 SOLUTION:");
      console.log("   1. Vous devez d'abord créer le compte token");
      console.log("   2. Puis recevoir des tokens $BACK via le faucet");
      console.log("");
      console.log("🚀 COMMANDES:");
      console.log("   # Créer le compte et recevoir des tokens:");
      console.log("   spl-token create-account 3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
      console.log("");
      console.log("   # Ou contactez l'équipe pour le faucet");
      return;
    }

    console.log("✅ Le compte token existe!");
    console.log(`   Owner: ${accountInfo.owner.toString()}`);
    console.log(`   Data Length: ${accountInfo.data.length} bytes`);
    console.log("");

    // Parser le solde Token-2022
    const data = accountInfo.data;
    
    if (data.length < 72) {
      console.log("❌ ERREUR: Données du compte token invalides");
      console.log(`   Taille attendue: >= 72 bytes`);
      console.log(`   Taille actuelle: ${data.length} bytes`);
      return;
    }

    // Structure Token-2022:
    // - mint: 32 bytes (offset 0)
    // - owner: 32 bytes (offset 32)
    // - amount: 8 bytes (offset 64)
    // - delegate: 36 bytes (offset 72) optionnel
    // - state: 1 byte
    // - etc.

    const mint = new PublicKey(data.slice(0, 32));
    const owner = new PublicKey(data.slice(32, 64));
    const amount = data.readBigUInt64LE(64);
    const balance = Number(amount) / 1e9; // 9 décimales

    console.log("📊 DÉTAILS DU COMPTE TOKEN:");
    console.log(`   Mint: ${mint.toString()}`);
    console.log(`   Owner: ${owner.toString()}`);
    console.log(`   Amount (raw): ${amount.toString()}`);
    console.log("");
    console.log("🎯 SOLDE $BACK:");
    console.log(`   ${balance.toFixed(9)} $BACK`);
    console.log("");

    if (balance === 0) {
      console.log("⚠️  SOLDE VIDE!");
      console.log("   Le compte existe mais ne contient aucun token.");
      console.log("");
      console.log("📋 PROCHAINES ÉTAPES:");
      console.log("   1. Contactez l'équipe pour recevoir des $BACK tokens");
      console.log("   2. Ou utilisez le faucet si disponible");
      console.log("   3. Vérifiez que vous êtes bien sur devnet");
    } else {
      console.log("✅ TOUT EST OK!");
      console.log("   Vous pouvez maintenant tester le lock de tokens.");
    }

  } catch (error) {
    console.error("\n❌ ERREUR:", error.message);
    if (error.message.includes("Invalid public key")) {
      console.log("\n💡 L'adresse wallet fournie n'est pas valide.");
    }
  }
}

// Utilisation
const walletAddress = process.argv[2];
if (!walletAddress) {
  console.log("\n❌ Usage: node check-back-balance.js <WALLET_ADDRESS>");
  console.log("\nExemple:");
  console.log("  node check-back-balance.js 9hXx9ZTYjG3hKRdU1vF3d5RW4GQPZjT2Hs7bKmNqBp8e");
  process.exit(1);
}

checkBalance(walletAddress);
