"use client";

/**
 * Panneau de debug pour afficher les logs d'erreur en temps réel
 * Appuyez sur Ctrl+Shift+L pour ouvrir/fermer
 */

import { useState, useEffect } from "react";
import { errorLogger, ErrorLog } from "@/lib/errorLogger";

export function DebugLogPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Raccourci clavier: Ctrl+Shift+L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-refresh des logs
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;

    const interval = setInterval(() => {
      setLogs(errorLogger.getLogs());
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, autoRefresh]);

  // Charger les logs à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setLogs(errorLogger.getLogs());
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-red-600 hover:bg-red-700 text-white rounded-full p-3 shadow-lg z-50 transition"
        title="Ouvrir les logs (Ctrl+Shift+L)"
      >
        <svg
          className="w-6 h-6"
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
        {logs.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-yellow-500 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {logs.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-gray-900 w-full h-3/4 rounded-t-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <svg
              className="w-6 h-6 text-red-500"
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
            <h2 className="text-xl font-bold text-white">
              Error Logs ({logs.length})
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span>Auto-refresh</span>
            </label>

            <button
              onClick={() => {
                setLogs(errorLogger.getLogs());
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition"
            >
              Refresh
            </button>

            <button
              onClick={() => {
                errorLogger.downloadLogs();
              }}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
            >
              Download
            </button>

            <button
              onClick={() => {
                errorLogger.clearLogs();
                setLogs([]);
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
            >
              Clear
            </button>

            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition"
            >
              Close
            </button>
          </div>
        </div>

        {/* Logs content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Aucune erreur enregistrée 🎉</p>
              <p className="text-sm mt-2">
                Les erreurs apparaîtront ici automatiquement
              </p>
            </div>
          ) : (
            logs
              .slice()
              .reverse()
              .map((log, index) => (
                <div
                  key={index}
                  className="bg-gray-800 rounded-lg p-4 space-y-2 border border-red-900"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                          {log.error.name}
                        </span>
                        {log.context.component && (
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                            {log.context.component}
                          </span>
                        )}
                        {log.context.action && (
                          <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                            {log.context.action}
                          </span>
                        )}
                      </div>
                      <p className="text-red-400 mt-2 font-mono text-sm">
                        {log.error.message}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {log.context.pathname && (
                    <div className="text-xs text-gray-400">
                      <span className="font-semibold">Path:</span>{" "}
                      {log.context.pathname}
                    </div>
                  )}

                  {log.error.stack && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                        Stack trace
                      </summary>
                      <pre className="mt-2 p-2 bg-black rounded overflow-x-auto text-gray-300">
                        {log.error.stack}
                      </pre>
                    </details>
                  )}

                  {log.additionalData &&
                    Object.keys(log.additionalData).length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                          Additional data
                        </summary>
                        <pre className="mt-2 p-2 bg-black rounded overflow-x-auto text-gray-300">
                          {JSON.stringify(log.additionalData, null, 2)}
                        </pre>
                      </details>
                    )}
                </div>
              ))
          )}
        </div>

        {/* Footer with instructions */}
        <div className="p-3 border-t border-gray-700 bg-gray-800 text-xs text-gray-400">
          💡 Raccourci: <kbd className="bg-gray-700 px-2 py-1 rounded">Ctrl</kbd> +{" "}
          <kbd className="bg-gray-700 px-2 py-1 rounded">Shift</kbd> +{" "}
          <kbd className="bg-gray-700 px-2 py-1 rounded">L</kbd> pour ouvrir/fermer
          | Console: <code className="bg-gray-700 px-2 py-1 rounded">window.errorLogger.getLogs()</code>
        </div>
      </div>
    </div>
  );
}
