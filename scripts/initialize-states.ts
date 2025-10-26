/**
 * 🔧 Script d'Initialisation des States - Système de Boost SwapBack
 * 
 * Ce script initialise les comptes de state pour les 3 programmes:
 * - GlobalState (swapback_cnft)
 * - RouterState (swapback_router)
 * - BuybackState (swapback_buyback)
 * 
 * @author SwapBack Team
 * @date October 26, 2025
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Couleurs pour les logs
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║                                                                   ║");
  console.log("║         🔧 INITIALISATION DES STATES - SYSTÈME DE BOOST          ║");
  console.log("║                                                                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  // Charger les Program IDs depuis le fichier de déploiement
  const deployedIdsPath = path.join(__dirname, "../deployed-program-ids.json");
  let programIds: any;

  if (fs.existsSync(deployedIdsPath)) {
    programIds = JSON.parse(fs.readFileSync(deployedIdsPath, "utf-8"));
    console.log(`${colors.green}✅ Program IDs chargés depuis deployed-program-ids.json${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠️  Fichier deployed-program-ids.json non trouvé${colors.reset}`);
    console.log(`${colors.yellow}Utilisation des IDs par défaut depuis Anchor.toml${colors.reset}\n`);
    
    // Fallback sur les IDs dans Anchor.toml
    programIds = {
      programs: {
        swapback_cnft: "CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH",
        swapback_router: "3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap",
        swapback_buyback: "71vALqj3cmQWDmq9bi9GYYDPQqpoRstej3snUbikpCHW",
      }
    };
  }

  // Configuration de la connexion
  const network = "https://api.devnet.solana.com";
  const connection = new Connection(network, "confirmed");

  console.log(`${colors.blue}📡 Connexion à: ${network}${colors.reset}\n`);

  // Charger le wallet
  const walletPath = path.join(
    process.env.HOME || "",
    ".config/solana/id.json"
  );

  let wallet: Keypair;
  
  if (fs.existsSync(walletPath)) {
    const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    console.log(`${colors.green}✅ Wallet chargé: ${wallet.publicKey.toString()}${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Wallet non trouvé à ${walletPath}${colors.reset}`);
    console.log(`${colors.yellow}Création d'un nouveau wallet...${colors.reset}`);
    wallet = Keypair.generate();
    
    // Sauvegarder le wallet
    fs.writeFileSync(
      walletPath,
      JSON.stringify(Array.from(wallet.secretKey))
    );
    console.log(`${colors.green}✅ Nouveau wallet créé et sauvegardé${colors.reset}`);
  }

  // Vérifier le solde
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`${colors.blue}💰 Solde: ${balance / 1e9} SOL${colors.reset}\n`);

  if (balance < 0.1 * 1e9) {
    console.log(`${colors.yellow}⚠️  Solde insuffisant pour l'initialisation${colors.reset}`);
    console.log(`${colors.yellow}Demandez un airdrop avec: solana airdrop 2${colors.reset}\n`);
    process.exit(1);
  }

  // Créer le provider
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: "confirmed" }
  );

  anchor.setProvider(provider);

  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("                    INITIALISATION DES STATES                      ");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // 1. Initialiser GlobalState (swapback_cnft)
  console.log(`${colors.blue}1️⃣  Initialisation de GlobalState (swapback_cnft)...${colors.reset}`);
  
  try {
    const cnftProgramId = new PublicKey(programIds.programs.swapback_cnft);
    
    // Charger le programme
    const cnftIdl = JSON.parse(
      fs.readFileSync("target/idl/swapback_cnft.json", "utf-8")
    );
    const cnftProgram = new Program(cnftIdl, cnftProgramId, provider);

    // Dériver le PDA GlobalState
    const [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      cnftProgramId
    );

    console.log(`   PDA GlobalState: ${globalState.toString()}`);

    // Vérifier si déjà initialisé
    try {
      const existingState = await cnftProgram.account.globalState.fetch(globalState);
      console.log(`   ${colors.yellow}⚠️  GlobalState déjà initialisé${colors.reset}`);
      console.log(`   Total Community Boost: ${existingState.totalCommunityBoost}`);
      console.log(`   Active Locks: ${existingState.activeLocksCount}`);
    } catch (error) {
      // Pas encore initialisé, on l'initialise
      console.log(`   ${colors.yellow}Envoi de la transaction...${colors.reset}`);
      
      const tx = await cnftProgram.methods
        .initializeGlobalState()
        .accounts({
          globalState,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`   ${colors.green}✅ GlobalState initialisé !${colors.reset}`);
      console.log(`   Transaction: ${tx}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
    }
  } catch (error: any) {
    console.log(`   ${colors.red}❌ Erreur: ${error.message}${colors.reset}\n`);
  }

  // 2. Initialiser RouterState (swapback_router)
  console.log(`${colors.blue}2️⃣  Initialisation de RouterState (swapback_router)...${colors.reset}`);
  
  try {
    const routerProgramId = new PublicKey(programIds.programs.swapback_router);
    
    const routerIdl = JSON.parse(
      fs.readFileSync("target/idl/swapback_router.json", "utf-8")
    );
    const routerProgram = new Program(routerIdl, routerProgramId, provider);

    const [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      routerProgramId
    );

    console.log(`   PDA RouterState: ${routerState.toString()}`);

    try {
      const existingState = await routerProgram.account.routerState.fetch(routerState);
      console.log(`   ${colors.yellow}⚠️  RouterState déjà initialisé${colors.reset}`);
    } catch (error) {
      console.log(`   ${colors.yellow}Envoi de la transaction...${colors.reset}`);
      
      const tx = await routerProgram.methods
        .initialize()
        .accounts({
          state: routerState,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`   ${colors.green}✅ RouterState initialisé !${colors.reset}`);
      console.log(`   Transaction: ${tx}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
    }
  } catch (error: any) {
    console.log(`   ${colors.red}❌ Erreur: ${error.message}${colors.reset}\n`);
  }

  // 3. Initialiser BuybackState (swapback_buyback)
  console.log(`${colors.blue}3️⃣  Initialisation de BuybackState (swapback_buyback)...${colors.reset}`);
  
  try {
    const buybackProgramId = new PublicKey(programIds.programs.swapback_buyback);
    
    const buybackIdl = JSON.parse(
      fs.readFileSync("target/idl/swapback_buyback.json", "utf-8")
    );
    const buybackProgram = new Program(buybackIdl, buybackProgramId, provider);

    const [buybackState] = PublicKey.findProgramAddressSync(
      [Buffer.from("buyback_state")],
      buybackProgramId
    );

    console.log(`   PDA BuybackState: ${buybackState.toString()}`);

    try {
      const existingState = await buybackProgram.account.buybackState.fetch(buybackState);
      console.log(`   ${colors.yellow}⚠️  BuybackState déjà initialisé${colors.reset}`);
      console.log(`   Total USDC Spent: ${existingState.totalUsdcSpent}`);
      console.log(`   Total BACK Burned: ${existingState.totalBackBurned}`);
    } catch (error) {
      console.log(`   ${colors.yellow}⚠️  Initialisation de BuybackState nécessite:${colors.reset}`);
      console.log(`   • back_mint: PublicKey du token $BACK`);
      console.log(`   • min_buyback_amount: Montant minimum (ex: 1 USDC)`);
      console.log(`   ${colors.yellow}Utilisez le script spécifique: npm run init:buyback${colors.reset}\n`);
    }
  } catch (error: any) {
    console.log(`   ${colors.red}❌ Erreur: ${error.message}${colors.reset}\n`);
  }

  // Résumé final
  console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ INITIALISATION TERMINÉE !                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  console.log(`${colors.green}📊 États initialisés:${colors.reset}`);
  console.log("  ✅ GlobalState (swapback_cnft)");
  console.log("  ✅ RouterState (swapback_router)");
  console.log("  ⚠️  BuybackState (swapback_buyback) - nécessite configuration manuelle\n");

  console.log(`${colors.yellow}📝 Prochaines étapes:${colors.reset}`);
  console.log("  1. Configurer BuybackState avec le mint $BACK");
  console.log("  2. Tester le système avec: npm run test:boost");
  console.log("  3. Mettre à jour le frontend avec les Program IDs\n");

  console.log("🎉 Système de boost prêt pour les tests !\n");
}

// Exécution
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`${colors.red}❌ Erreur fatale:${colors.reset}`, error);
    process.exit(1);
  });
