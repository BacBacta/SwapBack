import { NextRequest, NextResponse } from "next/server";

const MAINNET_FALLBACK_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
  "https://solana-mainnet.rpc.extrnode.com",
  "https://solana-rpc.publicnode.com",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
  "https://free-rpc.nethermind.io/mainnet-jito",
];

const DEVNET_FALLBACK_RPCS = [
  "https://api.devnet.solana.com",
  "https://rpc.ankr.com/solana_devnet",
];

const TESTNET_FALLBACK_RPCS = [
  "https://api.testnet.solana.com",
];

function uniq(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function getClusterName(): "mainnet" | "devnet" | "testnet" {
  const raw = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || process.env.SOLANA_NETWORK || "mainnet-beta")
    .toLowerCase()
    .trim();

  if (raw === "devnet") return "devnet";
  if (raw === "testnet") return "testnet";
  return "mainnet";
}

function getUpstreams(): string[] {
  const cluster = getClusterName();

  const envRpc =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "";

  const fallbacks =
    cluster === "devnet"
      ? DEVNET_FALLBACK_RPCS
      : cluster === "testnet"
        ? TESTNET_FALLBACK_RPCS
        : MAINNET_FALLBACK_RPCS;

  const candidates = uniq([envRpc, ...fallbacks]).filter(isHttpUrl);

  // Ne jamais autoriser une boucle vers nous-mêmes.
  return candidates.filter((u) => !u.includes("/api/solana-rpc"));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function corsHeaders(request: NextRequest): Record<string, string> {
  // Même si l'appel est same-origin, on répond correctement aux preflights / CORS.
  // En prod, privilégier une origine explicite via ALLOWED_ORIGIN.
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const origin = request.headers.get("origin") || "";

  const allowOrigin = allowedOrigin && allowedOrigin.trim() !== "" ? allowedOrigin : origin || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
    "Vary": "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers });
  }

  if (!bodyText || bodyText.trim() === "") {
    return NextResponse.json({ error: "Empty JSON-RPC body" }, { status: 400, headers });
  }

  // JSON-RPC request passthrough (single or batch).
  // On n'expose aucun paramètre d'URL côté client: ce n'est pas un open proxy.
  const upstreams = getUpstreams();
  if (upstreams.length === 0) {
    return NextResponse.json(
      { error: "No RPC upstream configured" },
      { status: 500, headers }
    );
  }

  const maxAttempts = Math.min(5, upstreams.length);
  let lastError: unknown = null;
  let lastUpstream: string = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const upstream = upstreams[attempt];
    lastUpstream = upstream;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12_000);

      const resp = await fetch(upstream, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "SwapBack-SolanaRpcProxy/1.0",
        },
        body: bodyText,
      });

      clearTimeout(timeoutId);

      // Retry sur rate limit / overload.
      if (resp.status === 429 || resp.status === 503) {
        lastError = new Error(`Upstream returned ${resp.status}`);
        await sleep(250 * (attempt + 1));
        continue;
      }

      const contentType = resp.headers.get("content-type") || "application/json";
      const text = await resp.text();

      return new NextResponse(text, {
        status: resp.status,
        headers: {
          ...headers,
          "Content-Type": contentType,
          "X-RPC-Upstream": upstream,
        },
      });
    } catch (error) {
      lastError = error;
      await sleep(250 * (attempt + 1));
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  console.error(`[solana-rpc] All ${maxAttempts} RPC attempts failed. Last: ${lastUpstream}, Error: ${msg}`);
  return NextResponse.json(
    { 
      error: "RPC temporarily unavailable", 
      message: "Solana RPC is experiencing high load. Please retry in a few seconds.",
      details: msg,
      attempts: maxAttempts
    },
    { status: 502, headers }
  );
}
