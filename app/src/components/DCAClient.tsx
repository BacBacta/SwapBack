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

      // Create plan on-chain
      await createPlan({
        tokenIn: new PublicKey(inputMint),
        tokenOut: new PublicKey(outputMint),
        amountPerSwap: Number.parseFloat(amountPerOrder),
        totalSwaps: Number.parseInt(totalOrders),
        intervalSeconds,
        minOutPerSwap: 0, // Can add slippage tolerance here
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
    <div className="space-y-6">
      {/* Network Status and Wallet Status Display */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {/* RPC Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${rpcError ? "bg-red-500" : "bg-green-500"} animate-pulse`}
            ></div>
            <span className="text-xs text-gray-400 terminal-text">
              NETWORK: {rpcError ? "DISCONNECTED" : "CONNECTED"}
            </span>
          </div>
          
          {/* Wallet Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                !walletReady 
                  ? "bg-yellow-500" 
                  : connected && publicKey 
                  ? "bg-green-500" 
                  : "bg-red-500"
              } animate-pulse`}
            ></div>
            <span className="text-xs text-gray-400 terminal-text">
              WALLET: {
                !walletReady 
                  ? "INITIALIZING..." 
                  : connected && publicKey 
                  ? "CONNECTED" 
                  : "DISCONNECTED"
              }
            </span>
          </div>
        </div>
        
        {rpcError && (
          <button
            onClick={testRpcConnection}
            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded terminal-text"
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
      <div className="flex border-b border-gray-700">
        {[
          { id: "create", label: "CREATE ORDER" },
          { id: "orders", label: "MY ORDERS" },
          { id: "simulator", label: "SIMULATOR" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-6 py-3 font-bold terminal-text transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="terminal-prefix">&gt;</span> [{tab.label}]
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
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <h4 className="text-blue-300 font-bold mb-2 terminal-text">
              <span className="terminal-prefix">&gt;</span> [ABOUT DCA]
            </h4>
            <p className="text-blue-200 text-sm mb-2">
              Dollar Cost Averaging (DCA) allows you to invest automatically
              at regular intervals, reducing the impact of market volatility.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-200">
              <div>
                <span className="font-bold">📊 Risk reduction:</span>{" "}
                Smooth your purchases over time
              </div>
              <div>
                <span className="font-bold">⏰ Automation:</span> No need for
                manual intervention
              </div>
              <div>
                <span className="font-bold">📈 Discipline:</span> Avoid emotional
                decisions
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 terminal-text">
              <span className="terminal-prefix">&gt;</span> [CREATE DCA ORDER]
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Input Token */}
              <div>
                <label className="block text-sm font-medium mb-2 terminal-text">
                  <span className="terminal-prefix">&gt;</span> INPUT TOKEN
                </label>
                <select
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-mono focus:border-[var(--primary)] focus:outline-none"
                >
                  <option value="SOL">SOL</option>
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>

              {/* Output Token */}
              <div>
                <label className="block text-sm font-medium mb-2 terminal-text">
                  <span className="terminal-prefix">&gt;</span> OUTPUT TOKEN
                </label>
                <select
                  value={outputToken}
                  onChange={(e) => setOutputToken(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-mono focus:border-[var(--primary)] focus:outline-none"
                >
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                  <option value="SOL">SOL</option>
                  <option value="BACK">BACK</option>
                </select>
              </div>

              {/* Amount per Order */}
              <div>
                <label className="block text-sm font-medium mb-2 terminal-text">
                  <span className="terminal-prefix">&gt;</span> AMOUNT PER
                  ORDER
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountPerOrder}
                    onChange={(e) => setAmountPerOrder(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-mono focus:border-[var(--primary)] focus:outline-none pr-16"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    {inputToken}
                  </span>
                </div>

                {/* Balance and Quick Actions */}
                {inputTokenData && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Balance: {inputTokenData.balance?.toFixed(4) || "0.0000"}{" "}
                      {inputToken}
                      {inputTokenData.usdValue && (
                        <span className="ml-2">
                          (~$
                          {(
                            inputTokenData.usdValue *
                            (Number.parseFloat(amountPerOrder) || 0)
                          ).toFixed(2)}
                          )
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const balance = inputTokenData.balance || 0;
                          setAmountPerOrder((balance * 0.5).toFixed(6));
                        }}
                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded terminal-text"
                      >
                        HALF
                      </button>
                      <button
                        onClick={() => {
                          const balance = inputTokenData.balance || 0;
                          setAmountPerOrder(balance.toFixed(6));
                        }}
                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded terminal-text"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium mb-2 terminal-text">
                  <span className="terminal-prefix">&gt;</span> FREQUENCY
                </label>
                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as typeof frequency)
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-mono focus:border-[var(--primary)] focus:outline-none"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Total Orders */}
              <div>
                <label className="block text-sm font-medium mb-2 terminal-text">
                  <span className="terminal-prefix">&gt;</span> TOTAL NUMBER
                  OF ORDERS
                </label>
                <input
                  type="number"
                  value={totalOrders}
                  onChange={(e) => setTotalOrders(e.target.value)}
                  placeholder="10"
                  min="1"
                  max="100"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-mono focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              {/* Total Investment Preview */}
              <div>
                <label className="block text-sm font-medium mb-2 terminal-text">
                  <span className="terminal-prefix">&gt;</span> TOTAL
                  INVESTMENT
                </label>
                <div className="px-4 py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-mono">
                  {totalInvestment.toFixed(2)} {inputToken}
                  {inputTokenData?.usdValue && (
                    <span className="ml-2 text-gray-400">
                      (~$
                      {(inputTokenData.usdValue * totalInvestment).toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Next Execution Preview */}
            <div className="mt-6 p-4 bg-gray-800/50 rounded">
              <p className="text-sm text-gray-300 terminal-text">
                <span className="terminal-prefix">&gt;</span> [NEXT
                EXECUTION]: {getNextExecutionTime(frequency)}
              </p>
              <p className="text-sm text-gray-300 terminal-text mt-1">
                <span className="terminal-prefix">&gt;</span> [TOTAL DURATION]:{" "}
                {getFrequencyDuration(frequency, Number.parseInt(totalOrders))}
              </p>
            </div>

            {/* Create Button */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleCreateDCA}
                disabled={isCreating || !walletReady || !connected}
                className="w-full px-6 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:bg-gray-600 text-black font-bold terminal-text rounded transition-colors"
              >
                {isCreating ? (
                  <span>CREATING...</span>
                ) : (
                  <span>
                    <span className="terminal-prefix">&gt;</span> [CREATE DCA
                    ORDER]
                  </span>
                )}
              </button>
              {!connected && walletReady && (
                <p className="text-red-400 text-sm mt-2 text-center">
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
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                  <h4 className="text-lg font-bold mb-4 terminal-text">
                    <span className="terminal-prefix">&gt;</span> [DCA
                    STATISTICS]
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[var(--primary)]">
                        {stats.totalPlans}
                      </p>
                      <p className="text-xs text-gray-400">TOTAL PLANS</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-400">
                        {stats.activePlans}
                      </p>
                      <p className="text-xs text-gray-400">ACTIVE PLANS</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-400">
                        {stats.pausedPlans}
                      </p>
                      <p className="text-xs text-gray-400">PAUSED PLANS</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-400">
                        {stats.completedPlans}
                      </p>
                      <p className="text-xs text-gray-400">COMPLETED PLANS</p>
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
