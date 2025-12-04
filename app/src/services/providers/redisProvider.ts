/**
 * Redis Provider for Plan Store
 * Utilise Redis pour la persistance distribuée et atomique
 */

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

const REDIS_KEY_PLANS = "swapback:hybrid-plans";
const REDIS_KEY_QUEUE = "swapback:plan-queue";

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  lpush(key: string, value: string): Promise<number>;
  rpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  quit(): Promise<void>;
}

// Dynamic import helper to avoid build errors
async function loadIoRedis(): Promise<{ default: new (url: string) => IoRedisInstance } | null> {
  try {
    // Use Function constructor to avoid static analysis
    return await (Function('return import("ioredis")')() as Promise<{ default: new (url: string) => IoRedisInstance }>);
  } catch {
    return null;
  }
}

interface IoRedisInstance {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  lpush(key: string, value: string): Promise<number>;
  rpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  quit(): Promise<void>;
}

export class RedisPlanStoreProvider implements PlanStoreProvider {
  name = "redis";
  private client: RedisClient | null = null;

  async isAvailable(): Promise<boolean> {
    const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
    if (!url) return false;

    try {
      await this.getClient();
      return true;
    } catch {
      return false;
    }
  }

  private async getClient(): Promise<RedisClient> {
    if (this.client) return this.client;

    const url = process.env.REDIS_URL;
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    // Priorité à Upstash (serverless friendly)
    if (upstashUrl && upstashToken) {
      this.client = this.createUpstashClient(upstashUrl, upstashToken);
      return this.client;
    }

    // Fallback Redis standard (via ioredis)
    if (url) {
      try {
        const ioRedisModule = await loadIoRedis();
        if (!ioRedisModule) throw new Error("ioredis not available");
        const Redis = ioRedisModule.default;
        const ioRedis = new Redis(url);
        this.client = {
          get: (k) => ioRedis.get(k),
          set: async (k, v) => { await ioRedis.set(k, v); },
          lpush: (k, v) => ioRedis.lpush(k, v),
          rpop: (k) => ioRedis.rpop(k),
          lrange: (k, start, stop) => ioRedis.lrange(k, start, stop),
          quit: async () => { await ioRedis.quit(); },
        };
        return this.client;
      } catch (e) {
        console.warn("[RedisProvider] ioredis not available", e);
      }
    }

    throw new Error("No Redis client available");
  }

  private createUpstashClient(url: string, token: string): RedisClient {
    const baseUrl = url.replace(/\/$/, "");

    const exec = async (command: string[]): Promise<unknown> => {
      const res = await fetch(`${baseUrl}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.result;
    };

    return {
      get: async (k) => (await exec(["GET", k])) as string | null,
      set: async (k, v) => { await exec(["SET", k, v]); },
      lpush: async (k, v) => (await exec(["LPUSH", k, v])) as number,
      rpop: async (k) => (await exec(["RPOP", k])) as string | null,
      lrange: async (k, start, stop) => (await exec(["LRANGE", k, start.toString(), stop.toString()])) as string[],
      quit: async () => { /* noop for REST */ },
    };
  }

  async loadPlans(): Promise<HybridExecutionPlan[]> {
    const client = await this.getClient();
    const raw = await client.get(REDIS_KEY_PLANS);
    return raw ? JSON.parse(raw) : [];
  }

  async savePlans(plans: HybridExecutionPlan[]): Promise<void> {
    const client = await this.getClient();
    await client.set(REDIS_KEY_PLANS, JSON.stringify(plans));
  }

  async enqueue(plan: HybridExecutionPlan): Promise<void> {
    const client = await this.getClient();
    // Ajouter au set principal
    const plans = await this.loadPlans();
    plans.push(plan);
    await this.savePlans(plans);
    // Ajouter à la queue FIFO
    await client.lpush(REDIS_KEY_QUEUE, plan.id);
  }

  async pop(): Promise<HybridExecutionPlan | null> {
    const client = await this.getClient();
    const planId = await client.rpop(REDIS_KEY_QUEUE);
    if (!planId) return null;

    const plans = await this.loadPlans();
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      plan.status = "scheduled";
      await this.savePlans(plans);
    }
    return plan || null;
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
