import { Idl } from "@coral-xyz/anchor";
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

// DO NOT export module-level ROUTER_PROGRAM_ID - use getRouterProgramId() instead

// Importer l'IDL depuis le fichier copié par le script copy-idl
// Le fichier swapback_router.json est copié depuis public/idl/ ou target/idl/ pendant le build
import deployedIdl from "./swapback_router.json";
export const ROUTER_IDL: Idl = deployedIdl as Idl;
