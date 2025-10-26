"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { CNFTCard } from "./CNFTCard";
import { useCNFT } from "../hooks/useCNFT";
import { useRealtimeStats } from "../hooks/useRealtimeStats";
import { SkeletonLoader } from "./Skeletons";
import { NoActivityState, NoConnectionState } from "./EmptyState";
import { DCA } from "./DCA";
import LockInterface from "./LockInterface";
import UnlockInterface from "./UnlockInterface";
import { BuybackStatsCard } from "./BuybackStatsCard";

export const Dashboard = () => {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<"overview" | "dca" | "lock">(
    "overview"
  );
  const [lockSubTab, setLockSubTab] = useState<"lock" | "unlock">("lock");

  const { cnftData, levelName, lockData, refresh } = useCNFT();
  const { userStats, globalStats, loading } = useRealtimeStats(
    publicKey?.toString()
  );

  // Auto-switch to unlock tab if tokens are already locked
  useState(() => {
    if (lockData?.isActive && cnftData?.isActive) {
      setLockSubTab("unlock");
    }
  });

  const handleLockSuccess = () => {
    setTimeout(() => {
      refresh();
      setLockSubTab("unlock");
    }, 2000);
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
            className="text-2xl font-bold terminal-text terminal-glow uppercase tracking-wider"
            id="protocol-stats-heading"
          >
            PROTOCOL STATISTICS
          </h2>
          <div className="flex items-center gap-2 px-3 py-1 border-2 border-[var(--secondary)]">
            <span
              className="w-2 h-2 bg-[var(--secondary)] animate-pulse"
              aria-hidden="true"
            ></span>
            <span className="text-xs terminal-text uppercase tracking-wider">
              [LIVE]
            </span>
          </div>
        </div>
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          role="group"
          aria-labelledby="protocol-stats-heading"
        >
          <div className="stat-card text-center group hover:scale-105 transition-transform">
            <div
              className="text-sm terminal-text opacity-70 mb-2 uppercase tracking-wider"
              id="total-volume-label"
            >
              [TOTAL VOLUME]
            </div>
            <div
              className="text-3xl font-bold terminal-text terminal-glow"
              aria-labelledby="total-volume-label"
              aria-live="polite"
            >
              $
              {globalStats.totalVolume.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-xs terminal-text opacity-60 mt-2">
              +{globalStats.swapsLast24h} swaps (24h)
            </div>
          </div>
          <div className="stat-card text-center group hover:scale-105 transition-transform">
            <div className="text-sm terminal-text opacity-70 mb-2 uppercase tracking-wider">
              [$BACK BURNED]
            </div>
            <div className="text-3xl font-bold text-[var(--accent)] terminal-glow">
              {globalStats.totalBurned.toLocaleString("en-US")}
            </div>
            <div className="text-xs terminal-text opacity-60 mt-2">
              🔥 DEFLATIONARY
            </div>
          </div>
          <div className="stat-card text-center group hover:scale-105 transition-transform">
            <div className="text-sm terminal-text opacity-70 mb-2 uppercase tracking-wider">
              [REBATES DISTRIBUTED]
            </div>
            <div className="text-3xl font-bold terminal-text terminal-glow">
              $
              {globalStats.totalRebates.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
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

      {/* Buyback & Burn Stats */}
      <BuybackStatsCard />

      {/* Tabs Navigation */}
      <div className="flex gap-0 p-0 bg-black border-2 border-[var(--primary)]/30">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 px-6 py-3 font-semibold transition-all terminal-text uppercase tracking-wider border-r-2 ${
            activeTab === "overview"
              ? "bg-[var(--primary)] text-gray-900 border-[var(--primary)] terminal-glow font-bold"
              : "text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary)]/10"
          }`}
        >
          📊 OVERVIEW
        </button>
        <button
          onClick={() => setActiveTab("dca")}
          className={`flex-1 px-6 py-3 font-semibold transition-all terminal-text uppercase tracking-wider border-r-2 ${
            activeTab === "dca"
              ? "bg-[var(--primary)] text-gray-900 border-[var(--primary)] terminal-glow font-bold"
              : "text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary)]/10"
          }`}
        >
          💰 DCA
        </button>
        <button
          onClick={() => setActiveTab("lock")}
          className={`flex-1 px-6 py-3 font-semibold transition-all terminal-text uppercase tracking-wider ${
            activeTab === "lock"
              ? "bg-[var(--primary)] text-gray-900 border-[var(--primary)] terminal-glow font-bold"
              : "text-[var(--primary)] hover:bg-[var(--primary)]/10"
          }`}
        >
          � LOCK/UNLOCK
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
                <span className="terminal-text opacity-70 text-sm uppercase tracking-wider">
                  [SWAPS]
                </span>
              </div>
              <div className="text-2xl font-bold terminal-text terminal-glow">
                {userStats.totalSwaps}
              </div>
            </div>

            <div className="terminal-box p-5 border-2 border-[var(--secondary)]/30 hover:border-[var(--secondary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border-2 border-[var(--secondary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">💰</span>
                </div>
                <span className="terminal-text opacity-70 text-sm uppercase tracking-wider">
                  [VOLUME]
                </span>
              </div>
              <div className="text-2xl font-bold terminal-text terminal-glow">
                ${userStats.totalVolume.toLocaleString()}
              </div>
            </div>

            <div className="terminal-box p-5 border-2 border-[var(--secondary)]/30 hover:border-[var(--secondary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border-2 border-[var(--secondary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">📈</span>
                </div>
                <span className="terminal-text opacity-70 text-sm uppercase tracking-wider">
                  [NPI]
                </span>
              </div>
              <div className="text-2xl font-bold terminal-text terminal-glow">
                +${userStats.totalNPI.toFixed(2)}
              </div>
            </div>

            <div className="terminal-box p-5 border-2 border-[var(--secondary)]/30 hover:border-[var(--secondary)] transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border-2 border-[var(--secondary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">✅</span>
                </div>
                <span className="terminal-text opacity-70 text-sm uppercase tracking-wider">
                  [REBATES]
                </span>
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
                    <div className="font-bold text-lg mb-1 terminal-text uppercase tracking-wider">
                      [PENDING REBATES]
                    </div>
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

      {/* DCA Tab */}
      {activeTab === "dca" && (
        <div className="space-y-6">
          <DCA />
        </div>
      )}

      {/* Lock/Unlock Tab */}
      {activeTab === "lock" && (
        <div className="space-y-6">
          {/* Sub-tabs for Lock/Unlock */}
          <div className="flex gap-0 p-0 bg-black border-2 border-[var(--primary)]/30">
            <button
              onClick={() => setLockSubTab("lock")}
              disabled={lockData?.isActive && cnftData?.isActive}
              className={`flex-1 px-6 py-3 font-semibold transition-all terminal-text uppercase tracking-wider border-r-2 ${
                lockSubTab === "lock"
                  ? "bg-[var(--primary)] text-black border-[var(--primary)] terminal-glow"
                  : "text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary)]/10"
              } ${
                lockData?.isActive && cnftData?.isActive
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              🔒 LOCK
            </button>
            <button
              onClick={() => setLockSubTab("unlock")}
              disabled={!lockData?.isActive || !cnftData?.isActive}
              className={`flex-1 px-6 py-3 font-semibold transition-all terminal-text uppercase tracking-wider ${
                lockSubTab === "unlock"
                  ? "bg-[var(--primary)] text-black border-[var(--primary)] terminal-glow"
                  : "text-[var(--primary)] hover:bg-[var(--primary)]/10"
              } ${
                !lockData?.isActive || !cnftData?.isActive
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              🔓 UNLOCK
            </button>
          </div>

          {/* Lock/Unlock Content */}
          {lockSubTab === "lock" && <LockInterface onLockSuccess={handleLockSuccess} />}
          {lockSubTab === "unlock" && <UnlockInterface onUnlockSuccess={refresh} />}
        </div>
      )}

      {/* Analytics Section removed - replaced by DCA and Lock */}
    </div>
  );
};
