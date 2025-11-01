"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

export const NetworkStatusIndicator = () => {
  const { connected } = useWallet();
  const { connection } = useConnection();
  const [networkInfo, setNetworkInfo] = useState<{
    name: string;
    color: string;
    description: string;
  }>({
    name: "DEVNET",
    color: "text-orange-400",
    description: "Réseau de test"
  });

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const genesisHash = await connection.getGenesisHash();
        const devnetGenesisHash = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

        if (genesisHash === devnetGenesisHash) {
          setNetworkInfo({
            name: "DEVNET",
            color: "text-orange-400",
            description: "Réseau de test"
          });
        } else {
          setNetworkInfo({
            name: "MAINNET",
            color: "text-green-400",
            description: "Réseau principal"
          });
        }
      } catch (error) {
        console.warn("Impossible de vérifier le réseau:", error);
      }
    };

    if (connected) {
      checkNetwork();
    }
  }, [connected, connection]);

  if (!connected) return null;

  return (
    <div className="fixed top-4 left-4 z-40 bg-black border border-gray-700 rounded-lg px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full bg-current ${networkInfo.color}`}></div>
        <div className="text-xs">
          <div className={`font-bold ${networkInfo.color} terminal-text`}>
            {networkInfo.name}
          </div>
          <div className="text-gray-400">
            {networkInfo.description}
          </div>
        </div>
      </div>
    </div>
  );
};