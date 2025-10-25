/**
 * Solana Token List - Constants
 * Popular tokens on Solana with metadata
 */

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  coingeckoId?: string;
  popular?: boolean;
}

/**
 * Popular Solana Tokens (Devnet & Mainnet)
 */
export const SOLANA_TOKENS: TokenInfo[] = [
  {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    coingeckoId: "solana",
    popular: true,
  },
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    coingeckoId: "usd-coin",
    popular: true,
  },
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
    coingeckoId: "tether",
    popular: true,
  },
  {
    mint: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj",
    symbol: "stSOL",
    name: "Lido Staked SOL",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj/logo.png",
    coingeckoId: "lido-staked-sol",
    popular: true,
  },
  {
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    symbol: "mSOL",
    name: "Marinade Staked SOL",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
    coingeckoId: "marinade-staked-sol",
    popular: true,
  },
  {
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    symbol: "ORCA",
    name: "Orca",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png",
    coingeckoId: "orca",
    popular: true,
  },
  {
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    symbol: "RAY",
    name: "Raydium",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
    coingeckoId: "raydium",
    popular: true,
  },
  {
    mint: "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt",
    symbol: "SRM",
    name: "Serum",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt/logo.png",
    coingeckoId: "serum",
    popular: false,
  },
  {
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    logoURI:
      "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
    coingeckoId: "bonk",
    popular: true,
  },
  {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    logoURI:
      "https://static.jup.ag/jup/icon.png",
    coingeckoId: "jupiter-exchange-solana",
    popular: true,
  },
  {
    mint: "ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx",
    symbol: "ATLAS",
    name: "Star Atlas",
    decimals: 8,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx/logo.png",
    coingeckoId: "star-atlas",
    popular: false,
  },
  {
    mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",
    symbol: "MEW",
    name: "cat in a dogs world",
    decimals: 5,
    logoURI:
      "https://bafkreidlwyr4j754d7vpavqr5hnuiynpt23witu3smtlwp33nhbozovkqa.ipfs.nftstorage.link",
    coingeckoId: "cat-in-a-dogs-world",
    popular: true,
  },
  {
    mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    symbol: "POPCAT",
    name: "Popcat",
    decimals: 9,
    logoURI:
      "https://bafkreibf4hdjurmkwj4f4d2wl3z2ju4aaqpvjhqm5sqqz3xmz3zyikqh4e.ipfs.nftstorage.link",
    coingeckoId: "popcat",
    popular: true,
  },
];

/**
 * Get token by mint address
 */
export function getTokenByMint(mint: string): TokenInfo | undefined {
  return SOLANA_TOKENS.find((token) => token.mint === mint);
}

/**
 * Get token by symbol
 */
export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return SOLANA_TOKENS.find(
    (token) => token.symbol.toUpperCase() === symbol.toUpperCase()
  );
}

/**
 * Get popular tokens only
 */
export function getPopularTokens(): TokenInfo[] {
  return SOLANA_TOKENS.filter((token) => token.popular);
}

/**
 * Search tokens by name or symbol
 */
export function searchTokens(query: string): TokenInfo[] {
  const lowerQuery = query.toLowerCase();
  return SOLANA_TOKENS.filter(
    (token) =>
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.name.toLowerCase().includes(lowerQuery) ||
      token.mint.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Default tokens for swap interface
 */
export const DEFAULT_INPUT_TOKEN = SOLANA_TOKENS[0]; // SOL
export const DEFAULT_OUTPUT_TOKEN = SOLANA_TOKENS[1]; // USDC
