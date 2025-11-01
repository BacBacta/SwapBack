"use client";

import { useState } from "react";

const NETWORK_INFO = {
  devnet: {
    name: "Devnet (Test Network)",
    color: "text-orange-400",
    contracts: {
      "SwapBack Program": "9pW8X7p9zQXJc8Q8QH8QH8QH8QH8QH8QH8QH8QH8QH8",
      "Token Mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "Router Program": "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
    }
  },
  mainnet: {
    name: "Mainnet (Production)",
    color: "text-green-400",
    contracts: {
      "SwapBack Program": "SwapBack11111111111111111111111111111112",
      "Token Mint": "So11111111111111111111111111111111111111112",
      "Router Program": "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
    }
  }
};

export const NetworkInfoModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'devnet' | 'mainnet'>('devnet');

  const currentNetwork = NETWORK_INFO[activeTab];

  return (
    <>
      {/* Bouton pour ouvrir la modal */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-40 bg-black border border-gray-700 hover:border-[var(--primary)] rounded-lg px-3 py-2 text-xs text-gray-300 hover:text-white transition-colors"
        title="Informations réseau"
      >
        🔗 Réseau
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-black border-2 border-[var(--primary)] rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[var(--primary)] terminal-text">
                  Informations Réseau SwapBack
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Onglets */}
              <div className="flex gap-2 mb-6">
                {Object.entries(NETWORK_INFO).map(([key, network]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as 'devnet' | 'mainnet')}
                    className={`px-4 py-2 rounded font-bold transition-colors ${
                      activeTab === key
                        ? `bg-[var(--primary)] text-black`
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {network.name}
                  </button>
                ))}
              </div>

              {/* Contenu */}
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className={`text-lg font-bold mb-3 ${currentNetwork.color}`}>
                    {currentNetwork.name}
                  </h3>

                  <div className="space-y-3">
                    {Object.entries(currentNetwork.contracts).map(([name, address]) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-gray-300 font-medium">{name}:</span>
                        <code className="bg-gray-800 px-2 py-1 rounded text-xs font-mono text-[var(--primary)]">
                          {address}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
                  <h4 className="text-blue-400 font-bold mb-2">⚠️ Important</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Assurez-vous que votre wallet est connecté au bon réseau</li>
                    <li>• Les adresses devnet sont pour les tests uniquement</li>
                    <li>• Utilisez mainnet pour les transactions réelles</li>
                    <li>• Vérifiez toujours les adresses avant d'interagir</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};