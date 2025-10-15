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
        // 🔧 Sur devnet, on utilise des prix simulés réalistes
        // Sur mainnet, utiliser: https://price.jup.ag/v4/price?ids=${tokenMint}
        
        // Prix simulés pour devnet (basés sur les prix mainnet approximatifs)
        const devnetPrices: { [key: string]: number } = {
          // Native tokens
          "So11111111111111111111111111111111111111112": 145.50, // SOL ~$145
          
          // Devnet test tokens
          "BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU": 0.001, // $BACK (simulé)
          "3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G": 1.00, // USDC Test
          "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": 0.00002, // BONK
          
          // Mainnet tokens (pour référence)
          "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 1.00, // USDC
          "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": 1.00, // USDT
          "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": 160.00, // mSOL
          "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": 0.85, // JUP
          "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": 2.50, // JTO
        };

        // Utiliser le prix simulé ou 0
        const price = devnetPrices[tokenMint] || 0;
        setUsdPrice(price);
        
        if (price > 0) {
          console.log(`💰 Prix pour ${tokenMint.substring(0, 8)}... = $${price}`);
        }
      } catch (error) {
        console.error("Error fetching price:", error);
        setUsdPrice(0);
      }
    };

    fetchPrice();

    // Rafraîchir toutes les 60 secondes (pour future intégration Pyth)
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
