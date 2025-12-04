/**
 * Supabase Provider for Plan Store
 * Utilise Supabase PostgreSQL pour la persistance
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

const TABLE_NAME = "hybrid_execution_plans";

interface SupabaseClient {
  from(table: string): SupabaseQuery;
}

interface SupabaseQuery {
  select(columns?: string): SupabaseQuery;
  insert(data: unknown): SupabaseQuery;
  update(data: unknown): SupabaseQuery;
  delete(): SupabaseQuery;
  eq(column: string, value: unknown): SupabaseQuery;
  in(column: string, values: unknown[]): SupabaseQuery;
  order(column: string, options?: { ascending?: boolean }): SupabaseQuery;
  limit(count: number): SupabaseQuery;
  single(): SupabaseQuery;
  then<T>(resolve: (value: { data: T | null; error: Error | null }) => void): void;
}

export class SupabasePlanStoreProvider implements PlanStoreProvider {
  name = "supabase";
  private client: SupabaseClient | null = null;

  async isAvailable(): Promise<boolean> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return false;

    try {
      await this.getClient();
      // Vérifier que la table existe
      const client = await this.getClient();
      const { error } = await new Promise<{ data: unknown; error: Error | null }>((resolve) =>
        client.from(TABLE_NAME).select("id").limit(1).then(resolve)
      );
      return !error;
    } catch {
      return false;
    }
  }

  private async getClient(): Promise<SupabaseClient> {
    if (this.client) return this.client;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    try {
      // Dynamic import to avoid build errors when module not installed
      const supabaseModule = await (Function('return import("@supabase/supabase-js")')() as Promise<typeof import("@supabase/supabase-js")>);
      this.client = supabaseModule.createClient(url, key) as unknown as SupabaseClient;
      return this.client;
    } catch (e) {
      throw new Error(`Supabase client unavailable: ${e}`);
    }
  }

  async loadPlans(): Promise<HybridExecutionPlan[]> {
    const client = await this.getClient();
    const { data, error } = await new Promise<{ data: HybridExecutionPlan[] | null; error: Error | null }>(
      (resolve) =>
        client
          .from(TABLE_NAME)
          .select("*")
          .order("created_at", { ascending: true })
          .then(resolve)
    );

    if (error) {
      console.warn("[SupabaseProvider] Failed to load plans:", error);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => this.mapFromDb(row));
  }

  async savePlans(plans: HybridExecutionPlan[]): Promise<void> {
    const client = await this.getClient();

    // Supprimer les anciens plans et insérer les nouveaux
    // Note: en production, utiliser une transaction/upsert
    await new Promise<void>((resolve) =>
      client.from(TABLE_NAME).delete().in("id", plans.map((p) => p.id)).then(() => resolve())
    );

    if (plans.length > 0) {
      const rows = plans.map(this.mapToDb);
      await new Promise<void>((resolve) =>
        client.from(TABLE_NAME).insert(rows).then(() => resolve())
      );
    }
  }

  async enqueue(plan: HybridExecutionPlan): Promise<void> {
    const client = await this.getClient();
    const row = this.mapToDb(plan);
    const { error } = await new Promise<{ data: unknown; error: Error | null }>((resolve) =>
      client.from(TABLE_NAME).insert(row).then(resolve)
    );
    if (error) {
      throw new Error(`Failed to enqueue plan: ${error.message}`);
    }
  }

  async pop(): Promise<HybridExecutionPlan | null> {
    const client = await this.getClient();

    // Sélectionner le plus ancien plan pending
    const { data, error } = await new Promise<{ data: HybridExecutionPlan | null; error: Error | null }>(
      (resolve) =>
        client
          .from(TABLE_NAME)
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(1)
          .single()
          .then(resolve)
    );

    if (error || !data) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = this.mapFromDb(data as any);

    // Mettre à jour le statut
    await new Promise<void>((resolve) =>
      client
        .from(TABLE_NAME)
        .update({ status: "scheduled" })
        .eq("id", plan.id)
        .then(() => resolve())
    );

    plan.status = "scheduled";
    return plan;
  }

  async updateStatus(
    planId: string,
    status: PlanStatus,
    patch?: Partial<HybridExecutionPlan>
  ): Promise<HybridExecutionPlan | null> {
    const client = await this.getClient();

    const updateData: Record<string, unknown> = { status };
    if (patch?.lastError) updateData.last_error = patch.lastError;
    if (patch?.metadata) updateData.metadata = patch.metadata;

    const { error } = await new Promise<{ data: unknown; error: Error | null }>((resolve) =>
      client.from(TABLE_NAME).update(updateData).eq("id", planId).then(resolve)
    );

    if (error) {
      console.warn("[SupabaseProvider] Failed to update status:", error);
      return null;
    }

    // Fetch updated plan
    const { data } = await new Promise<{ data: Record<string, unknown> | null; error: Error | null }>(
      (resolve) =>
        client.from(TABLE_NAME).select("*").eq("id", planId).single().then(resolve)
    );

    return data ? this.mapFromDb(data) : null;
  }

  private mapToDb(plan: HybridExecutionPlan): Record<string, unknown> {
    return {
      id: plan.id,
      intents: JSON.stringify(plan.intents),
      status: plan.status,
      owner: plan.owner,
      priority: plan.priority ?? 0,
      created_at: new Date(plan.createdAt).toISOString(),
      metadata: plan.metadata ? JSON.stringify(plan.metadata) : null,
      last_error: plan.lastError,
    };
  }

  private mapFromDb(row: Record<string, unknown>): HybridExecutionPlan {
    return {
      id: row.id as string,
      intents: typeof row.intents === "string" ? JSON.parse(row.intents) : row.intents,
      status: row.status as PlanStatus,
      owner: row.owner as string | undefined,
      priority: row.priority as number | undefined,
      createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
      metadata: row.metadata ? (typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata) : undefined,
      lastError: row.last_error as string | undefined,
    } as HybridExecutionPlan;
  }
}

/**
 * SQL pour créer la table Supabase:
 * 
 * CREATE TABLE hybrid_execution_plans (
 *   id UUID PRIMARY KEY,
 *   intents JSONB NOT NULL,
 *   status TEXT NOT NULL DEFAULT 'pending',
 *   owner TEXT,
 *   priority INTEGER DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   metadata JSONB,
 *   last_error TEXT
 * );
 * 
 * CREATE INDEX idx_plans_status ON hybrid_execution_plans(status);
 * CREATE INDEX idx_plans_owner ON hybrid_execution_plans(owner);
 */
