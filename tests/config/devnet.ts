import { PublicKey } from "@solana/web3.js";

export const ROUTER_PROGRAM_ID = new PublicKey(
  "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"
);

export const BUYBACK_PROGRAM_ID = new PublicKey(
  "EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf"
);

export const CNFT_PROGRAM_ID = new PublicKey(
  "9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw"
);

export const BACK_TOKEN_MINT = new PublicKey(
  "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
);

export const SWITCHBOARD_SOL_USD = new PublicKey(
  "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
);

export const ROUTER_STATE_SEED = Buffer.from("router_state");
export const ROUTER_USDC_VAULT_SEED = Buffer.from("usdc_vault");
export const ROUTER_BACK_VAULT_SEED = Buffer.from("back_vault");

export const BUYBACK_STATE_SEED = Buffer.from("buyback_state");
export const BUYBACK_USDC_VAULT_SEED = Buffer.from("usdc_vault");
export const BUYBACK_BACK_VAULT_SEED = Buffer.from("back_vault");

export const CNFT_GLOBAL_STATE_SEED = Buffer.from("global_state");
export const CNFT_COLLECTION_CONFIG_SEED = Buffer.from("collection_config");
export const CNFT_USER_NFT_SEED = Buffer.from("user_nft");
