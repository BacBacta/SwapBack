/**
 * API Route pour envoyer des transactions via Jito Block Engine
 * 
 * Proxy côté serveur pour éviter les problèmes CORS
 * Supporte à la fois sendTransaction (1 tx) et sendBundle (multi-tx)
 * 
 * @see https://docs.jito.wtf/lowlatencytxnsend/
 */

import { NextRequest, NextResponse } from "next/server";

// Jito Block Engine URLs
const JITO_MAINNET_URL = "https://mainnet.block-engine.jito.wtf";
const JITO_TRANSACTIONS_ENDPOINT = `${JITO_MAINNET_URL}/api/v1/transactions`;
const JITO_BUNDLES_ENDPOINT = `${JITO_MAINNET_URL}/api/v1/bundles`;

// Timeout pour les requêtes Jito (ms)
const JITO_TIMEOUT = 10000;

interface JitoSendRequest {
  /** Transaction sérialisée en base64 */
  transaction?: string;
  /** Transactions sérialisées en base64 (pour bundles) */
  transactions?: string[];
  /** Encoding (base64 recommandé) */
  encoding?: "base64" | "base58";
  /** Mode bundle only pour revert protection */
  bundleOnly?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: JitoSendRequest = await request.json();
    
    // Validation
    if (!body.transaction && (!body.transactions || body.transactions.length === 0)) {
      return NextResponse.json(
        { error: "Missing transaction or transactions parameter" },
        { status: 400 }
      );
    }
    
    const encoding = body.encoding || "base64";
    
    // Déterminer si c'est un bundle ou une transaction simple
    const isBundle = body.transactions && body.transactions.length > 0;
    const endpoint = isBundle ? JITO_BUNDLES_ENDPOINT : JITO_TRANSACTIONS_ENDPOINT;
    const method = isBundle ? "sendBundle" : "sendTransaction";
    
    // Construire les params selon le type
    let params: unknown[];
    if (isBundle) {
      // Bundle: array of transactions + encoding
      params = [body.transactions, { encoding }];
    } else {
      // Single transaction + encoding
      params = [body.transaction, { encoding }];
    }
    
    // Ajouter bundleOnly si demandé (pour revert protection sur single tx)
    const url = body.bundleOnly && !isBundle 
      ? `${endpoint}?bundleOnly=true` 
      : endpoint;
    
    console.log(`[Jito API] Sending ${method} to ${url}`);
    
    // Faire la requête vers Jito avec timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), JITO_TIMEOUT);
    
    const jitoResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!jitoResponse.ok) {
      const errorText = await jitoResponse.text();
      console.error(`[Jito API] HTTP error: ${jitoResponse.status}`, errorText);
      return NextResponse.json(
        { 
          error: `Jito HTTP error: ${jitoResponse.status}`,
          details: errorText,
        },
        { status: jitoResponse.status }
      );
    }
    
    const jitoData = await jitoResponse.json();
    
    // Vérifier les erreurs RPC
    if (jitoData.error) {
      console.error(`[Jito API] RPC error:`, jitoData.error);
      return NextResponse.json(
        { 
          error: "Jito RPC error",
          details: jitoData.error,
        },
        { status: 400 }
      );
    }
    
    // Extraire le bundle_id du header si disponible (pour sendTransaction as bundle)
    const bundleId = jitoResponse.headers.get("x-bundle-id");
    
    console.log(`[Jito API] Success:`, { 
      result: jitoData.result,
      bundleId,
      method,
    });
    
    return NextResponse.json({
      success: true,
      signature: jitoData.result,
      bundleId,
      method,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isAbort = error instanceof Error && error.name === "AbortError";
    
    console.error(`[Jito API] Error:`, errorMessage);
    
    return NextResponse.json(
      { 
        error: isAbort ? "Jito request timeout" : "Jito request failed",
        details: errorMessage,
      },
      { status: isAbort ? 504 : 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoints: {
      transactions: JITO_TRANSACTIONS_ENDPOINT,
      bundles: JITO_BUNDLES_ENDPOINT,
    },
  });
}
