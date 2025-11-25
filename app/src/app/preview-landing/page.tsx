'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PreviewLanding() {
  const [activeDesign, setActiveDesign] = useState<1 | 2 | 3>(1);

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-[#10B981] font-mono">
      {/* Header de sélection */}
      <div className="sticky top-0 z-50 bg-[#0C0C0C] border-b-2 border-[#10B981]/30 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">
            <span className="text-[#10B981]">&gt;</span> PREVIEW LANDING PAGES
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveDesign(1)}
              className={`px-4 py-2 border-2 transition-all ${
                activeDesign === 1
                  ? 'bg-[#10B981] text-[#0C0C0C] border-[#10B981]'
                  : 'bg-transparent text-[#10B981] border-[#10B981]/30 hover:border-[#10B981]'
              }`}
            >
              DESIGN 1
            </button>
            <button
              onClick={() => setActiveDesign(2)}
              className={`px-4 py-2 border-2 transition-all ${
                activeDesign === 2
                  ? 'bg-[#10B981] text-[#0C0C0C] border-[#10B981]'
                  : 'bg-transparent text-[#10B981] border-[#10B981]/30 hover:border-[#10B981]'
              }`}
            >
              DESIGN 2
            </button>
            <button
              onClick={() => setActiveDesign(3)}
              className={`px-4 py-2 border-2 transition-all ${
                activeDesign === 3
                  ? 'bg-[#10B981] text-[#0C0C0C] border-[#10B981]'
                  : 'bg-transparent text-[#10B981] border-[#10B981]/30 hover:border-[#10B981]'
              }`}
            >
              DESIGN 3
            </button>
          </div>
        </div>
      </div>

      {/* Design Preview */}
      <div className="p-8">
        {activeDesign === 1 && <Design1 />}
        {activeDesign === 2 && <Design2 />}
        {activeDesign === 3 && <Design3 />}
      </div>

      {/* Footer de sélection */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0C0C0C] border-t-2 border-[#10B981]/30 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm">
            <span className="text-[#10B981]/70">Actuellement:</span>{' '}
            <span className="text-[#10B981] font-bold">DESIGN {activeDesign}</span>
          </div>
          <Link
            href="/dashboard"
            className="px-6 py-2 bg-[#10B981] text-[#0C0C0C] font-bold border-2 border-[#10B981] hover:bg-transparent hover:text-[#10B981] transition-all"
          >
            RETOUR AU DASHBOARD
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DESIGN 1: Matrix Command Line
// ============================================
function Design1() {
  return (
    <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto space-y-12 pb-24">
      {/* Hero Section */}
      <section className="border-2 border-[#10B981] p-8 bg-[#10B981]/5 relative overflow-hidden">
        {/* Scan line effect */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-gradient-to-b from-transparent via-[#10B981] to-transparent animate-scan" />
        </div>

        <div className="relative space-y-6">
          {/* Terminal Header */}
          <div className="space-y-2">
            <p className="text-sm animate-pulse">
              <span className="text-[#10B981]">&gt;</span> INITIALIZING SWAPBACK PROTOCOL...
            </p>
            <p className="text-sm">
              <span className="text-[#10B981]">&gt;</span> LOADING MODULES... [████████████] 100%
            </p>
          </div>

          {/* ASCII Art Logo */}
          <pre className="text-[#10B981] text-xs sm:text-sm leading-tight overflow-x-auto">
{`
   ███████╗██╗    ██╗ █████╗ ██████╗ 
   ██╔════╝██║    ██║██╔══██╗██╔══██╗
   ███████╗██║ █╗ ██║███████║██████╔╝
   ╚════██║██║███╗██║██╔══██║██╔═══╝ 
   ███████║╚███╔███╔╝██║  ██║██║     
   ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝     
   ██████╗  █████╗  ██████╗██╗  ██╗  
   ██╔══██╗██╔══██╗██╔════╝██║ ██╔╝  
   ██████╔╝███████║██║     █████╔╝   
   ██╔══██╗██╔══██║██║     ██╔═██╗   
   ██████╔╝██║  ██║╚██████╗██║  ██╗  
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝  
`}
          </pre>

          {/* Taglines */}
          <div className="space-y-2 text-center">
            <p className="text-xl font-bold uppercase tracking-wider">
              <span className="text-[#10B981]">&gt;</span> DECENTRALIZED SWAP PROTOCOL
            </p>
            <p className="text-sm text-[#10B981]/70 uppercase">
              <span className="text-[#10B981]">&gt;</span> POWERED BY SOLANA BLOCKCHAIN
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button className="px-8 py-3 bg-[#10B981] text-[#0C0C0C] font-bold border-2 border-[#10B981] hover:bg-transparent hover:text-[#10B981] transition-all uppercase">
              [CONNECT_WALLET]
            </button>
            <button className="px-8 py-3 bg-transparent text-[#10B981] font-bold border-2 border-[#10B981] hover:bg-[#10B981] hover:text-[#0C0C0C] transition-all uppercase">
              [VIEW_DOCS]
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'SWAP', items: ['Instant swap', 'Low fees', 'Any token'] },
          { title: 'DCA', items: ['Auto invest', 'Schedule', 'Set & forget'] },
          { title: 'BUYBACK', items: ['Token burn', 'Deflation', 'Value growth'] },
        ].map((feature, i) => (
          <div key={i} className="border-2 border-[#10B981] p-6 bg-[#10B981]/5 hover:bg-[#10B981]/10 transition-all">
            <div className="space-y-4">
              <h3 className="text-xl font-bold">
                <span className="text-[#10B981]">&gt;</span> {feature.title}
              </h3>
              <ul className="space-y-2 text-sm">
                {feature.items.map((item, j) => (
                  <li key={j} className="flex items-center gap-2">
                    <span className="text-[#10B981]">█</span>
                    <span className="text-[#10B981]/70">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      {/* Live Stats */}
      <section className="border-2 border-[#10B981] p-6 bg-[#10B981]/5">
        <div className="space-y-4">
          <h3 className="text-xl font-bold">
            <span className="text-[#10B981]">&gt;</span> SYSTEM_STATUS
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[#10B981]/70">STATUS:</p>
              <p className="font-bold text-[#10B981]">OPERATIONAL</p>
            </div>
            <div>
              <p className="text-[#10B981]/70">TOTAL_VOLUME:</p>
              <p className="font-bold text-[#10B981]">$X.XXM</p>
            </div>
            <div>
              <p className="text-[#10B981]/70">TOTAL_SWAPS:</p>
              <p className="font-bold text-[#10B981]">X,XXX</p>
            </div>
            <div>
              <p className="text-[#10B981]/70">BACK_BURNED:</p>
              <p className="font-bold text-[#10B981]">X,XXX</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================
// DESIGN 2: Cyberpunk Glitch
// ============================================
function Design2() {
  return (
    <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto space-y-12 pb-24">
      {/* Hero Section avec Glitch */}
      <section className="relative overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full" style={{
            backgroundImage: `
              linear-gradient(#10B981 1px, transparent 1px),
              linear-gradient(90deg, #10B981 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }} />
        </div>

        <div className="relative border-4 border-[#10B981] p-12 text-center space-y-8 bg-[#0C0C0C]/90">
          {/* Title avec effet glitch */}
          <div className="relative">
            <h1 className="text-6xl md:text-8xl font-bold tracking-wider glitch-text" data-text="SWAPBACK">
              <span className="text-white">SWAP</span>
              <span className="text-[#10B981]">BACK</span>
            </h1>
            {/* Glitch layers */}
            <div className="absolute inset-0 opacity-70 glitch-layer-1">
              <h1 className="text-6xl md:text-8xl font-bold tracking-wider">
                <span className="text-[#FF0000]">SWAP</span>
                <span className="text-[#10B981]">BACK</span>
              </h1>
            </div>
            <div className="absolute inset-0 opacity-70 glitch-layer-2">
              <h1 className="text-6xl md:text-8xl font-bold tracking-wider">
                <span className="text-[#06B6D4]">SWAP</span>
                <span className="text-[#10B981]">BACK</span>
              </h1>
            </div>
          </div>

          {/* Glitch bar */}
          <div className="flex justify-center">
            <div className="h-2 w-64 bg-[#10B981]/20 overflow-hidden">
              <div className="h-full w-1/2 bg-[#10B981] animate-glitch-scan" />
            </div>
          </div>

          {/* Subtitle */}
          <div className="space-y-2">
            <p className="text-3xl font-bold uppercase tracking-widest">
              THE FUTURE OF
            </p>
            <p className="text-3xl font-bold uppercase tracking-widest text-[#10B981]">
              DECENTRALIZED TRADING
            </p>
          </div>

          {/* CTA */}
          <button className="mt-8 px-12 py-4 bg-[#10B981] text-[#0C0C0C] text-xl font-bold border-4 border-[#10B981] hover:bg-transparent hover:text-[#10B981] transition-all shadow-[0_0_30px_rgba(0,255,0,0.5)] hover:shadow-[0_0_50px_rgba(0,255,0,0.8)] uppercase">
            █ LAUNCH APP █
          </button>
        </div>
      </section>

      {/* Features Cards avec néon */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: '⚡', title: 'INSTANT SWAPS', desc: 'Trade any token in milliseconds' },
          { icon: '📊', title: 'DCA AUTOMATION', desc: 'Set it and forget it' },
          { icon: '🔥', title: 'BUYBACK & BURN', desc: 'Deflationary tokenomics' },
        ].map((feature, i) => (
          <div
            key={i}
            className="border-4 border-[#10B981] p-8 bg-[#0C0C0C] hover:bg-[#10B981]/10 transition-all relative overflow-hidden group"
            style={{
              boxShadow: '0 0 20px rgba(0,255,0,0.3)',
            }}
          >
            {/* Neon glow on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#10B981] shadow-[0_0_20px_#10B981]" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-[#10B981] shadow-[0_0_20px_#10B981]" />
              <div className="absolute top-0 left-0 w-1 h-full bg-[#10B981] shadow-[0_0_20px_#10B981]" />
              <div className="absolute top-0 right-0 w-1 h-full bg-[#10B981] shadow-[0_0_20px_#10B981]" />
            </div>

            <div className="relative space-y-4">
              <div className="text-5xl">{feature.icon}</div>
              <h3 className="text-2xl font-bold text-[#10B981]">{feature.title}</h3>
              <div className="h-1 w-full bg-[#10B981]/20">
                <div className="h-full w-0 group-hover:w-full bg-[#10B981] transition-all duration-500" />
              </div>
              <p className="text-[#10B981]/70">{feature.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Hologram Stats */}
      <section className="border-4 border-[#10B981] p-8 relative overflow-hidden" style={{
        boxShadow: '0 0 30px rgba(0,255,0,0.3), inset 0 0 30px rgba(0,255,0,0.1)',
      }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'VOLUME 24H', value: '$XXX,XXX' },
            { label: 'TOTAL SWAPS', value: 'X,XXX' },
            { label: 'ACTIVE USERS', value: 'XXX' },
            { label: 'TOKENS BURNED', value: 'X,XXX' },
          ].map((stat, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm text-[#10B981]/70 uppercase">{stat.label}</p>
              <p className="text-3xl font-bold text-[#10B981]" style={{
                textShadow: '0 0 10px #10B981',
              }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        @keyframes glitch-scan {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
        }
        .animate-glitch-scan {
          animation: glitch-scan 2s ease-in-out infinite;
        }
        @keyframes glitch1 {
          0%, 100% { transform: translate(0); }
          33% { transform: translate(-2px, 2px); }
          66% { transform: translate(2px, -2px); }
        }
        @keyframes glitch2 {
          0%, 100% { transform: translate(0); }
          33% { transform: translate(2px, -2px); }
          66% { transform: translate(-2px, 2px); }
        }
        .glitch-layer-1 {
          animation: glitch1 0.3s infinite;
        }
        .glitch-layer-2 {
          animation: glitch2 0.3s infinite;
        }
      `}</style>
    </div>
  );
}

// ============================================
// DESIGN 3: Hacker Terminal Dashboard
// ============================================
function Design3() {
  return (
    <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto space-y-12 pb-24">
      {/* Terminal Header */}
      <section className="border-2 border-[#10B981] bg-[#0C0C0C] p-8 font-mono">
        <div className="space-y-4">
          {/* Terminal prompt */}
          <div className="text-sm space-y-1">
            <p>
              <span className="text-[#10B981]">user@solana</span>
              <span className="text-white">:</span>
              <span className="text-[#06B6D4]">~</span>
              <span className="text-white">$</span>{' '}
              cat /var/log/swapback/welcome.txt
            </p>
          </div>

          {/* Welcome Box */}
          <div className="border-2 border-[#10B981]/50 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[#10B981]">{'━'.repeat(50)}</span>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold text-[#10B981]">
                SWAPBACK PROTOCOL v2.0
              </h1>
              <p className="text-lg text-[#10B981]/70 uppercase">
                DECENTRALIZED EXCHANGE PLATFORM
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#10B981]">{'━'.repeat(50)}</span>
            </div>
          </div>

          {/* System Info */}
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[#10B981]">&gt;</span> Access Level:{' '}
              <span className="text-[#FFFF00]">PUBLIC</span>
            </p>
            <p>
              <span className="text-[#10B981]">&gt;</span> Network:{' '}
              <span className="text-[#06B6D4]">Solana Mainnet</span>
            </p>
            <p>
              <span className="text-[#10B981]">&gt;</span> Status:{' '}
              <span className="text-[#10B981]">█████████░</span>{' '}
              <span className="text-[#10B981]">98% Online</span>
            </p>
          </div>

          {/* Command prompt */}
          <div className="pt-4 space-y-4">
            <p className="text-sm">
              <span className="text-[#10B981]">user@solana</span>
              <span className="text-white">:</span>
              <span className="text-[#06B6D4]">~</span>
              <span className="text-white">$</span>{' '}
              swapback --features
            </p>

            {/* Features list */}
            <div className="pl-4 space-y-2 text-sm">
              {[
                { check: '✓', name: 'Token Swaps', desc: 'Instant DEX' },
                { check: '✓', name: 'DCA Orders', desc: 'Automated investing' },
                { check: '✓', name: 'Buyback & Burn', desc: 'Deflationary model' },
                { check: '✓', name: 'NFT Boosts', desc: 'Earn rewards' },
              ].map((feature, i) => (
                <p key={i}>
                  <span className="text-[#10B981]">[{feature.check}]</span>{' '}
                  <span className="text-white font-bold">{feature.name}</span>{' '}
                  <span className="text-[#10B981]">→</span>{' '}
                  <span className="text-[#10B981]/70">{feature.desc}</span>
                </p>
              ))}
            </div>
          </div>

          {/* Connect prompt */}
          <div className="pt-4 space-y-2">
            <p className="text-sm">
              <span className="text-[#10B981]">user@solana</span>
              <span className="text-white">:</span>
              <span className="text-[#06B6D4]">~</span>
              <span className="text-white">$</span>{' '}
              swapback --connect-wallet
            </p>
            <p className="text-sm pl-4">
              <span className="text-[#10B981]">&gt;</span> Connecting to Solana...
              <span className="animate-pulse">_</span>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button className="px-6 py-2 bg-[#10B981] text-[#0C0C0C] font-bold border-2 border-[#10B981] hover:bg-transparent hover:text-[#10B981] transition-all">
              [CONNECT]
            </button>
            <button className="px-6 py-2 bg-transparent text-[#10B981] font-bold border-2 border-[#10B981] hover:bg-[#10B981] hover:text-[#0C0C0C] transition-all">
              [DOCUMENTATION]
            </button>
          </div>
        </div>
      </section>

      {/* Live Stats ASCII Graphs */}
      <section className="space-y-6">
        <div className="text-sm">
          <p>
            <span className="text-[#10B981]">user@solana</span>
            <span className="text-white">:</span>
            <span className="text-[#06B6D4]">~</span>
            <span className="text-white">$</span>{' '}
            swapback --stats --live
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Volume Graph */}
          <div className="border-2 border-[#10B981] p-4 bg-[#10B981]/5">
            <div className="space-y-2">
              <p className="text-sm font-bold">
                ┌─ VOLUME (24H) {'─'.repeat(20)}┐
              </p>
              <p className="text-sm pl-2">
                │ <span className="text-[#10B981]">{'█'.repeat(15)}</span>
                <span className="text-[#10B981]/30">{'░'.repeat(5)}</span>{' '}
                $XXX,XXX
              </p>
              <p className="text-sm">
                └{'─'.repeat(32)}┘
              </p>
            </div>
          </div>

          {/* Activity Graph */}
          <div className="border-2 border-[#10B981] p-4 bg-[#10B981]/5">
            <div className="space-y-2 text-sm">
              <p className="font-bold">
                ┌─ ACTIVITY {'─'.repeat(20)}┐
              </p>
              <p className="pl-2">
                │ Swaps: <span className="text-[#10B981]">{'█'.repeat(12)}</span>
                <span className="text-[#10B981]/30">{'░'.repeat(3)}</span> XXX
              </p>
              <p className="pl-2">
                │ DCA: <span className="text-[#10B981]">{'█'.repeat(8)}</span>
                <span className="text-[#10B981]/30">{'░'.repeat(7)}</span> XX
              </p>
              <p className="pl-2">
                │ Buyback: <span className="text-[#10B981]">{'█'.repeat(4)}</span>
                <span className="text-[#10B981]/30">{'░'.repeat(11)}</span> X
              </p>
              <p>
                └{'─'.repeat(32)}┘
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer commands */}
      <section className="border-2 border-[#10B981] p-4 bg-[#10B981]/5">
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-[#10B981]">user@solana</span>
            <span className="text-white">:</span>
            <span className="text-[#06B6D4]">~</span>
            <span className="text-white">$</span>{' '}
            swapback --social
          </p>
          <div className="pl-4 flex gap-4">
            <span className="text-[#10B981] hover:text-[#06B6D4] cursor-pointer">[GitHub]</span>
            <span className="text-[#10B981] hover:text-[#06B6D4] cursor-pointer">[Twitter]</span>
            <span className="text-[#10B981] hover:text-[#06B6D4] cursor-pointer">[Discord]</span>
            <span className="text-[#10B981] hover:text-[#06B6D4] cursor-pointer">[Docs]</span>
          </div>
        </div>
      </section>
    </div>
  );
}
