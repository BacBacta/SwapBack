/**
 * API Route: /api/dex/raydium/quote
 * 
 * Proxy pour obtenir des quotes Raydium AMM directement
 */

import { NextRequest, NextResponse } from 'next/server';

const RAYDIUM_API_BASE = 'https://transaction-v1.raydium.io';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const poolId = searchParams.get('poolId');

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400 }
    );
  }

  try {
    // Obtenir la quote via l'API Raydium
    const quoteUrl = new URL(`${RAYDIUM_API_BASE}/compute/swap-base-in`);
    quoteUrl.searchParams.set('inputMint', inputMint);
    quoteUrl.searchParams.set('outputMint', outputMint);
    quoteUrl.searchParams.set('amount', amount);
    quoteUrl.searchParams.set('slippageBps', '50'); // 0.5%
    quoteUrl.searchParams.set('txVersion', 'V0');
    if (poolId) {
      quoteUrl.searchParams.set('poolId', poolId);
    }

    const response = await fetch(quoteUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Raydium API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: 'Raydium quote failed', details: data.msg },
        { status: 502 }
      );
    }

    // Formater la réponse
    return NextResponse.json({
      inputMint,
      outputMint,
      inputAmount: parseInt(amount),
      outputAmount: parseInt(data.data?.outputAmount || '0'),
      priceImpact: data.data?.priceImpact || 0,
      fee: data.data?.fee || 0,
      route: data.data?.routePlan || [],
      poolId: data.data?.poolId || poolId,
    });
  } catch (error) {
    console.error('[Raydium Quote API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Raydium quote', details: String(error) },
      { status: 502 }
    );
  }
}
