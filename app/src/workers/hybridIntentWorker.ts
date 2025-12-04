import { hybridIntentScheduler } from "@/workers/hybridIntentScheduler";
import { ExecutionClient } from "@/workers/executionClient";
import {
  popNextPlan,
  markPlanStatus,
  type StoredHybridIntent,
  type HybridExecutionPlan,
} from "@/services/hybridPlanStore";
import { monitor, protocolMonitor } from "@/lib/protocolMonitor";

const POLL_INTERVAL_MS = Number(process.env.HYBRID_WORKER_INTERVAL_MS ?? 15000);
const MAX_CONCURRENT_PLANS = Number(process.env.HYBRID_MAX_CONCURRENT_PLANS ?? 1);

const executionClient = new ExecutionClient();
const activePlans = new Map<string, { remaining: number }>();
let ticking = false;

async function schedulePendingPlan() {
  if (activePlans.size >= MAX_CONCURRENT_PLANS) {
    return;
  }

  const plan = await popNextPlan();
  if (!plan) {
    return;
  }

  const jobs = hybridIntentScheduler.schedulePlan(plan.id, plan.intents, async (intent) => {
    await handleIntent(plan.id, intent as StoredHybridIntent);
  });

  if (!jobs) {
    await markPlanStatus(plan.id, "failed", { lastError: "Plan sans intents" });
    return;
  }

  activePlans.set(plan.id, { remaining: jobs });
  await markPlanStatus(plan.id, "running");
  protocolMonitor.info("swap", "Plan hybride lancé", `Plan ${plan.id} (${jobs} jobs)`, {
    component: "hybridIntentWorker",
    action: "start",
  });
}

async function handleIntent(planId: string, intent: StoredHybridIntent) {
  try {
    await executionClient.execute(intent);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Intent execution failed";
    monitor.swapError(message, {
      component: "hybridIntentWorker",
      action: "executeIntent",
      stack: error instanceof Error ? error.stack : undefined,
    });
    await markPlanStatus(planId, "failed", { lastError: message });
    hybridIntentScheduler.cancelPlan(planId);
    activePlans.delete(planId);
    return;
  }

  const entry = activePlans.get(planId);
  if (!entry) {
    return;
  }
  entry.remaining -= 1;
  if (entry.remaining <= 0) {
    activePlans.delete(planId);
    await markPlanStatus(planId, "completed");
    protocolMonitor.info("swap", "Plan hybride complété", planId, {
      component: "hybridIntentWorker",
      action: "complete",
    });
  }
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    await schedulePendingPlan();
  } catch (error) {
    monitor.swapError(error instanceof Error ? error.message : "Hybrid worker failure", {
      component: "hybridIntentWorker",
      action: "tick",
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    ticking = false;
  }
}

export async function startHybridWorker() {
  await tick();
  return setInterval(tick, POLL_INTERVAL_MS);
}
