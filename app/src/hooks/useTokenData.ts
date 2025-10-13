"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
}

interface TokenPrice {
  [mint: string]: number; // Prix en USD
}

export const useTokenData = (tokenMint: string) => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  
  const [balance, setBalance] = useState<number>(0);
  const [usdPrice, setUsdPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Récupérer la balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey || !tokenMint) return;

      try {
        setLoading(true);

        // Pour SOL natif
        if (tokenMint === "So11111111111111111111111111111111111111112") {
          const balance = await connection.getBalance(publicKey);
          setBalance(balance / 1e9); // Convertir lamports en SOL
        } else {
          // Pour les SPL tokens
          try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
              mint: new PublicKey(tokenMint),
            });

            if (tokenAccounts.value.length > 0) {
              const tokenAmount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
              setBalance(tokenAmount.uiAmount || 0);
            } else {
              setBalance(0);
            }
          } catch (error) {
            console.error("Error fetching token balance:", error);
            setBalance(0);
          }
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [publicKey, tokenMint, connection]);

  // Récupérer le prix USD
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // Utiliser l'API Jupiter pour les prix
        const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenMint}`);
        const data = await response.json();
        
        if (data.data && data.data[tokenMint]) {
          setUsdPrice(data.data[tokenMint].price);
        }
      } catch (error) {
        console.error("Error fetching price:", error);
        // Fallback vers des prix mockés
        const mockPrices: { [key: string]: number } = {
          "So11111111111111111111111111111111111111112": 100, // SOL
          "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 1, // USDC
          "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": 1, // USDT
        };
        setUsdPrice(mockPrices[tokenMint] || 0);
      }
    };

    fetchPrice();

    // Rafraîchir toutes les 60 secondes
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [tokenMint]);

  return {
    balance,
    usdPrice,
    usdValue: balance * usdPrice,
    loading,
  };
};
