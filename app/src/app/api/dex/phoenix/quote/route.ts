import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import * as Phoenix from '@ellipsis-labs/phoenix-sdk';

/**
 * Phoenix DEX Quote API
 * 
 * Utilise le SDK Phoenix pour obtenir des quotes depuis l'orderbook on-chain.
 * Phoenix est un CLOB (Central Limit Order Book) sur Solana.
 * 
 * @see https://docs.phoenix.trade/
 * @see https://github.com/Ellipsis-Labs/phoenix-sdk
 * 
 * @author SwapBack Team
 * @date December 21, 2025
 */

// ============================================================================
// TYPES
// ============================================================================

interface PhoenixQuoteResponse {
  outputAmount: number;
  priceImpactBps: number;
  price: number;
  source: 'phoenix-sdk';
  marketAddress: string;
  side: 'buy' | 'sell';
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Phoenix mainnet markets
const PHOENIX_MARKETS: Record<string, { address: string; baseMint: string; quoteMint: string }> = {
  // SOL/USDC
  'So11111111111111111111111111111111111111112:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    address: '4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg',
    baseMint: 'So11111111111111111111111111111111111111112',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:So11111111111111111111111111111111111111112': {
    address: '4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg',
    baseMint: 'So11111111111111111111111111111111111111112',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  // BONK/USDC
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    address: '2fBqLAuXxDNbT3sT1PLgVJpYCxCZvXj4KpbZBwmhJMbR',
    baseMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    address: '2fBqLAuXxDNbT3sT1PLgVJpYCxCZvXj4KpbZBwmhJMbR',
    baseMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
};

// Token decimals
const TOKEN_DECIMALS: Record<string, number> = {
  'So11111111111111111111111111111111111111112': 9,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5,
};

// Cache for Phoenix clients (singleton pattern)
let phoenixClientCache: Map<string, Phoenix.Client> = new Map();

// ============================================================================
// HELPERS
// ============================================================================

function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_RPC_URL 
    || process.env.RPC_MAINNET_URL 
    || 'https://api.mainnet-beta.solana.com';
}

async function getPhoenixClient(connection: Connection, marketAddress: string): Promise<Phoenix.Client> {
  const cacheKey = marketAddress;
  
  if (phoenixClientCache.has(cacheKey)) {
    return phoenixClientCache.get(cacheKey)!;
  }
  
  try {
    const client = await Phoenix.Client.create(connection);
    phoenixClientCache.set(cacheKey, client);
    return client;
  } catch (error) {
    console.error('[Phoenix] Failed to create client:', error);
    throw error;
  }
}

// ============================================================================
// HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400 }
    );
  }

  const amountNum = parseInt(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return NextResponse.json(
      { error: 'Invalid amount' },
      { status: 400 }
    );
  }

  const pairKey = `${inputMint}:${outputMint}`;
  const marketConfig = PHOENIX_MARKETS[pairKey];

  if (!marketConfig) {
    return NextResponse.json(
      { 
        error: 'Market not available',
        availableMarkets: Object.keys(PHOENIX_MARKETS)
          .filter((k, i, arr) => arr.indexOf(k) === i)
          .slice(0, 5),
      },
      { status: 404 }
    );
  }

  try {
    const connection = new Connection(getRpcUrl(), 'confirmed');
    const client = await getPhoenixClient(connection, marketConfig.address);
    const marketPubkey = new PublicKey(marketConfig.address);
    
    // Determine side: if inputMint is base, we're selling base (sell side)
    // if inputMint is quote, we're buying base (buy side)
    const isSelling = inputMint === marketConfig.baseMint;
    const side = isSelling ? Phoenix.Side.Ask : Phoenix.Side.Bid;
    
    // Get market data
    const marketData = client.marketStates.get(marketConfig.address);
    
    if (!marketData) {
      // Try to refresh market data
      await client.addMarket(marketConfig.address);
      const refreshedMarketData = client.marketStates.get(marketConfig.address);
      
      if (!refreshedMarketData) {
        return NextResponse.json(
          { error: 'Failed to load market data' },
          { status: 500 }
        );
      }
    }

    // Get orderbook (UI format with human-readable prices)
    const ladder = client.getUiLadder(marketConfig.address);
    
    if (!ladder) {
      return NextResponse.json(
        { error: 'Failed to get orderbook' },
        { status: 500 }
      );
    }

    // Calculate output amount by walking the orderbook
    const inputDecimals = TOKEN_DECIMALS[inputMint] || 9;
    const outputDecimals = TOKEN_DECIMALS[outputMint] || 6;
    
    // Convert input amount to human-readable
    const inputAmountHuman = amountNum / Math.pow(10, inputDecimals);
    
    let remainingInput = inputAmountHuman;
    let totalOutput = 0;
    let weightedPriceSum = 0;
    let totalVolume = 0;
    
    // Walk the appropriate side of the book (UiLadder has price/size in human-readable format)
    const orders = isSelling ? ladder.bids : ladder.asks;
    
    for (const level of orders) {
      if (remainingInput <= 0) break;
      
      // UiLadderLevel has price and quantity as numbers
      const priceNum = level.price;
      const sizeNum = level.quantity;
      
      if (isSelling) {
        // Selling base for quote: we get (size * price) quote tokens
        const fillSize = Math.min(remainingInput, sizeNum);
        totalOutput += fillSize * priceNum;
        weightedPriceSum += priceNum * fillSize;
        totalVolume += fillSize;
        remainingInput -= fillSize;
      } else {
        // Buying base with quote: we spend quote to get base
        const quoteAvailable = sizeNum * priceNum;
        const quoteFill = Math.min(remainingInput, quoteAvailable);
        const baseFill = quoteFill / priceNum;
        totalOutput += baseFill;
        weightedPriceSum += priceNum * baseFill;
        totalVolume += baseFill;
        remainingInput -= quoteFill;
      }
    }
    
    // Calculate average price and price impact
    const avgPrice = totalVolume > 0 ? weightedPriceSum / totalVolume : 0;
    const firstLevel = orders[0];
    const midPrice = firstLevel ? firstLevel.price : avgPrice;
    const priceImpactBps = midPrice > 0 
      ? Math.abs((avgPrice - midPrice) / midPrice * 10000)
      : 0;
    
    // Convert output to lamports/smallest unit
    const outputAmount = Math.floor(totalOutput * Math.pow(10, outputDecimals));
    
    // Check if order was fully filled
    if (remainingInput > inputAmountHuman * 0.01) {
      console.log(`[Phoenix] Partial fill: ${((1 - remainingInput / inputAmountHuman) * 100).toFixed(2)}%`);
    }

    const response: PhoenixQuoteResponse = {
      outputAmount,
      priceImpactBps: Math.round(priceImpactBps),
      price: avgPrice,
      source: 'phoenix-sdk',
      marketAddress: marketConfig.address,
      side: isSelling ? 'sell' : 'buy',
    };

    console.log('[Phoenix] Quote:', {
      pair: `${inputMint.slice(0, 8)}.../${outputMint.slice(0, 8)}...`,
      inputAmount: amountNum,
      outputAmount,
      priceImpactBps: Math.round(priceImpactBps),
    });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Phoenix] Quote error:', error);
    return NextResponse.json(
      { error: `Phoenix SDK error: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
