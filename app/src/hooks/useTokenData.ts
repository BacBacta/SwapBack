"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TOKEN_DECIMALS } from "@/config/constants";

export const useTokenData = (tokenMint: string) => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [balance, setBalance] = useState<number>(0);
  const [usdPrice, setUsdPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);

    // Récupérer le solde du token
  useEffect(() => {
    const fetchBalance = async () => {
      if (!connection || !publicKey || !tokenMint) {
        console.warn("⚠️ useTokenData: Missing requirements", { 
          hasConnection: !!connection, 
          hasPublicKey: !!publicKey, 
          tokenMint 
        });
        setBalance(0);
        setLoading(false);
        return;
      }

      console.log(`🔍 useTokenData: Fetching balance for ${tokenMint.substring(0, 8)}...`);
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
        } else {
          // SPL Token or Token-2022
          const mintPubkey = new PublicKey(tokenMint);
          
          // Try standard SPL Token first (BACK mint is on standard program)
          try {
            const ata = await getAssociatedTokenAddress(
              mintPubkey,
              publicKey,
              false,
              TOKEN_PROGRAM_ID
            );
            
            console.log(`🔍 Checking SPL Token ATA: ${ata.toBase58()}`);
            const accountInfo = await connection.getAccountInfo(ata);
            
            if (accountInfo && accountInfo.data.length >= 72) {
              const amount = accountInfo.data.readBigUInt64LE(64);
              const tokenBalance = Number(amount) / Math.pow(10, TOKEN_DECIMALS);
              console.log(`✅ SPL Token ${tokenMint.substring(0, 8)}... balance: ${tokenBalance.toFixed(TOKEN_DECIMALS)} (raw: ${amount}, decimals: ${TOKEN_DECIMALS})`);
              setBalance(tokenBalance);
              return;
            } else {
              console.log(`⚠️ SPL Token account exists but invalid size: ${accountInfo?.data.length || 0} bytes`);
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
            const accountInfo = await connection.getAccountInfo(ata);
            
            if (accountInfo && accountInfo.data.length >= 72) {
              const amount = accountInfo.data.readBigUInt64LE(64);
              const tokenBalance = Number(amount) / Math.pow(10, TOKEN_DECIMALS);
              console.log(`✅ Token-2022 ${tokenMint.substring(0, 8)}... balance: ${tokenBalance.toFixed(TOKEN_DECIMALS)} (raw: ${amount})`);
              setBalance(tokenBalance);
              return;
            } else {
              console.log(`⚠️ Token-2022 account exists but invalid size: ${accountInfo?.data.length || 0} bytes`);
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

    fetchBalance();

    // Rafraîchir toutes les 10 secondes
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [connection, publicKey, tokenMint]);

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
          "6tFCrUr3mZpL3BzNV2cLjYDkoL7toYA74TpMCSxFg45E": 0.001, // $BACK
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
