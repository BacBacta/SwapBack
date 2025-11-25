'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

export default function Home() {
  const { connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white overflow-hidden">
      {/* Animated particles background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-green-500/10 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl animate-float-slow" />
      </div>

      <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 space-y-16 sm:space-y-24">
        
        {/* Hero Section */}
        <section className="relative">
          <div className={`text-center space-y-6 sm:space-y-8 py-12 sm:py-20 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Status badge */}
            {connected && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm font-medium text-emerald-400 backdrop-blur-sm animate-fade-in">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                Wallet Connected
              </div>
            )}

            {/* Main title with gradient animation */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight">
              <span className="inline-block bg-gradient-to-r from-white via-emerald-100 to-emerald-300 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                SwapBack Protocol
              </span>
            </h1>

            {/* Subtitle with fade-in */}
            <p className="text-xl sm:text-2xl lg:text-3xl text-slate-300 max-w-3xl mx-auto font-light animate-fade-in-up delay-200">
              Advanced Decentralized Trading Platform on Solana
            </p>

            {/* Description */}
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-400">
              Experience seamless token swaps, automated DCA strategies, and innovative deflationary mechanisms—all powered by cutting-edge blockchain technology
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4 animate-fade-in-up delay-600">
              <Link
                href="/dashboard"
                className="group relative px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-lg font-semibold rounded-xl overflow-hidden transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/50 hover:-translate-y-1 hover:scale-105 w-full sm:w-auto"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Launch Application
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-green-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Link>
              <a
                href="https://github.com/BacBacta/SwapBack"
                target="_blank"
                rel="noopener noreferrer"
                className="group px-8 py-4 bg-slate-800/50 text-slate-200 text-lg font-semibold rounded-xl border border-slate-700 hover:bg-slate-700/50 hover:border-emerald-500/50 transition-all duration-300 backdrop-blur-sm w-full sm:w-auto hover:-translate-y-1"
              >
                <span className="flex items-center justify-center gap-2">
                  View Documentation
                  <svg className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="space-y-8">
          <div className="text-center space-y-4 animate-fade-in-up">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
              Enterprise-Grade Features
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Comprehensive DeFi trading solutions designed for professional traders and institutions
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
                title: 'Lightning-Fast Swaps',
                desc: 'Execute instant token swaps with optimal routing algorithms and best-in-class execution speeds on Solana',
                link: '/swap',
                delayClass: 'delay-100'
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Smart DCA Automation',
                desc: 'Deploy sophisticated dollar-cost averaging strategies with customizable parameters that execute autonomously 24/7',
                link: '/dca',
                delayClass: 'delay-200'
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                  </svg>
                ),
                title: 'Deflationary Mechanics',
                desc: 'Benefit from our innovative buyback & burn mechanism that creates sustainable value through systematic token reduction',
                link: '/buyback',
                delayClass: 'delay-300'
              },
            ].map((feature, i) => (
              <Link
                key={i}
                href={feature.link}
                className={`group relative p-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-700/50 hover:border-emerald-500/50 transition-all duration-500 backdrop-blur-sm hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-2 animate-fade-in-up ${feature.delayClass}`}
              >
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/0 to-green-500/0 group-hover:from-emerald-500/10 group-hover:to-green-500/10 transition-all duration-500" />
                
                {/* Shimmer effect on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent" />
                </div>
                
                <div className="relative space-y-4">
                  <div className="text-emerald-400 group-hover:text-emerald-300 group-hover:scale-110 transition-all duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-emerald-50 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed">
                    {feature.desc}
                  </p>
                  <div className="flex items-center text-emerald-400 font-medium group-hover:gap-2 transition-all pt-2">
                    <span>Explore feature</span>
                    <svg className="w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="relative animate-fade-in-up delay-500">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-green-500/5 rounded-3xl blur-xl animate-pulse-slow" />
          <div className="relative p-8 lg:p-12 bg-slate-800/30 rounded-3xl border border-slate-700/50 backdrop-blur-sm hover:border-emerald-500/30 transition-all duration-500">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 bg-gradient-to-r from-white to-emerald-100 bg-clip-text text-transparent">
                Real-Time Protocol Metrics
              </h2>
              <p className="text-slate-400 text-lg">Live performance data from the SwapBack ecosystem</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
              {[
                { label: '24-Hour Volume', value: '$0.00', trend: '+0%', loading: true, icon: '📈' },
                { label: 'Total Transactions', value: '0', trend: 'Active', loading: true, icon: '⚡' },
                { label: 'Active Participants', value: '0', trend: 'Growing', loading: true, icon: '👥' },
                { label: 'Tokens Burned', value: '0', trend: '+0%', loading: true, icon: '🔥' },
              ].map((stat, i) => (
                <div 
                  key={i} 
                  className={`group text-center space-y-3 p-6 rounded-xl bg-slate-900/50 border border-slate-700/30 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all duration-300 hover:scale-105 animate-fade-in-up delay-${600 + i * 100}`}
                >
                  <div className="text-2xl group-hover:scale-110 transition-transform duration-300">
                    {stat.icon}
                  </div>
                  <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">
                    {stat.label}
                  </p>
                  {stat.loading ? (
                    <div className="space-y-3">
                      <div className="h-10 w-28 mx-auto bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded animate-pulse" />
                      <div className="h-5 w-20 mx-auto bg-slate-700/30 rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="text-4xl font-bold bg-gradient-to-r from-white to-emerald-100 bg-clip-text text-transparent">
                        {stat.value}
                      </p>
                      <p className="text-sm text-emerald-400 font-semibold flex items-center justify-center gap-1">
                        <span>↗</span>
                        {stat.trend}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="space-y-12 animate-fade-in-up delay-700">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-emerald-100 bg-clip-text text-transparent">
              Seamless Trading Experience
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Begin your journey with SwapBack Protocol in four straightforward steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {[
              {
                num: '01',
                title: 'Connect Your Wallet',
                desc: 'Securely link your Solana wallet using Phantom, Solflare, Ledger, or any compatible Web3 wallet provider',
                icon: '🔐'
              },
              {
                num: '02',
                title: 'Select Trading Strategy',
                desc: 'Choose from instant token swaps, automated DCA schedules, or participate in our deflationary buyback programs',
                icon: '🎯'
              },
              {
                num: '03',
                title: 'Execute Transactions',
                desc: 'Execute trades with institutional-grade security, optimal routing algorithms, and sub-second settlement times',
                icon: '⚡'
              },
              {
                num: '04',
                title: 'Maximize Returns',
                desc: 'Earn rewards through our deflationary BACK token economics and protocol participation incentives',
                icon: '💎'
              },
            ].map((step, i) => (
              <div key={i} className={`relative group animate-fade-in-up delay-${800 + i * 100}`}>
                {/* Animated connecting line (desktop only) */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-16 left-[60%] w-[80%] h-0.5 overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-emerald-500/50 via-green-500/50 to-transparent animate-flow" />
                  </div>
                )}
                
                <div className="relative p-8 bg-gradient-to-br from-slate-800/40 to-slate-900/40 rounded-2xl border border-slate-700/50 hover:border-emerald-500/60 transition-all duration-500 h-full group-hover:shadow-2xl group-hover:shadow-emerald-500/20 hover:-translate-y-2 backdrop-blur-sm">
                  {/* Floating icon */}
                  <div className="text-4xl mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    {step.icon}
                  </div>
                  
                  {/* Step number badge */}
                  <div className="inline-flex w-14 h-14 mb-4 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 group-hover:scale-110 transition-all duration-300">
                    {step.num}
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-4 group-hover:text-emerald-50 transition-colors">
                    {step.title}
                  </h3>
                  
                  <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">
                    {step.desc}
                  </p>
                  
                  {/* Progress indicator */}
                  <div className="mt-6 h-1 w-full bg-slate-700/30 rounded-full overflow-hidden">
                    <div className="h-full w-0 group-hover:w-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-700 ease-out" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative animate-fade-in-up delay-1000">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/10 rounded-3xl blur-2xl animate-pulse-slow" />
          <div className="relative p-12 lg:p-20 bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-3xl border border-slate-700/50 hover:border-emerald-500/50 backdrop-blur-sm text-center space-y-10 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/20">
            <div className="space-y-6">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-emerald-50 to-emerald-100 bg-clip-text text-transparent">
                Ready to Transform Your Trading?
              </h2>
              <p className="text-lg sm:text-xl lg:text-2xl text-slate-300 max-w-3xl mx-auto font-light leading-relaxed">
                Join thousands of sophisticated traders leveraging SwapBack Protocol for institutional-grade DeFi experiences
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
              <Link
                href="/swap"
                className="group relative px-12 py-6 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 text-white text-xl font-bold rounded-xl overflow-hidden transition-all duration-500 shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:-translate-y-1 hover:scale-105 w-full sm:w-auto"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <span className="animate-pulse-slow">🚀</span>
                  Launch Trading Platform
                  <svg className="w-6 h-6 transform group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
              </Link>
              <Link
                href="/dashboard"
                className="group px-12 py-6 bg-slate-700/50 text-white text-xl font-bold rounded-xl border-2 border-slate-600 hover:bg-slate-600/50 hover:border-emerald-500/50 transition-all duration-500 backdrop-blur-sm w-full sm:w-auto hover:-translate-y-1"
              >
                <span className="flex items-center justify-center gap-3">
                  📊 Access Dashboard
                  <svg className="w-6 h-6 transform group-hover:rotate-90 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            </div>

            {/* Enhanced trust indicators */}
            <div className="pt-10 border-t border-slate-700/50">
              <p className="text-slate-400 text-sm mb-6 uppercase tracking-wider font-semibold">Trusted by Industry Leaders</p>
              <div className="flex flex-wrap justify-center items-center gap-10 text-sm">
                <div className="flex items-center gap-3 text-slate-300 hover:text-emerald-400 transition-colors group">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-all">
                    <svg className="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="font-medium">Independently Audited</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300 hover:text-emerald-400 transition-colors group">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-all">
                    <svg className="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="font-medium">100% Non-Custodial</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300 hover:text-emerald-400 transition-colors group">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-all">
                    <svg className="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                  </div>
                  <span className="font-medium">Community Governed</span>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

