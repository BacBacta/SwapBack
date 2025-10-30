import "../setup-env";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { loadProgram } from "../utils/load-idl";
import {
  BACK_TOKEN_MINT,
  BUYBACK_PROGRAM_ID,
  BUYBACK_STATE_SEED,
  BUYBACK_USDC_VAULT_SEED,
} from "../config/devnet";

function readFlag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const exact = `--${name}`;

  for (let i = 0; i < args.length; i += 1) {
    const entry = args[i];
    if (entry === exact) {
      return args[i + 1];
    }

    if (entry.startsWith(`${exact}=`)) {
      return entry.slice(exact.length + 1);
    }
  }

  return undefined;
}

function expectEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Provide it via environment variable or CLI flag (e.g. --${name
        .replace(/_/g, "-")
        .toLowerCase()}=...)`
    );
  }

  return value;
}

async function ensureBalance(provider: AnchorProvider): Promise<void> {
  const authority = provider.wallet.publicKey;
  let balanceLamports = await provider.connection.getBalance(authority);

  if (balanceLamports < 0.2 * LAMPORTS_PER_SOL) {
    const readableBalance = balanceLamports / LAMPORTS_PER_SOL;
    console.warn(
      `⚠️  Low SOL balance detected (${readableBalance} SOL). Attempting 2 SOL devnet airdrop...`
    );

    const requestAirdrop = async (lamports: number): Promise<boolean> => {
      try {
        const signature = await provider.connection.requestAirdrop(
          authority,
          lamports
        );
        await provider.connection.confirmTransaction(signature, "confirmed");
        balanceLamports = await provider.connection.getBalance(authority);
        console.log(
          "💧 Devnet airdrop confirmed (",
          lamports / LAMPORTS_PER_SOL,
          "SOL ). New balance:",
          balanceLamports / LAMPORTS_PER_SOL,
          "SOL"
        );
        return true;
      } catch (airdropError) {
        console.warn(
          `⚠️  Automatic airdrop of ${lamports / LAMPORTS_PER_SOL} SOL failed:`,
          (airdropError as Error).message
        );
        return false;
      }
    };

    const attempts = [2, 1, 0.5];
    let success = false;

    for (const amount of attempts) {
      success = await requestAirdrop(amount * LAMPORTS_PER_SOL);
      if (success) {
        break;
      }
    }

    if (!success) {
      console.warn(
        "   Automatic airdrops exhausted. Request manually at https://faucet.solana.com/"
      );
    }
  }
}

async function main(): Promise<void> {
  const provider = process.env.ANCHOR_PROVIDER_URL
    ? AnchorProvider.env()
    : AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  await ensureBalance(provider);

  const usdcMintStr =
    process.env.SWAPBACK_BUYBACK_USDC_MINT ?? readFlag("usdc-mint");
  const minAmountStr =
    process.env.SWAPBACK_BUYBACK_MIN_AMOUNT ?? readFlag("min-amount") ?? "0";

  const usdcMint = new PublicKey(
    expectEnv("SWAPBACK_BUYBACK_USDC_MINT", usdcMintStr)
  );
  const minAmount = new BN(minAmountStr);

  const [buybackState] = PublicKey.findProgramAddressSync(
    [BUYBACK_STATE_SEED],
    BUYBACK_PROGRAM_ID
  );

  const [usdcVault] = PublicKey.findProgramAddressSync(
    [BUYBACK_USDC_VAULT_SEED],
    BUYBACK_PROGRAM_ID
  );

  const buybackProgram = loadProgram({
    programName: "swapback_buyback",
    provider,
    programId: BUYBACK_PROGRAM_ID.toBase58(),
    registerWorkspace: false,
  });

  const accountInfo = await provider.connection.getAccountInfo(buybackState);
  if (accountInfo) {
    console.log(
      "ℹ️  Buyback state already initialized at",
      buybackState.toBase58()
    );
    return;
  }

  console.log("🚀 Initializing buyback state on devnet...");
  console.log("   Authority:", provider.wallet.publicKey.toBase58());
  console.log("   Buyback Program:", BUYBACK_PROGRAM_ID.toBase58());
  console.log("   Back Mint:", BACK_TOKEN_MINT.toBase58());
  console.log("   USDC Mint:", usdcMint.toBase58());
  console.log("   Min Amount:", minAmount.toString());
  console.log("   Buyback State PDA:", buybackState.toBase58());
  console.log("   USDC Vault PDA:", usdcVault.toBase58());

  try {
    const signature = await buybackProgram.methods
      .initialize(minAmount)
      .accounts({
        buybackState,
        backMint: BACK_TOKEN_MINT,
        usdcMint,
        usdcVault,
        authority: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("✅ Buyback state initialized successfully!");
    console.log("   Signature:", signature);
  } catch (error) {
    console.error(
      "❌ Failed to initialize buyback state:",
      (error as Error).message
    );
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
