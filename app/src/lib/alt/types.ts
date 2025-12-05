/**
 * Types pour Address Lookup Tables SwapBack
 */

import { PublicKey, AddressLookupTableAccount } from '@solana/web3.js';

export interface ALTCache {
  address: PublicKey;
  account: AddressLookupTableAccount;
  lastFetch: number;
}

export interface ALTStats {
  address: string;
  addressCount: number;
  addresses: string[];
  authority: string | null;
}

export interface SwapbackALTConfig {
  // Programs SwapBack
  routerProgram: PublicKey;
  buybackProgram: PublicKey;
  cnftProgram: PublicKey;
  
  // PDAs SwapBack
  routerState: PublicKey;
  rebateVault: PublicKey;
  
  // External Programs
  jupiterProgram: PublicKey;
  tokenProgram: PublicKey;
  token2022Program: PublicKey;
  associatedTokenProgram: PublicKey;
  systemProgram: PublicKey;
  rentSysvar: PublicKey;
  clockSysvar: PublicKey;
  
  // Common Token Mints
  wsolMint: PublicKey;
  usdcMint: PublicKey;
  usdtMint: PublicKey;
  
  // Jito Tip Accounts
  jitoTipAccounts: PublicKey[];
}
