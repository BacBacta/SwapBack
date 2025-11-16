"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { CNFTCard } from "./CNFTCard";
import { useCNFT } from "../hooks/useCNFT";
import { useRealtimeStats } from "../hooks/useRealtimeStats";
import { SkeletonLoader } from "./Skeletons";
import { NoActivityState, NoConnectionState } from "./EmptyState";
import { SwapBackDashboard } from "./SwapBackDashboard";
import LockInterface from "./LockInterface";
import UnlockInterface from "./UnlockInterface";
import { logError } from "@/lib/errorLogger";
// Import charts directly instead of lazy loading to avoid chunk errors
import { VolumeChart, ActivityChart } from "./Charts";
import RevenueAdminPanel from "./RevenueAdminPanel";

export const Dashboard = () => {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<
    "dca" | "lock-unlock" | "overview" | "analytics"
  >("dca");

  const { cnftData } = useCNFT();
  const { userStats, globalStats, loading, refresh, lastRefresh } =
    useRealtimeStats(publicKey?.toString());

  // Log le montage du composant
  useEffect(() => {
    console.log("📊 Dashboard mounted", {
      connected,
      publicKey: publicKey?.toString(),
      hasUserStats: !!userStats,
      hasGlobalStats: !!globalStats,
      loading,
    });

    // Capturer toutes les erreurs non gérées dans Dashboard
    const errorHandler = (event: ErrorEvent) => {
      logError(event.error, {
        component: "Dashboard",
        action: "windowError",
        additionalData: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const promiseRejectionHandler = (event: PromiseRejectionEvent) => {
      logError(event.reason, {
        component: "Dashboard",
        action: "unhandledRejection",
        additionalData: {
          promise: "PromiseRejection",
        },
      });
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", promiseRejectionHandler);

    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", promiseRejectionHandler);
    };
  }, [connected, publicKey, userStats, globalStats, loading]);

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

      {/* Global Stats */}
      <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-2xl font-bold text-white"
            id="protocol-stats-heading"
          >
            Protocol Statistics
          </h2>
          <div className="flex items-center gap-3">
            {/* Bouton de rafraîchissement manuel */}
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg border border-[var(--primary)]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Rafraîchir les statistiques"
            >
              <svg
                className={`w-4 h-4 text-[var(--primary)] ${loading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="text-xs text-gray-400">
                {loading ? "Loading..." : "Refresh"}
              </span>
            </button>

            {/* Indicateur Live */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-lg border border-[var(--secondary)]/30">
              <span
                className="w-2 h-2 bg-[var(--secondary)] rounded-full"
                aria-hidden="true"
              ></span>
              <span className="text-xs text-gray-400">
                {lastRefresh
                  ? `Updated ${Math.floor((Date.now() - lastRefresh) / 1000)}s ago`
                  : "Auto-refresh: 5min"}
              </span>
            </div>
          </div>
        </div>
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          role="group"
          aria-labelledby="protocol-stats-heading"
        >
          <div className="bg-gray-900 rounded-lg p-4 text-center group hover:border hover:border-[var(--primary)]/30 transition-all">
            <div className="text-sm text-gray-400 mb-2" id="total-volume-label">
              Total Volume
            </div>
            <div
              className="text-3xl font-bold text-white"
              aria-labelledby="total-volume-label"
              aria-live="polite"
            >
              $
              {globalStats.totalVolume.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              +{globalStats.swapsLast24h} swaps (24h)
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 text-center group hover:border hover:border-[var(--primary)]/30 transition-all">
            <div className="text-sm text-gray-400 mb-2">$BACK Burned</div>
            <div className="text-3xl font-bold text-[var(--accent)]">
              {globalStats.totalBurned.toLocaleString("en-US")}
            </div>
            <div className="text-xs text-gray-500 mt-2">🔥 Deflationary</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 text-center group hover:border hover:border-[var(--primary)]/30 transition-all">
            <div className="text-sm text-gray-400 mb-2">
              Rebates Distributed
            </div>
            <div className="text-3xl font-bold text-white">
              $
              {globalStats.totalRebates.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {globalStats.activeUsers.toLocaleString()} active users
            </div>
          </div>
        </div>
      </div>

      {/* cNFT Card */}
      {cnftData && cnftData.exists && cnftData.isActive && (
        <CNFTCard
          level={
            cnftData.level === "Bronze" ||
            cnftData.level === "Silver" ||
            cnftData.level === "Gold"
              ? cnftData.level
              : "Bronze"
          }
          boost={cnftData.boostBps / 100}
          lockedAmount={cnftData.lockedAmount}
          lockDuration={Math.floor(cnftData.lockDuration / 86400)}
          isActive={cnftData.isActive}
          unlockDate={new Date(cnftData.unlockTime * 1000)}
        />
      )}

      <RevenueAdminPanel />

      {/* Tabs Navigation */}
      <div className="flex gap-1 p-1 bg-gray-900 rounded-xl border border-[var(--primary)]/20">
        <button
          onClick={() => setActiveTab("dca")}
          className={`flex-1 px-6 py-3 font-semibold transition-all rounded-lg ${
            activeTab === "dca"
              ? "bg-[var(--primary)] text-black"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          📊 DCA
        </button>
        <button
          onClick={() => setActiveTab("lock-unlock")}
          className={`flex-1 px-6 py-3 font-semibold transition-all rounded-lg ${
            activeTab === "lock-unlock"
              ? "bg-[var(--primary)] text-black"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          🔒 Lock/Unlock
        </button>
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 px-6 py-3 font-semibold transition-all rounded-lg ${
            activeTab === "overview"
              ? "bg-[var(--primary)] text-black"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          👤 Overview
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 px-6 py-3 font-semibold transition-all rounded-lg ${
            activeTab === "analytics"
              ? "bg-[var(--primary)] text-black"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          📈 Analytics
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === "dca" && (
        <div className="space-y-6">
          <SwapBackDashboard />
        </div>
      )}

      {activeTab === "lock-unlock" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
              <span>🔒</span>
              <span>Lock $BACK</span>
            </h3>
            <LockInterface
              onLockSuccess={() => {
                // Refresh data after lock
                window.location.reload();
              }}
            />
          </div>
          <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
              <span>🔓</span>
              <span>Unlock $BACK</span>
            </h3>
            <UnlockInterface
              onUnlockSuccess={() => {
                // Refresh data after unlock
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "overview" && userStats && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-lg p-5 hover:border hover:border-[var(--primary)]/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border border-[var(--primary)] rounded flex items-center justify-center">
                  <span className="text-lg">🔄</span>
                </div>
                <span className="text-gray-400 text-sm">Swaps</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {userStats.totalSwaps}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-5 hover:border hover:border-[var(--secondary)]/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border border-[var(--secondary)] rounded flex items-center justify-center">
                  <span className="text-lg">💰</span>
                </div>
                <span className="text-gray-400 text-sm">Volume</span>
              </div>
              <div className="text-2xl font-bold text-white">
                ${userStats.totalVolume.toLocaleString()}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-5 hover:border hover:border-[var(--secondary)]/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border border-[var(--secondary)] rounded flex items-center justify-center">
                  <span className="text-lg">📈</span>
                </div>
                <span className="text-gray-400 text-sm">NPI</span>
              </div>
              <div className="text-2xl font-bold text-white">
                +${userStats.totalNPI.toFixed(2)}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-5 hover:border hover:border-[var(--secondary)]/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border border-[var(--secondary)] rounded flex items-center justify-center">
                  <span className="text-lg">✅</span>
                </div>
                <span className="text-gray-400 text-sm">Rebates</span>
              </div>
              <div className="text-2xl font-bold text-white">
                ${userStats.totalRebates.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Pending Rebates Card */}
          {userStats.pendingRebates > 0 && (
            <div className="bg-black border border-[var(--primary)] rounded-xl p-6 hover:scale-[1.01] transition-all">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 border border-[var(--accent)] rounded flex items-center justify-center">
                    <span className="text-2xl">💎</span>
                  </div>
                  <div>
                    <div className="font-bold text-lg mb-1 text-gray-400">
                      Pending Rebates
                    </div>
                    <div className="text-3xl font-bold text-white">
                      ${userStats.pendingRebates.toFixed(2)}
                    </div>
                  </div>
                </div>
                <button className="bg-[var(--primary)] text-black px-8 py-3 rounded-lg text-lg font-bold hover:bg-[var(--primary)]/90 transition-colors">
                  🎁 Claim Now
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Volume Chart */}
          <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
              <span>📊</span>
              <span>Volume Trend (7 Days)</span>
            </h3>
            <div className="h-64">
              <VolumeChart data={volumeData} />
            </div>
          </div>

          {/* Activity Chart */}
          <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
              <span>📈</span>
              <span>Trading Activity (7 Days)</span>
            </h3>
            <div className="h-64">
              <ActivityChart data={activityData} />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-6">
              <h4 className="font-bold mb-4 text-[var(--primary)]">
                Performance
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg. Swap Size</span>
                  <span className="font-semibold text-white">
                    $
                    {(
                      (userStats?.totalVolume || 0) / (userStats?.totalSwaps || 1)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg. NPI per Swap</span>
                  <span className="font-semibold text-[var(--secondary)]">
                    $
                    {(
                      (userStats?.totalNPI || 0) / (userStats?.totalSwaps || 1)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rebate Rate</span>
                  <span className="font-semibold text-[var(--secondary)]">
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

            <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-6">
              <h4 className="font-bold mb-4 text-[var(--secondary)]">
                Rewards
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Earned</span>
                  <span className="font-semibold text-[var(--secondary)]">
                    $
                    {(
                      (userStats?.totalNPI || 0) +
                      (userStats?.totalRebates || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rebate Boost</span>
                  <span className="font-semibold text-white">
                    +{userStats?.rebateBoost || 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Locked Amount</span>
                  <span className="font-semibold text-white">
                    {(userStats?.lockedAmount || 0).toLocaleString()} $BACK
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
