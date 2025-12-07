#!/usr/bin/env node
const { Connection, PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require("@solana/spl-token");

async function main() {
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const wallet = new PublicKey("FLKsRa7xboYJ5d56jjQi2LKqJXMG2ejmWpkDDMLhv4WS");
  const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  
  console.log("Checking USDC balance for wallet:", wallet.toBase58());
  
  const ata = await getAssociatedTokenAddress(usdcMint, wallet, false, TOKEN_PROGRAM_ID);
  console.log("USDC ATA:", ata.toBase58());
  
  const accountInfo = await connection.getAccountInfo(ata);
  if (!accountInfo) {
    console.log("No USDC account found");
    return;
  }
  
  console.log("Account data length:", accountInfo.data.length);
  
  const rawAmount = accountInfo.data.readBigUInt64LE(64);
  console.log("Raw amount (lamports):", rawAmount.toString());
  
  const decimals = 6;
  const balance = Number(rawAmount) / Math.pow(10, decimals);
  console.log("USDC balance (6 decimals):", balance);
  
  const tokenBalance = await connection.getTokenAccountBalance(ata);
  console.log("getTokenAccountBalance result:", JSON.stringify(tokenBalance.value, null, 2));
}

main().catch(console.error);
