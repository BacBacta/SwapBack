"use client";

import { useMemo } from "react";
import { useRouterConfig } from "@/hooks/useRouterConfig";

interface Props {
  npiAmount: number; // Montant NPI estimé en USD
  platformFee: number; // Frais de plateforme estimés en USD
}

const formatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "USD",
});

function formatAmount(amount: number) {
  if (!isFinite(amount) || amount <= 0) {
    return formatter.format(0);
  }
  return formatter.format(amount);
}

export function DistributionBreakdown({ npiAmount, platformFee }: Props) {
  const { data: config } = useRouterConfig();

  const npiDistribution = useMemo(() => {
    if (!config) {
      return { rebate: 0, treasury: 0, boostVault: 0 };
    }
    return {
      rebate: Math.floor((npiAmount * config.rebateBps) / 10_000),
      treasury: Math.floor((npiAmount * config.treasuryBps) / 10_000),
      boostVault: Math.floor((npiAmount * config.boostVaultBps) / 10_000),
    };
  }, [config, npiAmount]);

  const feeDistribution = useMemo(() => {
    if (!config) {
      return { treasury: 0, buyburn: 0 };
    }
    return {
      treasury: Math.floor((platformFee * config.treasuryFromFeesBps) / 10_000),
      buyburn: Math.floor((platformFee * config.buyburnFromFeesBps) / 10_000),
    };
  }, [config, platformFee]);

  if (!config) {
    return (
      <div className="p-4 border border-white/10 rounded-xl text-sm text-white/70">
        Chargement de la configuration router...
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="p-4 border border-white/10 rounded-xl bg-black/40">
        <h3 className="text-sm uppercase tracking-wide text-white/60 mb-2">
          Répartition NPI ({formatAmount(npiAmount)})
        </h3>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between">
            <span>Rebates ({config.rebateBps / 100}%)</span>
            <span className="font-semibold">{formatAmount(npiDistribution.rebate)}</span>
          </li>
          <li className="flex justify-between">
            <span>Treasury ({config.treasuryBps / 100}%)</span>
            <span className="font-semibold">{formatAmount(npiDistribution.treasury)}</span>
          </li>
          <li className="flex justify-between">
            <span>Boost Vault ({config.boostVaultBps / 100}%)</span>
            <span className="font-semibold">{formatAmount(npiDistribution.boostVault)}</span>
          </li>
        </ul>
      </div>

      <div className="p-4 border border-white/10 rounded-xl bg-black/40">
        <h3 className="text-sm uppercase tracking-wide text-white/60 mb-2">
          Platform Fees ({formatAmount(platformFee)})
        </h3>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between">
            <span>Treasury ({config.treasuryFromFeesBps / 100}%)</span>
            <span className="font-semibold">{formatAmount(feeDistribution.treasury)}</span>
          </li>
          <li className="flex justify-between">
            <span>Buy &amp; Burn ({config.buyburnFromFeesBps / 100}%)</span>
            <span className="font-semibold">{formatAmount(feeDistribution.buyburn)}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
