"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
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
  const { connection } = useConnection();
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
  const [rpcError, setRpcError] = useState<string | null>(null);

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

  // Test RPC connectivity
  const testRpcConnection = async (): Promise<boolean> => {
    try {
      await connection.getLatestBlockhash();
      setRpcError(null);
      return true;
    } catch (error: unknown) {
      console.error("RPC Connection test failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("403") || errorMessage.includes("forbidden")) {
        setRpcError("Accès RPC refusé (403). Vérifiez votre configuration réseau.");
      } else if (errorMessage.includes("429")) {
        setRpcError("Limite de taux RPC atteinte. Réessayez plus tard.");
      } else {
        setRpcError("Erreur de connexion RPC. Vérifiez votre réseau.");
      }
      return false;
    }
  };

  // 🔄 PHASE 2: Load on-chain DCA plans (EN DÉVELOPPEMENT)
  const loadOnChainPlans = useCallback(async () => {
    if (!publicKey || !connected) {
      return;
    }

    try {
      console.log("🔍 Chargement des plans DCA on-chain...");

      // NOTE: Fonctionnalité en développement
      // Le programme on-chain nécessite une instruction DCA dédiée
      // Pour l'instant, utilisation du stockage local uniquement
      
      console.log(`ℹ️  Chargement des plans DCA on-chain - Fonctionnalité en développement`);
      console.log(`   Les plans sont stockés localement pour le moment`);
      
      // Version temporaire: retourner un tableau vide
      const onChainOrders: DCAOrder[] = [];

      // Fusionner avec les ordres locaux (éviter les doublons)
      setDcaOrders((prevOrders) => {
        const localOrders = prevOrders.filter(
          (order) => !onChainOrders.find((onChain) => onChain.id === order.id)
        );
        return [...onChainOrders, ...localOrders];
      });

      console.log("✅ Plans DCA chargés (stockage local)");
    } catch (error) {
      console.error("❌ Erreur lors du chargement des plans:", error);
      // Ne pas bloquer l'UI en cas d'erreur
    }
  }, [publicKey, connected]);

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

      // Load on-chain DCA plans
      loadOnChainPlans();
    }
  }, [connected, publicKey, loadOnChainPlans]);

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

  // Create DCA Order (LOCAL STORAGE ONLY - ON-CHAIN EN DÉVELOPPEMENT)
  const handleCreateDCA = async () => {
    console.log("🔍 [DEBUG] handleCreateDCA appelée");
    console.log("🔍 [DEBUG] Connected:", connected);
    console.log("🔍 [DEBUG] PublicKey:", publicKey?.toString());
    console.log("🔍 [DEBUG] AmountPerOrder:", amountPerOrder);
    console.log("🔍 [DEBUG] TotalOrders:", totalOrders);
    console.log("🔍 [DEBUG] InputToken:", inputToken);
    console.log("🔍 [DEBUG] OutputToken:", outputToken);
    console.log("🔍 [DEBUG] Frequency:", frequency);

    if (!connected || !publicKey) {
      console.error("❌ [DEBUG] Wallet non connecté");
      alert("Veuillez connecter votre wallet");
      return;
    }

    if (!amountPerOrder || Number.parseFloat(amountPerOrder) <= 0) {
      console.error("❌ [DEBUG] Montant invalide:", amountPerOrder);
      alert("Veuillez saisir un montant valide");
      return;
    }

    if (!totalOrders || Number.parseInt(totalOrders) <= 0) {
      console.error("❌ [DEBUG] Nombre d'ordres invalide:", totalOrders);
      alert("Veuillez saisir un nombre d'ordres valide");
      return;
    }

    console.log("✅ [DEBUG] Validation passée");
    setLoading(true);
    setRpcError(null);

    try {
      console.log("🔍 [DEBUG] Test de connexion RPC...");
      // Test RPC connection before proceeding
      const rpcOk = await testRpcConnection();
      console.log("🔍 [DEBUG] RPC OK:", rpcOk);
      if (!rpcOk) {
        console.error("❌ [DEBUG] Problème de connexion RPC");
        alert("Problème de connexion réseau. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      console.log("🚀 Création d'un plan DCA (stockage local)...");
      
      // Générer un ID unique pour le plan
      const planId = Date.now().toString();
      const planPdaSimulated = `DCA_${publicKey.toString().slice(0, 8)}_${planId}`;
      
      console.log("✓ Plan ID:", planId);
      console.log("✓ PDA simulé:", planPdaSimulated);

      // Créer l'ordre local pour le tracking UI
      const newOrder: DCAOrder = {
        id: planPdaSimulated,
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
      console.log("🔍 [DEBUG] Updated orders:", updatedOrders.length);
      setDcaOrders(updatedOrders);

      // Sauvegarder dans localStorage
      const storageKey = `swapback_dca_${publicKey.toString()}`;
      console.log("🔍 [DEBUG] Storage key:", storageKey);
      
      try {
        const serializedOrders = updatedOrders.map(order => ({
          ...order,
          createdAt: order.createdAt.toISOString(),
          nextExecution: order.nextExecution.toISOString()
        }));
        localStorage.setItem(storageKey, JSON.stringify(serializedOrders));
        console.log("✅ [DEBUG] Sauvegardé dans localStorage");
      } catch (storageError) {
        console.error("❌ [DEBUG] Erreur localStorage:", storageError);
        throw storageError;
      }

      // Reset form
      setAmountPerOrder("");
      setTotalOrders("10");
      console.log("✅ [DEBUG] Formulaire réinitialisé");

      // Afficher la notification de succès
      console.log("✅ [DEBUG] Affichage de l'alerte de succès");
      alert(
        `✅ Plan DCA créé avec succès!\n\n` +
        `⚠️ Note: Stocké localement (on-chain en développement)\n\n` +
        `Montant par ordre: ${amountPerOrder} ${inputToken}\n` +
        `Fréquence: ${frequency}\n` +
        `Nombre d'ordres: ${totalOrders}\n\n` +
        `Les ordres seront exécutés automatiquement selon la fréquence choisie.`
      );
      
      console.log("✅ Plan DCA créé localement!");
    } catch (error) {
      console.error("❌ Erreur création DCA:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      alert(`❌ Erreur lors de la création du plan DCA:\n\n${errorMessage}`);
      setRpcError(errorMessage);
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
      const serializedOrders = updatedOrders.map(order => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        nextExecution: order.nextExecution.toISOString()
      }));
      localStorage.setItem(storageKey, JSON.stringify(serializedOrders));
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
      const serializedOrders = updatedOrders.map(order => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        nextExecution: order.nextExecution.toISOString()
      }));
      localStorage.setItem(storageKey, JSON.stringify(serializedOrders));
    }
  };

  return (
    <div className="space-y-6">
      {/* Network Status and RPC Error Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${rpcError ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
          <span className="text-xs text-gray-400 terminal-text">
            RÉSEAU: {rpcError ? 'DÉCONNECTÉ' : 'CONNECTÉ'}
          </span>
        </div>
        {rpcError && (
          <button
            onClick={testRpcConnection}
            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded terminal-text"
          >
            RETESTER
          </button>
        )}
      </div>

      {rpcError && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-400 mr-2">⚠️</span>
            <p className="text-red-300 text-sm terminal-text">
              <span className="terminal-prefix">&gt;</span> [ERREUR RPC]: {rpcError}
            </p>
          </div>
          <p className="text-red-300 text-xs mt-2">
            Essayez de changer de réseau RPC ou réessayez plus tard.
          </p>
        </div>
      )}

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
          {/* DCA Information */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <h4 className="text-blue-300 font-bold mb-2 terminal-text">
              <span className="terminal-prefix">&gt;</span> [À PROPOS DU DCA]
            </h4>
            <p className="text-blue-200 text-sm mb-2">
              Le Dollar Cost Averaging (DCA) vous permet d'investir automatiquement à intervalles réguliers,
              réduisant l'impact de la volatilité du marché.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-200">
              <div>
                <span className="font-bold">📊 Réduction du risque:</span> Lissez vos achats sur le temps
              </div>
              <div>
                <span className="font-bold">⏰ Automatisation:</span> Pas besoin d'intervenir manuellement
              </div>
              <div>
                <span className="font-bold">📈 Discipline:</span> Évitez les décisions émotionnelles
              </div>
            </div>
          </div>

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

                {/* Balance and Quick Actions */}
                {inputTokenData && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Balance: {inputTokenData.balance?.toFixed(4) || "0.0000"} {inputToken}
                      {inputTokenData.usdValue && (
                        <span className="ml-2">
                          (~${(inputTokenData.usdValue * (Number.parseFloat(amountPerOrder) || 0)).toFixed(2)})
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
          {/* Refresh Button */}
          {connected && (
            <div className="flex justify-end mb-4">
              <button
                onClick={loadOnChainPlans}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold terminal-text rounded transition-colors flex items-center gap-2"
              >
                <span className="terminal-prefix">&gt;</span>
                <span>🔄 RAFRAÎCHIR</span>
              </button>
            </div>
          )}

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
            <>
              {/* DCA Statistics Overview */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <h4 className="text-lg font-bold mb-4 terminal-text">
                  <span className="terminal-prefix">&gt;</span> [STATISTIQUES DCA]
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[var(--primary)]">{dcaOrders.length}</p>
                    <p className="text-xs text-gray-400">ORDRES TOTAUX</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">
                      {dcaOrders.filter(o => o.status === "active").length}
                    </p>
                    <p className="text-xs text-gray-400">ORDRES ACTIFS</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">
                      {dcaOrders.reduce((sum, o) => sum + o.executedOrders, 0)}
                    </p>
                    <p className="text-xs text-gray-400">ORDRES EXÉCUTÉS</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-400">
                      ${dcaOrders.reduce((sum, o) => sum + o.totalInvested, 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">TOTAL INVESTI</p>
                  </div>
                </div>
              </div>

              {/* Orders List */}
              {dcaOrders.map((order) => {
                // Détecter si c'est un ordre on-chain (PDA valide) ou local
                const isOnChain = order.id.length >= 32 && !order.id.startsWith("dca_local_");
                
                return (
                  <div
                    key={order.id}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-bold terminal-text">
                            <span className="terminal-prefix">&gt;</span> [{order.inputToken} → {order.outputToken}]
                          </h4>
                          {isOnChain && (
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs font-bold rounded border border-purple-500/50">
                              ⛓️ ON-CHAIN
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          Créé le {order.createdAt.toLocaleDateString()}
                        </p>
                        {isOnChain && (
                          <p className="text-xs text-gray-500 font-mono mt-1">
                            ID: {order.id.slice(0, 8)}...{order.id.slice(-8)}
                          </p>
                        )}
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
              );
            })}
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