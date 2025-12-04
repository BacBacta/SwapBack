import { promises as fs } from "fs";
import path from "path";
import type { HybridRouteIntent } from "@/lib/routing/hybridRouting";
import { getProvider, type PlanStoreProvider } from "./planStoreProvider";

export type PlanStatus = "pending" | "scheduled" | "running" | "completed" | "failed";

export interface StoredHybridIntent extends HybridRouteIntent {
  transactionBase64?: string;
  minOutLamports?: number;
  owner?: string;
  jobId?: string;
}

export interface HybridExecutionPlan {
  id: string;
  intents: StoredHybridIntent[];
  status: PlanStatus;
  owner?: string;
  priority?: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
  lastError?: string;
}

// Cache du provider
let _provider: PlanStoreProvider | null = null;

async function getActiveProvider(): Promise<PlanStoreProvider> {
  if (!_provider) {
    _provider = await getProvider();
  }
  return _provider;
}

// Legacy: Chemin du store JSON (pour compatibilité)
const STORE_PATH = process.env.HYBRID_PLAN_STORE ?? path.join(process.cwd(), "data", "hybrid-plans.json");

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]\n", "utf-8");
  }
}

async function loadPlans(): Promise<HybridExecutionPlan[]> {
  const provider = await getActiveProvider();
  return provider.loadPlans() as Promise<HybridExecutionPlan[]>;
}

async function savePlans(plans: HybridExecutionPlan[]): Promise<void> {
  const provider = await getActiveProvider();
  return provider.savePlans(plans as unknown[]);
}

export async function readPendingPlans(): Promise<HybridExecutionPlan[]> {
  const plans = await loadPlans();
  return plans
    .filter((plan) => plan.status === "pending" || plan.status === "scheduled")
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.createdAt - b.createdAt);
}

export async function popNextPlan(): Promise<HybridExecutionPlan | null> {
  const provider = await getActiveProvider();
  if (provider.pop) {
    return provider.pop();
  }
  // Fallback: utiliser loadPlans/savePlans
  const plans = await loadPlans();
  const index = plans.findIndex((plan) => plan.status === "pending");
  if (index === -1) {
    return null;
  }
  plans[index].status = "scheduled";
  await savePlans(plans);
  return plans[index];
}

export async function markPlanStatus(
  planId: string,
  status: PlanStatus,
  patch?: Partial<HybridExecutionPlan>
): Promise<HybridExecutionPlan | null> {
  const provider = await getActiveProvider();
  if (provider.updateStatus) {
    return provider.updateStatus(planId, status, patch);
  }
  // Fallback
  const plans = await loadPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) {
    return null;
  }
  plan.status = status;
  if (patch) {
    Object.assign(plan, patch);
  }
  await savePlans(plans);
  return plan;
}

export async function enqueuePlan(plan: HybridExecutionPlan): Promise<void> {
  const provider = await getActiveProvider();
  if (provider.enqueue) {
    return provider.enqueue(plan);
  }
  // Fallback
  const plans = await loadPlans();
  plans.push(plan);
  await savePlans(plans);
}

export async function clearPlans(): Promise<void> {
  await savePlans([]);
}
