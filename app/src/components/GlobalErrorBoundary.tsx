"use client";

/**
 * Error Boundary global pour capturer toutes les erreurs React
 */

import React from "react";
import { logError } from "@/lib/errorLogger";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log l'erreur avec contexte complet
    logError(error, {
      component: "GlobalErrorBoundary",
      action: "componentDidCatch",
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: "global",
      },
    });

    this.setState({
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-gray-800 rounded-lg shadow-xl p-6 space-y-4">
            <div className="flex items-center space-x-2 text-red-500">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
            </div>

            <div className="bg-gray-900 rounded p-4 space-y-2">
              <div>
                <span className="text-gray-400 text-sm">Type d'erreur:</span>
                <p className="text-white font-mono">{this.state.error.name}</p>
              </div>
              
              <div>
                <span className="text-gray-400 text-sm">Message:</span>
                <p className="text-white font-mono">{this.state.error.message}</p>
              </div>

              {this.state.error.stack && (
                <div>
                  <span className="text-gray-400 text-sm">Stack trace:</span>
                  <pre className="text-xs text-gray-300 overflow-x-auto mt-1 p-2 bg-black rounded max-h-48">
                    {this.state.error.stack}
                  </pre>
                </div>
              )}

              {this.state.errorInfo?.componentStack && (
                <div>
                  <span className="text-gray-400 text-sm">Component stack:</span>
                  <pre className="text-xs text-gray-300 overflow-x-auto mt-1 p-2 bg-black rounded max-h-48">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
              >
                Reload page
              </button>
              
              <button
                onClick={() => {
                  if ((window as any).errorLogger) {
                    (window as any).errorLogger.downloadLogs();
                  }
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
              >
                Download logs
              </button>
            </div>

            <div className="text-sm text-gray-400 space-y-1">
              <p>💡 Les détails de l'erreur ont été enregistrés.</p>
              <p>
                Ouvrez la console (F12) et tapez <code className="bg-gray-900 px-1 rounded">window.errorLogger.getLogs()</code> pour voir tous les logs.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
