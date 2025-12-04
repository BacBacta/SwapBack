/**
 * JSON File Provider (fallback)
 */

import { promises as fs } from "fs";
import path from "path";
import type { PlanStoreProvider } from "../planStoreProvider";

// Types copiés pour éviter dépendance circulaire
type PlanStatus = "pending" | "scheduled" | "running" | "completed" | "failed";
interface HybridExecutionPlan {
  id: string;
  intents: unknown[];
  status: PlanStatus;
  owner?: string;
  priority?: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
  lastError?: string;
}

const STORE_PATH = process.env.HYBRID_PLAN_STORE ?? path.join(process.cwd(), "data", "hybrid-plans.json");

export class JsonPlanStoreProvider implements PlanStoreProvider {
  name = "json-file";

  async isAvailable(): Promise<boolean> {
    return true; // Toujours disponible
  }

  private async ensureStoreFile(): Promise<void> {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    try {
      await fs.access(STORE_PATH);
    } catch {
      await fs.writeFile(STORE_PATH, "[]\n", "utf-8");
    }
  }

  async loadPlans(): Promise<HybridExecutionPlan[]> {
    await this.ensureStoreFile();
    try {
      const raw = await fs.readFile(STORE_PATH, "utf-8");
      return JSON.parse(raw || "[]");
    } catch (error) {
      console.warn("[JsonProvider] Unable to read plan store", error);
      return [];
    }
  }

  async savePlans(plans: HybridExecutionPlan[]): Promise<void> {
    await this.ensureStoreFile();
    await fs.writeFile(STORE_PATH, JSON.stringify(plans, null, 2), "utf-8");
  }

  async enqueue(plan: HybridExecutionPlan): Promise<void> {
    const plans = await this.loadPlans();
    plans.push(plan);
    await this.savePlans(plans);
  }

  async pop(): Promise<HybridExecutionPlan | null> {
    const plans = await this.loadPlans();
    const index = plans.findIndex((p) => p.status === "pending");
    if (index === -1) return null;
    plans[index].status = "scheduled";
    await this.savePlans(plans);
    return plans[index];
  }

  async updateStatus(
    planId: string,
    status: PlanStatus,
    patch?: Partial<HybridExecutionPlan>
  ): Promise<HybridExecutionPlan | null> {
    const plans = await this.loadPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return null;
    plan.status = status;
    if (patch) Object.assign(plan, patch);
    await this.savePlans(plans);
    return plan;
  }
}
