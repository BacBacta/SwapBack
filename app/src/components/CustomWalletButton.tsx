'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Deep linking URLs pour les wallets mobiles
 */
const MOBILE_WALLETS = [
  {
    name: 'Phantom',
    icon: '/wallets/phantom.svg',
    iconFallback: '👻',
    color: 'from-purple-500 to-purple-600',
    getDeepLink: (url: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=swapback`,
    appStore: 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977',
    playStore: 'https://play.google.com/store/apps/details?id=app.phantom',
  },
  {
    name: 'Solflare',
    icon: '/wallets/solflare.svg',
    iconFallback: '🔥',
    color: 'from-orange-500 to-red-500',
    getDeepLink: (url: string) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=swapback`,
    appStore: 'https://apps.apple.com/app/solflare/id1580902717',
    playStore: 'https://play.google.com/store/apps/details?id=com.solflare.mobile',
  },
  {
    name: 'Backpack',
    icon: '/wallets/backpack.svg',
    iconFallback: '🎒',
    color: 'from-red-500 to-pink-500',
    getDeepLink: (url: string) => `https://backpack.app/ul/browse/${encodeURIComponent(url)}`,
    appStore: 'https://apps.apple.com/app/backpack-crypto-wallet/id1631907128',
    playStore: 'https://play.google.com/store/apps/details?id=app.backpack.mobile',
  },
];

interface CustomWalletButtonProps {
  className?: string;
}

export function CustomWalletButton({ className = '' }: CustomWalletButtonProps) {
  const { connected, publicKey, disconnect, wallet, wallets, select, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        navigator.userAgent.toLowerCase()
      );
    };
    setIsMobile(checkMobile());
    setCurrentUrl(window.location.href);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnect = useCallback(() => {
    if (isMobile) {
      // Sur mobile, afficher notre modal personnalisée
      setShowMobileModal(true);
    } else {
      // Sur desktop, utiliser la modal wallet-adapter standard
      setVisible(true);
    }
  }, [isMobile, setVisible]);

  const handleWalletSelect = useCallback((walletInfo: typeof MOBILE_WALLETS[0]) => {
    const deepLink = walletInfo.getDeepLink(currentUrl);
    
    // Ouvrir le deep link
    window.location.href = deepLink;
    
    // Fallback après 2.5 secondes
    setTimeout(() => {
      const userChoice = window.confirm(
        `${walletInfo.name} doesn't seem to be installed. Download it?`
      );
      if (userChoice) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        window.open(isIOS ? walletInfo.appStore : walletInfo.playStore, '_blank');
      }
    }, 2500);
    
    setShowMobileModal(false);
  }, [currentUrl]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setShowDropdown(false);
  }, [disconnect]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!mounted) return null;

  // Bouton quand connecté
  if (connected && publicKey) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 
                     border border-emerald-500/30 rounded-xl text-white font-medium
                     hover:border-emerald-500/50 transition-all ${className}`}
        >
          {wallet?.adapter.icon && (
            <img src={wallet.adapter.icon} alt="" className="w-5 h-5 rounded" />
          )}
          <span className="text-sm">{formatAddress(publicKey.toBase58())}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute top-full right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <button
              onClick={handleDisconnect}
              className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Bouton Connect
  return (
    <>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className={`px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 
                   text-black font-semibold rounded-xl
                   hover:shadow-lg hover:shadow-emerald-500/25 
                   active:scale-95 transition-all
                   disabled:opacity-50 disabled:cursor-wait ${className}`}
      >
        {connecting ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Connecting...
          </span>
        ) : (
          'Connect Wallet'
        )}
      </button>

      {/* Modal Mobile - Rendered via Portal */}
      {showMobileModal && mounted && createPortal(
        <MobileWalletModal
          onClose={() => setShowMobileModal(false)}
          onSelectWallet={handleWalletSelect}
          wallets={MOBILE_WALLETS}
        />,
        document.body
      )}
    </>
  );
}

// Modal séparée pour une meilleure gestion
interface MobileWalletModalProps {
  onClose: () => void;
  onSelectWallet: (wallet: typeof MOBILE_WALLETS[0]) => void;
  wallets: typeof MOBILE_WALLETS;
}

function MobileWalletModal({ onClose, onSelectWallet, wallets }: MobileWalletModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999999 }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className="relative w-full max-w-sm bg-[#0f0f1a] border-2 border-emerald-500/30 rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-gray-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <h2 className="text-2xl font-bold text-white text-center">
            Connect Wallet
          </h2>
          <p className="text-gray-400 text-sm text-center mt-2">
            Choose your Solana wallet
          </p>
        </div>

        {/* Wallet List */}
        <div className="p-4 space-y-3">
          {wallets.map((wallet) => (
            <button
              key={wallet.name}
              onClick={() => onSelectWallet(wallet)}
              className={`w-full p-4 rounded-2xl bg-gradient-to-r ${wallet.color} 
                         text-white font-semibold flex items-center gap-4
                         active:scale-[0.98] transition-transform shadow-lg`}
            >
              <span className="text-3xl">{wallet.iconFallback}</span>
              <div className="flex-1 text-left">
                <div className="font-bold text-lg">{wallet.name}</div>
                <div className="text-xs opacity-80">Tap to open</div>
              </div>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="p-4 pt-0">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <p className="text-xs text-yellow-300 text-center">
              💡 If the wallet doesn't open, make sure it's installed on your device.
            </p>
          </div>
        </div>

        {/* Cancel Button */}
        <div className="p-4 pt-0">
          <button
            onClick={onClose}
            className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
