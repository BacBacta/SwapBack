import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import cnftIdl from "@/idl/swapback_cnft.json";
import { validateEnv } from "./validateEnv";

const BASIS_POINTS = 10_000;

function resolveCnftProgramId(): PublicKey {
  if (typeof window === "undefined") {
    const cfg = validateEnv();
    return new PublicKey(cfg.cnftProgramId);
  }
  const envVar = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID;
  if (!envVar) {
    throw new Error(
      "NEXT_PUBLIC_CNFT_PROGRAM_ID must be defined to send revenue instructions."
    );
  }
  return new PublicKey(envVar);
}

const CNFT_PROGRAM_ID = resolveCnftProgramId();

type NumericInput = string | number;

function decimalToBn(value: NumericInput, decimals = 6): BN {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Amount must be a finite number");
    }
    value = value.toString();
  }
  const sanitized = value.trim();
  if (!sanitized) {
    return new BN(0);
  }
  const negative = sanitized.startsWith("-");
  const unsigned = negative ? sanitized.slice(1) : sanitized;
  const [whole, fraction = ""] = unsigned.split(".");
  const normalizedFraction = (fraction + "0".repeat(decimals)).slice(0, decimals);
  const digits = `${whole || "0"}${normalizedFraction}`.replace(/^0+/, "") || "0";
  const bn = new BN(digits, 10);
  return negative ? bn.neg() : bn;
}

async function getProgram(connection: Connection, wallet: WalletContextState) {
  const publicKey = wallet.publicKey;
  const signTransaction = wallet.signTransaction?.bind(wallet);
  const signAllTransactions = wallet.signAllTransactions?.bind(wallet);

  if (!publicKey || !signTransaction) {
    throw new Error("Connect a wallet that supports transaction signing");
  }

  const anchorWallet = {
    publicKey,
    signTransaction,
    signAllTransactions: signAllTransactions ?? (async (txs: Transaction[]) => {
      const signed: Transaction[] = [];
      for (const tx of txs) {
        signed.push(await signTransaction(tx));
      }
      return signed;
    }),
  };

  const provider = new AnchorProvider(connection, anchorWallet as any, {
    commitment: "confirmed",
    skipPreflight: false,
  });

  const program = new Program(cnftIdl as Idl, CNFT_PROGRAM_ID, provider);

  if (!(program as any)._coder?.accounts) {
    const { BorshAccountsCoder } = await import("@coral-xyz/anchor");
    (program as any)._coder = (program as any)._coder || {};
    (program as any)._coder.accounts = new BorshAccountsCoder(cnftIdl as Idl);
  }

  return { program, programId: CNFT_PROGRAM_ID, wallet: anchorWallet };
}

async function sendInstruction(
  connection: Connection,
  wallet: WalletContextState,
  instruction: Transaction["instructions"][number]
) {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not ready to sign transactions");
  }

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = wallet.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

export async function recordSwapFees({
  connection,
  wallet,
  swapVolumeUsd,
  decimals = 6,
}: {
  connection: Connection;
  wallet: WalletContextState;
  swapVolumeUsd: NumericInput;
  decimals?: number;
}) {
  const swapVolumeBn = decimalToBn(swapVolumeUsd, decimals);
  if (swapVolumeBn.lte(new BN(0))) {
    throw new Error("Swap volume must be greater than zero");
  }

  const { program, programId } = await getProgram(connection, wallet);
  const [globalState] = PublicKey.findProgramAddressSync([
    Buffer.from("global_state"),
  ], programId);

  const instruction = await program.methods
    .recordSwapFees(swapVolumeBn)
    .accounts({
      globalState,
      authority: wallet.publicKey!,
    })
    .instruction();

  return sendInstruction(connection, wallet, instruction);
}

export async function distributeNpi({
  connection,
  wallet,
  npiAmountUsd,
  userBoostBps,
  decimals = 6,
}: {
  connection: Connection;
  wallet: WalletContextState;
  npiAmountUsd: NumericInput;
  userBoostBps: number;
  decimals?: number;
}) {
  const npiAmountBn = decimalToBn(npiAmountUsd, decimals);
  if (npiAmountBn.lte(new BN(0))) {
    throw new Error("NPI amount must be greater than zero");
  }

  const boost = Math.max(0, Math.min(userBoostBps, 1000));

  const { program, programId } = await getProgram(connection, wallet);
  const [globalState] = PublicKey.findProgramAddressSync([
    Buffer.from("global_state"),
  ], programId);

  const instruction = await program.methods
    .distributeNpi(npiAmountBn, boost)
    .accounts({
      globalState,
      authority: wallet.publicKey!,
    })
    .instruction();

  return sendInstruction(connection, wallet, instruction);
}
