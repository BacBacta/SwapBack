/**
 * CustomTokenImport Component
 * Allow users to import tokens by mint address
 * Fetches metadata from blockchain and validates
 */

import React, { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Search, AlertTriangle, CheckCircle, Loader2, ExternalLink } from "lucide-react";

interface CustomToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  totalSupply?: number;
  verified?: boolean;
}

interface CustomTokenImportProps {
  onImport: (token: CustomToken) => void;
  onClose: () => void;
}

export const CustomTokenImport = ({ onImport, onClose }: CustomTokenImportProps) => {
  const { connection } = useConnection();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<CustomToken | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const validateAddress = (addr: string): boolean => {
    try {
      new PublicKey(addr);
      return true;
    } catch {
      return false;
    }
  };

  const fetchTokenMetadata = async (mintAddress: string) => {
    setLoading(true);
    setError(null);
    setTokenData(null);
    setShowWarning(false);

    try {
      // Validate address format
      if (!validateAddress(mintAddress)) {
        throw new Error("Invalid Solana address format");
      }

      const mintPubkey = new PublicKey(mintAddress);

      // Fetch mint info
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
      
      if (!mintInfo.value) {
        throw new Error("Token mint not found on-chain");
      }

      const parsedData = mintInfo.value.data;
      if (!("parsed" in parsedData)) {
        throw new Error("Invalid token mint data");
      }

      const { decimals, supply } = parsedData.parsed.info;

      // Try to fetch metadata (Metaplex standard)
      let name = "Unknown Token";
      let symbol = "???";
      let logoURI: string | undefined = undefined;

      try {
        // Derive metadata PDA
        const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
        const [metadataPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("metadata"),
            METADATA_PROGRAM_ID.toBuffer(),
            mintPubkey.toBuffer(),
          ],
          METADATA_PROGRAM_ID
        );

        const metadataAccount = await connection.getAccountInfo(metadataPDA);
        
        if (metadataAccount) {
          // Simple parsing of Metaplex metadata (name at offset 65, symbol at offset 97)
          const data = metadataAccount.data;
          
          // Read name (max 32 bytes starting at offset 65)
          const nameBytes = data.slice(65, 97);
          name = new TextDecoder().decode(nameBytes).replace(/\0/g, "").trim() || "Unknown Token";
          
          // Read symbol (max 10 bytes starting at offset 97)
          const symbolBytes = data.slice(97, 107);
          symbol = new TextDecoder().decode(symbolBytes).replace(/\0/g, "").trim() || "???";
          
          // Read URI (max 200 bytes starting at offset 107)
          const uriBytes = data.slice(107, 307);
          const uri = new TextDecoder().decode(uriBytes).replace(/\0/g, "").trim();
          
          // Fetch off-chain metadata (logo)
          if (uri) {
            try {
              const response = await fetch(uri);
              const offChainData = await response.json();
              logoURI = offChainData.image;
            } catch {
              // Ignore off-chain metadata errors
            }
          }
        }
      } catch (metadataError) {
        console.warn("Failed to fetch token metadata:", metadataError);
        // Continue with basic info
      }

      const token: CustomToken = {
        address: mintAddress,
        symbol,
        name,
        decimals,
        logoURI,
        totalSupply: parseInt(supply) / Math.pow(10, decimals),
        verified: false, // Custom imported tokens are not verified
      };

      setTokenData(token);
      
      // Show warning for unverified tokens
      if (!logoURI || symbol === "???") {
        setShowWarning(true);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch token data");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!tokenData) return;

    // Add to localStorage for persistence
    const importedTokens = JSON.parse(localStorage.getItem("importedTokens") || "[]");
    const exists = importedTokens.some((t: CustomToken) => t.address === tokenData.address);
    
    if (!exists) {
      importedTokens.push(tokenData);
      localStorage.setItem("importedTokens", JSON.stringify(importedTokens));
    }

    onImport(tokenData);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold terminal-text terminal-glow mb-1">
          Import Custom Token
        </h3>
        <p className="text-xs terminal-text opacity-50">
          Enter token mint address to import
        </p>
      </div>

      {/* Address Input */}
      <div className="relative">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Token mint address (e.g., So111...)"
          className="input-field w-full pr-20"
          disabled={loading}
        />
        <button
          onClick={() => fetchTokenMetadata(address)}
          disabled={loading || !address}
          className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-semibold transition-all ${
            loading || !address
              ? "bg-[var(--primary)]/20 text-[var(--primary)]/50 cursor-not-allowed"
              : "bg-[var(--primary)] text-black hover:bg-[var(--primary)]/80"
          }`}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500 rounded flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-red-500">
            <div className="font-semibold mb-1">Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Token Preview */}
      {tokenData && (
        <div className="space-y-4">
          {/* Token Card */}
          <div className="p-4 bg-black/40 rounded border-2 border-[var(--primary)]/30">
            <div className="flex items-start gap-3">
              {/* Logo */}
              <div className="w-12 h-12 rounded-full border-2 border-[var(--primary)]/30 overflow-hidden flex items-center justify-center bg-black/40 flex-shrink-0">
                {tokenData.logoURI ? (
                  <img
                    src={tokenData.logoURI}
                    alt={tokenData.symbol}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-lg font-bold terminal-text">
                    {tokenData.symbol.charAt(0)}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold terminal-text terminal-glow">
                    {tokenData.symbol}
                  </span>
                  {!tokenData.verified && (
                    <div className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500 text-yellow-500 text-xs font-semibold">
                      UNVERIFIED
                    </div>
                  )}
                </div>
                <div className="text-sm terminal-text opacity-70 mb-2">
                  {tokenData.name}
                </div>
                
                {/* Details */}
                <div className="space-y-1 text-xs terminal-text opacity-50">
                  <div className="flex items-center gap-2">
                    <span>Decimals:</span>
                    <span className="font-semibold">{tokenData.decimals}</span>
                  </div>
                  {tokenData.totalSupply && (
                    <div className="flex items-center gap-2">
                      <span>Supply:</span>
                      <span className="font-semibold">
                        {tokenData.totalSupply.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span>Address:</span>
                    <a
                      href={`https://solscan.io/token/${tokenData.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[var(--primary)] hover:underline flex items-center gap-1 truncate"
                    >
                      {tokenData.address.slice(0, 8)}...{tokenData.address.slice(-8)}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Unverified Warning */}
          {showWarning && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-yellow-500 space-y-2">
                  <div className="font-semibold">Unverified Token Warning</div>
                  <div className="opacity-80">
                    This token is not verified. Please ensure you trust this token before trading.
                    Anyone can create a token with any name/symbol.
                  </div>
                  <div className="opacity-80">
                    <strong>Risk Checklist:</strong>
                  </div>
                  <ul className="list-disc list-inside space-y-1 opacity-80 ml-2">
                    <li>Verify the contract address from official sources</li>
                    <li>Check liquidity and trading volume</li>
                    <li>Be aware of potential scams or rug pulls</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-6 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] hover:bg-[var(--primary)]/10 transition-all terminal-text font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="flex-1 py-3 px-6 bg-[var(--primary)] hover:bg-[var(--primary)]/80 text-black font-bold transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />
              Import Token
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!tokenData && !loading && !error && (
        <div className="p-3 bg-black/20 rounded border border-[var(--primary)]/20 text-xs terminal-text opacity-70">
          <div className="space-y-2">
            <div className="font-semibold">How to find token address:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Visit Solscan.io or SolanaFM.com</li>
              <li>Search for your token</li>
              <li>Copy the "Token Address" or "Mint Address"</li>
              <li>Paste it above and click Search</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
