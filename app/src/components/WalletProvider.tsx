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

// Fallback RPC endpoints pour mainnet - ordered by reliability
// NOTE: Avoid Helius public endpoints (rate limited)
const MAINNET_FALLBACK_RPCS = [
  // Primary: Solana official (most reliable, no rate limits for basic usage)
  "https://api.mainnet-beta.solana.com",
  // Fallbacks with CORS support
  "https://rpc.ankr.com/solana", // Ankr - supports CORS, 30 req/sec
  "https://solana.publicnode.com", // PublicNode - supports CORS
  "https://solana-mainnet.rpc.extrnode.com", // ExtrNode - supports CORS
  "https://solana-rpc.publicnode.com", // PublicNode alt
];

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
  
  // Build list of RPC endpoints with fallbacks
  const rpcEndpoints = useMemo(() => {
    const endpoints: string[] = [];
    
    // Primary: environment RPC (validate it's a valid URL)
    const rpcFromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (rpcFromEnv && rpcFromEnv.trim() !== "" && rpcFromEnv.startsWith("http")) {
      endpoints.push(rpcFromEnv.trim());
    }
    
    // Add fallbacks for mainnet
    if (network === WalletAdapterNetwork.Mainnet) {
      endpoints.push(...MAINNET_FALLBACK_RPCS);
    } else if (network === WalletAdapterNetwork.Devnet) {
      endpoints.push(DEFAULT_SOLANA_RPC_URL);
      endpoints.push("https://api.devnet.solana.com");
    }
    
    // CRITICAL: Ensure we always have at least one valid endpoint
    if (endpoints.length === 0) {
      console.warn("No valid RPC endpoints configured, using Solana public RPC");
      endpoints.push("https://api.mainnet-beta.solana.com");
    }
    
    return [...new Set(endpoints)]; // Remove duplicates
  }, [network]);
  
  const endpoint = useMemo(() => {
    const selected = rpcEndpoints[rpcIndex] || rpcEndpoints[0];
    // Final validation: must be a valid HTTP(S) URL
    if (!selected || !selected.startsWith("http")) {
      console.error("Invalid RPC endpoint, falling back to Solana public RPC");
      return "https://api.mainnet-beta.solana.com";
    }
    return selected;
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
