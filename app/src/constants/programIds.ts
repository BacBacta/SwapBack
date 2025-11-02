import { PublicKey } from "@solana/web3.js";

export const ROUTER_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"
);

export const BACK_TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_BACK_MINT || "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
);

export const SWITCHBOARD_FEED = new PublicKey(
  process.env.NEXT_PUBLIC_SWITCHBOARD_FEED || "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
);
