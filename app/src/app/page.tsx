'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0C0C0C] via-[#1a1a1a] to-[#0C0C0C] overflow-hidden relative">
      {/* Gradient Mesh Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#10B981] rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#10B981] rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Grid Background */}
      <div className="absolute inset-0 opacity-10">
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
      <div className="relative z-10 max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        
        {/* Floating Card 1 - Top */}
        <motion.div
          className="absolute top-20 right-10 z-0"
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            x: (mousePosition.x - window.innerWidth / 2) * 0.02,
            y: (mousePosition.y - window.innerHeight / 2) * 0.02,
          }}
        >
          <div className="backdrop-blur-xl bg-[#10B981]/5 border-2 border-[#10B981]/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,255,0,0.3)]">
            <div className="text-[#10B981] font-sans text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🌊</span>
                <span className="font-bold">Low Fees</span>
              </div>
              <p className="text-[#10B981]/70">Swap with 0.2% fees</p>
            </div>
          </div>
        </motion.div>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20 relative z-20"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#10B981] via-[#06B6D4] to-[#10B981] bg-clip-text text-transparent animate-gradient">
                SwapBack
              </span>
            </h1>
            <p className="text-2xl md:text-3xl text-[#10B981]/90 font-mono">
              Next-Gen DEX for Solana
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-lg md:text-xl text-[#10B981]/70 max-w-2xl mx-auto mb-12 font-mono"
          >
            Trade smarter with automated tools, low fees, and advanced DeFi features
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(0,255,0,0.6)" }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-[#10B981] text-[#0C0C0C] font-bold text-lg rounded-xl shadow-[0_0_30px_rgba(0,255,0,0.4)] hover:bg-[#10B981]/90 transition-all font-sans uppercase tracking-wider"
              >
                Launch App
              </motion.button>
            </Link>
            <a href="https://github.com/BacBacta/SwapBack" target="_blank" rel="noopener noreferrer">
              <motion.button
                whileHover={{ scale: 1.05, borderColor: "rgba(0,255,0,1)" }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-transparent border-2 border-[#10B981]/30 text-[#10B981] font-bold text-lg rounded-xl hover:bg-[#10B981]/10 transition-all font-sans uppercase tracking-wider"
              >
                Read Docs
              </motion.button>
            </a>
          </motion.div>
        </motion.div>

        {/* Floating Cards - Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-20">
          
          {/* Card 1 - DCA */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            whileHover={{ 
              y: -10,
              boxShadow: "0 20px 60px rgba(0,255,0,0.4)",
            }}
            style={{
              x: (mousePosition.x - window.innerWidth / 2) * 0.01,
              y: (mousePosition.y - window.innerHeight / 2) * 0.01,
            }}
            className="backdrop-blur-xl bg-[#10B981]/5 border-2 border-[#10B981]/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,255,0,0.2)] hover:border-[#10B981]/60 transition-all cursor-pointer"
          >
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-[#10B981] mb-3 font-mono">DCA Orders</h3>
            <p className="text-[#10B981]/70 mb-4 font-sans text-sm">
              Automate your investments with Dollar-Cost Averaging. Schedule recurring buys and let the protocol handle the rest.
            </p>
            <Link href="/dca" className="text-[#06B6D4] hover:text-[#10B981] font-sans text-sm font-bold inline-flex items-center gap-2">
              Learn More →
            </Link>
          </motion.div>

          {/* Card 2 - Swap */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            whileHover={{ 
              y: -10,
              boxShadow: "0 20px 60px rgba(0,255,255,0.4)",
            }}
            style={{
              x: (mousePosition.x - window.innerWidth / 2) * 0.015,
              y: (mousePosition.y - window.innerHeight / 2) * 0.015,
            }}
            className="backdrop-blur-xl bg-[#06B6D4]/5 border-2 border-[#06B6D4]/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,255,255,0.2)] hover:border-[#06B6D4]/60 transition-all cursor-pointer"
          >
            <div className="text-5xl mb-4">⚡</div>
            <h3 className="text-2xl font-bold text-[#06B6D4] mb-3 font-mono">Instant Swaps</h3>
            <p className="text-[#06B6D4]/70 mb-4 font-sans text-sm">
              Trade any Solana token instantly with best-in-class routing and minimal slippage. Lightning-fast execution.
            </p>
            <Link href="/swap" className="text-[#10B981] hover:text-[#06B6D4] font-sans text-sm font-bold inline-flex items-center gap-2">
              Start Trading →
            </Link>
          </motion.div>

          {/* Card 3 - Buyback */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            whileHover={{ 
              y: -10,
              boxShadow: "0 20px 60px rgba(0,255,0,0.4)",
            }}
            style={{
              x: (mousePosition.x - window.innerWidth / 2) * 0.012,
              y: (mousePosition.y - window.innerHeight / 2) * 0.012,
            }}
            className="backdrop-blur-xl bg-[#10B981]/5 border-2 border-[#10B981]/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,255,0,0.2)] hover:border-[#10B981]/60 transition-all cursor-pointer"
          >
            <div className="text-5xl mb-4">🔥</div>
            <h3 className="text-2xl font-bold text-[#10B981] mb-3 font-mono">Buyback & Burn</h3>
            <p className="text-[#10B981]/70 mb-4 font-sans text-sm">
              Deflationary tokenomics powered by protocol fees. Watch $BACK supply decrease while value increases.
            </p>
            <Link href="/buyback" className="text-[#06B6D4] hover:text-[#10B981] font-sans text-sm font-bold inline-flex items-center gap-2">
              View Stats →
            </Link>
          </motion.div>
        </div>

        {/* Floating Card 2 - Bottom */}
        <motion.div
          className="absolute bottom-20 left-10 z-0"
          animate={{
            y: [0, 20, 0],
            rotate: [0, -5, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            x: (mousePosition.x - window.innerWidth / 2) * 0.025,
            y: (mousePosition.y - window.innerHeight / 2) * 0.025,
          }}
        >
          <div className="backdrop-blur-xl bg-[#06B6D4]/5 border-2 border-[#06B6D4]/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,255,255,0.3)]">
            <div className="text-[#06B6D4] font-sans text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔒</span>
                <span className="font-bold">Secure</span>
              </div>
              <p className="text-[#06B6D4]/70">Non-custodial protocol</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-32 text-center relative z-20"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="backdrop-blur-xl bg-[#10B981]/5 border-2 border-[#10B981]/20 rounded-2xl p-6">
              <div className="text-4xl font-bold text-[#10B981] mb-2 font-mono">$2.4M+</div>
              <div className="text-[#10B981]/70 font-sans text-sm uppercase tracking-wider">Total Volume</div>
            </div>
            <div className="backdrop-blur-xl bg-[#06B6D4]/5 border-2 border-[#06B6D4]/20 rounded-2xl p-6">
              <div className="text-4xl font-bold text-[#06B6D4] mb-2 font-mono">12,345</div>
              <div className="text-[#06B6D4]/70 font-sans text-sm uppercase tracking-wider">Total Swaps</div>
            </div>
            <div className="backdrop-blur-xl bg-[#10B981]/5 border-2 border-[#10B981]/20 rounded-2xl p-6">
              <div className="text-4xl font-bold text-[#10B981] mb-2 font-mono">856</div>
              <div className="text-[#10B981]/70 font-sans text-sm uppercase tracking-wider">Active Users</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
