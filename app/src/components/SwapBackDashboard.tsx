"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

// ============================
// 🎯 CONFIGURATION
// ============================

const ROUTER_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "yeKoCvFPTmgn5oCejqFVU5mUNdVbZSxwETCXDuBpfxn"
);

const BACK_TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_BACK_MINT || "5UpRMH1xbHYsZdrYwjVab8cVN3QXJpFubCB5WXeB8i27"
);

// Minimal IDL
const ROUTER_IDL = {
  version: "0.1.0",
  name: "swapback_router",
  instructions: [],
  accounts: [
    {
      name: "DcaPlan",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "inputAmount", type: "u64" },
          { name: "amountSwapped", type: "u64" },
          { name: "destinationToken", type: "publicKey" },
          { name: "dcaInterval", type: "i64" },
          { name: "numberOfSwaps", type: "u64" },
          { name: "swapsExecuted", type: "u64" },
          { name: "lastSwapTime", type: "i64" },
          { name: "minOutputAmount", type: "u64" },
          { name: "isPaused", type: "bool" },
        ],
      },
    },
  ],
};

// ============================
// 🎨 TYPE DEFINITIONS
// ============================

interface DcaPlan {
  publicKey: PublicKey;
  account: {
    authority: PublicKey;
    inputAmount: BN;
    amountSwapped: BN;
    destinationToken: PublicKey;
    dcaInterval: BN;
    numberOfSwaps: BN;
    swapsExecuted: BN;
    lastSwapTime: BN;
    minOutputAmount: BN;
    isPaused: boolean;
  };
}

// ============================
// 🎨 COMPOSANT PRINCIPAL
// ============================

export const SwapBackDashboard = () => {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();

  const [plans, setPlans] = useState<DcaPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================
  // 📊 CHARGER LES PLANS DCA
  // ============================

  useEffect(() => {
    if (!connected || !publicKey) {
      setPlans([]);
      return;
    }

    const fetchPlans = async () => {
      setLoading(true);
      setError(null);

      try {
        // Créer le provider
        const provider = new AnchorProvider(
          connection,
          {
            publicKey,
            signTransaction: async (tx) => tx,
            signAllTransactions: async (txs) => txs,
          },
          { commitment: "confirmed" }
        );

        // Charger le programme
        const program = new Program(
          ROUTER_IDL as any,
          provider
        );

        // Récupérer tous les plans DCA via getProgramAccounts
        // Discriminator pour DcaPlan = premiers 8 bytes du hash SHA256 de "account:DcaPlan"
        const accounts = await connection.getProgramAccounts(
          ROUTER_PROGRAM_ID,
          {
            filters: [
              // Filtrer par discriminator (si connu) ou par authority
              {
                memcmp: {
                  offset: 8, // Après le discriminator
                  bytes: publicKey.toBase58(),
                },
              },
            ],
          }
        );

        // Parser les comptes manuellement (IDL incomplet)
        const parsedPlans: DcaPlan[] = [];

        for (const { pubkey, account } of accounts) {
          try {
            const data = account.data;

            // Skip si trop petit (< 200 bytes pour DcaPlan)
            if (data.length < 200) continue;

            // Parse manuel des champs (offset basé sur la structure Rust)
            // u8 discriminator (8 bytes)
            // authority: Pubkey (32 bytes à offset 8)
            // input_amount: u64 (8 bytes à offset 40)
            // amount_swapped: u64 (8 bytes à offset 48)
            // destination_token: Pubkey (32 bytes à offset 56)
            // dca_interval: i64 (8 bytes à offset 88)
            // number_of_swaps: u64 (8 bytes à offset 96)
            // swaps_executed: u64 (8 bytes à offset 104)
            // last_swap_time: i64 (8 bytes à offset 112)
            // min_output_amount: u64 (8 bytes à offset 120)
            // is_paused: bool (1 byte à offset 128)

            const authority = new PublicKey(data.slice(8, 40));

            // Vérifier que c'est bien notre authority
            if (!authority.equals(publicKey)) continue;

            const view = new DataView(data.buffer, data.byteOffset);

            const plan: DcaPlan = {
              publicKey: pubkey,
              account: {
                authority,
                inputAmount: new BN(view.getBigUint64(40, true)),
                amountSwapped: new BN(view.getBigUint64(48, true)),
                destinationToken: new PublicKey(data.slice(56, 88)),
                dcaInterval: new BN(view.getBigInt64(88, true)),
                numberOfSwaps: new BN(view.getBigUint64(96, true)),
                swapsExecuted: new BN(view.getBigUint64(104, true)),
                lastSwapTime: new BN(view.getBigInt64(112, true)),
                minOutputAmount: new BN(view.getBigUint64(120, true)),
                isPaused: data[128] === 1,
              },
            };

            parsedPlans.push(plan);
          } catch (err) {
            console.warn("Erreur parsing plan:", pubkey.toString(), err);
          }
        }

        setPlans(parsedPlans);
      } catch (err: any) {
        console.error("❌ Erreur chargement plans:", err);
        setError(err.message || "Erreur lors du chargement des plans");
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();

    // Refresh toutes les 30 secondes
    const interval = setInterval(fetchPlans, 30000);
    return () => clearInterval(interval);
  }, [connection, publicKey, connected]);

  // ============================
  // 🎨 FONCTIONS HELPER
  // ============================

  const formatAmount = (amount: BN, decimals = 9) => {
    const num = amount.toNumber() / Math.pow(10, decimals);
    return num.toFixed(4);
  };

  const formatDate = (timestamp: BN) => {
    const ts = timestamp.toNumber();
    if (ts === 0) return "Jamais";
    const date = new Date(ts * 1000);
    return date.toLocaleString("fr-FR");
  };

  const getNextSwapTime = (plan: DcaPlan) => {
    const lastSwap = plan.account.lastSwapTime.toNumber();
    const interval = plan.account.dcaInterval.toNumber();

    if (lastSwap === 0) return "En attente";

    const next = new Date((lastSwap + interval) * 1000);
    return next.toLocaleString("fr-FR");
  };

  const getProgress = (plan: DcaPlan) => {
    const executed = plan.account.swapsExecuted.toNumber();
    const total = plan.account.numberOfSwaps.toNumber();
    return Math.round((executed / total) * 100);
  };

  const getTokenSymbol = (mint: PublicKey) => {
    if (mint.equals(BACK_TOKEN_MINT)) return "$BACK";
    if (mint.toString() === "So11111111111111111111111111111111111111112")
      return "wSOL";
    return mint.toString().slice(0, 8) + "...";
  };

  // ============================
  // 🎨 RENDER
  // ============================

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-[var(--primary)] rounded-2xl shadow-xl p-12 text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Dashboard SwapBack
          </h2>
          <p className="text-gray-600 mb-8 text-lg">
            Connectez votre wallet pour voir vos plans DCA
          </p>
          <WalletMultiButton className="mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 mb-8 text-[var(--primary)]">
        <h1 className="text-4xl font-bold mb-2">Mes Plans DCA</h1>
        <p className="text-purple-100 text-lg">
          Gérez vos stratégies de Dollar-Cost Averaging
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--primary)]/20 rounded-xl p-4">
            <div className="text-sm text-purple-100 mb-1">Plans actifs</div>
            <div className="text-3xl font-bold">
              {plans.filter((p) => !p.account.isPaused).length}
            </div>
          </div>
          <div className="bg-[var(--primary)]/20 rounded-xl p-4">
            <div className="text-sm text-purple-100 mb-1">Total investi</div>
            <div className="text-3xl font-bold">
              {plans
                .reduce((sum, p) => sum + p.account.inputAmount.toNumber(), 0)
                .toFixed(2)}{" "}
              SOL
            </div>
          </div>
          <div className="bg-[var(--primary)]/20 rounded-xl p-4">
            <div className="text-sm text-purple-100 mb-1">Swaps exécutés</div>
            <div className="text-3xl font-bold">
              {plans.reduce(
                (sum, p) => sum + p.account.swapsExecuted.toNumber(),
                0
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="bg-[var(--primary)] rounded-2xl shadow-xl p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de vos plans DCA...</p>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6">
          <p className="font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* NO PLANS */}
      {!loading && plans.length === 0 && (
        <div className="bg-[var(--primary)] rounded-2xl shadow-xl p-12 text-center">
          <div className="text-6xl mb-6">📊</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Aucun plan DCA actif
          </h2>
          <p className="text-gray-600 mb-8">
            Créez votre premier plan pour commencer à investir automatiquement
          </p>
          <a
            href="/"
            className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-[var(--primary)] px-8 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
          >
            Créer un plan DCA
          </a>
        </div>
      )}

      {/* PLANS LIST */}
      {!loading && plans.length > 0 && (
        <div className="space-y-6">
          {plans.map((plan, index) => {
            const progress = getProgress(plan);
            const isComplete = plan.account.swapsExecuted.gte(
              plan.account.numberOfSwaps
            );
            const isPaused = plan.account.isPaused;

            return (
              <div
                key={plan.publicKey.toString()}
                className="bg-[var(--primary)] rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow"
              >
                {/* HEADER */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      Plan DCA #{index + 1}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {plan.publicKey.toString().slice(0, 16)}...
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isPaused && (
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                        ⏸ En pause
                      </span>
                    )}
                    {isComplete && (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        ✅ Terminé
                      </span>
                    )}
                    {!isPaused && !isComplete && (
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        🔄 Actif
                      </span>
                    )}
                  </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progression</span>
                    <span className="font-medium">
                      {plan.account.swapsExecuted.toString()} /{" "}
                      {plan.account.numberOfSwaps.toString()} swaps
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-right text-sm text-gray-500 mt-1">
                    {progress}%
                  </p>
                </div>

                {/* DETAILS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">
                      Montant total
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      {formatAmount(plan.account.inputAmount)} SOL
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">
                      Token destination
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      {getTokenSymbol(plan.account.destinationToken)}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Intervalle</div>
                    <div className="text-lg font-bold text-gray-800">
                      {(plan.account.dcaInterval.toNumber() / 3600).toFixed(1)}h
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">
                      Prochain swap
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {getNextSwapTime(plan)}
                    </div>
                  </div>
                </div>

                {/* STATS */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Swappé:</span>
                      <span className="ml-2 font-medium text-gray-800">
                        {formatAmount(plan.account.amountSwapped)} SOL
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Par swap:</span>
                      <span className="ml-2 font-medium text-gray-800">
                        {formatAmount(
                          plan.account.inputAmount.div(
                            plan.account.numberOfSwaps
                          )
                        )}{" "}
                        SOL
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Dernier swap:</span>
                      <span className="ml-2 font-medium text-gray-800">
                        {formatDate(plan.account.lastSwapTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Slippage min:</span>
                      <span className="ml-2 font-medium text-gray-800">
                        {plan.account.minOutputAmount.toString() === "0"
                          ? "Illimité"
                          : formatAmount(plan.account.minOutputAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="mt-6 flex gap-3">
                  <a
                    href={`https://explorer.solana.com/address/${plan.publicKey.toString()}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium text-center transition-colors"
                  >
                    🔍 Explorer
                  </a>
                  {!isPaused && !isComplete && (
                    <button
                      disabled
                      className="flex-1 bg-gray-300 text-gray-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed"
                    >
                      ⏸ Pause (bientôt)
                    </button>
                  )}
                  {!isComplete && (
                    <button
                      disabled
                      className="flex-1 bg-gray-300 text-gray-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed"
                    >
                      ❌ Annuler (bientôt)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INFO FOOTER */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          💡 Comment ça marche ?
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>
              Vos plans DCA s'exécutent automatiquement selon l'intervalle
              défini
            </span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>
              Les swaps utilisent l'oracle Switchboard pour garantir les
              meilleurs prix
            </span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>
              Vous pouvez mettre en pause ou annuler un plan à tout moment
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
