/**
 * Health Monitor Unifié
 * Surveille tous les services et simplifie la gestion des points de failure
 */

import { CircuitBreaker, getCircuit } from "../resilience/circuitBreaker";

export type ServiceStatus = "healthy" | "degraded" | "down";

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  lastCheck: number;
  errorRate: number;
  circuitState: "closed" | "open" | "half-open";
  message?: string;
}

export interface SystemHealth {
  overall: ServiceStatus;
  services: ServiceHealth[];
  timestamp: number;
  recommendations: string[];
}

interface HealthCheckConfig {
  /** Intervalle de vérification en ms */
  checkIntervalMs: number;
  /** Timeout pour chaque check */
  timeoutMs: number;
  /** Seuil de latence pour dégradation (ms) */
  latencyThresholdMs: number;
  /** Seuil d'erreurs pour dégradation (0-1) */
  errorThreshold: number;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  checkIntervalMs: 10000, // 10 secondes
  timeoutMs: 5000,
  latencyThresholdMs: 2000,
  errorThreshold: 0.1, // 10% erreurs
};

type HealthChecker = () => Promise<{ ok: boolean; latencyMs: number; message?: string }>;

interface ServiceDefinition {
  name: string;
  checker: HealthChecker;
  critical: boolean;
  circuit: CircuitBreaker;
}

export class HealthMonitor {
  private services: ServiceDefinition[] = [];
  private healthHistory: Map<string, { errors: number; total: number }> = new Map();
  private config: HealthCheckConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastHealth: SystemHealth | null = null;
  private listeners: ((health: SystemHealth) => void)[] = [];

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Enregistre un service à surveiller
   */
  registerService(
    name: string,
    checker: HealthChecker,
    options: { critical?: boolean } = {}
  ): void {
    const circuit = getCircuit(name);
    this.services.push({
      name,
      checker,
      critical: options.critical ?? false,
      circuit,
    });
    this.healthHistory.set(name, { errors: 0, total: 0 });
  }

  /**
   * Ajoute un listener pour les changements de santé
   */
  onHealthChange(listener: (health: SystemHealth) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Démarre la surveillance
   */
  start(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkAll();
    }, this.config.checkIntervalMs);

    // Check initial
    this.checkAll();
  }

  /**
   * Arrête la surveillance
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Vérifie tous les services
   */
  async checkAll(): Promise<SystemHealth> {
    const checks = await Promise.all(
      this.services.map(service => this.checkService(service))
    );

    const recommendations = this.generateRecommendations(checks);
    const overall = this.calculateOverallStatus(checks);

    const health: SystemHealth = {
      overall,
      services: checks,
      timestamp: Date.now(),
      recommendations,
    };

    this.lastHealth = health;
    this.notifyListeners(health);

    return health;
  }

  /**
   * Retourne la dernière santé connue
   */
  getLastHealth(): SystemHealth | null {
    return this.lastHealth;
  }

  private async checkService(service: ServiceDefinition): Promise<ServiceHealth> {
    const history = this.healthHistory.get(service.name)!;
    history.total++;

    try {
      const startTime = Date.now();
      const result = await Promise.race([
        service.checker(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), this.config.timeoutMs)
        ),
      ]);

      const latencyMs = Date.now() - startTime;

      if (!result.ok) {
        history.errors++;
      }

      const errorRate = history.total > 0 ? history.errors / history.total : 0;
      const status = this.determineStatus(result.ok, latencyMs, errorRate);

      return {
        name: service.name,
        status,
        latencyMs,
        lastCheck: Date.now(),
        errorRate,
        circuitState: service.circuit.getState(),
        message: result.message,
      };
    } catch (error) {
      history.errors++;
      const errorRate = history.total > 0 ? history.errors / history.total : 0;

      return {
        name: service.name,
        status: "down",
        latencyMs: this.config.timeoutMs,
        lastCheck: Date.now(),
        errorRate,
        circuitState: service.circuit.getState(),
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private determineStatus(ok: boolean, latencyMs: number, errorRate: number): ServiceStatus {
    if (!ok || errorRate > 0.5) return "down";
    if (latencyMs > this.config.latencyThresholdMs || errorRate > this.config.errorThreshold) {
      return "degraded";
    }
    return "healthy";
  }

  private calculateOverallStatus(services: ServiceHealth[]): ServiceStatus {
    const criticalServices = this.services.filter(s => s.critical);
    const criticalHealth = services.filter(h =>
      criticalServices.some(s => s.name === h.name)
    );

    // Si un service critique est down, système down
    if (criticalHealth.some(h => h.status === "down")) {
      return "down";
    }

    // Si un service critique est dégradé, système dégradé
    if (criticalHealth.some(h => h.status === "degraded")) {
      return "degraded";
    }

    // Si >50% des services sont dégradés, système dégradé
    const degradedCount = services.filter(h => h.status !== "healthy").length;
    if (degradedCount > services.length / 2) {
      return "degraded";
    }

    return "healthy";
  }

  private generateRecommendations(services: ServiceHealth[]): string[] {
    const recommendations: string[] = [];

    for (const service of services) {
      if (service.status === "down") {
        recommendations.push(`🔴 ${service.name}: Service indisponible - vérifier la connectivité`);
      } else if (service.circuitState === "open") {
        recommendations.push(`⚠️ ${service.name}: Circuit ouvert - attendre le reset automatique`);
      } else if (service.status === "degraded") {
        if (service.latencyMs > this.config.latencyThresholdMs) {
          recommendations.push(`🟡 ${service.name}: Latence élevée (${service.latencyMs}ms) - considérer un fallback`);
        }
        if (service.errorRate > this.config.errorThreshold) {
          recommendations.push(`🟡 ${service.name}: Taux d'erreur élevé (${(service.errorRate * 100).toFixed(1)}%)`);
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ Tous les services fonctionnent normalement");
    }

    return recommendations;
  }

  private notifyListeners(health: SystemHealth): void {
    for (const listener of this.listeners) {
      try {
        listener(health);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// === Services pré-configurés ===

export function createDefaultHealthMonitor(): HealthMonitor {
  const monitor = new HealthMonitor();

  // Jupiter API
  monitor.registerService(
    "jupiter",
    async () => {
      const start = Date.now();
      try {
        const res = await fetch("https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=50", {
          signal: AbortSignal.timeout(3000),
        });
        return { ok: res.ok, latencyMs: Date.now() - start };
      } catch {
        return { ok: false, latencyMs: Date.now() - start, message: "Jupiter unreachable" };
      }
    },
    { critical: true }
  );

  // Jito Block Engine
  monitor.registerService(
    "jito",
    async () => {
      const start = Date.now();
      try {
        const res = await fetch("https://mainnet.block-engine.jito.wtf/api/v1/bundles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTipAccounts", params: [] }),
          signal: AbortSignal.timeout(3000),
        });
        return { ok: res.ok, latencyMs: Date.now() - start };
      } catch {
        return { ok: false, latencyMs: Date.now() - start, message: "Jito unreachable" };
      }
    },
    { critical: false }
  );

  // Solana RPC (Helius/Triton)
  monitor.registerService(
    "solana-rpc",
    async () => {
      const start = Date.now();
      const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_URL || process.env.NEXT_PUBLIC_RPC_URL;
      if (!rpcUrl) {
        return { ok: false, latencyMs: 0, message: "No RPC URL configured" };
      }
      try {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
          signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        return { ok: data.result === "ok", latencyMs: Date.now() - start };
      } catch {
        return { ok: false, latencyMs: Date.now() - start, message: "RPC unreachable" };
      }
    },
    { critical: true }
  );

  return monitor;
}

// Singleton
let globalMonitor: HealthMonitor | null = null;

export function getHealthMonitor(): HealthMonitor {
  if (!globalMonitor) {
    globalMonitor = createDefaultHealthMonitor();
  }
  return globalMonitor;
}
