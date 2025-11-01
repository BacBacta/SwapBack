'use client';

import { useBuybackHistory } from '@/hooks/useBuyback';
import { getExplorerTxUrl } from '@/utils/explorer';

export default function BuybackHistory() {
  const { history, loading } = useBuybackHistory(10);

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">📜 Historique des Buybacks</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">📜 Historique des Buybacks</h3>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-400">Aucun buyback exécuté pour le moment</p>
          <p className="text-gray-500 text-sm mt-2">
            Soyez le premier à exécuter un buyback quand le seuil sera atteint!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
      <h3 className="text-xl font-bold text-white mb-4">📜 Historique des Buybacks</h3>
      
      <div className="space-y-3">
        {history.map((item, index) => (
          <div
            key={item.signature}
            className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔥</span>
                <div>
                  <div className="text-white font-semibold">
                    Buyback #{history.length - index}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(item.timestamp * 1000).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-orange-400 font-bold">
                  {item.backAmount > 0 ? `${item.backAmount.toFixed(2)} $BACK` : 'N/A'}
                </div>
                <div className="text-xs text-gray-400">
                  {item.usdcAmount > 0 ? `${item.usdcAmount.toFixed(2)} USDC` : 'N/A'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <div className="text-gray-400">
                Exécuté par:{' '}
                <span className="text-blue-400 font-mono">
                  {item.executor ? `${item.executor.slice(0, 4)}...${item.executor.slice(-4)}` : 'N/A'}
                </span>
              </div>
              <a
                href={getExplorerTxUrl(item.signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                Voir tx →
              </a>
            </div>
          </div>
        ))}
      </div>

      {history.length >= 10 && (
        <div className="mt-4 text-center">
          <button className="text-blue-400 hover:text-blue-300 text-sm">
            Voir plus →
          </button>
        </div>
      )}
    </div>
  );
}
