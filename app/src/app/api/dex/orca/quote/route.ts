/**
 * API Route: /api/dex/orca/quote
 * 
 * Proxy pour obtenir des quotes Orca Whirlpool directement
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const pool = searchParams.get('pool');

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400 }
    );
  }

  try {
    // Orca utilise le SDK, pas une API REST publique
    // On utilise une estimation basée sur les données du pool
    // Pour une implémentation complète, utiliser @orca-so/whirlpools-sdk côté serveur
    
    // Estimation simple: assumer 0.25% de frais pour les pools concentrés
    const inputAmount = parseInt(amount);
    const feeRate = 0.0025; // 0.25%
    const estimatedOutput = Math.floor(inputAmount * (1 - feeRate));
    
    return NextResponse.json({
      inputMint,
      outputMint,
      inputAmount,
      outputAmount: estimatedOutput,
      priceImpact: feeRate,
      pool: pool || 'estimated',
      source: 'orca-estimate',
      note: 'This is an estimate. For exact quotes, use the Whirlpool SDK.',
    });
  } catch (error) {
    console.error('[Orca Quote API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Orca quote', details: String(error) },
      { status: 502 }
    );
  }
}
