/**
 * API Route: Enqueue Hybrid Execution Plan
 * POST /api/swap/enqueue
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { enqueuePlan, type HybridExecutionPlan, type StoredHybridIntent } from "@/services/hybridPlanStore";
import type { HybridRouteIntent } from "@/lib/routing/hybridRouting";

function createPlanId() {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intents, owner, priority, metadata } = body as {
      intents?: HybridRouteIntent[];
      owner?: string;
      priority?: number;
      metadata?: Record<string, unknown>;
    };

    if (!intents || !Array.isArray(intents) || intents.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty intents array" },
        { status: 400 }
      );
    }

    const plan: HybridExecutionPlan = {
      id: createPlanId(),
      intents: intents as StoredHybridIntent[],
      status: "pending",
      owner: owner ?? null as unknown as string,
      priority: priority ?? 0,
      createdAt: Date.now(),
      metadata: metadata ?? {},
    };

    await enqueuePlan(plan);

    return NextResponse.json({
      success: true,
      planId: plan.id,
      intentCount: plan.intents.length,
    });
  } catch (error) {
    console.error("❌ Error in /api/swap/enqueue:", error);
    return NextResponse.json(
      {
        error: "Failed to enqueue plan",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Hybrid Plan Enqueue API",
    usage: "POST with { intents: HybridRouteIntent[], owner?, priority?, metadata? }",
  });
}
