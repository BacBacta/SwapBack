/**
 * Dashboard Analytics Component
 * Shows swap volume, MEV savings, and performance metrics
 */

"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { OracleTelemetrySummary } from "@/lib/oracleTelemetry";

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
  const [oracleStats, setOracleStats] = useState<OracleTelemetrySummary | null>(null);
  const [oracleLoading, setOracleLoading] = useState(true);
  const [oracleError, setOracleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchOracleStats = async () => {
      try {
        if (!cancelled) {
          setOracleLoading(true);
        }
        const response = await fetch("/api/analytics/oracle", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to load oracle metrics (${response.status})`);
        }
        const data = (await response.json()) as OracleTelemetrySummary;
        if (!cancelled) {
          setOracleStats(data);
          setOracleError(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Oracle telemetry fetch failed", error);
          setOracleError("Unable to load oracle health data");
        }
      } finally {
        if (!cancelled) {
          setOracleLoading(false);
        }
      }
    };

    fetchOracleStats();
    const refresh = setInterval(fetchOracleStats, 30_000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, []);

  const fallbackRatePct = oracleStats
    ? (oracleStats.fallbackRate * 100).toFixed(2)
    : "0.00";
  const avgDivergenceBps = oracleStats?.avgDivergenceBps?.toFixed(1) ?? "0.0";
  const maxDivergenceBps = oracleStats?.maxDivergenceBps?.toFixed(1) ?? "0.0";
  const recentSamples = oracleStats?.samples?.slice(0, 5) ?? [];
  const formatTimestamp = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";
  const formatConfidence = (bps?: number) =>
    typeof bps === "number" ? `${bps.toFixed(1)} bps` : "n/a";

  return (
    <div className="space-y-6">
      {/* Volume Chart */}
      <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-[var(--primary)] mb-4">7-Day Volume</h3>
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
            <p className="text-4xl font-bold text-[var(--primary)]">
              ${totalMEVSavings.toFixed(2)}
            </p>
            <p className="text-sm text-green-200 mt-2">
              Protected from front-running attacks
            </p>
          </div>
          <div className="text-6xl">🛡️</div>
        </div>
      </div>

      {/* Oracle Health */}
      <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-[var(--primary)]">
            Oracle Health
          </h3>
          <span className="text-xs text-gray-400">
            {oracleStats?.lastUpdated
              ? `Updated ${formatTimestamp(oracleStats.lastUpdated)}`
              : "Awaiting data"}
          </span>
        </div>
        {oracleLoading ? (
          <p className="text-sm text-gray-400">Loading oracle telemetry...</p>
        ) : oracleError ? (
          <p className="text-sm text-red-400">{oracleError}</p>
        ) : !oracleStats || oracleStats.totalSamples === 0 ? (
          <p className="text-sm text-gray-400">
            No oracle verification samples recorded yet.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-black/30 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-400">Fallback Rate</p>
                <p className="text-3xl font-bold text-[var(--primary)]">
                  {fallbackRatePct}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {oracleStats.fallbackEvents} / {oracleStats.totalSamples} checks
                </p>
              </div>
              <div className="bg-black/30 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-400">Avg Divergence</p>
                <p className="text-3xl font-bold text-[var(--primary)]">
                  {avgDivergenceBps} bps
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Peak {maxDivergenceBps} bps
                </p>
              </div>
              <div className="bg-black/30 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-400">Sample Size</p>
                <p className="text-3xl font-bold text-[var(--primary)]">
                  {oracleStats.totalSamples}
                </p>
                <p className="text-xs text-gray-500 mt-1">last {oracleStats.samples.length} events</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  Provider Usage
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase text-gray-500 mb-1">
                      Input feeds
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(oracleStats.providerUsage.input).map(
                        ([provider, count]) => (
                          <span
                            key={`input-${provider}`}
                            className="px-3 py-1 rounded-full text-xs bg-blue-900/40 text-blue-200 border border-blue-900/60"
                          >
                            {provider}: {count}
                          </span>
                        )
                      )}
                      {!Object.keys(oracleStats.providerUsage.input).length && (
                        <span className="text-xs text-gray-500">n/a</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500 mb-1">
                      Output feeds
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(oracleStats.providerUsage.output).map(
                        ([provider, count]) => (
                          <span
                            key={`output-${provider}`}
                            className="px-3 py-1 rounded-full text-xs bg-purple-900/30 text-purple-200 border border-purple-900/50"
                          >
                            {provider}: {count}
                          </span>
                        )
                      )}
                      {!Object.keys(oracleStats.providerUsage.output).length && (
                        <span className="text-xs text-gray-500">n/a</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  Recent Verification Samples
                </h4>
                <div className="space-y-2">
                  {recentSamples.map((sample, index) => (
                    <div
                      key={`${sample.timestamp}-${index}`}
                      className="bg-black/30 border border-gray-800 rounded-lg p-3 text-sm"
                    >
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{formatTimestamp(sample.timestamp)}</span>
                        <span
                          className={
                            sample.fallbackUsed
                              ? "text-red-400"
                              : "text-green-400"
                          }
                        >
                          {sample.fallbackUsed ? "Fallback" : "Primary"}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-300 text-xs">
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Input</p>
                          <p>
                            {sample.inputProvider ?? "n/a"}
                            {sample.inputProvider && (
                              <span className="text-gray-500">
                                {" "}({formatConfidence(sample.inputConfidenceBps)})
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase text-gray-500">Output</p>
                          <p>
                            {sample.outputProvider ?? "n/a"}
                            {sample.outputProvider && (
                              <span className="text-gray-500">
                                {" "}({formatConfidence(sample.outputConfidenceBps)})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {typeof sample.divergenceBps === "number" && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          Divergence: {sample.divergenceBps.toFixed(1)} bps
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Route Performance Table */}
      <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-[var(--primary)] mb-4">Route Performance</h3>
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
                  <td className="py-3 text-[var(--primary)]">{venue.venue}</td>
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
        <h3 className="text-xl font-bold text-[var(--primary)] mb-4">
          Popular Pairs (24h)
        </h3>
        <div className="space-y-3">
          {popularPairs.map((pair, index) => (
            <div key={pair.pair} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-[var(--primary)] font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <div className="text-[var(--primary)] font-semibold">{pair.pair}</div>
                  <div className="text-xs text-gray-400">
                    {pair.count} swaps
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[var(--primary)] font-semibold">
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
