/**
 * Rate Limiting Middleware
 * 
 * Protects API routes from abuse and DDoS attacks
 */

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests per window
  windowMs: number;    // Time window in milliseconds
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (use Redis in production for distributed systems)
const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Rate limit check
 * 
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 30, windowMs: 60000 }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimits.get(identifier);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    cleanupExpiredEntries(now);
  }

  // No entry or expired - create new
  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimits.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Existing entry - check limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Extract client identifier from request
 * Uses X-Forwarded-For header (Vercel provides this)
 * 
 * @param headers - Request headers
 * @returns Client identifier (IP address)
 */
export function getClientIdentifier(headers: Headers): string {
  // Try X-Forwarded-For (set by Vercel)
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // Take first IP if multiple (client IP)
    return forwarded.split(',')[0].trim();
  }

  // Fallback to X-Real-IP
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Ultimate fallback
  return 'unknown';
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number): void {
  const keysToDelete: string[] = [];
  
  rateLimits.forEach((entry, key) => {
    if (now > entry.resetAt) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => rateLimits.delete(key));
}

/**
 * Reset rate limit for identifier (useful for testing)
 */
export function resetRateLimit(identifier: string): void {
  rateLimits.delete(identifier);
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(identifier: string): {
  count: number;
  resetAt: number;
} | null {
  const entry = rateLimits.get(identifier);
  if (!entry) return null;

  return {
    count: entry.count,
    resetAt: entry.resetAt,
  };
}
