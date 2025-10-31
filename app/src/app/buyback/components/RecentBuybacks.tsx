'use client';

import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';

interface BuybackTransaction {
  signature: string;
  timestamp: number;
  usdcAmount: number;
  backBurned: number;
  executor: string;
}

export default function RecentBuybacks() {
  const { connection } = useConnection();
  const [transactions, setTransactions] = useState<BuybackTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecentBuybacks() {
      try {
        setLoading(true);
        setError(null);

        // TODO: Replace with actual Helius API call
        // const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
        // const response = await fetch(`https://api.helius.xyz/v0/addresses/${BUYBACK_PROGRAM_ID}/transactions?api-key=${heliusApiKey}`);
        
        // For now, generate mock data to demonstrate the UI
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
        
        const mockTransactions: BuybackTransaction[] = [
          {
            signature: '5KJp7...xYz',
            timestamp: Date.now() - 3600000,
            usdcAmount: 125.50,
            backBurned: 98420,
            executor: '7XaB...mN9',
          },
          {
            signature: '2Hgf9...wQr',
            timestamp: Date.now() - 7200000,
            usdcAmount: 89.30,
            backBurned: 71440,
            executor: '9KpL...tR4',
          },
          {
            signature: '8Nqw2...pLm',
            timestamp: Date.now() - 14400000,
            usdcAmount: 203.75,
            backBurned: 165012,
            executor: '4VcD...hS2',
          },
          {
            signature: '3Mjk7...vFg',
            timestamp: Date.now() - 21600000,
            usdcAmount: 156.20,
            backBurned: 124960,
            executor: '6WnE...kP8',
          },
          {
            signature: '9Lrt4...bHn',
            timestamp: Date.now() - 28800000,
            usdcAmount: 78.90,
            backBurned: 63120,
            executor: '2FqM...zL1',
          },
        ];

        setTransactions(mockTransactions);
      } catch (err) {
        console.error('Error fetching buyback transactions:', err);
        setError('Failed to load transaction history');
      } finally {
        setLoading(false);
      }
    }

    fetchRecentBuybacks();
  }, [connection]);

  const formatTimestamp = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-3)}`;
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/30 p-6 animate-fade-in">
      <h3 className="text-lg font-bold terminal-text uppercase tracking-wider text-[var(--primary)] mb-4 flex items-center gap-2">
        <span>📜</span>
        <span>Recent Buybacks</span>
      </h3>

      {loading && (
        <div className="flex flex-col items-center justify-center py-8 bg-black/60 border-2 border-[var(--primary)]/20">
          <div className="text-4xl mb-3 animate-pulse-green">⏳</div>
          <p className="text-[var(--primary)]/70 font-mono text-sm">Loading transactions...</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-8 bg-black/60 border-2 border-red-500/20">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && transactions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 bg-black/60 border-2 border-[var(--primary)]/20">
          <div className="text-5xl mb-3">📝</div>
          <p className="text-[var(--primary)]/70 font-mono text-sm">No recent buybacks</p>
        </div>
      )}

      {!loading && !error && transactions.length > 0 && (
        <div className="bg-black/60 border-2 border-[var(--primary)]/20 overflow-hidden">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="bg-[var(--primary)]/10 border-b-2 border-[var(--primary)]/30">
                <th className="text-left p-3 text-[var(--primary)] uppercase tracking-wider">Time</th>
                <th className="text-right p-3 text-[var(--primary)] uppercase tracking-wider">USDC</th>
                <th className="text-right p-3 text-[var(--primary)] uppercase tracking-wider">BACK Burned</th>
                <th className="text-left p-3 text-[var(--primary)] uppercase tracking-wider">Executor</th>
                <th className="text-left p-3 text-[var(--primary)] uppercase tracking-wider">Tx</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => (
                <tr 
                  key={tx.signature}
                  className="border-b border-[var(--primary)]/10 hover:bg-[var(--primary)]/5 transition-colors animate-slide-down"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="p-3 text-[var(--primary)]/70">
                    {formatTimestamp(tx.timestamp)}
                  </td>
                  <td className="p-3 text-right text-green-400 font-bold">
                    ${tx.usdcAmount.toFixed(2)}
                  </td>
                  <td className="p-3 text-right text-orange-400 font-bold">
                    🔥 {tx.backBurned.toLocaleString()}
                  </td>
                  <td className="p-3 text-[var(--primary)]/60">
                    {shortenAddress(tx.executor)}
                  </td>
                  <td className="p-3">
                    <a
                      href={`https://solscan.io/tx/${tx.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--primary)] hover:text-[var(--primary)]/70 underline"
                    >
                      {shortenAddress(tx.signature)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 text-xs font-mono text-[var(--primary)]/50 flex items-center gap-2">
        <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>
        <span>Mock data (TODO: Connect Helius API with NEXT_PUBLIC_HELIUS_API_KEY)</span>
      </div>
    </div>
  );
}
