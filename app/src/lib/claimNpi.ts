import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, type Idl, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import cnftIdl from "@/idl/swapback_cnft.json";
import { getNpiMint } from "./lockTokens";

const LAMPORTS_PER_NPI = 1_000_000_000;

function getCnftProgramId(): PublicKey {
  const envVar = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID;
  if (!envVar) {
    throw new Error("NEXT_PUBLIC_CNFT_PROGRAM_ID missing");
  }
  return new PublicKey(envVar);
}

export async function createClaimNpiTransaction(
  connection: Connection,
  wallet: WalletContextState,
  amount: number,
) {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  if (amount <= 0) {
    throw new Error("Claim amount must be positive");
  }

  const programId = getCnftProgramId();
  const npiMint = getNpiMint();
  if (!npiMint) {
    throw new Error("NEXT_PUBLIC_NPI_MINT missing");
  }

  const provider = new AnchorProvider(
    connection,
    wallet as any,
    { commitment: "confirmed" }
  );
  const program = new Program(cnftIdl as Idl, provider);

  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    programId
  );
  const [userNpiBalance] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_npi_balance"), wallet.publicKey.toBuffer()],
    programId
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("npi_vault_authority")],
    programId
  );

  const userNpiAccount = await getAssociatedTokenAddress(
    npiMint,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );

  const globalStateAccount = await program.account.globalState.fetch(globalState);
  const npiVault = new PublicKey(globalStateAccount.npiVaultWallet);

  const amountLamports = new BN(Math.floor(amount * LAMPORTS_PER_NPI));

  const instruction = await program.methods
    .claimNpi(amountLamports)
    .accounts({
      userNpiBalance,
      globalState,
      npiVault,
      userNpiAccount,
      vaultAuthority,
      npiMint,
      user: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return new Transaction().add(instruction);
}