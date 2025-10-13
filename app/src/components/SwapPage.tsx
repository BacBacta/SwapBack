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
        <div className="flex gap-1 bg-white/5 rounded-lg p-1 backdrop-blur-sm border border-white/10">
          <button
            onClick={() => setActiveTab('swap')}
            className={`px-6 py-3 rounded-md font-semibold transition-all ${
              activeTab === 'swap'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔄 Swap
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 rounded-md font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔍 Historique
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
