"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useTokenData } from "../hooks/useTokenData";
import { DCASimulator } from "./DCASimulator";
import { DCAOrderCard } from "./DCAOrderCard";
import {
  useDcaPlans,
  useCreateDcaPlan,
  useReadyDcaPlans,
  useDcaStats,
} from "../hooks/useDCA";
import { frequencyToSeconds, type DCAFrequency } from "../lib/dca";

// Lazy load TOKEN_MINTS to avoid module-level env access
let _tokenMints: Record<string, string> | null = null;
function getTokenMints(): Record<string, string> {
  if (!_tokenMints) {
    _tokenMints = {
      SOL: "So11111111111111111111111111111111111111112",
      USDC:
        process.env.NEXT_PUBLIC_USDC_MINT ||
        "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
      USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      BACK:
        process.env.NEXT_PUBLIC_BACK_MINT ||
        "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux",
    };
  }
  return _tokenMints;
}

export const DCAClient = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [activeTab, setActiveTab] = useState<"create" | "orders" | "simulator">(
    "create"
  );
  const [walletReady, setWalletReady] = useState(false);

  // Create DCA Form States
  const [inputToken, setInputToken] = useState("SOL");
  const [outputToken, setOutputToken] = useState("USDC");
  const [amountPerOrder, setAmountPerOrder] = useState("");
  const [frequency, setFrequency] = useState<DCAFrequency>("daily");
  const [totalOrders, setTotalOrders] = useState("10");
  const [rpcError, setRpcError] = useState<string | null>(null);

  // Check that wallet is fully initialized
  useEffect(() => {
    // With autoConnect enabled, reduce initialization delay
    const timer = setTimeout(() => {
      setWalletReady(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [connected, publicKey]);

  // On-chain DCA hooks
  const { data: dcaPlans = [], isLoading: plansLoading } = useDcaPlans();
  const { createPlan, isCreating } = useCreateDcaPlan();
  const { readyPlans } = useReadyDcaPlans();
  const stats = useDcaStats();

  // Token Data - Convert symbol to mint address
  const inputTokenMint = getTokenMints()[inputToken] || getTokenMints().SOL;
  const inputTokenData = useTokenData(inputTokenMint);

  // Helper functions
  const getFrequencyDuration = (freq: DCAFrequency, count = 1): string => {
    const map: Record<DCAFrequency, string> = {
      hourly: `${count} HOUR${count > 1 ? "S" : ""}`,
      daily: `${count} DAY${count > 1 ? "S" : ""}`,
      weekly: `${count} WEEK${count > 1 ? "S" : ""}`,
      monthly: `${count} MONTH${count > 1 ? "S" : ""}`,
    };
    return map[freq] || `${count} DAYS`;
  };

  const getNextExecutionTime = (freq: DCAFrequency): string => {
    const map: Record<DCAFrequency, string> = {
      hourly: "~1 HOUR",
      daily: "~1 DAY",
      weekly: "~7 DAYS",
      monthly: "~30 DAYS",
    };
    return map[freq] || "~1 DAY";
  };

  // Test RPC connectivity
  const testRpcConnection = async (): Promise<boolean> => {
    try {
      await connection.getLatestBlockhash();
      setRpcError(null);
      return true;
    } catch (error: unknown) {
      console.error("RPC Connection test failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("403") || errorMessage.includes("forbidden")) {
        setRpcError(
          "RPC access denied (403). Check your network configuration."
        );
      } else if (errorMessage.includes("429")) {
        setRpcError("RPC rate limit reached. Try again later.");
      } else {
        setRpcError("RPC connection error. Check your network.");
      }
      return false;
    }
  };

  // Create DCA Plan on-chain
  const handleCreateDCA = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent any default behavior
    e?.preventDefault();
    e?.stopPropagation();

    console.log("🔵 handleCreateDCA called", {
      walletReady,
      connected,
      publicKey: publicKey?.toBase58(),
    });

    if (!walletReady) {
      alert("⏳ Wallet initialization in progress... Please wait a moment.");
      return;
    }

    if (!connected || !publicKey) {
      alert("❌ Please connect your wallet to create a DCA order");
      return;
    }

    if (!amountPerOrder || Number.parseFloat(amountPerOrder) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!totalOrders || Number.parseInt(totalOrders) <= 0) {
      alert("Please enter a valid number of orders");
      return;
    }

    setRpcError(null);

    try {
      // Test RPC connection before proceeding
      const rpcOk = await testRpcConnection();
      if (!rpcOk) {
        alert("Network connection issue. Please try again.");
        return;
      }

      const inputMint = getTokenMints()[inputToken];
      const outputMint = getTokenMints()[outputToken];

      if (!inputMint || !outputMint) {
        throw new Error("Token mint address not found");
      }

      // Convert frequency to seconds
      const intervalSeconds = frequencyToSeconds(frequency);

      // Calculate minimum output with 1% slippage tolerance
      // This ensures we always have a positive value for minOutPerSwap
      const estimatedOutput = Number.parseFloat(amountPerOrder) * 0.99;
      const minOut = Math.max(1, Math.floor(estimatedOutput * 1000000)); // At least 1 lamport

      console.log('📊 DCA Plan Parameters:', {
        tokenIn: inputMint,
        tokenOut: outputMint,
        amountPerSwap: Number.parseFloat(amountPerOrder),
        totalSwaps: Number.parseInt(totalOrders),
        intervalSeconds,
        minOutPerSwap: minOut,
      });

      // Create plan on-chain
      await createPlan({
        tokenIn: new PublicKey(inputMint),
        tokenOut: new PublicKey(outputMint),
        amountPerSwap: Number.parseFloat(amountPerOrder),
        totalSwaps: Number.parseInt(totalOrders),
        intervalSeconds,
        minOutPerSwap: minOut, // Minimum output with slippage protection
        expiresAt: 0, // No expiration
      });

      // Reset form on success
      setAmountPerOrder("");
      setTotalOrders("10");
      setActiveTab("orders");
    } catch (error) {
      console.error("❌ DCA creation error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`❌ Error creating DCA plan:\n\n${errorMessage}`);
      setRpcError(errorMessage);
    }
  };

  // Calculate total investment
  const totalInvestment =
    Number.parseFloat(amountPerOrder || "0") *
    Number.parseInt(totalOrders || "0");

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Network Status and Wallet Status Display */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* RPC Status */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={`w-2 h-2 rounded-full ${rpcError ? "bg-red-500" : "bg-green-500"} animate-pulse`}
            ></div>
            <span className="text-[10px] sm:text-xs text-gray-400 terminal-text">
              NET: {rpcError ? "OFF" : "ON"}
            </span>
          </div>
          
          {/* Wallet Status */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                !walletReady 
                  ? "bg-yellow-500" 
                  : connected && publicKey 
                  ? "bg-green-500" 
                  : "bg-red-500"
              } animate-pulse`}
            ></div>
            <span className="text-[10px] sm:text-xs text-gray-400 terminal-text">
              WALLET: {
                !walletReady 
                  ? "INIT..." 
                  : connected && publicKey 
                  ? "ON" 
                  : "OFF"
              }
            </span>
          </div>
        </div>
        
        {rpcError && (
          <button
            onClick={testRpcConnection}
            className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded terminal-text"
          >
            RETRY
          </button>
        )}
      </div>

      {rpcError && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-400 mr-2">⚠️</span>
            <p className="text-red-300 text-sm terminal-text">
              <span className="terminal-prefix">&gt;</span> [RPC ERROR]:{" "}
              {rpcError}
            </p>
          </div>
          <p className="text-red-300 text-xs mt-2">
            Try changing RPC network or retry later.
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        {[
          { id: "create", label: "CREATE", labelFull: "CREATE ORDER" },
          { id: "orders", label: "ORDERS", labelFull: "MY ORDERS" },
          { id: "simulator", label: "SIM", labelFull: "SIMULATOR" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-bold terminal-text transition-all border-2 rounded text-xs sm:text-sm whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-[var(--primary)] border-[var(--primary)] text-black hover:bg-[var(--primary-hover)]"
                : "bg-transparent border-transparent text-[var(--primary)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/30"
            }`}
          >
            <span className="terminal-prefix hidden sm:inline">&gt;</span> [<span className="sm:hidden">{tab.label}</span><span className="hidden sm:inline">{tab.labelFull}</span>]
          </button>
        ))}
      </div>

      {/* Wallet Status Indicator */}
      {!walletReady && (
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-3"></div>
            <p className="text-yellow-300 text-sm terminal-text">
              <span className="terminal-prefix">&gt;</span> [WALLET INITIALIZATION IN PROGRESS...]
            </p>
          </div>
        </div>
      )}

      {/* Create DCA Tab */}
      {activeTab === "create" && (
        <div className="space-y-6">
          {/* DCA Information */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 sm:p-4">
            <h4 className="text-blue-300 font-bold mb-1 sm:mb-2 terminal-text text-sm sm:text-base">
              <span className="terminal-prefix">&gt;</span> [ABOUT DCA]
            </h4>
            <p className="text-blue-200 text-xs sm:text-sm mb-2">
              Dollar Cost Averaging (DCA) allows you to invest automatically
              at regular intervals, reducing the impact of market volatility.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-[10px] sm:text-xs text-blue-200">
              <div>
                <span className="font-bold">📊 Risk reduction:</span>{" "}
                <span className="hidden sm:inline">Smooth your purchases over time</span>
              </div>
              <div>
                <span className="font-bold">⏰ Automation:</span>{" "}
                <span className="hidden sm:inline">No need for manual intervention</span>
              </div>
              <div>
                <span className="font-bold">📈 Discipline:</span>{" "}
                <span className="hidden sm:inline">Avoid emotional decisions</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 terminal-text">
              <span className="terminal-prefix">&gt;</span> [CREATE DCA ORDER]
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              {/* Row 1: Input/Output Token */}
              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                {/* Input Token */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 terminal-text">
                    <span className="terminal-prefix hidden sm:inline">&gt;</span> INPUT
                  </label>
                  <select
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-sans text-sm focus:border-[var(--primary)] focus:outline-none"
                  >
                    <option value="SOL">SOL</option>
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                  </select>
                </div>

                {/* Output Token */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 terminal-text">
                    <span className="terminal-prefix hidden sm:inline">&gt;</span> OUTPUT
                  </label>
                  <select
                    value={outputToken}
                    onChange={(e) => setOutputToken(e.target.value)}
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-sans text-sm focus:border-[var(--primary)] focus:outline-none"
                  >
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                    <option value="SOL">SOL</option>
                    <option value="BACK">BACK</option>
                  </select>
                </div>
              </div>

              {/* Amount per Order */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 terminal-text">
                  <span className="terminal-prefix hidden sm:inline">&gt;</span> AMOUNT PER ORDER
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountPerOrder}
                    onChange={(e) => setAmountPerOrder(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-sans text-sm focus:border-[var(--primary)] focus:outline-none pr-12 sm:pr-16"
                  />
                  <span className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs sm:text-sm">
                    {inputToken}
                  </span>
                </div>

                {/* Balance and Quick Actions */}
                {inputTokenData && (
                  <div className="mt-1.5 sm:mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                    <p className="text-[10px] sm:text-xs text-gray-400">
                      Balance: {inputTokenData.balance?.toFixed(4) || "0.0000"}{" "}
                      {inputToken}
                    </p>
                    <div className="flex gap-1.5 sm:gap-2">
                      <button
                        onClick={() => {
                          const balance = inputTokenData.balance || 0;
                          setAmountPerOrder((balance * 0.5).toFixed(6));
                        }}
                        className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-700 hover:bg-gray-600 rounded terminal-text"
                      >
                        HALF
                      </button>
                      <button
                        onClick={() => {
                          const balance = inputTokenData.balance || 0;
                          setAmountPerOrder(balance.toFixed(6));
                        }}
                        className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-700 hover:bg-gray-600 rounded terminal-text"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 2: Frequency and Total Orders */}
              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                {/* Frequency */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 terminal-text">
                    <span className="terminal-prefix hidden sm:inline">&gt;</span> FREQUENCY
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as typeof frequency)
                    }
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-sans text-sm focus:border-[var(--primary)] focus:outline-none"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Total Orders */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 terminal-text">
                    <span className="terminal-prefix hidden sm:inline">&gt;</span> # ORDERS
                  </label>
                  <input
                    type="number"
                    value={totalOrders}
                    onChange={(e) => setTotalOrders(e.target.value)}
                    placeholder="10"
                    min="1"
                    max="100"
                    className="w-full px-2 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-sans text-sm focus:border-[var(--primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Investment Preview */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 terminal-text">
                  <span className="terminal-prefix hidden sm:inline">&gt;</span> TOTAL INVESTMENT
                </label>
                <div className="px-2 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-mono text-sm">
                  {totalInvestment.toFixed(2)} {inputToken}
                  {inputTokenData?.usdValue && (
                    <span className="ml-2 text-gray-400 text-xs sm:text-sm">
                      (~${(inputTokenData.usdValue * totalInvestment).toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Next Execution Preview */}
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-800/50 rounded">
              <p className="text-xs sm:text-sm text-gray-300 terminal-text">
                <span className="terminal-prefix">&gt;</span> [NEXT]: {getNextExecutionTime(frequency)}
              </p>
              <p className="text-xs sm:text-sm text-gray-300 terminal-text mt-1">
                <span className="terminal-prefix">&gt;</span> [DURATION]:{" "}
                {getFrequencyDuration(frequency, Number.parseInt(totalOrders))}
              </p>
            </div>

            {/* Create Button */}
            <div className="mt-4 sm:mt-6">
              <button
                type="button"
                onClick={handleCreateDCA}
                disabled={isCreating || !walletReady || !connected}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:bg-gray-600 text-black font-bold terminal-text rounded transition-colors text-sm sm:text-base"
              >
                {isCreating ? (
                  <span>CREATING...</span>
                ) : (
                  <span>
                    <span className="terminal-prefix">&gt;</span> [CREATE DCA ORDER]
                  </span>
                )}
              </button>
              {!connected && walletReady && (
                <p className="text-red-400 text-xs sm:text-sm mt-2 text-center">
                  Please connect your wallet to create a DCA order
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Ready Plans Notification */}
          {readyPlans.length > 0 && (
            <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⏰</span>
                <div>
                  <p className="font-bold text-blue-300">
                    {readyPlans.length} plan{readyPlans.length > 1 ? "s" : ""}{" "}
                    ready for execution!
                  </p>
                  <p className="text-sm text-blue-200">
                    Check your plans below to execute them.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!connected && walletReady ? (
            <div className="text-center py-12">
              <p className="text-gray-400 terminal-text mb-4">
                <span className="terminal-prefix">&gt;</span> [CONNECT YOUR
                WALLET TO VIEW YOUR DCA ORDERS]
              </p>
            </div>
          ) : plansLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-400 terminal-text mb-4">
                <span className="terminal-prefix">&gt;</span> [LOADING DCA
                PLANS...]
              </p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto mt-4"></div>
            </div>
          ) : dcaPlans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 terminal-text mb-4">
                <span className="terminal-prefix">&gt;</span> [NO DCA ORDERS
                FOUND]
              </p>
              <p className="text-sm text-gray-500">
                Create your first DCA order in the "CREATE ORDER" tab
              </p>
            </div>
          ) : (
            <>
              {/* DCA Statistics Overview */}
              {stats && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 sm:p-6">
                  <h4 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 terminal-text">
                    <span className="terminal-prefix">&gt;</span> [DCA STATISTICS]
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="text-center">
                      <p className="text-xl sm:text-2xl font-bold text-[var(--primary)]">
                        {stats.totalPlans}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400">TOTAL</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl sm:text-2xl font-bold text-green-400">
                        {stats.activePlans}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400">ACTIVE</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl sm:text-2xl font-bold text-yellow-400">
                        {stats.pausedPlans}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400">PAUSED</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl sm:text-2xl font-bold text-blue-400">
                        {stats.completedPlans}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400">DONE</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Plans List */}
              <div className="space-y-4">
                {dcaPlans.map((plan) => (
                  <DCAOrderCard key={plan.planPda.toBase58()} plan={plan} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Simulator Tab */}
      {activeTab === "simulator" && <DCASimulator />}
    </div>
  );
};

// Default export for dynamic imports (Next.js best practice)
export default DCAClient;
