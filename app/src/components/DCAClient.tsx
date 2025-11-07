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

// Token symbol to mint address mapping
const TOKEN_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC:
    process.env.NEXT_PUBLIC_USDC_MINT ||
    "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BACK:
    process.env.NEXT_PUBLIC_BACK_MINT ||
    "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux",
};

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

  // Vérifier que le wallet est complètement initialisé
  useEffect(() => {
    // Attendre un court instant pour que le wallet s'initialise complètement
    const timer = setTimeout(() => {
      setWalletReady(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [connected, publicKey]);

  // On-chain DCA hooks
  const { data: dcaPlans = [], isLoading: plansLoading } = useDcaPlans();
  const { createPlan, isCreating } = useCreateDcaPlan();
  const { readyPlans } = useReadyDcaPlans();
  const stats = useDcaStats();

  // Token Data - Convert symbol to mint address
  const inputTokenMint = TOKEN_MINTS[inputToken] || TOKEN_MINTS.SOL;
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
          "Accès RPC refusé (403). Vérifiez votre configuration réseau."
        );
      } else if (errorMessage.includes("429")) {
        setRpcError("Limite de taux RPC atteinte. Réessayez plus tard.");
      } else {
        setRpcError("Erreur de connexion RPC. Vérifiez votre réseau.");
      }
      return false;
    }
  };

  // Create DCA Plan on-chain
  const handleCreateDCA = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent any default behavior
    e?.preventDefault();
    e?.stopPropagation();

    console.log("🔵 handleCreateDCA called");

    if (!walletReady || !connected || !publicKey) {
      if (!walletReady) {
        alert("Initialisation du wallet en cours...");
      } else {
        alert("Veuillez connecter votre wallet");
      }
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

    setRpcError(null);

    try {
      // Test RPC connection before proceeding
      const rpcOk = await testRpcConnection();
      if (!rpcOk) {
        alert("Problème de connexion réseau. Veuillez réessayer.");
        return;
      }

      const inputMint = TOKEN_MINTS[inputToken];
      const outputMint = TOKEN_MINTS[outputToken];

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
      console.error("❌ Erreur création DCA:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      alert(`❌ Erreur lors de la création du plan DCA:\n\n${errorMessage}`);
      setRpcError(errorMessage);
    }
  };

  // Calculate total investment
  const totalInvestment =
    Number.parseFloat(amountPerOrder || "0") *
    Number.parseInt(totalOrders || "0");

  return (
    <div className="space-y-6">
      {/* Network Status and RPC Error Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${rpcError ? "bg-red-500" : "bg-green-500"} animate-pulse`}
          ></div>
          <span className="text-xs text-gray-400 terminal-text">
            RÉSEAU: {rpcError ? "DÉCONNECTÉ" : "CONNECTÉ"}
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
              <span className="terminal-prefix">&gt;</span> [ERREUR RPC]:{" "}
              {rpcError}
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

      {/* Wallet Status Indicator */}
      {!walletReady && (
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-3"></div>
            <p className="text-yellow-300 text-sm terminal-text">
              <span className="terminal-prefix">&gt;</span> [INITIALISATION WALLET EN COURS...]
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
              <span className="terminal-prefix">&gt;</span> [À PROPOS DU DCA]
            </h4>
            <p className="text-blue-200 text-sm mb-2">
              Le Dollar Cost Averaging (DCA) vous permet d'investir
              automatiquement à intervalles réguliers, réduisant l'impact de la
              volatilité du marché.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-200">
              <div>
                <span className="font-bold">📊 Réduction du risque:</span>{" "}
                Lissez vos achats sur le temps
              </div>
              <div>
                <span className="font-bold">⏰ Automatisation:</span> Pas besoin
                d'intervenir manuellement
              </div>
              <div>
                <span className="font-bold">📈 Discipline:</span> Évitez les
                décisions émotionnelles
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
                  <span className="terminal-prefix">&gt;</span> MONTANT PAR
                  ORDRE
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
                  <span className="terminal-prefix">&gt;</span> FRÉQUENCE
                </label>
                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as typeof frequency)
                  }
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
                  <span className="terminal-prefix">&gt;</span> NOMBRE TOTAL
                  D'ORDRES
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
                  <span className="terminal-prefix">&gt;</span> INVESTISSEMENT
                  TOTAL
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
                <span className="terminal-prefix">&gt;</span> [PROCHAINE
                EXÉCUTION]: {getNextExecutionTime(frequency)}
              </p>
              <p className="text-sm text-gray-300 terminal-text mt-1">
                <span className="terminal-prefix">&gt;</span> [DURÉE TOTALE]:{" "}
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
                  <span>CRÉATION EN COURS...</span>
                ) : (
                  <span>
                    <span className="terminal-prefix">&gt;</span> [CRÉER ORDRE
                    DCA]
                  </span>
                )}
              </button>
              {!connected && walletReady && (
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
          {/* Ready Plans Notification */}
          {readyPlans.length > 0 && (
            <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⏰</span>
                <div>
                  <p className="font-bold text-blue-300">
                    {readyPlans.length} plan{readyPlans.length > 1 ? "s" : ""}{" "}
                    prêt{readyPlans.length > 1 ? "s" : ""} pour exécution !
                  </p>
                  <p className="text-sm text-blue-200">
                    Consultez vos plans ci-dessous pour les exécuter.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!connected && walletReady ? (
            <div className="text-center py-12">
              <p className="text-gray-400 terminal-text mb-4">
                <span className="terminal-prefix">&gt;</span> [CONNECTEZ VOTRE
                WALLET POUR VOIR VOS ORDRES DCA]
              </p>
            </div>
          ) : plansLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-400 terminal-text mb-4">
                <span className="terminal-prefix">&gt;</span> [CHARGEMENT DES
                PLANS DCA...]
              </p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto mt-4"></div>
            </div>
          ) : dcaPlans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 terminal-text mb-4">
                <span className="terminal-prefix">&gt;</span> [AUCUN ORDRE DCA
                TROUVÉ]
              </p>
              <p className="text-sm text-gray-500">
                Créez votre premier ordre DCA dans l'onglet "CRÉER ORDRE"
              </p>
            </div>
          ) : (
            <>
              {/* DCA Statistics Overview */}
              {stats && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                  <h4 className="text-lg font-bold mb-4 terminal-text">
                    <span className="terminal-prefix">&gt;</span> [STATISTIQUES
                    DCA]
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[var(--primary)]">
                        {stats.totalPlans}
                      </p>
                      <p className="text-xs text-gray-400">PLANS TOTAUX</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-400">
                        {stats.activePlans}
                      </p>
                      <p className="text-xs text-gray-400">PLANS ACTIFS</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-400">
                        {stats.pausedPlans}
                      </p>
                      <p className="text-xs text-gray-400">PLANS PAUSÉS</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-400">
                        {stats.completedPlans}
                      </p>
                      <p className="text-xs text-gray-400">PLANS COMPLÉTÉS</p>
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
