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
      <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto space-y-8">
        
        {/* Terminal Header */}
        <section className="border-2 border-[#00FF00] bg-[#0C0C0C] p-6 sm:p-8">
          <div className="space-y-4">
            {/* Terminal prompt */}
            <div className="text-sm space-y-1">
              <p>
                <span className="text-[#00FF00]">user@solana</span>
                <span className="text-white">:</span>
                <span className="text-[#00FFFF]">~</span>
                <span className="text-white">$</span>{' '}
                cat /var/log/swapback/welcome.txt
              </p>
            </div>

            {/* Welcome Box */}
            <div className="border-2 border-[#00FF00]/50 p-6 space-y-4">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-[#00FF00]">{'━'.repeat(60)}</span>
              </div>
              <div className="text-center space-y-2">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#00FF00]">
                  SWAPBACK PROTOCOL v2.0
                </h1>
                <p className="text-base sm:text-lg text-[#00FF00]/70 uppercase">
                  DECENTRALIZED EXCHANGE PLATFORM
                </p>
              </div>
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-[#00FF00]">{'━'.repeat(60)}</span>
              </div>
            </div>

            {/* System Info */}
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-[#00FF00]">&gt;</span> Access Level:{' '}
                <span className="text-[#FFFF00]">PUBLIC</span>
              </p>
              <p>
                <span className="text-[#00FF00]">&gt;</span> Network:{' '}
                <span className="text-[#00FFFF]">Solana Mainnet</span>
              </p>
              <p>
                <span className="text-[#00FF00]">&gt;</span> Status:{' '}
                <span className="text-[#00FF00]">█████████░</span>{' '}
                <span className="text-[#00FF00]">98% Online</span>
              </p>
              {connected && (
                <p>
                  <span className="text-[#00FF00]">&gt;</span> Wallet:{' '}
                  <span className="text-[#00FF00]">✓ Connected</span>
                </p>
              )}
            </div>

            {/* Command prompt - Features */}
            <div className="pt-4 space-y-4">
              <p className="text-sm">
                <span className="text-[#00FF00]">user@solana</span>
                <span className="text-white">:</span>
                <span className="text-[#00FFFF]">~</span>
                <span className="text-white">$</span>{' '}
                swapback --features
              </p>

              {/* Features list */}
              <div className="pl-4 space-y-2 text-sm">
                {[
                  { check: '✓', name: 'Token Swaps', desc: 'Instant DEX', link: '/swap' },
                  { check: '✓', name: 'DCA Orders', desc: 'Automated investing', link: '/dca' },
                  { check: '✓', name: 'Buyback & Burn', desc: 'Deflationary model', link: '/buyback' },
                  { check: '✓', name: 'Dashboard', desc: 'Track performance', link: '/dashboard' },
                ].map((feature, i) => (
                  <Link key={i} href={feature.link} className="block hover:bg-[#00FF00]/10 transition-colors p-2 -m-2">
                    <span className="text-[#00FF00]">[{feature.check}]</span>{' '}
                    <span className="text-white font-bold">{feature.name}</span>{' '}
                    <span className="text-[#00FF00]">→</span>{' '}
                    <span className="text-[#00FF00]/70">{feature.desc}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Connect prompt */}
            <div className="pt-4 space-y-2">
              <p className="text-sm">
                <span className="text-[#00FF00]">user@solana</span>
                <span className="text-white">:</span>
                <span className="text-[#00FFFF]">~</span>
                <span className="text-white">$</span>{' '}
                swapback --connect-wallet
              </p>
              <p className="text-sm pl-4">
                <span className="text-[#00FF00]">&gt;</span> {typingText}
                {showCursor && <span className="animate-pulse">_</span>}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link 
                href="/dashboard"
                className="px-6 py-3 bg-[#00FF00] text-[#0C0C0C] font-bold border-2 border-[#00FF00] hover:bg-transparent hover:text-[#00FF00] transition-all text-center"
              >
                [LAUNCH APP]
              </Link>
              <a
                href="https://github.com/BacBacta/SwapBack"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-transparent text-[#00FF00] font-bold border-2 border-[#00FF00] hover:bg-[#00FF00] hover:text-[#0C0C0C] transition-all text-center"
              >
                [DOCUMENTATION]
              </a>
            </div>
          </div>
        </section>

        {/* Live Stats ASCII Graphs */}
        <section className="space-y-6">
          <div className="text-sm">
            <p>
              <span className="text-[#00FF00]">user@solana</span>
              <span className="text-white">:</span>
              <span className="text-[#00FFFF]">~</span>
              <span className="text-white">$</span>{' '}
              swapback --stats --live
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Volume Graph */}
            <div className="border-2 border-[#00FF00] p-4 bg-[#00FF00]/5">
              <div className="space-y-2 text-xs sm:text-sm">
                <p className="font-bold">
                  ┌─ VOLUME (24H) {'─'.repeat(20)}┐
                </p>
                <p className="pl-2">
                  │ <span className="text-[#00FF00]">{'█'.repeat(15)}</span>
                  <span className="text-[#00FF00]/30">{'░'.repeat(5)}</span>{' '}
                  Coming Soon
                </p>
                <p>
                  └{'─'.repeat(32)}┘
                </p>
              </div>
            </div>

            {/* Activity Graph */}
            <div className="border-2 border-[#00FF00] p-4 bg-[#00FF00]/5">
              <div className="space-y-2 text-xs sm:text-sm">
                <p className="font-bold">
                  ┌─ ACTIVITY {'─'.repeat(23)}┐
                </p>
                <p className="pl-2">
                  │ Swaps: <span className="text-[#00FF00]">{'█'.repeat(12)}</span>
                  <span className="text-[#00FF00]/30">{'░'.repeat(3)}</span> Active
                </p>
                <p className="pl-2">
                  │ DCA: <span className="text-[#00FF00]">{'█'.repeat(8)}</span>
                  <span className="text-[#00FF00]/30">{'░'.repeat(7)}</span> Active
                </p>
                <p className="pl-2">
                  │ Buyback: <span className="text-[#00FF00]">{'█'.repeat(4)}</span>
                  <span className="text-[#00FF00]/30">{'░'.repeat(11)}</span> Active
                </p>
                <p>
                  └{'─'.repeat(32)}┘
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-2 border-[#00FF00] p-6 bg-[#00FF00]/5">
          <div className="space-y-4">
            <p className="text-sm">
              <span className="text-[#00FF00]">user@solana</span>
              <span className="text-white">:</span>
              <span className="text-[#00FFFF]">~</span>
              <span className="text-white">$</span>{' '}
              swapback --how-it-works
            </p>
            
            <div className="pl-4 space-y-4 text-sm">
              <div>
                <p className="text-[#00FF00] font-bold">1. Connect Wallet</p>
                <p className="text-[#00FF00]/70 pl-4">Link your Solana wallet to access the protocol</p>
              </div>
              <div>
                <p className="text-[#00FF00] font-bold">2. Choose Your Strategy</p>
                <p className="text-[#00FF00]/70 pl-4">Swap instantly, set up DCA, or participate in buybacks</p>
              </div>
              <div>
                <p className="text-[#00FF00] font-bold">3. Execute Trades</p>
                <p className="text-[#00FF00]/70 pl-4">Low fees, high speed, fully decentralized</p>
              </div>
              <div>
                <p className="text-[#00FF00] font-bold">4. Earn Rewards</p>
                <p className="text-[#00FF00]/70 pl-4">Benefit from the deflationary BACK token model</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer commands */}
        <section className="border-2 border-[#00FF00] p-4 bg-[#00FF00]/5">
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[#00FF00]">user@solana</span>
              <span className="text-white">:</span>
              <span className="text-[#00FFFF]">~</span>
              <span className="text-white">$</span>{' '}
              swapback --social
            </p>
            <div className="pl-4 flex flex-wrap gap-4">
              <a 
                href="https://github.com/BacBacta/SwapBack" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#00FF00] hover:text-[#00FFFF] cursor-pointer transition-colors"
              >
                [GitHub]
              </a>
              <span className="text-[#00FF00] hover:text-[#00FFFF] cursor-pointer transition-colors">[Twitter]</span>
              <span className="text-[#00FF00] hover:text-[#00FFFF] cursor-pointer transition-colors">[Discord]</span>
              <Link href="/dashboard" className="text-[#00FF00] hover:text-[#00FFFF] cursor-pointer transition-colors">
                [Dashboard]
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
