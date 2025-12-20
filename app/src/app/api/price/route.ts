import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route pour récupérer les prix des tokens via plusieurs sources
 * Utilisé comme fallback quand les APIs directes échouent (CORS, rate limiting)
 * 
 * CORS: Cette route supporte les preflight requests (OPTIONS)
 */

// Headers CORS pour les réponses
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowOrigin =
    origin && allowed.length > 0 && allowed.includes(origin)
      ? origin
      : allowed.length > 0
        ? allowed[0]
        : '*';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  };

  if (allowOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }

  return headers;
}

/**
 * Handler OPTIONS pour les preflight requests
 */
export async function OPTIONS(request?: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request?.headers?.get('origin') ?? null),
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'));
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint');

  if (!mint) {
    return NextResponse.json(
      { error: 'Missing mint parameter' }, 
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // Essayer Jupiter Price API d'abord (côté serveur, pas de CORS)
    const jupiterResponse = await fetch(
      `https://api.jup.ag/price/v2?ids=${mint}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 15 }, // Cache 15 secondes
      }
    );

    if (jupiterResponse.ok) {
      const data = await jupiterResponse.json();
      if (data.data && data.data[mint] && data.data[mint].price) {
        const price = parseFloat(data.data[mint].price);
        if (price > 0) {
          return NextResponse.json(
            { price, source: 'jupiter', mint },
            { headers: corsHeaders }
          );
        }
      }
    }

    // Fallback: Birdeye API
    const birdeyeApiKey = process.env.BIRDEYE_API_KEY;
    if (birdeyeApiKey) {
      const birdeyeResponse = await fetch(
        `https://public-api.birdeye.so/defi/price?address=${mint}`,
        {
          headers: {
            'Accept': 'application/json',
            'X-API-KEY': birdeyeApiKey,
          },
          next: { revalidate: 15 },
        }
      );

      if (birdeyeResponse.ok) {
        const birdeyeData = await birdeyeResponse.json();
        if (birdeyeData.data && birdeyeData.data.value) {
          return NextResponse.json(
            { price: birdeyeData.data.value, source: 'birdeye', mint },
            { headers: corsHeaders }
          );
        }
      }
    }

    // Fallback: DexScreener API (gratuit, pas de clé)
    const dexScreenerResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 15 },
      }
    );

    if (dexScreenerResponse.ok) {
      const dexData = await dexScreenerResponse.json();
      if (dexData.pairs && dexData.pairs.length > 0) {
        // Prendre le premier pair avec un prix USD
        const pairWithPrice = dexData.pairs.find((p: { priceUsd?: string }) => p.priceUsd);
        if (pairWithPrice && pairWithPrice.priceUsd) {
          return NextResponse.json(
            { price: parseFloat(pairWithPrice.priceUsd), source: 'dexscreener', mint },
            { headers: corsHeaders }
          );
        }
      }
    }

    // Aucun prix trouvé
    return NextResponse.json(
      { price: 0, source: 'none', mint, error: 'Price not found' },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Price API error:', error);
    return NextResponse.json(
      { price: 0, source: 'error', mint, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
