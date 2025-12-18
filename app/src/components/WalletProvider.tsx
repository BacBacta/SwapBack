"use client";

import { FC, ReactNode, useMemo, useCallback, useState, useEffect } from "react";
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

// IMPORTANT: le navigateur ne doit pas appeler directement un RPC tiers (CORS/429).
// On force un endpoint same-origin qui proxy vers des upstreams côté serveur.
const BROWSER_RPC_ENDPOINT = "/api/solana-rpc";

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [rpcIndex, setRpcIndex] = useState(0);
  const [rpcError, setRpcError] = useState(false);
  
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
  
  // Build list of RPC endpoints
  const rpcEndpoints = useMemo(() => {
    // Le WalletProvider est un composant client: endpoint relatif OK.
    return [BROWSER_RPC_ENDPOINT];
  }, [network]);
  
  const endpoint = useMemo(() => {
    return rpcEndpoints[rpcIndex] || rpcEndpoints[0] || BROWSER_RPC_ENDPOINT;
  }, [rpcEndpoints, rpcIndex]);
  
  // Test RPC connection and fallback if needed (only once per endpoint)
  useEffect(() => {
    let isMounted = true;
    
    const testConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'health-check',
            method: 'getHealth',
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!isMounted) return;
        
        if (response.status === 403 || response.status === 429) {
          console.warn(`RPC ${endpoint.substring(0, 50)}... returned ${response.status}, trying fallback...`);
          setRpcError(true);
          if (rpcIndex < rpcEndpoints.length - 1) {
            setRpcIndex(prev => prev + 1);
          } else {
            console.error("All RPC endpoints failed. Please configure a valid RPC in .env.local");
          }
        } else {
          console.log(`✅ Connected to RPC: ${endpoint.substring(0, 50)}...`);
          setRpcError(false);
        }
      } catch (error) {
        if (!isMounted) return;
        console.warn(`RPC ${endpoint.substring(0, 50)}... failed, trying fallback...`);
        if (rpcIndex < rpcEndpoints.length - 1) {
          setRpcIndex(prev => prev + 1);
        } else {
          console.error("All RPC endpoints failed. Please configure a valid RPC in .env.local");
        }
      }
    };
    
    testConnection();
    
    return () => { isMounted = false; };
  }, [endpoint, rpcIndex, rpcEndpoints.length]);

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
