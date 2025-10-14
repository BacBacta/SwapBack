/**
 * Dashboard Analytics Component
 * Shows swap volume, MEV savings, and performance metrics
 */

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Mock data (replace with real API data)
const volumeData = [
  { date: "Mon", volume: 12500 },
  { date: "Tue", volume: 15800 },
  { date: "Wed", volume: 18200 },
  { date: "Thu", volume: 14600 },
  { date: "Fri", volume: 21300 },
  { date: "Sat", volume: 19500 },
  { date: "Sun", volume: 17800 },
];

const performanceData = [
  { venue: "Orca", successRate: 98.5, avgTime: 1200 },
  { venue: "Raydium", successRate: 97.2, avgTime: 1450 },
  { venue: "Jupiter", successRate: 99.1, avgTime: 1150 },
  { venue: "Meteora", successRate: 96.8, avgTime: 1580 },
];

const popularPairs = [
  { pair: "SOL/USDC", volume: 125000, count: 1250 },
  { pair: "SOL/USDT", volume: 89000, count: 890 },
  { pair: "JUP/USDC", volume: 45000, count: 450 },
  { pair: "BONK/SOL", volume: 32000, count: 320 },
];

export function DashboardAnalytics() {
  const totalMEVSavings = 2456.78; // USD saved

  return (
    <div className="space-y-6">
      {/* Volume Chart */}
      <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-4">7-Day Volume</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={volumeData}>
            <defs>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#F3F4F6" }}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#colorVolume)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* MEV Savings Counter */}
      <div className="bg-gradient-to-br from-green-900 to-green-700 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg text-green-100 mb-1">
              Total MEV Protection Savings
            </h3>
            <p className="text-4xl font-bold text-white">
              ${totalMEVSavings.toFixed(2)}
            </p>
            <p className="text-sm text-green-200 mt-2">
              Protected from front-running attacks
            </p>
          </div>
          <div className="text-6xl">🛡️</div>
        </div>
      </div>

      {/* Route Performance Table */}
      <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-4">Route Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-sm text-gray-400 pb-3">Venue</th>
                <th className="text-right text-sm text-gray-400 pb-3">
                  Success Rate
                </th>
                <th className="text-right text-sm text-gray-400 pb-3">
                  Avg Time (ms)
                </th>
              </tr>
            </thead>
            <tbody>
              {performanceData.map((venue) => (
                <tr key={venue.venue} className="border-b border-gray-800">
                  <td className="py-3 text-white">{venue.venue}</td>
                  <td className="py-3 text-right">
                    <span
                      className={`${
                        venue.successRate > 98
                          ? "text-green-500"
                          : venue.successRate > 95
                            ? "text-yellow-500"
                            : "text-red-500"
                      }`}
                    >
                      {venue.successRate}%
                    </span>
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {venue.avgTime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popular Pairs */}
      <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-4">
          Popular Pairs (24h)
        </h3>
        <div className="space-y-3">
          {popularPairs.map((pair, index) => (
            <div key={pair.pair} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <div className="text-white font-semibold">{pair.pair}</div>
                  <div className="text-xs text-gray-400">
                    {pair.count} swaps
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold">
                  ${pair.volume.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">volume</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
