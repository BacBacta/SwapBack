"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, BN, type Idl } from "@coral-xyz/anchor";

// ============================
// 🎯 CONFIGURATION SWAPBACK
// ============================

const ROUTER_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"
);

const BACK_TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_BACK_MINT || "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
);

const SWITCHBOARD_FEED = new PublicKey(
  process.env.NEXT_PUBLIC_SWITCHBOARD_FEED || "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
);

// Minimal IDL pour create_plan
const ROUTER_IDL = {
  address: ROUTER_PROGRAM_ID.toString(),
  metadata: {
    name: "swapback_router",
    version: "0.1.0",
    spec: "0.1.0",
  },
  version: "0.1.0",
  name: "swapback_router",
  instructions: [
    {
      name: "createPlan",
      accounts: [
        { name: "dcaPlan", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "state", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "inputAmount", type: "u64" },
        { name: "destinationToken", type: "publicKey" },
        { name: "dcaInterval", type: "i64" },
        { name: "numberOfSwaps", type: "u64" },
        { name: "minOutputAmount", type: "u64" },
      ],
    },
  ],
} as unknown as Idl;

// ============================
// 🎨 COMPOSANT PRINCIPAL
// ============================

export const SwapBackInterface = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  // États du formulaire
  const [inputAmount, setInputAmount] = useState("");
  const [dcaInterval, setDcaInterval] = useState("3600"); // 1 heure par défaut
  const [numberOfSwaps, setNumberOfSwaps] = useState("10");
  const [destinationToken, setDestinationToken] = useState(
    BACK_TOKEN_MINT.toString()
  );

  // États UI
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ============================
  // 📊 RÉCUPÉRER PRIX SOL/USD
  // ============================

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const accountInfo = await connection.getAccountInfo(SWITCHBOARD_FEED);
        if (accountInfo && accountInfo.data.length >= 220) {
          // Parse simplifié du feed Switchboard (offset 214 pour le result)
          const view = new DataView(accountInfo.data.buffer);
          const price = view.getFloat64(214, true);
          setSolPrice(price);
        }
      } catch (err) {
        console.warn("Impossible de récupérer le prix SOL:", err);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 10000); // Refresh toutes les 10s
    return () => clearInterval(interval);
  }, [connection]);

  // ============================
  // 🚀 CRÉER UN PLAN DCA
  // ============================

  const handleCreatePlan = useCallback(async () => {
    if (!publicKey || !connected) {
      setError("Veuillez connecter votre wallet");
      return;
    }

    setLoading(true);
    setError(null);
    setTxSignature(null);

    try {
      // 1. Créer le provider Anchor
      const provider = new AnchorProvider(
        connection,
        {
          publicKey,
          signTransaction: async (tx) => {
            await sendTransaction(tx, connection);
            return tx;
          },
          signAllTransactions: async (txs) => txs,
        },
        { commitment: "confirmed" }
      );

      // 2. Charger le programme
      const program = new Program(
        ROUTER_IDL,
        provider
      );

      // 3. Dériver le PDA du plan DCA
      const planId = new BN(Date.now()); // Unique ID basé sur timestamp
      const [dcaPlanPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("dca_plan"),
          publicKey.toBuffer(),
          planId.toArrayLike(Buffer, "le", 8),
        ],
        ROUTER_PROGRAM_ID
      );

      // 4. Dériver le PDA du Router State
      const [statePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_state")],
        ROUTER_PROGRAM_ID
      );

      // 5. Convertir les montants
      const inputAmountLamports = new BN(
        Number.parseFloat(inputAmount) * LAMPORTS_PER_SOL
      );
      const dcaIntervalSeconds = new BN(dcaInterval);
      const numSwaps = new BN(numberOfSwaps);
      const minOutputAmount = new BN(0); // Slippage illimité pour test

      // 6. Créer la transaction
      const tx = await program.methods
        .createPlan(
          inputAmountLamports,
          new PublicKey(destinationToken),
          dcaIntervalSeconds,
          numSwaps,
          minOutputAmount
        )
        .accounts({
          dcaPlan: dcaPlanPda,
          authority: publicKey,
          state: statePda,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // 7. Envoyer la transaction
      const signature = await sendTransaction(tx, connection);

      // 8. Attendre confirmation
      await connection.confirmTransaction(
        {
          signature,
          ...(await connection.getLatestBlockhash()),
        },
        "confirmed"
      );

      setTxSignature(signature);
      setError(null);

      // Reset form
      setInputAmount("");
      setDcaInterval("3600");
      setNumberOfSwaps("10");

      console.log("✅ Plan DCA créé:", signature);
    } catch (err: unknown) {
      console.error("❌ Erreur création plan:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la création du plan"
      );
    } finally {
      setLoading(false);
    }
  }, [
    publicKey,
    connected,
    connection,
    sendTransaction,
    inputAmount,
    dcaInterval,
    numberOfSwaps,
    destinationToken,
  ]);

  // ============================
  // 🎨 RENDER
  // ============================

  const estimatedAmountPerSwap =
    inputAmount && numberOfSwaps
      ? (
          Number.parseFloat(inputAmount) / Number.parseFloat(numberOfSwaps)
        ).toFixed(4)
      : "0";

  const estimatedDuration =
    dcaInterval && numberOfSwaps
      ? (Number.parseInt(dcaInterval) * Number.parseInt(numberOfSwaps)) / 3600
      : 0;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 mb-8 text-[var(--primary)]">
        <h1 className="text-4xl font-bold mb-2">SwapBack DCA</h1>
        <p className="text-purple-100 text-lg">
          Dollar-Cost Averaging automatisé sur Solana
        </p>
        {solPrice && (
          <div className="mt-4 text-sm bg-[var(--primary)]/20 rounded-lg px-4 py-2 inline-block">
            📊 SOL/USD:{" "}
            <span className="font-bold">${solPrice.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* WALLET BUTTON */}
      {!connected && (
        <div className="bg-[var(--primary)] rounded-2xl shadow-xl p-8 mb-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Connectez votre wallet
          </h2>
          <p className="text-gray-600 mb-6">
            Pour créer un plan DCA, vous devez d'abord connecter votre wallet
            Solana
          </p>
          <WalletMultiButton className="mx-auto" />
        </div>
      )}

      {/* FORMULAIRE DCA */}
      {connected && (
        <div className="bg-[var(--primary)] rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Créer un plan DCA
          </h2>

          {/* Input Amount */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montant total (SOL)
            </label>
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="Ex: 10"
              step="0.1"
              min="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {solPrice && inputAmount && (
              <p className="text-sm text-gray-500 mt-2">
                ≈ ${(Number.parseFloat(inputAmount) * solPrice).toFixed(2)} USD
              </p>
            )}
          </div>

          {/* Destination Token */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token de destination
            </label>
            <select
              value={destinationToken}
              onChange={(e) => setDestinationToken(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value={BACK_TOKEN_MINT.toString()}>$BACK Token</option>
              <option value="So11111111111111111111111111111111111111112">
                Wrapped SOL
              </option>
            </select>
          </div>

          {/* Number of Swaps */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de swaps
            </label>
            <input
              type="number"
              value={numberOfSwaps}
              onChange={(e) => setNumberOfSwaps(e.target.value)}
              placeholder="Ex: 10"
              min="1"
              max="1000"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-2">
              {estimatedAmountPerSwap} SOL par swap
            </p>
          </div>

          {/* DCA Interval */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Intervalle entre swaps
            </label>
            <select
              value={dcaInterval}
              onChange={(e) => setDcaInterval(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="300">5 minutes (test)</option>
              <option value="3600">1 heure</option>
              <option value="21600">6 heures</option>
              <option value="86400">24 heures (1 jour)</option>
              <option value="604800">7 jours (1 semaine)</option>
            </select>
            {estimatedDuration > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Durée totale: {estimatedDuration.toFixed(1)} heures (~
                {(estimatedDuration / 24).toFixed(1)} jours)
              </p>
            )}
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              📋 Résumé
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Montant total:</span>
                <span className="font-medium">{inputAmount || "0"} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Nombre de swaps:</span>
                <span className="font-medium">{numberOfSwaps}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Montant par swap:</span>
                <span className="font-medium">
                  {estimatedAmountPerSwap} SOL
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Durée estimée:</span>
                <span className="font-medium">
                  {estimatedDuration.toFixed(1)}h
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="text-sm">⚠️ {error}</p>
            </div>
          )}

          {/* Success Message */}
          {txSignature && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              <p className="text-sm font-medium mb-2">
                ✅ Plan DCA créé avec succès!
              </p>
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'testnet'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:text-green-800 underline"
              >
                Voir la transaction →
              </a>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleCreatePlan}
            disabled={loading || !inputAmount || !numberOfSwaps}
            className={`w-full py-4 rounded-lg font-semibold text-[var(--primary)] transition-all ${
              loading || !inputAmount || !numberOfSwaps
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Création en cours...
              </span>
            ) : (
              "🚀 Créer le plan DCA"
            )}
          </button>

          {/* Info Footer */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              ℹ️ <strong>Note:</strong> Les swaps seront exécutés
              automatiquement par le programme SwapBack Router. Assurez-vous
              d'avoir suffisamment de SOL pour couvrir les frais de transaction
              (~0.01 SOL par swap).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
