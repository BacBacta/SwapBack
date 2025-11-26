'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Deep linking URLs pour les wallets mobiles
 */
const MOBILE_WALLET_DEEPLINKS = {
  phantom: {
    name: 'Phantom',
    icon: '👻',
    color: 'from-purple-500 to-purple-600',
    // Deep link pour ouvrir l'app et se connecter
    getDeepLink: (appUrl: string) => `https://phantom.app/ul/browse/${encodeURIComponent(appUrl)}?ref=swapback`,
    // Fallback vers le store si l'app n'est pas installée
    appStore: 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977',
    playStore: 'https://play.google.com/store/apps/details?id=app.phantom',
  },
  solflare: {
    name: 'Solflare',
    icon: '🔥',
    color: 'from-orange-500 to-red-600',
    getDeepLink: (appUrl: string) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(appUrl)}?ref=swapback`,
    appStore: 'https://apps.apple.com/app/solflare/id1580902717',
    playStore: 'https://play.google.com/store/apps/details?id=com.solflare.mobile',
  },
  glow: {
    name: 'Glow',
    icon: '✨',
    color: 'from-pink-500 to-purple-600',
    getDeepLink: (appUrl: string) => `https://glow.app/ul/browse/${encodeURIComponent(appUrl)}?ref=swapback`,
    appStore: 'https://apps.apple.com/app/glow-solana-wallet/id1599584512',
    playStore: 'https://play.google.com/store/apps/details?id=com.luma.wallet.prod',
  },
};

type WalletName = keyof typeof MOBILE_WALLET_DEEPLINKS;

export function MobileWalletConnect() {
  const { connected, publicKey } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    // Détecter mobile
    const checkMobile = () => {
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        navigator.userAgent.toLowerCase()
      );
    };
    
    setIsMobile(checkMobile());
    setCurrentUrl(window.location.href);
  }, []);

  // Ne pas afficher sur desktop ou si déjà connecté
  if (!isMobile || connected) return null;

  const handleWalletClick = (walletName: WalletName) => {
    const wallet = MOBILE_WALLET_DEEPLINKS[walletName];
    const deepLink = wallet.getDeepLink(currentUrl);
    
    // Essayer d'ouvrir le deep link
    window.location.href = deepLink;
    
    // Fallback : après 2 secondes, proposer de télécharger l'app
    setTimeout(() => {
      const userChoice = confirm(
        `${wallet.name} n'est pas installé. Voulez-vous le télécharger ?`
      );
      
      if (userChoice) {
        // Détecter iOS ou Android
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const storeUrl = isIOS ? wallet.appStore : wallet.playStore;
        window.open(storeUrl, '_blank');
      }
    }, 2000);
    
    setShowModal(false);
  };

  return (
    <>
      {/* Bouton flottant pour ouvrir le modal */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
        onClick={() => setShowModal(true)}
        className="fixed bottom-28 right-4 z-50 md:hidden
                   w-16 h-16 rounded-full
                   bg-gradient-to-r from-emerald-500 to-cyan-500
                   shadow-lg shadow-emerald-500/50
                   flex items-center justify-center
                   active:scale-95 transition-transform"
      >
        <span className="text-2xl">🔗</span>
      </motion.button>

      {/* Modal de sélection */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] md:hidden"
            />

            {/* Modal */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[101] md:hidden
                         bg-[#0C0C0C] border-t-2 border-emerald-500/30
                         rounded-t-3xl p-6 pb-safe-or-6"
            >
              {/* Handle */}
              <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6" />

              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Connecter votre Wallet
                </h2>
                <p className="text-gray-400 text-sm">
                  Choisissez votre wallet Solana
                </p>
              </div>

              {/* Wallet Options */}
              <div className="space-y-3 mb-4">
                {(Object.keys(MOBILE_WALLET_DEEPLINKS) as WalletName[]).map((walletName) => {
                  const wallet = MOBILE_WALLET_DEEPLINKS[walletName];
                  return (
                    <motion.button
                      key={walletName}
                      onClick={() => handleWalletClick(walletName)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full p-4 rounded-xl
                                 bg-gradient-to-r ${wallet.color}
                                 text-white font-semibold
                                 flex items-center gap-4
                                 shadow-lg active:shadow-xl
                                 transition-shadow`}
                    >
                      <span className="text-3xl">{wallet.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="font-bold text-lg">{wallet.name}</div>
                        <div className="text-xs opacity-90">
                          Appuyez pour ouvrir
                        </div>
                      </div>
                      <span className="text-2xl">→</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Info */}
              <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-xs text-yellow-300 text-center">
                  💡 Si le wallet ne s'ouvre pas, assurez-vous de l'avoir installé.
                  Un bouton de téléchargement apparaîtra si nécessaire.
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowModal(false)}
                className="mt-4 w-full p-3 bg-white/5 hover:bg-white/10 
                           rounded-xl text-gray-400 font-medium
                           transition-colors"
              >
                Annuler
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
