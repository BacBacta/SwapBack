const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");
const { getAccount, getMint } = require("@solana/spl-token");

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SwapbackRouter;

  console.log("Checking Rebate Vault...");

  const [routerStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    program.programId
  );

  const [rebateVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("rebate_vault"), routerStatePda.toBuffer()],
    program.programId
  );
  console.log("Rebate Vault PDA:", rebateVaultPda.toString());

  try {
    const account = await getAccount(provider.connection, rebateVaultPda);
    console.log("✅ Rebate Vault exists!");
    console.log("Mint:", account.mint.toString());
  } catch (e) {
    console.log("⚠️ Rebate Vault does not exist or error:", e.message);
  }
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
