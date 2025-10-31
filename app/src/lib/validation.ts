/**
 * Input Validation & Sanitization Utilities
 * 
 * Security: Prevent XSS, injection, and invalid data
 */

/**
 * Sanitize and validate numeric amount
 * 
 * @param input - User input string
 * @param options - Validation options
 * @returns Sanitized number or null if invalid
 */
export function sanitizeAmount(
  input: string,
  options: {
    min?: number;
    max?: number;
    decimals?: number;
  } = {}
): number | null {
  const { min = 0, max = 1e12, decimals = 18 } = options;

  // Remove all non-numeric characters except decimal point
  const cleaned = input.replace(/[^0-9.]/g, '');

  // Check for multiple decimal points
  if ((cleaned.match(/\./g) || []).length > 1) {
    return null;
  }

  // Parse to number
  const value = parseFloat(cleaned);

  // Validate
  if (isNaN(value) || !isFinite(value)) {
    return null;
  }

  if (value < min || value > max) {
    return null;
  }

  // Check decimal places
  const parts = cleaned.split('.');
  if (parts[1] && parts[1].length > decimals) {
    return null; // Too many decimal places
  }

  return value;
}

/**
 * Validate Solana public key
 * 
 * @param input - Public key string
 * @returns true if valid
 */
export function isValidPublicKey(input: string): boolean {
  // Solana pubkeys are base58, 32-44 characters
  if (typeof input !== 'string') return false;
  if (input.length < 32 || input.length > 44) return false;

  // Check valid base58 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(input);
}

/**
 * Sanitize string for display (prevent XSS)
 * 
 * @param input - User input
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  if (typeof input !== 'string') return '';

  // Truncate
  const truncated = input.slice(0, maxLength);

  // Escape HTML entities
  return truncated
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate slippage percentage
 * 
 * @param input - Slippage input (0-100)
 * @returns Valid slippage or null
 */
export function validateSlippage(input: number): number | null {
  if (typeof input !== 'number' || isNaN(input) || !isFinite(input)) {
    return null;
  }

  // Slippage should be 0-100 (percentage)
  if (input < 0 || input > 100) {
    return null;
  }

  // Limit to 2 decimal places
  return Math.round(input * 100) / 100;
}

/**
 * Validate transaction signature
 * 
 * @param signature - Transaction signature
 * @returns true if valid format
 */
export function isValidSignature(signature: string): boolean {
  if (typeof signature !== 'string') return false;

  // Solana signatures are base58, 88 characters
  if (signature.length !== 88) return false;

  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(signature);
}

/**
 * Validate and sanitize token mint address
 * 
 * @param mint - Token mint address
 * @returns Sanitized mint or null
 */
export function validateTokenMint(mint: string): string | null {
  if (!isValidPublicKey(mint)) {
    return null;
  }

  return mint.trim();
}

/**
 * Validate email (for beta invites, notifications)
 * 
 * @param email - Email address
 * @returns true if valid
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize URL (prevent javascript: protocol, etc.)
 * 
 * @param url - URL input
 * @returns Sanitized URL or null
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') return null;

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      return null;
    }
  }

  // Only allow http and https
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  return url.trim();
}

/**
 * Rate limit key generator (for consistent keys)
 * 
 * @param prefix - Key prefix
 * @param identifier - Identifier (IP, user, etc.)
 * @returns Rate limit key
 */
export function getRateLimitKey(prefix: string, identifier: string): string {
  return `ratelimit:${prefix}:${identifier}`;
}
