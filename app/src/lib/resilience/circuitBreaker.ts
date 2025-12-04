/**
 * Circuit Breaker avec Retry Intelligent
 * Gère les échecs de services externes (Jupiter, RPC, etc.)
 */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  /** Nombre d'échecs avant ouverture du circuit */
  failureThreshold: number;
  /** Temps en ms avant de passer à half-open */
  resetTimeoutMs: number;
  /** Nombre de succès requis en half-open pour fermer */
  successThreshold: number;
  /** Monitorer les métriques */
  onStateChange?: (state: CircuitState, name: string) => void;
}

export interface RetryConfig {
  /** Nombre max de tentatives */
  maxRetries: number;
  /** Délai initial en ms */
  initialDelayMs: number;
  /** Facteur multiplicatif pour backoff exponentiel */
  backoffMultiplier: number;
  /** Délai max en ms */
  maxDelayMs: number;
  /** Ajouter du jitter pour éviter les thundering herds */
  jitter: boolean;
  /** Erreurs à retry (par défaut toutes) */
  retryableErrors?: (error: Error) => boolean;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 secondes
  successThreshold: 2,
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  jitter: true,
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;
  readonly name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  getState(): CircuitState {
    // Vérifier si on doit passer à half-open
    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.transitionTo("half-open");
      }
    }
    return this.state;
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      console.log(`[CircuitBreaker:${this.name}] ${oldState} → ${newState}`);
      this.config.onStateChange?.(newState, this.name);

      // Reset counters on state change
      if (newState === "half-open") {
        this.successCount = 0;
      } else if (newState === "closed") {
        this.failureCount = 0;
      }
    }
  }

  canExecute(): boolean {
    const state = this.getState();
    return state !== "open";
  }

  recordSuccess(): void {
    if (this.state === "half-open") {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo("closed");
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "half-open") {
      // Retour immédiat à open
      this.transitionTo("open");
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo("open");
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitOpenError(this.name, this.config.resetTimeoutMs - (Date.now() - this.lastFailureTime));
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  getStats() {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilReset:
        this.state === "open" ? Math.max(0, this.config.resetTimeoutMs - (Date.now() - this.lastFailureTime)) : 0,
    };
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly retryAfterMs: number
  ) {
    super(`Circuit ${circuitName} is open. Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = "CircuitOpenError";
  }
}

/**
 * Calcule le délai avec backoff exponentiel + jitter optionnel
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  delay = Math.min(delay, config.maxDelayMs);

  if (config.jitter) {
    // Ajouter ±25% de jitter
    const jitterRange = delay * 0.25;
    delay += Math.random() * jitterRange * 2 - jitterRange;
  }

  return Math.floor(delay);
}

/**
 * Exécute une fonction avec retry et backoff exponentiel
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Vérifier si l'erreur est retryable
      if (cfg.retryableErrors && !cfg.retryableErrors(lastError)) {
        throw lastError;
      }

      if (attempt < cfg.maxRetries) {
        const delay = calculateDelay(attempt, cfg);
        console.log(`[Retry] Attempt ${attempt + 1}/${cfg.maxRetries + 1} failed. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Combine Circuit Breaker + Retry
 */
export async function executeWithResilience<T>(
  fn: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  return retryWithBackoff(async () => {
    return circuitBreaker.execute(fn);
  }, retryConfig);
}

// Singleton circuits pour services communs
const circuits = new Map<string, CircuitBreaker>();

export function getCircuit(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  if (!circuits.has(name)) {
    circuits.set(name, new CircuitBreaker(name, config));
  }
  return circuits.get(name)!;
}

export function resetAllCircuits(): void {
  circuits.forEach((c) => c.reset());
}

/**
 * Helper pour créer un fetch avec retry + circuit breaker
 */
export function createResilientFetch(
  circuitName: string,
  circuitConfig?: Partial<CircuitBreakerConfig>,
  retryConfig?: Partial<RetryConfig>
) {
  const circuit = getCircuit(circuitName, circuitConfig);

  return async function resilientFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    return executeWithResilience(
      async () => {
        const response = await fetch(input, init);
        if (!response.ok && response.status >= 500) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
      },
      circuit,
      {
        ...retryConfig,
        retryableErrors: (error) => {
          // Retry sur erreurs réseau et 5xx
          return (
            error.message.includes("fetch") ||
            error.message.includes("network") ||
            error.message.includes("HTTP 5")
          );
        },
      }
    );
  };
}
