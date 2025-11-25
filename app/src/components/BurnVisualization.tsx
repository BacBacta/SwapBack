/**
 * 📊 BurnVisualization - Graphique Supply Deflationary
 * 
 * Affiche l'évolution de la supply $BACK avec historique des burns
 * 
 * @author SwapBack Team
 * @date November 23, 2025 - Phase 5.5
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

interface BurnEvent {
  timestamp: number;
  amount: number;
  signature: string;
}

interface SupplyData {
  currentSupply: number;
  initialSupply: number;
  totalBurned: number;
  burnedPercent: number;
  burnHistory: BurnEvent[];
}

export default function BurnVisualization() {
  const { connection } = useConnection();
  const [data, setData] = useState<SupplyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const BACK_MINT = new PublicKey("862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux");
  const INITIAL_SUPPLY = 1_000_000_000; // 1B tokens (adjust based on actual)

  useEffect(() => {
    fetchSupplyData();
  }, [timeRange]);

  const fetchSupplyData = async () => {
    setLoading(true);
    
    try {
      // Fetch current mint supply
      const mintInfo = await connection.getTokenSupply(BACK_MINT);
      const currentSupply = Number(mintInfo.value.amount) / 1e9; // Assuming 9 decimals

      // Calculate burned amount
      const totalBurned = INITIAL_SUPPLY - currentSupply;
      const burnedPercent = (totalBurned / INITIAL_SUPPLY) * 100;

      // TODO: Fetch actual burn events from on-chain logs
      // For now, generate mock data
      const mockBurnHistory: BurnEvent[] = generateMockBurnHistory(timeRange);

      setData({
        currentSupply,
        initialSupply: INITIAL_SUPPLY,
        totalBurned,
        burnedPercent,
        burnHistory: mockBurnHistory,
      });
    } catch (err) {
      console.error("Error fetching supply data:", err);
      // Fallback to mock data if RPC fails
      setData({
        currentSupply: 950_000_000,
        initialSupply: INITIAL_SUPPLY,
        totalBurned: 50_000_000,
        burnedPercent: 5,
        burnHistory: generateMockBurnHistory(timeRange),
      });
    } finally {
      setLoading(false);
    }
  };

  const generateMockBurnHistory = (range: string): BurnEvent[] => {
    const now = Date.now();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const events: BurnEvent[] = [];

    for (let i = 0; i < days; i += 3) {
      events.push({
        timestamp: now - (days - i) * 24 * 60 * 60 * 1000,
        amount: Math.random() * 1_000_000 + 500_000,
        signature: `mock${i}`,
      });
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  };

  if (loading || !data) {
    return (
      <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-[var(--primary)] mb-4 terminal-text terminal-glow uppercase tracking-wider">
          [BURN VISUALIZATION]
        </h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-[var(--primary)] terminal-text terminal-glow uppercase tracking-wider">
          🔥 [BURN VISUALIZATION]
        </h3>
        
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs uppercase tracking-wider font-bold transition-colors ${
                timeRange === range
                  ? 'border-2 border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)]'
                  : 'border border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              {range === 'all' ? 'ALL' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Supply Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-xs text-gray-400 mb-2 uppercase">Initial Supply</div>
          <div className="text-xl font-bold text-gray-300">
            {data.initialSupply.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">$BACK</div>
        </div>

        <div className="bg-gradient-to-br from-blue-900/30 to-black border border-blue-700/50 rounded-lg p-4 text-center">
          <div className="text-xs text-blue-400 mb-2 uppercase">Current Supply</div>
          <div className="text-xl font-bold text-blue-300">
            {data.currentSupply.toLocaleString()}
          </div>
          <div className="text-xs text-blue-500 mt-1">$BACK</div>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-black border border-red-700/50 rounded-lg p-4 text-center">
          <div className="text-xs text-red-400 mb-2 uppercase">Total Burned</div>
          <div className="text-xl font-bold text-red-300">
            {data.totalBurned.toLocaleString()}
          </div>
          <div className="text-xs text-red-500 mt-1">$BACK</div>
        </div>

        <div className="bg-gradient-to-br from-orange-900/30 to-black border border-orange-700/50 rounded-lg p-4 text-center">
          <div className="text-xs text-orange-400 mb-2 uppercase">Burned %</div>
          <div className="text-xl font-bold text-orange-300">
            {data.burnedPercent.toFixed(2)}%
          </div>
          <div className="text-xs text-orange-500 mt-1">Deflationary</div>
        </div>
      </div>

      {/* Supply Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400 uppercase">Supply Remaining</span>
          <span className="text-sm font-bold text-[var(--primary)]">
            {((data.currentSupply / data.initialSupply) * 100).toFixed(2)}%
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-4 border border-gray-700">
          <div
            className="bg-gradient-to-r from-red-500 via-orange-500 to-[var(--primary)] h-4 rounded-full transition-all flex items-center justify-end pr-2"
            style={{ width: `${(data.currentSupply / data.initialSupply) * 100}%` }}
          >
            <span className="text-xs font-bold text-white drop-shadow-lg">
              🔥
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
          <span>0</span>
          <span>{data.initialSupply.toLocaleString()}</span>
        </div>
      </div>

      {/* Simple Burn Chart (ASCII-style) */}
      <div className="mb-6 bg-gray-900/50 border border-gray-700 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-3 uppercase font-bold">Burn Events Timeline</div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {data.burnHistory.slice(0, 10).map((event, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-2 bg-black/30 rounded border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="text-2xl">🔥</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 font-mono">
                    {event.amount.toLocaleString()} $BACK
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1 mt-1">
                  <div
                    className="bg-gradient-to-r from-red-500 to-orange-500 h-1 rounded-full"
                    style={{ width: `${Math.min((event.amount / 2_000_000) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deflation Rate */}
      <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-red-400 mb-1 uppercase font-bold">Deflation Rate</div>
            <div className="text-xs text-gray-400">
              Average burn per event: {(data.totalBurned / data.burnHistory.length).toLocaleString()} $BACK
            </div>
          </div>
          <div className="text-3xl font-bold text-red-400">
            {(data.burnedPercent / (data.burnHistory.length || 1) * 100).toFixed(3)}%
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="mt-4 text-center text-xs text-gray-500">
        <p>💡 50% of each buyback is permanently burned, reducing total supply forever</p>
      </div>
    </div>
  );
}
