/**
 * Jito Bundle Builder
 * Regroupe plusieurs transactions TWAP en un seul bundle atomique
 */

import { PublicKey, SystemProgram } from "@solana/web3.js";

// Jito Block Engine endpoints avec failover
const JITO_ENDPOINTS = [
  "https://mainnet.block-engine.jito.wtf",
  "https://amsterdam.mainnet.block-engine.jito.wtf",
  "https://frankfurt.mainnet.block-engine.jito.wtf",
  "https://ny.mainnet.block-engine.jito.wtf",
  "https://tokyo.mainnet.block-engine.jito.wtf",
];

// Jito tip accounts (mainnet)
const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4bVmkdzGdnq3MoGDJCCDWsz",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSLxJfDL2xEMvEkFNUN",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKEOkUWLbEPL2sNAAGCAX",
];

export interface BundleTransaction {
  id: string;
  transactionBase64: string;
  priority: number;
  metadata?: {
    intentType: string;
    amount: string;
    sliceIndex?: number;
  };
}

export interface BundleResult {
  success: boolean;
  bundleId?: string;
  error?: string;
  endpoint?: string;
  latencyMs: number;
  transactionCount: number;
}

export interface BundleConfig {
  maxTransactions: number;
  tipLamports: number;
  maxRetries: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: BundleConfig = {
  maxTransactions: 5,
  tipLamports: 10000, // 0.00001 SOL
  maxRetries: 3,
  timeoutMs: 30000,
};

export class JitoBundleBuilder {
  private transactions: BundleTransaction[] = [];
  private config: BundleConfig;

  constructor(config: Partial<BundleConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Ajoute une transaction au bundle
   */
  addTransaction(tx: BundleTransaction): boolean {
    if (this.transactions.length >= this.config.maxTransactions) {
      console.warn(`[JitoBundle] Bundle plein (max ${this.config.maxTransactions})`);
      return false;
    }
    this.transactions.push(tx);
    this.transactions.sort((a, b) => a.priority - b.priority);
    return true;
  }

  /**
   * Ajoute plusieurs transactions
   */
  addTransactions(txs: BundleTransaction[]): number {
    let added = 0;
    for (const tx of txs) {
      if (this.addTransaction(tx)) added++;
    }
    return added;
  }

  /**
   * Retourne un tip account aléatoire
   */
  private getRandomTipAccount(): PublicKey {
    const index = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
    return new PublicKey(JITO_TIP_ACCOUNTS[index]);
  }

  /**
   * Crée l'instruction de tip
   */
  createTipInstruction(payerPubkey: PublicKey) {
    return SystemProgram.transfer({
      fromPubkey: payerPubkey,
      toPubkey: this.getRandomTipAccount(),
      lamports: this.config.tipLamports,
    });
  }

  /**
   * Envoie le bundle à Jito avec failover
   */
  async submitBundle(signedTxsBase64: string[]): Promise<BundleResult> {
    if (signedTxsBase64.length === 0) {
      return { success: false, error: "Aucune transaction", latencyMs: 0, transactionCount: 0 };
    }

    const startTime = Date.now();
    let lastError: string | undefined;

    for (let retry = 0; retry < this.config.maxRetries; retry++) {
      for (const endpoint of JITO_ENDPOINTS) {
        try {
          const response = await fetch(`${endpoint}/api/v1/bundles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "sendBundle",
              params: [signedTxsBase64],
            }),
            signal: AbortSignal.timeout(this.config.timeoutMs),
          });

          if (!response.ok) {
            lastError = `${endpoint} returned ${response.status}`;
            continue;
          }

          const result = await response.json();

          if (result.error) {
            lastError = result.error.message || JSON.stringify(result.error);
            continue;
          }

          const bundleId = result.result;
          return {
            success: true,
            bundleId,
            endpoint,
            latencyMs: Date.now() - startTime,
            transactionCount: signedTxsBase64.length,
          };
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Unknown error";
          continue;
        }
      }
    }

    return {
      success: false,
      error: lastError || "All Jito endpoints failed",
      latencyMs: Date.now() - startTime,
      transactionCount: signedTxsBase64.length,
    };
  }

  /**
   * Vérifie le statut d'un bundle
   */
  async getBundleStatus(bundleId: string): Promise<{
    status: "pending" | "landed" | "failed";
    slot?: number;
    error?: string;
  }> {
    for (const endpoint of JITO_ENDPOINTS) {
      try {
        const response = await fetch(`${endpoint}/api/v1/bundles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getBundleStatuses",
            params: [[bundleId]],
          }),
        });

        if (!response.ok) continue;

        const result = await response.json();
        const statuses = result.result?.value;

        if (statuses && statuses.length > 0) {
          const status = statuses[0];
          if (status.confirmation_status === "confirmed" || status.confirmation_status === "finalized") {
            return { status: "landed", slot: status.slot };
          }
          if (status.err) {
            return { status: "failed", error: JSON.stringify(status.err) };
          }
          return { status: "pending" };
        }
      } catch {
        continue;
      }
    }
    return { status: "pending" };
  }

  /**
   * Attend la confirmation du bundle
   */
  async waitForConfirmation(bundleId: string, maxWaitMs = 60000): Promise<BundleResult> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getBundleStatus(bundleId);

      if (status.status === "landed") {
        return {
          success: true,
          bundleId,
          latencyMs: Date.now() - startTime,
          transactionCount: this.transactions.length,
        };
      }

      if (status.status === "failed") {
        return {
          success: false,
          bundleId,
          error: status.error,
          latencyMs: Date.now() - startTime,
          transactionCount: this.transactions.length,
        };
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    return {
      success: false,
      bundleId,
      error: "Timeout",
      latencyMs: Date.now() - startTime,
      transactionCount: this.transactions.length,
    };
  }

  clear(): void {
    this.transactions = [];
  }

  getStats() {
    return {
      transactionCount: this.transactions.length,
      tipLamports: this.config.tipLamports,
      maxTransactions: this.config.maxTransactions,
    };
  }
}

/**
 * Helper pour créer un bundle TWAP
 */
export function createTwapBundleBuilder(
  intents: Array<{ transactionBase64: string; sliceIndex: number; amount: string }>,
  config?: Partial<BundleConfig>
): JitoBundleBuilder {
  const builder = new JitoBundleBuilder(config);

  for (const intent of intents) {
    builder.addTransaction({
      id: `twap-slice-${intent.sliceIndex}`,
      transactionBase64: intent.transactionBase64,
      priority: intent.sliceIndex,
      metadata: {
        intentType: "twap",
        amount: intent.amount,
        sliceIndex: intent.sliceIndex,
      },
    });
  }

  return builder;
}
