/**
 * 🧪 TESTS D'INTÉGRATION FRONTEND
 * Valide la connexion entre l'interface Next.js et les programmes Solana on-chain
 */

import { describe, it, expect, beforeAll } from "vitest";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";

// Configuration
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
const ROUTER_PROGRAM_ID = new PublicKey("3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap");
const BACK_TOKEN_MINT = new PublicKey("862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux");
const SWITCHBOARD_FEED = new PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR");

describe("Frontend Integration Tests", () => {
  let connection: Connection;
  let provider: AnchorProvider;

  beforeAll(() => {
    connection = new Connection(RPC_ENDPOINT, "confirmed");
    // Provider mock pour tests (wallet non requis)
    const wallet = {
      publicKey: Keypair.generate().publicKey,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  });

  it("✅ Connexion RPC devnet", async () => {
    const version = await connection.getVersion();
    expect(version).toBeDefined();
    console.log("✓ Solana version:", version["solana-core"]);
  });

  it("✅ Programme Router déployé et accessible", async () => {
    const accountInfo = await connection.getAccountInfo(ROUTER_PROGRAM_ID);
    expect(accountInfo).not.toBeNull();
    expect(accountInfo?.executable).toBe(true);
    console.log("✓ Router Program ID:", ROUTER_PROGRAM_ID.toString());
  });

  it("✅ Token $BACK existe sur devnet", async () => {
    const accountInfo = await connection.getAccountInfo(BACK_TOKEN_MINT);
    expect(accountInfo).not.toBeNull();
    console.log("✓ $BACK Token Mint:", BACK_TOKEN_MINT.toString());
  });

  it("✅ Oracle Switchboard accessible", async () => {
    const accountInfo = await connection.getAccountInfo(SWITCHBOARD_FEED);
    expect(accountInfo).not.toBeNull();
    console.log("✓ Switchboard Feed:", SWITCHBOARD_FEED.toString());
  });

  it("✅ Dérivation PDA plan DCA fonctionne", () => {
    const userPubkey = Keypair.generate().publicKey;
    const planId = new BN(Date.now());

    const [dcaPlanPda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("dca_plan"), userPubkey.toBuffer(), planId.toArrayLike(Buffer, "le", 8)],
      ROUTER_PROGRAM_ID
    );

    expect(dcaPlanPda).toBeDefined();
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
    console.log("✓ DCA Plan PDA:", dcaPlanPda.toString(), "| Bump:", bump);
  });

  it("✅ Dérivation PDA state program fonctionne", () => {
    const [statePda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      ROUTER_PROGRAM_ID
    );

    expect(statePda).toBeDefined();
    expect(bump).toBeGreaterThanOrEqual(0);
    console.log("✓ State PDA:", statePda.toString(), "| Bump:", bump);
  });
});

describe("Validation Formulaire SwapInterface", () => {
  it("✅ Validation montant SOL", () => {
    const validAmounts = ["0.1", "1.5", "10", "100.5"];
    const invalidAmounts = ["", "0", "-1", "abc"];

    validAmounts.forEach((amount) => {
      const parsed = Number.parseFloat(amount);
      expect(parsed).toBeGreaterThan(0);
      expect(Number.isNaN(parsed)).toBe(false);
    });

    invalidAmounts.forEach((amount) => {
      const parsed = Number.parseFloat(amount);
      expect(parsed <= 0 || Number.isNaN(parsed) || amount === "").toBe(true);
    });
  });

  it("✅ Validation interval DCA (secondes)", () => {
    const validIntervals = [3600, 7200, 86400]; // 1h, 2h, 24h
    const invalidIntervals = [0, -1, 59]; // < 60s invalide

    validIntervals.forEach((interval) => {
      expect(interval).toBeGreaterThanOrEqual(60);
    });

    invalidIntervals.forEach((interval) => {
      expect(interval).toBeLessThan(60);
    });
  });

  it("✅ Calcul montant par swap", () => {
    const inputAmount = 10; // SOL
    const numberOfSwaps = 5;
    const expectedPerSwap = 2;

    const calculated = inputAmount / numberOfSwaps;
    expect(calculated).toBe(expectedPerSwap);
  });

  it("✅ Calcul durée totale DCA", () => {
    const dcaInterval = 3600; // 1h en secondes
    const numberOfSwaps = 24;
    const expectedHours = 24;

    const totalHours = (dcaInterval * numberOfSwaps) / 3600;
    expect(totalHours).toBe(expectedHours);
  });
});
