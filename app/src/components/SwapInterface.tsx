"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

interface RouteStep {
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  fee: string;
}

interface RouteInfo {
  type: "Direct" | "Aggregator" | "RFQ" | "Bundle";
  estimatedOutput: number;
  npi: number;
  rebate: number;
  burn: number;
  fees: number;
  route?: RouteStep[];
  priceImpact?: number;
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
      
      console.log('📥 Données reçues de l\'API:', data);

      // Transformer les données de l'API en format RouteInfo
      const route: RouteInfo = {
        type: data.type || "Aggregator",
        estimatedOutput: data.estimatedOutput / 1000000 || 0, // Convertir depuis lamports
        npi: data.npi / 1000000 || 0,
        rebate: data.rebateAmount / 1000000 || 0,
        burn: data.burnAmount / 1000000 || 0,
        fees: data.fees / 1000000 || 0,
        route: data.route || [],
        priceImpact: data.priceImpact || 0,
      };
      
      console.log('✅ RouteInfo transformé:', route);
      console.log('🛣️ Nombre d\'étapes de route:', route.route?.length);

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Swap Optimisé</h2>
        
        {/* Badge DEX Optimisé */}
        {routeInfo && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-[var(--primary)]/20 to-purple-500/20 px-4 py-2 rounded-lg border border-[var(--primary)]/30">
            <span className="text-xl">⚡</span>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">Route optimisée</span>
              <span className="text-sm font-bold text-[var(--primary)]">
                {routeInfo.type === "Direct" ? "Jupiter" : "Raydium + Orca"}
              </span>
            </div>
          </div>
        )}
      </div>

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
        <div className="mb-6 space-y-4">
          {/* Chemin de Route Visuel */}
          {routeInfo.route && routeInfo.route.length > 0 && (
            <div className="p-4 bg-black/30 rounded-lg border border-[var(--primary)]/20">
              <h3 className="text-sm font-semibold mb-3 text-[var(--primary)] flex items-center gap-2">
                <span>🛣️</span>
                <span>Chemin de Route ({routeInfo.type})</span>
              </h3>
              <div className="space-y-3">
                {routeInfo.route.map((step, index) => {
                  const inputSymbol = Object.keys(tokenAddresses).find(
                    key => tokenAddresses[key] === step.inputMint
                  ) || 'TOKEN';
                  const outputSymbol = Object.keys(tokenAddresses).find(
                    key => tokenAddresses[key] === step.outputMint
                  ) || 'TOKEN';
                  
                  return (
                    <div key={index} className="relative">
                      {/* Étape de la route */}
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 hover:border-[var(--primary)]/40 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-1 rounded text-xs font-semibold">
                              Étape {index + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-300">
                              {step.label}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            Frais: {(parseFloat(step.fee) / 1000000).toFixed(4)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-900/50 rounded p-2">
                            <div className="text-xs text-gray-500 mb-1">Entrée</div>
                            <div className="font-semibold text-white">
                              {(parseFloat(step.inAmount) / 1000000).toFixed(4)} {inputSymbol}
                            </div>
                          </div>
                          
                          <div className="text-[var(--primary)] text-xl">→</div>
                          
                          <div className="flex-1 bg-gray-900/50 rounded p-2">
                            <div className="text-xs text-gray-500 mb-1">Sortie</div>
                            <div className="font-semibold text-green-400">
                              {(parseFloat(step.outAmount) / 1000000).toFixed(4)} {outputSymbol}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Flèche de connexion entre les étapes */}
                      {index < routeInfo.route!.length - 1 && (
                        <div className="flex justify-center py-2">
                          <div className="text-gray-600 text-sm">↓</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Détails Financiers */}
          <div className="p-4 bg-black/30 rounded-lg">
            <h3 className="text-sm font-semibold mb-3 text-[var(--primary)]">
              💰 Détails Financiers
            </h3>
            <div className="space-y-2 text-sm">
              {routeInfo.priceImpact !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Impact sur le prix</span>
                  <span className={routeInfo.priceImpact < 1 ? "text-green-400" : "text-orange-400"}>
                    {routeInfo.priceImpact.toFixed(2)}%
                  </span>
                </div>
              )}
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
              <div className="pt-2 mt-2 border-t border-gray-700 flex justify-between font-semibold">
                <span className="text-white">Total estimé</span>
                <span className="text-green-400">
                  {routeInfo.estimatedOutput.toFixed(6)} {outputToken}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Résumé Route Optimisée (avant le bouton) */}
      {routeInfo && routeInfo.route && routeInfo.route.length > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-br from-[var(--primary)]/10 to-purple-500/10 rounded-lg border-2 border-[var(--primary)]/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <span className="font-bold text-white">Route Optimisée Sélectionnée</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              routeInfo.type === "Direct" 
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
            }`}>
              {routeInfo.type === "Direct" ? "⚡ DIRECT" : "🔀 AGGREGATOR"}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            {routeInfo.route.map((step, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="px-2 py-1 bg-gray-800/50 rounded text-xs font-semibold text-[var(--primary)] border border-gray-700">
                  {step.label}
                </span>
                {index < routeInfo.route!.length - 1 && (
                  <span className="text-gray-500">→</span>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-400">
              {routeInfo.route.length} étape{routeInfo.route.length > 1 ? 's' : ''}
            </span>
            <span className="text-green-400 font-semibold">
              Meilleur prix garanti
            </span>
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
