"use client";

import { motion } from "framer-motion";
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon, ClockIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

interface RecentSwap {
  id: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  timestamp: number;
  status: 'success' | 'pending' | 'failed';
  txSignature?: string;
}

interface RecentSwapsSidebarProps {
  swaps: RecentSwap[];
  isOpen: boolean;
  onClose: () => void;
}

export function RecentSwapsSidebar({ swaps, isOpen, onClose }: RecentSwapsSidebarProps) {
  if (!isOpen) return null;

  const getStatusIcon = (status: RecentSwap['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="w-4 h-4 text-emerald-400" />;
      case 'pending':
        return <ClockIcon className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'failed':
        return <XCircleIcon className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: RecentSwap['status']) => {
    switch (status) {
      case 'success':
        return 'border-emerald-500/20 bg-emerald-500/5';
      case 'pending':
        return 'border-yellow-500/20 bg-yellow-500/5';
      case 'failed':
        return 'border-red-500/20 bg-red-500/5';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="fixed right-0 top-0 bottom-0 w-80 bg-[#0C0C0C]/95 backdrop-blur-xl border-l border-cyan-500/20 p-6 overflow-y-auto z-50 shadow-[-20px_0_50px_rgba(6,182,212,0.2)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Recent Swaps</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Swaps List */}
        <div className="space-y-3">
          {swaps.length === 0 ? (
            <div className="text-center py-12">
              <ArrowPathIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No recent swaps</p>
              <p className="text-gray-500 text-xs mt-1">Your swap history will appear here</p>
            </div>
          ) : (
            swaps.map((swap) => (
              <motion.div
                key={swap.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl border ${getStatusColor(swap.status)} hover:border-opacity-40 transition-all cursor-pointer`}
              >
                {/* Token Flow */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 flex-1">
                    <span className="text-white font-medium">{swap.fromAmount}</span>
                    <span className="text-gray-400 text-sm">{swap.fromToken}</span>
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-gray-600 mx-2" />
                  <div className="flex items-center space-x-2 flex-1 justify-end">
                    <span className="text-white font-medium">{swap.toAmount}</span>
                    <span className="text-gray-400 text-sm">{swap.toToken}</span>
                  </div>
                </div>

                {/* Status and Time */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(swap.status)}
                    <span className="text-gray-400 capitalize">{swap.status}</span>
                  </div>
                  <span className="text-gray-500">
                    {formatDistanceToNow(swap.timestamp, { addSuffix: true })}
                  </span>
                </div>

                {/* Transaction Link */}
                {swap.txSignature && swap.status === 'success' && (
                  <a
                    href={`https://solscan.io/tx/${swap.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 mt-2 inline-block"
                  >
                    View on Solscan →
                  </a>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Clear History Button */}
        {swaps.length > 0 && (
          <button
            onClick={() => {
              // TODO: Clear history logic
            }}
            className="w-full mt-6 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 text-sm rounded-lg transition-colors"
          >
            Clear History
          </button>
        )}
      </motion.aside>
    </>
  );
}
