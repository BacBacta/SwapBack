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
  
  // Vérifier si la valeur est sûre pour conversion en Number
  // MAX_SAFE_INTEGER = 2^53 - 1 = 9007199254740991
  const maxSafeBN = new BN(Number.MAX_SAFE_INTEGER);
  
  // Si le montant entier dépasse MAX_SAFE_INTEGER, utiliser formatAmountPrecise
  if (whole.gt(maxSafeBN)) {
    return formatAmountPrecise(amount, decimals, maxDecimals);
  }
  
  // Conversion sécurisée uniquement si la valeur est dans la plage safe
  let uiValue: number;
  try {
    uiValue = whole.toNumber() + (remainder.toNumber() / Math.pow(10, decimals));
  } catch (error) {
    // Fallback si toNumber() échoue quand même
    return formatAmountPrecise(amount, decimals, maxDecimals);
  }
  
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
  
  // Vérifier la plage sûre
  const maxSafeBN = new BN(Number.MAX_SAFE_INTEGER);
  
  let percent: number;
  if (whole.gt(maxSafeBN)) {
    // Pour les très grandes valeurs, convertir en string
    const wholeStr = whole.toString();
    const remainderStr = remainder.toString().padStart(decimals, '0');
    return `${wholeStr}.${remainderStr.slice(0, 2)}%`;
  }
  
  try {
    percent = whole.toNumber() + (remainder.toNumber() / Math.pow(10, decimals));
  } catch (error) {
    // Fallback
    return `${whole.toString()}%`;
  }
  
  return `${percent.toFixed(2)}%`;
}
