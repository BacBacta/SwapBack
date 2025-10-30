"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTokenData } from "../hooks/useTokenData";
import { DCASimulator } from "./DCASimulator";
import { addDCATransaction } from "./TransactionHistory";

interface DCAOrder {
  id: string;
  inputToken: string;
  outputToken: string;
  amountPerOrder: number;
  frequency: "hourly" | "daily" | "weekly" | "monthly";
  totalOrders: number;
  executedOrders: number;
  nextExecution: Date;
  status: "active" | "paused" | "completed" | "cancelled";
  createdAt: Date;
  totalInvested: number;
  averagePrice: number;
}

interface SerializedDCAOrder extends Omit<DCAOrder, "nextExecution" | "createdAt"> {
  nextExecution: string;
  createdAt: string;
}

const isSerializedDCAOrder = (value: unknown): value is SerializedDCAOrder => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SerializedDCAOrder>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.inputToken === "string" &&
    typeof candidate.outputToken === "string" &&
    typeof candidate.amountPerOrder === "number" &&
    typeof candidate.frequency === "string" &&
    typeof candidate.totalOrders === "number" &&
    typeof candidate.executedOrders === "number" &&
    typeof candidate.nextExecution === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.totalInvested === "number" &&
    typeof candidate.averagePrice === "number"
  );
};

// Token symbol to mint address mapping - Utilise les variables d'environnement
const TOKEN_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: process.env.NEXT_PUBLIC_USDC_MINT || "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BACK: process.env.NEXT_PUBLIC_BACK_MINT || "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux",
};

export const DCA = () => {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<"create" | "orders" | "simulator">(
    "create"
  );

  // Create DCA Form States
  const [inputToken, setInputToken] = useState("SOL");
  const [outputToken, setOutputToken] = useState("USDC");
  const [amountPerOrder, setAmountPerOrder] = useState("");
  const [frequency, setFrequency] = useState<
    "hourly" | "daily" | "weekly" | "monthly"
  >("daily");
  const [totalOrders, setTotalOrders] = useState("10");
  const [loading, setLoading] = useState(false);

  // DCA Orders State
  const [dcaOrders, setDcaOrders] = useState<DCAOrder[]>([]);

  // Token Data - Convert symbol to mint address
  const inputTokenMint = TOKEN_MINTS[inputToken] || TOKEN_MINTS.SOL;
  const inputTokenData = useTokenData(inputTokenMint);

  // Helper functions
  const getFrequencyDuration = (freq: string, count = 1): string => {
    const map: Record<string, string> = {
      hourly: `${count} HOUR${count > 1 ? "S" : ""}`,
      daily: `${count} DAY${count > 1 ? "S" : ""}`,
      weekly: `${count} WEEK${count > 1 ? "S" : ""}`,
      monthly: `${count} MONTH${count > 1 ? "S" : ""}`,
    };
    return map[freq] || `${count} DAYS`;
  };

  const getNextExecutionTime = (freq: string): string => {
    const map: Record<string, string> = {
      hourly: "~1 HOUR",
      daily: "~1 DAY",
      weekly: "~7 DAYS",
      monthly: "~30 DAYS",
    };
    return map[freq] || "~1 DAY";
  };

  // Load DCA orders from localStorage
  useEffect(() => {
    if (connected && publicKey) {
      const storageKey = `swapback_dca_${publicKey.toString()}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed: unknown = JSON.parse(stored);

          if (Array.isArray(parsed)) {
            const orders = parsed
              .filter(isSerializedDCAOrder)
              .map((order) => ({
                ...order,
                nextExecution: new Date(order.nextExecution),
                createdAt: new Date(order.createdAt),
              }));

            setDcaOrders(orders);
          }
        } catch (e) {
          console.error("Error loading DCA orders:", e);
        }
      }
    }
  }, [connected, publicKey]);

  // Calculate next execution time
  const calculateNextExecution = (freq: string): Date => {
    const now = new Date();
    switch (freq) {
      case "hourly":
        return new Date(now.getTime() + 60 * 60 * 1000);
      case "daily":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case "weekly":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case "monthly":
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  };

  // Calculate total investment
  const totalInvestment =
    Number.parseFloat(amountPerOrder || "0") *
    Number.parseInt(totalOrders || "0");

  // Handle Create DCA
  const handleCreateDCA = async () => {
    console.log("🎯 handleCreateDCA called", {
      connected,
      publicKey: publicKey?.toString(),
      amountPerOrder,
      totalOrders,
    });

    if (!connected || !publicKey) {
      console.warn("❌ Wallet not connected");
      alert("⚠️ Veuillez connecter votre wallet");
      return;
    }

    if (!amountPerOrder || Number.parseFloat(amountPerOrder) <= 0) {
      console.warn("❌ Invalid amount:", amountPerOrder);
      alert("⚠️ Veuillez entrer un montant valide");
      return;
    }

    if (!totalOrders || Number.parseInt(totalOrders) <= 0) {
      console.warn("❌ Invalid total orders:", totalOrders);
      alert("⚠️ Veuillez entrer un nombre d'ordres valide");
      return;
    }

    setLoading(true);
    console.log("✅ All validations passed, creating DCA order...");
    try {
      console.log("🔄 Creating DCA order with params:", {
        inputToken,
        outputToken,
        amountPerOrder,
        frequency,
        totalOrders,
      });

      // Simulate DCA creation (replace with actual on-chain transaction)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const newOrder: DCAOrder = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        inputToken,
        outputToken,
        amountPerOrder: Number.parseFloat(amountPerOrder),
        frequency,
        totalOrders: Number.parseInt(totalOrders),
        executedOrders: 0,
        nextExecution: calculateNextExecution(frequency),
        status: "active",
        createdAt: new Date(),
        totalInvested: 0,
        averagePrice: 0,
      };

      const updatedOrders = [newOrder, ...dcaOrders];
      setDcaOrders(updatedOrders);

      // Save to localStorage
      const storageKey = `swapback_dca_${publicKey.toString()}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedOrders));

      // Générer une signature simulée pour la création du plan DCA
      const mockSignature = `sim${Date.now()}${Math.random().toString(36).substring(2, 15)}`;

      // Calculer l'intervalle en jours
      const intervalInDays =
        frequency === "hourly"
          ? 1 / 24
          : frequency === "daily"
            ? 1
            : frequency === "weekly"
              ? 7
              : 30;

      // Enregistrer la création du plan DCA dans l'historique
      addDCATransaction(publicKey.toString(), {
        signature: mockSignature,
        inputToken,
        outputToken,
        inputAmount: Number.parseFloat(amountPerOrder),
        outputAmount: 0, // Pas encore exécuté
        dcaInterval: intervalInDays,
        dcaSwapsExecuted: 0,
        dcaTotalSwaps: Number.parseInt(totalOrders),
        status: "success",
      });

      const executionTime = getNextExecutionTime(frequency).toLowerCase();
      alert(
        `✅ DCA Order Created!\n\n` +
          `📊 ${amountPerOrder} ${inputToken} → ${outputToken}\n` +
          `🔄 Frequency: ${frequency}\n` +
          `📈 Total Orders: ${totalOrders}\n` +
          `💰 Total Investment: ${totalInvestment} ${inputToken}\n\n` +
          `First execution in ${executionTime}`
      );

      // Reset form
      setAmountPerOrder("");
      setTotalOrders("10");
      setActiveTab("orders");
    } catch (error) {
      console.error("❌ DCA creation error:", error);
      alert(
        `❌ DCA creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Pause/Resume DCA
  const handleToggleDCA = (orderId: string) => {
    const updatedOrders = dcaOrders.map((order) => {
      if (order.id === orderId) {
        return {
          ...order,
          status: (order.status === "active"
            ? "paused"
            : "active") as DCAOrder["status"],
        };
      }
      return order;
    });
    setDcaOrders(updatedOrders);

    // Save to localStorage
    if (publicKey) {
      const storageKey = `swapback_dca_${publicKey.toString()}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedOrders));
    }
  };

  // Handle Cancel DCA
  const handleCancelDCA = (orderId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler cet ordre DCA ?")) return;

    const updatedOrders = dcaOrders.map((order) => {
      if (order.id === orderId) {
        return { ...order, status: "cancelled" as const };
      }
      return order;
    });
    setDcaOrders(updatedOrders);

    // Save to localStorage
    if (publicKey) {
      const storageKey = `swapback_dca_${publicKey.toString()}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedOrders));
    }
  };

  // Format frequency for display
  const formatFrequency = (freq: string) => {
    const map: Record<string, string> = {
      hourly: "EVERY_HOUR",
      daily: "EVERY_DAY",
      weekly: "EVERY_WEEK",
      monthly: "EVERY_MONTH",
    };
    return map[freq] || freq.toUpperCase();
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-[var(--primary)] border-[var(--primary)]";
      case "paused":
        return "text-yellow-500 border-yellow-500";
      case "completed":
        return "text-blue-500 border-blue-500";
      case "cancelled":
        return "text-red-500 border-red-500";
      default:
        return "text-gray-500 border-gray-500";
    }
  };

  if (!connected) {
    return (
      <div className="swap-card text-center py-16">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-transparent border-2 border-[var(--primary)] mx-auto mb-6">
          <span className="text-5xl">👛</span>
        </div>
        <h3 className="text-2xl font-bold mb-3 terminal-text">
          <span className="terminal-prefix">&gt;</span> WALLET_NOT_CONNECTED
        </h3>
        <p className="terminal-text opacity-70 text-lg mb-6">
          Connect your wallet to use DCA feature
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="swap-card">
        <div className="mb-6">
          <h2 className="section-title mb-3">
            <span className="terminal-prefix">&gt;</span> DOLLAR_COST_AVERAGING
          </h2>
          <p className="body-regular terminal-text">
            <span className="terminal-prefix">&gt;</span>{" "}
            AUTOMATE_YOUR_INVESTMENTS | BUY_REGULARLY_AT_OPTIMAL_PRICES
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card p-4 border-2 border-[var(--primary)]">
            <div className="text-xs terminal-text opacity-70 mb-2">
              <span className="terminal-prefix">&gt;</span> ACTIVE_ORDERS
            </div>
            <div className="text-2xl font-bold text-[var(--primary)] terminal-text">
              {dcaOrders.filter((o) => o.status === "active").length}
            </div>
          </div>
          <div className="stat-card p-4 border-2 border-[var(--primary)]">
            <div className="text-xs terminal-text opacity-70 mb-2">
              <span className="terminal-prefix">&gt;</span> TOTAL_INVESTED
            </div>
            <div className="text-2xl font-bold text-[var(--primary)] terminal-text">
              $
              {dcaOrders
                .reduce((sum, o) => sum + o.totalInvested, 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="stat-card p-4 border-2 border-[var(--primary)]">
            <div className="text-xs terminal-text opacity-70 mb-2">
              <span className="terminal-prefix">&gt;</span> COMPLETED_ORDERS
            </div>
            <div className="text-2xl font-bold text-[var(--primary)] terminal-text">
              {dcaOrders.filter((o) => o.status === "completed").length}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-black/30 border-2 border-[var(--primary)]">
        <button
          onClick={() => setActiveTab("create")}
          className={`flex-1 px-6 py-3 font-bold transition-all terminal-text ${
            activeTab === "create"
              ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]"
              : "border-2 border-transparent hover:border-[var(--primary)]/50"
          }`}
        >
          <span className="terminal-prefix">&gt;</span>[CREATE_DCA]
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 px-6 py-3 font-bold transition-all terminal-text ${
            activeTab === "orders"
              ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]"
              : "border-2 border-transparent hover:border-[var(--primary)]/50"
          }`}
        >
          <span className="terminal-prefix">&gt;</span>[MY_ORDERS]
          {dcaOrders.some((o) => o.status === "active") && (
            <span className="ml-2 px-2 py-1 bg-[var(--primary)] text-black text-xs">
              {dcaOrders.filter((o) => o.status === "active").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex-1 px-6 py-3 font-bold transition-all terminal-text ${
            activeTab === "simulator"
              ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]"
              : "border-2 border-transparent hover:border-[var(--primary)]/50"
          }`}
        >
          <span className="terminal-prefix">&gt;</span>[SIMULATOR]
        </button>
      </div>

      {/* Create DCA Tab */}
      {activeTab === "create" && (
        <div className="swap-card">
          <h3 className="text-xl font-bold terminal-text mb-6">
            <span className="terminal-prefix">&gt;</span> [CREATE_NEW_DCA_ORDER]
          </h3>

          <div className="space-y-6">
            {/* Token Pair Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm terminal-text mb-2">
                  <span className="terminal-prefix">&gt;</span> INPUT_TOKEN
                </label>
                <select
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  disabled={loading}
                  className="input-field w-full"
                >
                  <option value="SOL">[SOL]</option>
                  <option value="USDC">[USDC]</option>
                  <option value="USDT">[USDT]</option>
                  <option value="BACK">[BACK]</option>
                </select>
              </div>
              <div>
                <label className="block text-sm terminal-text mb-2">
                  <span className="terminal-prefix">&gt;</span> OUTPUT_TOKEN
                </label>
                <select
                  value={outputToken}
                  onChange={(e) => setOutputToken(e.target.value)}
                  disabled={loading}
                  className="input-field w-full"
                >
                  <option value="USDC">[USDC]</option>
                  <option value="SOL">[SOL]</option>
                  <option value="USDT">[USDT]</option>
                  <option value="BACK">[BACK]</option>
                </select>
              </div>
            </div>

            {/* Amount Per Order */}
            <div>
              <label className="block text-sm terminal-text mb-2">
                <span className="terminal-prefix">&gt;</span> AMOUNT_PER_ORDER
              </label>
              <input
                type="number"
                value={amountPerOrder}
                onChange={(e) => setAmountPerOrder(e.target.value)}
                placeholder="0.00"
                disabled={loading || !connected}
                className="input-field w-full"
              />
              <div className="mt-2 text-xs terminal-text opacity-70">
                {connected ? (
                  <>
                    BALANCE: {(inputTokenData?.balance || 0).toFixed(4)}{" "}
                    {inputToken}
                  </>
                ) : (
                  <>CONNECT_WALLET_TO_SEE_BALANCE</>
                )}
              </div>
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm terminal-text mb-2">
                <span className="terminal-prefix">&gt;</span> FREQUENCY
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["hourly", "daily", "weekly", "monthly"] as const).map(
                  (freq) => (
                    <button
                      key={freq}
                      onClick={() => setFrequency(freq)}
                      disabled={loading}
                      className={`px-4 py-3 font-bold terminal-text transition-all ${
                        frequency === freq
                          ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]"
                          : "border-2 border-[var(--primary)]/30 hover:border-[var(--primary)]"
                      }`}
                    >
                      [{freq.toUpperCase()}]
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Total Orders */}
            <div>
              <label className="block text-sm terminal-text mb-2">
                <span className="terminal-prefix">&gt;</span> TOTAL_ORDERS
              </label>
              <input
                type="number"
                value={totalOrders}
                onChange={(e) => setTotalOrders(e.target.value)}
                placeholder="10"
                disabled={loading}
                className="input-field w-full"
              />
            </div>

            {/* Summary */}
            <div className="stat-card p-4 bg-[var(--primary)]/10 border-2 border-[var(--primary)]">
              <div className="text-sm terminal-text mb-3 font-bold">
                <span className="terminal-prefix">&gt;</span> [ORDER_SUMMARY]
              </div>
              <div className="space-y-2 text-sm terminal-text">
                <div className="flex justify-between">
                  <span className="opacity-70">TOTAL_INVESTMENT:</span>
                  <span className="font-bold">
                    {totalInvestment.toFixed(4)} {inputToken}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">ESTIMATED_DURATION:</span>
                  <span className="font-bold">
                    {getFrequencyDuration(
                      frequency,
                      Number.parseInt(totalOrders || "0")
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">NEXT_EXECUTION:</span>
                  <span className="font-bold">
                    {getNextExecutionTime(frequency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning if not connected */}
            {!connected && (
              <div className="stat-card p-4 bg-yellow-500/10 border-2 border-yellow-500">
                <div className="text-sm terminal-text text-yellow-500 text-center">
                  <span className="terminal-prefix">&gt;</span>{" "}
                  WALLET_NOT_CONNECTED
                  <br />
                  Please connect your wallet to create DCA orders
                </div>
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={handleCreateDCA}
              disabled={
                !connected ||
                loading ||
                !amountPerOrder ||
                !totalOrders ||
                Number.parseFloat(amountPerOrder) <= 0 ||
                Number.parseInt(totalOrders) <= 0
              }
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>CREATING...</span>
                </span>
              ) : (
                <span>
                  <span className="terminal-prefix">&gt;</span>{" "}
                  [CREATE_DCA_ORDER]
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* My Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {dcaOrders.length === 0 ? (
            <div className="swap-card text-center py-16">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-transparent border-2 border-[var(--primary)] mx-auto mb-6">
                <span className="text-5xl">📊</span>
              </div>
              <h3 className="text-2xl font-bold mb-3 terminal-text">
                <span className="terminal-prefix">&gt;</span> NO_DCA_ORDERS
              </h3>
              <p className="terminal-text opacity-70 text-lg mb-6">
                Create your first DCA order to start automated investing
              </p>
              <button
                onClick={() => setActiveTab("create")}
                className="btn-primary px-8 py-3 terminal-text"
              >
                <span className="terminal-prefix">&gt;</span>{" "}
                [CREATE_FIRST_ORDER]
              </button>
            </div>
          ) : (
            dcaOrders.map((order) => (
              <div key={order.id} className="swap-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-transparent border-2 border-[var(--primary)] flex items-center justify-center">
                      <span className="text-xl">🔄</span>
                    </div>
                    <div>
                      <div className="font-bold terminal-text text-lg">
                        {order.inputToken} → {order.outputToken}
                      </div>
                      <div className="text-sm terminal-text opacity-70">
                        {order.amountPerOrder} {order.inputToken} |{" "}
                        {formatFrequency(order.frequency)}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-bold border-2 terminal-text ${getStatusColor(order.status)}`}
                  >
                    [{order.status.toUpperCase()}]
                  </span>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm terminal-text mb-2">
                    <span className="opacity-70">PROGRESS:</span>
                    <span className="font-bold">
                      {order.executedOrders} / {order.totalOrders} ORDERS
                    </span>
                  </div>
                  <div className="w-full bg-black/50 border-2 border-[var(--primary)]/30 h-3">
                    <div
                      className="h-full bg-[var(--primary)] transition-all"
                      style={{
                        width: `${(order.executedOrders / order.totalOrders) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="stat-card p-3">
                    <div className="text-xs terminal-text opacity-70 mb-1">
                      TOTAL_INVESTED
                    </div>
                    <div className="text-sm font-bold terminal-text">
                      ${order.totalInvested.toFixed(2)}
                    </div>
                  </div>
                  <div className="stat-card p-3">
                    <div className="text-xs terminal-text opacity-70 mb-1">
                      AVG_PRICE
                    </div>
                    <div className="text-sm font-bold terminal-text">
                      ${order.averagePrice.toFixed(4)}
                    </div>
                  </div>
                  <div className="stat-card p-3">
                    <div className="text-xs terminal-text opacity-70 mb-1">
                      NEXT_EXECUTION
                    </div>
                    <div className="text-sm font-bold terminal-text">
                      {order.nextExecution.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="stat-card p-3">
                    <div className="text-xs terminal-text opacity-70 mb-1">
                      CREATED
                    </div>
                    <div className="text-sm font-bold terminal-text">
                      {order.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {order.status !== "completed" &&
                  order.status !== "cancelled" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleDCA(order.id)}
                        className="flex-1 px-4 py-2 border-2 border-[var(--primary)] terminal-text font-bold hover:bg-[var(--primary)]/20 transition-all"
                      >
                        <span className="terminal-prefix">&gt;</span> [
                        {order.status === "active" ? "PAUSE" : "RESUME"}]
                      </button>
                      <button
                        onClick={() => handleCancelDCA(order.id)}
                        className="flex-1 px-4 py-2 border-2 border-red-500 text-red-500 terminal-text font-bold hover:bg-red-500/20 transition-all"
                      >
                        <span className="terminal-prefix">&gt;</span> [CANCEL]
                      </button>
                    </div>
                  )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Simulator Tab */}
      {activeTab === "simulator" && <DCASimulator />}
    </div>
  );
};
