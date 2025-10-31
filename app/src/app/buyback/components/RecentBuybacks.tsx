'use client';

export default function RecentBuybacks() {
  // TODO: Fetch from Helius API or on-chain transaction logs

  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/30 p-6">
      <h3 className="text-lg font-bold terminal-text uppercase tracking-wider text-[var(--primary)] mb-4 flex items-center gap-2">
        <span>📜</span>
        <span>Recent Buybacks</span>
      </h3>
      <div className="flex flex-col items-center justify-center py-8 bg-black/60 border-2 border-[var(--primary)]/20">
        <div className="text-5xl mb-3">📝</div>
        <p className="text-[var(--primary)]/70 font-mono text-sm">No recent buybacks</p>
        <p className="text-[var(--primary)]/50 font-mono text-xs mt-2">
          (Query Helius API for transaction history)
        </p>
      </div>
    </div>
  );
}
