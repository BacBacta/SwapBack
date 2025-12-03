"use client";

import { FC, ReactNode, useMemo, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, WalletError, WalletNotReadyError } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { clusterApiUrl } from "@solana/web3.js";
import { DEFAULT_SOLANA_NETWORK, DEFAULT_SOLANA_RPC_URL } from "@/config/constants";
import { monitor } from "@/lib/protocolMonitor";

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
  // Sur mobile, les wallets injectent window.solana
  // L'adapter les détectera automatiquement
  const wallets = useMemo(
    () => [
      // Phantom - supporte mobile via deep linking
      new PhantomWalletAdapter(),
      // Solflare - supporte mobile
      new SolflareWalletAdapter(),
      // Backpack
      new BackpackWalletAdapter(),
      // Les autres wallets mobiles seront auto-détectés via window.solana
    ],
    []
  );

  // Handle wallet errors gracefully - especially WalletNotReadyError
  const onError = useCallback((error: WalletError) => {
    // Silently ignore WalletNotReadyError - this happens when:
    // 1. Extension is not installed
    // 2. On mobile without the wallet app
    // 3. autoConnect tries to connect before wallet is ready
    if (error instanceof WalletNotReadyError) {
      console.debug("Wallet not ready - extension may not be installed or mobile app not detected");
      return;
    }
    
    // Log wallet errors to protocol monitor
    monitor.walletError(error.message, {
      component: 'WalletProvider',
      action: 'onError',
      errorCode: error.name,
    });
    
    // Log other errors for debugging
    console.error("Wallet error:", error.name, error.message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider
        wallets={wallets}
        autoConnect={true} // Keep autoConnect for UX, but errors are now handled
        localStorageKey="swapback-wallet" // Clé unique pour éviter les conflits
        onError={onError} // Handle errors gracefully
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
