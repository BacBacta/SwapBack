/**
 * Validation stricte des variables d'environnement critiques
 * Fail-fast pour éviter les erreurs AccountOwnedByWrongProgram
 */

import { PublicKey } from "@solana/web3.js";
import cnftIdl from "@/idl/swapback_cnft.json";

export interface EnvConfig {
  network: string;
  rpcUrl: string;
  cnftProgramId: string;
  backMint: string;
  collectionConfig: string;
}

/**
 * Valide que toutes les variables d'environnement critiques sont présentes
 * et cohérentes avec l'IDL déployé
 */
export function validateEnv(): EnvConfig {
  const errors: string[] = [];

  // 1. Vérifier la présence des variables critiques
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (!network) {
    errors.push("NEXT_PUBLIC_SOLANA_NETWORK is required");
  }

  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) {
    errors.push("NEXT_PUBLIC_SOLANA_RPC_URL is required");
  }

  const cnftProgramId = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID;
  if (!cnftProgramId) {
    errors.push(
      "NEXT_PUBLIC_CNFT_PROGRAM_ID is required - This variable is CRITICAL to avoid AccountOwnedByWrongProgram errors"
    );
  }

  const backMint = process.env.NEXT_PUBLIC_BACK_MINT;
  if (!backMint) {
    errors.push("NEXT_PUBLIC_BACK_MINT is required");
  }

  const collectionConfig = process.env.NEXT_PUBLIC_COLLECTION_CONFIG;
  if (!collectionConfig) {
    errors.push("NEXT_PUBLIC_COLLECTION_CONFIG is required");
  }

  // Si des variables manquent, échouer immédiatement
  if (errors.length > 0) {
    throw new Error(
      `❌ Environment validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}\n\n` +
        `💡 Add these variables to:\n` +
        `   - Local: app/.env.local\n` +
        `   - Vercel: Settings > Environment Variables\n` +
        `   - CI: GitHub Secrets or equivalent\n\n` +
        `📖 See app/VERCEL_ENV_VARIABLES.md for complete setup guide`
    );
  }

  // 2. Vérifier que CNFT_PROGRAM_ID correspond à l'IDL
  const idlAddress = cnftIdl.address;
  if (cnftProgramId !== idlAddress) {
    throw new Error(
      `❌ CRITICAL: NEXT_PUBLIC_CNFT_PROGRAM_ID mismatch!\n\n` +
        `  Environment variable: ${cnftProgramId}\n` +
        `  IDL program address:  ${idlAddress}\n\n` +
        `This mismatch WILL cause AccountOwnedByWrongProgram errors.\n` +
        `PDAs derived with wrong program ID won't match on-chain accounts.\n\n` +
        `✅ Fix: Set NEXT_PUBLIC_CNFT_PROGRAM_ID=${idlAddress}`
    );
  }

  // 3. Vérifier que ce sont des PublicKey valides
  try {
    new PublicKey(cnftProgramId);
    new PublicKey(backMint);
    new PublicKey(collectionConfig);
  } catch (error) {
    throw new Error(
      `❌ Invalid PublicKey format in environment variables:\n${error instanceof Error ? error.message : String(error)}`
    );
  }

  // 4. Validation spécifique pour devnet
  if (network === "devnet") {
    // Vérifier que BACK_MINT correspond au token devnet attendu
    const expectedDevnetBackMint =
      "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
    if (backMint !== expectedDevnetBackMint) {
      console.warn(
        `⚠️  WARNING: BACK_MINT (${backMint}) differs from expected devnet mint (${expectedDevnetBackMint})`
      );
    }

    // Vérifier que le RPC est bien devnet
    if (!rpcUrl.includes("devnet")) {
      console.warn(
        `⚠️  WARNING: Network is 'devnet' but RPC URL doesn't contain 'devnet': ${rpcUrl}`
      );
    }
  }

  console.log("✅ Environment validation passed");
  console.log(`   Network: ${network}`);
  console.log(`   CNFT Program: ${cnftProgramId}`);
  console.log(`   BACK Mint: ${backMint}`);
  console.log(`   Collection Config: ${collectionConfig}`);

  return {
    network: network!,
    rpcUrl: rpcUrl!,
    cnftProgramId: cnftProgramId!,
    backMint: backMint!,
    collectionConfig: collectionConfig!,
  };
}

/**
 * Vérifie que l'environnement est correctement configuré pour le devnet
 */
export function ensureDevnetConfig(): void {
  const config = validateEnv();

  if (config.network !== "devnet") {
    throw new Error(
      `❌ Expected devnet but got '${config.network}'. ` +
        `Set NEXT_PUBLIC_SOLANA_NETWORK=devnet`
    );
  }

  // Vérifier que le Program ID correspond au déploiement devnet
  const expectedDevnetProgramId =
    "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq";
  if (config.cnftProgramId !== expectedDevnetProgramId) {
    throw new Error(
      `❌ Expected devnet CNFT Program ${expectedDevnetProgramId} but got ${config.cnftProgramId}`
    );
  }

  console.log("✅ Devnet configuration validated");
}
