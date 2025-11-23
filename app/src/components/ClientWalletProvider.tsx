"use client";

import { FC, ReactNode, useEffect, useState } from "react";
import { WalletProvider } from "./WalletProvider";
import { LoadingScreen } from "./LoadingScreen";
import "@/lib/patchBN";

/**
 * Wrapper client-only pour le WalletProvider
 * Évite les erreurs d'hydration SSR en ne montant le provider que côté client
 */
export const ClientWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Afficher un loader pendant le SSR et le premier render
  if (!mounted) {
    return <LoadingScreen />;
  }

  // Une fois monté côté client, on peut utiliser le WalletProvider complet
  return <WalletProvider>{children}</WalletProvider>;
};
