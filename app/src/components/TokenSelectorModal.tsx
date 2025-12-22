/**
 * Enhanced Token Selector Modal - Fullscreen with Search & Filters
 * Inspired by Jupiter/Uniswap V4 UX
 * Production version - fetches real tokens from Jupiter API
 */

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MagnifyingGlassIcon, 
  XMarkIcon,
  StarIcon as StarIconOutline,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { formatCurrency, formatCompactNumber } from "@/utils/formatNumber";
import { getApiUrl, API_ENDPOINTS } from "@/config/api";

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
  walletAddress?: string; // To fetch balances
}

// Default popular tokens (real mainnet addresses, no fake balances)
const DEFAULT_POPULAR_TOKENS: Token[] = [
  { address: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png", verified: true, tags: ["blue-chip"] },
  { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png", verified: true, tags: ["stablecoin"] },
  { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether USD", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png", verified: true, tags: ["stablecoin"] },
  { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter", decimals: 6, logoURI: "https://static.jup.ag/jup/icon.png", verified: true, tags: ["blue-chip", "defi"] },
  { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", decimals: 5, logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I", verified: true, tags: ["meme"] },
  { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", name: "dogwifhat", decimals: 6, logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link", verified: true, tags: ["meme"] },
  { address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "ETH", name: "Wrapped Ether", decimals: 8, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png", verified: true, tags: ["blue-chip"] },
  { address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", symbol: "mSOL", name: "Marinade Staked SOL", decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png", verified: true, tags: ["lsd"] },
  { address: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", symbol: "PYTH", name: "Pyth Network", decimals: 6, logoURI: "https://pyth.network/token.svg", verified: true, tags: ["blue-chip", "defi"] },
  { address: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", symbol: "JTO", name: "Jito", decimals: 9, logoURI: "https://metadata.jito.network/token/jto/image", verified: true, tags: ["blue-chip", "defi"] },
  { address: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", symbol: "ORCA", name: "Orca", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png", verified: true, tags: ["blue-chip", "defi"] },
  { address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY", name: "Raydium", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png", verified: true, tags: ["blue-chip", "defi"] },
  { address: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", symbol: "jitoSOL", name: "Jito Staked SOL", decimals: 9, logoURI: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png", verified: true, tags: ["lsd"] },
  { address: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", symbol: "MEW", name: "cat in a dogs world", decimals: 5, logoURI: "https://bafkreidlwyr565dxtao2ipsze6bmzpszqzybz7sqi2zaet5fs7k6u5oi4i.ipfs.nftstorage.link/", verified: true, tags: ["meme"] },
  { address: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", symbol: "WBTC", name: "Wrapped BTC", decimals: 8, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png", verified: true, tags: ["blue-chip"] },
  { address: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", symbol: "bSOL", name: "BlazeStake SOL", decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1/logo.png", verified: true, tags: ["lsd"] },
  { address: "Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs", symbol: "GRASS", name: "Grass", decimals: 9, logoURI: "https://sznsyxelqffs7ntnqcax7jq7ka6yegvcqlz5l7jb3uhlz7u4imcq.arweave.net/gf-xLW4sVjvsIJIk_z-5e0d7yO8tsL5_G4b7jl1mKEc", verified: true, tags: ["meme"] },
  { address: "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX", symbol: "USDH", name: "USDH Hubble Stablecoin", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX/usdh.svg", verified: true, tags: ["stablecoin"] },
];

type FilterType = "all" | "favorites" | "stablecoins" | "blue-chips" | "meme" | "defi" | "lsd";

const RECENT_TOKENS_KEY = "swapback_recent_tokens";
const FAVORITES_KEY = "swapback_favorite_tokens";
const MAX_RECENT = 5;

export function TokenSelectorModal({
  isOpen,
  onClose,
  onSelect,
  selectedToken,
  title = "Sélectionner un token",
}: TokenSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentTokens, setRecentTokens] = useState<string[]>([]);
  const [allTokens, setAllTokens] = useState<Token[]>(DEFAULT_POPULAR_TOKENS);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [searchedTokens, setSearchedTokens] = useState<Token[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load favorites and recent from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedFavorites = localStorage.getItem(FAVORITES_KEY);
        if (savedFavorites) {
          setFavorites(new Set(JSON.parse(savedFavorites)));
        } else {
          setFavorites(new Set(["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]));
        }
        const savedRecent = localStorage.getItem(RECENT_TOKENS_KEY);
        if (savedRecent) {
          setRecentTokens(JSON.parse(savedRecent));
        }
      } catch (e) {
        console.warn("Failed to load from localStorage:", e);
      }
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && favorites.size > 0) {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    }
  }, [favorites]);

  // Fetch tokens from our API (proxies Jupiter to avoid CORS)
  useEffect(() => {
    const fetchTokens = async () => {
      if (!isOpen) return;
      
      setIsLoadingTokens(true);
      try {
        // Use our internal API to avoid CORS issues
        const response = await fetch(getApiUrl(`${API_ENDPOINTS.tokens}?limit=200`));
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.tokens?.length > 0) {
            // Map to our Token format
            const tokens: Token[] = data.tokens.map((t: { address: string; symbol: string; name: string; decimals: number; logoURI?: string; tags?: string[]; verified?: boolean }) => ({
              address: t.address,
              symbol: t.symbol,
              name: t.name,
              decimals: t.decimals,
              logoURI: t.logoURI,
              verified: t.verified !== false,
              tags: t.tags || (t.symbol.includes('USD') ? ['stablecoin'] : ['blue-chip'])
            }));
            setAllTokens(tokens);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch tokens from API, using defaults:', error);
        setAllTokens(DEFAULT_POPULAR_TOKENS);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    fetchTokens();
  }, [isOpen]);

  // Check if query is a valid Solana address
  const isValidAddress = useCallback((query: string): boolean => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query.trim());
  }, []);

  // Search for tokens when typing an address
  const searchTokenByAddress = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (!isValidAddress(trimmedQuery)) {
      setSearchedTokens([]);
      setSearchError(null);
      return;
    }
    
    setIsSearching(true);
    setSearchError(null);
    try {
      // Use our internal API to search by address (avoids CORS)
      const response = await fetch(getApiUrl(`${API_ENDPOINTS.tokens}?address=${encodeURIComponent(trimmedQuery)}`));
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.tokens?.length > 0) {
          setSearchedTokens(data.tokens.map((t: { address: string; symbol: string; name: string; decimals: number; logoURI?: string; verified?: boolean; tags?: string[] }) => ({
            address: t.address,
            symbol: t.symbol,
            name: t.name,
            decimals: t.decimals,
            logoURI: t.logoURI,
            verified: t.verified !== false,
            tags: t.tags || []
          })));
          setSearchError(null);
        } else {
          setSearchedTokens([]);
          setSearchError("Token non trouvé. Vérifiez l'adresse.");
        }
      }
    } catch (error) {
      console.warn('Token search failed:', error);
      setSearchedTokens([]);
      setSearchError("Erreur de recherche. Réessayez.");
    } finally {
      setIsSearching(false);
    }
  }, [isValidAddress]);

  // Debounced search for addresses
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 32) {
        searchTokenByAddress(searchQuery);
      } else {
        setSearchedTokens([]);
        setSearchError(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchTokenByAddress]);

  // Get recent tokens as Token objects
  const recentTokensList = useMemo(() => {
    return recentTokens
      .map(addr => allTokens.find(t => t.address === addr) || searchedTokens.find(t => t.address === addr))
      .filter((t): t is Token => t !== undefined)
      .slice(0, MAX_RECENT);
  }, [recentTokens, allTokens, searchedTokens]);

  // Filter and search tokens
  const filteredTokens = useMemo(() => {
    // Combine searched tokens with all tokens
    let tokens = searchedTokens.length > 0 ? [...searchedTokens, ...allTokens] : allTokens;

    // Remove duplicates
    const seen = new Set<string>();
    tokens = tokens.filter(t => {
      if (seen.has(t.address)) return false;
      seen.add(t.address);
      return true;
    });

    // Apply filter
    if (activeFilter === "favorites") {
      tokens = tokens.filter(t => favorites.has(t.address));
    } else if (activeFilter === "stablecoins") {
      tokens = tokens.filter(t => t.tags?.includes("stablecoin") || t.symbol.includes('USD'));
    } else if (activeFilter === "blue-chips") {
      tokens = tokens.filter(t => t.tags?.includes("blue-chip"));
    } else if (activeFilter === "meme") {
      tokens = tokens.filter(t => t.tags?.includes("meme"));
    } else if (activeFilter === "defi") {
      tokens = tokens.filter(t => t.tags?.includes("defi"));
    } else if (activeFilter === "lsd") {
      tokens = tokens.filter(t => t.tags?.includes("lsd"));
    }

    // Apply search (for non-address searches)
    if (searchQuery && searchQuery.length < 32) {
      const query = searchQuery.toLowerCase();
      tokens = tokens.filter(
        t =>
          t.symbol.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query)
      );
    }

    // Sort: favorites first, then by balance, then by symbol
    return tokens.sort((a, b) => {
      const aFav = favorites.has(a.address) ? 1 : 0;
      const bFav = favorites.has(b.address) ? 1 : 0;
      if (bFav !== aFav) return bFav - aFav;
      if ((b.balanceUSD || 0) !== (a.balanceUSD || 0)) {
        return (b.balanceUSD || 0) - (a.balanceUSD || 0);
      }
      return a.symbol.localeCompare(b.symbol);
    });
  }, [searchQuery, activeFilter, favorites, allTokens, searchedTokens]);

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

  // Handle token selection with recent tracking
  const handleSelectToken = (token: Token) => {
    const newRecent = [token.address, ...recentTokens.filter(a => a !== token.address)].slice(0, MAX_RECENT);
    setRecentTokens(newRecent);
    if (typeof window !== "undefined") {
      localStorage.setItem(RECENT_TOKENS_KEY, JSON.stringify(newRecent));
    }
    onSelect(token);
    onClose();
  };

  // Paste from clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isValidAddress(text.trim())) {
        setSearchQuery(text.trim());
        inputRef.current?.focus();
      }
    } catch (e) {
      console.warn("Clipboard paste failed:", e);
    }
  };

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setActiveFilter("all");
      setSearchError(null);
      setSearchedTokens([]);
    }
  }, [isOpen]);

  // State for portal mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: "Tous" },
    { id: "favorites", label: "⭐ Favoris" },
    { id: "stablecoins", label: "💵 Stables" },
    { id: "blue-chips", label: "💎 Blue Chips" },
    { id: "meme", label: "🐸 Meme" },
    { id: "defi", label: "🔄 DeFi" },
    { id: "lsd", label: "📈 LSD" },
  ];

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4"
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
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
              <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-emerald-500/10 rounded-lg transition-all active:scale-90 hover:rotate-90 duration-200 group"
              >
                <XMarkIcon className="w-6 h-6 text-gray-400 group-hover:text-emerald-400 transition-colors" />
              </button>
            </div>

            {/* Search Bar with Paste Button */}
            <div className="relative group">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-400 transition-colors duration-200" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, symbole ou adresse du token..."
                autoFocus
                className="w-full pl-10 pr-24 py-3 bg-white/5 border border-white/10 
                         rounded-xl text-white placeholder-gray-500 
                         outline-none focus:border-emerald-500 focus:bg-white/10 focus:shadow-lg focus:shadow-emerald-500/20
                         transition-all duration-200"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isSearching && <ArrowPathIcon className="w-5 h-5 text-emerald-400 animate-spin" />}
                <button
                  onClick={handlePasteFromClipboard}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-emerald-400"
                  title="Coller depuis le presse-papiers"
                >
                  <ClipboardDocumentIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Address Search Hint */}
            {searchQuery.length >= 20 && searchQuery.length < 32 && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-gray-500 mt-2 flex items-center gap-1"
              >
                <span className="text-emerald-400">💡</span> Collez l&apos;adresse complète du token (32-44 caractères)
              </motion.p>
            )}

            {/* Search Error */}
            {searchError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2"
              >
                <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{searchError}</span>
              </motion.div>
            )}
          </div>

          {/* Quick Access: Recent & Popular */}
          {!searchQuery && (
            <div className="flex-shrink-0 px-4 py-3 border-b border-white/5 bg-black/30">
              {recentTokensList.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ClockIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Récents</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {recentTokensList.map((token) => (
                      <button
                        key={token.address}
                        onClick={() => handleSelectToken(token)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                      >
                        {token.logoURI ? (
                          <img src={token.logoURI} alt={token.symbol} className="w-5 h-5 rounded-full" onError={(e) => { e.currentTarget.src = `https://via.placeholder.com/20/1f2937/ffffff?text=${token.symbol[0]}`; }} />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs text-emerald-400">{token.symbol[0]}</div>
                        )}
                        <span className="text-sm text-white font-medium">{token.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FireIcon className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Populaires</span>
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {DEFAULT_POPULAR_TOKENS.slice(0, 8).map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handleSelectToken(token)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors flex-shrink-0 ${
                        token.address === selectedToken 
                          ? "bg-emerald-500/20 ring-1 ring-emerald-500/50" 
                          : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {token.logoURI ? (
                        <img src={token.logoURI} alt={token.symbol} className="w-5 h-5 rounded-full" onError={(e) => { e.currentTarget.src = `https://via.placeholder.com/20/1f2937/ffffff?text=${token.symbol[0]}`; }} />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs text-emerald-400">{token.symbol[0]}</div>
                      )}
                      <span className="text-sm text-white font-medium">{token.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-b border-emerald-500/10 overflow-x-auto scrollbar-hide bg-black/20">
            {filters.map((filter) => (
              <motion.button
                key={filter.id}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setActiveFilter(filter.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all relative overflow-hidden ${
                  activeFilter === filter.id
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {filter.label}
              </motion.button>
            ))}
          </div>

          {/* Token List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingTokens ? (
              <div className="flex flex-col items-center justify-center h-full">
                <ArrowPathIcon className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
                <p className="text-gray-400">Chargement des tokens...</p>
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <MagnifyingGlassIcon className="w-16 h-16 text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg font-medium mb-2">Aucun token trouvé</p>
                <p className="text-gray-500 text-sm">
                  {searchQuery.length >= 32 
                    ? "Vérifiez que l'adresse est correcte"
                    : "Essayez un autre terme ou collez une adresse de token"
                  }
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
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ x: 4, backgroundColor: "rgba(16, 185, 129, 0.1)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectToken(token)}
                      className={`w-full flex items-center gap-3 p-4 transition-all relative ${
                        isSelected ? "bg-gradient-to-r from-emerald-500/20 to-transparent border-l-2 border-emerald-500" : ""
                      }`}
                    >
                      {/* Token Logo */}
                      <div className="relative flex-shrink-0">
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="w-10 h-10 rounded-full ring-2 ring-transparent hover:ring-emerald-500/30 transition-all"
                            onError={(e) => {
                              e.currentTarget.src = `https://via.placeholder.com/40/1f2937/ffffff?text=${token.symbol[0]}`;
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                            {token.symbol[0]}
                          </div>
                        )}
                        {token.verified && (
                          <CheckCircleIcon className="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-emerald-500 bg-gray-900 rounded-full" />
                        )}
                      </div>

                      {/* Token Info */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate">{token.symbol}</span>
                          {isFavorite && <StarIconSolid className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                          {!token.verified && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">Non vérifié</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 truncate">{token.name}</div>
                        <div className="text-xs text-gray-600 font-mono truncate">{token.address.slice(0, 8)}...{token.address.slice(-6)}</div>
                      </div>

                      {/* Balance & Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {token.balance !== undefined && (
                          <div className="text-right">
                            <div className="font-medium text-white">
                              {formatCompactNumber(token.balance)}
                            </div>
                            {token.balanceUSD !== undefined && (
                              <div className="text-sm text-gray-400">
                                {formatCurrency(token.balanceUSD)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Favorite Toggle */}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(token.address);
                          }}
                          className="p-2 rounded-lg transition-colors cursor-pointer hover:bg-white/10"
                          role="button"
                        >
                          {isFavorite ? (
                            <StarIconSolid className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <StarIconOutline className="w-5 h-5 text-gray-500 hover:text-yellow-500" />
                          )}
                        </span>

                        {isSelected && <CheckCircleIcon className="w-6 h-6 text-emerald-500" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with count */}
          <div className="flex-shrink-0 p-3 border-t border-white/10 bg-gray-900/50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''} disponible{filteredTokens.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-gray-600">Données: Jupiter API</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
