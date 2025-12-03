'use client';

import Link from 'next/link';
import { memo } from 'react';

// 🚀 Lazy load framer-motion only when needed
import dynamic from 'next/dynamic';
const MotionDiv = dynamic(
  () => import('framer-motion').then(mod => mod.motion.div),
  { ssr: false, loading: () => <div /> }
);

// 🚀 Memoized feature card to prevent unnecessary re-renders
const FeatureCard = memo(function FeatureCard({ 
  icon, 
  title, 
  description, 
  link, 
  linkText,
  colorClass,
  delay 
}: {
  icon: string;
  title: string;
  description: string;
  link: string;
  linkText: string;
  colorClass: 'emerald' | 'cyan';
  delay: number;
}) {
  const borderColor = colorClass === 'emerald' ? 'border-[#10B981]/30 hover:border-[#10B981]/60' : 'border-[#06B6D4]/30 hover:border-[#06B6D4]/60';
  const bgColor = colorClass === 'emerald' ? 'bg-[#10B981]/5' : 'bg-[#06B6D4]/5';
  const textColor = colorClass === 'emerald' ? 'text-[#10B981]' : 'text-[#06B6D4]';
  const shadowColor = colorClass === 'emerald' ? 'shadow-[0_0_30px_rgba(0,255,0,0.2)] hover:shadow-[0_20px_60px_rgba(0,255,0,0.3)]' : 'shadow-[0_0_30px_rgba(0,255,255,0.2)] hover:shadow-[0_20px_60px_rgba(0,255,255,0.3)]';
  
  return (
    <div
      className={`backdrop-blur-xl ${bgColor} border-2 ${borderColor} rounded-2xl p-8 ${shadowColor} transition-all duration-300 cursor-pointer hover:-translate-y-2`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className={`text-2xl font-bold ${textColor} mb-3 font-mono`}>{title}</h3>
      <p className={`${textColor}/70 mb-4 font-sans text-sm`}>{description}</p>
      <Link href={link} className={`${colorClass === 'emerald' ? 'text-[#06B6D4] hover:text-[#10B981]' : 'text-[#10B981] hover:text-[#06B6D4]'} font-sans text-sm font-bold inline-flex items-center gap-2`}>
        {linkText} →
      </Link>
    </div>
  );
});

// 🚀 Memoized stat card
const StatCard = memo(function StatCard({ value, label, colorClass }: { value: string; label: string; colorClass: 'emerald' | 'cyan' }) {
  const borderColor = colorClass === 'emerald' ? 'border-[#10B981]/20' : 'border-[#06B6D4]/20';
  const bgColor = colorClass === 'emerald' ? 'bg-[#10B981]/5' : 'bg-[#06B6D4]/5';
  const textColor = colorClass === 'emerald' ? 'text-[#10B981]' : 'text-[#06B6D4]';
  
  return (
    <div className={`backdrop-blur-xl ${bgColor} border-2 ${borderColor} rounded-2xl p-6`}>
      <div className={`text-4xl font-bold ${textColor} mb-2 font-mono`}>{value}</div>
      <div className={`${textColor}/70 font-sans text-sm uppercase tracking-wider`}>{label}</div>
    </div>
  );
});

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden relative isolate">
      {/* 🚀 Simplified static background - no JS animations */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#10B981] rounded-full mix-blend-multiply filter blur-3xl" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#10B981] rounded-full mix-blend-multiply filter blur-3xl" />
      </div>

      {/* Grid Background - Pure CSS */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div 
          className="h-full w-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, #10B981 1px, transparent 1px),
              linear-gradient(to bottom, #10B981 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        
        {/* Hero Section - CSS animations only */}
        <div className="text-center mb-20 relative z-20 animate-fadeIn">
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#10B981] via-[#06B6D4] to-[#10B981] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                SwapBack
              </span>
            </h1>
            <p className="text-2xl md:text-3xl text-[#10B981]/90 font-mono">
              Next-Gen DEX for Solana
            </p>
          </div>

          <p className="text-lg md:text-xl text-[#10B981]/70 max-w-2xl mx-auto mb-12 font-mono animate-fadeInDelay">
            Trade smarter with automated tools, low fees, and advanced DeFi features
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fadeInDelay2">
            <Link href="/app">
              <button className="px-8 py-4 bg-primary text-[#0C0C0C] font-bold text-lg rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:bg-primary-hover hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] hover:scale-105 active:scale-95 transition-all duration-200 font-sans">
                Launch App →
              </button>
            </Link>
            <a href="https://github.com/BacBacta/SwapBack" target="_blank" rel="noopener noreferrer">
              <button className="px-8 py-4 bg-transparent border-2 border-primary/30 text-primary font-bold text-lg rounded-xl hover:bg-primary/10 hover:border-primary hover:scale-105 active:scale-95 transition-all duration-200 font-sans">
                Read Docs
              </button>
            </a>
          </div>
        </div>

        {/* Feature Cards - CSS animations */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-20">
          <FeatureCard
            icon="📊"
            title="DCA Orders"
            description="Automate your investments with Dollar-Cost Averaging. Schedule recurring buys and let the protocol handle the rest."
            link="/dca"
            linkText="Learn More"
            colorClass="emerald"
            delay={100}
          />
          <FeatureCard
            icon="⚡"
            title="Instant Swaps"
            description="Trade any Solana token instantly with best-in-class routing and minimal slippage. Lightning-fast execution."
            link="/swap"
            linkText="Start Trading"
            colorClass="cyan"
            delay={200}
          />
          <FeatureCard
            icon="🔥"
            title="Buyback & Burn"
            description="Deflationary tokenomics powered by protocol fees. Watch $BACK supply decrease while value increases."
            link="/buyback"
            linkText="View Stats"
            colorClass="emerald"
            delay={300}
          />
        </div>

        {/* Stats Section */}
        <div className="mt-32 text-center relative z-20 animate-fadeInDelay3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StatCard value="$2.4M+" label="Total Volume" colorClass="emerald" />
            <StatCard value="12,345" label="Total Swaps" colorClass="cyan" />
            <StatCard value="856" label="Active Users" colorClass="emerald" />
          </div>
        </div>
      </div>

      {/* 🚀 CSS-only animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }
        .animate-fadeInDelay {
          animation: fadeIn 0.6s ease-out 0.2s forwards;
          opacity: 0;
        }
        .animate-fadeInDelay2 {
          animation: fadeIn 0.6s ease-out 0.4s forwards;
          opacity: 0;
        }
        .animate-fadeInDelay3 {
          animation: fadeIn 0.6s ease-out 0.6s forwards;
          opacity: 0;
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
