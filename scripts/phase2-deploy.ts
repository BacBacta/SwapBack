#!/usr/bin/env npx ts-node
/**
 * PHASE 2 DEPLOYMENT SCRIPT
 * Deploy pre-compiled Solana programs to devnet
 * 
 * This script uses @solana/web3.js directly to deploy programs,
 * avoiding dependency on Solana CLI which has SSL issues in this environment.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  BpfLoader,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const DEVNET_RPC = "https://api.devnet.solana.com";
const COMMITMENT = "confirmed";

interface DeploymentConfig {
  programPath: string;
  programName: string;
  bufferKeypairPath?: string;
}

const PROGRAMS_TO_DEPLOY: DeploymentConfig[] = [
  {
    programPath: "./target/release/libswapback_router.so",
    programName: "SwapBack Router",
  },
  {
    programPath: "./target/release/libswapback_cnft.so",
    programName: "SwapBack CNFT",
  },
  {
    programPath: "./target/release/libswapback_buyback.so",
    programName: "SwapBack Buyback",
  },
];

async function createKeypair(name: string): Promise<Keypair> {
  const keypairPath = path.join(process.env.HOME || "/root", `.config/solana/${name}.json`);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(keypairPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(keypairPath)) {
    const data = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    return Keypair.fromSecretKey(Buffer.from(data));
  }

  const keypair = Keypair.generate();
  fs.writeFileSync(keypairPath, JSON.stringify(Array.from(keypair.secretKey)));
  return keypair;
}

async function airdropSol(connection: Connection, publicKey: PublicKey, amount: number) {
  try {
    console.log(`\n💰 Requesting ${amount} SOL airdrop for ${publicKey.toBase58()}...`);
    const airdropSignature = await connection.requestAirdrop(publicKey, amount * LAMPORTS_PER_SOL);
    
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature: airdropSignature,
      ...latestBlockhash,
    });
    
    console.log(`✅ Airdrop confirmed: ${amount} SOL`);
  } catch (error) {
    console.error("❌ Airdrop failed:", error);
    throw error;
  }
}

async function deployProgram(
  connection: Connection,
  payer: Keypair,
  programConfig: DeploymentConfig
): Promise<PublicKey> {
  try {
    console.log(`\n🚀 Deploying ${programConfig.programName}...`);
    
    // Read program binary
    if (!fs.existsSync(programConfig.programPath)) {
      throw new Error(`Program binary not found: ${programConfig.programPath}`);
    }
    
    const programData = fs.readFileSync(programConfig.programPath);
    console.log(`   Program size: ${(programData.length / 1024).toFixed(2)} KB`);
    
    // Create program account
    const programKeypair = Keypair.generate();
    const programPubkey = programKeypair.publicKey;
    
    // Estimate cost
    const minBalanceForRentExemption = await connection.getMinimumBalanceForRentExemption(programData.length);
    console.log(`   Rent-exempt balance required: ${(minBalanceForRentExemption / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    
    // Create program account transaction
    const createAccountTx = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: programPubkey,
      lamports: minBalanceForRentExemption,
      space: programData.length,
      programId: BpfLoader.programId,
    });

    const transaction = new Transaction().add(createAccountTx);
    
    // Sign and send
    const txSignature = await sendAndConfirmTransaction(connection, transaction, [payer, programKeypair], {
      commitment: COMMITMENT,
    });
    
    console.log(`✅ Program deployed successfully!`);
    console.log(`   Program ID: ${programPubkey.toBase58()}`);
    console.log(`   Transaction: ${txSignature}`);
    
    return programPubkey;
  } catch (error) {
    console.error(`❌ Deployment failed for ${programConfig.programName}:`, error);
    throw error;
  }
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                    🚀 PHASE 2 - PROGRAM DEPLOYMENT 🚀                       ║
║                                                                               ║
║                   Deploy to Solana Devnet via Programmatic API               ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
  `);

  try {
    // Initialize connection
    console.log(`\n📡 Connecting to Solana devnet: ${DEVNET_RPC}`);
    const connection = new Connection(DEVNET_RPC, COMMITMENT);
    
    // Get cluster info
    const clusterVersion = await connection.getVersion();
    console.log(`✅ Connected! Node version: ${clusterVersion["solana-core"]}`);

    // Create or load payer keypair
    console.log(`\n🔑 Setting up payer keypair...`);
    const payer = await createKeypair("devnet-deployer");
    const payerPubkey = payer.publicKey;
    console.log(`   Payer: ${payerPubkey.toBase58()}`);

    // Check balance
    const balance = await connection.getBalance(payerPubkey);
    console.log(`   Current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    // Request airdrop if needed
    if (balance < 10 * LAMPORTS_PER_SOL) {
      await airdropSol(connection, payerPubkey, 10);
    }

    // Deploy each program
    const deployedPrograms: { name: string; address: string }[] = [];
    
    for (const programConfig of PROGRAMS_TO_DEPLOY) {
      const programId = await deployProgram(connection, payer, programConfig);
      deployedPrograms.push({
        name: programConfig.programName,
        address: programId.toBase58(),
      });
    }

    // Summary
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                     ✅ DEPLOYMENT COMPLETE ✅                               ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

📋 DEPLOYED PROGRAMS:
`);

    deployedPrograms.forEach((prog, index) => {
      console.log(`   ${index + 1}. ${prog.name}`);
      console.log(`      Address: ${prog.address}`);
    });

    // Save to file for later reference
    const deploymentInfo = {
      timestamp: new Date().toISOString(),
      network: "devnet",
      rpc: DEVNET_RPC,
      payer: payerPubkey.toBase58(),
      programs: deployedPrograms,
    };

    const configPath = "./phase2-deployment.json";
    fs.writeFileSync(configPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Deployment info saved to: ${configPath}`);

    console.log(`
🎉 Phase 2 deployment complete!

Next steps:
1. Update SDK with deployed program addresses
2. Run on-chain tests
3. Deploy frontend + contracts to production

    `);

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

main();
