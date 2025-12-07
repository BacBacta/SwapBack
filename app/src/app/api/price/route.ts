import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route pour récupérer les prix des tokens via plusieurs sources
 * Utilisé comme fallback quand les APIs directes échouent (CORS, rate limiting)
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint');

  if (!mint) {
    return NextResponse.json({ error: 'Missing mint parameter' }, { status: 400 });
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
          return NextResponse.json({ 
            price, 
            source: 'jupiter',
            mint 
          });
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
          return NextResponse.json({ 
            price: birdeyeData.data.value, 
            source: 'birdeye',
            mint 
          });
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
          return NextResponse.json({ 
            price: parseFloat(pairWithPrice.priceUsd), 
            source: 'dexscreener',
            mint 
          });
        }
      }
    }

    // Aucun prix trouvé
    return NextResponse.json({ 
      price: 0, 
      source: 'none',
      mint,
      error: 'Price not found' 
    });

  } catch (error) {
    console.error('Price API error:', error);
    return NextResponse.json({ 
      price: 0, 
      source: 'error',
      mint,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
