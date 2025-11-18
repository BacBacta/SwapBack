"use client";

import { useMemo } from "react";
import { OnChainTransaction } from "@/hooks/useOnChainHistory";

interface TransactionVolumeChartProps {
  transactions: OnChainTransaction[];
}

export default function TransactionVolumeChart({ transactions }: TransactionVolumeChartProps) {
  const chartData = useMemo(() => {
    if (transactions.length === 0) return null;

    // Group transactions by day
    const dailyData = new Map<string, { count: number; fees: number; success: number }>();

    transactions.forEach(tx => {
      if (!tx.blockTime) return;
      
      const date = new Date(tx.blockTime * 1000);
      const dateKey = date.toLocaleDateString();

      const existing = dailyData.get(dateKey) || { count: 0, fees: 0, success: 0 };
      dailyData.set(dateKey, {
        count: existing.count + 1,
        fees: existing.fees + tx.fee,
        success: existing.success + (tx.success ? 1 : 0)
      });
    });

    // Convert to array and sort by date
    const sortedData = Array.from(dailyData.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-7); // Last 7 days

    const maxCount = Math.max(...sortedData.map(([, d]) => d.count));
    const maxFees = Math.max(...sortedData.map(([, d]) => d.fees));

    return {
      days: sortedData.map(([date]) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { weekday: 'short' });
      }),
      data: sortedData.map(([, data]) => data),
      maxCount,
      maxFees
    };
  }, [transactions]);

  if (!chartData || chartData.days.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <span className="text-3xl block mb-2">📊</span>
        <p className="text-sm">Not enough data for chart</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="relative h-48">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400 pr-2">
          <span>{chartData.maxCount}</span>
          <span>{Math.floor(chartData.maxCount / 2)}</span>
          <span>0</span>
        </div>

        {/* Bars */}
        <div className="flex items-end justify-around h-full ml-8">
          {chartData.days.map((day, index) => {
            const data = chartData.data[index];
            const heightPercent = (data.count / chartData.maxCount) * 100;
            const successRate = (data.success / data.count) * 100;

            return (
              <div key={index} className="flex flex-col items-center gap-2 flex-1 max-w-[80px]">
                {/* Bar */}
                <div className="w-full flex items-end justify-center group relative">
                  <div
                    className="w-full bg-gradient-to-t from-primary to-primary/50 rounded-t-lg transition-all hover:from-primary/80 hover:to-primary/30 cursor-pointer"
                    style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 border border-primary/30 rounded-lg p-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                      <div className="font-bold text-white mb-1">{day}</div>
                      <div className="text-primary">Transactions: {data.count}</div>
                      <div className="text-green-400">Success: {successRate.toFixed(0)}%</div>
                      <div className="text-gray-400">Fees: {data.fees.toFixed(6)} SOL</div>
                    </div>
                  </div>
                </div>

                {/* Label */}
                <span className="text-xs text-gray-400">{day}</span>
              </div>
            );
          })}
        </div>

        {/* X-axis line */}
        <div className="absolute bottom-6 left-8 right-0 h-px bg-gray-700"></div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded"></div>
          <span className="text-gray-400">Transaction Count</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-400 rounded"></div>
          <span className="text-gray-400">Success Rate</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="p-3 bg-black/30 rounded-lg text-center">
          <div className="text-xs text-gray-400 mb-1">Total Txs</div>
          <div className="text-lg font-bold text-white">
            {chartData.data.reduce((sum, d) => sum + d.count, 0)}
          </div>
        </div>
        <div className="p-3 bg-black/30 rounded-lg text-center">
          <div className="text-xs text-gray-400 mb-1">Success Rate</div>
          <div className="text-lg font-bold text-green-400">
            {(
              (chartData.data.reduce((sum, d) => sum + d.success, 0) /
                chartData.data.reduce((sum, d) => sum + d.count, 0)) *
              100
            ).toFixed(0)}%
          </div>
        </div>
        <div className="p-3 bg-black/30 rounded-lg text-center">
          <div className="text-xs text-gray-400 mb-1">Total Fees</div>
          <div className="text-lg font-bold text-blue-400">
            {chartData.data.reduce((sum, d) => sum + d.fees, 0).toFixed(4)} SOL
          </div>
        </div>
      </div>
    </div>
  );
}
