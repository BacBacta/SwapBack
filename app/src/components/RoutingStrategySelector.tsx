"use client";

import type { RoutingStrategy } from "@/lib/routing/hybridRouting";

interface Props {
  value: RoutingStrategy;
  onChange: (strategy: RoutingStrategy) => void;
}

const STRATEGY_INFO: Record<RoutingStrategy, { label: string; description: string }> = {
  smart: {
    label: "Intelligent Split",
    description: "Mix Jupiter + TWAP automatique",
  },
  aggressive: {
    label: "Rapide",
    description: "100% Jupiter pour exécution immédiate",
  },
  defensive: {
    label: "Defensif",
    description: "TWAP privilegie pour gros ordres",
  },
};

export function RoutingStrategySelector({ value, onChange }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <p className="text-sm font-semibold text-white mb-3">Strategie de routage</p>
      <div className="grid gap-2 md:grid-cols-3">
        {(Object.keys(STRATEGY_INFO) as RoutingStrategy[]).map((strategy) => {
          const info = STRATEGY_INFO[strategy];
          const active = value === strategy;
          return (
            <button
              key={strategy}
              type="button"
              onClick={() => onChange(strategy)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                active
                  ? "border-[#00FFA3] bg-[#00FFA3]/10 text-white"
                  : "border-white/10 text-white/70 hover:border-white/30"
              }`}
            >
              <p className="text-sm font-semibold">{info.label}</p>
              <p className="text-xs text-white/60">{info.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
