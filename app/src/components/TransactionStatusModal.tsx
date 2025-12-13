"use client";

/**
 * TransactionStatusModal - Modal style Jupiter AG
 * 
 * Design ultra-minimaliste:
 * - Spinner central pendant le chargement
 * - Icône de succès/erreur
 * - Texte minimal
 * - Lien explorateur
 */

import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ExternalLink } from "lucide-react";

export type TransactionStatus = 'idle' | 'preparing' | 'signing' | 'sending' | 'confirming' | 'confirmed' | 'error';

interface TransactionStatusModalProps {
  isOpen: boolean;
  status: TransactionStatus;
  signature?: string | null;
  inputToken: { symbol: string; logoURI?: string };
  outputToken: { symbol: string; logoURI?: string };
  inputAmount: string;
  outputAmount: string;
  inputUsdValue?: number;
  outputUsdValue?: number;
  onClose: () => void;
  errorMessage?: string;
}

export function TransactionStatusModal({
  isOpen,
  status,
  signature,
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
  onClose,
  errorMessage,
}: TransactionStatusModalProps) {
  if (!isOpen) return null;

  const isLoading = ['preparing', 'signing', 'sending', 'confirming'].includes(status);
  const isSuccess = status === 'confirmed';
  const isError = status === 'error';

  const getStatusText = () => {
    switch (status) {
      case 'preparing':
      case 'signing':
        return 'Confirm in wallet';
      case 'sending':
      case 'confirming':
        return 'Processing...';
      case 'confirmed':
        return 'Success';
      case 'error':
        return 'Failed';
      default:
        return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={isSuccess || isError ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="bg-[#131318] rounded-2xl p-8 min-w-[320px] max-w-[360px] text-center">
              
              {/* Status Icon */}
              <div className="flex justify-center mb-6">
                {isLoading ? (
                  <div className="relative w-20 h-20">
                    {/* Outer spinning ring */}
                    <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80">
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="rgba(99, 102, 241, 0.15)"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        d="M40 4 A36 36 0 0 1 76 40"
                        stroke="#6366f1"
                        strokeWidth="4"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    {/* Token icon in center */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {outputToken.logoURI ? (
                        <img 
                          src={outputToken.logoURI} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-white font-medium">
                          {outputToken.symbol.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                ) : isSuccess ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: "spring" }}
                      className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center"
                    >
                      <Check className="w-8 h-8 text-white" strokeWidth={3} />
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: "spring" }}
                      className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center"
                    >
                      <X className="w-8 h-8 text-white" strokeWidth={3} />
                    </motion.div>
                  </motion.div>
                )}
              </div>

              {/* Status Text */}
              <h3 className={`text-xl font-semibold mb-2 ${
                isSuccess ? 'text-emerald-400' : isError ? 'text-red-400' : 'text-white'
              }`}>
                {getStatusText()}
              </h3>

              {/* Swap Summary - Only show on success */}
              {isSuccess && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-gray-400 text-sm mb-4"
                >
                  {inputAmount} {inputToken.symbol} → {outputAmount} {outputToken.symbol}
                </motion.p>
              )}

              {/* Error message */}
              {isError && errorMessage && (
                <p className="text-gray-500 text-sm mb-4 max-w-[280px] mx-auto">
                  {errorMessage.length > 100 ? errorMessage.slice(0, 100) + '...' : errorMessage}
                </p>
              )}

              {/* Loading hint */}
              {isLoading && (
                <p className="text-gray-500 text-sm">
                  {status === 'signing' ? 'Check your wallet' : 'Please wait...'}
                </p>
              )}

              {/* Explorer Link */}
              {isSuccess && signature && (
                <motion.a
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  href={`https://solscan.io/tx/${signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors mt-2 mb-6"
                >
                  View transaction
                  <ExternalLink className="w-3.5 h-3.5" />
                </motion.a>
              )}

              {/* Close Button */}
              {(isSuccess || isError) && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  onClick={onClose}
                  className={`w-full py-3 rounded-xl font-medium transition-all mt-4 ${
                    isSuccess 
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {isSuccess ? 'Done' : 'Close'}
                </motion.button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
