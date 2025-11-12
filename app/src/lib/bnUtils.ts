import { BN } from '@coral-xyz/anchor';

/**
 * Safely convert BN to number, with overflow protection
 * Returns null if value exceeds MAX_SAFE_INTEGER
 */
export function bnToNumberSafe(bn: BN): number | null {
  const maxSafeBN = new BN(Number.MAX_SAFE_INTEGER);
  
  if (bn.gt(maxSafeBN)) {
    console.warn('bnToNumberSafe: Value exceeds MAX_SAFE_INTEGER', {
      value: bn.toString(),
      max: maxSafeBN.toString(),
    });
    return null;
  }
  
  if (bn.isNeg() && bn.abs().gt(maxSafeBN)) {
    console.warn('bnToNumberSafe: Negative value exceeds MIN_SAFE_INTEGER', {
      value: bn.toString(),
    });
    return null;
  }
  
  try {
    return bn.toNumber();
  } catch (error) {
    console.error('bnToNumberSafe: Failed to convert BN', {
      bn: bn.toString(),
      error,
    });
    return null;
  }
}

/**
 * Safely convert BN to number, with fallback value
 */
export function bnToNumberWithFallback(bn: BN, fallback: number = 0): number {
  const result = bnToNumberSafe(bn);
  return result !== null ? result : fallback;
}

/**
 * Convert lamports/smallest unit to UI amount safely
 */
export function lamportsToUiSafe(amount: BN, decimals: number): number {
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = amount.div(divisor);
  const remainder = amount.mod(divisor);
  
  // Check if whole part is safe
  const wholeSafe = bnToNumberSafe(whole);
  if (wholeSafe === null) {
    console.warn('lamportsToUiSafe: Amount too large for safe conversion', {
      amount: amount.toString(),
      decimals,
    });
    return Number.MAX_SAFE_INTEGER;
  }
  
  // Convert remainder safely
  const remainderSafe = bnToNumberSafe(remainder);
  if (remainderSafe === null) {
    // Should rarely happen as remainder < divisor
    return wholeSafe;
  }
  
  return wholeSafe + (remainderSafe / Math.pow(10, decimals));
}

/**
 * Convert UI amount to lamports/smallest unit
 */
export function uiToLamports(amount: number, decimals: number): BN {
  const multiplier = Math.pow(10, decimals);
  const lamports = Math.floor(amount * multiplier);
  return new BN(lamports);
}

/**
 * Format BN amount with decimals to string (no Number conversion)
 * Use this for very large amounts that exceed MAX_SAFE_INTEGER
 */
export function formatBNWithDecimals(
  amount: BN,
  decimals: number,
  maxDecimalPlaces: number = 4
): string {
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = amount.div(divisor);
  const remainder = amount.mod(divisor);
  
  const wholeStr = whole.toString();
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmedDecimals = remainderStr
    .slice(0, maxDecimalPlaces)
    .replace(/0+$/, '');
  
  if (trimmedDecimals.length === 0) {
    return wholeStr;
  }
  
  return `${wholeStr}.${trimmedDecimals}`;
}

/**
 * Check if BN is within safe number range
 */
export function isBNSafe(bn: BN): boolean {
  const maxSafeBN = new BN(Number.MAX_SAFE_INTEGER);
  const minSafeBN = new BN(Number.MIN_SAFE_INTEGER);
  
  return bn.lte(maxSafeBN) && bn.gte(minSafeBN);
}
