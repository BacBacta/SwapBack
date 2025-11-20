import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { PDAUtil, SwapUtils, ParsableWhirlpool } from "@orca-so/whirlpools-sdk";
import { Market } from "@project-serum/serum";
import { DEFAULT_SOLANA_RPC_URL } from "@/config/constants";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_SOLANA_RPC_URL;

// Lazy imports to avoid build-time execution
let orcaConfig: typeof import("@/sdk/config/orca-pools") | null = null;
let raydiumConfig: typeof import("@/sdk/config/raydium-pools") | null = null;

async function getOrcaConfig() {
  if (!orcaConfig) {
    orcaConfig = await import("@/sdk/config/orca-pools");
  }
  return orcaConfig;
}

async function getRaydiumConfig() {
  if (!raydiumConfig) {
    raydiumConfig = await import("@/sdk/config/raydium-pools");
  }
  return raydiumConfig;
}

type AccountsRequest = {
  tokenInMint: string;
  tokenOutMint: string;
  ammKey?: string;
  whirlpool?: string;
  dexProgramId?: string;
};

type WhirlpoolAccountData = {
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  tokenVaultA: PublicKey;
  tokenVaultB: PublicKey;
  tickSpacing: number;
  tickCurrentIndex: number;
};

async function decodeWhirlpool(
  connection: Connection,
  address: PublicKey
): Promise<WhirlpoolAccountData | null> {
  try {
    const accountInfo = await connection.getAccountInfo(address);
    if (!accountInfo) {
      return null;
    }

    // Use ParsableWhirlpool from the SDK instead of BorshCoder
    const whirlpoolData = ParsableWhirlpool.parse(address, accountInfo);
    if (!whirlpoolData) {
      return null;
    }

    return {
      tokenMintA: whirlpoolData.tokenMintA,
      tokenMintB: whirlpoolData.tokenMintB,
      tokenVaultA: whirlpoolData.tokenVaultA,
      tokenVaultB: whirlpoolData.tokenVaultB,
      tickSpacing: whirlpoolData.tickSpacing,
      tickCurrentIndex: whirlpoolData.tickCurrentIndex,
    };
  } catch (error) {
    console.warn("Failed to decode whirlpool account", error);
    return null;
  }
}

export async function handlePOST(request: NextRequest) {
  try {
    const connection = new Connection(RPC_ENDPOINT, "confirmed");

    const body = (await request.json()) as AccountsRequest;
    const tokenInMint = body.tokenInMint?.trim();
    const tokenOutMint = body.tokenOutMint?.trim();
    const ammAddress = body.ammKey || body.whirlpool;

    if (!tokenInMint || !tokenOutMint || !ammAddress) {
      return NextResponse.json(
        { error: "Missing tokenInMint, tokenOutMint or ammKey" },
        { status: 400 }
      );
    }

    let requestedDexProgram: PublicKey | null = null;
    if (body.dexProgramId) {
      try {
        requestedDexProgram = new PublicKey(body.dexProgramId);
      } catch (err) {
        return NextResponse.json(
          { error: "Invalid dexProgramId" },
          { status: 400 }
        );
      }
    }

    const ammPubkey = new PublicKey(ammAddress);
    const raydiumCfg = await getRaydiumConfig();
    const raydiumPoolConfig = raydiumCfg.getRaydiumPoolByAmm(ammPubkey);

    if (
      raydiumPoolConfig &&
      (!requestedDexProgram || requestedDexProgram.equals(raydiumCfg.RAYDIUM_AMM_PROGRAM_ID))
    ) {
      try {
        const raydiumPayload = await deriveRaydiumAccounts({
          connection,
          tokenInMint,
          tokenOutMint,
          poolConfig: raydiumPoolConfig,
        });
        return NextResponse.json(raydiumPayload);
      } catch (err) {
        console.error("raydium account derivation error", err);
        return NextResponse.json(
          { error: "Failed to derive Raydium accounts" },
          { status: 500 }
        );
      }
    }

    const whirlpoolPubkey = ammPubkey;

    const whirlpool = await decodeWhirlpool(connection, whirlpoolPubkey);
    if (!whirlpool) {
      return NextResponse.json(
        { error: "Account is not a valid Whirlpool pool" },
        { status: 400 }
      );
    }
    const mintA = whirlpool.tokenMintA.toBase58();
    const mintB = whirlpool.tokenMintB.toBase58();

    let direction: "aToB" | "bToA";
    if (tokenInMint === mintA && tokenOutMint === mintB) {
      direction = "aToB";
    } else if (tokenInMint === mintB && tokenOutMint === mintA) {
      direction = "bToA";
    } else {
      return NextResponse.json(
        { error: "Token pair does not match whirlpool mints" },
        { status: 400 }
      );
    }

    const orcaCfg = await getOrcaConfig();
    const tickArrayKeys = SwapUtils.getTickArrayPublicKeys(
      whirlpool.tickCurrentIndex,
      whirlpool.tickSpacing,
      direction === "aToB",
      orcaCfg.ORCA_WHIRLPOOL_PROGRAM_ID,
      whirlpoolPubkey
    ).map((pk) => pk.toBase58());

    const oraclePda = PDAUtil.getOracle(
      orcaCfg.ORCA_WHIRLPOOL_PROGRAM_ID,
      whirlpoolPubkey
    ).publicKey;

    return NextResponse.json({
      variant: "ORCA_WHIRLPOOL" as const,
      whirlpool: whirlpoolPubkey.toBase58(),
      direction,
      tokenMintA: mintA,
      tokenMintB: mintB,
      tokenVaultA: whirlpool.tokenVaultA.toBase58(),
      tokenVaultB: whirlpool.tokenVaultB.toBase58(),
      tickArrays: tickArrayKeys,
      oracle: oraclePda.toBase58(),
      tickSpacing: whirlpool.tickSpacing,
      dexProgramId: orcaCfg.ORCA_WHIRLPOOL_PROGRAM_ID.toBase58(),
    });
  } catch (error) {
    console.error("router/accounts error", error);
    return NextResponse.json(
      {
        error: "Failed to derive DEX accounts",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function handleGET() {
  return NextResponse.json({
    status: "ok",
    message: "Use POST with token mints and pool address to derive router accounts."
  });
}

async function deriveRaydiumAccounts(params: {
  connection: Connection;
  tokenInMint: string;
  tokenOutMint: string;
  poolConfig: any;
}) {
  const { connection, tokenInMint, tokenOutMint, poolConfig } = params;
  const mintA = poolConfig.tokenMintA.toBase58();
  const mintB = poolConfig.tokenMintB.toBase58();

  let direction: "aToB" | "bToA";
  if (tokenInMint === mintA && tokenOutMint === mintB) {
    direction = "aToB";
  } else if (tokenInMint === mintB && tokenOutMint === mintA) {
    direction = "bToA";
  } else {
    throw new Error("Token pair does not match Raydium pool mints");
  }

  const serumMarket = await Market.load(
    connection,
    poolConfig.serumMarket,
    undefined,
    poolConfig.serumProgramId
  );

  const decodedMarket = serumMarket.decoded as {
    eventQueue: PublicKey;
    bids: PublicKey;
    asks: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    vaultSignerNonce: { toArrayLike: (ctor: typeof Buffer, endian: "le" | "be", length: number) => Buffer };
  };

  const vaultSignerSeed = decodedMarket.vaultSignerNonce.toArrayLike(
    Buffer,
    "le",
    8
  );
  const serumVaultSigner = await PublicKey.createProgramAddress(
    [serumMarket.address.toBuffer(), Buffer.from(vaultSignerSeed)],
    poolConfig.serumProgramId
  );

  const raydiumCfg = await getRaydiumConfig();

  return {
    variant: "RAYDIUM_AMM" as const,
    direction,
    tokenMintA: mintA,
    tokenMintB: mintB,
    dexProgramId: raydiumCfg.RAYDIUM_AMM_PROGRAM_ID.toBase58(),
    ammId: poolConfig.ammAddress.toBase58(),
    ammAuthority: poolConfig.ammAuthority.toBase58(),
    ammOpenOrders: poolConfig.ammOpenOrders.toBase58(),
    ammTargetOrders: poolConfig.ammTargetOrders.toBase58(),
    poolCoinTokenAccount: poolConfig.poolCoinTokenAccount.toBase58(),
    poolPcTokenAccount: poolConfig.poolPcTokenAccount.toBase58(),
    poolWithdrawQueue: poolConfig.poolWithdrawQueue.toBase58(),
    poolTempLpTokenAccount: poolConfig.poolTempLpTokenAccount.toBase58(),
    serumProgramId: poolConfig.serumProgramId.toBase58(),
    serumMarket: poolConfig.serumMarket.toBase58(),
    serumBids: serumMarket.bidsAddress.toBase58(),
    serumAsks: serumMarket.asksAddress.toBase58(),
    serumEventQueue: decodedMarket.eventQueue.toBase58(),
    serumCoinVault: decodedMarket.baseVault.toBase58(),
    serumPcVault: decodedMarket.quoteVault.toBase58(),
    serumVaultSigner: serumVaultSigner.toBase58(),
  };
}
