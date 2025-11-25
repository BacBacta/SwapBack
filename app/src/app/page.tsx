'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

export default function Home() {
  const [typingText, setTypingText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const { connected } = useWallet();
  const fullText = 'Connecting to Solana...';

  useEffect(() => {
    if (typingText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypingText(fullText.slice(0, typingText.length + 1));
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [typingText]);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-[#00FF00] font-mono p-4 sm:p-8">
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
