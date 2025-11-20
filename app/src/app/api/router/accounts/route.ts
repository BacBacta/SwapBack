import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lazy load the handler to prevent build-time execution of heavy dependencies
export async function POST(request: NextRequest) {
  const { handlePOST } = await import("./handler");
  return handlePOST(request);
}

export async function GET() {
  const { handleGET } = await import("./handler");
  return handleGET();
}
