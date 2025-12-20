"use client";

import { FC, ReactNode, useMemo, useCallback, useState, useEffect } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, WalletConnectionError, WalletError, WalletNotReadyError } from "@solana/wallet-adapter-base";
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
function getBrowserRpcEndpoint(): string {
  if (typeof window === 'undefined') {
    // SSR: retourner un placeholder (sera remplacé côté client)
    return 'https://api.mainnet-beta.solana.com';
  }
  // Client: construire l'URL absolue
  return `${window.location.origin}/api/solana-rpc`;
}

const AUTOCONNECT_COOLDOWN_KEY = "swapback-autoconnect-disabled-until";
const AUTOCONNECT_COOLDOWN_MS = 2 * 60 * 1000;

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
    // Le WalletProvider est un composant client: dériver l'URL absolue.
    return [getBrowserRpcEndpoint()];
  }, [network]);
  
  const endpoint = useMemo(() => {
    return rpcEndpoints[rpcIndex] || rpcEndpoints[0] || getBrowserRpcEndpoint();
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

  const autoConnect = useCallback(async () => {
    if (typeof window === "undefined") return false;
    const disabledUntilRaw = window.localStorage.getItem(AUTOCONNECT_COOLDOWN_KEY);
    const disabledUntil = disabledUntilRaw ? Number(disabledUntilRaw) : 0;
    if (Number.isFinite(disabledUntil) && disabledUntil > Date.now()) {
      return false;
    }
    return true;
  }, []);

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

    // Si l'utilisateur refuse la demande (souvent due  l'autoConnect),
    // 	viter de re-tenter immédiatement et de spammer des popups/erreurs.
    if (
      error instanceof WalletConnectionError ||
      (typeof error?.message === "string" && error.message.toLowerCase().includes("rejected"))
    ) {
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            AUTOCONNECT_COOLDOWN_KEY,
            String(Date.now() + AUTOCONNECT_COOLDOWN_MS)
          );
        }
      } catch {
        // ignore localStorage errors
      }
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
        autoConnect={autoConnect}
        localStorageKey="swapback-wallet" // Clé unique pour éviter les conflits
        onError={onError} // Handle errors gracefully
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
