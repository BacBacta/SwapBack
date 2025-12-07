"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { showToast } from "@/lib/toast";
import { MobileWalletModal } from "./MobileWalletModal";

// Mobile wallet deep links - these open the app directly
const MOBILE_WALLETS = {
  phantom: {
    name: 'Phantom',
    icon: '👻',
    // Use connect deep link format for Phantom
    getConnectLink: () => `phantom://`,
    getBrowseLink: (url: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}`,
  },
  solflare: {
    name: 'Solflare', 
    icon: '🔥',
    getConnectLink: () => `solflare://`,
    getBrowseLink: (url: string) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}`,
  },
};

export const ClientOnlyWallet = () => {
  const { connected, connecting, publicKey, wallet, disconnect, wallets, select } = useWallet();
  const { visible, setVisible } = useWalletModal();
  const { connection } = useConnection();
  const [network, setNetwork] = useState<"mainnet-beta" | "devnet" | "testnet">(
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "mainnet-beta" | "devnet" | "testnet") || "testnet"
  );
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileWalletModal, setShowMobileWalletModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Critical: Only render wallet button client-side to avoid SSR issues
  useEffect(() => {
    setMounted(true);
    // Detect mobile
    const checkMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent.toLowerCase()
    );
    setIsMobile(checkMobile);
  }, []);

  // Check if any wallet is ready (installed) - on mobile this is usually false in regular browser
  const hasInstalledWallet = wallets.some(
    w => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable
  );

  // On mobile, we use our custom modal instead of wallet-adapter's modal
  // Just prevent the standard modal from opening
  useEffect(() => {
    if (isMobile && visible) {
      setVisible(false);
    }
  }, [visible, isMobile, setVisible]);

  // Detect network from RPC endpoint (NO RPC CALL - just parse endpoint URL)
  useEffect(() => {
    const detectNetwork = () => {
      try {
        const endpoint = connection.rpcEndpoint;
        console.log('[ClientOnlyWallet] RPC endpoint:', endpoint);
        
        if (endpoint.includes("devnet")) {
          setNetwork("devnet");
        } else if (endpoint.includes("testnet")) {
          setNetwork("testnet");
        } else if (endpoint.includes("mainnet") || endpoint.includes("ankr") || endpoint.includes("publicnode")) {
          setNetwork("mainnet-beta");
        }
        
        // Check if connected to wrong network
        const expectedNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta";
        const wrongNetwork = network !== expectedNetwork;
        console.log('[ClientOnlyWallet] Network:', network, '| Expected:', expectedNetwork, '| Wrong?', wrongNetwork);
        setIsWrongNetwork(wrongNetwork);
      } catch (error) {
        console.error("[ClientOnlyWallet] Network detection error:", error);
      }
    };
    detectNetwork();
  }, [connection, network]);

  // Fetch wallet balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (connected && publicKey) {
        const startTime = Date.now();
        console.log('[ClientOnlyWallet] Fetching balance for:', publicKey.toBase58().substring(0, 8) + '...');
        console.log('[ClientOnlyWallet] Using RPC:', connection.rpcEndpoint);
        
        try {
          const bal = await connection.getBalance(publicKey);
          console.log('[ClientOnlyWallet] Balance fetched:', bal / 1e9, 'SOL in', Date.now() - startTime, 'ms');
          setBalance(bal / 1e9); // Convert lamports to SOL
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[ClientOnlyWallet] ERROR fetching balance:");
          console.error("[ClientOnlyWallet] Error:", errorMessage);
          console.error("[ClientOnlyWallet] RPC:", connection.rpcEndpoint);
          
          if (errorMessage.includes('429')) {
            console.error("[ClientOnlyWallet] ⚠️ RATE LIMITED (429)");
          }
        }
      } else {
        setBalance(null);
      }
    };
    
    // Delay initial fetch to stagger RPC calls
    const timeoutId = setTimeout(fetchBalance, 500);
    
    // Refresh balance every 60s (increased to avoid rate limiting)
    const interval = setInterval(fetchBalance, 60000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [connected, publicKey, connection]);

  // Toast notifications for wallet events
  useEffect(() => {
    if (connected && publicKey) {
      showToast.success(`Wallet connected: ${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`);
      setShowMobileWalletModal(false);
    }
  }, [connected, publicKey]);

  const handleConnect = useCallback(() => {
    // On mobile, always show our custom modal (more reliable)
    if (isMobile) {
      setShowMobileWalletModal(true);
    } else {
      // On desktop, use the standard wallet modal
      setVisible(true);
    }
  }, [setVisible, isMobile]);

  const handleMobileWalletSelect = (walletKey: keyof typeof MOBILE_WALLETS) => {
    const walletConfig = MOBILE_WALLETS[walletKey];
    const currentUrl = window.location.origin + window.location.pathname;
    
    // Use the browse deep link to open the current page in the wallet's browser
    const deepLink = walletConfig.getBrowseLink(currentUrl);
    
    // Close our modal first
    setShowMobileWalletModal(false);
    
    // Small delay then redirect
    setTimeout(() => {
      window.location.href = deepLink;
    }, 100);
  };

  const handleDisconnect = useCallback(async () => {
    try {
      // Close menu first
      setShowMenu(false);
      
      // Disconnect the wallet
      await disconnect();
      
      // Clear any cached wallet data
      if (typeof window !== 'undefined') {
        // Clear localStorage wallet keys
        localStorage.removeItem('walletName');
        localStorage.removeItem('swapback-wallet');
        
        // Force clear wallet adapter state
        try {
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.includes('wallet') || key.includes('Wallet')) {
              localStorage.removeItem(key);
            }
          });
        } catch (e) {
          // Ignore storage errors
        }
      }
      
      showToast.info("Wallet disconnected");
      
      // On mobile, sometimes we need to reload to fully disconnect
      if (isMobile) {
        // Small delay then reload to ensure clean state
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      console.error("Disconnect error:", error);
      showToast.error("Failed to disconnect wallet");
      
      // Force reload on error for mobile
      if (isMobile) {
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    }
  }, [disconnect, isMobile]);

  const copyAddress = useCallback(() => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      showToast.success("Address copied to clipboard!");
    }
  }, [publicKey]);

  const viewOnExplorer = useCallback(() => {
    if (publicKey) {
      const explorerUrl = network === "devnet"
        ? `https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`
        : `https://explorer.solana.com/address/${publicKey.toBase58()}`;
      window.open(explorerUrl, "_blank");
    }
  }, [publicKey, network]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.wallet-menu-container')) {
          setShowMenu(false);
        }
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);

  // Prevent SSR rendering to avoid infinite recursion with wallet adapter
  if (!mounted) {
    return (
      <div className="w-[140px] h-[40px] bg-gray-800 animate-pulse rounded-lg" />
    );
  }

  // Show connecting state
  if (connecting) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg min-h-[44px]">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Connecting...</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2 wallet-menu-container">
      {/* Network Badge - Hidden on mobile */}
      {connected && (
        <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
          isWrongNetwork 
            ? "bg-red-500/20 text-red-400 border border-red-500/50" 
            : network === "devnet"
            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
            : "bg-green-500/20 text-green-400 border border-green-500/50"
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            isWrongNetwork ? "bg-red-400 animate-pulse" : 
            network === "devnet" ? "bg-yellow-400" : "bg-green-400"
          }`} />
          {network === "devnet" ? "DEVNET" : "MAINNET"}
        </div>
      )}

      {/* Wallet Button - Custom button for better control */}
      {!connected ? (
        <button
          onClick={handleConnect}
          className="bg-primary hover:bg-primary-hover text-black font-bold px-4 py-2 rounded-lg text-sm min-h-[44px] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 flex items-center gap-2"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Connect Wallet</span>
        </button>
      ) : (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="bg-gray-800 hover:bg-gray-700 text-white font-medium px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 text-xs sm:text-sm min-h-[44px] border border-gray-700 transition-all"
          >
            {wallet?.adapter.icon && (
              <img 
                src={wallet.adapter.icon} 
                alt={wallet.adapter.name} 
                className="w-5 h-5 rounded-full" 
              />
            )}
            <span className="font-mono">
              {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
            </span>
            {balance !== null && (
              <span className="text-primary text-xs hidden sm:inline font-medium">
                {balance.toFixed(2)} SOL
              </span>
            )}
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${showMenu ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-[100] overflow-hidden">
              <div className="p-4 border-b border-gray-800 bg-gray-800/50">
                <div className="flex items-center gap-3 mb-3">
                  {wallet?.adapter.icon && (
                    <img 
                      src={wallet.adapter.icon} 
                      alt={wallet.adapter.name} 
                      className="w-8 h-8 rounded-full" 
                    />
                  )}
                  <div>
                    <span className="font-bold text-white block">{wallet?.adapter.name}</span>
                    <span className="text-xs text-gray-400">Connected</span>
                  </div>
                </div>
                <div className="text-sm text-gray-400 font-mono break-all bg-gray-900/50 p-2 rounded-lg">
                  {publicKey?.toBase58()}
                </div>
                {balance !== null && (
                  <div className="mt-3 text-xl font-bold text-primary">
                    {balance.toFixed(4)} SOL
                  </div>
                )}
              </div>
              
              <div className="p-2">
                <button
                  onClick={copyAddress}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800 rounded-lg text-white flex items-center gap-3 transition-colors"
                >
                  <span className="text-lg">📋</span>
                  <span>Copy Address</span>
                </button>
                <button
                  onClick={viewOnExplorer}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800 rounded-lg text-white flex items-center gap-3 transition-colors"
                >
                  <span className="text-lg">🔍</span>
                  <span>View on Explorer</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="w-full text-left px-4 py-3 hover:bg-red-900/30 rounded-lg text-red-400 flex items-center gap-3 transition-colors mt-1 border-t border-gray-800 pt-3"
                >
                  <span className="text-lg">🚪</span>
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wrong Network Warning */}
      {isWrongNetwork && connected && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-red-500/10 border border-red-500 rounded-lg p-3 text-sm text-red-400 z-50">
          ⚠️ You&apos;re on {network}. Please switch to {process.env.NEXT_PUBLIC_SOLANA_NETWORK || "testnet"}.
        </div>
      )}

      {/* Mobile Wallet Selection Modal - Using Portal */}
      <MobileWalletModal
        isOpen={showMobileWalletModal}
        onClose={() => setShowMobileWalletModal(false)}
        onSelectPhantom={() => handleMobileWalletSelect('phantom')}
        onSelectSolflare={() => handleMobileWalletSelect('solflare')}
      />
    </div>
  );
};
