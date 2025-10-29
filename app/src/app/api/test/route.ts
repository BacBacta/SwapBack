/**
 * SIMPLE TEST API - Vérifier si les API routes fonctionnent sur Vercel
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "API route works!",
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      USE_MOCK_QUOTES: process.env.USE_MOCK_QUOTES,
    }
  });
}

export async function POST() {
  return NextResponse.json({
    success: true,
    message: "POST works!",
    mockQuote: {
      inAmount: "1000000000",
      outAmount: "95000000",
      priceImpactPct: "0.15",
      _isMockData: true,
    }
  });
}
