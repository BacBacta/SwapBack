/**
 * PumpSwap AMM Native Integration
 *
 * Direct on-chain pool reading and quote calculation
 * using constant product AMM formula (x * y = k)
 *
 * Program ID: pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA
 *
 * @see https://github.com/outsmartchad/pumpswap-sdk (reference implementation)
 */

import { Connection, PublicKey, GetProgramAccountsFilter } from "@solana/web3.js";

// PumpSwap AMM Program ID
export const PUMPSWAP_PROGRAM_ID = new PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
);

// Wrapped SOL mint
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

// Pool account data structure offsets and size
// Based on analysis of pumpswap-sdk and on-chain data
const POOL_DATA_SIZE = 211;
const POOL_BASE_MINT_OFFSET = 43;
const POOL_QUOTE_MINT_OFFSET = 75;

// Fee configuration (PumpSwap charges ~1% total: 0.25% LP + 0.75% protocol)
const LP_FEE_BPS = BigInt(25);  // 0.25%
const PROTOCOL_FEE_BPS = BigInt(75); // 0.75%
const TOTAL_FEE_BPS = LP_FEE_BPS + PROTOCOL_FEE_BPS; // 1%

export interface PumpSwapPool {
  address: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  poolBaseTokenAccount: PublicKey;
  poolQuoteTokenAccount: PublicKey;
}

export interface PumpSwapPoolWithReserves extends PumpSwapPool {
  baseReserve: bigint;
  quoteReserve: bigint;
  baseDecimals: number;
  quoteDecimals: number;
  price: number; // quote per base (e.g., SOL per token)
}

export interface PumpSwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: bigint;
  outputAmount: bigint;
  outputAmountWithFee: bigint;
  minOutputAmount: bigint;
  priceImpactBps: number;
  feeAmount: bigint;
  feeBps: number;
  pool: string;
  baseReserve: bigint;
  quoteReserve: bigint;
}

/**
 * Decode pool account data to extract mint addresses and token accounts
 */
function decodePoolAccount(data: Buffer): Omit<PumpSwapPool, 'address'> | null {
  if (data.length < POOL_DATA_SIZE) {
    return null;
  }

  try {
    // Pool structure (from pumpswap-idl.ts analysis):
    // - bytes 0-7: discriminator
    // - bytes 8-9: pool_bump (u8), padding
    // - bytes 10-11: index (u16)
    // - bytes 11-42: creator (pubkey, 32 bytes) - wait, that's 31 bytes
    // Let me use the offsets from the SDK: base_mint at 43, quote_mint at 75

    const baseMint = new PublicKey(data.slice(POOL_BASE_MINT_OFFSET, POOL_BASE_MINT_OFFSET + 32));
    const quoteMint = new PublicKey(data.slice(POOL_QUOTE_MINT_OFFSET, POOL_QUOTE_MINT_OFFSET + 32));

    // Token accounts are at offsets after mints
    // lp_mint at 107 (32 bytes)
    // pool_base_token_account at 139 (32 bytes)
    // pool_quote_token_account at 171 (32 bytes)
    const poolBaseTokenAccount = new PublicKey(data.slice(139, 139 + 32));
    const poolQuoteTokenAccount = new PublicKey(data.slice(171, 171 + 32));

    return {
      baseMint,
      quoteMint,
      poolBaseTokenAccount,
      poolQuoteTokenAccount,
    };
  } catch (e) {
    console.error("[PumpSwap] Failed to decode pool account:", e);
    return null;
  }
}

/**
 * Find PumpSwap pools for a given token mint
 */
export async function findPumpSwapPools(
  connection: Connection,
  tokenMint: PublicKey
): Promise<PumpSwapPool[]> {
  // Search for pools where the token is the base mint and quote is WSOL
  const filters: GetProgramAccountsFilter[] = [
    { dataSize: POOL_DATA_SIZE },
    {
      memcmp: {
        offset: POOL_BASE_MINT_OFFSET,
        bytes: tokenMint.toBase58(),
      },
    },
    {
      memcmp: {
        offset: POOL_QUOTE_MINT_OFFSET,
        bytes: WSOL_MINT.toBase58(),
      },
    },
  ];

  try {
    const accounts = await connection.getProgramAccounts(PUMPSWAP_PROGRAM_ID, {
      filters,
    });

    const pools: PumpSwapPool[] = [];
    for (const account of accounts) {
      const decoded = decodePoolAccount(account.account.data as Buffer);
      if (decoded) {
        pools.push({
          address: account.pubkey,
          ...decoded,
        });
      }
    }

    return pools;
  } catch (e) {
    console.error("[PumpSwap] Error finding pools:", e);
    return [];
  }
}

/**
 * Get pool reserves (token balances in pool accounts)
 */
export async function getPoolReserves(
  connection: Connection,
  pool: PumpSwapPool
): Promise<PumpSwapPoolWithReserves | null> {
  try {
    const [baseBalance, quoteBalance] = await Promise.all([
      connection.getTokenAccountBalance(pool.poolBaseTokenAccount),
      connection.getTokenAccountBalance(pool.poolQuoteTokenAccount),
    ]);

    if (!baseBalance.value.uiAmount || !quoteBalance.value.uiAmount) {
      return null;
    }

    const baseReserve = BigInt(baseBalance.value.amount);
    const quoteReserve = BigInt(quoteBalance.value.amount);
    const baseDecimals = baseBalance.value.decimals;
    const quoteDecimals = quoteBalance.value.decimals;

    // Price = quote per base (e.g., SOL per token)
    const price =
      quoteBalance.value.uiAmount / baseBalance.value.uiAmount;

    return {
      ...pool,
      baseReserve,
      quoteReserve,
      baseDecimals,
      quoteDecimals,
      price,
    };
  } catch (e) {
    console.error("[PumpSwap] Error getting pool reserves:", e);
    return null;
  }
}

/**
 * Calculate output amount using constant product formula
 * Formula: outputAmount = (inputAmount * outputReserve) / (inputReserve + inputAmount)
 * Then apply fee
 */
export function calculateSwapOutput(
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
  feeBps: bigint = TOTAL_FEE_BPS
): { outputAmount: bigint; feeAmount: bigint } {
  const ZERO = BigInt(0);
  const FEE_DENOMINATOR = BigInt(10000);
  
  if (inputAmount <= ZERO || inputReserve <= ZERO || outputReserve <= ZERO) {
    return { outputAmount: ZERO, feeAmount: ZERO };
  }

  // Constant product formula: x * y = k
  // After swap: (x + dx) * (y - dy) = k
  // Solving for dy: dy = (y * dx) / (x + dx)
  const numerator = inputAmount * outputReserve;
  const denominator = inputReserve + inputAmount;
  const outputBeforeFee = numerator / denominator;

  // Apply fee (reduce output)
  const feeAmount = (outputBeforeFee * feeBps) / FEE_DENOMINATOR;
  const outputAmount = outputBeforeFee - feeAmount;

  return { outputAmount, feeAmount };
}

/**
 * Calculate price impact in basis points
 */
export function calculatePriceImpact(
  inputAmount: bigint,
  inputReserve: bigint,
  outputAmount: bigint,
  outputReserve: bigint
): number {
  const ZERO = BigInt(0);
  if (inputReserve <= ZERO || outputReserve <= ZERO) {
    return 0;
  }

  // Spot price before swap
  const spotPrice = Number(outputReserve) / Number(inputReserve);
  
  // Execution price
  const executionPrice = Number(outputAmount) / Number(inputAmount);
  
  // Price impact = (spot - execution) / spot * 100
  const impact = (spotPrice - executionPrice) / spotPrice;
  
  // Convert to basis points (multiply by 10000)
  return Math.max(0, Math.floor(impact * 10000));
}

/**
 * Get a quote for swapping on PumpSwap
 */
export async function getPumpSwapQuote(
  connection: Connection,
  inputMint: string,
  outputMint: string,
  inputAmount: bigint,
  slippageBps: number = 50
): Promise<PumpSwapQuote | null> {
  const SOL_MINT = WSOL_MINT.toBase58();

  // Determine which is the token (non-SOL)
  const tokenMint = inputMint === SOL_MINT ? outputMint : inputMint;
  const isBuying = inputMint === SOL_MINT; // Buying token with SOL

  // Find pools for this token
  const pools = await findPumpSwapPools(connection, new PublicKey(tokenMint));

  if (pools.length === 0) {
    console.log("[PumpSwap] No pools found for token:", tokenMint);
    return null;
  }

  // Get reserves for each pool and find the best one (highest liquidity)
  const poolsWithReserves = await Promise.all(
    pools.map((pool) => getPoolReserves(connection, pool))
  );

  const validPools = poolsWithReserves.filter(
    (p): p is PumpSwapPoolWithReserves => p !== null
  );

  if (validPools.length === 0) {
    console.log("[PumpSwap] No valid pools with reserves found");
    return null;
  }

  // Sort by liquidity (quote reserve = SOL)
  validPools.sort((a, b) => Number(b.quoteReserve - a.quoteReserve));
  const bestPool = validPools[0];

  // Calculate swap
  let inputReserve: bigint;
  let outputReserve: bigint;

  if (isBuying) {
    // Input is SOL (quote), output is token (base)
    inputReserve = bestPool.quoteReserve;
    outputReserve = bestPool.baseReserve;
  } else {
    // Input is token (base), output is SOL (quote)
    inputReserve = bestPool.baseReserve;
    outputReserve = bestPool.quoteReserve;
  }

  const { outputAmount, feeAmount } = calculateSwapOutput(
    inputAmount,
    inputReserve,
    outputReserve
  );

  const priceImpactBps = calculatePriceImpact(
    inputAmount,
    inputReserve,
    outputAmount,
    outputReserve
  );

  // Calculate min output with slippage
  const SLIPPAGE_DENOMINATOR = BigInt(10000);
  const minOutputAmount = (outputAmount * BigInt(10000 - slippageBps)) / SLIPPAGE_DENOMINATOR;

  console.log("[PumpSwap Native] Quote calculated:", {
    pool: bestPool.address.toBase58(),
    isBuying,
    inputAmount: inputAmount.toString(),
    outputAmount: outputAmount.toString(),
    priceImpactBps,
    baseReserve: bestPool.baseReserve.toString(),
    quoteReserve: bestPool.quoteReserve.toString(),
  });

  return {
    inputMint,
    outputMint,
    inputAmount,
    outputAmount,
    outputAmountWithFee: outputAmount, // Already includes fee
    minOutputAmount,
    priceImpactBps,
    feeAmount,
    feeBps: Number(TOTAL_FEE_BPS),
    pool: bestPool.address.toBase58(),
    baseReserve: bestPool.baseReserve,
    quoteReserve: bestPool.quoteReserve,
  };
}

/**
 * Get price from pool (SOL per token)
 */
export async function getPumpSwapPrice(
  connection: Connection,
  tokenMint: string
): Promise<number | null> {
  const pools = await findPumpSwapPools(connection, new PublicKey(tokenMint));

  if (pools.length === 0) {
    return null;
  }

  const poolWithReserves = await getPoolReserves(connection, pools[0]);

  if (!poolWithReserves) {
    return null;
  }

  return poolWithReserves.price;
}
