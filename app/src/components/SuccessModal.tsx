/**
 * Success Modal with Confetti Animation
 * Celebration UX after successful swap
 */

"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
  ShareIcon,
  XMarkIcon,
  ArrowDownIcon
} from "@heroicons/react/24/outline";
import { formatNumberWithCommas, formatCurrency } from "@/utils/formatNumber";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputToken: {
    symbol: string;
    amount: string;
    logoURI?: string;
  };
  outputToken: {
    symbol: string;
    amount: string;
    logoURI?: string;
  };
  explorerUrl?: string;
  onNewSwap?: () => void;
}

export function SuccessModal({
  isOpen,
  onClose,
  inputToken,
  outputToken,
  explorerUrl,
  onNewSwap
}: SuccessModalProps) {
  // Trigger confetti animation
  useEffect(() => {
    if (isOpen) {
      triggerConfetti();
    }
  }, [isOpen]);

  const triggerConfetti = () => {
    // Create simple confetti effect with DOM
    const colors = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
    const container = document.body;

    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = Math.random() * window.innerWidth + 'px';
      confetti.style.top = '-10px';
      confetti.style.opacity = '1';
      confetti.style.pointerEvents = 'none';
      confetti.style.zIndex = '9999';
      confetti.style.borderRadius = '50%';
      
      container.appendChild(confetti);

      const fall = confetti.animate([
        { 
          transform: `translateY(0) rotate(0deg)`,
          opacity: 1
        },
        { 
          transform: `translateY(${window.innerHeight + 10}px) rotate(${Math.random() * 720}deg)`,
          opacity: 0
        }
      ], {
        duration: Math.random() * 2000 + 2000,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      });

      fall.onfinish = () => confetti.remove();
    }
  };

  const handleShare = async () => {
    const text = `Just swapped ${inputToken.amount} ${inputToken.symbol} for ${outputToken.amount} ${outputToken.symbol} on SwapBack! 🚀`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SwapBack Trade',
          text: text,
          url: explorerUrl || window.location.href
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text + '\n' + (explorerUrl || ''));
      alert('Copied to clipboard!');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative max-w-md w-full bg-gradient-to-br from-gray-900 to-gray-800 
                   rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 hover:bg-white/10 rounded-lg 
                     transition-colors active:scale-95"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>

          <div className="relative p-8">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                delay: 0.1,
                damping: 15,
                stiffness: 200 
              }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br 
                       from-emerald-500 to-emerald-600 flex items-center justify-center
                       shadow-lg shadow-emerald-500/50"
            >
              <CheckCircleIcon className="w-12 h-12 text-white" />
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-bold text-center text-white mb-2"
            >
              Swap Successful! 🎉
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center text-gray-400 mb-8"
            >
              Your transaction has been confirmed
            </motion.p>

            {/* Swap Summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4 mb-8 p-6 bg-black/40 rounded-2xl border border-white/10"
            >
              {/* Input Token */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">You paid</span>
                <div className="flex items-center gap-2">
                  {inputToken.logoURI && (
                    <img
                      src={inputToken.logoURI}
                      alt={inputToken.symbol}
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  <span className="font-medium text-white">
                    {formatNumberWithCommas(parseFloat(inputToken.amount).toFixed(6))} {inputToken.symbol}
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="p-2 bg-white/5 rounded-lg">
                  <ArrowDownIcon className="w-4 h-4 text-gray-500" />
                </div>
              </div>

              {/* Output Token */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">You received</span>
                <div className="flex items-center gap-2">
                  {outputToken.logoURI && (
                    <img
                      src={outputToken.logoURI}
                      alt={outputToken.symbol}
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  <span className="font-medium text-emerald-400">
                    {formatNumberWithCommas(parseFloat(outputToken.amount).toFixed(6))} {outputToken.symbol}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              {/* View Explorer */}
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 
                           bg-white/10 hover:bg-white/20 rounded-xl font-medium
                           transition-all active:scale-95 text-white"
                >
                  <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                  View on Explorer
                </a>
              )}

              {/* Share */}
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-3 
                         bg-white/5 hover:bg-white/10 rounded-xl font-medium
                         transition-all active:scale-95 text-gray-400"
              >
                <ShareIcon className="w-5 h-5" />
                Share Trade
              </button>

              {/* New Swap */}
              <button
                onClick={() => {
                  onClose();
                  onNewSwap?.();
                }}
                className="w-full py-3 text-gray-400 hover:text-white font-medium
                         transition-colors"
              >
                Make Another Swap
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
