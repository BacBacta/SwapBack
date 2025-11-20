import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, Idl } from "@coral-xyz/anchor";
import { PDAUtil, SwapUtils } from "@orca-so/whirlpools-sdk";
import { Market } from "@project-serum/serum";
import whirlpoolIdl from "@orca-so/whirlpools-sdk/dist/artifacts/whirlpool.json";
import { DEFAULT_SOLANA_RPC_URL } from "@/config/constants";
import { ORCA_WHIRLPOOL_PROGRAM_ID } from "@/sdk/config/orca-pools";
import {
  RAYDIUM_AMM_PROGRAM_ID,
  getRaydiumPoolByAmm,
  RaydiumPoolConfig,
} from "@/sdk/config/raydium-pools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_SOLANA_RPC_URL;

const connection = new Connection(RPC_ENDPOINT, "confirmed");
const whirlpoolCoder = new BorshCoder(whirlpoolIdl as Idl);

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

function decodeWhirlpool(data: Buffer): WhirlpoolAccountData {
  const decoded = whirlpoolCoder.accounts.decode("Whirlpool", data) as {
    tokenMintA: PublicKey;
    tokenMintB: PublicKey;
    tokenVaultA: PublicKey;
    tokenVaultB: PublicKey;
    tickSpacing: number;
    tickCurrentIndex: number | { toNumber(): number };
  };

  return {
    tokenMintA: decoded.tokenMintA,
    tokenMintB: decoded.tokenMintB,
    tokenVaultA: decoded.tokenVaultA,
    tokenVaultB: decoded.tokenVaultB,
    tickSpacing: decoded.tickSpacing,
    tickCurrentIndex:
      typeof decoded.tickCurrentIndex === "number"
        ? decoded.tickCurrentIndex
        : decoded.tickCurrentIndex.toNumber(),
  };
}

export async function POST(request: NextRequest) {
  try {
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
    const raydiumPoolConfig = getRaydiumPoolByAmm(ammPubkey);

    if (
      raydiumPoolConfig &&
      (!requestedDexProgram || requestedDexProgram.equals(RAYDIUM_AMM_PROGRAM_ID))
    ) {
      try {
        const raydiumPayload = await deriveRaydiumAccounts({
          tokenInMint,
          tokenOutMint,
          poolConfig: raydiumPoolConfig,
        });
        return NextResponse.json(raydiumPayload);
      } catch (err) {
        console.error("raydium account derivation error", err);
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Failed to derive Raydium accounts",
          },
          { status: 400 }
        );
      }
    }

    const whirlpoolPubkey = ammPubkey;
    const accountInfo = await connection.getAccountInfo(whirlpoolPubkey);

    if (!accountInfo) {
      return NextResponse.json(
        { error: "Whirlpool account not found" },
        { status: 404 }
      );
    }

    const whirlpool = decodeWhirlpool(accountInfo.data);
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

    const tickArrayKeys = SwapUtils.getTickArrayPublicKeys(
      whirlpool.tickCurrentIndex,
      whirlpool.tickSpacing,
      direction === "aToB",
      ORCA_WHIRLPOOL_PROGRAM_ID,
      whirlpoolPubkey
    ).map((pk) => pk.toBase58());

    const oraclePda = PDAUtil.getOracle(
      ORCA_WHIRLPOOL_PROGRAM_ID,
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
      dexProgramId: ORCA_WHIRLPOOL_PROGRAM_ID.toBase58(),
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

async function deriveRaydiumAccounts(params: {
  tokenInMint: string;
  tokenOutMint: string;
  poolConfig: RaydiumPoolConfig;
}) {
  const { tokenInMint, tokenOutMint, poolConfig } = params;
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

  return {
    variant: "RAYDIUM_AMM" as const,
    direction,
    tokenMintA: mintA,
    tokenMintB: mintB,
    dexProgramId: RAYDIUM_AMM_PROGRAM_ID.toBase58(),
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
