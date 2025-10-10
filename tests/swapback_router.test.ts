import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapbackRouter } from "../target/types/swapback_router";
import { expect } from "chai";

describe("swapback_router", () => {
  // Configure le provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapbackRouter as Program<SwapbackRouter>;
  
  const authority = provider.wallet.publicKey;
  let globalStatePDA: anchor.web3.PublicKey;
  let userRebatePDA: anchor.web3.PublicKey;

  before(async () => {
    // Dériver les PDAs
    [globalStatePDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    [userRebatePDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_rebate"), authority.toBuffer()],
      program.programId
    );
  });

  it("Initialise le programme", async () => {
    const treasury = anchor.web3.Keypair.generate().publicKey;

    const tx = await program.methods
      .initialize(75, 25, new anchor.BN(1000))
      .accounts({
        globalState: globalStatePDA,
        authority: authority,
        treasury: treasury,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Signature d'initialisation:", tx);

    // Vérifier l'état global
    const globalState = await program.account.globalState.fetch(globalStatePDA);
    expect(globalState.rebatePercentage).to.equal(75);
    expect(globalState.burnPercentage).to.equal(25);
    expect(globalState.npiThreshold.toNumber()).to.equal(1000);
  });

  it("Simule une route", async () => {
    const inputAmount = new anchor.BN(500_000_000); // 500 USDC
    const minimumOutput = new anchor.BN(2_450_000); // 2.45 SOL
    
    const tx = await program.methods
      .simulateRoute(
        inputAmount,
        minimumOutput,
        { aggregator: {} } // RouteType::Aggregator
      )
      .accounts({
        globalState: globalStatePDA,
      })
      .rpc();

    console.log("Simulation de route:", tx);
  });

  it("Exécute un swap", async () => {
    const inputAmount = new anchor.BN(500_000_000);
    const minimumOutput = new anchor.BN(2_450_000);
    const npiAmount = new anchor.BN(10_000); // 0.01 USDC NPI

    const tx = await program.methods
      .executeSwap(inputAmount, minimumOutput, npiAmount)
      .accounts({
        globalState: globalStatePDA,
        userRebate: userRebatePDA,
        userAuthority: authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Swap exécuté:", tx);

    // Vérifier le compte utilisateur
    const userRebate = await program.account.userRebate.fetch(userRebatePDA);
    expect(userRebate.swapCount.toNumber()).to.equal(1);
    expect(userRebate.totalNpi.toNumber()).to.equal(10_000);
    
    // Remise = 75% de NPI = 7500
    expect(userRebate.pendingRebates.toNumber()).to.equal(7_500);
  });

  it("Verrouille des tokens $BACK", async () => {
    const amount = new anchor.BN(100_000_000); // 100 $BACK
    const lockDuration = new anchor.BN(90 * 86400); // 90 jours

    // TODO: Créer les comptes token nécessaires
    // Pour l'instant, on skip ce test
    console.log("Test de lock à implémenter avec les comptes token");
  });

  it("Récupère les stats utilisateur", async () => {
    const userRebate = await program.account.userRebate.fetch(userRebatePDA);
    
    console.log("Stats utilisateur:");
    console.log("- Swaps:", userRebate.swapCount.toNumber());
    console.log("- NPI total:", userRebate.totalNpi.toNumber());
    console.log("- Remises en attente:", userRebate.pendingRebates.toNumber());
  });
});
