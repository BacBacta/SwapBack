'use client';

import { useBuybackState } from '@/hooks/useBuybackState';
import BuybackStats from './components/BuybackStats';
import BuybackProgressBar from './components/BuybackProgressBar';
import ExecuteBuybackButton from './components/ExecuteBuybackButton';
import BuybackChart from './components/BuybackChart';
import RecentBuybacks from './components/RecentBuybacks';
import BurnVisualization from '@/components/BurnVisualization';
import ClaimBuyback from '@/components/ClaimBuyback';
import { getNetworkLabel } from '@/utils/explorer';
import { getBackTokenMint } from '@/config/constants';

export default function BuybackPage() {
  const { buybackState, isLoading, error } = useBuybackState();
  const backMintAddress = getBackTokenMint().toBase58();

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="bg-red-500/10 border-2 border-red-500/50 backdrop-blur-sm p-4">
          <p className="font-bold terminal-text uppercase tracking-wider text-red-400">
            ❌ Error loading buyback data
          </p>
          <p className="text-sm text-red-400/70 mt-1 font-mono">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !buybackState) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="animate-pulse">
          <div className="h-12 bg-[var(--primary)]/20 border-2 border-[var(--primary)]/30 w-96 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="h-40 bg-[var(--primary)]/10 border-2 border-[var(--primary)]/20"></div>
            <div className="h-40 bg-[var(--primary)]/10 border-2 border-[var(--primary)]/20"></div>
            <div className="h-40 bg-[var(--primary)]/10 border-2 border-[var(--primary)]/20"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl min-h-screen">
      <div className="backdrop-blur-xl bg-[#10B981]/5 border-2 border-[#10B981]/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,255,0,0.2)] transition-all hover:border-[#10B981]/50">
        {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold terminal-text terminal-glow uppercase tracking-wider text-[var(--primary)] mb-2 flex items-center gap-3">
          <span>💰</span>
          <span>Buyback Dashboard</span>
        </h1>
        <p className="text-[var(--primary)]/70 font-sans text-sm uppercase tracking-wider">
          Track $BACK token buyback and burn statistics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <BuybackStats
          totalUsdcSpent={buybackState.totalUsdcSpent}
          totalBackBurned={buybackState.totalBackBurned}
          buybackCount={buybackState.buybackCount}
        />
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <BuybackProgressBar
          currentBalance={buybackState.vaultBalance || 0}
          threshold={buybackState.minBuybackAmount}
          progressPercent={buybackState.progressPercent || 0}
        />
      </div>

      {/* Execute Button (only show if threshold met) */}
      {buybackState.canExecute && (
        <div className="mb-6">
          <ExecuteBuybackButton />
        </div>
      )}

      {/* Historical Chart */}
      <div className="mb-6">
        <BuybackChart />
      </div>

      {/* Recent Transactions */}
      <div className="mb-6">
        <RecentBuybacks />
      </div>

      {/* NEW: Claim Distribution Section */}
      <div className="mb-6">
        <ClaimBuyback />
      </div>

      {/* NEW: Burn Visualization - 100% Burn Model */}
      <div className="mb-6">
        <BurnVisualization />
      </div>

      {/* Info Section */}
      <div>

        {/* Additional Info Sections */}
        <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-2 3xl:grid-cols-3 4xl:grid-cols-4 gap-4 lg:gap-6">
          {/* How It Works */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span>⚙️</span> Comment ça fonctionne?
            </h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex gap-3">
                <span className="text-blue-400 font-bold">1.</span>
                <span>À chaque swap sur SwapBack, 25% des frais sont collectés en USDC</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 font-bold">2.</span>
                <span>Les USDC s'accumulent dans le vault de buyback</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 font-bold">3.</span>
                <span>Quand le seuil minimum est atteint, n'importe qui peut exécuter un buyback</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 font-bold">4.</span>
                <span>Les tokens $BACK rachetés sont automatiquement brûlés (Token-2022)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 font-bold">5.</span>
                <span>La supply totale diminue, créant une pression haussière</span>
              </li>
            </ol>
          </div>

          {/* Benefits */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span>💎</span> Avantages
            </h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <div>
                  <strong className="text-white">Déflationniste</strong>
                  <p className="text-sm text-gray-400">Réduction constante de la supply</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <div>
                  <strong className="text-white">Automatique</strong>
                  <p className="text-sm text-gray-400">Aucune intervention manuelle requise</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <div>
                  <strong className="text-white">Transparent</strong>
                  <p className="text-sm text-gray-400">Toutes les transactions sont publiques</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <div>
                  <strong className="text-white">Token-2022</strong>
                  <p className="text-sm text-gray-400">Support natif des extensions Token-2022</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <div>
                  <strong className="text-white">Participatif</strong>
                  <p className="text-sm text-gray-400">Tout le monde peut exécuter un buyback</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mx-auto mt-6">
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span>🔧</span> Détails Techniques
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Program ID</div>
                <code className="text-blue-400 break-all">
                  92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir
                </code>
              </div>
              <div>
                <div className="text-gray-400 mb-1">$BACK Mint (Token-2022)</div>
                <code className="text-green-400 break-all">
                  {backMintAddress}
                </code>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Réseau</div>
                <code className="text-green-400">Solana {getNetworkLabel()}</code>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-12 mb-8">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">
            ❓ Questions Fréquentes
          </h2>
          <div className="space-y-4">
            <details className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 cursor-pointer">
              <summary className="text-white font-semibold">
                Qui peut exécuter un buyback?
              </summary>
              <p className="text-gray-400 mt-2">
                N'importe qui peut exécuter un buyback une fois que le seuil minimum d'USDC dans le vault est atteint. 
                Vous vendez vos $BACK contre l'USDC du vault, et vos tokens sont automatiquement brûlés.
              </p>
            </details>

            <details className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 cursor-pointer">
              <summary className="text-white font-semibold">
                Quel est le prix du buyback?
              </summary>
              <p className="text-gray-400 mt-2">
                Le prix est calculé en temps réel selon un oracle de prix ou un AMM. Le taux peut inclure une prime 
                pour inciter les utilisateurs à participer au mécanisme déflationniste.
              </p>
            </details>

            <details className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 cursor-pointer">
              <summary className="text-white font-semibold">
                Pourquoi mes tokens sont-ils brûlés?
              </summary>
              <p className="text-gray-400 mt-2">
                Le burn automatique réduit la supply totale de $BACK, créant un effet déflationniste qui bénéficie 
                à tous les détenteurs en augmentant la rareté du token.
              </p>
            </details>

            <details className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 cursor-pointer">
              <summary className="text-white font-semibold">
                Comment les USDC arrivent-ils dans le vault?
              </summary>
              <p className="text-gray-400 mt-2">
                25% de chaque frais de swap sur SwapBack est automatiquement déposé dans le vault de buyback. 
                Plus il y a de volume de trading, plus le vault se remplit rapidement.
              </p>
            </details>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
