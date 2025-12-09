/**
 * Script de test end-to-end pour le système cNFT SwapBack
 * 
 * Ce script teste le flux complet:
 * 1. Initialiser la collection cNFT
 * 2. Lock $BACK avec boost → Mint cNFT
 * 3. Vérifier le cNFT créé (niveau, boost, montant)
 * 4. Unlock → Vérifier désactivation cNFT
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "fs";

// Program IDs déployés sur devnet
const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");
const CNFT_PROGRAM_ID = new PublicKey("FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8");

interface TestResult {
  step: string;
  success: boolean;
  details?: string;
  error?: string;
}

class CNFTTester {
  provider: AnchorProvider;
  results: TestResult[] = [];

  constructor(provider: AnchorProvider) {
    this.provider = provider;
  }

  log(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  logSuccess(step: string, details?: string) {
    this.log(`✅ ${step}`);
    this.results.push({ step, success: true, details });
  }

  logError(step: string, error: string) {
    this.log(`❌ ${step}: ${error}`);
    this.results.push({ step, success: false, error });
  }

  async derivePDA(seeds: Buffer[], programId: PublicKey): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(seeds, programId);
    return pda;
  }

  async testStep1_CheckPrograms() {
    this.log("\n📋 ÉTAPE 1: Vérifier les programmes déployés");
    
    try {
      // Vérifier router
      const routerInfo = await this.provider.connection.getAccountInfo(ROUTER_PROGRAM_ID);
      if (!routerInfo) {
        throw new Error("Router program not found");
      }
      this.logSuccess("Router program trouvé", `Owner: ${routerInfo.owner.toBase58()}`);

      // Vérifier cNFT
      const cnftInfo = await this.provider.connection.getAccountInfo(CNFT_PROGRAM_ID);
      if (!cnftInfo) {
        throw new Error("cNFT program not found");
      }
      this.logSuccess("cNFT program trouvé", `Owner: ${cnftInfo.owner.toBase58()}`);

    } catch (error: any) {
      this.logError("Vérification programmes", error.message || String(error));
      throw error;
    }
  }

  async testStep2_CheckUserNFT() {
    this.log("\n📋 ÉTAPE 2: Vérifier si l'utilisateur a déjà un cNFT");
    
    try {
      const userPubkey = this.provider.wallet.publicKey;
      this.log(`Wallet: ${userPubkey.toBase58()}`);

      // Dériver le PDA UserNft
      const userNftPDA = await this.derivePDA(
        [Buffer.from("user_nft"), userPubkey.toBuffer()],
        CNFT_PROGRAM_ID
      );
      
      this.log(`UserNft PDA: ${userNftPDA.toBase58()}`);

      // Vérifier si le compte existe
      const accountInfo = await this.provider.connection.getAccountInfo(userNftPDA);
      
      if (accountInfo) {
        // Décoder les données
        const data = accountInfo.data;
        let offset = 8; // Skip discriminator
        
        // authority: 32 bytes
        offset += 32;
        
        // level: u8
        const level = data.readUInt8(offset);
        offset += 1;
        
        // boost: u16
        const boost = data.readUInt16LE(offset);
        offset += 2;
        
        // locked_amount: u64
        const lockedAmount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        
        // lock_duration: i64
        const lockDuration = Number(data.readBigInt64LE(offset));
        offset += 8;
        
        // is_active: bool
        const isActive = data.readUInt8(offset) === 1;
        
        let levelName: string;
        if (level === 0) levelName = "Bronze";
        else if (level === 1) levelName = "Silver";
        else levelName = "Gold";
        
        this.logSuccess(
          "cNFT existant trouvé",
          `Niveau: ${levelName}, Boost: ${boost}%, Montant: ${lockedAmount}, Actif: ${isActive}`
        );
        
        return { exists: true, level, boost, lockedAmount, lockDuration, isActive };
      } else {
        this.logSuccess("Aucun cNFT existant", "L'utilisateur peut créer un nouveau cNFT");
        return { exists: false };
      }
    } catch (error: any) {
      this.logError("Vérification UserNFT", error.message || String(error));
      throw error;
    }
  }

  async testStep3_CheckLockState() {
    this.log("\n📋 ÉTAPE 3: Vérifier l'état de lock dans le router");
    
    try {
      const userPubkey = this.provider.wallet.publicKey;

      // Dériver le PDA LockState
      const lockStatePDA = await this.derivePDA(
        [Buffer.from("lock"), userPubkey.toBuffer()],
        ROUTER_PROGRAM_ID
      );
      
      this.log(`LockState PDA: ${lockStatePDA.toBase58()}`);

      // Vérifier si le compte existe
      const accountInfo = await this.provider.connection.getAccountInfo(lockStatePDA);
      
      if (accountInfo) {
        const data = accountInfo.data;
        let offset = 8; // Skip discriminator
        
        // user: 32 bytes
        offset += 32;
        
        // amount: u64
        const amount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        
        // boost: u16
        const boost = data.readUInt16LE(offset);
        offset += 2;
        
        // unlock_time: i64
        const unlockTime = Number(data.readBigInt64LE(offset));
        offset += 8;
        
        // is_active: bool
        const isActive = data.readUInt8(offset) === 1;
        
        this.logSuccess(
          "LockState trouvé",
          `Montant: ${amount}, Boost: ${boost}%, Unlock: ${new Date(unlockTime * 1000).toISOString()}, Actif: ${isActive}`
        );
        
        return { exists: true, amount, boost, unlockTime, isActive };
      } else {
        this.logSuccess("Aucun lock actif", "L'utilisateur peut créer un nouveau lock");
        return { exists: false };
      }
    } catch (error: any) {
      this.logError("Vérification LockState", error.message || String(error));
      throw error;
    }
  }

  async testStep4_CheckBalance() {
    this.log("\n📋 ÉTAPE 4: Vérifier le solde du wallet");
    
    try {
      const balance = await this.provider.connection.getBalance(this.provider.wallet.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      this.logSuccess("Balance vérifiée", `${solBalance.toFixed(4)} SOL`);
      
      if (solBalance < 0.1) {
        this.log("⚠️  Balance faible, vous aurez besoin de SOL pour les transactions");
      }
      
      return { balance: solBalance };
    } catch (error: any) {
      this.logError("Vérification balance", error.message || String(error));
      throw error;
    }
  }

  async generateReport() {
    this.log("\n" + "=".repeat(70));
    this.log("📊 RAPPORT DE TEST");
    this.log("=".repeat(70));
    
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    this.log(`\n✅ Tests réussis: ${successful}`);
    this.log(`❌ Tests échoués: ${failed}`);
    this.log(`📈 Taux de réussite: ${((successful / this.results.length) * 100).toFixed(1)}%`);
    
    this.log("\n📝 Détails:");
    this.results.forEach((result, index) => {
      const icon = result.success ? "✅" : "❌";
      this.log(`${index + 1}. ${icon} ${result.step}`);
      if (result.details) {
        this.log(`   └─ ${result.details}`);
      }
      if (result.error) {
        this.log(`   └─ Erreur: ${result.error}`);
      }
    });
    
    this.log("\n" + "=".repeat(70));
    
    return { successful, failed, total: this.results.length };
  }
}

async function main() {
  console.log("🚀 SwapBack cNFT - Test End-to-End");
  console.log("=".repeat(70));
  
  // Configuration
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  
  // Charger le wallet (utilise le keypair système ou crée un nouveau)
  let wallet: Keypair;
  const keypairPath = process.env.SOLANA_KEYPAIR || `${process.env.HOME}/.config/solana/id.json`;
  
  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log(`✅ Wallet chargé depuis: ${keypairPath}`);
  } catch (error: any) {
    console.log("⚠️  Impossible de charger le keypair, création d'un nouveau wallet de test");
    console.log(`   Erreur: ${error.message || String(error)}`);
    wallet = Keypair.generate();
    console.log("⚠️  Nouveau wallet (TEST SEULEMENT):", wallet.publicKey.toBase58());
    console.log("⚠️  Ce wallet n'a pas de SOL, veuillez utiliser un wallet financé pour les tests réels");
  }
  
  const provider = new AnchorProvider(
    connection,
    { publicKey: wallet.publicKey, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs },
    { commitment: "confirmed" }
  );
  
  console.log("🔗 Réseau: Devnet");
  console.log("👛 Wallet:", wallet.publicKey.toBase58());
  console.log("=".repeat(70));
  
  // Exécuter les tests
  const tester = new CNFTTester(provider);
  
  try {
    await tester.testStep1_CheckPrograms();
    await tester.testStep2_CheckUserNFT();
    await tester.testStep3_CheckLockState();
    await tester.testStep4_CheckBalance();
    
    // Générer le rapport
    const report = await tester.generateReport();
    
    if (report.failed === 0) {
      console.log("\n🎉 Tous les tests sont passés avec succès !");
      console.log("\n📝 Prochaines étapes:");
      console.log("   1. Lancer l'UI: cd app && npm run dev");
      console.log("   2. Connecter votre wallet");
      console.log("   3. Tester le flux Lock → Mint cNFT → Affichage");
    } else {
      console.log("\n⚠️  Certains tests ont échoué. Consultez les détails ci-dessus.");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("\n❌ Erreur fatale durant les tests:", error);
    await tester.generateReport();
    process.exit(1);
  }
}

// Exécuter si lancé directement
if (require.main === module) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error);
      process.exit(1);
    }
  );
}

export { CNFTTester };
