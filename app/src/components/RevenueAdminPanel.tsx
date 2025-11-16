"use client";

import { useState, useMemo, ReactNode } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { recordSwapFees, distributeNpi } from "@/lib/revenue";

const SWAP_FEE_RATE = 0.003; // 0.30%
const SWAP_TREASURY_SHARE = 0.85;
const SWAP_BUYBACK_SHARE = 0.15;

const NPI_USER_BASE = 0.7;
const NPI_PLATFORM_SHARE = 0.2;
const NPI_BOOST_POOL = 0.05;
const NPI_BUYBACK_SHARE = 0.05;
const MAX_USER_BOOST_BPS = 500; // +5%

type StatusState = {
  state: "idle" | "loading" | "success" | "error";
  message?: ReactNode;
};

const explorerClusterParam = (() => {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
  if (network === "mainnet" || network === "mainnet-beta") {
    return "";
  }
  return `?cluster=${network}`;
})();

const formatUsd = (value: number) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const StatusMessage = ({ status }: { status: StatusState }) => {
  if (status.state === "idle") return null;
  if (status.state === "loading") {
    return <p className="text-sm text-blue-300">Envoi en cours...</p>;
  }
  const isSuccess = status.state === "success";
  const baseClass = isSuccess ? "text-green-400" : "text-red-400";
  const label = isSuccess ? "Success" : "Error";

  return (
    <p className={`text-sm ${baseClass}`}>
      <span className="font-semibold mr-1">{label}:</span>
      {status.message}
    </p>
  );
};

const DistributionCard = ({
  label,
  amount,
  subLabel,
}: {
  label: string;
  amount: string;
  subLabel: string;
}) => (
  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
    <div className="text-sm text-gray-400 mb-1">{label}</div>
    <div className="text-xl font-bold text-white">{amount}</div>
    <div className="text-xs text-gray-500 mt-1">{subLabel}</div>
  </div>
);

export default function RevenueAdminPanel() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const walletReady = wallet.connected && !!wallet.publicKey;

  const [swapVolumeInput, setSwapVolumeInput] = useState("100000");
  const [npiAmountInput, setNpiAmountInput] = useState("500");
  const [boostBps, setBoostBps] = useState(0);
  const [swapStatus, setSwapStatus] = useState<StatusState>({ state: "idle" });
  const [npiStatus, setNpiStatus] = useState<StatusState>({ state: "idle" });

  const swapPreview = useMemo(() => {
    const volume = Number.parseFloat(swapVolumeInput) || 0;
    const totalFee = volume * SWAP_FEE_RATE;
    return {
      volume,
      totalFee,
      treasury: totalFee * SWAP_TREASURY_SHARE,
      buyback: totalFee * SWAP_BUYBACK_SHARE,
    };
  }, [swapVolumeInput]);

  const npiPreview = useMemo(() => {
    const npi = Number.parseFloat(npiAmountInput) || 0;
    const baseUser = npi * NPI_USER_BASE;
    const boostPool = npi * NPI_BOOST_POOL;
    const buyback = npi * NPI_BUYBACK_SHARE;
    const treasury = npi * NPI_PLATFORM_SHARE;
    const boostBonusTarget = baseUser * (boostBps / 10_000);
    const boostBonus = Math.min(boostBonusTarget, boostPool);
    const remainingBoostPool = boostPool - boostBonus;

    return {
      npi,
      userBase: baseUser,
      userBonus: boostBonus,
      userTotal: baseUser + boostBonus,
      treasury,
      boostPoolRemaining: remainingBoostPool,
      buyback,
      boostPercentApplied: boostBps / 100,
    };
  }, [npiAmountInput, boostBps]);

  const ensureWalletReady = () => {
    if (!wallet.connected || !wallet.publicKey) {
      throw new Error("Connectez votre wallet pour envoyer la transaction");
    }
    if (!wallet.signTransaction) {
      throw new Error("Le wallet sélectionné ne supporte pas signTransaction");
    }
  };

  const handleRecordSwapFees = async () => {
    try {
      ensureWalletReady();
      setSwapStatus({ state: "loading" });
      const signature = await recordSwapFees({
        connection,
        wallet,
        swapVolumeUsd: swapVolumeInput,
      });
      setSwapStatus({
        state: "success",
        message: (
          <a
            href={`https://explorer.solana.com/tx/${signature}${explorerClusterParam}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {signature.slice(0, 8)}… Voir sur l'explorer
          </a>
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSwapStatus({ state: "error", message });
    }
  };

  const handleDistributeNpi = async () => {
    try {
      ensureWalletReady();
      setNpiStatus({ state: "loading" });
      const signature = await distributeNpi({
        connection,
        wallet,
        npiAmountUsd: npiAmountInput,
        userBoostBps: boostBps,
      });
      setNpiStatus({
        state: "success",
        message: (
          <a
            href={`https://explorer.solana.com/tx/${signature}${explorerClusterParam}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {signature.slice(0, 8)}… Voir sur l'explorer
          </a>
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNpiStatus({ state: "error", message });
    }
  };

  return (
    <div className="bg-black border border-[var(--primary)]/20 rounded-2xl p-6 space-y-6 shadow-xl">
      <div>
        <h3 className="text-2xl font-bold text-white">Revenue Controls</h3>
        <p className="text-gray-400 mt-2 text-sm">
          Enregistrez on-chain la répartition des frais de swap (85/15) et des revenus NPI (70/20/5/5)
          tout en visualisant l'impact du boost utilisateur.
        </p>
        {!walletReady && (
          <p className="text-xs text-yellow-400 mt-2">
            Connectez votre wallet pour activer les boutons d'envoi.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Swap Fees */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-white">Flux 1 · Frais de swap</h4>
              <p className="text-xs text-gray-500">0.30% prélevé sur le volume, 85% trésorerie / 15% buyback</p>
            </div>
            <span className="text-sm text-[var(--primary)] font-semibold">85% / 15%</span>
          </div>

          <label className="text-sm text-gray-400 block">
            Volume de swap (USD)
            <input
              type="number"
              min="0"
              step="0.01"
              value={swapVolumeInput}
              onChange={(e) => setSwapVolumeInput(e.target.value)}
              className="w-full mt-1 bg-black border border-gray-800 rounded-lg px-3 py-2 text-white focus:border-[var(--primary)] outline-none"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DistributionCard
              label="Frais collectés"
              amount={formatUsd(swapPreview.totalFee)}
              subLabel="0.30% du volume"
            />
            <DistributionCard
              label="Trésorerie (85%)"
              amount={formatUsd(swapPreview.treasury)}
              subLabel="Operations, R&D, marketing"
            />
            <DistributionCard
              label="Buyback & Burn (15%)"
              amount={formatUsd(swapPreview.buyback)}
              subLabel="Pression déflationniste"
            />
          </div>

          <button
            onClick={handleRecordSwapFees}
            disabled={!walletReady || swapStatus.state === "loading" || (Number.parseFloat(swapVolumeInput) || 0) <= 0}
            className="w-full bg-[var(--primary)]/90 hover:bg-[var(--primary)] text-black font-semibold py-2.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {swapStatus.state === "loading" ? "Envoi..." : "Enregistrer sur-chain"}
          </button>
          <StatusMessage status={swapStatus} />
        </div>

        {/* NPI Distribution */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-white">Flux 2 · Revenus NPI</h4>
              <p className="text-xs text-gray-500">
                70% utilisateur / 20% plateforme / 5% boost vault / 5% buyback (+ bonus boost)
              </p>
            </div>
            <span className="text-sm text-[var(--secondary)] font-semibold">70% / 20% / 5% / 5%</span>
          </div>

          <label className="text-sm text-gray-400 block">
            Revenus NPI (USD)
            <input
              type="number"
              min="0"
              step="0.01"
              value={npiAmountInput}
              onChange={(e) => setNpiAmountInput(e.target.value)}
              className="w-full mt-1 bg-black border border-gray-800 rounded-lg px-3 py-2 text-white focus:border-[var(--secondary)] outline-none"
            />
          </label>

          <label className="text-sm text-gray-400 block">
            Boost utilisateur (0 à +5%)
            <input
              type="range"
              min={0}
              max={MAX_USER_BOOST_BPS}
              step={25}
              value={boostBps}
              onChange={(e) => setBoostBps(Number.parseInt(e.target.value, 10))}
              className="w-full mt-2"
            />
            <div className="text-xs text-gray-500 mt-1">
              Boost appliqué: +{(boostBps / 100).toFixed(2)}% (cappé à 5%)
            </div>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DistributionCard
              label="Utilisateur (70% base)"
              amount={formatUsd(npiPreview.userBase)}
              subLabel="Rebate direct"
            />
            <DistributionCard
              label="Bonus boost"
              amount={formatUsd(npiPreview.userBonus)}
              subLabel="Prélevé sur le Boost Vault (5%)"
            />
            <DistributionCard
              label="Trésorerie (20%)"
              amount={formatUsd(npiPreview.treasury)}
              subLabel="Revenue plateforme"
            />
            <DistributionCard
              label="Boost Vault restant"
              amount={formatUsd(npiPreview.boostPoolRemaining)}
              subLabel="Redistribué aux lockers"
            />
            <DistributionCard
              label="Buyback & Burn"
              amount={formatUsd(npiPreview.buyback)}
              subLabel="5% dédié"
            />
          </div>

          <div className="text-xs text-gray-500">
            Répartition finale utilisateur: {formatUsd(npiPreview.userTotal)} ({(npiPreview.userTotal / (npiPreview.npi || 1) * 100).toFixed(2)}% du NPI)
          </div>

          <button
            onClick={handleDistributeNpi}
            disabled={!walletReady || npiStatus.state === "loading" || (Number.parseFloat(npiAmountInput) || 0) <= 0}
            className="w-full bg-[var(--secondary)]/90 hover:bg-[var(--secondary)] text-black font-semibold py-2.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {npiStatus.state === "loading" ? "Envoi..." : "Distribuer les NPI"}
          </button>
          <StatusMessage status={npiStatus} />
        </div>
      </div>
    </div>
  );
}
