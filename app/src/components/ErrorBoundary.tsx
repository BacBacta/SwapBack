/**
 * Error Boundary Component
 * Catches React errors and displays user-friendly error UI
 */

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { showToast } from "@/lib/toast";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Show toast notification
    showToast.error(`Application error: ${error.message}`);

    // Log to error tracking service (e.g., Sentry)
    if (typeof window !== 'undefined') {
      const w = window as Window & { Sentry?: { captureException: (error: Error, options: unknown) => void } };
      if (w.Sentry) {
        w.Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack,
            },
          },
        });
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="terminal-box max-w-2xl w-full p-8">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="terminal-text text-3xl mb-2 text-[var(--error)]">
                SYSTEM ERROR
              </h1>
              <p className="text-[var(--primary)] opacity-70 font-mono">
                Something went wrong in the application
              </p>
            </div>

            {/* Error Details */}
            <div className="bg-black/50 border-2 border-[var(--error)]/30 p-6 mb-6 font-sans text-sm">
              <div className="text-[var(--error)] mb-2">
                <span className="opacity-70">&gt;</span> ERROR:{" "}
                {this.state.error?.message || "Unknown error"}
              </div>
              
              {process.env.NODE_ENV === "development" && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-[var(--primary)] hover:text-[var(--accent)] transition-colors">
                    Stack Trace (Dev Only)
                  </summary>
                  <pre className="mt-2 text-xs overflow-x-auto text-[var(--primary)]/50">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="terminal-button px-6 py-3"
              >
                <span className="terminal-text">TRY AGAIN</span>
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="terminal-button-secondary px-6 py-3"
              >
                <span className="terminal-text">GO HOME</span>
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="terminal-button-secondary px-6 py-3"
              >
                <span className="terminal-text">RELOAD PAGE</span>
              </button>
            </div>

            {/* Help Text */}
            <div className="mt-8 text-center text-sm text-[var(--primary)]/50 font-mono">
              <p>If this error persists, please:</p>
              <ul className="mt-2 space-y-1">
                <li>• Clear your browser cache</li>
                <li>• Try a different browser</li>
                <li>• Report this issue on GitHub</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
