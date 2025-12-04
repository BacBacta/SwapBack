import { NextResponse } from "next/server";
import { getRecentRouterMetrics, getRouterReliabilitySummary } from "@/lib/routerMetrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const summary = getRouterReliabilitySummary();
  const recent = getRecentRouterMetrics(20);

  return NextResponse.json(
    {
      success: true,
      summary,
      recent,
      timestamp: Date.now(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
