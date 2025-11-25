/**
 * Beta Dashboard Component
 * 
 * Displays beta user stats, progress, and contribution metrics
 */

'use client';

import { useEffect, useState } from 'react';
import { getBetaMetrics, getBetaUserData, isBetaUser } from '@/lib/betaTracking';

interface BetaStats {
  totalSwaps: number;
  totalVolume: number;
  feedbackCount: number;
  bugsReported: number;
  lastUpdated: number;
}

export default function BetaDashboard() {
  const [stats, setStats] = useState<BetaStats | null>(null);
  const [userData, setUserData] = useState<{ walletAddress: string; inviteCode: string } | null>(null);

  useEffect(() => {
    if (!isBetaUser()) return;

    const metrics = getBetaMetrics();
    setStats({
      totalSwaps: metrics.totalSwaps || 0,
      totalVolume: metrics.totalVolume || 0,
      feedbackCount: metrics.feedbackCount || 0,
      bugsReported: metrics.bugsReported || 0,
      lastUpdated: metrics.lastUpdated || Date.now(),
    });

    setUserData(getBetaUserData());
  }, []);

  if (!isBetaUser()) {
    return null;
  }

  return (
    <div className="rounded-lg border border-purple-500/20 bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-purple-400">
            🧪 Beta Tester Dashboard
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Thank you for being an early adopter!
          </p>
        </div>
        <div className="bg-purple-500/20 px-4 py-2 rounded-lg">
          <span className="text-purple-300 font-sans text-sm">
            {userData?.inviteCode}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total Swaps */}
        <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
          <div className="text-3xl mb-2">🔄</div>
          <div className="text-2xl font-bold text-green-400">
            {stats?.totalSwaps || 0}
          </div>
          <div className="text-sm text-gray-400">Total Swaps</div>
        </div>

        {/* Total Volume */}
        <div className="bg-black/40 rounded-lg p-4 border border-blue-500/20">
          <div className="text-3xl mb-2">💰</div>
          <div className="text-2xl font-bold text-blue-400">
            ${(stats?.totalVolume || 0).toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">Total Volume</div>
        </div>

        {/* Feedback Submitted */}
        <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
          <div className="text-3xl mb-2">💬</div>
          <div className="text-2xl font-bold text-purple-400">
            {stats?.feedbackCount || 0}
          </div>
          <div className="text-sm text-gray-400">Feedback</div>
        </div>

        {/* Bugs Reported */}
        <div className="bg-black/40 rounded-lg p-4 border border-orange-500/20">
          <div className="text-3xl mb-2">🐛</div>
          <div className="text-2xl font-bold text-orange-400">
            {stats?.bugsReported || 0}
          </div>
          <div className="text-sm text-gray-400">Bugs Found</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Beta Testing Progress</span>
          <span>{calculateProgress(stats)}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-600 to-pink-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${calculateProgress(stats)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Keep testing and providing feedback to unlock rewards! 🎁
        </p>
      </div>

      {/* Contribution Level */}
      <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-yellow-400 mb-1">
              {getContributionLevel(stats)}
            </h3>
            <p className="text-sm text-gray-400">
              Your contribution level
            </p>
          </div>
          <div className="text-4xl">
            {getContributionEmoji(stats)}
          </div>
        </div>
        
        {/* Next Level Progress */}
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-1">
            Next: {getNextLevel(stats)}
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-yellow-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${getLevelProgress(stats)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Beta Tester Badge */}
      <div className="mt-6 text-center p-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg border border-purple-500/30">
        <div className="text-4xl mb-2">🏅</div>
        <p className="text-purple-300 font-semibold">
          Official Beta Tester
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Wallet: {userData?.walletAddress.slice(0, 4)}...{userData?.walletAddress.slice(-4)}
        </p>
      </div>
    </div>
  );
}

/**
 * Calculate overall beta testing progress
 */
function calculateProgress(stats: BetaStats | null): number {
  if (!stats) return 0;

  // Progress based on:
  // - 10 swaps = 40%
  // - 5 feedback = 30%
  // - 2 bugs = 30%
  const swapProgress = Math.min((stats.totalSwaps / 10) * 40, 40);
  const feedbackProgress = Math.min((stats.feedbackCount / 5) * 30, 30);
  const bugProgress = Math.min((stats.bugsReported / 2) * 30, 30);

  return Math.round(swapProgress + feedbackProgress + bugProgress);
}

/**
 * Get contribution level based on stats
 */
function getContributionLevel(stats: BetaStats | null): string {
  const progress = calculateProgress(stats);

  if (progress >= 80) return '🌟 Elite Tester';
  if (progress >= 60) return '💎 Power Tester';
  if (progress >= 40) return '⭐ Active Tester';
  if (progress >= 20) return '🔰 Contributor';
  return '🌱 Newcomer';
}

/**
 * Get contribution emoji
 */
function getContributionEmoji(stats: BetaStats | null): string {
  const progress = calculateProgress(stats);

  if (progress >= 80) return '👑';
  if (progress >= 60) return '💎';
  if (progress >= 40) return '⭐';
  if (progress >= 20) return '🔰';
  return '🌱';
}

/**
 * Get next contribution level
 */
function getNextLevel(stats: BetaStats | null): string {
  const progress = calculateProgress(stats);

  if (progress >= 80) return 'Maximum Level!';
  if (progress >= 60) return '🌟 Elite Tester (80%)';
  if (progress >= 40) return '💎 Power Tester (60%)';
  if (progress >= 20) return '⭐ Active Tester (40%)';
  return '🔰 Contributor (20%)';
}

/**
 * Get progress to next level
 */
function getLevelProgress(stats: BetaStats | null): number {
  const progress = calculateProgress(stats);

  if (progress >= 80) return 100;
  if (progress >= 60) return ((progress - 60) / 20) * 100;
  if (progress >= 40) return ((progress - 40) / 20) * 100;
  if (progress >= 20) return ((progress - 20) / 20) * 100;
  return (progress / 20) * 100;
}
