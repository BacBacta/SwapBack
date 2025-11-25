'use client';

import { useBuybackHistory } from '@/hooks/useBuybackHistory';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface BuybackDataPoint {
  date: string;
  usdcSpent: number;
  backBurned: number;
}

export default function BuybackChart() {
  const { data: chartData = [], isLoading } = useBuybackHistory();

  // Custom tooltip with proper typing
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: BuybackDataPoint; value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 backdrop-blur-sm border-2 border-[var(--primary)] p-3 font-sans text-xs">
          <p className="text-[var(--primary)] font-bold mb-2">{payload[0].payload.date}</p>
          <p className="text-green-400">💰 USDC: ${payload[0].value.toFixed(2)}</p>
          <p className="text-orange-400">🔥 BACK: {payload[0].payload.backBurned.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/30 p-6 animate-fade-in">
      <h3 className="text-lg font-bold terminal-text uppercase tracking-wider text-[var(--primary)] mb-4 flex items-center gap-2">
        <span>📈</span>
        <span>Buyback History (30 days)</span>
      </h3>
      
      {isLoading ? (
        <div className="h-64 bg-black/60 border-2 border-[var(--primary)]/20 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3 animate-pulse-green">⏳</div>
            <p className="text-[var(--primary)]/70 font-sans text-sm">Loading chart data...</p>
          </div>
        </div>
      ) : (
        <div className="h-64 bg-black/60 border-2 border-[var(--primary)]/20 backdrop-blur-sm p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="usdcGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#10B98120" />
              <XAxis 
                dataKey="date" 
                stroke="#10B98160" 
                style={{ fontSize: '10px', fontFamily: 'monospace' }}
                tick={{ fill: '#10B981' }}
              />
              <YAxis 
                stroke="#10B98160" 
                style={{ fontSize: '10px', fontFamily: 'monospace' }}
                tick={{ fill: '#10B981' }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="usdcSpent" 
                stroke="#10B981" 
                strokeWidth={2}
                fill="url(#usdcGradient)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      
      <div className="mt-2 text-xs font-sans text-[var(--primary)]/50 flex items-center gap-2">
        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
        <span>Live data from Helius API • Last 30 days aggregated</span>
      </div>
    </div>
  );
}
