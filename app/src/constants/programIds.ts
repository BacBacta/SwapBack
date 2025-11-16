import { PublicKey } from "@solana/web3.js";

// Lazy load to avoid module-level env access (prevents client-side errors)
let _routerProgramId: PublicKey | null = null;
export function getRouterProgramId(): PublicKey {
  if (!_routerProgramId) {
    _routerProgramId = new PublicKey(
      process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz"
    );
  }
  return _routerProgramId;
}

let _backTokenMint: PublicKey | null = null;
export function getBackTokenMint(): PublicKey {
  if (!_backTokenMint) {
    _backTokenMint = new PublicKey(
      process.env.NEXT_PUBLIC_BACK_MINT || "6tFCrUr3mZpL3BzNV2cLjYDkoL7toYA74TpMCSxFg45E"
    );
  }
  return _backTokenMint;
}

let _switchboardFeed: PublicKey | null = null;
export function getSwitchboardFeed(): PublicKey {
  if (!_switchboardFeed) {
    _switchboardFeed = new PublicKey(
      process.env.NEXT_PUBLIC_SWITCHBOARD_FEED || "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
    );
  }
  return _switchboardFeed;
}

// DO NOT export module-level constants - they cause "Application error: client-side exception"
// Use lazy loading functions instead: getRouterProgramId(), getBackTokenMint(), getSwitchboardFeed()
