/**
 * Format utilities for numbers in Swap interface
 */

export function formatNumberWithCommas(value: string | number): string {
  const numStr = typeof value === 'number' ? value.toString() : value;
  const [integer, decimal] = numStr.split('.');
  
  // Add thousands separators
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return decimal !== undefined ? `${formattedInteger}.${decimal}` : formattedInteger;
}

export function parseFormattedNumber(formatted: string): string {
  // Remove commas for computation
  return formatted.replace(/,/g, '');
}

export function validateNumberInput(
  input: string,
  maxDecimals: number = 9
): { valid: boolean; value: string; error?: string } {
  // Allow empty input
  if (!input || input === '') {
    return { valid: true, value: '' };
  }

  // Remove commas for validation
  const cleanInput = input.replace(/,/g, '');

  // Check if valid number format
  const numberRegex = /^[0-9]*\.?[0-9]*$/;
  if (!numberRegex.test(cleanInput)) {
    return { valid: false, value: input, error: 'Invalid number format' };
  }

  // Check decimal places
  const parts = cleanInput.split('.');
  if (parts[1] && parts[1].length > maxDecimals) {
    return {
      valid: false,
      value: input,
      error: `Maximum ${maxDecimals} decimal places`,
    };
  }

  return { valid: true, value: cleanInput };
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
  if (value === 0) return '$0.00';
  
  if (value < 0.01) {
    return `<$0.01`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  if (value < 1000) {
    return value.toFixed(2);
  }
  
  if (value < 1000000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  
  if (value < 1000000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  
  return (value / 1000000000).toFixed(1) + 'B';
}

export function getAdaptiveFontSize(length: number): string {
  if (length <= 6) return '3rem'; // clamp(2.5rem, 8vw, 3rem)
  if (length <= 10) return '2.5rem'; // clamp(2rem, 6vw, 2.5rem)
  if (length <= 15) return '2rem'; // clamp(1.5rem, 5vw, 2rem)
  return '1.5rem'; // clamp(1.25rem, 4vw, 1.5rem)
}
