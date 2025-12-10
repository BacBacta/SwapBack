/**
 * Switchboard Oracle Configuration - DEPRECATED
 * 
 * ⚠️ SWITCHBOARD V2 IS END-OF-LIFE as of November 15, 2024
 * This file is kept for backward compatibility only.
 * All oracle operations now use Pyth V2 Push Feeds exclusively.
 * 
 * See: https://app.switchboard.xyz/solana/mainnet - "Transition to Switchboard OnDemand"
 * 
 * @deprecated Use Pyth Push Feeds instead
 */

import { PublicKey } from '@solana/web3.js';

// Empty - Switchboard V2 is no longer supported
export const SWITCHBOARD_FEEDS = {} as const;

export type SwitchboardTokenSymbol = never;

/**
 * @deprecated Switchboard V2 is EOL - always returns null
 */
export function getSwitchboardFeedAccount(_symbol: string): PublicKey | null {
  return null;
}

/**
 * @deprecated Switchboard V2 is EOL
 */
export const SWITCHBOARD_FEEDS_BY_MINT: Record<string, PublicKey> = {};

/**
 * @deprecated Switchboard V2 is EOL - always returns null
 */
export function getSwitchboardFeedByMint(_mint: string): PublicKey | null {
  return null;
}

/**
 * @deprecated Switchboard V2 is EOL
 */
export const SWITCHBOARD_PROGRAM_ID = new PublicKey("SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f");

/**
 * @deprecated Use Pyth maxStalenessSecs instead
 */
export const SWITCHBOARD_MAX_STALENESS_SECONDS = 60;

/**
 * @deprecated No longer used
 */
export const SWITCHBOARD_MAX_VARIANCE_THRESHOLD = 0.05;
