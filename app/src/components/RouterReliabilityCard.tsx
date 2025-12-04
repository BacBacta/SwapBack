"use client";

import { useEffect, useState, useMemo } from "react";
import type { RouterReliabilitySummary, RouterMetricEntry } from "@/types/router";

interface Props {
  summary?: RouterReliabilitySummary | null;
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

const SCORE_COLORS: Record<string, string> = {
  A: "text-emerald-300",
  B: "text-lime-300",
  C: "text-amber-300",
  D: "text-rose-300",
};

export function RouterReliabilityCard({
  summary: externalSummary,
  autoRefresh = true,
  refreshIntervalMs = 30000,
}: Props) {
  const [localSummary, setLocalSummary] = useState<RouterReliabilitySummary | null>(null);
  const [recentMetrics, setRecentMetrics] = useState<RouterMetricEntry[]>([]);
  const [loading, setLoading] = useState(!externalSummary);

  useEffect(() => {
    if (!autoRefresh && externalSummary) return;

    let mounted = true;
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/analytics/router-metrics");
        if (!res.ok) throw new Error("Failed to load metrics");
        const data = await res.json();
        if (mounted) {
          setLocalSummary(data.summary ?? null);
          setRecentMetrics(data.recent ?? []);
          setLoading(false);
        }
      } catch (err) {
        console.error("RouterReliabilityCard fetch error", err);
        if (mounted) setLoading(false);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshIntervalMs);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [autoRefresh, refreshIntervalMs, externalSummary]);

  const summary = externalSummary ?? localSummary;

  // Mini bar chart data (last 10 latencies)
  const latencyBars = useMemo(() => {
    const slice = recentMetrics.slice(0, 10).reverse();
    const maxLatency = Math.max(...slice.map((m) => m.latencyMs), 1);
    return slice.map((m) => ({
      pct: Math.min(100, (m.latencyMs / maxLatency) * 100),
      ok: m.ok,
    }));
  }, [recentMetrics]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-4 animate-pulse">
        <div className="h-5 w-28 bg-white/10 rounded mb-3" />
        <div className="h-4 w-full bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Fiabilité routeur</p>
        <span
          className={`text-xl font-bold ${
            summary ? SCORE_COLORS[summary.overallScore] : "text-white/40"
          }`}
        >
          {summary ? summary.overallScore : "-"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/70">
        <Metric label="Succès" value={summary ? `${(summary.successRate * 100).toFixed(1)}%` : "-"} />
        <Metric label="Latence" value={summary ? `${summary.avgLatencyMs} ms` : "-"} />
        <Metric label="P95" value={summary ? `${summary.p95LatencyMs} ms` : "-"} />
        <Metric label="Échantillon" value={summary ? `${summary.sampleSize}` : "-"} />
      </div>

      {/* Mini latency graph */}
      {latencyBars.length > 0 && (
        <div className="mt-3 flex items-end gap-[2px] h-8">
          {latencyBars.map((bar, idx) => (
            <div
              key={idx}
              className={`flex-1 rounded-sm ${bar.ok ? "bg-emerald-500" : "bg-rose-500"}`}
              style={{ height: `${Math.max(4, bar.pct)}%` }}
              title={bar.ok ? "OK" : "Err"}
            />
          ))}
        </div>
      )}

      {summary && summary.topEndpoints && summary.topEndpoints.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-2">
          <p className="text-xs font-semibold text-white/60">Top endpoints</p>
          <ul className="mt-1 space-y-1 text-xs text-white/60">
            {summary.topEndpoints.map((endpoint) => (
              <li key={endpoint.endpoint} className="flex justify-between">
                <span className="truncate pr-2">{endpoint.endpoint.replace(/^https?:\/\//, "").split("/")[0]}</span>
                <span>{(endpoint.successRate * 100).toFixed(0)}% · {Math.round(endpoint.avgLatencyMs)} ms</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-white/50">{label}</p>
      <p className="text-white font-semibold">{value}</p>
    </div>
  );
}
