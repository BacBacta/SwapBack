import { BN } from '@coral-xyz/anchor';

/**
 * Format amount with K/M/B suffix for large numbers
 * Uses BN division to safely handle amounts > MAX_SAFE_INTEGER
 * 
 * @param amount - Amount in smallest unit (lamports, etc.)
 * @param decimals - Number of decimals (e.g., 9 for SOL, 6 for USDC)
 * @param maxDecimals - Maximum decimal places to show (default: 2)
 * @returns Formatted string like "1.23M SOL" or "456.78K"
 */
export function formatAmount(
  amount: BN, 
  decimals: number, 
  maxDecimals: number = 2
): string {
  // Convertir en unité de base (SOL, USDC, etc.)
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = amount.div(divisor);
  const remainder = amount.mod(divisor);
  
  // Combiner pour obtenir la valeur UI complète
  const uiValue = whole.toNumber() + (remainder.toNumber() / Math.pow(10, decimals));
  
  // Formater avec suffixes
  if (uiValue >= 1_000_000_000) {
    return `${(uiValue / 1_000_000_000).toFixed(maxDecimals)}B`;
  }
  if (uiValue >= 1_000_000) {
    return `${(uiValue / 1_000_000).toFixed(maxDecimals)}M`;
  }
  if (uiValue >= 1_000) {
    return `${(uiValue / 1_000).toFixed(maxDecimals)}K`;
  }
  
  return uiValue.toFixed(maxDecimals);
}

/**
 * Format amount as string with full precision (for large amounts)
 * Returns string representation to avoid Number overflow
 * 
 * @param amount - Amount in smallest unit
 * @param decimals - Number of decimals
 * @param maxDecimals - Maximum decimal places to show (default: 4)
 * @returns String like "10000.1234"
 */
export function formatAmountPrecise(
  amount: BN,
  decimals: number,
  maxDecimals: number = 4
): string {
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = amount.div(divisor);
  const remainder = amount.mod(divisor);
  
  // Construire la partie décimale
  const decimalStr = remainder.toString().padStart(decimals, '0');
  const trimmedDecimals = decimalStr.slice(0, maxDecimals).replace(/0+$/, '');
  
  if (trimmedDecimals.length === 0) {
    return whole.toString();
  }
  
  return `${whole.toString()}.${trimmedDecimals}`;
}

/**
 * Format percentage from BN (basis points or similar)
 * 
 * @param value - Value as BN
 * @param decimals - Decimals in the value (e.g., 2 for basis points = 0.01%)
 * @returns Formatted percentage string like "1.23%"
 */
export function formatPercentage(value: BN, decimals: number = 2): string {
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = value.div(divisor);
  const remainder = value.mod(divisor);
  
  const percent = whole.toNumber() + (remainder.toNumber() / Math.pow(10, decimals));
  return `${percent.toFixed(2)}%`;
}
