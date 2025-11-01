"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  // SolflareWalletAdapter retiré - il s'enregistre automatiquement comme Standard Wallet
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// Import des styles du wallet adapter
import "@solana/wallet-adapter-react-ui/styles.css";

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Configuration du réseau (devnet pour développement)
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // Configuration des wallets supportés
  // Note: Solflare s'enregistre automatiquement via le standard wallet
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      // SolflareWalletAdapter retiré pour éviter la duplication
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
