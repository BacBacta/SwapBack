import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy CORS interne pour les appels aux APIs externes (DEX, Jupiter, etc.)
 * 
 * Ce proxy est utilisé comme fallback lorsque les appels directs échouent.
 * Avantages par rapport à un proxy externe (corsfix.com):
 * - Contrôle total sur le code et la sécurité
 * - Pas de limite de taux externe
 * - Logs et monitoring intégrés
 * - Latence réduite (même infrastructure)
 * 
 * Usage: GET /api/cors-proxy?url=<encoded_url>
 * 
 * Configuration via variables d'environnement:
 * - ALLOWED_DOMAINS: Liste de domaines autorisés séparés par des virgules
 * - ALLOWED_ORIGIN: Origine autorisée pour les headers CORS (par défaut: *)
 */

// Liste blanche par défaut des domaines autorisés pour le proxy
const DEFAULT_ALLOWED_DOMAINS = [
  'api.jup.ag',
  'quote-api.jup.ag',
  'public.jupiterapi.com',
  'transaction-v1.raydium.io',
  'api-v3.raydium.io',
  'api.raydium.io',
  'api.mainnet.orca.so',
  'dlmm-api.meteora.ag',
  'api.meteora.ag',
  'api.phoenix.com',
  'phoenix-api.ellipsis.finance',
  'api.dexscreener.com',
  'public-api.birdeye.so',
];

// Fusionner les domaines par défaut avec ceux de la variable d'environnement
function getAllowedDomains(): string[] {
  const envDomains = process.env.ALLOWED_DOMAINS;
  if (envDomains) {
    const customDomains = envDomains.split(',').map(d => d.trim()).filter(Boolean);
    // Fusionner les deux listes sans doublons
    return [...new Set([...DEFAULT_ALLOWED_DOMAINS, ...customDomains])];
  }
  return DEFAULT_ALLOWED_DOMAINS;
}

const ALLOWED_DOMAINS = getAllowedDomains();

// Headers CORS pour les réponses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
};

/**
 * Handler OPTIONS pour les preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Handler GET - Proxy la requête vers l'URL spécifiée
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Décoder l'URL
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(targetUrl);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL encoding' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Valider l'URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(decodedUrl);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Vérifier que le domaine est dans la liste blanche
  const isAllowed = ALLOWED_DOMAINS.some(domain => 
    parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
  );

  if (!isAllowed) {
    console.log(`[cors-proxy] Blocked request to unauthorized domain: ${parsedUrl.hostname}`);
    return NextResponse.json(
      { error: 'Domain not allowed', domain: parsedUrl.hostname },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  console.log(`[cors-proxy] Proxying request to: ${parsedUrl.hostname}${parsedUrl.pathname}`);

  try {
    // Effectuer la requête côté serveur
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(decodedUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SwapBack-Proxy/1.0',
        // Transférer certains headers si présents
        ...(request.headers.get('Authorization') 
          ? { 'Authorization': request.headers.get('Authorization')! } 
          : {}),
      },
    });

    clearTimeout(timeoutId);

    // Récupérer le contenu
    const contentType = response.headers.get('content-type') || 'application/json';
    let body: string | Buffer;

    if (contentType.includes('application/json')) {
      body = await response.text();
    } else {
      body = Buffer.from(await response.arrayBuffer());
    }

    console.log(`[cors-proxy] Response from ${parsedUrl.hostname}: ${response.status}`);

    // Retourner la réponse avec les headers CORS
    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'X-Proxied-From': parsedUrl.hostname,
        ...CORS_HEADERS,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[cors-proxy] Error proxying to ${parsedUrl.hostname}:`, errorMessage);

    // Distinguer les types d'erreur
    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout', target: parsedUrl.hostname },
        { status: 504, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { error: 'Proxy error', message: errorMessage },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}

/**
 * Handler POST - Proxy les requêtes POST (pour Jupiter swap, etc.)
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(targetUrl);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL encoding' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(decodedUrl);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const isAllowed = ALLOWED_DOMAINS.some(domain => 
    parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
  );

  if (!isAllowed) {
    return NextResponse.json(
      { error: 'Domain not allowed' },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  console.log(`[cors-proxy] POST request to: ${parsedUrl.hostname}${parsedUrl.pathname}`);

  try {
    const body = await request.text();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s pour POST

    const response = await fetch(decodedUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'User-Agent': 'SwapBack-Proxy/1.0',
      },
      body,
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        ...CORS_HEADERS,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[cors-proxy] POST error:`, errorMessage);

    return NextResponse.json(
      { error: 'Proxy error', message: errorMessage },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
