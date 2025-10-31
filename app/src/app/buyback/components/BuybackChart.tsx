'use client';

import { useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface BuybackDataPoint {
  date: string;
  usdcSpent: number;
  backBurned: number;
  timestamp: number;
}

export default function BuybackChart() {
  // Generate mock data for the last 30 days
  // TODO: Replace with actual on-chain data from Helius or program accounts
  const chartData = useMemo(() => {
    const data: BuybackDataPoint[] = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (let i = 29; i >= 0; i--) {
      const timestamp = now - i * oneDay;
      const date = new Date(timestamp);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      
      // Simulate realistic buyback data (random but trending up)
      const baseUSDC = 50 + Math.random() * 100;
      const baseBACK = (baseUSDC * (800 + Math.random() * 400)); // Price varies
      
      data.push({
        date: dateStr,
        usdcSpent: parseFloat(baseUSDC.toFixed(2)),
        backBurned: parseFloat(baseBACK.toFixed(0)),
        timestamp,
      });
    }

    return data;
  }, []);

  // Custom tooltip with proper typing
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: BuybackDataPoint; value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 backdrop-blur-sm border-2 border-[var(--primary)] p-3 font-mono text-xs">
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
      
      <div className="h-64 bg-black/60 border-2 border-[var(--primary)]/20 backdrop-blur-sm p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="usdcGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00FF00" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#00FF00" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#00FF0020" />
            <XAxis 
              dataKey="date" 
              stroke="#00FF0060" 
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
              tick={{ fill: '#00FF00' }}
            />
            <YAxis 
              stroke="#00FF0060" 
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
              tick={{ fill: '#00FF00' }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="usdcSpent" 
              stroke="#00FF00" 
              strokeWidth={2}
              fill="url(#usdcGradient)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-2 text-xs font-mono text-[var(--primary)]/50 flex items-center gap-2">
        <span className="w-3 h-3 bg-[var(--primary)] rounded-full animate-pulse-green"></span>
        <span>Real-time data (simulated for demo)</span>
      </div>
    </div>
  );
}
