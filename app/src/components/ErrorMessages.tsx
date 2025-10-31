/**
 * Enhanced Error Messages
 * User-friendly error handling and display
 */

"use client";

import { showToast } from "@/lib/toast";

// Error types with user-friendly messages
export const ERROR_MESSAGES = {
  // Wallet errors
  WALLET_NOT_CONNECTED: {
    title: "Wallet Not Connected",
    message: "Please connect your wallet to continue",
    action: "Connect Wallet",
    severity: "warning" as const,
  },
  WALLET_DISCONNECTED: {
    title: "Wallet Disconnected",
    message: "Your wallet has been disconnected. Please reconnect to continue.",
    severity: "info" as const,
  },
  WALLET_SIGNATURE_REJECTED: {
    title: "Transaction Rejected",
    message: "You rejected the transaction signature request",
    severity: "info" as const,
  },

  // Transaction errors
  INSUFFICIENT_BALANCE: {
    title: "Insufficient Balance",
    message: "You don't have enough tokens to complete this swap",
    action: "Check Balance",
    severity: "error" as const,
  },
  SLIPPAGE_EXCEEDED: {
    title: "Slippage Exceeded",
    message: "Price moved beyond your slippage tolerance. Try increasing slippage or try again.",
    action: "Adjust Slippage",
    severity: "error" as const,
  },
  TRANSACTION_TIMEOUT: {
    title: "Transaction Timeout",
    message: "Transaction took too long to confirm. It may still complete.",
    action: "Check Explorer",
    severity: "warning" as const,
  },
  TRANSACTION_FAILED: {
    title: "Transaction Failed",
    message: "The transaction failed to execute. Please try again.",
    action: "Retry",
    severity: "error" as const,
  },

  // Route errors
  NO_ROUTES_FOUND: {
    title: "No Routes Available",
    message: "Could not find a swap route for these tokens. Try a different pair or amount.",
    action: "Change Tokens",
    severity: "warning" as const,
  },
  ROUTE_FETCH_FAILED: {
    title: "Failed to Fetch Routes",
    message: "Could not load swap routes. Please check your connection and try again.",
    action: "Retry",
    severity: "error" as const,
  },

  // Input errors
  INVALID_AMOUNT: {
    title: "Invalid Amount",
    message: "Please enter a valid positive number",
    severity: "warning" as const,
  },
  AMOUNT_TOO_SMALL: {
    title: "Amount Too Small",
    message: "Amount is below the minimum required for swapping",
    severity: "warning" as const,
  },
  AMOUNT_TOO_LARGE: {
    title: "Amount Too Large",
    message: "Amount exceeds your available balance",
    severity: "error" as const,
  },

  // Network errors
  NETWORK_ERROR: {
    title: "Network Error",
    message: "Could not connect to Solana network. Please check your internet connection.",
    action: "Retry",
    severity: "error" as const,
  },
  RPC_ERROR: {
    title: "RPC Error",
    message: "Solana RPC is experiencing issues. Please try again later.",
    severity: "error" as const,
  },
  RATE_LIMIT_EXCEEDED: {
    title: "Rate Limit Exceeded",
    message: "Too many requests. Please wait a moment and try again.",
    severity: "warning" as const,
  },

  // Generic errors
  UNKNOWN_ERROR: {
    title: "Unknown Error",
    message: "An unexpected error occurred. Please try again.",
    action: "Retry",
    severity: "error" as const,
  },
};

// Error parser - converts blockchain errors to user-friendly messages
export function parseError(error: unknown): {
  title: string;
  message: string;
  action?: string;
  severity: 'error' | 'warning' | 'info';
} {
  if (!error) return ERROR_MESSAGES.UNKNOWN_ERROR;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Wallet errors
  if (lowerMessage.includes('wallet not connected')) {
    return ERROR_MESSAGES.WALLET_NOT_CONNECTED;
  }
  if (lowerMessage.includes('user rejected') || lowerMessage.includes('rejected')) {
    return ERROR_MESSAGES.WALLET_SIGNATURE_REJECTED;
  }

  // Balance errors
  if (lowerMessage.includes('insufficient') || lowerMessage.includes('not enough')) {
    return ERROR_MESSAGES.INSUFFICIENT_BALANCE;
  }

  // Slippage errors
  if (lowerMessage.includes('slippage') || lowerMessage.includes('price impact')) {
    return ERROR_MESSAGES.SLIPPAGE_EXCEEDED;
  }

  // Timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return ERROR_MESSAGES.TRANSACTION_TIMEOUT;
  }

  // Route errors
  if (lowerMessage.includes('no routes') || lowerMessage.includes('no route found')) {
    return ERROR_MESSAGES.NO_ROUTES_FOUND;
  }

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch failed')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  if (lowerMessage.includes('rpc') || lowerMessage.includes('429')) {
    return ERROR_MESSAGES.RPC_ERROR;
  }
  if (lowerMessage.includes('rate limit')) {
    return ERROR_MESSAGES.RATE_LIMIT_EXCEEDED;
  }

  // Default
  return {
    ...ERROR_MESSAGES.UNKNOWN_ERROR,
    message: errorMessage.slice(0, 100), // Truncate long error messages
  };
}

// Display error with toast
export function showErrorToast(error: unknown) {
  const { title, message, severity } = parseError(error);
  const fullMessage = `${title}: ${message}`;

  switch (severity) {
    case 'error':
      showToast.error(fullMessage);
      break;
    case 'warning':
      showToast.warning(fullMessage);
      break;
    case 'info':
      showToast.info(fullMessage);
      break;
  }
}

// Error display component
interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({ error, onRetry, onDismiss }: ErrorDisplayProps) {
  const { title, message, action, severity } = parseError(error);

  const severityColors = {
    error: 'var(--error)',
    warning: 'var(--warning)',
    info: 'var(--primary)',
  };

  const severityIcons = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div
      role="alert"
      className="terminal-box p-6 border-2"
      style={{
        borderColor: severityColors[severity],
      }}
    >
      <div className="flex items-start gap-4">
        <div className="text-3xl" style={{ color: severityColors[severity] }}>
          {severityIcons[severity]}
        </div>

        <div className="flex-1">
          <h3 className="terminal-text text-lg mb-2" style={{ color: severityColors[severity] }}>
            {title}
          </h3>
          <p className="terminal-text text-[var(--primary)]/70 mb-4">{message}</p>

          <div className="flex gap-3">
            {onRetry && action && (
              <button onClick={onRetry} className="terminal-button px-4 py-2">
                <span className="terminal-text">{action}</span>
              </button>
            )}

            {onDismiss && (
              <button onClick={onDismiss} className="terminal-button-secondary px-4 py-2">
                <span className="terminal-text">DISMISS</span>
              </button>
            )}
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[var(--primary)]/50 hover:text-[var(--primary)] transition-colors"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// Inline error message
export function InlineError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-center gap-2 text-[var(--error)] text-sm mt-2 terminal-text">
      <span>❌</span>
      <span>{message}</span>
    </div>
  );
}

// Success message component
export function SuccessMessage({ title, message }: { title: string; message: string }) {
  return (
    <div role="status" className="terminal-box p-6 border-2 border-[var(--primary)]">
      <div className="flex items-start gap-4">
        <div className="text-3xl text-[var(--primary)]">✅</div>
        <div className="flex-1">
          <h3 className="terminal-text text-lg mb-2 text-[var(--primary)]">{title}</h3>
          <p className="terminal-text text-[var(--primary)]/70">{message}</p>
        </div>
      </div>
    </div>
  );
}
