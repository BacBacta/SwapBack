"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { lamportsToUiSafe, bnToNumberWithFallback } from "@/lib/bnUtils";

// ============================
// 🎯 CONFIGURATION
// ============================

// Lazy load to avoid module-level env access
let _routerProgramId: PublicKey | null = null;
function getRouterProgramId(): PublicKey {
  if (!_routerProgramId) {
    _routerProgramId = new PublicKey(
      process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID ||
        "BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz"
    );
  }
  return _routerProgramId;
}

let _backTokenMint: PublicKey | null = null;
function getBackTokenMint(): PublicKey {
  if (!_backTokenMint) {
    _backTokenMint = new PublicKey(
      process.env.NEXT_PUBLIC_BACK_MINT ||
        "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
    );
  }
  return _backTokenMint;
}

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
  const { publicKey, connected } = useWallet();

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
        // Récupérer tous les plans DCA via getProgramAccounts
        // Discriminator pour DcaPlan = premiers 8 bytes du hash SHA256 de "account:DcaPlan"
        const accounts = await connection.getProgramAccounts(
          getRouterProgramId(),
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

            // Safe BN creation from Buffer (avoid BigInt conversion issues)
            const plan: DcaPlan = {
              publicKey: pubkey,
              account: {
                authority,
                inputAmount: new BN(data.slice(40, 48), 'le'),
                amountSwapped: new BN(data.slice(48, 56), 'le'),
                destinationToken: new PublicKey(data.slice(56, 88)),
                dcaInterval: new BN(data.slice(88, 96), 'le'),
                numberOfSwaps: new BN(data.slice(96, 104), 'le'),
                swapsExecuted: new BN(data.slice(104, 112), 'le'),
                lastSwapTime: new BN(data.slice(112, 120), 'le'),
                minOutputAmount: new BN(data.slice(120, 128), 'le'),
                isPaused: data[128] === 1,
              },
            };

            parsedPlans.push(plan);
          } catch (err) {
            console.warn("Erreur parsing plan:", pubkey.toString(), err);
          }
        }

        setPlans(parsedPlans);
      } catch (err: unknown) {
        console.error("❌ Erreur chargement plans:", err);
        const message =
          err instanceof Error
            ? err.message
            : "Erreur lors du chargement des plans";
        setError(message);
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
    // Safe conversion: divide in BN first to avoid overflow
    const divisor = new BN(10).pow(new BN(decimals));
    const whole = amount.div(divisor);
    const remainder = amount.mod(divisor);
    
    // Vérifier la plage sûre avant toNumber()
    const maxSafeBN = new BN(Number.MAX_SAFE_INTEGER);
    if (whole.gt(maxSafeBN)) {
      // Retourner en format string si trop grand
      const wholeStr = whole.toString();
      const remainderStr = remainder.toString().padStart(decimals, '0');
      return `${wholeStr}.${remainderStr.slice(0, 4)}`;
    }
    
    try {
      const num = whole.toNumber() + (remainder.toNumber() / Math.pow(10, decimals));
      return num.toFixed(4);
    } catch (error) {
      console.error('formatAmount error:', error);
      return whole.toString();
    }
  };

  const formatDate = (timestamp: BN) => {
    // Timestamps are seconds since epoch, use safe conversion
    const ts = bnToNumberWithFallback(timestamp, 0);
    if (ts === 0) return "Jamais";
    const date = new Date(ts * 1000);
    return date.toLocaleString("fr-FR");
  };

  const getNextSwapTime = (plan: DcaPlan) => {
    // Timestamps safe: use safe conversion
    const lastSwap = bnToNumberWithFallback(plan.account.lastSwapTime, 0);
    const interval = bnToNumberWithFallback(plan.account.dcaInterval, 0);

    if (lastSwap === 0) return "En attente";

    const next = new Date((lastSwap + interval) * 1000);
    return next.toLocaleString("fr-FR");
  };

  const getProgress = (plan: DcaPlan) => {
    const executed = bnToNumberWithFallback(plan.account.swapsExecuted, 0);
    const total = bnToNumberWithFallback(plan.account.numberOfSwaps, 1); // Avoid division by 0
    return Math.round((executed / total) * 100);
  };

  const getTokenSymbol = (mint: PublicKey) => {
    if (mint.equals(getBackTokenMint())) return "$BACK";
    if (mint.toString() === "So11111111111111111111111111111111111111112")
      return "wSOL";
    return mint.toString().slice(0, 8) + "...";
  };

  // ============================
  // 🎨 RENDER
  // ============================

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-12 text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Dashboard SwapBack
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Connectez votre wallet pour voir vos plans DCA
          </p>
          <WalletMultiButton className="mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-8">
        <h1 className="text-4xl font-bold mb-2 text-white">Mes Plans DCA</h1>
        <p className="text-gray-400 text-lg">
          Gérez vos stratégies de Dollar-Cost Averaging
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Plans actifs</div>
            <div className="text-3xl font-bold text-white">
              {plans.filter((p) => !p.account.isPaused).length}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total investi</div>
            <div className="text-3xl font-bold text-white">
              {(lamportsToUiSafe(
                plans.reduce((sum, p) => sum.add(p.account.inputAmount), new BN(0)),
                9
              ) || 0).toFixed(2)}{" "}
              SOL
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Swaps exécutés</div>
            <div className="text-3xl font-bold text-white">
              {plans.reduce(
                (sum, p) => sum + bnToNumberWithFallback(p.account.swapsExecuted, 0),
                0
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-gray-400">Chargement de vos plans DCA...</p>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-6 py-4 rounded-xl">
          <p className="font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* NO PLANS */}
      {!loading && plans.length === 0 && (
        <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-12 text-center">
          <div className="text-6xl mb-6">📊</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Aucun plan DCA actif
          </h2>
          <p className="text-gray-400 mb-8">
            Créez votre premier plan pour commencer à investir automatiquement
          </p>
          <a
            href="/dca"
            className="inline-block bg-[var(--primary)] text-black px-8 py-3 rounded-lg font-semibold hover:bg-[var(--primary)]/90 transition-colors"
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
                className="bg-black border border-[var(--primary)]/20 rounded-xl p-6 hover:border-[var(--primary)]/40 transition-all"
              >
                {/* HEADER */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Plan DCA #{index + 1}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {plan.publicKey.toString().slice(0, 16)}...
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isPaused && (
                      <span className="bg-yellow-900/30 text-yellow-400 px-3 py-1 rounded-full text-sm font-medium border border-yellow-500/30">
                        ⏸ En pause
                      </span>
                    )}
                    {isComplete && (
                      <span className="bg-green-900/30 text-green-400 px-3 py-1 rounded-full text-sm font-medium border border-green-500/30">
                        ✅ Terminé
                      </span>
                    )}
                    {!isPaused && !isComplete && (
                      <span className="bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full text-sm font-medium border border-blue-500/30">
                        🔄 Actif
                      </span>
                    )}
                  </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Progression</span>
                    <span className="font-medium text-white">
                      {plan.account.swapsExecuted.toString()} /{" "}
                      {plan.account.numberOfSwaps.toString()} swaps
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div
                      className="bg-[var(--primary)] h-3 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-right text-sm text-gray-500 mt-1">
                    {progress}%
                  </p>
                </div>

                {/* DETAILS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">
                      Montant total
                    </div>
                    <div className="text-lg font-bold text-white">
                      {formatAmount(plan.account.inputAmount)} SOL
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">
                      Token destination
                    </div>
                    <div className="text-lg font-bold text-white">
                      {getTokenSymbol(plan.account.destinationToken)}
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Intervalle</div>
                    <div className="text-lg font-bold text-white">
                      {(bnToNumberWithFallback(plan.account.dcaInterval, 0) / 3600).toFixed(1)}h
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">
                      Prochain swap
                    </div>
                    <div className="text-sm font-medium text-white">
                      {getNextSwapTime(plan)}
                    </div>
                  </div>
                </div>

                {/* STATS */}
                <div className="border-t border-gray-800 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Swappé:</span>
                      <span className="ml-2 font-medium text-white">
                        {formatAmount(plan.account.amountSwapped)} SOL
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Par swap:</span>
                      <span className="ml-2 font-medium text-white">
                        {formatAmount(
                          plan.account.inputAmount.div(
                            plan.account.numberOfSwaps
                          )
                        )}{" "}
                        SOL
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Dernier swap:</span>
                      <span className="ml-2 font-medium text-white">
                        {formatDate(plan.account.lastSwapTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Slippage min:</span>
                      <span className="ml-2 font-medium text-white">
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
                    href={`https://explorer.solana.com/address/${plan.publicKey.toString()}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK || "testnet"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-medium text-center transition-colors border border-gray-700"
                  >
                    🔍 Explorer
                  </a>
                  {!isPaused && !isComplete && (
                    <button
                      disabled
                      className="flex-1 bg-gray-900/50 text-gray-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed border border-gray-800"
                    >
                      ⏸ Pause (bientôt)
                    </button>
                  )}
                  {!isComplete && (
                    <button
                      disabled
                      className="flex-1 bg-gray-900/50 text-gray-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed border border-gray-800"
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
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-3">
          💡 Comment ça marche ?
        </h3>
        <ul className="space-y-2 text-sm text-gray-300">
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
