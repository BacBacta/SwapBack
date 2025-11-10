"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TrendingUp, Star, Clock, Search, Plus } from "lucide-react";
import { CustomTokenImport } from "./CustomTokenImport";

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: number;
  balanceUSD?: number;
  priceUSD?: number;
  priceChange24h?: number;
  verified?: boolean;
  trending?: boolean;
}

interface TokenSelectorProps {
  selectedToken: string;
  onSelect: (token: Token) => void;
  onClose: () => void;
}

// Popular tokens on Solana Mainnet with enhanced metadata
const BASE_POPULAR_TOKENS: Token[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    verified: true,
    trending: true,
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    verified: true,
  },
  {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
    verified: true,
  },
  {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
    verified: true,
    trending: true,
  },
  {
    address: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    symbol: "PYTH",
    name: "Pyth Network",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3/logo.png",
    verified: true,
  },
  {
    address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    symbol: "mSOL",
    name: "Marinade staked SOL",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
    verified: true,
  },
  {
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    logoURI: "https://static.jup.ag/jup/icon.png",
    verified: true,
    trending: true,
  },
  {
    address: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    symbol: "JTO",
    name: "Jito",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL/logo.png",
    verified: true,
  },
];

export const TokenSelector = ({
  selectedToken,
  onSelect,
  onClose,
}: TokenSelectorProps) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "recent" | "import">("all");
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const [importedTokens, setImportedTokens] = useState<Token[]>([]);

  // Load recent tokens from localStorage
  const [recentTokens, setRecentTokens] = useState<string[]>([]);

  // Build popular tokens list with network-specific tokens
  // Use in component instead of module-level to avoid env access issues
  const getPopularTokens = (): Token[] => {
    return [
      ...BASE_POPULAR_TOKENS,
      // Add $BACK token on devnet only - Uses NEXT_PUBLIC_BACK_MINT from env
      ...(process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet' ? [{
        address: process.env.NEXT_PUBLIC_BACK_MINT || "8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P",
        symbol: "BACK",
        name: "SwapBack Token",
        decimals: 9,
        logoURI: "https://swapback.xyz/logo.png", // TODO: Add proper logo
        verified: true,
        trending: true,
      }] : []),
    ];
  };

  useEffect(() => {
    const recent = localStorage.getItem("recentTokens");
    if (recent) {
      setRecentTokens(JSON.parse(recent));
    }

    // Load imported tokens
    const imported = localStorage.getItem("importedTokens");
    if (imported) {
      setImportedTokens(JSON.parse(imported));
    }
  }, []);

  // Fetch token balances when wallet connected
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicKey) return;
      
      try {
        // Fetch SOL balance
        const solBalance = await connection.getBalance(publicKey);
        const balances: Record<string, number> = {
          "So11111111111111111111111111111111111111112": solBalance / 1e9,
        };

        // Fetch SPL token balances
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );

        tokenAccounts.value.forEach((accountInfo) => {
          const parsedInfo = accountInfo.account.data.parsed.info;
          const mint = parsedInfo.mint;
          const balance = parsedInfo.tokenAmount.uiAmount || 0;
          balances[mint] = balance;
        });

        setTokenBalances(balances);
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchBalances();
  }, [publicKey, connection]);

  // Filter tokens with enhanced search (include imported tokens)
  const allTokens = [...getPopularTokens(), ...importedTokens];
  const filteredTokens = allTokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase()) ||
      token.address.toLowerCase().includes(search.toLowerCase())
  );

  // Separate tokens with balance
  const tokensWithBalance = filteredTokens.filter(
    (token) => tokenBalances[token.address] && tokenBalances[token.address] > 0
  );

  const tokensWithoutBalance = filteredTokens.filter(
    (token) => !tokenBalances[token.address] || tokenBalances[token.address] === 0
  );

  // Get recent tokens
  const recentTokensList = getPopularTokens().filter((token) =>
    recentTokens.includes(token.address)
  );

  const handleSelectToken = (token: Token) => {
    // Add to recent tokens
    const updatedRecent = [
      token.address,
      ...recentTokens.filter((addr) => addr !== token.address),
    ].slice(0, 5); // Keep only last 5
    localStorage.setItem("recentTokens", JSON.stringify(updatedRecent));
    setRecentTokens(updatedRecent);

    onSelect(token);
    onClose();
  };

  useEffect(() => {
    // Fermer avec Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Format balance display
  const formatBalance = (balance: number) => {
    if (balance === 0) return "0";
    if (balance < 0.01) return "< 0.01";
    if (balance < 1) return balance.toFixed(4);
    if (balance < 1000) return balance.toFixed(2);
    return balance.toLocaleString("en-US", { maximumFractionDigits: 2 });
  };

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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold terminal-text terminal-glow uppercase tracking-wider">
              Select Token
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--primary)]/10 transition-colors terminal-text rounded"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-2 px-4 text-sm font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-[var(--primary)] text-black"
                  : "bg-[var(--primary)]/10 terminal-text hover:bg-[var(--primary)]/20"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("recent")}
              className={`flex-1 py-2 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "recent"
                  ? "bg-[var(--primary)] text-black"
                  : "bg-[var(--primary)]/10 terminal-text hover:bg-[var(--primary)]/20"
              }`}
            >
              <Clock size={14} />
              Recent
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={`flex-1 py-2 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "import"
                  ? "bg-[var(--primary)] text-black"
                  : "bg-[var(--primary)]/10 terminal-text hover:bg-[var(--primary)]/20"
              }`}
            >
              <Plus size={14} />
              Import
            </button>
          </div>

          {/* Search */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--primary)]/50" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or address..."
              className="input-field w-full pl-10"
              autoFocus
            />
          </div>

          {/* Token Lists */}
          <div className="max-h-96 overflow-y-auto space-y-1 pr-2">
            {activeTab === "all" && (
              <>
                {/* Tokens with Balance */}
                {publicKey && tokensWithBalance.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs terminal-text opacity-50 mb-2 font-semibold">
                      MY TOKENS
                    </p>
                    {tokensWithBalance.map((token) => (
                      <TokenRow
                        key={token.address}
                        token={token}
                        balance={tokenBalances[token.address]}
                        selectedToken={selectedToken}
                        onSelect={handleSelectToken}
                        formatBalance={formatBalance}
                      />
                    ))}
                  </div>
                )}

                {/* Popular Tokens */}
                {!search && (
                  <div className="mb-2">
                    <p className="text-xs terminal-text opacity-50 mb-2 font-semibold flex items-center gap-2">
                      <TrendingUp size={14} />
                      POPULAR TOKENS
                    </p>
                  </div>
                )}

                {/* All Tokens */}
                {filteredTokens.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="terminal-text opacity-50">
                      No tokens found
                    </p>
                  </div>
                ) : (
                  tokensWithoutBalance.map((token) => (
                    <TokenRow
                      key={token.address}
                      token={token}
                      balance={tokenBalances[token.address]}
                      selectedToken={selectedToken}
                      onSelect={handleSelectToken}
                      formatBalance={formatBalance}
                    />
                  ))
                )}
              </>
            )}

            {/* Recent Tokens Tab */}
            {activeTab === "recent" && (
              <>
                {recentTokensList.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="mx-auto mb-2 text-[var(--primary)]/30" size={32} />
                    <p className="terminal-text opacity-50 text-sm">
                      No recent tokens yet
                    </p>
                  </div>
                ) : (
                  recentTokensList.map((token) => (
                    <TokenRow
                      key={token.address}
                      token={token}
                      balance={tokenBalances[token.address]}
                      selectedToken={selectedToken}
                      onSelect={handleSelectToken}
                      formatBalance={formatBalance}
                    />
                  ))
                )}
              </>
            )}

            {/* Import Token Tab */}
            {activeTab === "import" && (
              <CustomTokenImport
                onImport={(token) => {
                  setImportedTokens((prev) => [...prev, token]);
                  handleSelectToken(token);
                }}
                onClose={onClose}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// Token Row Component
interface TokenRowProps {
  token: Token;
  balance?: number;
  selectedToken: string;
  onSelect: (token: Token) => void;
  formatBalance: (balance: number) => string;
}

const TokenRow = ({ token, balance, selectedToken, onSelect, formatBalance }: TokenRowProps) => {
  const hasBalance = balance !== undefined && balance > 0;
  
  return (
    <button
      onClick={() => onSelect(token)}
      className={`w-full flex items-center gap-3 p-3 transition-all terminal-text group ${
        selectedToken === token.symbol
          ? "bg-[var(--primary)]/10 border-2 border-[var(--primary)]"
          : "border-2 border-transparent hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/30"
      }`}
    >
      {/* Token Logo */}
      <div className="relative w-10 h-10 flex-shrink-0">
        <div className="w-full h-full border-2 border-[var(--primary)]/30 rounded-full overflow-hidden flex items-center justify-center bg-black/40">
          {token.logoURI ? (
            <img
              src={token.logoURI}
              alt={token.symbol}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="text-sm font-bold terminal-text">
              {token.symbol.charAt(0)}
            </span>
          )}
        </div>
        {/* Verified Badge */}
        {token.verified && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-black">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {/* Trending Badge */}
        {token.trending && !token.verified && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--primary)] rounded-full flex items-center justify-center">
            <TrendingUp className="w-2.5 h-2.5 text-black" />
          </div>
        )}
      </div>

      {/* Token Info */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold terminal-text terminal-glow">
            {token.symbol}
          </span>
          {hasBalance && (
            <Star className="w-3 h-3 text-[var(--primary)]" fill="var(--primary)" />
          )}
        </div>
        <div className="text-xs terminal-text opacity-50 truncate">
          {token.name}
        </div>
      </div>

      {/* Balance */}
      <div className="text-right flex-shrink-0">
        {hasBalance ? (
          <div className="text-sm font-semibold terminal-text terminal-glow">
            {formatBalance(balance)}
          </div>
        ) : balance !== undefined ? (
          <div className="text-xs terminal-text opacity-30">
            —
          </div>
        ) : null}
      </div>

      {/* Selected Indicator */}
      {selectedToken === token.symbol && (
        <div className="w-5 h-5 rounded-full bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
};
