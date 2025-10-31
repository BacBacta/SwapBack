'use client';

export default function BuybackChart() {
  // TODO: Implement chart with recharts library
  // For now, show placeholder with terminal theme

  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/30 p-6">
      <h3 className="text-lg font-bold terminal-text uppercase tracking-wider text-[var(--primary)] mb-4 flex items-center gap-2">
        <span>📈</span>
        <span>Buyback History (30 days)</span>
      </h3>
      <div className="h-64 flex flex-col items-center justify-center bg-black/60 border-2 border-[var(--primary)]/20 backdrop-blur-sm">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-[var(--primary)]/70 font-mono text-sm">Chart coming soon</p>
        <p className="text-[var(--primary)]/50 font-mono text-xs mt-2">
          (recharts integration required)
        </p>
      </div>
    </div>
  );
}
