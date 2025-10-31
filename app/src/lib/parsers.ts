// Utility functions for parsing transaction logs

/**
 * Parse USDC amount from transaction logs
 * Looks for patterns like "USDC spent: 125000000" or "usdc_amount: 125000000"
 */
export const parseUsdcFromLogs = (logs: string[]): number => {
  const usdcLog = logs.find(log => 
    log.includes('USDC spent:') || 
    log.includes('usdc_amount:') ||
    log.includes('Buyback exécuté:')
  );
  
  if (!usdcLog) {
    console.warn('⚠️  USDC amount not found in logs');
    return 0;
  }
  
  // Try different regex patterns
  const patterns = [
    /USDC spent:\s*(\d+)/,
    /usdc_amount:\s*(\d+)/,
    /Buyback exécuté:\s*(\d+)\s*USDC/,
    /(\d+)\s*USDC\s*->/,
  ];
  
  for (const pattern of patterns) {
    const match = usdcLog.match(pattern);
    if (match && match[1]) {
      const lamports = parseInt(match[1]);
      return lamports / 1_000_000; // Convert to USDC units
    }
  }
  
  console.warn('⚠️  Could not parse USDC amount from log:', usdcLog);
  return 0;
};

/**
 * Parse BACK burned amount from transaction logs
 * Looks for patterns like "BACK burned: 98420000000000" or "back_amount: 98420000000000"
 */
export const parseBackFromLogs = (logs: string[]): number => {
  const backLog = logs.find(log => 
    log.includes('BACK burned:') || 
    log.includes('back_amount:') ||
    log.includes('-> ') && log.includes('$BACK')
  );
  
  if (!backLog) {
    console.warn('⚠️  BACK amount not found in logs');
    return 0;
  }
  
  // Try different regex patterns
  const patterns = [
    /BACK burned:\s*(\d+)/,
    /back_amount:\s*(\d+)/,
    /->\s*(\d+)\s*\$BACK/,
    /(\d+)\s*\$BACK\s*burned/i,
  ];
  
  for (const pattern of patterns) {
    const match = backLog.match(pattern);
    if (match && match[1]) {
      const lamports = parseInt(match[1]);
      return lamports / 1_000_000_000; // Convert to BACK units
    }
  }
  
  console.warn('⚠️  Could not parse BACK amount from log:', backLog);
  return 0;
};

/**
 * Parse complete buyback transaction
 * Returns both USDC spent and BACK burned
 */
export interface BuybackParsed {
  usdcSpent: number;
  backBurned: number;
  success: boolean;
}

export const parseBuybackTransaction = (logs: string[]): BuybackParsed => {
  const usdcSpent = parseUsdcFromLogs(logs);
  const backBurned = parseBackFromLogs(logs);
  
  // Consider successful if we found at least one value
  const success = usdcSpent > 0 || backBurned > 0;
  
  return {
    usdcSpent,
    backBurned,
    success,
  };
};

/**
 * Parse rebate amount from swap transaction logs
 */
export const parseRebateFromLogs = (logs: string[]): number => {
  const rebateLog = logs.find(log => 
    log.includes('Rewards claimed:') || 
    log.includes('rebate_amount:') ||
    log.includes('Rebate paid:')
  );
  
  if (!rebateLog) {
    return 0;
  }
  
  const patterns = [
    /Rewards claimed:\s*(\d+)\s*USDC/,
    /rebate_amount:\s*(\d+)/,
    /Rebate paid:\s*(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const match = rebateLog.match(pattern);
    if (match && match[1]) {
      const lamports = parseInt(match[1]);
      return lamports / 1_000_000;
    }
  }
  
  return 0;
};

/**
 * Check if transaction was successful based on logs
 */
export const isTransactionSuccessful = (logs: string[]): boolean => {
  // Look for success indicators
  const hasSuccess = logs.some(log => 
    log.includes('Program log: ✅') ||
    log.includes('success') ||
    log.includes('Success')
  );
  
  // Check for error indicators
  const hasError = logs.some(log => 
    log.includes('Error:') ||
    log.includes('failed') ||
    log.includes('Failed')
  );
  
  return hasSuccess && !hasError;
};
