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
import { DEFAULT_SOLANA_NETWORK, DEFAULT_SOLANA_RPC_URL } from "@/config/constants";

// Import des styles du wallet adapter
import "@solana/wallet-adapter-react-ui/styles.css";

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Configuration du réseau - MAINNET pour production
  // Le réseau est déterminé par NEXT_PUBLIC_SOLANA_NETWORK dans .env.local
  const networkEnv = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || DEFAULT_SOLANA_NETWORK).toLowerCase();
  
  // Map network string to WalletAdapterNetwork enum
  const getNetwork = () => {
    switch (networkEnv) {
      case 'devnet':
        return WalletAdapterNetwork.Devnet;
      case 'testnet':
        return WalletAdapterNetwork.Testnet;
      case 'mainnet-beta':
      case 'mainnet':
        return WalletAdapterNetwork.Mainnet;
      default:
        return WalletAdapterNetwork.Devnet;
    }
  };
  
  const network = getNetwork();
  const endpoint = useMemo(() => {
    // Utiliser la RPC URL de l'environnement si disponible
    const rpcFromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (rpcFromEnv && rpcFromEnv.trim() !== "") {
      return rpcFromEnv;
    }
    if (network === WalletAdapterNetwork.Devnet) {
      return DEFAULT_SOLANA_RPC_URL;
    }
    return clusterApiUrl(network);
  }, [network]);

  // Configuration des wallets supportés
  // WalletMultiButton détectera automatiquement tous les wallets installés
  // incluant Phantom, Solflare, Backpack, Glow, Slope, etc.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // Autres wallets auto-détectés via window.solana
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider
        wallets={wallets}
        autoConnect={true} // Activer autoConnect pour la persistance de connexion
        localStorageKey="swapback-wallet" // Clé unique pour éviter les conflits
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
