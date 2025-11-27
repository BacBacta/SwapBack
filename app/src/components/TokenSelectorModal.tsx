/**
 * Enhanced Token Selector Modal - Fullscreen with Search & Filters
 * Inspired by Jupiter/Uniswap V4 UX
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MagnifyingGlassIcon, 
  XMarkIcon,
  StarIcon as StarIconOutline,
  CheckCircleIcon,
  ChevronRightIcon
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { formatCurrency, formatCompactNumber } from "@/utils/formatNumber";

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: number;
  balanceUSD?: number;
  priceUSD?: number;
  verified?: boolean;
  tags?: string[];
}

interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedToken?: string;
  title?: string;
}

// Mock popular tokens (in real app, fetch from API)
const POPULAR_TOKENS: Token[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    balance: 2.5,
    balanceUSD: 250,
    priceUSD: 100,
    verified: true,
    tags: ["blue-chip"]
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    balance: 1000,
    balanceUSD: 1000,
    priceUSD: 1,
    verified: true,
    tags: ["stablecoin"]
  },
  {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
    balance: 500,
    balanceUSD: 500,
    priceUSD: 1,
    verified: true,
    tags: ["stablecoin"]
  },
  {
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    logoURI: "https://static.jup.ag/jup/icon.png",
    balance: 150,
    balanceUSD: 120,
    priceUSD: 0.8,
    verified: true,
    tags: ["blue-chip"]
  },
];

type FilterType = "all" | "favorites" | "stablecoins" | "blue-chips";

export function TokenSelectorModal({
  isOpen,
  onClose,
  onSelect,
  selectedToken,
  title = "Select a token"
}: TokenSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set(["So11111111111111111111111111111111111111112"]));

  // Filter and search tokens
  const filteredTokens = useMemo(() => {
    let tokens = POPULAR_TOKENS;

    // Apply filter
    if (activeFilter === "favorites") {
      tokens = tokens.filter(t => favorites.has(t.address));
    } else if (activeFilter === "stablecoins") {
      tokens = tokens.filter(t => t.tags?.includes("stablecoin"));
    } else if (activeFilter === "blue-chips") {
      tokens = tokens.filter(t => t.tags?.includes("blue-chip"));
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tokens = tokens.filter(
        t =>
          t.symbol.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query) ||
          t.address.toLowerCase().includes(query)
      );
    }

    // Sort by balance (highest first)
    return tokens.sort((a, b) => (b.balanceUSD || 0) - (a.balanceUSD || 0));
  }, [searchQuery, activeFilter, favorites]);

  const toggleFavorite = (address: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(address)) {
        newFavorites.delete(address);
      } else {
        newFavorites.add(address);
      }
      return newFavorites;
    });
  };

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setActiveFilter("all");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute inset-x-0 bottom-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 
                     md:max-w-lg md:h-[80vh] md:rounded-2xl
                     h-[95vh] rounded-t-2xl bg-gray-900 border-t md:border border-white/10 
                     flex flex-col overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
              >
                <XMarkIcon className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or paste address"
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 
                         rounded-xl text-white placeholder-gray-500 
                         outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-b border-white/10 overflow-x-auto scrollbar-hide">
            {[
              { id: "all" as FilterType, label: "All", icon: null },
              { id: "favorites" as FilterType, label: "⭐ Favorites", icon: null },
              { id: "stablecoins" as FilterType, label: "💵 Stables", icon: null },
              { id: "blue-chips" as FilterType, label: "🔵 Blue Chips", icon: null },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                  activeFilter === filter.id
                    ? "bg-emerald-500 text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Token List */}
          <div className="flex-1 overflow-y-auto">
            {filteredTokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <MagnifyingGlassIcon className="w-16 h-16 text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg font-medium mb-2">No tokens found</p>
                <p className="text-gray-500 text-sm">
                  Try a different search term or paste a token address
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredTokens.map((token) => {
                  const isSelected = token.address === selectedToken;
                  const isFavorite = favorites.has(token.address);

                  return (
                    <button
                      key={token.address}
                      onClick={() => onSelect(token)}
                      className={`w-full flex items-center gap-3 p-4 transition-all hover:bg-white/5 active:scale-[0.99] ${
                        isSelected ? "bg-emerald-500/10 border-l-2 border-emerald-500" : ""
                      }`}
                    >
                      {/* Token Logo */}
                      <div className="relative flex-shrink-0">
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="w-12 h-12 rounded-full"
                            onError={(e) => {
                              e.currentTarget.src = `https://via.placeholder.com/48/1f2937/ffffff?text=${token.symbol[0]}`;
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                            {token.symbol[0]}
                          </div>
                        )}
                        {token.verified && (
                          <CheckCircleIcon className="absolute -bottom-1 -right-1 w-4 h-4 text-emerald-500 bg-gray-900 rounded-full" />
                        )}
                      </div>

                      {/* Token Info */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white text-lg truncate">
                            {token.symbol}
                          </span>
                          {isFavorite && (
                            <StarIconSolid className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-sm text-gray-400 truncate">{token.name}</div>
                      </div>

                      {/* Balance */}
                      <div className="text-right flex-shrink-0">
                        {token.balance !== undefined ? (
                          <>
                            <div className="font-medium text-white">
                              {formatCompactNumber(token.balance)}
                            </div>
                            {token.balanceUSD !== undefined && (
                              <div className="text-sm text-gray-400">
                                {formatCurrency(token.balanceUSD)}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-gray-500">-</div>
                        )}
                      </div>

                      {/* Favorite Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(token.address);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
                      >
                        {isFavorite ? (
                          <StarIconSolid className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <StarIconOutline className="w-5 h-5 text-gray-500" />
                        )}
                      </button>

                      {/* Selected Indicator */}
                      {isSelected && (
                        <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 p-4 border-t border-white/10 bg-gray-900/50">
            <button
              onClick={onClose}
              className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl 
                       text-gray-400 font-medium transition-colors active:scale-95
                       flex items-center justify-center gap-2"
            >
              <span>Manage Token List</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
