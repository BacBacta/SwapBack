"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { showToast } from "@/lib/toast";
import { clusterApiUrl } from "@solana/web3.js";

export const ClientOnlyWallet = () => {
  const { connected, connecting, publicKey, wallet, disconnect } = useWallet();
  const { connection } = useConnection();
  const [network, setNetwork] = useState<"mainnet-beta" | "devnet">("mainnet-beta");
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Critical: Only render wallet button client-side to avoid SSR issues
  useEffect(() => {
    setMounted(true);
  }, []);

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
    }
  }, [connected, publicKey]);

  const handleDisconnect = async () => {
    try {
      await disconnect();
      showToast.info("Wallet disconnected");
      setShowMenu(false);
    } catch (error) {
      console.error("Disconnect error:", error);
      showToast.error("Failed to disconnect wallet");
    }
  };

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      showToast.success("Address copied to clipboard!");
    }
  };

  const viewOnExplorer = () => {
    if (publicKey) {
      const explorerUrl = network === "devnet"
        ? `https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`
        : `https://explorer.solana.com/address/${publicKey.toBase58()}`;
      window.open(explorerUrl, "_blank");
    }
  };

  // Prevent SSR rendering to avoid infinite recursion with wallet adapter
  if (!mounted) {
    return (
      <div className="w-[140px] h-[40px] bg-gray-800 animate-pulse rounded" />
    );
  }

  return (
    <div className="relative flex items-center gap-3">
      {/* Network Badge */}
      {connected && (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
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

      {/* Wallet Button or Menu */}
      {!connected ? (
        <div className="wallet-adapter-button-wrapper">
          <WalletMultiButton 
            className="!bg-[var(--primary)] hover:!bg-[var(--primary-hover)] !text-black !font-bold !px-4 !py-2 !rounded"
          />
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded flex items-center gap-2"
          >
            {wallet?.adapter.icon && (
              <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-5 h-5" />
            )}
            <span>
              {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
            </span>
            {balance !== null && (
              <span className="text-[var(--primary)] text-xs">
                {balance.toFixed(4)} SOL
              </span>
            )}
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-black border-2 border-[var(--primary)] rounded-lg shadow-lg z-50">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  {wallet?.adapter.icon && (
                    <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-6 h-6" />
                  )}
                  <span className="font-bold text-white">{wallet?.adapter.name}</span>
                </div>
                <div className="text-sm text-gray-400 break-all">
                  {publicKey?.toBase58()}
                </div>
                {balance !== null && (
                  <div className="mt-2 text-lg font-bold text-[var(--primary)]">
                    {balance.toFixed(4)} SOL
                  </div>
                )}
              </div>
              
              <div className="p-2">
                <button
                  onClick={copyAddress}
                  className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded text-white flex items-center gap-2"
                >
                  <span>�</span>
                  Copy Address
                </button>
                <button
                  onClick={viewOnExplorer}
                  className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded text-white flex items-center gap-2"
                >
                  <span>🔍</span>
                  View on Explorer
                </button>
                <button
                  onClick={handleDisconnect}
                  className="w-full text-left px-3 py-2 hover:bg-red-900/50 rounded text-red-400 flex items-center gap-2"
                >
                  <span>🚪</span>
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wrong Network Warning */}
      {isWrongNetwork && connected && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-red-500/10 border border-red-500 rounded p-3 text-sm text-red-400">
          ⚠️ You&apos;re on {network}. Please switch to {process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta"}.
        </div>
      )}
    </div>
  );
};
