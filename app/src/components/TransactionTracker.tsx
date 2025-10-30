/**
 * Transaction Tracker Component
 * Shows real-time transaction progress with WebSocket updates
 */

"use client";

import { useSwapStore } from "@/store/swapStore";
import { useSwapWebSocket } from "@/hooks/useSwapWebSocket";

// ============================================================================
// COMPONENT
// ============================================================================

export function TransactionTracker() {
  const { transaction, transactionHistory, resetTransaction } = useSwapStore();

  // Connect to WebSocket
  useSwapWebSocket();

  // Progress steps
  const steps = [
    { key: "preparing", label: "Preparing", icon: "📝" },
    { key: "signing", label: "Signing", icon: "✍️" },
    { key: "sending", label: "Sending", icon: "🚀" },
    { key: "confirming", label: "Confirming", icon: "⏳" },
    { key: "confirmed", label: "Finalized", icon: "✅" },
  ];

  const currentStepIndex = steps.findIndex(
    (step) => step.key === transaction.status
  );

  // Explorer link
  const getExplorerLink = (signature: string) => {
    return `https://solscan.io/tx/${signature}`;
  };

  if (transaction.status === "idle" && transactionHistory.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto bg-gray-900 rounded-2xl p-6 shadow-xl mt-4">
      {/* Current Transaction */}
      {transaction.status !== "idle" && (
        <div className="mb-6">
          <h3 className="text-xl font-bold text-[var(--primary)] mb-4">
            Transaction Status
          </h3>

          {/* Progress Bar */}
          <div className="relative mb-6">
            <div className="flex justify-between mb-2">
              {steps.map((step, index) => (
                <div
                  key={step.key}
                  className="flex flex-col items-center flex-1"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                      index <= currentStepIndex
                        ? "bg-blue-600 text-[var(--primary)]"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {index < currentStepIndex ? (
                      "✓"
                    ) : index === currentStepIndex ? (
                      <div className="animate-spin">⏳</div>
                    ) : (
                      step.icon
                    )}
                  </div>
                  <span
                    className={`text-xs mt-2 ${
                      index <= currentStepIndex ? "text-[var(--primary)]" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Progress line */}
            <div className="absolute top-5 left-0 right-0 h-1 bg-gray-700 -z-10">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{
                  width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Transaction Details */}
          {transaction.signature && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Signature</span>
                <a
                  href={getExplorerLink(transaction.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 font-mono truncate max-w-[200px]"
                >
                  {transaction.signature.slice(0, 8)}...
                  {transaction.signature.slice(-8)}
                </a>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Confirmations</span>
                <span className="text-sm text-[var(--primary)]">
                  {transaction.confirmations}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {transaction.error && (
            <div className="mt-4 p-4 bg-red-900 bg-opacity-20 border border-red-500 rounded-xl">
              <div className="flex items-start gap-2">
                <span className="text-red-500 text-xl">❌</span>
                <div className="flex-1">
                  <h4 className="text-red-500 font-semibold mb-1">
                    Transaction Failed
                  </h4>
                  <p className="text-sm text-red-300">{transaction.error}</p>
                </div>
              </div>
              <button
                onClick={resetTransaction}
                className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-[var(--primary)] rounded-lg text-sm w-full"
              >
                Retry
              </button>
            </div>
          )}

          {/* Success Message */}
          {transaction.status === "confirmed" && (
            <div className="mt-4 p-4 bg-green-900 bg-opacity-20 border border-green-500 rounded-xl">
              <div className="flex items-start gap-2">
                <span className="text-green-500 text-xl">✅</span>
                <div className="flex-1">
                  <h4 className="text-green-500 font-semibold mb-1">
                    Swap Successful!
                  </h4>
                  <p className="text-sm text-green-300">
                    Your transaction has been finalized
                  </p>
                </div>
              </div>
              <button
                onClick={resetTransaction}
                className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-[var(--primary)] rounded-lg text-sm w-full"
              >
                New Swap
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      {transactionHistory.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-[var(--primary)] mb-3">Recent Swaps</h3>
          <div className="space-y-2">
            {transactionHistory.slice(0, 10).map((tx, _index) => (
              <div
                key={tx.signature}
                className="bg-gray-800 rounded-lg p-3 hover:bg-gray-750"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        tx.status === "confirmed"
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {tx.status === "confirmed" ? "✓" : "✗"}
                    </span>
                    <div>
                      <div className="text-sm text-[var(--primary)]">
                        {tx.inputAmount} {tx.inputToken.symbol} →{" "}
                        {tx.outputAmount} {tx.outputToken.symbol}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(tx.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <a
                    href={getExplorerLink(tx.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    View →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
