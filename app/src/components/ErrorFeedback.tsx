/**
 * Intelligent Error Feedback Component
 * Provides contextual error messages with actionable solutions
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  BanknotesIcon,
  ClockIcon,
  WifiIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

export type ErrorType = 
  | 'insufficient_balance'
  | 'slippage_exceeded'
  | 'price_impact_high'
  | 'insufficient_liquidity'
  | 'network_error'
  | 'timeout'
  | 'user_rejected'
  | 'unknown';

export interface ErrorFeedbackProps {
  error: ErrorType | null;
  message?: string;
  onClose: () => void;
  onRetry?: () => void;
  onAdjustSlippage?: () => void;
  onReduceAmount?: () => void;
  onSwitchNetwork?: () => void;
}

// Type for action onClick handlers
type ErrorActionHandler = 'onRetry' | 'onAdjustSlippage' | 'onReduceAmount' | 'onSwitchNetwork' | 'onClose';

interface ErrorConfig {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  actions: Array<{
    label: string;
    onClick: ErrorActionHandler;
    variant: 'primary' | 'secondary';
  }>;
}

const ERROR_CONFIGS: Record<ErrorType, ErrorConfig> = {
  insufficient_balance: {
    icon: BanknotesIcon,
    title: "Insufficient Balance",
    description: "You don't have enough tokens to complete this swap",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    actions: [
      { label: "Reduce Amount", onClick: 'onReduceAmount', variant: 'primary' },
      { label: "Close", onClick: 'onClose', variant: 'secondary' }
    ]
  },
  slippage_exceeded: {
    icon: ChartBarIcon,
    title: "Slippage Exceeded",
    description: "Price moved more than your slippage tolerance during execution",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    actions: [
      { label: "Increase Slippage", onClick: 'onAdjustSlippage', variant: 'primary' },
      { label: "Retry", onClick: 'onRetry', variant: 'secondary' }
    ]
  },
  price_impact_high: {
    icon: ExclamationTriangleIcon,
    title: "Price Impact Too High",
    description: "This trade will significantly affect the token price",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    actions: [
      { label: "Reduce Amount", onClick: 'onReduceAmount', variant: 'primary' },
      { label: "Continue Anyway", onClick: 'onRetry', variant: 'secondary' }
    ]
  },
  insufficient_liquidity: {
    icon: ChartBarIcon,
    title: "Insufficient Liquidity",
    description: "Not enough liquidity available for this trade size",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    actions: [
      { label: "Reduce Amount", onClick: 'onReduceAmount', variant: 'primary' },
      { label: "Close", onClick: 'onClose', variant: 'secondary' }
    ]
  },
  network_error: {
    icon: WifiIcon,
    title: "Network Error",
    description: "Failed to connect to the blockchain network",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    actions: [
      { label: "Retry", onClick: 'onRetry', variant: 'primary' },
      { label: "Switch Network", onClick: 'onSwitchNetwork', variant: 'secondary' }
    ]
  },
  timeout: {
    icon: ClockIcon,
    title: "Transaction Timeout",
    description: "The transaction took too long to process",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    actions: [
      { label: "Retry", onClick: 'onRetry', variant: 'primary' },
      { label: "Close", onClick: 'onClose', variant: 'secondary' }
    ]
  },
  user_rejected: {
    icon: XCircleIcon,
    title: "Transaction Rejected",
    description: "You rejected the transaction in your wallet",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    actions: [
      { label: "Try Again", onClick: 'onRetry', variant: 'primary' },
      { label: "Close", onClick: 'onClose', variant: 'secondary' }
    ]
  },
  unknown: {
    icon: XCircleIcon,
    title: "Transaction Failed",
    description: "An unexpected error occurred. Please try again.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    actions: [
      { label: "Retry", onClick: 'onRetry', variant: 'primary' },
      { label: "Close", onClick: 'onClose', variant: 'secondary' }
    ]
  }
};

export function ErrorFeedback({
  error,
  message,
  onClose,
  onRetry,
  onAdjustSlippage,
  onReduceAmount,
  onSwitchNetwork
}: ErrorFeedbackProps) {
  if (!error) return null;

  const config = ERROR_CONFIGS[error];
  const Icon = config.icon;

  const handleAction = (actionKey: ErrorActionHandler) => {
    const actionMap = {
      onRetry,
      onAdjustSlippage,
      onReduceAmount,
      onSwitchNetwork,
      onClose
    };
    
    const action = actionMap[actionKey];
    if (action) {
      action();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`relative p-4 rounded-2xl border ${config.bgColor} border-white/10 
                   shadow-lg backdrop-blur-sm`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-lg 
                   transition-colors active:scale-95"
        >
          <XMarkIcon className="w-4 h-4 text-gray-400" />
        </button>

        <div className="flex gap-4 pr-8">
          {/* Icon */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${config.bgColor} 
                        flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>

          {/* Content */}
          <div className="flex-1 space-y-3">
            {/* Title */}
            <div>
              <h3 className="font-semibold text-white mb-1">
                {config.title}
              </h3>
              <p className="text-sm text-gray-400">
                {message || config.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {config.actions.map((action, index) => {
                const isPrimary = action.variant === 'primary';
                return (
                  <button
                    key={index}
                    onClick={() => handleAction(action.onClick)}
                    className={`
                      px-4 py-2 rounded-xl font-medium text-sm transition-all active:scale-95
                      ${isPrimary 
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/25' 
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }
                    `}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>

            {/* Additional Info for Retry Actions */}
            {error === 'network_error' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pt-2 border-t border-white/10"
              >
                <p className="text-xs text-gray-500">
                  💡 Tip: Check your internet connection and RPC endpoint
                </p>
              </motion.div>
            )}

            {error === 'slippage_exceeded' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pt-2 border-t border-white/10"
              >
                <p className="text-xs text-gray-500">
                  💡 Tip: Try increasing slippage to 1-2% for volatile tokens
                </p>
              </motion.div>
            )}

            {error === 'insufficient_liquidity' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pt-2 border-t border-white/10"
              >
                <p className="text-xs text-gray-500">
                  💡 Tip: Try splitting your trade into smaller amounts
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Animated Border Pulse */}
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 pointer-events-none"
          style={{ borderColor: config.color.replace('text-', '') }}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Utility function to detect error type from error message
 */
export function detectErrorType(errorMessage: string): ErrorType {
  const message = errorMessage.toLowerCase();
  
  if (message.includes('insufficient') && message.includes('balance')) {
    return 'insufficient_balance';
  }
  if (message.includes('slippage')) {
    return 'slippage_exceeded';
  }
  if (message.includes('price impact')) {
    return 'price_impact_high';
  }
  if (message.includes('liquidity')) {
    return 'insufficient_liquidity';
  }
  if (message.includes('network') || message.includes('connection')) {
    return 'network_error';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  if (message.includes('rejected') || message.includes('user denied')) {
    return 'user_rejected';
  }
  
  return 'unknown';
}
