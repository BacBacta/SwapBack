"use client";

/**
 * Page d'erreur globale Next.js
 * Capte les erreurs serveur et client
 */

import { useEffect } from "react";
import { logError } from "@/lib/errorLogger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log l'erreur
    logError(error, {
      component: "NextJS Error Page",
      action: "error",
      additionalData: {
        digest: error.digest,
        errorBoundary: "next-error-page",
      },
    });

    console.error("🔴 Next.js Error Page:", error);
  }, [error]);

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
          <h1 className="text-2xl font-bold">Erreur détectée</h1>
        </div>

        <div className="bg-gray-900 rounded p-4 space-y-2">
          <div>
            <span className="text-gray-400 text-sm">Type:</span>
            <p className="text-white font-mono">{error.name}</p>
          </div>
          
          <div>
            <span className="text-gray-400 text-sm">Message:</span>
            <p className="text-white font-mono">{error.message}</p>
          </div>

          {error.digest && (
            <div>
              <span className="text-gray-400 text-sm">Error ID:</span>
              <p className="text-white font-mono text-xs">{error.digest}</p>
            </div>
          )}

          {error.stack && (
            <details className="mt-2">
              <summary className="cursor-pointer text-gray-400 text-sm hover:text-gray-300">
                Stack trace
              </summary>
              <pre className="text-xs text-gray-300 overflow-x-auto mt-2 p-2 bg-black rounded max-h-48">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        <div className="flex space-x-4">
          <button
            onClick={() => reset()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
          >
            Réessayer
          </button>
          
          <button
            onClick={() => window.location.href = "/"}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
          >
            Retour à l'accueil
          </button>
        </div>

        <div className="text-sm text-gray-400 space-y-1">
          <p>💡 L'erreur a été enregistrée automatiquement.</p>
          <p>
            Appuyez sur <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+Shift+L</kbd> pour voir tous les logs.
          </p>
          <p>
            Ou utilisez <code className="bg-gray-900 px-1 rounded">window.errorLogger.getLogs()</code> dans la console.
          </p>
        </div>
      </div>
    </div>
  );
}
