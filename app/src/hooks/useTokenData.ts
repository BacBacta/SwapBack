"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const useTokenData = (tokenMint: string) => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [balance, setBalance] = useState<number>(0);
  const [usdPrice, setUsdPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true); // Start as loading

  // Debug: log the tokenMint on mount/change
  useEffect(() => {
    console.log(`🎯 useTokenData: tokenMint="${tokenMint}", connected=${connected}, publicKey=${publicKey?.toString()?.substring(0,8) || 'null'}`);
  }, [tokenMint, connected, publicKey]);

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
  }, [connection, publicKey, tokenMint, connected]);

  // Récupérer le prix USD en temps réel via l'API
  useEffect(() => {
    const fetchPrice = async () => {
      if (!tokenMint) {
        setUsdPrice(0);
        return;
      }

      try {
        // Stablecoins - prix fixe à $1 (pas besoin d'API)
        const stablecoins = [
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
          'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',  // USDH
          '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet USDC
          '3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G', // Test USDC
          'BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR', // Testnet USDC
        ];
        
        if (stablecoins.includes(tokenMint)) {
          setUsdPrice(1.0);
          console.log(`💰 Stablecoin ${tokenMint.substring(0, 8)}... = $1.00`);
          return;
        }

        // Appeler notre API proxy pour éviter CORS et rate limiting
        const response = await fetch(`/api/price?mint=${tokenMint}`, {
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (response.ok) {
          const data = await response.json();
          if (data.price && data.price > 0) {
            setUsdPrice(data.price);
            console.log(`💰 Prix temps réel ${tokenMint.substring(0, 8)}... = $${data.price.toFixed(4)} (source: ${data.source})`);
            return;
          }
        }

        // Fallback: essayer Jupiter directement (peut échouer avec CORS)
        try {
          const jupiterResponse = await fetch(
            `https://api.jup.ag/price/v2?ids=${tokenMint}`,
            { 
              signal: AbortSignal.timeout(5000),
              headers: { 'Accept': 'application/json' }
            }
          );

          if (jupiterResponse.ok) {
            const jupiterData = await jupiterResponse.json();
            if (jupiterData.data?.[tokenMint]?.price) {
              const price = parseFloat(jupiterData.data[tokenMint].price);
              if (price > 0) {
                setUsdPrice(price);
                console.log(`💰 Jupiter direct ${tokenMint.substring(0, 8)}... = $${price.toFixed(4)}`);
                return;
              }
            }
          }
        } catch (jupiterError) {
          // Jupiter direct failed, continue to fallback
          console.warn('Jupiter direct price fetch failed:', jupiterError);
        }

        // Dernier fallback: prix statiques pour tokens connus
        const fallbackPrices: { [key: string]: number } = {
          'So11111111111111111111111111111111111111112': 220, // SOL ~$220
          '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux': 0.001, // $BACK
        };

        const fallbackPrice = fallbackPrices[tokenMint];
        if (fallbackPrice) {
          setUsdPrice(fallbackPrice);
          console.log(`💰 Fallback ${tokenMint.substring(0, 8)}... = $${fallbackPrice.toFixed(4)}`);
          return;
        }

        // Aucun prix trouvé
        console.warn(`⚠️ Pas de prix trouvé pour ${tokenMint.substring(0, 8)}...`);
        setUsdPrice(0);

      } catch (error) {
        console.error("Error fetching price:", error);
        setUsdPrice(0);
      }
    };

    // Fetch immédiatement
    fetchPrice();

    // Rafraîchir toutes les 30 secondes pour les prix en temps réel
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, [tokenMint]);

  return {
    balance,
    usdPrice,
    usdValue: balance * usdPrice,
    loading,
  };
};
