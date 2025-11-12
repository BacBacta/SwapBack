/**
 * API Route pour recevoir et stocker les logs d'erreur côté client
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

interface ErrorLog {
  timestamp: string;
  error: {
    message: string;
    name: string;
    stack?: string;
    cause?: unknown;
  };
  context: {
    component?: string;
    action?: string;
    userAgent?: string;
    url?: string;
    pathname?: string;
  };
  environment: {
    isClient: boolean;
    isServer: boolean;
    network?: string;
    hasWallet?: boolean;
  };
  additionalData?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const log: ErrorLog = await request.json();

    // Log dans la console serveur
    console.error("=".repeat(80));
    console.error("🔴 CLIENT ERROR RECEIVED");
    console.error("=".repeat(80));
    console.error("Timestamp:", log.timestamp);
    console.error("Error Name:", log.error.name);
    console.error("Error Message:", log.error.message);
    
    if (log.context.component) {
      console.error("Component:", log.context.component);
    }
    
    if (log.context.action) {
      console.error("Action:", log.context.action);
    }
    
    if (log.context.pathname) {
      console.error("Pathname:", log.context.pathname);
    }
    
    console.error("Environment:", {
      network: log.environment.network,
      hasWallet: log.environment.hasWallet,
    });
    
    if (log.error.stack) {
      console.error("Stack Trace:");
      console.error(log.error.stack);
    }
    
    if (log.additionalData) {
      console.error("Additional Data:", JSON.stringify(log.additionalData, null, 2));
    }
    
    console.error("=".repeat(80));

    // Sauvegarder dans un fichier (optionnel)
    try {
      const logsDir = path.join(process.cwd(), "logs");
      await fs.mkdir(logsDir, { recursive: true });
      
      const filename = `error-${new Date().toISOString().split("T")[0]}.jsonl`;
      const logPath = path.join(logsDir, filename);
      
      await fs.appendFile(logPath, JSON.stringify(log) + "\n");
    } catch (fileError) {
      console.warn("Failed to write log to file:", fileError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing error log:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process error log" },
      { status: 500 }
    );
  }
}
