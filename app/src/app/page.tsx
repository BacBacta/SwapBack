'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-[#00FF00] font-mono">
      <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto p-4 sm:p-8 space-y-12 pb-24">
        
        {/* Hero Section avec Glitch */}
        <section className="relative overflow-hidden">
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="h-full w-full" style={{
              backgroundImage: `
                linear-gradient(#00FF00 1px, transparent 1px),
                linear-gradient(90deg, #00FF00 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
            }} />
          </div>

          <div className="relative border-4 border-[#00FF00] p-8 sm:p-12 text-center space-y-8 bg-[#0C0C0C]/90">
            {/* Title avec effet glitch */}
            <div className="relative">
              <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-wider">
                <span className="text-white">SWAP</span>
                <span className="text-[#00FF00]">BACK</span>
              </h1>
            </div>

            {/* Glitch bar */}
            <div className="flex justify-center">
              <div className="h-2 w-64 bg-[#00FF00]/20 overflow-hidden">
                <div className="h-full w-1/2 bg-[#00FF00] animate-pulse" />
              </div>
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <p className="text-2xl sm:text-3xl font-bold uppercase tracking-widest">
                THE FUTURE OF
              </p>
              <p className="text-2xl sm:text-3xl font-bold uppercase tracking-widest text-[#00FF00]">
                DECENTRALIZED TRADING
              </p>
            </div>

            {/* Status */}
            {connected && (
              <div className="text-sm">
                <span className="text-[#00FF00]">█</span> WALLET CONNECTED
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard"
                className="px-12 py-4 bg-[#00FF00] text-[#0C0C0C] text-xl font-bold border-4 border-[#00FF00] hover:bg-transparent hover:text-[#00FF00] transition-all shadow-[0_0_30px_rgba(0,255,0,0.5)] hover:shadow-[0_0_50px_rgba(0,255,0,0.8)] uppercase"
              >
                █ LAUNCH APP █
              </Link>
              <a
                href="https://github.com/BacBacta/SwapBack"
                target="_blank"
                rel="noopener noreferrer"
                className="px-12 py-4 bg-transparent text-[#00FF00] text-xl font-bold border-4 border-[#00FF00] hover:bg-[#00FF00] hover:text-[#0C0C0C] transition-all shadow-[0_0_20px_rgba(0,255,0,0.3)] hover:shadow-[0_0_40px_rgba(0,255,0,0.6)] uppercase"
              >
                DOCUMENTATION
              </a>
            </div>
          </div>
        </section>

        {/* Features Cards avec néon */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: '⚡', title: 'INSTANT SWAPS', desc: 'Trade any token in milliseconds', link: '/swap' },
            { icon: '📊', title: 'DCA AUTOMATION', desc: 'Set it and forget it', link: '/dca' },
            { icon: '🔥', title: 'BUYBACK & BURN', desc: 'Deflationary tokenomics', link: '/buyback' },
          ].map((feature, i) => (
            <Link
              key={i}
              href={feature.link}
              className="border-4 border-[#00FF00] p-8 bg-[#0C0C0C] hover:bg-[#00FF00]/10 transition-all relative overflow-hidden group cursor-pointer"
              style={{
                boxShadow: '0 0 20px rgba(0,255,0,0.3)',
              }}
            >
              {/* Neon glow on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#00FF00] shadow-[0_0_20px_#00FF00]" />
                <div className="absolute bottom-0 left-0 w-full h-1 bg-[#00FF00] shadow-[0_0_20px_#00FF00]" />
                <div className="absolute top-0 left-0 w-1 h-full bg-[#00FF00] shadow-[0_0_20px_#00FF00]" />
                <div className="absolute top-0 right-0 w-1 h-full bg-[#00FF00] shadow-[0_0_20px_#00FF00]" />
              </div>

              <div className="relative space-y-4">
                <div className="text-5xl">{feature.icon}</div>
                <h3 className="text-2xl font-bold text-[#00FF00]">{feature.title}</h3>
                <div className="h-1 w-full bg-[#00FF00]/20">
                  <div className="h-full w-0 group-hover:w-full bg-[#00FF00] transition-all duration-500" />
                </div>
                <p className="text-[#00FF00]/70">{feature.desc}</p>
              </div>
            </Link>
          ))}
        </section>

        {/* Hologram Stats */}
        <section className="border-4 border-[#00FF00] p-8 relative overflow-hidden" style={{
          boxShadow: '0 0 30px rgba(0,255,0,0.3), inset 0 0 30px rgba(0,255,0,0.1)',
        }}>
          <h2 className="text-2xl font-bold text-center mb-8 text-[#00FF00]">
            LIVE PROTOCOL STATS
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: 'VOLUME 24H', value: 'COMING' },
              { label: 'TOTAL SWAPS', value: 'SOON' },
              { label: 'ACTIVE USERS', value: 'LIVE' },
              { label: 'TOKENS BURNED', value: 'ACTIVE' },
            ].map((stat, i) => (
              <div key={i} className="space-y-2">
                <p className="text-sm text-[#00FF00]/70 uppercase">{stat.label}</p>
                <p className="text-2xl sm:text-3xl font-bold text-[#00FF00]" style={{
                  textShadow: '0 0 10px #00FF00',
                }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="border-4 border-[#00FF00] p-8 bg-[#0C0C0C]" style={{
          boxShadow: '0 0 20px rgba(0,255,0,0.3)',
        }}>
          <h2 className="text-3xl font-bold text-center mb-8 text-[#00FF00]">
            HOW IT WORKS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { num: '01', title: 'CONNECT', desc: 'Link your Solana wallet' },
              { num: '02', title: 'CHOOSE', desc: 'Select your trading strategy' },
              { num: '03', title: 'EXECUTE', desc: 'Trade with low fees' },
              { num: '04', title: 'EARN', desc: 'Benefit from deflation' },
            ].map((step, i) => (
              <div key={i} className="text-center space-y-3">
                <div className="text-5xl font-bold text-[#00FF00]/30">{step.num}</div>
                <h3 className="text-xl font-bold text-[#00FF00]">{step.title}</h3>
                <p className="text-[#00FF00]/70 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#00FF00]">
            READY TO START TRADING?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/swap"
              className="px-10 py-4 bg-[#00FF00] text-[#0C0C0C] text-lg font-bold border-4 border-[#00FF00] hover:bg-transparent hover:text-[#00FF00] transition-all shadow-[0_0_30px_rgba(0,255,0,0.5)] uppercase"
            >
              START SWAPPING
            </Link>
            <Link
              href="/dashboard"
              className="px-10 py-4 bg-transparent text-[#00FF00] text-lg font-bold border-4 border-[#00FF00] hover:bg-[#00FF00] hover:text-[#0C0C0C] transition-all shadow-[0_0_20px_rgba(0,255,0,0.3)] uppercase"
            >
              VIEW DASHBOARD
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}

