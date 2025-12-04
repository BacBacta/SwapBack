/**
 * Plan Store Provider Interface
 * Abstraction pour la persistance des plans (JSON, Redis, Supabase)
 */

// Types locaux pour éviter dépendance circulaire
export type PlanStatus = "pending" | "scheduled" | "running" | "completed" | "failed";

export interface HybridExecutionPlan {
  id: string;
  intents: unknown[];
  status: PlanStatus;
  owner?: string;
  priority?: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
  lastError?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPlan = any;

export interface PlanStoreProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  
  loadPlans(): Promise<AnyPlan[]>;
  savePlans(plans: AnyPlan[]): Promise<void>;
  
  // Optionnel: méthodes optimisées pour les stores distribués
  enqueue?(plan: AnyPlan): Promise<void>;
  pop?(): Promise<AnyPlan | null>;
  updateStatus?(planId: string, status: PlanStatus, patch?: Partial<AnyPlan>): Promise<AnyPlan | null>;
}

export type ProviderType = "json" | "redis" | "supabase";

/**
 * Sélectionne le meilleur provider disponible
 */
export async function selectProvider(): Promise<PlanStoreProvider> {
  const preferredOrder: ProviderType[] = ["redis", "supabase", "json"];
  
  for (const type of preferredOrder) {
    const provider = await createProvider(type);
    if (provider && await provider.isAvailable()) {
      console.log(`[PlanStore] Using provider: ${provider.name}`);
      return provider;
    }
  }
  
  // Fallback to JSON (always available)
  const jsonProvider = await createProvider("json");
  console.log(`[PlanStore] Fallback to JSON provider`);
  return jsonProvider!;
}

async function createProvider(type: ProviderType): Promise<PlanStoreProvider | null> {
  switch (type) {
    case "redis":
      // Only load Redis provider if environment variables are set
      if (!process.env.REDIS_URL && !process.env.UPSTASH_REDIS_REST_URL) {
        return null;
      }
      try {
        const { RedisPlanStoreProvider } = await import("./providers/redisProvider");
        return new RedisPlanStoreProvider();
      } catch {
        return null;
      }
    case "supabase":
      // Only load Supabase provider if environment variables are set
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return null;
      }
      try {
        const { SupabasePlanStoreProvider } = await import("./providers/supabaseProvider");
        return new SupabasePlanStoreProvider();
      } catch {
        return null;
      }
    case "json":
      const { JsonPlanStoreProvider } = await import("./providers/jsonProvider");
      return new JsonPlanStoreProvider();
    default:
      return null;
  }
}

// Instance singleton du provider actif
let activeProvider: PlanStoreProvider | null = null;

export async function getProvider(): Promise<PlanStoreProvider> {
  if (!activeProvider) {
    activeProvider = await selectProvider();
  }
  return activeProvider;
}

/**
 * Reset le provider (utile pour les tests)
 */
export function resetProvider(): void {
  activeProvider = null;
}
