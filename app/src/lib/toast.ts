/**
 * Enhanced Toast Notifications
 * Centralized toast management with consistent styling
 */

import toast from "react-hot-toast";

// Toast styles matching terminal theme
const baseStyle = {
  background: '#0a0a0a',
  color: '#00ff41',
  border: '2px solid #00ff41',
  fontFamily: 'monospace',
  fontSize: '14px',
  padding: '12px 16px',
  borderRadius: '0',
  boxShadow: '0 0 20px rgba(0, 255, 65, 0.3)',
};

const successStyle = {
  ...baseStyle,
  border: '2px solid #00ff41',
  boxShadow: '0 0 20px rgba(0, 255, 65, 0.5)',
};

const errorStyle = {
  ...baseStyle,
  border: '2px solid #ff0040',
  color: '#ff0040',
  boxShadow: '0 0 20px rgba(255, 0, 64, 0.5)',
};

const loadingStyle = {
  ...baseStyle,
  border: '2px solid #ffaa00',
  color: '#ffaa00',
  boxShadow: '0 0 20px rgba(255, 170, 0, 0.5)',
};

const warningStyle = {
  ...baseStyle,
  border: '2px solid #ffaa00',
  color: '#ffaa00',
  boxShadow: '0 0 20px rgba(255, 170, 0, 0.5)',
};

// Enhanced toast functions
export const showToast = {
  success: (message: string, duration = 4000) => {
    return toast.success(message, {
      duration,
      style: successStyle,
      icon: '✅',
    });
  },

  error: (message: string, duration = 5000) => {
    return toast.error(message, {
      duration,
      style: errorStyle,
      icon: '❌',
    });
  },

  loading: (message: string) => {
    return toast.loading(message, {
      style: loadingStyle,
      icon: '⏳',
    });
  },

  warning: (message: string, duration = 4000) => {
    return toast(message, {
      duration,
      style: warningStyle,
      icon: '⚠️',
    });
  },

  info: (message: string, duration = 4000) => {
    return toast(message, {
      duration,
      style: baseStyle,
      icon: 'ℹ️',
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        loading: { style: loadingStyle, icon: '⏳' },
        success: { style: successStyle, icon: '✅', duration: 4000 },
        error: { style: errorStyle, icon: '❌', duration: 5000 },
      }
    );
  },

  // Custom toast with transaction link  
  transaction: (signature: string, status: 'pending' | 'success' | 'error') => {
    const explorerUrl = `https://solscan.io/tx/${signature}`;
    
    const messages = {
      pending: `⏳ Transaction: ${signature.slice(0, 8)}... (Click to view)`,
      success: `✅ Confirmed: ${signature.slice(0, 8)}... (Click to view)`,
      error: `❌ Failed: ${signature.slice(0, 8)}... (Click to view)`,
    };

    const style = {
      pending: { ...loadingStyle, cursor: 'pointer' },
      success: { ...successStyle, cursor: 'pointer' },
      error: { ...errorStyle, cursor: 'pointer' },
    }[status];

    const toastId = toast(
      messages[status],
      {
        duration: status === 'pending' ? Infinity : 6000,
        style,
      }
    );

    // Add click handler to open explorer (workaround for toast limitation)
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        const toastElement = document.querySelector(`[data-id="${toastId}"]`);
        if (toastElement) {
          toastElement.addEventListener('click', () => {
            window.open(explorerUrl, '_blank', 'noopener,noreferrer');
          });
        }
      }, 100);
    }
    
    return toastId;
  },

  // Dismiss specific toast
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },

  // Dismiss all toasts
  dismissAll: () => {
    toast.dismiss();
  },
};

// Swap-specific toast messages
export const swapToasts = {
  routeSearching: () => showToast.loading('🔍 Searching best routes...'),
  routeFound: (savings: string) =>
    showToast.success(`✅ Best route found! Save ${savings}`),
  routeNotFound: () => showToast.error('❌ No routes found. Try different tokens or amounts.'),
  
  swapSubmitting: () => showToast.loading('📤 Submitting swap transaction...'),
  swapSuccess: (signature: string) => showToast.transaction(signature, 'success'),
  swapError: (error: string) => showToast.error(`❌ Swap failed: ${error}`),
  
  walletNotConnected: () => showToast.warning('⚠️ Please connect your wallet first'),
  insufficientBalance: () => showToast.error('❌ Insufficient balance'),
  invalidAmount: () => showToast.warning('⚠️ Please enter a valid amount'),
  
  slippageHigh: (slippage: number) =>
    showToast.warning(`⚠️ High slippage (${slippage}%). Your transaction may be frontrun.`),
  
  priceImpactHigh: (impact: number) =>
    showToast.warning(`⚠️ High price impact (${impact.toFixed(2)}%). Consider a smaller amount.`),
};

// Buyback-specific toast messages
export const buybackToasts = {
  buybackExecuting: () => showToast.loading('🔥 Executing buyback...'),
  buybackSuccess: (amount: string) =>
    showToast.success(`✅ Buyback successful! ${amount} $BACK bought & burned`),
  buybackError: (error: string) => showToast.error(`❌ Buyback failed: ${error}`),
  
  claimSuccess: (amount: string) =>
    showToast.success(`✅ Claimed ${amount} $BACK rewards!`),
  claimError: (error: string) => showToast.error(`❌ Claim failed: ${error}`),
  
  lockSuccess: (period: number) =>
    showToast.success(`✅ Locked for ${period} days. Start earning rewards!`),
  lockError: (error: string) => showToast.error(`❌ Lock failed: ${error}`),
  
  unlockSuccess: (amount: string) =>
    showToast.success(`✅ Unlocked ${amount} $BACK!`),
  unlockError: (error: string) => showToast.error(`❌ Unlock failed: ${error}`),
};

// Network-specific toast messages
export const networkToasts = {
  connecting: () => showToast.loading('🌐 Connecting to Solana...'),
  connected: (cluster: string) => showToast.success(`✅ Connected to ${cluster}`),
  disconnected: () => showToast.info('🔌 Disconnected from network'),
  error: (error: string) => showToast.error(`❌ Network error: ${error}`),
  
  rpcSlow: () => showToast.warning('⚠️ RPC is slow. Transactions may take longer.'),
  rpcFast: () => showToast.success('✅ RPC is responding fast!'),
};

// Generic utility toasts
export const utilityToasts = {
  copied: (text: string) => showToast.success(`✅ Copied: ${text.slice(0, 20)}...`),
  saved: () => showToast.success('✅ Saved successfully'),
  deleted: () => showToast.success('✅ Deleted successfully'),
  updated: () => showToast.success('✅ Updated successfully'),
  
  comingSoon: (feature: string) =>
    showToast.info(`🚧 ${feature} coming soon!`),
  
  maintenanceMode: () =>
    showToast.warning('⚠️ Maintenance mode. Some features may be unavailable.'),
};
