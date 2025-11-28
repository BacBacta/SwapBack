/**
 * Early Unlock Warning Modal
 * Professional warning modal for early unlock with penalty confirmation
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ExclamationTriangleIcon,
  XMarkIcon,
  FireIcon,
  ShieldExclamationIcon,
  ClockIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

interface EarlyUnlockWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  lockedAmount: number;
  penaltyPercentage?: number;
  timeRemaining?: string;
  isLoading?: boolean;
}

export function EarlyUnlockWarningModal({
  isOpen,
  onClose,
  onConfirm,
  lockedAmount,
  penaltyPercentage = 2,
  timeRemaining,
  isLoading = false,
}: EarlyUnlockWarningModalProps) {
  const penaltyAmount = lockedAmount * (penaltyPercentage / 100);
  const amountAfterPenalty = lockedAmount - penaltyAmount;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ 
              duration: 0.3, 
              type: "spring", 
              stiffness: 300, 
              damping: 30 
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-950 border border-orange-500/30 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden">
              {/* Warning Header Gradient */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500" />
              
              {/* Pulsing Warning Background */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={onClose}
                disabled={isLoading}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all z-10 disabled:opacity-50"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>

              {/* Content */}
              <div className="relative p-6">
                {/* Warning Icon */}
                <div className="flex justify-center mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                    className="relative"
                  >
                    <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl animate-pulse" />
                    <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                      <ShieldExclamationIcon className="w-8 h-8 text-white" />
                    </div>
                  </motion.div>
                </div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-center mb-6"
                >
                  <h2 className="text-xl font-bold text-white mb-1">
                    Early Unlock Warning
                  </h2>
                  <p className="text-gray-400 text-sm">
                    You are about to unlock before the lock period ends
                  </p>
                </motion.div>

                {/* Time Remaining Badge */}
                {timeRemaining && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center justify-center gap-2 mb-6"
                  >
                    <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full">
                      <ClockIcon className="w-4 h-4 text-orange-400" />
                      <span className="text-orange-300 text-sm font-medium">
                        {timeRemaining} remaining
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Penalty Details Card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6 space-y-3"
                >
                  {/* Locked Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BanknotesIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400 text-sm">Locked Amount</span>
                    </div>
                    <span className="text-white font-semibold">
                      {lockedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} BACK
                    </span>
                  </div>

                  {/* Penalty */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FireIcon className="w-4 h-4 text-red-400" />
                      <span className="text-gray-400 text-sm">
                        Penalty ({penaltyPercentage}%)
                      </span>
                    </div>
                    <span className="text-red-400 font-semibold">
                      -{penaltyAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} BACK
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/10" />

                  {/* You Receive */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-medium">You Receive</span>
                    <span className="text-emerald-400 font-bold text-lg">
                      {amountAfterPenalty.toLocaleString(undefined, { maximumFractionDigits: 2 })} BACK
                    </span>
                  </div>
                </motion.div>

                {/* Warning Message */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6"
                >
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-red-300 font-medium mb-1">
                      Tokens will be burned permanently
                    </p>
                    <p className="text-red-200/70">
                      The penalty amount of {penaltyAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} BACK will be 
                      permanently removed from circulation. This action cannot be undone.
                    </p>
                  </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="flex gap-3"
                >
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <FireIcon className="w-5 h-5" />
                        <span>Confirm Early Unlock</span>
                      </>
                    )}
                  </button>
                </motion.div>

                {/* Footer Info */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-center text-gray-500 text-xs mt-4"
                >
                  By confirming, you agree to the early unlock penalty terms
                </motion.p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
