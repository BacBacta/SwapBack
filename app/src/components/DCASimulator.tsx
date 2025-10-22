"use client";

import { useState } from "react";

interface SimulationResult {
  totalInvested: number;
  averagePrice: number;
  totalTokens: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

export const DCASimulator = () => {
  const [amount, setAmount] = useState("100");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
    "weekly"
  );
  const [duration, setDuration] = useState("12"); // in months
  const [initialPrice, setInitialPrice] = useState("50");
  const [volatility, setVolatility] = useState("20"); // percent

  // Calculate simulation
  const calculateSimulation = (): SimulationResult => {
    const amountNum = Number.parseFloat(amount || "0");
    const durationMonths = Number.parseFloat(duration || "0");
    const initPrice = Number.parseFloat(initialPrice || "0");
    const vol = Number.parseFloat(volatility || "0") / 100;

    // Calculate number of purchases
    let purchases = 0;
    if (frequency === "daily") purchases = durationMonths * 30;
    else if (frequency === "weekly") purchases = durationMonths * 4;
    else purchases = durationMonths;

    const totalInvested = amountNum * purchases;

    // Simulate price movements with volatility
    let totalTokens = 0;
    let totalCost = 0;

    for (let i = 0; i < purchases; i++) {
      // Generate random price with trend and volatility
      const trend = 1 + (i / purchases) * 0.2; // 20% upward trend over time
      const randomFactor = 1 + (Math.random() - 0.5) * 2 * vol;
      const price = initPrice * trend * randomFactor;

      const tokens = amountNum / price;
      totalTokens += tokens;
      totalCost += amountNum;
    }

    const averagePrice = totalCost / totalTokens;

    // Current price (assume final price from simulation)
    const finalTrend = 1.2; // 20% up from initial
    const currentPrice = initPrice * finalTrend;

    const currentValue = totalTokens * currentPrice;
    const profitLoss = currentValue - totalInvested;
    const profitLossPercent = (profitLoss / totalInvested) * 100;

    return {
      totalInvested,
      averagePrice,
      totalTokens,
      currentValue,
      profitLoss,
      profitLossPercent,
    };
  };

  const result = calculateSimulation();

  return (
    <div className="swap-card">
      <h3 className="text-xl font-bold terminal-text mb-6">
        <span className="terminal-prefix">&gt;</span> [DCA_SIMULATOR]
      </h3>

      <div className="space-y-6">
        {/* Input Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Amount per purchase */}
          <div>
            <label className="block text-sm terminal-text mb-2">
              <span className="terminal-prefix">&gt;</span> AMOUNT_PER_PURCHASE
              ($)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field w-full"
              placeholder="100"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm terminal-text mb-2">
              <span className="terminal-prefix">&gt;</span> FREQUENCY
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="input-field w-full"
            >
              <option value="daily">[DAILY]</option>
              <option value="weekly">[WEEKLY]</option>
              <option value="monthly">[MONTHLY]</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm terminal-text mb-2">
              <span className="terminal-prefix">&gt;</span> DURATION (MONTHS)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="input-field w-full"
              placeholder="12"
            />
          </div>

          {/* Initial Price */}
          <div>
            <label className="block text-sm terminal-text mb-2">
              <span className="terminal-prefix">&gt;</span> INITIAL_PRICE ($)
            </label>
            <input
              type="number"
              value={initialPrice}
              onChange={(e) => setInitialPrice(e.target.value)}
              className="input-field w-full"
              placeholder="50"
            />
          </div>

          {/* Volatility */}
          <div className="md:col-span-2">
            <label className="block text-sm terminal-text mb-2">
              <span className="terminal-prefix">&gt;</span> VOLATILITY (%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={volatility}
              onChange={(e) => setVolatility(e.target.value)}
              className="w-full"
            />
            <div className="text-center text-sm terminal-text opacity-70 mt-1">
              {volatility}%
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="stat-card p-6 bg-[var(--primary)]/10 border-2 border-[var(--primary)]">
          <div className="text-lg terminal-text mb-4 font-bold">
            <span className="terminal-prefix">&gt;</span> [SIMULATION_RESULTS]
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Invested */}
            <div className="stat-card p-4">
              <div className="text-xs terminal-text opacity-70 mb-2">
                TOTAL_INVESTED:
              </div>
              <div className="text-xl font-bold text-[var(--primary)] terminal-text">
                ${result.totalInvested.toFixed(2)}
              </div>
            </div>

            {/* Average Price */}
            <div className="stat-card p-4">
              <div className="text-xs terminal-text opacity-70 mb-2">
                AVERAGE_PRICE:
              </div>
              <div className="text-xl font-bold text-[var(--primary)] terminal-text">
                ${result.averagePrice.toFixed(2)}
              </div>
            </div>

            {/* Total Tokens */}
            <div className="stat-card p-4">
              <div className="text-xs terminal-text opacity-70 mb-2">
                TOTAL_TOKENS:
              </div>
              <div className="text-xl font-bold text-[var(--primary)] terminal-text">
                {result.totalTokens.toFixed(4)}
              </div>
            </div>

            {/* Current Value */}
            <div className="stat-card p-4">
              <div className="text-xs terminal-text opacity-70 mb-2">
                CURRENT_VALUE:
              </div>
              <div className="text-xl font-bold text-[var(--primary)] terminal-text">
                ${result.currentValue.toFixed(2)}
              </div>
            </div>

            {/* Profit/Loss */}
            <div className="stat-card p-4 md:col-span-2 border-2 border-[var(--primary)]">
              <div className="text-xs terminal-text opacity-70 mb-2">
                PROFIT_/_LOSS:
              </div>
              <div className="flex items-center justify-between">
                <div
                  className={`text-2xl font-bold terminal-text ${
                    result.profitLoss >= 0
                      ? "text-[var(--primary)]"
                      : "text-red-500"
                  }`}
                >
                  {result.profitLoss >= 0 ? "+" : ""}$
                  {result.profitLoss.toFixed(2)}
                </div>
                <div
                  className={`text-xl font-bold terminal-text ${
                    result.profitLossPercent >= 0
                      ? "text-[var(--primary)]"
                      : "text-red-500"
                  }`}
                >
                  {result.profitLossPercent >= 0 ? "+" : ""}
                  {result.profitLossPercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="stat-card p-4 bg-black/30 border-2 border-[var(--primary)]/30">
          <div className="text-xs terminal-text opacity-70 space-y-2">
            <div>
              <span className="terminal-prefix">&gt;</span> This is a simulated
              projection based on random price movements
            </div>
            <div>
              <span className="terminal-prefix">&gt;</span> Actual results may
              vary significantly
            </div>
            <div>
              <span className="terminal-prefix">&gt;</span> Past performance
              does not guarantee future results
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
