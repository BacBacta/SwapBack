"use client";

/**
 * TransactionStatusModal - Modal de transaction style Jupiter
 * 
 * Design minimaliste avec spinner central et animations fluides
 */

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, X, ExternalLink } from "lucide-react";

export type TransactionStatus = 'idle' | 'preparing' | 'signing' | 'sending' | 'confirming' | 'confirmed' | 'error';

interface TransactionStatusModalProps {
  isOpen: boolean;
  status: TransactionStatus;
  signature?: string | null;
  inputToken: { symbol: string; logoURI?: string };
  outputToken: { symbol: string; logoURI?: string };
  inputAmount: string;
  outputAmount: string;
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
        return 'Preparing transaction...';
      case 'signing':
        return 'Waiting for wallet approval...';
      case 'sending':
        return 'Sending transaction...';
      case 'confirming':
        return 'Confirming...';
      case 'confirmed':
        return 'Swap successful!';
      case 'error':
        return 'Transaction failed';
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={isSuccess || isError ? onClose : undefined}
          />

          {/* Modal - Style Jupiter */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[380px] px-4"
          >
            <div className="bg-[#191B1F] rounded-2xl overflow-hidden shadow-xl border border-[#2d2f36]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#2d2f36]">
                <span className="text-white font-medium">
                  {isSuccess ? 'Transaction Submitted' : isError ? 'Error' : 'Confirm Swap'}
                </span>
                {(isSuccess || isError) && (
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Swap visualization */}
                <div className="flex items-center justify-center gap-3 mb-6">
                  {/* Input token */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      {inputToken.logoURI ? (
                        <img 
                          src={inputToken.logoURI} 
                          alt={inputToken.symbol} 
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white font-medium">
                          {inputToken.symbol.charAt(0)}
                        </div>
                      )}
                    </div>
                    <span className="text-white font-medium mt-2">{inputAmount}</span>
                    <span className="text-gray-400 text-sm">{inputToken.symbol}</span>
                  </div>

                  {/* Arrow with loader */}
                  <div className="flex items-center justify-center w-16">
                    {isLoading ? (
                      <div className="relative">
                        {/* Spinning arc */}
                        <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24">
                          <circle
                            className="opacity-20"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="#6366f1"
                            strokeWidth="3"
                            fill="none"
                          />
                          <path
                            className="opacity-80"
                            d="M12 2a10 10 0 0 1 10 10"
                            stroke="#6366f1"
                            strokeWidth="3"
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                      </div>
                    ) : isSuccess ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"
                      >
                        <Check className="w-5 h-5 text-white" />
                      </motion.div>
                    ) : isError ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center"
                      >
                        <X className="w-5 h-5 text-white" />
                      </motion.div>
                    ) : (
                      <div className="text-gray-500">→</div>
                    )}
                  </div>

                  {/* Output token */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      {outputToken.logoURI ? (
                        <img 
                          src={outputToken.logoURI} 
                          alt={outputToken.symbol} 
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white font-medium">
                          {outputToken.symbol.charAt(0)}
                        </div>
                      )}
                      {/* Badge de succès sur le token output */}
                      {isSuccess && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[#191B1F]"
                        >
                          <Check className="w-3 h-3 text-white" />
                        </motion.div>
                      )}
                    </div>
                    <span className={`font-medium mt-2 ${isSuccess ? 'text-emerald-400 text-lg' : 'text-white'}`}>
                      {isSuccess ? `+${outputAmount}` : outputAmount}
                    </span>
                    <span className="text-gray-400 text-sm">{outputToken.symbol}</span>
                  </div>
                </div>

                {/* Montant reçu mis en valeur pour le succès */}
                {isSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4 text-center"
                  >
                    <p className="text-sm text-emerald-400 mb-1">Vous avez reçu</p>
                    <p className="text-2xl font-bold text-white">
                      {outputAmount} <span className="text-emerald-400">{outputToken.symbol}</span>
                    </p>
                  </motion.div>
                )}

                {/* Status text */}
                <div className="text-center mb-4">
                  <p className={`text-sm ${isError ? 'text-red-400' : isSuccess ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {getStatusText()}
                  </p>
                  {isError && errorMessage && (
                    <p className="text-xs text-red-400/70 mt-1 max-w-[280px] mx-auto break-words">
                      {errorMessage}
                    </p>
                  )}
                </div>

                {/* Explorer link for success */}
                {isSuccess && signature && (
                  <a
                    href={`https://solscan.io/tx/${signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm text-[#6366f1] hover:text-[#818cf8] transition-colors mb-4"
                  >
                    <span>View on Solscan</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {/* Close button */}
                {(isSuccess || isError) && (
                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl font-medium transition-all bg-[#6366f1] hover:bg-[#5558e3] text-white"
                  >
                    Close
                  </button>
                )}

                {/* Cancel hint during loading */}
                {isLoading && status === 'signing' && (
                  <p className="text-center text-xs text-gray-500 mt-4">
                    Check your wallet to confirm the transaction
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
