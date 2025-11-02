import { Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// Nouvelle adresse du programme déployé sur devnet
export const ROUTER_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz"
);

// Importer l'IDL déployé depuis le fichier JSON généré
import deployedIdl from "./router_idl_deployed.json";
export const ROUTER_IDL: Idl = deployedIdl as Idl;
