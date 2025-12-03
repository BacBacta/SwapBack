"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { showToast } from "@/lib/toast";

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
  const [network, setNetwork] = useState<"mainnet-beta" | "devnet">(
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "mainnet-beta" | "devnet") || "devnet"
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

  // Detect network from RPC endpoint
  useEffect(() => {
    const detectNetwork = async () => {
      try {
        const endpoint = connection.rpcEndpoint;
        if (endpoint.includes("devnet")) {
          setNetwork("devnet");
        } else if (endpoint.includes("mainnet")) {
          setNetwork("mainnet-beta");
        }
        
        // Check if connected to wrong network
        const expectedNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta";
        setIsWrongNetwork(network !== expectedNetwork);
      } catch (error) {
        console.error("Network detection error:", error);
      }
    };
    detectNetwork();
  }, [connection, network]);

  // Fetch wallet balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (connected && publicKey) {
        try {
          const bal = await connection.getBalance(publicKey);
          setBalance(bal / 1e9); // Convert lamports to SOL
        } catch (error) {
          console.error("Error fetching balance:", error);
        }
      } else {
        setBalance(null);
      }
    };
    fetchBalance();
    
    // Refresh balance every 30s
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
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
      await disconnect();
      showToast.info("Wallet disconnected");
      setShowMenu(false);
    } catch (error) {
      console.error("Disconnect error:", error);
      showToast.error("Failed to disconnect wallet");
    }
  }, [disconnect]);

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
          ⚠️ You&apos;re on {network}. Please switch to {process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta"}.
        </div>
      )}

      {/* Mobile Wallet Selection Modal */}
      {showMobileWalletModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 9999999 }}
        >
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/95 backdrop-blur-md"
            onClick={() => setShowMobileWalletModal(false)}
          />
          
          {/* Modal Content - Centered */}
          <div 
            className="relative w-full max-w-sm bg-[#0a0a14] border-2 border-primary/50 rounded-3xl overflow-hidden shadow-2xl shadow-primary/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowMobileWalletModal(false)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Header */}
            <div className="p-6 pb-4 border-b border-gray-800">
              <h2 className="text-2xl font-bold text-white text-center">
                Connect Wallet
              </h2>
              <p className="text-gray-400 text-sm text-center mt-2">
                Choose your Solana wallet
              </p>
            </div>

            {/* Wallet Options */}
            <div className="p-4 space-y-3">
              <button
                onClick={() => handleMobileWalletSelect('phantom')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold flex items-center gap-4 active:scale-[0.98] transition-transform shadow-lg"
              >
                <span className="text-3xl">👻</span>
                <div className="flex-1 text-left">
                  <div className="font-bold text-lg">Phantom</div>
                  <div className="text-xs opacity-80">Tap to open</div>
                </div>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              <button
                onClick={() => handleMobileWalletSelect('solflare')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold flex items-center gap-4 active:scale-[0.98] transition-transform shadow-lg"
              >
                <span className="text-3xl">🔥</span>
                <div className="flex-1 text-left">
                  <div className="font-bold text-lg">Solflare</div>
                  <div className="text-xs opacity-80">Tap to open</div>
                </div>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Info */}
            <div className="p-4 pt-0">
              <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
                <p className="text-xs text-primary text-center">
                  💡 Make sure Phantom or Solflare is installed on your device
                </p>
              </div>
            </div>

            {/* Cancel Button */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setShowMobileWalletModal(false)}
                className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
