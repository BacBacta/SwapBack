"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

interface RouteInfo {
  type: "Direct" | "Aggregator" | "RFQ" | "Bundle";
  estimatedOutput: number;
  npi: number;
  rebate: number;
  burn: number;
  fees: number;
}

export const SwapInterface = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();

  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [inputToken, setInputToken] = useState("USDC");
  const [outputToken, setOutputToken] = useState("SOL");
  const [slippage, setSlippage] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Mapping des tokens vers leurs adresses Solana
  const tokenAddresses: { [key: string]: string } = {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  };

  const handleSimulateRoute = async () => {
    if (!inputAmount || !connected) return;

    setLoading(true);
    try {
      const inputMint = tokenAddresses[inputToken];
      const outputMint = tokenAddresses[outputToken];

      if (!inputMint || !outputMint) {
        throw new Error("Token non supporté");
      }

      // Appeler l'API SwapBack pour simuler la route
      const response = await fetch('http://localhost:3003/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputMint,
          outputMint,
          inputAmount: (parseFloat(inputAmount) * 1000000).toString(), // Convertir en lamports pour USDC
          slippage: slippage / 100,
          userPubkey: publicKey?.toString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la simulation de route');
      }

      const data = await response.json();

      // Transformer les données de l'API en format RouteInfo
      const route: RouteInfo = {
        type: data.type || "Aggregator",
        estimatedOutput: data.estimatedOutput / 1000000 || 0, // Convertir depuis lamports
        npi: data.npi / 1000000 || 0,
        rebate: data.rebateAmount / 1000000 || 0,
        burn: data.burnAmount / 1000000 || 0,
        fees: data.fees / 1000000 || 0,
      };

      setRouteInfo(route);
      setOutputAmount(route.estimatedOutput.toFixed(6));
    } catch (error) {
      console.error("Erreur lors de la simulation:", error);
      // Fallback vers les données mockées en cas d'erreur
      const mockRoute: RouteInfo = {
        type: "Aggregator",
        estimatedOutput: parseFloat(inputAmount) * 0.005,
        npi: parseFloat(inputAmount) * 0.002,
        rebate: parseFloat(inputAmount) * 0.0015,
        burn: parseFloat(inputAmount) * 0.0005,
        fees: parseFloat(inputAmount) * 0.001,
      };

      setRouteInfo(mockRoute);
      setOutputAmount(mockRoute.estimatedOutput.toFixed(6));
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!connected || !publicKey || !routeInfo) return;

    setLoading(true);
    try {
      // TODO: Implémenter l'exécution du swap via le SDK SwapBack
      console.log("Exécution du swap...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      alert("Swap exécuté avec succès!");

      // Reset
      setInputAmount("");
      setOutputAmount("");
      setRouteInfo(null);
    } catch (error) {
      console.error("Erreur lors du swap:", error);
      alert("Erreur lors du swap");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="swap-card">
      <h2 className="text-2xl font-bold mb-6">Swap Optimisé</h2>

      {/* Input Token */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Vous payez</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => {
              setInputAmount(e.target.value);
              setRouteInfo(null);
            }}
            placeholder="0.00"
            className="input-field flex-1"
            disabled={!connected}
          />
          <select
            value={inputToken}
            onChange={(e) => setInputToken(e.target.value)}
            className="input-field w-32"
            disabled={!connected}
          >
            <option value="USDC">USDC</option>
            <option value="SOL">SOL</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
      </div>

      {/* Swap Icon */}
      <div className="flex justify-center my-4">
        <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition">
          ↓
        </button>
      </div>

      {/* Output Token */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">Vous recevez</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={outputAmount}
            placeholder="0.00"
            className="input-field flex-1"
            disabled
          />
          <select
            value={outputToken}
            onChange={(e) => setOutputToken(e.target.value)}
            className="input-field w-32"
            disabled={!connected}
          >
            <option value="SOL">SOL</option>
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
      </div>

      {/* Slippage */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">
          Tolérance de slippage: {slippage}%
        </label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={slippage}
          onChange={(e) => setSlippage(parseFloat(e.target.value))}
          className="w-full"
          disabled={!connected}
        />
      </div>

      {/* Route Info */}
      {routeInfo && (
        <div className="mb-6 p-4 bg-black/30 rounded-lg">
          <h3 className="text-sm font-semibold mb-3 text-[var(--primary)]">
            Route Optimisée ({routeInfo.type})
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">NPI (Net Price Improvement)</span>
              <span className="text-green-400">
                +{routeInfo.npi.toFixed(4)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Votre remise (75%)</span>
              <span className="text-green-400">
                +{routeInfo.rebate.toFixed(4)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Burn $BACK (25%)</span>
              <span className="text-orange-400">
                {routeInfo.burn.toFixed(4)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Frais réseau</span>
              <span>{routeInfo.fees.toFixed(4)} USDC</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {!connected ? (
          <div className="text-center text-gray-400 py-4">
            Connectez votre wallet pour commencer
          </div>
        ) : !routeInfo ? (
          <button
            onClick={handleSimulateRoute}
            disabled={!inputAmount || loading}
            className="btn-primary w-full"
          >
            {loading ? "Simulation..." : "Simuler la route"}
          </button>
        ) : (
          <button
            onClick={handleExecuteSwap}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Exécution..." : `Swap ${inputToken} → ${outputToken}`}
          </button>
        )}
      </div>
    </div>
  );
};
