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

  // Pendant le SSR, on rend quand même les children pour éviter un écran blanc
  // Le WalletProvider gérera l'hydration proprement
  if (!mounted) {
    return <div suppressHydrationWarning>{children}</div>;
  }

  // Une fois monté côté client, on peut utiliser le WalletProvider complet
  return <WalletProvider>{children}</WalletProvider>;
};
