'use client';

import { motion } from 'framer-motion';
import { 
  FireIcon, 
  ChartBarIcon, 
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  CheckBadgeIcon,
  CurrencyDollarIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
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

  const features = [
    {
      icon: FireIcon,
      title: "Deflationary Model",
      description: "Constant supply reduction through automated burns",
      gradient: "from-orange-500 to-red-500",
    },
    {
      icon: BoltIcon,
      title: "Automated Process",
      description: "No manual intervention required, fully on-chain",
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      icon: ShieldCheckIcon,
      title: "Transparent & Secure",
      description: "All transactions are public and verifiable",
      gradient: "from-cyan-500 to-blue-500",
    },
  ];

  const stats = [
    {
      icon: CurrencyDollarIcon,
      label: "Fee Collection",
      value: "25% of swap fees",
      color: "text-emerald-400",
    },
    {
      icon: ArrowTrendingUpIcon,
      label: "Supply Impact",
      value: "Continuous deflation",
      color: "text-orange-400",
    },
    {
      icon: CheckBadgeIcon,
      label: "Token Standard",
      value: "Token-2022 Native",
      color: "text-cyan-400",
    },
  ];

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="backdrop-blur-xl bg-red-500/10 border border-red-500/50 rounded-2xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.2)]"
        >
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <FireIcon className="w-6 h-6 text-red-400" />
            </div>
            <p className="font-bold text-xl text-red-400">
              Error Loading Buyback Data
            </p>
          </div>
          <p className="text-sm text-red-400/70 ml-11 font-mono">
            {error.message}
          </p>
        </motion.div>
      </div>
    );
  }

  if (isLoading || !buybackState) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8">
            <div className="h-8 bg-emerald-500/20 rounded w-96 mb-4"></div>
            <div className="h-4 bg-emerald-500/10 rounded w-64"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-40 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl"></div>
            <div className="h-40 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl"></div>
            <div className="h-40 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative">
          {/* Gradient Glow Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-emerald-500/20 to-cyan-500/20 rounded-3xl blur-3xl opacity-50" />
          
          <div className="relative backdrop-blur-xl bg-[#0C0C0C]/60 border border-emerald-500/30 rounded-2xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-3">
                  Buyback & Burn Dashboard
                </h1>
                <p className="text-gray-400 text-lg max-w-3xl">
                  Automated deflationary mechanism powered by swap fees. 
                  Watch $BACK supply decrease with every buyback execution.
                </p>
              </div>
              
              {/* Decorative Icon */}
              <div className="hidden lg:block ml-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-full blur-xl opacity-50 animate-pulse" />
                  <div className="relative backdrop-blur-xl bg-[#0C0C0C]/80 border border-orange-500/30 rounded-full p-6">
                    <FireIcon className="w-12 h-12 text-orange-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                  className="flex items-center space-x-3 backdrop-blur-sm bg-white/5 rounded-lg p-3 border border-white/10"
                >
                  <stat.icon className={`w-5 h-5 ${stat.color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 font-medium">{stat.label}</div>
                    <div className="text-sm text-white font-semibold truncate">{stat.value}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 + 0.1 * index }}
            className="group relative"
          >
            {/* Hover Glow */}
            <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
            
            {/* Card Content */}
            <div className="relative backdrop-blur-xl bg-[#0C0C0C]/60 border border-emerald-500/20 rounded-xl p-6 hover:border-emerald-500/40 transition-all duration-300 h-full">
              <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.gradient} mb-4`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2">
                {feature.title}
              </h3>
              
              <p className="text-sm text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="space-y-8"
      >
      >
        {/* Stats Grid */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
          <div className="flex items-center space-x-2 mb-4">
            <SparklesIcon className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Live Statistics</h2>
          </div>
          <BuybackStats
            totalUsdcSpent={buybackState.totalUsdcSpent}
            totalBackBurned={buybackState.totalBackBurned}
            buybackCount={buybackState.buybackCount}
          />
        </div>

        {/* Progress Bar */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
          <BuybackProgressBar
            currentBalance={buybackState.vaultBalance || 0}
            threshold={buybackState.minBuybackAmount}
            progressPercent={buybackState.progressPercent || 0}
          />
        </div>

        {/* Execute Button (only show if threshold met) */}
        {buybackState.canExecute && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="backdrop-blur-xl bg-gradient-to-r from-orange-500/20 to-emerald-500/20 border border-orange-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(249,115,22,0.3)]"
          >
            <ExecuteBuybackButton />
          </motion.div>
        )}

        {/* Historical Chart */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
          <div className="flex items-center space-x-2 mb-4">
            <ChartBarIcon className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Historical Data</h2>
          </div>
          <BuybackChart />
        </div>

        {/* Recent Transactions */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-emerald-500/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
          <RecentBuybacks />
        </div>

        {/* Claim Distribution Section */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-cyan-500/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)]">
          <ClaimBuyback />
        </div>

        {/* Burn Visualization - 100% Burn Model */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/40 border border-orange-500/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(249,115,22,0.15)]">
          <BurnVisualization />
        </div>
      </motion.div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="space-y-6"
      >
        {/* How It Works & Benefits */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* How It Works */}
          <div className="backdrop-blur-xl bg-[#0C0C0C]/60 border border-emerald-500/20 rounded-2xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.15)] hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg">
                <BoltIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">Comment ça fonctionne?</h3>
            </div>
            <ol className="space-y-4">
              {[
                "À chaque swap sur SwapBack, 25% des frais sont collectés en USDC",
                "Les USDC s'accumulent dans le vault de buyback",
                "Quand le seuil minimum est atteint, n'importe qui peut exécuter un buyback",
                "Les tokens $BACK rachetés sont automatiquement brûlés (Token-2022)",
                "La supply totale diminue, créant une pression haussière"
              ].map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-gray-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Benefits */}
          <div className="backdrop-blur-xl bg-[#0C0C0C]/60 border border-cyan-500/20 rounded-2xl p-8 shadow-[0_0_50px_rgba(6,182,212,0.15)] hover:border-cyan-500/40 transition-all duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">Avantages</h3>
            </div>
            <ul className="space-y-4">
              {[
                { title: "Déflationniste", desc: "Réduction constante de la supply" },
                { title: "Automatique", desc: "Aucune intervention manuelle requise" },
                { title: "Transparent", desc: "Toutes les transactions sont publiques" },
                { title: "Token-2022", desc: "Support natif des extensions Token-2022" },
                { title: "Participatif", desc: "Tout le monde peut exécuter un buyback" }
              ].map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckBadgeIcon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">{benefit.title}</strong>
                    <p className="text-sm text-gray-400">{benefit.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Technical Details */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/60 border border-blue-500/20 rounded-2xl p-8 shadow-[0_0_50px_rgba(59,130,246,0.15)]">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white">Détails Techniques</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-sm text-gray-400 font-medium">Program ID</div>
              <code className="block text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 break-all">
                92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir
              </code>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-400 font-medium">$BACK Mint (Token-2022)</div>
              <code className="block text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 break-all">
                {backMintAddress}
              </code>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-400 font-medium">Réseau</div>
              <code className="block text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                Solana {getNetworkLabel()}
              </code>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="backdrop-blur-xl bg-[#0C0C0C]/60 border border-purple-500/20 rounded-2xl p-8 shadow-[0_0_50px_rgba(168,85,247,0.15)]">
          <h2 className="text-3xl font-bold text-white mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Questions Fréquentes
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Qui peut exécuter un buyback?",
                a: "N'importe qui peut exécuter un buyback une fois que le seuil minimum d'USDC dans le vault est atteint. Vous vendez vos $BACK contre l'USDC du vault, et vos tokens sont automatiquement brûlés."
              },
              {
                q: "Quel est le prix du buyback?",
                a: "Le prix est calculé en temps réel selon un oracle de prix ou un AMM. Le taux peut inclure une prime pour inciter les utilisateurs à participer au mécanisme déflationniste."
              },
              {
                q: "Pourquoi mes tokens sont-ils brûlés?",
                a: "Le burn automatique réduit la supply totale de $BACK, créant un effet déflationniste qui bénéficie à tous les détenteurs en augmentant la rareté du token."
              },
              {
                q: "Comment les USDC arrivent-ils dans le vault?",
                a: "25% de chaque frais de swap sur SwapBack est automatiquement déposé dans le vault de buyback. Plus il y a de volume de trading, plus le vault se remplit rapidement."
              }
            ].map((faq, index) => (
              <details
                key={index}
                className="group backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6 cursor-pointer hover:border-purple-500/30 transition-all duration-300"
              >
                <summary className="text-white font-semibold flex items-center justify-between">
                  {faq.q}
                  <span className="text-purple-400 group-open:rotate-180 transition-transform duration-300">▼</span>
                </summary>
                <p className="text-gray-400 mt-4 leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
