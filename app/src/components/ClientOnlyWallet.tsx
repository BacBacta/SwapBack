"use client";

import { useEffect, useState } from "react";

/**
 * Client-only wallet connector avec connexion directe
 * Utilise window.solana directement comme l'ancien WalletConnectionGuide
 * pour une meilleure compatibilité avec les environnements comme VS Code
 */
export const ClientOnlyWallet = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ne rien rendre côté serveur
  if (!mounted) {
    return null;
  }

  return <ClientOnlyWalletContent />;
};

// Type pour window avec les wallets Solana
type WindowWithWallets = Window & {
  solana?: {
    isPhantom?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    on: (event: string, callback: () => void) => void;
    publicKey?: { toString: () => string };
  };
  phantom?: { solana?: unknown };
  solflare?: {
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    publicKey?: { toString: () => string };
  };
};

const ClientOnlyWalletContent = () => {
  const [showModal, setShowModal] = useState(false);
  const [walletStatus, setWalletStatus] = useState<{[key: string]: boolean}>({});
  const [directConnection, setDirectConnection] = useState<{
    wallet: string | null;
    publicKey: string | null;
  }>({ wallet: null, publicKey: null });

  useEffect(() => {
    // Vérifier la présence des wallets
    const checkWalletAvailability = () => {
      const status: {[key: string]: boolean} = {};

      if (typeof window !== 'undefined') {
        const w = window as WindowWithWallets;
        
        // Détecter Phantom
        if (w.solana?.isPhantom) {
          console.log('✅ Phantom détecté');
          status['Phantom'] = true;
        }

        // Détecter Solflare
        if (w.solflare) {
          console.log('✅ Solflare détecté');
          status['Solflare'] = true;
        }
      }

      setWalletStatus(status);
    };

    checkWalletAvailability();

    // Re-vérifier périodiquement
    const interval = setInterval(checkWalletAvailability, 2000);
    return () => clearInterval(interval);
  }, []);

  // Utiliser la connexion directe comme dans WalletConnectionGuide
  const handlePhantomConnect = async () => {
    try {
      if (typeof window === 'undefined') return;
      
      const w = window as WindowWithWallets;
      const phantomWallet = w.solana;
      
      if (phantomWallet && phantomWallet.isPhantom) {
        console.log('🔍 Connecting to Phantom directly...');
        const response = await phantomWallet.connect();
        console.log('✅ Phantom connected:', response.publicKey.toString());
        
        setDirectConnection({
          wallet: 'Phantom',
          publicKey: response.publicKey.toString()
        });
        setShowModal(false);
      } else {
        console.warn('⚠️ Phantom not found, opening phantom.app');
        window.open('https://phantom.app/', '_blank');
      }
    } catch (error) {
      console.error('❌ Phantom connection error:', error);
      window.open('https://phantom.app/', '_blank');
    }
  };

  const handleSolflareConnect = async () => {
    try {
      if (typeof window === 'undefined') return;
      
      const w = window as WindowWithWallets;
      const solflareWallet = w.solflare;
      
      if (solflareWallet) {
        console.log('🔍 Connecting to Solflare directly...');
        const response = await solflareWallet.connect();
        console.log('✅ Solflare connected:', response.publicKey.toString());
        
        setDirectConnection({
          wallet: 'Solflare',
          publicKey: response.publicKey.toString()
        });
        setShowModal(false);
      } else {
        console.warn('⚠️ Solflare not found, opening solflare.com');
        window.open('https://solflare.com/', '_blank');
      }
    } catch (error) {
      console.error('❌ Solflare connection error:', error);
      window.open('https://solflare.com/', '_blank');
    }
  };

  const handleDisconnect = async () => {
    try {
      if (typeof window !== 'undefined') {
        const w = window as WindowWithWallets;
        
        // Déconnecter directement via window.solana si disponible
        if (directConnection.wallet === 'Phantom' && w.solana) {
          await w.solana.disconnect();
        } else if (directConnection.wallet === 'Solflare' && w.solflare) {
          await w.solflare.disconnect();
        }
        
        setDirectConnection({ wallet: null, publicKey: null });
      }
    } catch (error) {
      console.error('❌ Disconnect error:', error);
    }
  };

  const getWalletStatus = (walletName: string) => {
    if (walletStatus[walletName]) return 'Installed';
    return 'Not detected';
  };

  const getWalletStatusColor = (walletName: string) => {
    return walletStatus[walletName] ? 'text-green-400' : 'text-yellow-400';
  };

  // Afficher l'état de connexion via connexion directe
  const isConnected = directConnection.publicKey !== null;
  const displayPublicKey = directConnection.publicKey;

  if (isConnected && displayPublicKey) {
    return (
      <div className="flex items-center gap-2">
        <div className="bg-green-600 text-white px-3 py-1 rounded text-sm font-mono">
          {displayPublicKey.slice(0, 4)}...{displayPublicKey.slice(-4)}
        </div>
        <button
          onClick={handleDisconnect}
          className="!bg-red-600 hover:!bg-red-700 !text-white !font-bold !rounded !px-3 !py-1 !text-sm !transition-colors"
          style={{
            border: 'none',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="!bg-[var(--primary)] hover:!bg-[var(--primary-hover)] disabled:opacity-50 !text-black !font-bold !rounded !px-4 !py-2 !transition-colors"
        style={{
          backgroundColor: 'var(--primary)',
          border: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      >
        Connect Wallet
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-white">Connect Wallet</h3>
            <p className="text-gray-300 text-sm mb-4">
              Sélectionnez votre wallet pour vous connecter.
            </p>
            <div className="space-y-2">
              {/* Phantom Wallet */}
              <button
                onClick={handlePhantomConnect}
                className="w-full p-3 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👻</span>
                  <span>Phantom</span>
                </div>
                <span className={`text-sm ${getWalletStatusColor('Phantom')}`}>
                  {getWalletStatus('Phantom')}
                </span>
              </button>

              {/* Solflare Wallet */}
              <button
                onClick={handleSolflareConnect}
                className="w-full p-3 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔥</span>
                  <span>Solflare</span>
                </div>
                <span className={`text-sm ${getWalletStatusColor('Solflare')}`}>
                  {getWalletStatus('Solflare')}
                </span>
              </button>
            </div>
            
            {!walletStatus['Phantom'] && (
              <div className="mt-4 p-3 bg-yellow-900 bg-opacity-50 rounded text-sm text-yellow-200">
                <strong>⚠️ Phantom non détecté</strong>
                <p className="mt-1">
                  Phantom wallet n'est pas installé ou n'est pas activé.
                </p>
                <a
                  href="https://phantom.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white font-bold transition-colors"
                >
                  Installer Phantom
                </a>
              </div>
            )}
            
            <div className="mt-4 p-3 bg-blue-900 bg-opacity-50 rounded text-sm text-blue-200">
              <strong>💡 Conseil:</strong> Si votre wallet n'est pas détecté, assurez-vous qu'il est installé et activé dans votre navigateur. Rafraîchissez la page après l'installation.
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full p-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
};
