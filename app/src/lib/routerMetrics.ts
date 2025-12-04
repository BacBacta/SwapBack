import type { RouterMetricEntry, RouterReliabilitySummary } from "@/types/router";

export type RouterMetric = RouterMetricEntry;

const MAX_METRICS = 500;
const metrics: RouterMetric[] = [];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordRouterMetric(partial: Omit<RouterMetric, "id" | "timestamp">) {
  const metric: RouterMetric = {
    ...partial,
    id: generateId(),
    timestamp: Date.now(),
  };

  metrics.unshift(metric);
  if (metrics.length > MAX_METRICS) {
    metrics.length = MAX_METRICS;
  }
}

function computePercentile(values: number[], percentile: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(percentile * sorted.length));
  return sorted[index];
}

export function getRouterReliabilitySummary(): RouterReliabilitySummary {
  const sample = metrics.slice(0, 200);
  const successCount = sample.filter((m) => m.ok).length;
  const latencyValues = sample.map((m) => m.latencyMs);
  const avgLatency = latencyValues.length
    ? latencyValues.reduce((sum, v) => sum + v, 0) / latencyValues.length
    : 0;

  const successRate = sample.length ? successCount / sample.length : 0;
  const errorRate = 1 - successRate;
  const p95Latency = computePercentile(latencyValues, 0.95);

  const overallScore = successRate > 0.99 && avgLatency < 400
    ? "A"
    : successRate > 0.97 && avgLatency < 650
    ? "B"
    : successRate > 0.9
    ? "C"
    : "D";

  const endpointStats = Object.values(
    sample.reduce<Record<string, { endpoint: string; total: number; success: number; latencies: number[] }>>(
      (acc, metric) => {
        if (!acc[metric.endpoint]) {
          acc[metric.endpoint] = {
            endpoint: metric.endpoint,
            total: 0,
            success: 0,
            latencies: [],
          };
        }
        acc[metric.endpoint].total += 1;
        acc[metric.endpoint].latencies.push(metric.latencyMs);
        if (metric.ok) acc[metric.endpoint].success += 1;
        return acc;
      },
      {}
    )
  )
    .map((stat) => ({
      endpoint: stat.endpoint,
      successRate: stat.total ? stat.success / stat.total : 0,
      avgLatencyMs: stat.latencies.reduce((sum, v) => sum + v, 0) / stat.latencies.length,
    }))
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 3);

  return {
    sampleSize: sample.length,
    successRate,
    errorRate,
    avgLatencyMs: Math.round(avgLatency),
    p95LatencyMs: Math.round(p95Latency),
    overallScore,
    lastUpdated: Date.now(),
    topEndpoints: endpointStats,
  };
}

export function getRecentRouterMetrics(limit = 20) {
  return metrics.slice(0, limit);
}

export async function timeAsync<T>(fn: () => Promise<T>) {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  return { durationMs, result };
}
