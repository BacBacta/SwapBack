import { PublicKey } from '@solana/web3.js';

/**
 * Devnet Program IDs - Updated after deployment
 * These are the program IDs for the SwapBack smart contracts on devnet
 */

export const ROUTER_PROGRAM_ID = new PublicKey(
  process.env.REACT_APP_ROUTER_PROGRAM_ID || 
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID ||
  'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890ABC' // Replace after deployment
);

export const BUYBACK_PROGRAM_ID = new PublicKey(
  process.env.REACT_APP_BUYBACK_PROGRAM_ID ||
  process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID ||
  'XyZ1234567890ABCdEfGhIjKlMnOpQrStUvWx' // Replace after deployment
);

export const CNFT_PROGRAM_ID = new PublicKey(
  process.env.REACT_APP_CNFT_PROGRAM_ID ||
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID ||
  '1234567890ABCdEfGhIjKlMnOpQrStUvWxYz' // Replace after deployment
);

export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const DEVNET_WS = 'wss://api.devnet.solana.com';

export const DEVNET_CONFIG = {
  network: 'devnet',
  programs: {
    router: ROUTER_PROGRAM_ID,
    buyback: BUYBACK_PROGRAM_ID,
    cnft: CNFT_PROGRAM_ID,
  },
  rpc: DEVNET_RPC,
  ws: DEVNET_WS,
};
