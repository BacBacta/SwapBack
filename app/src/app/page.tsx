'use client';

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
      <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 space-y-16 sm:space-y-24">
        
        {/* Hero Section */}
        <section className="relative">
          {/* Animated gradient background */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="text-center space-y-6 sm:space-y-8 py-12 sm:py-20">
            {/* Status badge */}
            {connected && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm font-medium text-emerald-400 backdrop-blur-sm">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Wallet Connected
              </div>
            )}

            {/* Main title */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent">
                SwapBack
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl sm:text-2xl lg:text-3xl text-slate-300 max-w-3xl mx-auto font-light">
              Next-Generation Decentralized Exchange on Solana
            </p>

            {/* Description */}
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
              Trade tokens instantly with automated DCA strategies and benefit from our innovative buyback & burn mechanism
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Link
                href="/dashboard"
                className="group relative px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-lg font-semibold rounded-xl hover:from-emerald-600 hover:to-green-600 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 w-full sm:w-auto"
              >
                <span className="relative z-10">Launch App</span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400 to-green-400 opacity-0 group-hover:opacity-20 blur transition-opacity" />
              </Link>
              <a
                href="https://github.com/BacBacta/SwapBack"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-slate-800/50 text-slate-200 text-lg font-semibold rounded-xl border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-all duration-300 backdrop-blur-sm w-full sm:w-auto"
              >
                Documentation
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
              Powerful Features
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Everything you need for advanced DeFi trading in one platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Instant Swaps',
                desc: 'Trade any SPL token with lightning-fast execution and optimal routing',
                link: '/swap'
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'DCA Automation',
                desc: 'Set up automated dollar-cost averaging strategies that run 24/7',
                link: '/dca'
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                  </svg>
                ),
                title: 'Buyback & Burn',
                desc: 'Deflationary tokenomics with automatic buyback and permanent burn',
                link: '/buyback'
              },
            ].map((feature, i) => (
              <Link
                key={i}
                href={feature.link}
                className="group relative p-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-700/50 hover:border-emerald-500/50 transition-all duration-300 backdrop-blur-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1"
              >
                {/* Gradient glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/0 to-green-500/0 group-hover:from-emerald-500/5 group-hover:to-green-500/5 transition-all duration-300" />
                
                <div className="relative space-y-4">
                  <div className="text-emerald-400 group-hover:text-emerald-300 transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-emerald-50 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed">
                    {feature.desc}
                  </p>
                  <div className="flex items-center text-emerald-400 font-medium group-hover:gap-2 transition-all">
                    <span>Learn more</span>
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-green-500/5 rounded-3xl blur-xl" />
          <div className="relative p-8 lg:p-12 bg-slate-800/30 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Protocol Statistics
              </h2>
              <p className="text-slate-400">Real-time metrics from the SwapBack protocol</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
              {[
                { label: '24h Volume', value: '$0.00', trend: '+0%', loading: true },
                { label: 'Total Swaps', value: '0', trend: 'Live', loading: true },
                { label: 'Active Users', value: '0', trend: 'Growing', loading: true },
                { label: 'Tokens Burned', value: '0', trend: '+0%', loading: true },
              ].map((stat, i) => (
                <div key={i} className="text-center space-y-2 p-4 rounded-xl bg-slate-900/50 border border-slate-700/30">
                  <p className="text-sm text-slate-400 font-medium uppercase tracking-wide">
                    {stat.label}
                  </p>
                  {stat.loading ? (
                    <div className="space-y-2">
                      <div className="h-8 w-24 mx-auto bg-slate-700/50 rounded animate-pulse" />
                      <div className="h-4 w-16 mx-auto bg-slate-700/30 rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="text-3xl sm:text-4xl font-bold text-white">
                        {stat.value}
                      </p>
                      <p className="text-xs text-emerald-400 font-medium">
                        {stat.trend}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
              How It Works
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Get started with SwapBack in four simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01',
                title: 'Connect Wallet',
                desc: 'Link your Solana wallet securely using Phantom, Solflare, or any supported wallet',
              },
              {
                num: '02',
                title: 'Choose Strategy',
                desc: 'Select from instant swaps, automated DCA, or participate in buyback programs',
              },
              {
                num: '03',
                title: 'Execute Trade',
                desc: 'Trade with competitive fees, optimal routing, and lightning-fast execution',
              },
              {
                num: '04',
                title: 'Earn Rewards',
                desc: 'Benefit from our deflationary BACK token model and protocol incentives',
              },
            ].map((step, i) => (
              <div key={i} className="relative group">
                {/* Connecting line (desktop only) */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-emerald-500/50 to-transparent" />
                )}
                
                <div className="relative p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 hover:border-emerald-500/50 transition-all duration-300 h-full group-hover:shadow-lg group-hover:shadow-emerald-500/10">
                  {/* Step number */}
                  <div className="w-12 h-12 mb-4 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/25">
                    {step.num}
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-50 transition-colors">
                    {step.title}
                  </h3>
                  
                  <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/10 rounded-3xl blur-2xl" />
          <div className="relative p-12 lg:p-16 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-3xl border border-slate-700/50 backdrop-blur-sm text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                Ready to Start Trading?
              </h2>
              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
                Join thousands of traders using SwapBack for seamless DeFi experiences
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/swap"
                className="group relative px-10 py-5 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-lg font-semibold rounded-xl hover:from-emerald-600 hover:to-green-600 transition-all duration-300 shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/50 hover:-translate-y-0.5 w-full sm:w-auto"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Start Trading
                  <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              <Link
                href="/dashboard"
                className="px-10 py-5 bg-slate-700/50 text-white text-lg font-semibold rounded-xl border border-slate-600 hover:bg-slate-700 hover:border-slate-500 transition-all duration-300 backdrop-blur-sm w-full sm:w-auto"
              >
                View Dashboard
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="pt-8 flex flex-wrap justify-center items-center gap-8 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Audited Smart Contracts
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Non-Custodial
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                Community Driven
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

