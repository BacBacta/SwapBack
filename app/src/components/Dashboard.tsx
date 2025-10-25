"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { CNFTCard } from "./CNFTCard";
import { useCNFT } from "../hooks/useCNFT";
import { useRealtimeStats } from "../hooks/useRealtimeStats";
import { VolumeChart, ActivityChart } from "./Charts";
import { SkeletonLoader, ChartSkeleton } from "./Skeletons";
import { NoActivityState, NoConnectionState } from "./EmptyState";

export const Dashboard = () => {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");

  const { cnftData, levelName } = useCNFT();
  const { userStats, globalStats, loading } = useRealtimeStats(publicKey?.toString());

  // Mock chart data
  const volumeData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    volumes: [1200, 1900, 1500, 2100, 1800, 2400, 2200],
  };

  const activityData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
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
        {loading ? "Loading dashboard data..." : `Dashboard updated. Total volume: $${globalStats.totalVolume.toLocaleString()}`}
      </div>

      {/* Global Stats avec animation */}
      <div className="swap-card">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold terminal-text terminal-glow uppercase tracking-wider" id="protocol-stats-heading">PROTOCOL STATISTICS</h2>
          <div className="flex items-center gap-2 px-3 py-1 border-2 border-[var(--primary)]">
            <span className="w-2 h-2 bg-[var(--primary)] animate-pulse" aria-hidden="true"></span>
            <span className="text-xs terminal-text uppercase tracking-wider">[LIVE]</span>
          </div>
        </div>
        <div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          role="group"
          aria-labelledby="protocol-stats-heading"
        >
          <div className="stat-card text-center group hover:scale-105 transition-transform">
            <div className="text-sm terminal-text opacity-70 mb-2 uppercase tracking-wider" id="total-volume-label">[TOTAL VOLUME]</div>
            <div 
              className="text-3xl font-bold terminal-text terminal-glow"
              aria-labelledby="total-volume-label"
              aria-live="polite"
            >
              ${globalStats.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs terminal-text opacity-60 mt-2">
              +{globalStats.swapsLast24h} swaps (24h)
            </div>
          </div>
          <div className="stat-card text-center group hover:scale-105 transition-transform">
            <div className="text-sm terminal-text opacity-70 mb-2 uppercase tracking-wider">[$BACK BURNED]</div>
            <div className="text-3xl font-bold text-[var(--accent)] terminal-glow">
              {globalStats.totalBurned.toLocaleString('en-US')}
            </div>
            <div className="text-xs terminal-text opacity-60 mt-2">
              🔥 DEFLATIONARY
            </div>
          </div>
          <div className="stat-card text-center group hover:scale-105 transition-transform">
            <div className="text-sm terminal-text opacity-70 mb-2 uppercase tracking-wider">[REBATES DISTRIBUTED]</div>
            <div className="text-3xl font-bold terminal-text terminal-glow">
              ${globalStats.totalRebates.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs terminal-text opacity-60 mt-2">
              {globalStats.activeUsers.toLocaleString()} active users
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
      <div className="flex gap-0 p-0 bg-black border-2 border-[var(--primary)]/30">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 px-6 py-3 font-semibold transition-all terminal-text uppercase tracking-wider border-r-2 border-[var(--primary)] ${
            activeTab === "overview"
              ? "bg-[var(--primary)] text-black border-[var(--primary)] terminal-glow"
              : "text-[var(--primary)] border-[var(--primary)] hover:bg-[var(--primary)]/10"
          }`}
        >
          📊 OVERVIEW
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 px-6 py-3 font-semibold transition-all terminal-text uppercase tracking-wider border-r-2 border-[var(--primary)] ${
            activeTab === "analytics"
              ? "bg-[var(--primary)] text-black border-[var(--primary)] terminal-glow"
              : "text-[var(--primary)] border-[var(--primary)] hover:bg-[var(--primary)]/10"
          }`}
        >
          📈 ANALYTICS
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === "overview" && userStats && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="terminal-box p-5 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border-2 border-[var(--primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">🔄</span>
                </div>
                <span className="terminal-text opacity-70 text-sm uppercase tracking-wider">[SWAPS]</span>
              </div>
              <div className="text-2xl font-bold terminal-text terminal-glow">{userStats.totalSwaps}</div>
            </div>

            <div className="terminal-box p-5 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border-2 border-[var(--primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">💰</span>
                </div>
                <span className="terminal-text opacity-70 text-sm uppercase tracking-wider">[VOLUME]</span>
              </div>
              <div className="text-2xl font-bold terminal-text terminal-glow">${userStats.totalVolume.toLocaleString()}</div>
            </div>

            <div className="terminal-box p-5 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border-2 border-[var(--primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">📈</span>
                </div>
                <span className="terminal-text opacity-70 text-sm uppercase tracking-wider">[NPI]</span>
              </div>
              <div className="text-2xl font-bold terminal-text terminal-glow">
                +${userStats.totalNPI.toFixed(2)}
              </div>
            </div>

            <div className="terminal-box p-5 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border-2 border-[var(--primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">✅</span>
                </div>
                <span className="terminal-text opacity-70 text-sm uppercase tracking-wider">[REBATES]</span>
              </div>
              <div className="text-2xl font-bold terminal-text terminal-glow">
                ${userStats.totalRebates.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Pending Rebates Card */}
          {userStats.pendingRebates > 0 && (
            <div className="terminal-box p-6 border-2 border-[var(--primary)] hover:scale-[1.02] transition-all relative overflow-hidden terminal-scanline">
              <div className="relative flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 border-2 border-[var(--accent)] flex items-center justify-center animate-pulse">
                    <span className="text-2xl">💎</span>
                  </div>
                  <div>
                    <div className="font-bold text-lg mb-1 terminal-text uppercase tracking-wider">[PENDING REBATES]</div>
                    <div className="text-3xl font-bold terminal-text terminal-glow">
                      ${userStats.pendingRebates.toFixed(2)}
                    </div>
                  </div>
                </div>
                <button className="btn-primary px-8 py-3 text-lg font-bold uppercase tracking-wider">
                  🎁 CLAIM NOW
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
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span>📊</span>
              <span>Volume Trend (7 Days)</span>
            </h3>
            <div className="h-64">
              <VolumeChart data={volumeData} />
            </div>
          </div>

          {/* Activity Chart */}
          <div className="swap-card">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span>📈</span>
              <span>Trading Activity (7 Days)</span>
            </h3>
            <div className="h-64">
              <ActivityChart data={activityData} />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="swap-card">
              <h4 className="font-bold mb-4 text-[var(--primary)]">Performance</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg. Swap Size</span>
                  <span className="font-semibold">${(userStats?.totalVolume || 0 / (userStats?.totalSwaps || 1)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg. NPI per Swap</span>
                  <span className="font-semibold text-[var(--secondary)]">
                    ${(userStats?.totalNPI || 0 / (userStats?.totalSwaps || 1)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rebate Rate</span>
                  <span className="font-semibold text-[var(--secondary)]">
                    {(((userStats?.totalRebates || 0) / (userStats?.totalVolume || 1)) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="swap-card">
              <h4 className="font-bold mb-4 text-[var(--secondary)]">Rewards</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Earned</span>
                  <span className="font-semibold text-[var(--secondary)]">
                    ${((userStats?.totalNPI || 0) + (userStats?.totalRebates || 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rebate Boost</span>
                  <span className="font-semibold">+{userStats?.rebateBoost || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Locked Amount</span>
                  <span className="font-semibold">
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
