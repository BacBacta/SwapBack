"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const useTokenData = (tokenMint: string) => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [balance, setBalance] = useState<number>(0);
  const [usdPrice, setUsdPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true); // Start as loading
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Debug: log the tokenMint on mount/change
  useEffect(() => {
    console.log(`🎯 useTokenData: tokenMint="${tokenMint}", connected=${connected}, publicKey=${publicKey?.toString()?.substring(0,8) || 'null'}`);
  }, [tokenMint, connected, publicKey]);

  // Fonction de rafraîchissement exposée
  const refetch = useCallback(() => {
    console.log(`🔄 useTokenData: Refetch triggered for ${tokenMint?.substring(0, 8) || 'unknown'}...`);
    setRefreshTrigger(prev => prev + 1);
  }, [tokenMint]);

    // Récupérer le solde du token
  useEffect(() => {
    const fetchBalance = async () => {
      // Check wallet connected status
      if (!connected || !publicKey) {
        console.warn("⚠️ useTokenData: Wallet not connected", { connected, hasPublicKey: !!publicKey });
        setBalance(0);
        setLoading(false);
        return;
      }
      
      if (!connection || !tokenMint) {
        console.warn("⚠️ useTokenData: Missing connection or tokenMint", { 
          hasConnection: !!connection, 
          tokenMint 
        });
        setBalance(0);
        setLoading(false);
        return;
      }

      console.log(`🔍 useTokenData: Fetching balance for mint="${tokenMint}" wallet="${publicKey.toString().substring(0,8)}..."`);
      console.log(`🔍 Is SOL? ${tokenMint === "So11111111111111111111111111111111111111112"}`);
      setLoading(true);

      try {
        // Native SOL
        if (
          tokenMint === "So11111111111111111111111111111111111111112"
        ) {
          const lamports = await connection.getBalance(publicKey);
          const solBalance = lamports / 1e9;
          console.log(`✅ SOL balance: ${solBalance.toFixed(6)} SOL`);
          setBalance(solBalance);
          setLoading(false);
          return; // Important: exit early for native SOL
        } else {
          // SPL Token or Token-2022
          const mintPubkey = new PublicKey(tokenMint);
          
          // Try standard SPL Token first
          try {
            const ata = await getAssociatedTokenAddress(
              mintPubkey,
              publicKey,
              false,
              TOKEN_PROGRAM_ID
            );
            
            console.log(`🔍 Checking SPL Token ATA: ${ata.toBase58()}`);
            
            // Use getTokenAccountBalance to get correct decimals from chain
            try {
              const tokenBalance = await connection.getTokenAccountBalance(ata);
              const balance = tokenBalance.value.uiAmount ?? 0;
              console.log(`✅ SPL Token ${tokenMint.substring(0, 8)}... balance: ${balance} (decimals: ${tokenBalance.value.decimals})`);
              setBalance(balance);
              return;
            } catch (balanceError) {
              console.log(`⚠️ SPL Token getTokenAccountBalance failed:`, balanceError);
            }
          } catch (splError) {
            console.log(`⚠️ SPL Token account not found for ${tokenMint.substring(0, 8)}..., error:`, splError);
          }
          
          // Fallback to Token-2022
          try {
            const ata = await getAssociatedTokenAddress(
              mintPubkey,
              publicKey,
              false,
              TOKEN_2022_PROGRAM_ID
            );
            
            console.log(`🔍 Checking Token-2022 ATA: ${ata.toBase58()}`);
            
            // Use getTokenAccountBalance for Token-2022 as well
            try {
              const tokenBalance = await connection.getTokenAccountBalance(ata);
              const balance = tokenBalance.value.uiAmount ?? 0;
              console.log(`✅ Token-2022 ${tokenMint.substring(0, 8)}... balance: ${balance} (decimals: ${tokenBalance.value.decimals})`);
              setBalance(balance);
              return;
            } catch (balanceError) {
              console.log(`⚠️ Token-2022 getTokenAccountBalance failed:`, balanceError);
            }
          } catch (token2022Error) {
            console.log(`⚠️ Token-2022 account not found for ${tokenMint.substring(0, 8)}..., error:`, token2022Error);
          }
          
          // No account found
          console.log(`❌ No token account found for ${tokenMint.substring(0, 8)}... in either program`);
          setBalance(0);
        }
      } catch (error) {
        console.error("❌ Error fetching balance:", error);
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch with delay to avoid burst requests
    const initialTimeout = setTimeout(fetchBalance, 500);

    // Rafraîchir toutes les 60 secondes (increased to avoid rate limiting)
    const interval = setInterval(fetchBalance, 60000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [connection, publicKey, tokenMint, connected, refreshTrigger]);

  // Récupérer le prix USD
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // Prix pour tokens mainnet (utilisés en production)
        const mainnetPrices: { [key: string]: number } = {
          // Native SOL
          So11111111111111111111111111111111111111112: 218.50, // SOL prix actuel ~$218

          // Mainnet tokens
          EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 1.0, // USDC
          Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 1.0, // USDT
          DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 0.00002, // BONK
          "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux": 0.001, // $BACK
          mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: 240.0, // mSOL
          JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: 0.85, // JUP
          "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": 2.5, // JTO
          
          // Testnet deployed tokens (fallback)
          "3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G": 1.0, // USDC Test
          BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR: 1.0, // USDC Testnet
        };

        // Utiliser le prix ou 0
        const price = mainnetPrices[tokenMint] || 0;
        setUsdPrice(price);

        if (price > 0) {
          console.log(
            `💰 Prix pour ${tokenMint.substring(0, 8)}... = $${price.toFixed(2)}`
          );
        } else {
          console.warn(
            `⚠️ Pas de prix pour ${tokenMint.substring(0, 8)}...`
          );
        }
      } catch (error) {
        console.error("Error fetching price:", error);
        setUsdPrice(0);
      }
    };

    fetchPrice();

    // Rafraîchir toutes les 120 secondes (prices don't change that fast)
    const interval = setInterval(fetchPrice, 120000);
    return () => clearInterval(interval);
  }, [tokenMint]);

  return {
    balance,
    usdPrice,
    usdValue: balance * usdPrice,
    loading,
    refetch,
  };
};
