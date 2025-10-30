"use client";

import { useState, useEffect } from "react";

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface TokenSelectorProps {
  selectedToken: string;
  onSelect: (token: Token) => void;
  onClose: () => void;
}

// Popular tokens on Solana (Devnet pour tests)
const POPULAR_TOKENS: Token[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    address: "BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU",
    symbol: "BACK",
    name: "SwapBack Token",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png", // TODO: Add custom logo
  },
  {
    address: "3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G",
    symbol: "USDC",
    name: "USD Coin (Test)",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
  },
  {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
  },
  {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "PYTH",
    name: "Pyth Network",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png",
  },
  {
    address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    symbol: "mSOL",
    name: "Marinade staked SOL",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
  },
  {
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    logoURI: "https://static.jup.ag/jup/icon.png",
  },
  {
    address: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    symbol: "JTO",
    name: "Jito",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr/logo.png",
  },
];

export const TokenSelector = ({
  selectedToken,
  onSelect,
  onClose,
}: TokenSelectorProps) => {
  const [search, setSearch] = useState("");

  const filteredTokens = POPULAR_TOKENS.filter(
    (token) =>
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase()) ||
      token.address.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    // Fermer avec Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <button
        className="fixed inset-0 bg-black/90 z-50"
        onClick={onClose}
        aria-label="Close token selector"
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 animate-fade-in">
        <div className="swap-card m-4 border-2 border-[var(--primary)]">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold terminal-text terminal-glow uppercase tracking-wider">[SELECT TOKEN]</h3>
            <button
              onClick={onClose}
              className="p-2 border-2 border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-colors terminal-text"
              aria-label="Close"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH BY NAME, SYMBOL OR ADDRESS..."
              className="input-field w-full uppercase"
              autoFocus
            />
          </div>

          {/* Popular Tokens */}
          {!search && (
            <div className="mb-4">
              <p className="text-xs terminal-text opacity-70 mb-3 uppercase font-semibold tracking-wider">
                [POPULAR TOKENS]
              </p>
            </div>
          )}

          {/* Token List */}
          <div className="max-h-96 overflow-y-auto space-y-1 pr-2">
            {filteredTokens.length === 0 ? (
              <div className="text-center py-8">
                <p className="terminal-text opacity-70 uppercase tracking-wider">NO TOKENS FOUND</p>
              </div>
            ) : (
              filteredTokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => {
                    onSelect(token);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 p-3 border-2 transition-all terminal-text uppercase tracking-wider ${
                    selectedToken === token.symbol
                      ? "bg-[var(--primary)]/10 border-[var(--primary)] terminal-glow"
                      : "border-[var(--primary)]/20 hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/50"
                  }`}
                >
                  {/* Token Logo */}
                  <div className="w-10 h-10 border-2 border-[var(--primary)] flex items-center justify-center overflow-hidden">
                    {token.logoURI ? (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold">
                        {token.symbol.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Token Info */}
                  <div className="flex-1 text-left">
                    <div className="font-semibold terminal-text terminal-glow">
                      {token.symbol}
                    </div>
                    <div className="text-xs terminal-text opacity-60">{token.name}</div>
                  </div>

                  {/* Selected indicator */}
                  {selectedToken === token.symbol && (
                    <div className="w-6 h-6 border-2 border-[var(--primary)] bg-[var(--primary)] flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};
