"use client";

import dynamic from "next/dynamic";

// Import dynamique de ConnectionStatus avec SSR désactivé
const ConnectionStatusDynamic = dynamic(
  () => import("./ConnectionStatus").then((mod) => ({ default: mod.ConnectionStatus })),
  {
    ssr: false,
    loading: () => null, // Pas de loader, juste ne rien afficher pendant SSR
  }
);

/**
 * Client-only wrapper pour ConnectionStatus
 * Avoids WalletContext SSR errors using dynamic import
 */
export const ClientOnlyConnectionStatus = () => {
  return <ConnectionStatusDynamic />;
};
