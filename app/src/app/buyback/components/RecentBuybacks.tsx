'use client';

import { useRecentBuybacks } from '@/hooks/useRecentBuybacks';

export default function RecentBuybacks() {
  const { data: transactions = [], isLoading: loading, error } = useRecentBuybacks();

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
          <p className="text-red-400 font-mono text-sm">{error.message || 'Failed to load transactions'}</p>
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
        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
        <span>Live data from Helius API • Refreshes every 30s</span>
      </div>
    </div>
  );
}
