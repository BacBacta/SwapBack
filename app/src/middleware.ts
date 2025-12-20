import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware Next.js pour gérer CORS dynamiquement
 * 
 * Ce middleware ajoute les headers CORS à toutes les requêtes API.
 * Il supporte:
 * - Origines multiples via liste blanche
 * - Preflight requests (OPTIONS)
 * - Credentials pour les cookies/auth
 * 
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

// Liste des origines autorisées (configurable via env)
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];
  
  // Origine principale (production)
  if (process.env.ALLOWED_ORIGIN) {
    origins.push(process.env.ALLOWED_ORIGIN);
  }
  
  // Origines secondaires
  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
  }
  
  // En développement, autoriser localhost
  if (process.env.NODE_ENV === 'development') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
    );
  }
  
  // Vercel preview URLs
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  
  return origins;
};

export function middleware(request: NextRequest) {
  // Récupérer l'origine de la requête
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = getAllowedOrigins();
  
  // Déterminer l'origine à autoriser
  let allowOrigin = '*';
  if (origin && allowedOrigins.length > 0) {
    // Si l'origine est dans la liste, l'utiliser
    if (allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    } else if (allowedOrigins.includes('*')) {
      allowOrigin = '*';
    }
    // Sinon on garde '*' pour le dev
  }

  // CORS: ne jamais combiner "Origin: *" avec "Credentials: true".
  // Si on reflète une origine explicite, on active credentials + Vary.
  const allowCredentials = allowOrigin !== '*';
  
  // Pour les preflight requests (OPTIONS), retourner immédiatement
  if (request.method === 'OPTIONS') {
    const preflightHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,Accept',
      'Access-Control-Max-Age': '86400', // Cache preflight pour 24h
    };

    if (allowCredentials) {
      preflightHeaders['Access-Control-Allow-Credentials'] = 'true';
      preflightHeaders['Vary'] = 'Origin';
    }

    return new NextResponse(null, {
      status: 204,
      headers: preflightHeaders,
    });
  }
  
  // Pour les autres requêtes, continuer avec les headers CORS
  const response = NextResponse.next();
  
  // Ajouter les headers CORS
  response.headers.set('Access-Control-Allow-Origin', allowOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept');
  if (allowCredentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  } else {
    response.headers.delete('Access-Control-Allow-Credentials');
  }
  
  // Headers de sécurité supplémentaires
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}

// Matcher: Appliquer uniquement aux routes API
export const config = {
  matcher: [
    '/api/:path*',
  ],
};
