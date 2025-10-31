// Constantes pour le token $BACK sur Devnet
export const BACK_TOKEN_DEVNET = {
  name: "SwapBack Token",
  symbol: "BACK",
  decimals: 9,
  mint: "3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE",
  program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022
  network: "devnet",
  logo: "/logo-back.png", // À ajouter
} as const;

// IDs des programmes SwapBack sur Devnet
export const PROGRAM_IDS_DEVNET = {
  router: "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt",
  buyback: "EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf",
  cnft: "2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G",
} as const;

// Cluster Solana
export const SOLANA_CLUSTER = "devnet";
export const SOLANA_RPC_URL = "https://api.devnet.solana.com";
