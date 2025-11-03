const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { AnchorProvider, Program, web3 } = require("@coral-xyz/anchor");
const fs = require("fs");
const idl = require("./app/src/idl/swapback_cnft.json");

const CNFT_PROGRAM_ID = new PublicKey("9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq");
const RPC = "https://api.devnet.solana.com";

// Lire la keypair depuis devnet-keypair.json
const keypairData = JSON.parse(fs.readFileSync("./devnet-keypair.json", "utf-8"));
const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));

async function initializeAccounts() {
  console.log("🚀 Initialisation des comptes du programme CNFT\n");
  console.log("Program ID:", CNFT_PROGRAM_ID.toString());
  console.log("Payer:", payer.publicKey.toString());
  console.log("");
  
  const connection = new Connection(RPC, "confirmed");
  
  // Créer le provider Anchor
  const wallet = {
    publicKey: payer.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(payer);
      return tx;
    },
    signAllTransactions: async (txs) => {
      txs.forEach(tx => tx.partialSign(payer));
      return txs;
    },
  };
  
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new Program(idl, provider);
  
  // Dériver les PDAs
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );
  
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );
  
  console.log("CollectionConfig PDA:", collectionConfig.toString());
  console.log("GlobalState PDA:", globalState.toString());
  console.log("");
  
  // Vérifier et initialiser collection_config
  const collectionInfo = await connection.getAccountInfo(collectionConfig);
  if (!collectionInfo) {
    console.log("📝 Initialisation de CollectionConfig...");
    try {
      // Pour initialize_collection, on a besoin d'un tree_config
      // Utilisons un placeholder pour le moment
      const dummyTreeConfig = Keypair.generate().publicKey;
      
      const tx = await program.methods
        .initializeCollection()
        .accounts({
          collectionConfig,
          treeConfig: dummyTreeConfig,
          authority: payer.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .transaction();
      
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      console.log("✅ CollectionConfig initialisé");
      console.log("   Signature:", sig);
    } catch (error) {
      console.log("❌ Erreur initialisation CollectionConfig:", error.message);
      if (error.logs) console.log("   Logs:", error.logs.join("\n   "));
    }
  } else {
    console.log("✅ CollectionConfig déjà initialisé");
  }
  
  console.log("");
  
  // Vérifier et initialiser global_state
  const stateInfo = await connection.getAccountInfo(globalState);
  if (!stateInfo) {
    console.log("📝 Initialisation de GlobalState...");
    try {
      const tx = await program.methods
        .initializeGlobalState()
        .accounts({
          globalState,
          authority: payer.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .transaction();
      
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      console.log("✅ GlobalState initialisé");
      console.log("   Signature:", sig);
    } catch (error) {
      console.log("❌ Erreur initialisation GlobalState:", error.message);
      if (error.logs) console.log("   Logs:", error.logs.join("\n   "));
    }
  } else {
    console.log("✅ GlobalState déjà initialisé");
  }
  
  console.log("\n🎉 Initialisation terminée ! Le programme est prêt pour lock des tokens.");
}

initializeAccounts().catch(err => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
