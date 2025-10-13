"use client";

import { useState } from 'react';
import { SwapInterface } from './SwapInterface';
import { OperationHistory } from './OperationHistory';

export const SwapPage = () => {
  const [activeTab, setActiveTab] = useState<'swap' | 'history'>('swap');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Onglets */}
      <div className="flex justify-center">
        <div className="flex gap-1 bg-gradient-to-r from-white/5 to-white/3 rounded-xl p-1.5 backdrop-blur-md border border-white/10 shadow-lg">
          <button
            onClick={() => setActiveTab('swap')}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'swap'
                ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-lg shadow-[var(--primary)]/30 scale-105'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🔄</span>
              <span>Swap</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-lg shadow-[var(--primary)]/30 scale-105'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🔍</span>
              <span>History</span>
            </span>
          </button>
        </div>
      </div>

      {/* Contenu */}
      {activeTab === 'swap' ? (
        <SwapInterface />
      ) : (
        <OperationHistory />
      )}
    </div>
  );
};
