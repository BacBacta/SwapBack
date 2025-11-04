/**
 * 💰 Composant ClaimBuyback - Interface de Réclamation des Buybacks
 *
 * Version simplifiée - Fonctionnalité en développement
 *
 * @author SwapBack Team
 * @date November 4, 2025
 */

"use client";

import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export default function ClaimBuyback() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-black/50 border border-[var(--primary)]/30 rounded-lg p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--primary)] mb-4">
            [CLAIM BUYBACK]
          </h2>
          <p className="text-gray-400 mb-6">
            Fonctionnalité en développement
          </p>
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-4">
            <p className="text-yellow-400 text-sm">
              Le système de claim buyback n'est pas encore implémenté.
              Cette fonctionnalité sera disponible dans une future mise à jour.
            </p>
          </div>
          {connected && publicKey && (
            <div className="mt-4 text-xs text-gray-500">
              Wallet connecté: {publicKey.toString().slice(0, 8)}...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
