import { NextResponse } from "next/server";
import { loadOracleTelemetry } from "@/lib/oracleTelemetry";

export const revalidate = 30;

export async function GET() {
  const summary = await loadOracleTelemetry();
  return NextResponse.json(summary);
}
