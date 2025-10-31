/**
 * Format USDC amount to human-readable string
 * @param amount USDC amount in base units (1e6)
 * @param decimals Number of decimal places (default 2)
 */
export function formatUSDC(amount: number | undefined, decimals = 2): string {
  if (amount === undefined || amount === null) return '0.00';
  return amount.toFixed(decimals);
}

/**
 * Format $BACK amount to human-readable string
 * @param amount BACK amount in base units (1e9)
 * @param decimals Number of decimal places (default 2)
 */
export function formatBACK(amount: number | undefined, decimals = 2): string {
  if (amount === undefined || amount === null) return '0.00';
  return amount.toFixed(decimals);
}

/**
 * Format large numbers with K/M/B suffixes
 * @param num Number to format
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

/**
 * Format timestamp to readable date
 * @param timestamp Unix timestamp (seconds)
 */
export function formatDate(timestamp: number): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format percentage
 * @param value Percentage value (0-100)
 * @param decimals Decimal places
 */
export function formatPercent(value: number | undefined, decimals = 2): string {
  if (value === undefined || value === null) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Shorten Solana address for display
 * @param address Full address
 * @param chars Number of chars to show at start/end
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Calculate time remaining until unlock
 * @param unlockTimestamp Unix timestamp (seconds)
 */
export function getTimeRemaining(unlockTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = unlockTimestamp - now;

  if (diff <= 0) return 'Unlocked';

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format explorer URL for transaction
 * @param signature Transaction signature
 * @param cluster Solana cluster (mainnet/devnet/testnet)
 */
export function getExplorerUrl(signature: string, cluster: 'mainnet' | 'devnet' | 'testnet' = 'devnet'): string {
  const clusterParam = cluster === 'mainnet' ? '' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
}

/**
 * Parse Solana error message to user-friendly text
 * @param error Error object
 */
export function parseErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) {
    // Extract Anchor error codes
    const anchorErrorMatch = error.message.match(/Error Code: (\w+)/);
    if (anchorErrorMatch) {
      return `Program error: ${anchorErrorMatch[1]}`;
    }
    
    // Extract custom error messages
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient balance';
    }
    if (error.message.includes('slippage')) {
      return 'Price slippage too high';
    }
    
    return error.message;
  }
  
  return 'Transaction failed';
}
