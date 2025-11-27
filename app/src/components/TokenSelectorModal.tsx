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
        className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%", scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: "100%", scale: 0.95 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative w-full md:max-w-lg h-[95vh] md:h-[85vh] 
                     rounded-t-2xl md:rounded-2xl bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950
                     border-t md:border border-emerald-500/20 md:border-emerald-500/30
                     flex flex-col overflow-hidden shadow-2xl shadow-emerald-500/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-emerald-500/5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent animate-gradient">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-emerald-500/10 rounded-lg transition-all active:scale-90 hover:rotate-90 duration-200 group"
              >
                <XMarkIcon className="w-6 h-6 text-gray-400 group-hover:text-emerald-400 transition-colors" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative group">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-400 transition-colors duration-200" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or paste address"
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 
                         rounded-xl text-white placeholder-gray-500 
                         outline-none focus:border-emerald-500 focus:bg-white/10 focus:shadow-lg focus:shadow-emerald-500/20
                         transition-all duration-200"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-b border-emerald-500/10 overflow-x-auto scrollbar-hide bg-black/20">
            {[
              { id: "all" as FilterType, label: "All", icon: null },
              { id: "favorites" as FilterType, label: "⭐ Favorites", icon: null },
              { id: "stablecoins" as FilterType, label: "💵 Stables", icon: null },
              { id: "blue-chips" as FilterType, label: "🔵 Blue Chips", icon: null },
            ].map((filter) => (
              <motion.button
                key={filter.id}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setActiveFilter(filter.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all relative overflow-hidden ${
                  activeFilter === filter.id
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {activeFilter === filter.id && (
                  <motion.div
                    layoutId="activeFilter"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{filter.label}</span>
              </motion.button>
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
                    <motion.button
                      key={token.address}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelect(token)}
                      className={`w-full flex items-center gap-3 p-4 transition-all hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-transparent relative group ${
                        isSelected ? "bg-gradient-to-r from-emerald-500/20 to-transparent border-l-2 border-emerald-500 shadow-lg shadow-emerald-500/10" : ""
                      }`}
                    >
                      {/* Token Logo */}
                      <div className="relative flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="w-12 h-12 rounded-full relative z-10 ring-2 ring-transparent group-hover:ring-emerald-500/30 transition-all duration-200"
                            onError={(e) => {
                              e.currentTarget.src = `https://via.placeholder.com/48/1f2937/ffffff?text=${token.symbol[0]}`;
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg relative z-10 shadow-lg shadow-emerald-500/30">
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

                      {/* Favorite Toggle (non-button to avoid nested buttons) */}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(token.address);
                        }}
                        className="p-2 rounded-lg transition-colors active:scale-95 cursor-pointer hover:bg-white/10 flex items-center justify-center"
                        role="button"
                        aria-label={isFavorite ? `Remove ${token.symbol} from favorites` : `Add ${token.symbol} to favorites`}
                      >
                        {isFavorite ? (
                          <StarIconSolid className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <StarIconOutline className="w-5 h-5 text-gray-500" />
                        )}
                      </span>

                      {/* Selected Indicator */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        >
                          <CheckCircleIcon className="w-6 h-6 text-emerald-500 drop-shadow-lg" />
                        </motion.div>
                      )}
                    </motion.button>
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
