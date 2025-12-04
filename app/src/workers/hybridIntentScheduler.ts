import { monitor, protocolMonitor } from "@/lib/protocolMonitor";
import type { HybridRouteIntent } from "@/lib/routing/hybridRouting";

export type IntentExecutionHandler = (intent: HybridRouteIntent) => Promise<void> | void;

type PlanTimers = {
  planId: string;
  timers: NodeJS.Timeout[];
};

function cloneIntent(intent: HybridRouteIntent, overrides?: Partial<HybridRouteIntent>): HybridRouteIntent {
  return {
    ...intent,
    ...(overrides || {}),
  };
}

class HybridIntentScheduler {
  private plans = new Map<string, PlanTimers>();

  schedulePlan(planId: string, intents: HybridRouteIntent[], handler: IntentExecutionHandler): number {
    if (!intents.length) {
      return 0;
    }

    this.cancelPlan(planId);

    const timers: NodeJS.Timeout[] = [];
    intents.forEach((intent) => {
      if (intent.type === "twap_plan" && intent.slices && intent.slices > 1) {
        const perSliceShare = Number((intent.percentage / intent.slices).toFixed(4));
        const spacingMs = Math.max(5000, Math.floor((intent.etaSeconds * 1000) / intent.slices));
        for (let slice = 0; slice < intent.slices; slice += 1) {
          const sliceIntent = cloneIntent(intent, {
            percentage: perSliceShare,
            label: `${intent.label} · slice ${slice + 1}/${intent.slices}`,
            slices: 1,
          });
          timers.push(this.enqueueIntent(planId, sliceIntent, handler, spacingMs * slice));
        }
      } else {
        const baseDelay = Math.max(1000, intent.etaSeconds * 1000);
        timers.push(this.enqueueIntent(planId, intent, handler, baseDelay));
      }
    });

    this.plans.set(planId, { planId, timers });
    protocolMonitor.info(
      "swap",
      "Plan hybride programmé",
      `Plan ${planId} avec ${timers.length} jobs`,
      {
        component: "hybridIntentScheduler",
        action: "schedule",
      }
    );
    return timers.length;
  }

  cancelPlan(planId: string) {
    const existing = this.plans.get(planId);
    if (!existing) {
      return;
    }
    existing.timers.forEach((timer) => clearTimeout(timer));
    this.plans.delete(planId);
    protocolMonitor.info(
      "swap",
      "Plan hybride annulé",
      `Plan ${planId} annulé`,
      {
        component: "hybridIntentScheduler",
        action: "cancel",
      }
    );
  }

  async flush(planId: string) {
    const existing = this.plans.get(planId);
    if (!existing) {
      return;
    }
    existing.timers.forEach((timer) => clearTimeout(timer));
    this.plans.delete(planId);
  }

  getActivePlans() {
    return Array.from(this.plans.keys());
  }

  private enqueueIntent(
    planId: string,
    intent: HybridRouteIntent,
    handler: IntentExecutionHandler,
    delayMs: number
  ) {
    const timer = setTimeout(async () => {
      try {
        await handler(intent);
        monitor.swapSuccess(intent.percentage.toString(), intent.label, intent.type, planId);
      } catch (error) {
        monitor.swapError(
          error instanceof Error ? error.message : "Intent execution failed",
          {
            component: "hybridIntentScheduler",
            action: "executeIntent",
            stack: error instanceof Error ? error.stack : undefined,
          }
        );
      }
    }, delayMs);

    return timer;
  }
}

export const hybridIntentScheduler = new HybridIntentScheduler();
