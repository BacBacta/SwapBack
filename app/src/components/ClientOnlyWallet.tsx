"use client";

import dynamic from "next/dynamic";

// Import dynamique du WalletMultiButton avec SSR désactivé
const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  {
    ssr: false,
    loading: () => (
      <div className="w-32 h-10 bg-gray-700 rounded animate-pulse"></div>
    ),
  }
);

/**
 * Client-only wrapper pour WalletMultiButton
 * Évite les erreurs SSR de WalletContext en utilisant dynamic import
 */
export const ClientOnlyWallet = () => {
  return (
    <WalletMultiButtonDynamic
      className="!bg-[var(--primary)] hover:!bg-[var(--primary-hover)] !text-black !font-bold !rounded !px-4 !py-2 !transition-colors"
      style={{
        backgroundColor: 'var(--primary)',
        border: 'none',
        fontFamily: 'var(--font-mono)',
      }}
    />
  );
};
