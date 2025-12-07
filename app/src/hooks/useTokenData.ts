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

  // Récupérer le prix USD en temps réel via plusieurs APIs
  useEffect(() => {
    const fetchPrice = async () => {
      if (!tokenMint) {
        setUsdPrice(0);
        return;
      }

      // Mapping des tokens connus vers leurs IDs CoinGecko
      const coingeckoIds: { [key: string]: string } = {
        'So11111111111111111111111111111111111111112': 'solana',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'usd-coin',
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'tether',
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'msol',
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'jupiter-exchange-solana',
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'bonk',
        'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': 'jito-governance-token',
        'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': 'marinade-staked-sol',
      };

      try {
        // Essayer d'abord Jupiter Price API v2
        const jupiterResponse = await fetch(
          `https://api.jup.ag/price/v2?ids=${tokenMint}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000), // 5s timeout
          }
        );

        if (jupiterResponse.ok) {
          const data = await jupiterResponse.json();
          if (data.data && data.data[tokenMint] && data.data[tokenMint].price) {
            const price = parseFloat(data.data[tokenMint].price);
            if (price > 0) {
              setUsdPrice(price);
              console.log(`💰 Jupiter: ${tokenMint.substring(0, 8)}... = $${price.toFixed(4)}`);
              return;
            }
          }
        }
      } catch (jupiterError) {
        console.warn('Jupiter Price API failed:', jupiterError);
      }

      // Fallback: CoinGecko API (gratuit, pas de clé requise)
      const coingeckoId = coingeckoIds[tokenMint];
      if (coingeckoId) {
        try {
          const cgResponse = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`,
            {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(5000),
            }
          );

          if (cgResponse.ok) {
            const cgData = await cgResponse.json();
            if (cgData[coingeckoId] && cgData[coingeckoId].usd) {
              const price = cgData[coingeckoId].usd;
              setUsdPrice(price);
              console.log(`💰 CoinGecko: ${tokenMint.substring(0, 8)}... = $${price.toFixed(4)}`);
              return;
            }
          }
        } catch (cgError) {
          console.warn('CoinGecko API failed:', cgError);
        }
      }

      // Fallback: Birdeye API (via proxy pour éviter CORS)
      try {
        const birdeyeResponse = await fetch(
          `/api/price?mint=${tokenMint}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
          }
        );

        if (birdeyeResponse.ok) {
          const birdeyeData = await birdeyeResponse.json();
          if (birdeyeData.price && birdeyeData.price > 0) {
            setUsdPrice(birdeyeData.price);
            console.log(`💰 Birdeye: ${tokenMint.substring(0, 8)}... = $${birdeyeData.price.toFixed(4)}`);
            return;
          }
        }
      } catch (birdeyeError) {
        // Silently fail, try next fallback
      }

      // Dernier fallback: prix statiques pour stablecoins
      const stablecoinPrices: { [key: string]: number } = {
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.0, // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.0, // USDT
        'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX': 1.0, // USDH
        '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 1.0, // stSOL (approx)
        '3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G': 1.0, // USDC Test
        'BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR': 1.0, // USDC Testnet
      };

      const stablePrice = stablecoinPrices[tokenMint];
      if (stablePrice) {
        setUsdPrice(stablePrice);
        console.log(`💰 Stablecoin: ${tokenMint.substring(0, 8)}... = $${stablePrice.toFixed(2)}`);
        return;
      }

      // Aucun prix trouvé
      console.warn(`⚠️ Aucun prix trouvé pour ${tokenMint.substring(0, 8)}...`);
      setUsdPrice(0);
    };

    // Fetch immédiatement
    fetchPrice();

    // Rafraîchir toutes les 15 secondes pour avoir des prix à jour
    const interval = setInterval(fetchPrice, 15000);
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
