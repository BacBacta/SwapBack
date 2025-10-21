"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useConnectionStability } from "../hooks/useConnectionStability";

// Import des styles du wallet adapter
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletStabilityManager: FC<{ children: ReactNode }> = ({ children }) => {
  // Utiliser le hook de stabilité des connexions
  useConnectionStability();

  return <>{children}</>;
};

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Configuration du réseau (devnet pour développement)
  const network = WalletAdapterNetwork.Devnet;

  // Utiliser RPC custom si disponible, sinon Helius, sinon clusterApiUrl
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_URL) {
      return process.env.NEXT_PUBLIC_RPC_URL;
    }
    if (process.env.NEXT_PUBLIC_HELIUS_API_KEY) {
      return `https://devnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;
    }
    return clusterApiUrl(network);
  }, [network]);

  // Configuration des wallets supportés avec reconnexion automatique
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // Backpack ajouté pour devnet testing
    ],
    []
  );

  // Configuration de connexion avec retry et timeout plus long
  const connectionConfig = useMemo(
    () => ({
      commitment: "confirmed" as const,
      confirmTransactionInitialTimeout: 60000, // 60 secondes
      disableRetryOnRateLimit: false,
      wsEndpoint: endpoint
        .replace("https://", "wss://")
        .replace("http://", "ws://"),
    }),
    [endpoint]
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <SolanaWalletProvider
        wallets={wallets}
        autoConnect={true}
        localStorageKey="swapback-wallet"
      >
        <WalletModalProvider>
          <WalletStabilityManager>{children}</WalletStabilityManager>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
