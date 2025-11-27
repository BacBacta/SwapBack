/**
 * Professional Swap Interface
 * Modern, clean design with complete functionality
 */

"use client";

import { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { AccountMeta, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSwapStore } from "@/store/swapStore";
import { useSwapWebSocket } from "@/hooks/useSwapWebSocket";
import { useHaptic } from "@/hooks/useHaptic";
import {
  useSwapRouter,
  DerivedSwapAccounts,
} from "@/hooks/useSwapRouter";
import type { JupiterRouteParams } from "@/hooks/useSwapRouter";
import { ORCA_WHIRLPOOL_PROGRAM_ID } from "@/sdk/config/orca-pools";
import { RAYDIUM_AMM_PROGRAM_ID } from "@/sdk/config/raydium-pools";
import { getExplorerUrl } from "@/config/constants";
import { ClientOnlyConnectionStatus } from "./ClientOnlyConnectionStatus";

// Phase 4: Lazy imports for heavy components
import dynamic from "next/dynamic";
const TokenSelector = dynamic(() => import("./TokenSelector").then(mod => ({ default: mod.TokenSelector })), { ssr: false });
const DistributionBreakdown = dynamic(() => import("./DistributionBreakdown").then(mod => ({ default: mod.DistributionBreakdown })), { ssr: false });
const SwapPreviewModal = dynamic(() => import("./SwapPreviewModal").then(mod => ({ default: mod.SwapPreviewModal })), { ssr: false });
const LoadingProgress = dynamic(() => import("./LoadingProgress").then(mod => ({ default: mod.LoadingProgress })), { ssr: false });
const RecentSwapsSidebar = dynamic(() => import("./RecentSwapsSidebar").then(mod => ({ default: mod.RecentSwapsSidebar })), { ssr: false });

import { ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { toast } from "sonner";
import { 
  formatNumberWithCommas, 
  parseFormattedNumber, 
  validateNumberInput,
  formatCurrency,
  getAdaptiveFontSize 
} from "@/utils/formatNumber";
import { PriceImpactAlert } from "@/components/PriceImpactAlert";
import { TokenSelectorModal } from "@/components/TokenSelectorModal";
import { SmartSlippage } from "@/components/SmartSlippage";
import { SwapDetailsExpandable } from "@/components/SwapDetailsExpandable";
import { SuccessModal } from "@/components/SuccessModal";
import { ErrorFeedback, detectErrorType, type ErrorType } from "@/components/ErrorFeedback";
// import { debounce } from "lodash"; // Désactivé - Pas d'auto-fetch

interface RouteStep {
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  fee: string;
}

type JupiterRoutePlanStep = {
  swapInfo?: {
    ammKey?: string;
    label?: string;
    inputMint?: string;
    outputMint?: string;
    inAmount?: string;
    outAmount?: string;
    feeAmount?: string;
    feeMint?: string;
  };
  [key: string]: unknown;
};

type OrcaDexAccounts = {
  variant: "ORCA_WHIRLPOOL";
  dexProgramId: string;
  whirlpool: string;
  tokenMintA: string;
  tokenMintB: string;
  tokenVaultA: string;
  tokenVaultB: string;
  tickArrays: string[];
  oracle: string;
  direction: "aToB" | "bToA";
  tickSpacing: number;
};

type RaydiumDexAccounts = {
  variant: "RAYDIUM_AMM";
  dexProgramId: string;
  direction: "aToB" | "bToA";
  tokenMintA: string;
  tokenMintB: string;
  ammId: string;
  ammAuthority: string;
  ammOpenOrders: string;
  ammTargetOrders: string;
  poolCoinTokenAccount: string;
  poolPcTokenAccount: string;
  poolWithdrawQueue?: string;
  poolTempLpTokenAccount?: string;
  serumProgramId: string;
  serumMarket: string;
  serumBids: string;
  serumAsks: string;
  serumEventQueue: string;
  serumCoinVault: string;
  serumPcVault: string;
  serumVaultSigner: string;
};

type RouterDexAccounts = OrcaDexAccounts | RaydiumDexAccounts;

type DexStepDescriptor = {
  index: number;
  ammKey: string;
  label: string;
  inputMint: string;
  outputMint: string;
  dexProgramId: string;
};

type DexAccountResolution = {
  descriptor: DexStepDescriptor;
  accounts: RouterDexAccounts;
};

const ORCA_PROGRAM_ID_STR = ORCA_WHIRLPOOL_PROGRAM_ID.toBase58();
const RAYDIUM_PROGRAM_ID_STR = RAYDIUM_AMM_PROGRAM_ID.toBase58();

type DexLabelMetadata = {
  keyword: string;
  friendlyName: string;
  supported: boolean;
  programId?: string;
};

const DEX_LABEL_METADATA: DexLabelMetadata[] = [
  {
    keyword: "orca",
    friendlyName: "Orca Whirlpool",
    supported: true,
    programId: ORCA_PROGRAM_ID_STR,
  },
  {
    keyword: "raydium",
    friendlyName: "Raydium",
    supported: true,
    programId: RAYDIUM_PROGRAM_ID_STR,
  },
  { keyword: "meteora", friendlyName: "Meteora DLMM", supported: false },
  { keyword: "phoenix", friendlyName: "Phoenix", supported: false },
  { keyword: "lifinity", friendlyName: "Lifinity", supported: false },
];

const matchDexLabel = (label: string): DexLabelMetadata | null => {
  const normalized = label.toLowerCase();
  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:py-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main swap surface */}
        <div className="bg-[#0C111F] border border-white/5 rounded-[32px] p-6 md:p-8 space-y-6 shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-400">Unified router</p>
              <h1 className="text-3xl font-semibold text-white mt-2">Swap tokens instantly</h1>
              <p className="text-sm text-gray-400">
                {selectedRouter === "swapback"
                  ? "Rebates BACK & burn automatique pour chaque swap."
                  : "Routing temps réel fourni par Jupiter V6."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRecentSwaps(!showRecentSwaps)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors relative min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Historique"
              >
                <ClockIcon className="w-5 h-5 text-gray-400" />
                {recentSwaps.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {recentSwaps.length}
                  </span>
                )}
              </button>
              <ClientOnlyConnectionStatus />
            </div>
          </div>

          <div className="bg-white/5 rounded-full p-1 flex text-sm font-semibold">
            <button
              onClick={() => {
                haptic.medium();
                setSelectedRouter("swapback");
              }}
              className={`flex-1 py-2.5 rounded-full transition-all ${
                selectedRouter === "swapback" ? "bg-white text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              ⚡ SwapBack
            </button>
            <button
              onClick={() => {
                haptic.medium();
                setSelectedRouter("jupiter");
              }}
              className={`flex-1 py-2.5 rounded-full transition-all ${
                selectedRouter === "jupiter" ? "bg-white text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              🪐 Jupiter
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl bg-[#151A2E] border border-white/5 p-5 space-y-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-400 font-semibold">
                <span>You pay</span>
                {swap.inputToken?.balance && (
                  <button onClick={setMaxBalance} className="text-emerald-400 hover:text-emerald-300">
                    Balance: {swap.inputToken.balance.toFixed(4)}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9,.]*"
                  value={displayInputAmount}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent font-semibold text-white text-4xl md:text-5xl tracking-tight outline-none caret-emerald-400"
                  style={{
                    fontSize: getAdaptiveFontSize(displayInputAmount.length),
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                  }}
                />
                <button
                  onClick={openInputTokenSelector}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 min-h-[52px] transition-colors"
                >
                  {swap.inputToken ? (
                    <>
                      {swap.inputToken.logoURI && (
                        <img src={swap.inputToken.logoURI} alt={swap.inputToken.symbol} className="w-7 h-7 rounded-full" />
                      )}
                      <span className="font-semibold text-base">{swap.inputToken.symbol}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Select</span>
                  )}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{inputAmount > 0 ? `≈ ${formatCurrency(inputUsdValue)}` : "Entrez un montant"}</span>
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handleAmountPreset(pct)}
                      disabled={!swap.inputToken?.balance}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                        swap.inputToken?.balance
                          ? "bg-white/5 hover:bg-white/10 text-gray-300"
                          : "bg-white/5 text-gray-600 cursor-not-allowed"
                      }`}
                    >
                      {pct === 100 ? "MAX" : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                {...useSwipeable({
                  onSwipedLeft: () => {
                    haptic.medium();
                    switchTokens();
                  },
                  onSwipedRight: () => {
                    haptic.medium();
                    switchTokens();
                  },
                  trackTouch: true,
                  trackMouse: false,
                })}
                onClick={() => {
                  haptic.medium();
                  switchTokens();
                }}
                className="-mt-6 mb-2 bg-white text-gray-900 rounded-full p-3 border border-white/20 hover:rotate-180 transition-transform duration-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            <div className="rounded-3xl bg-[#151A2E] border border-white/5 p-5 space-y-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-400 font-semibold">
                <span>You receive</span>
                {swap.outputToken?.balance && <span>Balance: {swap.outputToken.balance.toFixed(4)}</span>}
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  inputMode="decimal"
                  value={displayOutputAmount}
                  readOnly
                  placeholder="0.00"
                  className="flex-1 bg-transparent font-semibold text-white text-4xl md:text-5xl tracking-tight outline-none"
                  style={{
                    fontSize: getAdaptiveFontSize(displayOutputAmount.length),
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                  }}
                />
                <button
                  onClick={openOutputTokenSelector}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 min-h-[52px] transition-colors"
                >
                  {swap.outputToken ? (
                    <>
                      {swap.outputToken.logoURI && (
                        <img src={swap.outputToken.logoURI} alt={swap.outputToken.symbol} className="w-7 h-7 rounded-full" />
                      )}
                      <span className="font-semibold text-base">{swap.outputToken.symbol}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Select</span>
                  )}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="text-xs text-gray-500">
                {outputAmount > 0 ? `≈ ${formatCurrency(outputUsdValue)}` : "En attente d'un montant"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#151A2E] border border-white/5 p-4 flex items-center justify-between text-sm">
              <span className="text-gray-400">Rate</span>
              <span className="text-white font-semibold">
                1 {swap.inputToken?.symbol || "—"} ≈ {inputAmount > 0 && outputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : "0"} {swap.outputToken?.symbol || "—"}
              </span>
            </div>
            <div className="rounded-2xl bg-[#151A2E] border border-white/5 p-4 flex items-center justify-between text-sm">
              <span className="text-gray-400">Price impact</span>
              <span className={priceImpactColorClass}>{priceImpact.toFixed(2)}%</span>
            </div>
            <div className="rounded-2xl bg-[#151A2E] border border-white/5 p-4 flex items-center justify-between text-sm">
              <span className="text-gray-400">Slippage</span>
              <span className="text-white font-semibold">{swap.slippageTolerance}%</span>
            </div>
            <div className="rounded-2xl bg-[#151A2E] border border-white/5 p-4 flex items-center justify-between text-sm">
              <span className="text-gray-400">Refresh</span>
              <span className="text-white font-semibold">{routes.isLoading ? "…" : `${priceRefreshCountdown}s`}</span>
            </div>
          </div>

          <div className="rounded-3xl bg-[#151A2E] border border-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Slippage rapide</span>
              <span className="text-white font-semibold">{swap.slippageTolerance}%</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[0.1, 0.5, 1, 2].map((value) => (
                <button
                  key={value}
                  onClick={() => handleSlippagePreset(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    swap.slippageTolerance === value ? "bg-white text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {value}%
                </button>
              ))}
              <button
                onClick={() => setShowSlippageModal(true)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 text-gray-300 hover:bg-white/10"
              >
                Custom
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-[#151A2E] border border-white/5 p-4">
            <SmartSlippage
              value={swap.slippageTolerance}
              onChange={setSlippageTolerance}
              tokenPair={swap.inputToken && swap.outputToken ? `${swap.inputToken.symbol}/${swap.outputToken.symbol}` : undefined}
            />
          </div>

          {hasInsufficientBalance && (
            <p className="text-xs text-center text-red-400">Balance insuffisante pour cette opération.</p>
          )}

          <button
            onClick={canExecuteSwap ? handleExecuteSwap : handleSearchRoute}
            disabled={primaryButtonDisabled}
            className={`w-full py-4 min-h-[60px] rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] shadow-lg ${primaryButtonClass}`}
            aria-label={getButtonText()}
          >
            {getButtonText()}
          </button>

          <div className="text-center text-xs text-gray-500">
            {selectedRouter === "swapback" ? "⚡ Optimisé par SwapBack" : "🪐 Powered by Jupiter"}
          </div>
        </div>

        {/* Side insights column */}
        <div className="space-y-4">
          {!isMinimalLayout && selectedRouter === "swapback" && (
            <div className={`rounded-3xl border ${dealQuality.border} p-5 bg-gradient-to-br ${dealQuality.gradient} text-white/90 space-y-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/70">{dealQuality.badge}</p>
                  <p className="text-2xl font-semibold mt-2 flex items-center gap-2">
                    <span>{dealQuality.icon}</span>
                    {dealQuality.label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold leading-none">{dealQuality.highlight}</p>
                  <p className="text-xs text-white/70 mt-1">{dealQuality.highlightSuffix}</p>
                </div>
              </div>
              <p className="text-sm text-white/80">{dealQuality.description}</p>
              {shouldSuggestDealTweak && (
                <div className="flex items-center justify-between gap-3 text-xs md:text-sm">
                  <span className="text-white/80">Astuce rapide : réduisez légèrement votre montant pour améliorer le prix.</span>
                  <button
                    type="button"
                    onClick={() => handleReduceAmount(reduceSuggestionValue)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                  >
                    -{reduceSuggestionValue}%
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-[#0C111F] border border-white/5 rounded-[24px] p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Routeur actif</p>
                <p className="text-xl font-semibold text-white">{aggregatorLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Confiance</p>
                <p className="text-emerald-400 text-2xl font-semibold">{routerConfidenceScore}%</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm text-gray-400">
              <div>
                <p className="text-[11px] uppercase">Hops</p>
                <p className="text-white font-semibold">{routeHopCount || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase">Mode</p>
                <p className="text-white font-semibold">{selectedRouter === "swapback" ? "Rebates" : "Market"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase">Refresh</p>
                <p className="text-white font-semibold">{routes.isLoading ? "…" : `${priceRefreshCountdown}s`}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!routes.isLoading) {
                    handleSearchRoute();
                  }
                }}
                disabled={refreshButtonDisabled}
                className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all ${
                  refreshButtonDisabled ? "bg-white/5 text-gray-500 cursor-not-allowed" : "bg-white text-black hover:bg-gray-200"
                }`}
              >
                {routes.isLoading ? "Calcul en cours…" : "Rafraîchir le devis"}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setSelectedRouter(selectedRouter === "swapback" ? "jupiter" : "swapback");
                }}
                className="w-full py-3 rounded-2xl border border-white/10 text-sm text-gray-300 hover:border-white/30"
              >
                {altRouterLabel}
              </button>
            </div>
          </div>

          {hasSearchedRoute && routes.selectedRoute && priceImpact > 0 && (
            <div className="bg-[#20172A] border border-red-500/20 rounded-2xl p-4">
              <PriceImpactAlert priceImpact={priceImpact} onReduceAmount={() => handleReduceAmount(10)} />
            </div>
          )}

          {routes.isLoading && (
            <div className="bg-[#0C111F] border border-white/5 rounded-2xl p-4" role="status" aria-live="polite">
              <LoadingProgress step={loadingStep} progress={loadingProgress} />
            </div>
          )}

          {routeError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#251014] border border-red-500/30 rounded-2xl p-4"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                <div className="flex-1">
                  <p className="text-sm text-red-200 mb-2">{routeError}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => {
                        haptic.light();
                        setInputAmount((parseFloat(swap.inputAmount) * 0.9).toString());
                        setRouteError(null);
                      }}
                      className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-200 hover:bg-red-500/30"
                    >
                      Try 10% less
                    </button>
                    <button
                      onClick={() => {
                        haptic.light();
                        switchTokens();
                        setRouteError(null);
                      }}
                      className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-200 hover:bg-red-500/30"
                    >
                      Reverse
                    </button>
                    <button
                      onClick={() => setRouteError(null)}
                      className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-200 hover:bg-red-500/30"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {hasSearchedRoute && routes.selectedRoute && (
            <div className="space-y-4">
              {swapSignature && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4" role="status" aria-live="polite">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircleIcon className="w-5 h-5" />
                    <span className="font-semibold">Swap Successful</span>
                  </div>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200"
                    >
                      View transaction
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              )}

              {swapError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm text-red-200" role="alert">
                  {swapError}
                </div>
              )}

              <div className="bg-[#0C111F] border border-white/5 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Price details</span>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{priceRefreshCountdown}s</span>
                    <button
                      onClick={() => {
                        haptic.light();
                        handleSearchRoute();
                      }}
                      className="p-1.5 rounded-full bg-white/5 hover:bg-white/10"
                      title="Refresh now"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-400 flex justify-between">
                  <span>Rate</span>
                  <span className="text-white font-semibold">
                    1 {swap.inputToken?.symbol} ≈ {inputAmount > 0 && outputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : "0"} {swap.outputToken?.symbol}
                  </span>
                </div>
                <div className="text-sm text-gray-400 flex justify-between">
                  <span>Price impact</span>
                  <span className={priceImpactColorClass}>{priceImpact.toFixed(2)}%</span>
                </div>
              </div>

              {swap.inputToken && swap.outputToken && (
                <SwapDetailsExpandable
                  inputToken={{
                    symbol: swap.inputToken.symbol,
                    amount: swap.inputAmount,
                    usdPrice: swap.inputToken.usdPrice,
                  }}
                  outputToken={{
                    symbol: swap.outputToken.symbol,
                    amount: swap.outputAmount,
                    usdPrice: swap.outputToken.usdPrice,
                  }}
                  priceImpact={priceImpact}
                  slippage={swap.slippageTolerance}
                  route={routes.selectedRoute?.venues || []}
                />
              )}

              {false && selectedRouter === "swapback" && mockRouteInfo && (npiUsd > 0 || platformFeeUsd > 0) && (
                <DistributionBreakdown npiAmount={npiUsd} platformFee={platformFeeUsd} />
              )}

              {routes.selectedRoute.venues && routes.selectedRoute.venues.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0C111F] border border-white/5 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-300">Route path</span>
                    <span className="text-xs text-gray-500">{routes.selectedRoute.venues.length} hop{routes.selectedRoute.venues.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg flex-shrink-0">
                      {swap.inputToken?.logoURI && <img src={swap.inputToken.logoURI} alt="" className="w-5 h-5 rounded-full" />}
                      <span className="text-sm font-medium text-emerald-400">{swap.inputToken?.symbol}</span>
                    </div>
                    {routes.selectedRoute.venues.map((venue, index) => (
                      <div key={index} className="flex items-center gap-2 flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
                          <span className="text-xs text-gray-400 font-medium">{venue}</span>
                        </div>
                      </div>
                    ))}
                    <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg flex-shrink-0">
                      {swap.outputToken?.logoURI && <img src={swap.outputToken.logoURI} alt="" className="w-5 h-5 rounded-full" />}
                      <span className="text-sm font-medium text-emerald-400">{swap.outputToken?.symbol}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Token Selector Modal - NEW */}
      {showTokenSelector && (
        <TokenSelectorModal
          isOpen={showTokenSelector}
          onClose={() => setShowTokenSelector(false)}
          onSelect={(token) => {
            handleTokenSelect(token);
            setShowTokenSelector(false);
          }}
          title={tokenSelectorType === "input" ? "Select Input Token" : "Select Output Token"}
          selectedToken={tokenSelectorType === "input" ? swap.inputToken?.address : swap.outputToken?.address}
        />
      )}
      
      {/* Swap Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && mockRouteInfo && (
          <SwapPreviewModal
            isOpen={showPreviewModal}
            onClose={() => setShowPreviewModal(false)}
            onConfirm={handleExecuteSwap}
            fromToken={{
              symbol: swap.inputToken?.symbol || '',
              amount: swap.inputAmount,
              logoURI: swap.inputToken?.logoURI,
            }}
            toToken={{
              symbol: swap.outputToken?.symbol || '',
              amount: swap.outputAmount,
              logoURI: swap.outputToken?.logoURI,
            }}
            rate={outputAmount > 0 && inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : '0'}
            priceImpact={priceImpact}
            minReceived={(outputAmount * (1 - swap.slippageTolerance / 100)).toFixed(6)}
            slippage={swap.slippageTolerance}
            networkFee="0.000005 SOL"
            platformFee={mockRouteInfo.fees.toFixed(6)}
            route={routes.selectedRoute.venues}
          />
        )}
      </AnimatePresence>
      
      {/* Recent Swaps Sidebar */}
      <AnimatePresence>
        {showRecentSwaps && (
          <RecentSwapsSidebar
            swaps={recentSwaps}
            isOpen={showRecentSwaps}
            onClose={() => setShowRecentSwaps(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Success Modal - NEW */}
      {lastSwapData && (
        <SuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setLastSwapData(null);
          }}
          inputToken={lastSwapData.inputToken}
          outputToken={lastSwapData.outputToken}
          explorerUrl={lastSwapData.explorerUrl}
          onNewSwap={() => {
            setInputAmount("");
            setSwapSignature(null);
          }}
        />
      )}
      
      {/* Error Feedback - NEW */}
      {errorType && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <ErrorFeedback
            error={errorType}
            message={errorMessage || undefined}
            onClose={() => {
              setErrorType(null);
              setErrorMessage(null);
              setSwapError(null);
            }}
            onRetry={() => {
              setErrorType(null);
              setErrorMessage(null);
              handleExecuteSwap();
            }}
            onAdjustSlippage={() => {
              setErrorType(null);
              setErrorMessage(null);
              setSlippageTolerance(swap.slippageTolerance + 0.5);
            }}
            onReduceAmount={() => {
              setErrorType(null);
              setErrorMessage(null);
              handleReduceAmount(20);
            }}
          />
        </div>
      )}
    </div>
  );
}
