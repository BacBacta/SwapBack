/**
 * CircuitBreaker Unit Tests
 * 
 * Tests for the circuit breaker failsafe pattern covering:
 * - State transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * - Failure threshold behavior
 * - Timeout and recovery
 * - Success threshold in HALF_OPEN state
 * 
 * @module circuit-breaker.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from '../sdk/src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000, // 1 second for testing
      successThreshold: 2,
    });
  });

  // ============================================================================
  // STATE TRANSITIONS
  // ============================================================================

  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.isTripped()).toBe(false);
    });

    it('should transition to OPEN after failure threshold', () => {
      // Record 3 failures
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.isTripped()).toBe(true);
      expect(circuitBreaker.getFailureCount()).toBe(3);
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Trip the breaker
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout (1 second)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Check if tripped - should now be HALF_OPEN
      const isTripped = circuitBreaker.isTripped();
      expect(isTripped).toBe(false); // Not tripped in HALF_OPEN

      // But state should be HALF_OPEN (after calling isTripped which transitions)
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should transition from HALF_OPEN to CLOSED after success threshold', async () => {
      // Trip the breaker
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger HALF_OPEN state
      circuitBreaker.isTripped();

      // Record 2 successes (success threshold)
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should transition from HALF_OPEN back to OPEN on failure', async () => {
      // Trip the breaker
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger HALF_OPEN state
      circuitBreaker.isTripped();
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Record failure in HALF_OPEN - should reopen
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  // ============================================================================
  // FAILURE COUNTING
  // ============================================================================

  describe('Failure Counting', () => {
    it('should increment failure count on recordFailure', () => {
      expect(circuitBreaker.getFailureCount()).toBe(0);

      circuitBreaker.recordFailure();
      expect(circuitBreaker.getFailureCount()).toBe(1);

      circuitBreaker.recordFailure();
      expect(circuitBreaker.getFailureCount()).toBe(2);
    });

    it('should reset failure count on recordSuccess', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getFailureCount()).toBe(2);

      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should not trip before threshold', () => {
      circuitBreaker.recordFailure();
      expect(circuitBreaker.isTripped()).toBe(false);

      circuitBreaker.recordFailure();
      expect(circuitBreaker.isTripped()).toBe(false);

      // 3rd failure should trip
      circuitBreaker.recordFailure();
      expect(circuitBreaker.isTripped()).toBe(true);
    });
  });

  // ============================================================================
  // TIMEOUT BEHAVIOR
  // ============================================================================

  describe('Timeout Behavior', () => {
    it('should set next retry time when tripped', () => {
      const beforeTrip = Date.now();

      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      const nextRetryTime = circuitBreaker.getNextRetryTime();
      
      // Should be approximately 1 second in the future
      expect(nextRetryTime).toBeGreaterThan(beforeTrip);
      expect(nextRetryTime).toBeLessThan(beforeTrip + 2000);
    });

    it('should remain tripped before timeout expires', async () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.isTripped()).toBe(true);

      // Wait 500ms (half of timeout)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should still be tripped
      expect(circuitBreaker.isTripped()).toBe(true);
    });

    it('should allow retry after timeout expires', async () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.isTripped()).toBe(true);

      // Wait for full timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should now allow retry (HALF_OPEN)
      expect(circuitBreaker.isTripped()).toBe(false);
    });
  });

  // ============================================================================
  // RESET FUNCTIONALITY
  // ============================================================================

  describe('Manual Reset', () => {
    it('should reset to CLOSED state', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
      expect(circuitBreaker.isTripped()).toBe(false);
    });
  });

  // ============================================================================
  // CUSTOM CONFIGURATION
  // ============================================================================

  describe('Custom Configuration', () => {
    it('should respect custom failure threshold', () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        successThreshold: 2,
      });

      // 4 failures should not trip
      customBreaker.recordFailure();
      customBreaker.recordFailure();
      customBreaker.recordFailure();
      customBreaker.recordFailure();
      expect(customBreaker.isTripped()).toBe(false);

      // 5th failure should trip
      customBreaker.recordFailure();
      expect(customBreaker.isTripped()).toBe(true);
    });

    it('should respect custom success threshold', async () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 100,
        successThreshold: 3, // Require 3 successes
      });

      // Trip the breaker
      customBreaker.recordFailure();
      customBreaker.recordFailure();
      customBreaker.recordFailure();

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      customBreaker.isTripped(); // Trigger HALF_OPEN

      // 2 successes should not close
      customBreaker.recordSuccess();
      customBreaker.recordSuccess();
      expect(customBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      // 3rd success should close
      customBreaker.recordSuccess();
      expect(customBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });
});
