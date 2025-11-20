import { PublicKey } from "@solana/web3.js";

// Lazy load to avoid module-level env access (prevents client-side errors)
let _routerProgramId: PublicKey | null = null;
export function getRouterProgramId(): PublicKey {
  if (!_routerProgramId) {
    _routerProgramId = new PublicKey(
      process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh"
    );
  }
  return _routerProgramId;
}

let _backTokenMint: PublicKey | null = null;
export function getBackTokenMint(): PublicKey {
  if (!_backTokenMint) {
    _backTokenMint = new PublicKey(
      process.env.NEXT_PUBLIC_BACK_MINT || "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
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

let _buybackProgramId: PublicKey | null = null;
export function getBuybackProgramId(): PublicKey {
  if (!_buybackProgramId) {
    _buybackProgramId = new PublicKey(
      process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || "746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6"
    );
  }
  return _buybackProgramId;
}

let _cnftProgramId: PublicKey | null = null;
export function getCnftProgramId(): PublicKey {
  if (!_cnftProgramId) {
    _cnftProgramId = new PublicKey(
      process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
    );
  }
  return _cnftProgramId;
}

// Export for backward compatibility with existing code
export const PROGRAM_IDS = {
  get routerProgram() { return getRouterProgramId(); },
  get backTokenMint() { return getBackTokenMint(); },
  get switchboardFeed() { return getSwitchboardFeed(); },
  get buybackProgram() { return getBuybackProgramId(); },
  get cnftProgram() { return getCnftProgramId(); },
};

// DO NOT export module-level constants - they cause "Application error: client-side exception"
// Use lazy loading functions instead: getRouterProgramId(), getBackTokenMint(), getSwitchboardFeed()
