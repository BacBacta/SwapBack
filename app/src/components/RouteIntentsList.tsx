"use client";

import type { HybridRouteIntent } from "@/lib/routing/hybridRouting";

interface Props {
  intents: HybridRouteIntent[];
}

const CHANNEL_LABEL: Record<HybridRouteIntent["channel"], string> = {
  public: "Public",
  jito: "Jito",
  "private-rpc": "Private",
};

export function RouteIntentsList({ intents }: Props) {
  if (!intents.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Plan de routage hybride</p>
        <p className="text-xs text-white/50">{intents.length} intents</p>
      </div>
      <div className="mt-3 space-y-3">
        {intents.map((intent) => (
          <div
            key={intent.id}
            className="rounded-lg border border-white/5 bg-black/30 px-3 py-2"
          >
            <div className="flex items-center justify-between text-sm text-white">
              <p className="font-semibold">{intent.label}</p>
              <span className="text-white/70">{Math.round(intent.percentage * 100)}%</span>
            </div>
            <p className="text-xs text-white/60 mt-1">{intent.description}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/50">
              <span className="rounded-full bg-white/10 px-2 py-0.5">
                {CHANNEL_LABEL[intent.channel]} channel
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5">
                ETA {intent.etaSeconds}s
              </span>
              {intent.slices ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5">
                  {intent.slices} slices
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
