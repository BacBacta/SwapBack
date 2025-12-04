import { Connection, PublicKey } from "@solana/web3.js";
import { monitor } from "@/lib/protocolMonitor";
import type { HybridRouteIntent } from "@/lib/routing/hybridRouting";
import { JitoBundleBuilder, createTwapBundleBuilder, type BundleResult } from "@/lib/jito";

export type ExecutionChannel = "public" | "jito" | "private-rpc";

const CHANNEL_ENDPOINTS: Record<ExecutionChannel, string | null> = {
  public: process.env.HYBRID_PUBLIC_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC ?? null,
  jito: process.env.HYBRID_JITO_RPC_URL ?? process.env.NEXT_PUBLIC_JITO_RPC_URL ?? null,
  "private-rpc": process.env.HYBRID_PRIVATE_RPC_URL ?? process.env.NEXT_PUBLIC_PRIVATE_RPC_URL ?? null,
};

const DEFAULT_RPC =
  process.env.HYBRID_WORKER_RPC_URL || CHANNEL_ENDPOINTS.public || "https://api.mainnet-beta.solana.com";

// Jito Block Engine endpoints
const JITO_BLOCK_ENGINE_URL =
  process.env.JITO_BLOCK_ENGINE_URL ?? "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
const JITO_AUTH_KEYPAIR = process.env.JITO_AUTH_KEYPAIR; // base58 private key for bundle auth (optional)

export class ExecutionClient {
  private baseConnection: Connection;
  private channelConnections: Partial<Record<ExecutionChannel, Connection>> = {};
  private bundleBuilder: JitoBundleBuilder;

  constructor() {
    this.baseConnection = new Connection(DEFAULT_RPC, "confirmed");
    this.bundleBuilder = new JitoBundleBuilder({
      tipLamports: parseInt(process.env.JITO_TIP_LAMPORTS ?? "10000", 10),
      maxTransactions: 5,
      maxRetries: 3,
    });
  }

  /**
   * Execute un seul intent
   */
  async execute(intent: HybridRouteIntent & { transactionBase64?: string }): Promise<string | null> {
    if (!intent.transactionBase64) {
      monitor.swapWarning("Intent sans transaction fournie", {
        component: "hybridIntentWorker",
        action: "execute",
        amount: intent.percentage.toString(),
        tokenMint: intent.type,
      });
      return null;
    }

    const raw = Buffer.from(intent.transactionBase64, "base64");

    if (intent.channel === "jito") {
      return this.sendViaJito(raw, intent);
    }

    const connection = this.getConnection(intent.channel);
    const signature = await connection.sendRawTransaction(raw, {
      skipPreflight: false,
      maxRetries: 3,
    });
    monitor.swapSuccess(intent.percentage.toString(), intent.label, intent.type, signature);
    return signature;
  }

  private getConnection(channel: ExecutionChannel): Connection {
    if (!this.channelConnections[channel]) {
      const endpoint = CHANNEL_ENDPOINTS[channel] ?? DEFAULT_RPC;
      this.channelConnections[channel] = new Connection(endpoint, "confirmed");
    }
    return this.channelConnections[channel]!;
  }

  private async sendViaJito(rawTx: Buffer, intent: HybridRouteIntent): Promise<string | null> {
    const bundleUrl = process.env.JITO_BUNDLE_URL ?? JITO_BLOCK_ENGINE_URL;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // Optional: add auth header if keypair provided
    if (JITO_AUTH_KEYPAIR) {
      headers["Authorization"] = `Bearer ${JITO_AUTH_KEYPAIR}`;
    }

    try {
      const response = await fetch(bundleUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `bundle-${Date.now()}`,
          method: "sendBundle",
          params: [[rawTx.toString("base64")]],
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message || `Jito rejected (${response.status})`);
      }
      const bundleId = payload.result ?? "bundle-submitted";
      monitor.swapSuccess(intent.percentage.toString(), intent.label, intent.type, bundleId);
      return bundleId;
    } catch (error) {
      monitor.swapError(
        error instanceof Error ? error.message : "Jito bundle failure",
        {
          component: "executionClient",
          action: "sendViaJito",
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      // Fallback: submit via private or public RPC
      const fallbackChannel: ExecutionChannel = CHANNEL_ENDPOINTS["private-rpc"] ? "private-rpc" : "public";
      const fallbackConnection = this.getConnection(fallbackChannel);
      const sig = await fallbackConnection.sendRawTransaction(rawTx, { skipPreflight: false });
      monitor.swapSuccess(intent.percentage.toString(), intent.label, `${intent.type}-fallback`, sig);
      return sig;
    }
  }

  /**
   * Execute plusieurs intents TWAP en un seul bundle Jito
   */
  async executeTwapBundle(
    intents: Array<HybridRouteIntent & { transactionBase64?: string; sliceIndex?: number }>
  ): Promise<BundleResult> {
    const validIntents = intents.filter((i) => i.transactionBase64);

    if (validIntents.length === 0) {
      return {
        success: false,
        error: "Aucun intent avec transaction valide",
        latencyMs: 0,
        transactionCount: 0,
      };
    }

    // Créer le bundle builder avec les intents TWAP
    const builder = createTwapBundleBuilder(
      validIntents.map((i, idx) => ({
        transactionBase64: i.transactionBase64!,
        sliceIndex: i.sliceIndex ?? idx,
        amount: i.percentage.toString(),
      })),
      {
        tipLamports: parseInt(process.env.JITO_TIP_LAMPORTS ?? "10000", 10),
      }
    );

    // Soumettre le bundle
    const signedTxs = validIntents.map((i) => i.transactionBase64!);
    const result = await builder.submitBundle(signedTxs);

    if (result.success && result.bundleId) {
      monitor.swapSuccess(
        validIntents.length.toString(),
        "TWAP Bundle",
        "jito-bundle",
        result.bundleId
      );

      // Attendre la confirmation (optionnel, configurable)
      if (process.env.JITO_WAIT_CONFIRMATION === "true") {
        return await builder.waitForConfirmation(result.bundleId);
      }
    } else {
      monitor.swapError(result.error || "Bundle submission failed", {
        component: "executionClient",
        action: "executeTwapBundle",
        amount: validIntents.length.toString(),
      });
    }

    return result;
  }

  /**
   * Crée un tip instruction pour inclure dans une transaction
   */
  createJitoTipInstruction(payerPubkey: PublicKey) {
    return this.bundleBuilder.createTipInstruction(payerPubkey);
  }
}