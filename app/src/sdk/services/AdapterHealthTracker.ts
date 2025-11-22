export type AdapterHealthStatus = "healthy" | "degraded" | "offline";

export interface AdapterHealthSnapshot {
  status: AdapterHealthStatus;
  consecutiveFailures: number;
  lastSuccessMs: number | null;
  lastFailureMs: number | null;
  lastLatencyMs: number | null;
  lastError?: string;
}

export interface AdapterHealthConfig {
  /** How many consecutive failures before we mark the adapter as offline */
  failureThreshold?: number;
  /** How long (ms) to wait before retrying after hitting the threshold */
  cooldownMs?: number;
}

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 30_000;

export class AdapterHealthTracker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private state: {
    consecutiveFailures: number;
    lastSuccessMs: number | null;
    lastFailureMs: number | null;
    lastLatencyMs: number | null;
    lastError?: string;
  } = {
    consecutiveFailures: 0,
    lastSuccessMs: null,
    lastFailureMs: null,
    lastLatencyMs: null,
    lastError: undefined,
  };

  constructor(config: AdapterHealthConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.cooldownMs = config.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  }

  markSuccess(latencyMs: number): void {
    this.state = {
      consecutiveFailures: 0,
      lastSuccessMs: Date.now(),
      lastFailureMs: this.state.lastFailureMs,
      lastLatencyMs: latencyMs,
      lastError: undefined,
    };
  }

  markFailure(error?: unknown): void {
    const message = error instanceof Error ? error.message : String(error ?? "unknown error");
    this.state = {
      consecutiveFailures: this.state.consecutiveFailures + 1,
      lastSuccessMs: this.state.lastSuccessMs,
      lastFailureMs: Date.now(),
      lastLatencyMs: this.state.lastLatencyMs,
      lastError: message,
    };
  }

  canAttempt(): boolean {
    if (this.state.consecutiveFailures < this.failureThreshold) {
      return true;
    }
    if (!this.state.lastFailureMs) {
      return true;
    }
    return Date.now() - this.state.lastFailureMs >= this.cooldownMs;
  }

  getHealth(): AdapterHealthSnapshot {
    const status = this.state.consecutiveFailures >= this.failureThreshold
      ? this.isCooldownExpired()
        ? "degraded"
        : "offline"
      : this.state.consecutiveFailures === 0
      ? "healthy"
      : "degraded";

    return {
      status,
      consecutiveFailures: this.state.consecutiveFailures,
      lastSuccessMs: this.state.lastSuccessMs,
      lastFailureMs: this.state.lastFailureMs,
      lastLatencyMs: this.state.lastLatencyMs,
      lastError: this.state.lastError,
    };
  }

  private isCooldownExpired(): boolean {
    if (!this.state.lastFailureMs) {
      return true;
    }
    return Date.now() - this.state.lastFailureMs >= this.cooldownMs;
  }
}
