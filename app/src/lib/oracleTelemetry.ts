import { promises as fs } from "fs";
import path from "path";

export interface OracleTelemetrySample {
  timestamp: string;
  fallbackUsed: boolean;
  inputProvider?: string | null;
  outputProvider?: string | null;
  divergenceBps?: number;
  inputConfidenceBps?: number;
  outputConfidenceBps?: number;
}

export interface OracleTelemetrySummary {
  samples: OracleTelemetrySample[];
  totalSamples: number;
  fallbackEvents: number;
  fallbackRate: number;
  avgDivergenceBps: number;
  maxDivergenceBps: number;
  providerUsage: {
    input: Record<string, number>;
    output: Record<string, number>;
  };
  lastUpdated?: string;
}

const DEFAULT_SUMMARY: OracleTelemetrySummary = {
  samples: [],
  totalSamples: 0,
  fallbackEvents: 0,
  fallbackRate: 0,
  avgDivergenceBps: 0,
  maxDivergenceBps: 0,
  providerUsage: {
    input: {},
    output: {},
  },
  lastUpdated: undefined,
};

const LOG_PATH = path.resolve(process.cwd(), "logs", "swap-metrics.log");

export async function loadOracleTelemetry(limit = 120): Promise<OracleTelemetrySummary> {
  try {
    const file = await fs.readFile(LOG_PATH, "utf8");
    const lines = file
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-limit);

    const samples: OracleTelemetrySample[] = [];
    let fallbackEvents = 0;
    const divergenceValues: number[] = [];
    const providerUsage = {
      input: {} as Record<string, number>,
      output: {} as Record<string, number>,
    };

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as {
          timestamp?: string;
          payload?: {
            oracleMetadata?: {
              input?: OracleDetail;
              output?: OracleDetail;
            };
          } & Record<string, unknown>;
        };

        const metadata = entry.payload?.oracleMetadata;
        if (!metadata) continue;

        const inputDetail = metadata.input;
        const outputDetail = metadata.output;
        const sample = buildSample(entry.timestamp ?? new Date().toISOString(), inputDetail, outputDetail);
        samples.push(sample);

        if (sample.fallbackUsed) {
          fallbackEvents += 1;
        }
        if (typeof sample.divergenceBps === "number") {
          divergenceValues.push(sample.divergenceBps);
        }

        if (sample.inputProvider) {
          providerUsage.input[sample.inputProvider] =
            (providerUsage.input[sample.inputProvider] ?? 0) + 1;
        }
        if (sample.outputProvider) {
          providerUsage.output[sample.outputProvider] =
            (providerUsage.output[sample.outputProvider] ?? 0) + 1;
        }
      } catch (error) {
        console.warn("[oracleTelemetry] Failed to parse log entry", error);
      }
    }

    const totalSamples = samples.length;
    if (!totalSamples) {
      return DEFAULT_SUMMARY;
    }

    const avgDivergenceBps = divergenceValues.length
      ? divergenceValues.reduce((sum, value) => sum + value, 0) / divergenceValues.length
      : 0;
    const maxDivergenceBps = divergenceValues.length
      ? Math.max(...divergenceValues)
      : 0;

    return {
      samples: samples.slice(-limit).reverse(),
      totalSamples,
      fallbackEvents,
      fallbackRate: fallbackEvents && totalSamples ? fallbackEvents / totalSamples : 0,
      avgDivergenceBps,
      maxDivergenceBps,
      providerUsage,
      lastUpdated: samples[samples.length - 1]?.timestamp,
    };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn("[oracleTelemetry] swap-metrics.log not found", LOG_PATH);
      return DEFAULT_SUMMARY;
    }

    console.error("[oracleTelemetry] Failed to read swap metrics log", error);
    return DEFAULT_SUMMARY;
  }
}

interface OracleDetail {
  providerUsed: string;
  price: number;
  confidence: number;
  fallbackUsed: boolean;
  divergencePercent?: number;
}

function buildSample(
  timestamp: string,
  input?: OracleDetail,
  output?: OracleDetail
): OracleTelemetrySample {
  const fallbackUsed = Boolean(input?.fallbackUsed || output?.fallbackUsed);
  const divergencePercent = output?.divergencePercent ?? input?.divergencePercent;
  const divergenceBps =
    typeof divergencePercent === "number" ? divergencePercent * 10_000 : undefined;

  return {
    timestamp,
    fallbackUsed,
    inputProvider: input?.providerUsed ?? null,
    outputProvider: output?.providerUsed ?? null,
    divergenceBps,
    inputConfidenceBps: confidenceToBps(input),
    outputConfidenceBps: confidenceToBps(output),
  };
}

function confidenceToBps(detail?: OracleDetail): number | undefined {
  if (!detail?.price) {
    return undefined;
  }
  const ratio = Math.abs(detail.confidence) / Math.abs(detail.price);
  if (!Number.isFinite(ratio)) {
    return undefined;
  }
  return ratio * 10_000;
}
