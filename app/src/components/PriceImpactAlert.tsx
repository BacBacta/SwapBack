/**
 * Price Impact Alert Component
 * Shows progressive warnings based on price impact severity
 */

import { motion } from "framer-motion";
import { 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  XCircleIcon 
} from "@heroicons/react/24/outline";

interface PriceImpactAlertProps {
  priceImpact: number;
  onReduceAmount?: () => void;
  onSplitTrade?: () => void;
}

export function PriceImpactAlert({ 
  priceImpact, 
  onReduceAmount,
  onSplitTrade 
}: PriceImpactAlertProps) {
  // No warning if impact is less than 1%
  if (priceImpact < 1) return null;

  // Medium impact: 1-3%
  if (priceImpact < 3) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
      >
        <InformationCircleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-yellow-400 mb-1">
            Medium Price Impact ({priceImpact.toFixed(2)}%)
          </div>
          <div className="text-xs text-gray-400">
            You'll receive slightly less than expected due to liquidity
          </div>
        </div>
      </motion.div>
    );
  }

  // High impact: 3-10%
  if (priceImpact < 10) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl"
      >
        <div className="flex items-start gap-3 mb-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-orange-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-orange-400 mb-1">
              High Price Impact ({priceImpact.toFixed(2)}%)
            </div>
            <div className="text-sm text-gray-400">
              Consider splitting into smaller trades or waiting for better liquidity
            </div>
          </div>
        </div>
        
        {(onReduceAmount || onSplitTrade) && (
          <div className="flex gap-2">
            {onReduceAmount && (
              <button
                onClick={onReduceAmount}
                className="flex-1 py-2 px-3 bg-orange-500/20 hover:bg-orange-500/30 
                         text-orange-400 rounded-lg text-sm font-medium transition-colors
                         active:scale-95"
              >
                Reduce 10%
              </button>
            )}
            {onSplitTrade && (
              <button
                onClick={onSplitTrade}
                className="flex-1 py-2 px-3 bg-orange-500/20 hover:bg-orange-500/30 
                         text-orange-400 rounded-lg text-sm font-medium transition-colors
                         active:scale-95"
              >
                Split Trade
              </button>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  // Extreme impact: 10%+
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-red-500/10 border-2 border-red-500/50 rounded-xl"
    >
      <div className="flex items-start gap-3 mb-3">
        <XCircleIcon className="w-8 h-8 text-red-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-red-400 mb-2">
            Extreme Price Impact ({priceImpact.toFixed(2)}%)
          </div>
          <div className="text-sm text-gray-300 mb-2">
            ⚠️ You may lose significant value. We strongly recommend against this trade.
          </div>
          <div className="text-xs text-gray-500">
            This large trade will significantly move the market price
          </div>
        </div>
      </div>

      {onReduceAmount && (
        <button
          onClick={onReduceAmount}
          className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 
                   text-red-400 rounded-lg font-medium transition-colors
                   active:scale-95 border border-red-500/30"
        >
          Reduce Amount by 50%
        </button>
      )}
    </motion.div>
  );
}
