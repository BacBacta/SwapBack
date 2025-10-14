/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by temporarily blocking requests
 * after a threshold of consecutive failures is reached.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests blocked
 * - HALF_OPEN: Testing if service recovered
 * 
 * @module circuit-breaker
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** How long to wait before attempting recovery (ms) */
  resetTimeoutMs: number;
  /** Optional success threshold in HALF_OPEN state */
  successThreshold?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextRetryTime: number = 0;
  
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      resetTimeoutMs: config.resetTimeoutMs,
      successThreshold: config.successThreshold || 2,
    };
  }

  /**
   * Check if circuit breaker is tripped (OPEN state)
   */
  isTripped(): boolean {
    // If circuit is OPEN, check if enough time has passed to try again
    if (this.state === CircuitState.OPEN) {
      if (Date.now() >= this.nextRetryTime) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return false; // Allow one attempt
      }
      return true; // Still OPEN
    }

    return false;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      // If enough successes in HALF_OPEN, close the circuit
      if (this.successCount >= (this.config.successThreshold || 2)) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    // If failure threshold reached, open the circuit
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextRetryTime = Date.now() + this.config.resetTimeoutMs;
    }

    // If failure in HALF_OPEN state, reopen circuit
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextRetryTime = Date.now() + this.config.resetTimeoutMs;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get next retry time (when circuit will try HALF_OPEN)
   */
  getNextRetryTime(): number {
    return this.nextRetryTime;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Manually reset circuit to CLOSED state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextRetryTime = 0;
  }
}
