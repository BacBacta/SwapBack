"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTokenData } from "../hooks/useTokenData";
import { DCASimulator } from "./DCASimulator";

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

export const DCAClient = () => {
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

  // Create DCA Order
  const handleCreateDCA = async () => {
    if (!connected || !publicKey) {
      alert("Veuillez connecter votre wallet");
      return;
    }

    if (!amountPerOrder || Number.parseFloat(amountPerOrder) <= 0) {
      alert("Veuillez saisir un montant valide");
      return;
    }

    if (!totalOrders || Number.parseInt(totalOrders) <= 0) {
      alert("Veuillez saisir un nombre d'ordres valide");
      return;
    }

    setLoading(true);

    try {
      const newOrder: DCAOrder = {
        id: `dca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

      const updatedOrders = [...dcaOrders, newOrder];
      setDcaOrders(updatedOrders);

      // Save to localStorage
      const storageKey = `swapback_dca_${publicKey.toString()}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedOrders));

      // Reset form
      setAmountPerOrder("");
      setTotalOrders("10");

      alert("Ordre DCA créé avec succès !");
    } catch (error) {
      console.error("Error creating DCA:", error);
      alert("Erreur lors de la création de l'ordre DCA");
    } finally {
      setLoading(false);
    }
  };

  // Pause/Resume DCA
  const handlePauseResumeDCA = (orderId: string) => {
    const updatedOrders = dcaOrders.map((order) => {
      if (order.id === orderId) {
        const newStatus: "active" | "paused" = order.status === "active" ? "paused" : "active";
        return {
          ...order,
          status: newStatus,
          nextExecution:
            order.status === "paused"
              ? calculateNextExecution(order.frequency)
              : order.nextExecution,
        };
      }
      return order;
    });

    setDcaOrders(updatedOrders);

    if (publicKey) {
      const storageKey = `swapback_dca_${publicKey.toString()}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedOrders));
    }
  };

  // Cancel DCA
  const handleCancelDCA = (orderId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler cet ordre DCA ?")) {
      return;
    }

    const updatedOrders = dcaOrders.filter((order) => order.id !== orderId);
    setDcaOrders(updatedOrders);

    if (publicKey) {
      const storageKey = `swapback_dca_${publicKey.toString()}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedOrders));
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        {[
          { id: "create", label: "CRÉER ORDRE" },
          { id: "orders", label: "MES ORDRES" },
          { id: "simulator", label: "SIMULATEUR" },
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

      {/* Create DCA Tab */}
      {activeTab === "create" && (
        <div className="space-y-6">
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 terminal-text">
              <span className="terminal-prefix">&gt;</span> [CRÉER ORDRE DCA]
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Input Token */}
              <div>
                <label className="block text-sm font-medium mb-2 terminal-text">
                  <span className="terminal-prefix">&gt;</span> TOKEN D'ENTRÉE
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
                  <span className="terminal-prefix">&gt;</span> TOKEN DE SORTIE
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
                  <span className="terminal-prefix">&gt;</span> MONTANT PAR ORDRE
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
                {inputTokenData && (
                  <p className="text-xs text-gray-400 mt-1">
                    Balance: {inputTokenData.balance?.toFixed(4) || "0.0000"} {inputToken}
                    {inputTokenData.usdValue && (
                      <span className="ml-2">
                        (~${(inputTokenData.usdValue * (Number.parseFloat(amountPerOrder) || 0)).toFixed(2)})
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium mb-2 terminal-text">
                  <span className="terminal-prefix">&gt;</span> FRÉQUENCE
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-mono focus:border-[var(--primary)] focus:outline-none"
                >
                  <option value="hourly">Toutes les heures</option>
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>

              {/* Total Orders */}
              <div>
                <label className="block text-sm font-medium mb-2 terminal-text">
                  <span className="terminal-prefix">&gt;</span> NOMBRE TOTAL D'ORDRES
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
                  <span className="terminal-prefix">&gt;</span> INVESTISSEMENT TOTAL
                </label>
                <div className="px-4 py-3 bg-gray-800 border border-gray-600 rounded terminal-text font-mono">
                  {totalInvestment.toFixed(2)} {inputToken}
                  {inputTokenData?.usdValue && (
                    <span className="ml-2 text-gray-400">
                      (~${(inputTokenData.usdValue * totalInvestment).toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Next Execution Preview */}
            <div className="mt-6 p-4 bg-gray-800/50 rounded">
              <p className="text-sm text-gray-300 terminal-text">
                <span className="terminal-prefix">&gt;</span> [PROCHAINE EXÉCUTION]: {getNextExecutionTime(frequency)}
              </p>
              <p className="text-sm text-gray-300 terminal-text mt-1">
                <span className="terminal-prefix">&gt;</span> [DURÉE TOTALE]: {getFrequencyDuration(frequency, Number.parseInt(totalOrders))}
              </p>
            </div>

            {/* Create Button */}
            <div className="mt-6">
              <button
                onClick={handleCreateDCA}
                disabled={loading || !connected}
                className="w-full px-6 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:bg-gray-600 text-black font-bold terminal-text rounded transition-colors"
              >
                {loading ? (
                  <span>CRÉATION EN COURS...</span>
                ) : (
                  <span>
                    <span className="terminal-prefix">&gt;</span> [CRÉER ORDRE DCA]
                  </span>
                )}
              </button>
              {!connected && (
                <p className="text-red-400 text-sm mt-2 text-center">
                  Veuillez connecter votre wallet pour créer un ordre DCA
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {!connected ? (
            <div className="text-center py-12">
              <p className="text-gray-400 terminal-text mb-4">
                <span className="terminal-prefix">&gt;</span> [CONNECTEZ VOTRE WALLET POUR VOIR VOS ORDRES DCA]
              </p>
            </div>
          ) : dcaOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 terminal-text mb-4">
                <span className="terminal-prefix">&gt;</span> [AUCUN ORDRE DCA TROUVÉ]
              </p>
              <p className="text-sm text-gray-500">
                Créez votre premier ordre DCA dans l'onglet "CRÉER ORDRE"
              </p>
            </div>
          ) : (
            dcaOrders.map((order) => (
              <div
                key={order.id}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-bold terminal-text">
                      <span className="terminal-prefix">&gt;</span> [{order.inputToken} → {order.outputToken}]
                    </h4>
                    <p className="text-sm text-gray-400 mt-1">
                      Créé le {order.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded text-sm font-bold ${
                    order.status === "active"
                      ? "bg-green-500/20 text-green-400"
                      : order.status === "paused"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : order.status === "completed"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {order.status.toUpperCase()}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400">MONTANT/ORDRE</p>
                    <p className="font-bold">{order.amountPerOrder} {order.inputToken}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">FRÉQUENCE</p>
                    <p className="font-bold">{order.frequency.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">ORDRES EXÉCUTÉS</p>
                    <p className="font-bold">{order.executedOrders}/{order.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">PROCHAINE EXÉCUTION</p>
                    <p className="font-bold text-sm">
                      {order.nextExecution.toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400">TOTAL INVESTI</p>
                    <p className="font-bold">{order.totalInvested.toFixed(4)} {order.inputToken}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">PRIX MOYEN</p>
                    <p className="font-bold">
                      {order.averagePrice > 0 ? `$${order.averagePrice.toFixed(4)}` : "N/A"}
                    </p>
                  </div>
                </div>

                {order.status !== "completed" && order.status !== "cancelled" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePauseResumeDCA(order.id)}
                      className="flex-1 px-4 py-2 border-2 border-[var(--primary)] text-[var(--primary)] terminal-text font-bold hover:bg-[var(--primary)]/20 transition-all"
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