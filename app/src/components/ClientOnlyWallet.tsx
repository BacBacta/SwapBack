"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

/**
 * Client-only wallet connector avec modal personnalisé
 * Évite complètement les redirections automatiques
 * Améliore la détection des wallets dans tous les environnements
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

const ClientOnlyWalletContent = () => {
  const { wallets, select, connect, connected, connecting, disconnect, publicKey } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [walletStatus, setWalletStatus] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    // Vérifier manuellement la présence des wallets dans window
    const checkWalletAvailability = () => {
      const status: {[key: string]: boolean} = {};

      // Type pour window avec les wallets Solana
      type WindowWithWallets = Window & {
        solana?: { isPhantom?: boolean };
        phantom?: { solana?: unknown };
        solflare?: unknown;
      };

      // Log pour débogage
      console.log('🔍 Checking wallet availability...');
      console.log('window.solana:', typeof window !== 'undefined' ? (window as WindowWithWallets).solana : 'undefined');
      console.log('window.phantom:', typeof window !== 'undefined' ? (window as WindowWithWallets).phantom : 'undefined');
      console.log('window.solflare:', typeof window !== 'undefined' ? (window as WindowWithWallets).solflare : 'undefined');

      // Vérifier Phantom - essayer plusieurs méthodes de détection
      if (typeof window !== 'undefined') {
        const w = window as WindowWithWallets;
        
        // Méthode 1: window.solana.isPhantom
        if (w.solana?.isPhantom) {
          console.log('✅ Phantom détecté via window.solana.isPhantom');
          status['Phantom'] = true;
        }
        // Méthode 2: window.phantom.solana
        else if (w.phantom?.solana) {
          console.log('✅ Phantom détecté via window.phantom.solana');
          status['Phantom'] = true;
        }
        // Méthode 3: Chercher dans les wallets du contexte
        else {
          const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
          if (phantomWallet?.readyState === 'Installed') {
            console.log('✅ Phantom détecté via wallet adapter readyState');
            status['Phantom'] = true;
          }
        }

        // Vérifier Solflare
        if (w.solflare) {
          console.log('✅ Solflare détecté');
          status['Solflare'] = true;
        } else {
          const solflareWallet = wallets.find(w => w.adapter.name === 'Solflare');
          if (solflareWallet?.readyState === 'Installed') {
            console.log('✅ Solflare détecté via wallet adapter readyState');
            status['Solflare'] = true;
          }
        }
      }

      console.log('📊 Wallet status:', status);
      setWalletStatus(status);
    };

    checkWalletAvailability();

    // Re-vérifier périodiquement
    const interval = setInterval(checkWalletAvailability, 2000);
    return () => clearInterval(interval);
  }, [wallets]);

  const handleConnect = async (walletName: string) => {
    try {
      console.log(`🔍 Connecting to ${walletName}`);
      const wallet = wallets.find((w) => w.adapter.name === walletName);
      if (wallet) {
        select(wallet.adapter.name);
        await connect();
        setShowModal(false);
      }
    } catch (error) {
      console.error('🔍 Connection error:', error);
      // Si la connexion échoue, essayer d'ouvrir le wallet dans un nouvel onglet
      if (walletName === 'Phantom') {
        window.open('https://phantom.app/', '_blank');
      } else if (walletName === 'Solflare') {
        window.open('https://solflare.com/', '_blank');
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('🔍 Disconnect error:', error);
    }
  };

  const getWalletStatus = (walletName: string) => {
    if (walletStatus[walletName]) return 'Installed';
    return 'Not detected';
  };

  const getWalletStatusColor = (walletName: string) => {
    return walletStatus[walletName] ? 'text-green-400' : 'text-yellow-400';
  };

  if (connected && publicKey) {
    const address = publicKey.toBase58();
    return (
      <div className="flex items-center gap-2">
        <div className="bg-green-600 text-white px-3 py-1 rounded text-sm font-mono">
          {address.slice(0, 4)}...{address.slice(-4)}
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
        disabled={connecting}
        className="!bg-[var(--primary)] hover:!bg-[var(--primary-hover)] disabled:opacity-50 !text-black !font-bold !rounded !px-4 !py-2 !transition-colors"
        style={{
          backgroundColor: 'var(--primary)',
          border: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-white">Connect Wallet</h3>
            <p className="text-gray-300 text-sm mb-4">
              Sélectionnez votre wallet pour vous connecter. Si votre wallet n'est pas détecté, cliquez dessus pour l'ouvrir dans un nouvel onglet.
            </p>
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.adapter.name}
                  onClick={() => handleConnect(wallet.adapter.name)}
                  className="w-full p-3 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={wallet.adapter.icon}
                      alt={wallet.adapter.name}
                      className="w-6 h-6"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span>{wallet.adapter.name}</span>
                  </div>
                  <span className={`text-sm ${getWalletStatusColor(wallet.adapter.name)}`}>
                    {getWalletStatus(wallet.adapter.name)}
                  </span>
                </button>
              ))}
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
