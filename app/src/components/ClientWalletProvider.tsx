"use client";

import { FC, ReactNode, useEffect, useState } from "react";
import { WalletProvider } from "./WalletProvider";

/**
 * Wrapper client-only pour le WalletProvider
 * Évite les erreurs d'hydration SSR en ne montant le provider que côté client
 */
export const ClientWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pendant le SSR et l'hydration initiale, on attend d'être côté client
  // avant de rendre les children pour éviter d'appeler useWallet sans provider
  if (!mounted) {
    return null;
  }

  // Une fois monté côté client, on peut utiliser le WalletProvider complet
  return <WalletProvider>{children}</WalletProvider>;
};
