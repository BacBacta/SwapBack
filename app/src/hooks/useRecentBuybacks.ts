import { useQuery } from '@tanstack/react-query';

interface BuybackTransaction {
  signature: string;
  timestamp: number;
  usdcAmount: number;
  backBurned: number;
  executor: string;
}

// Parse USDC amount from transaction logs
const parseUsdcFromLogs = (logs: string[]): number => {
  const usdcLog = logs.find(log => log.includes('USDC spent:') || log.includes('usdc_amount:'));
  if (!usdcLog) return 0;
  
  const match = usdcLog.match(/(\d+)/);
  return match ? parseInt(match[1]) / 1_000_000 : 0; // Convert lamports to USDC
};

// Parse BACK burned amount from transaction logs
const parseBackFromLogs = (logs: string[]): number => {
  const backLog = logs.find(log => log.includes('BACK burned:') || log.includes('back_amount:'));
  if (!backLog) return 0;
  
  const match = backLog.match(/(\d+)/);
  return match ? parseInt(match[1]) / 1_000_000_000 : 0; // Convert lamports to BACK
};

// Fetch recent buyback transactions from Helius API
const fetchRecentBuybacks = async (): Promise<BuybackTransaction[]> => {
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  const BUYBACK_PROGRAM_ID = process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || 'BuybackProgramId11111111111111111111111111111';
  
  if (!heliusApiKey) {
    console.warn('⚠️  Helius API key not configured, using mock data');
    // Return mock data as fallback
    return getMockBuybacks();
  }
  
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${BUYBACK_PROGRAM_ID}/transactions?api-key=${heliusApiKey}&limit=20&type=SWAP`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`Helius API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    interface HeliusTransaction {
      signature: string;
      timestamp: number;
      type?: string;
      feePayer?: string;
      instructions?: Array<{
        programId: string;
        data?: string;
      }>;
      meta?: {
        logMessages?: string[];
      };
    }
    
    // Filter for execute_buyback instructions
    const buybackTxs = (data as HeliusTransaction[])
      .filter((tx) => {
        // Check if transaction contains buyback instruction
        return tx.instructions?.some((ix) => 
          ix.programId === BUYBACK_PROGRAM_ID &&
          (ix.data?.includes('execute_buyback') || tx.type === 'SWAP')
        );
      })
      .slice(0, 10); // Get last 10 transactions
    
    // Parse and format transactions
    const formattedTxs: BuybackTransaction[] = buybackTxs.map((tx) => {
      const logs = tx.meta?.logMessages || [];
      
      return {
        signature: tx.signature,
        timestamp: tx.timestamp * 1000, // Convert to milliseconds
        usdcAmount: parseUsdcFromLogs(logs),
        backBurned: parseBackFromLogs(logs),
        executor: tx.feePayer || 'Unknown',
      };
    });
    
    return formattedTxs;
  } catch (error) {
    console.error('Error fetching buybacks from Helius:', error);
    // Fallback to mock data on error
    return getMockBuybacks();
  }
};

// Mock data fallback
const getMockBuybacks = (): BuybackTransaction[] => {
  return [
    {
      signature: '5KJp7...xYz',
      timestamp: Date.now() - 3600000, // 1 hour ago
      usdcAmount: 125.50,
      backBurned: 98420,
      executor: '7XaB...mN9',
    },
    {
      signature: '2Hgf9...wQr',
      timestamp: Date.now() - 7200000, // 2 hours ago
      usdcAmount: 89.30,
      backBurned: 71440,
      executor: '9KpL...tR4',
    },
    {
      signature: '8Nqw2...pLm',
      timestamp: Date.now() - 14400000, // 4 hours ago
      usdcAmount: 203.75,
      backBurned: 165012,
      executor: '4VcD...hS2',
    },
    {
      signature: '3Mjk7...vFg',
      timestamp: Date.now() - 21600000, // 6 hours ago
      usdcAmount: 156.20,
      backBurned: 124960,
      executor: '6WnE...kP8',
    },
    {
      signature: '9Fpl3...bNc',
      timestamp: Date.now() - 28800000, // 8 hours ago
      usdcAmount: 78.90,
      backBurned: 63120,
      executor: '2QmF...yT5',
    },
  ];
};

/**
 * Hook to fetch recent buyback transactions
 * Uses Helius API with fallback to mock data
 * Refreshes every 30 seconds
 */
export const useRecentBuybacks = () => {
  return useQuery<BuybackTransaction[], Error>({
    queryKey: ['recent-buybacks'],
    queryFn: fetchRecentBuybacks,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });
};
