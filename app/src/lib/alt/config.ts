/**
 * Configuration des adresses communes pour l'ALT SwapBack
 * Ces adresses sont fréquemment utilisées dans les transactions de swap
 */

import { PublicKey } from '@solana/web3.js';
import { SwapbackALTConfig } from './types';

export const SWAPBACK_ALT_CONFIG: SwapbackALTConfig = {
  // Programs SwapBack
  routerProgram: new PublicKey('FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg'),
  buybackProgram: new PublicKey('7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ'),
  cnftProgram: new PublicKey('26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru'),
  
  // PDAs SwapBack (updated for new router program)
  routerState: new PublicKey('F1iDHhX7SPKCdZWex5JPV3dJ2KUKEsdRCbhDBGSgyK7k'),
  rebateVault: new PublicKey('G1epdUBUm152UkWZVbs8kAvEaJcKKbVYZJMjc9ofn8r1'),
  
  // External Programs
  jupiterProgram: new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'),
  tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  token2022Program: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
  associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  systemProgram: new PublicKey('11111111111111111111111111111111'),
  rentSysvar: new PublicKey('SysvarRent111111111111111111111111111111111'),
  clockSysvar: new PublicKey('SysvarC1ock11111111111111111111111111111111'),
  
  // Common Token Mints
  wsolMint: new PublicKey('So11111111111111111111111111111111111111112'),
  usdcMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  usdtMint: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  
  // Jito Tip Accounts (mainnet)
  jitoTipAccounts: [
    new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
    new PublicKey('HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe'),
    new PublicKey('Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY'),
    new PublicKey('ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49'),
    new PublicKey('DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh'),
    new PublicKey('ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt'),
    new PublicKey('DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL'),
    new PublicKey('3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'),
  ],
};

/**
 * Retourne toutes les adresses à inclure dans l'ALT SwapBack
 */
export function getALTAddresses(): PublicKey[] {
  const config = SWAPBACK_ALT_CONFIG;
  
  return [
    // Programs SwapBack
    config.routerProgram,
    config.buybackProgram,
    config.cnftProgram,
    
    // PDAs SwapBack
    config.routerState,
    config.rebateVault,
    
    // External Programs
    config.jupiterProgram,
    config.tokenProgram,
    config.token2022Program,
    config.associatedTokenProgram,
    config.systemProgram,
    config.rentSysvar,
    config.clockSysvar,
    
    // Common Token Mints
    config.wsolMint,
    config.usdcMint,
    config.usdtMint,
    
    // Jito Tip Accounts
    ...config.jitoTipAccounts,
  ];
}

/**
 * Nombre estimé d'économie de bytes par adresse dans l'ALT
 * Chaque adresse dans l'ALT = 1 byte au lieu de 32 bytes
 */
export const BYTES_SAVED_PER_ADDRESS = 31;

/**
 * Calcule l'économie de bytes estimée
 */
export function estimateByteSavings(numAddressesInALT: number): number {
  return numAddressesInALT * BYTES_SAVED_PER_ADDRESS;
}
