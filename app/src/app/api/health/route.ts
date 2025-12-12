/**
 * Health check endpoint pour Fly.io
 * Vérifie la connectivité avec Jupiter et le statut général
 */

import { NextResponse } from 'next/server';

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail';
  latencyMs?: number;
  message?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheck[];
}

// Cache le statut Jupiter pour éviter de le vérifier à chaque requête
let jupiterStatusCache: { ok: boolean; checkedAt: number } | null = null;
const JUPITER_CACHE_TTL = 30000; // 30 secondes

const startTime = Date.now();

const JUPITER_URL = process.env.JUPITER_API_URL || 'https://public.jupiterapi.com';

const JUPITER_HEALTH_QUERY = new URLSearchParams({
  inputMint: 'So11111111111111111111111111111111111111112', // SOL
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  amount: '1000000', // 0.001 SOL
  slippageBps: '50',
});

async function checkJupiterConnectivity(): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const now = Date.now();
  
  // Utiliser le cache si valide
  if (jupiterStatusCache && (now - jupiterStatusCache.checkedAt) < JUPITER_CACHE_TTL) {
    return {
      ok: jupiterStatusCache.ok,
      latencyMs: 0,
      message: jupiterStatusCache.ok ? 'Cached OK' : 'Cached FAIL',
    };
  }

  const checkStart = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${JUPITER_URL.replace(/\/$/, '')}/quote?${JUPITER_HEALTH_QUERY.toString()}`,
      {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
      },
    );

    clearTimeout(timeout);
    const latencyMs = Date.now() - checkStart;

    const ok = response.ok;
    jupiterStatusCache = { ok, checkedAt: now };

    return {
      ok,
      latencyMs,
      message: ok ? 'Jupiter API accessible' : `HTTP ${response.status}`,
    };
  } catch (error) {
    jupiterStatusCache = { ok: false, checkedAt: now };
    
    return {
      ok: false,
      latencyMs: Date.now() - checkStart,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function GET() {
  const requestStart = Date.now();
  
  // Vérifier Jupiter
  const jupiterCheck = await checkJupiterConnectivity();

  // Vérifier la mémoire
  const memoryUsage = process.memoryUsage();
  const memoryOk = memoryUsage.heapUsed < 400 * 1024 * 1024; // < 400MB

  // Construire les checks
  const checks: HealthCheck[] = [
    {
      name: 'jupiter-api',
      status: jupiterCheck.ok ? 'pass' : 'fail',
      latencyMs: jupiterCheck.latencyMs,
      message: jupiterCheck.message,
    },
    {
      name: 'memory',
      status: memoryOk ? 'pass' : 'fail',
      message: `Heap: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
    },
  ];

  const allPassing = checks.every(c => c.status === 'pass');
  const anyFailing = checks.some(c => c.status === 'fail');

  const status: HealthStatus = {
    status: allPassing ? 'healthy' : anyFailing ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  // healthy = 200, degraded = 200 (pour ne pas tuer l'instance), unhealthy = 503
  const httpStatus = status.status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(status, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${Date.now() - requestStart}ms`,
    },
  });
}
