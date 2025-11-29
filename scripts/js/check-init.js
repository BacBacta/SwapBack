const { Connection, PublicKey } = require("@solana/web3.js");

const CNFT_PROGRAM_ID = new PublicKey("9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq");
const RPC = "https://api.devnet.solana.com";

async function checkAccounts() {
  const connection = new Connection(RPC, "confirmed");
  
  console.log("Verification des comptes du programme...\n");
  
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );
  
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );
  
  console.log("Program ID:", CNFT_PROGRAM_ID.toString());
  console.log("CollectionConfig PDA:", collectionConfig.toString());
  console.log("GlobalState PDA:", globalState.toString());
  console.log("");
  
  const collectionInfo = await connection.getAccountInfo(collectionConfig);
  if (collectionInfo) {
    console.log("CollectionConfig: INITIALISE");
    console.log("   Owner:", collectionInfo.owner.toString());
  } else {
    console.log("CollectionConfig: NON initialise - DOIT ETRE INITIALISE AVANT LOCK");
    return false;
  }
  
  console.log("");
  
  const stateInfo = await connection.getAccountInfo(globalState);
  if (stateInfo) {
    console.log("GlobalState: INITIALISE");
    console.log("   Owner:", stateInfo.owner.toString());
  } else {
    console.log("GlobalState: NON initialise - DOIT ETRE INITIALISE AVANT LOCK");
    return false;
  }
  
  return true;
}

checkAccounts()
  .then(ready => {
    if (!ready) {
      console.log("\n❌ Les comptes doivent etre initialises avant de pouvoir lock des tokens");
      console.log("Executez les instructions initialize_collection et initialize_global_state");
      process.exit(1);
    } else {
      console.log("\n✅ Tous les comptes sont prets pour le lock");
    }
  })
  .catch(console.error);
