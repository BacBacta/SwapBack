/**
 * 🛠️ SOLANA HELPERS - Utilitaires pour tests
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * Airdrop de SOL si le solde est insuffisant
 */
export async function airdropIfNeeded(
  connection: Connection,
  publicKey: PublicKey,
  targetBalance: number
): Promise<void> {
  const balance = await connection.getBalance(publicKey);
  
  if (balance < targetBalance) {
    const amountNeeded = targetBalance - balance;
    console.log(`   🪂 Airdrop: ${amountNeeded / LAMPORTS_PER_SOL} SOL...`);
    
    try {
      const signature = await connection.requestAirdrop(publicKey, amountNeeded);
      await connection.confirmTransaction(signature, "confirmed");
      console.log(`   ✓ Airdrop reçu`);
    } catch (error) {
      console.log(`   ⚠ Airdrop échoué (rate limit ou devnet down)`);
      // Non-fatal: continuer avec le solde actuel
    }
  }
}

/**
 * Attendre que le solde soit suffisant
 */
export async function waitForBalance(
  connection: Connection,
  publicKey: PublicKey,
  minBalance: number,
  timeoutMs = 30000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const balance = await connection.getBalance(publicKey);
    if (balance >= minBalance) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  return false;
}

/**
 * Formater un montant en SOL pour affichage
 */
export function formatSOL(lamports: number): string {
  return `${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`;
}
