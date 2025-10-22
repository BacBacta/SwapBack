"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { CNFTCard } from "./CNFTCard";
import { LockUnlock } from "./LockUnlock";
import { useCNFT } from "../hooks/useCNFT";
import { useRealtimeStats } from "../hooks/useRealtimeStats";
import { VolumeChart, ActivityChart } from "./Charts";
import { SkeletonLoader } from "./Skeletons";
import { NoActivityState, NoConnectionState } from "./EmptyState";

export const Dashboard = () => {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<
    "overview" | "analytics" | "lockunlock"
  >("overview");

  const { cnftData, levelName } = useCNFT();
  const { userStats, globalStats, loading } = useRealtimeStats(
    publicKey?.toString()
  );

  // Mock chart data
  const volumeData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    volumes: [1200, 1900, 1500, 2100, 1800, 2400, 2200],
  };

  const activityData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    swaps: [5, 8, 6, 10, 7, 12, 9],
  };

  if (!connected) {
    return <NoConnectionState />;
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <SkeletonLoader />
      </div>
    );
  }

  if (userStats && userStats.totalSwaps === 0) {
    return <NoActivityState />;
  }

  return (
    <div className="space-y-8">
      {/* ARIA Live Region for updates - Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {loading
          ? "Loading dashboard data..."
          : `Dashboard updated. Total volume: $${globalStats.totalVolume.toLocaleString()}`}
      </div>

      {/* Global Stats avec animation */}
      <div className="swap-card">
        <div className="flex items-center justify-between mb-8">
          <h2
            className="text-2xl font-bold terminal-text"
            id="protocol-stats-heading"
          >
            <span className="terminal-prefix">&gt;</span> PROTOCOL_STATISTICS
          </h2>
          <div className="flex items-center gap-2 px-3 py-1 bg-[var(--primary)]/10 border-2 border-[var(--primary)]">
            <span
              className="w-2 h-2 bg-[var(--primary)] animate-pulse"
              aria-hidden="true"
            ></span>
            <span className="text-xs font-bold text-[var(--primary)] terminal-text">
              [LIVE_DATA]
            </span>
            <span className="terminal-cursor"></span>
          </div>
        </div>
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          aria-labelledby="protocol-stats-heading"
        >
          <div className="stat-card text-center group">
            <div className="text-sm terminal-text mb-2" id="total-volume-label">
              <span className="terminal-prefix">&gt;</span> TOTAL_VOLUME
            </div>
            <div
              className="text-3xl font-bold text-[var(--primary)] terminal-text"
              aria-labelledby="total-volume-label"
              aria-live="polite"
            >
              $
              {globalStats.totalVolume.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-xs terminal-text mt-2">
              [+{globalStats.swapsLast24h} SWAPS_24H]
            </div>
          </div>
          <div className="stat-card text-center group">
            <div className="text-sm terminal-text mb-2">
              <span className="terminal-prefix">&gt;</span> $BACK_BURNED
            </div>
            <div className="text-3xl font-bold text-[var(--primary)] terminal-text">
              {globalStats.totalBurned.toLocaleString("en-US")}
            </div>
            <div className="text-xs terminal-text mt-2">
              [MODE: DEFLATIONARY]
            </div>
          </div>
          <div className="stat-card text-center group">
            <div className="text-sm terminal-text mb-2">
              <span className="terminal-prefix">&gt;</span> REBATES_DISTRIBUTED
            </div>
            <div className="text-3xl font-bold text-[var(--primary)] terminal-text">
              $
              {globalStats.totalRebates.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-xs terminal-text mt-2">
              [{globalStats.activeUsers.toLocaleString()} ACTIVE_USERS]
            </div>
          </div>
        </div>
      </div>

      {/* cNFT Card */}
      {cnftData && cnftData.exists && cnftData.isActive && (
        <CNFTCard
          level={levelName || "Bronze"}
          boost={cnftData.boost}
          lockedAmount={cnftData.lockedAmount}
          lockDuration={cnftData.lockDuration}
          isActive={cnftData.isActive}
          unlockDate={cnftData.unlockDate}
        />
      )}

      {/* Tabs Navigation */}
      <div className="flex gap-2 p-1 bg-black/30 border-2 border-[var(--primary)]">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 px-6 py-3 font-bold transition-all terminal-text ${
            activeTab === "overview"
              ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]"
              : "border-2 border-transparent hover:border-[var(--primary)]/50"
          }`}
        >
          <span className="terminal-prefix">&gt;</span>[OVERVIEW]
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 px-6 py-3 font-bold transition-all terminal-text ${
            activeTab === "analytics"
              ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]"
              : "border-2 border-transparent hover:border-[var(--primary)]/50"
          }`}
        >
          <span className="terminal-prefix">&gt;</span>[ANALYTICS]
        </button>
        <button
          onClick={() => setActiveTab("lockunlock")}
          className={`flex-1 px-6 py-3 font-bold transition-all terminal-text ${
            activeTab === "lockunlock"
              ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]"
              : "border-2 border-transparent hover:border-[var(--primary)]/50"
          }`}
        >
          <span className="terminal-prefix">&gt;</span>[LOCK/UNLOCK]
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === "overview" && userStats && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card p-5 border-2 border-[var(--primary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-transparent border-2 border-[var(--primary)] flex items-center justify-center">
                  <span className="text-lg terminal-text">&gt;</span>
                </div>
                <span className="terminal-text text-sm">SWAPS</span>
              </div>
              <div className="text-2xl font-bold terminal-text">
                {userStats.totalSwaps}
              </div>
            </div>

            <div className="stat-card p-5 border-2 border-[var(--primary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-transparent border-2 border-[var(--primary)] flex items-center justify-center">
                  <span className="text-lg terminal-text">$</span>
                </div>
                <span className="terminal-text text-sm">VOLUME</span>
              </div>
              <div className="text-2xl font-bold terminal-text">
                ${userStats.totalVolume.toLocaleString()}
              </div>
            </div>

            <div className="stat-card p-5 border-2 border-[var(--primary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-transparent border-2 border-[var(--primary)] flex items-center justify-center">
                  <span className="text-lg terminal-text">+</span>
                </div>
                <span className="terminal-text text-sm">NPI</span>
              </div>
              <div className="text-2xl font-bold text-[var(--primary)] terminal-text">
                +${userStats.totalNPI.toFixed(2)}
              </div>
            </div>

            <div className="stat-card p-5 border-2 border-[var(--primary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-transparent border-2 border-[var(--primary)] flex items-center justify-center">
                  <span className="text-lg terminal-text">✓</span>
                </div>
                <span className="terminal-text text-sm">REBATES</span>
              </div>
              <div className="text-2xl font-bold text-[var(--primary)] terminal-text">
                ${userStats.totalRebates.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Pending Rebates Card */}
          {userStats.pendingRebates > 0 && (
            <div className="swap-card p-6 border-2 border-[var(--primary)] bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 transition-all relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--primary)]/20 to-transparent animate-shimmer"></div>
              </div>
              <div className="relative flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-transparent border-2 border-[var(--primary)] flex items-center justify-center">
                    <span className="text-2xl">💎</span>
                  </div>
                  <div>
                    <div className="font-bold text-lg mb-1 terminal-text">
                      <span className="terminal-prefix">&gt;</span>{" "}
                      PENDING_REBATES
                    </div>
                    <div className="text-3xl font-bold text-[var(--primary)] terminal-text">
                      ${userStats.pendingRebates.toFixed(2)}
                    </div>
                  </div>
                </div>
                <button className="btn-primary px-8 py-3 text-lg font-bold terminal-text">
                  <span className="terminal-prefix">&gt;</span> [CLAIM_NOW]
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab avec Charts */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Volume Chart */}
          <div className="swap-card">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 terminal-text">
              <span className="terminal-prefix">&gt;</span>
              <span>[VOLUME_TREND] - 7_DAYS</span>
            </h3>
            <div className="h-64">
              <VolumeChart data={volumeData} />
            </div>
          </div>

          {/* Activity Chart */}
          <div className="swap-card">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 terminal-text">
              <span className="terminal-prefix">&gt;</span>
              <span>[TRADING_ACTIVITY] - 7_DAYS</span>
            </h3>
            <div className="h-64">
              <ActivityChart data={activityData} />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="swap-card">
              <h4 className="font-bold mb-4 terminal-text">
                <span className="terminal-prefix">&gt;</span>{" "}
                [PERFORMANCE_METRICS]
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="terminal-text opacity-70">
                    AVG_SWAP_SIZE:
                  </span>
                  <span className="font-semibold terminal-text">
                    $
                    {(
                      userStats?.totalVolume || 0 / (userStats?.totalSwaps || 1)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="terminal-text opacity-70">
                    AVG_NPI_PER_SWAP:
                  </span>
                  <span className="font-semibold text-[var(--primary)] terminal-text">
                    $
                    {(
                      userStats?.totalNPI || 0 / (userStats?.totalSwaps || 1)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="terminal-text opacity-70">REBATE_RATE:</span>
                  <span className="font-semibold text-[var(--primary)] terminal-text">
                    {(
                      ((userStats?.totalRebates || 0) /
                        (userStats?.totalVolume || 1)) *
                      100
                    ).toFixed(2)}
                    %
                  </span>
                </div>
              </div>
            </div>

            <div className="swap-card">
              <h4 className="font-bold mb-4 terminal-text">
                <span className="terminal-prefix">&gt;</span> [REWARDS_SUMMARY]
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="terminal-text opacity-70">
                    TOTAL_EARNED:
                  </span>
                  <span className="font-semibold text-[var(--primary)] terminal-text">
                    $
                    {(
                      (userStats?.totalNPI || 0) +
                      (userStats?.totalRebates || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="terminal-text opacity-70">
                    REBATE_BOOST:
                  </span>
                  <span className="font-semibold terminal-text">
                    +{userStats?.rebateBoost || 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="terminal-text opacity-70">
                    LOCKED_AMOUNT:
                  </span>
                  <span className="font-semibold terminal-text">
                    {(userStats?.lockedAmount || 0).toLocaleString()} $BACK
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lock/Unlock Tab */}
      {activeTab === "lockunlock" && (
        <div className="space-y-6">
          <LockUnlock />
        </div>
      )}
    </div>
  );
};
