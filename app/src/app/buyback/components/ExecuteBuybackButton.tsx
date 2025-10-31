'use client';

import { useExecuteBuyback } from '@/hooks/useExecuteBuyback';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';
import { Zap } from 'lucide-react';

export default function ExecuteBuybackButton() {
  const wallet = useWallet();
  const { executeBuyback, isPending } = useExecuteBuyback();
  const [usdcAmount, setUsdcAmount] = useState(5); // Default 5 USDC

  const handleExecute = () => {
    executeBuyback({ usdcAmount, minBackAmount: 0 });
  };

  if (!wallet.connected) {
    return (
      <div className="bg-yellow-500/10 border-2 border-yellow-500/50 backdrop-blur-sm p-4">
        <p className="text-sm font-bold terminal-text uppercase tracking-wider text-yellow-400">
          🔌 Connect your wallet to execute buyback
        </p>
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-sm border-2 border-[var(--primary)]/30 p-6">
      <h3 className="text-lg font-bold terminal-text uppercase tracking-wider text-[var(--primary)] mb-4 flex items-center gap-2">
        <span>🔥</span>
        <span>Execute Buyback</span>
      </h3>

      <div className="mb-4">
        <label className="block text-sm font-bold terminal-text uppercase tracking-wider text-[var(--primary)]/70 mb-2">
          USDC Amount to Use
        </label>
        <input
          type="number"
          min="1"
          max="100"
          step="1"
          value={usdcAmount}
          onChange={(e) => setUsdcAmount(Number(e.target.value))}
          className="w-full px-4 py-3 bg-black/60 border-2 border-[var(--primary)]/30 text-[var(--primary)] font-mono focus:border-[var(--primary)] focus:outline-none transition-all"
          disabled={isPending}
        />
        <p className="text-xs text-[var(--primary)]/50 mt-2 uppercase tracking-wider">
          Recommended: 5-10 USDC per buyback
        </p>
      </div>

      <button
        onClick={handleExecute}
        disabled={isPending || usdcAmount < 1}
        className={`w-full py-4 font-bold terminal-text uppercase tracking-wider text-lg transition-all flex items-center justify-center gap-2 ${
          isPending || usdcAmount < 1
            ? 'bg-[var(--primary)]/20 border-2 border-[var(--primary)]/50 text-[var(--primary)]/50 cursor-not-allowed'
            : 'bg-gradient-to-r from-green-500 to-[var(--secondary)] text-black border-2 border-transparent hover:shadow-[0_0_30px_rgba(0,255,0,0.5)]'
        }`}
      >
        {isPending ? (
          <>
            <Zap className="w-5 h-5 animate-spin" />
            <span>Executing...</span>
          </>
        ) : (
          <>
            <span>🔥</span>
            <span>Execute Buyback ({usdcAmount} USDC)</span>
          </>
        )}
      </button>

      <p className="text-xs text-[var(--primary)]/50 mt-3 text-center uppercase tracking-wider">
        This will burn $BACK tokens and reduce total supply
      </p>
    </div>
  );
}
