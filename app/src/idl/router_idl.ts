import { Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export const ROUTER_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"
);

// IDL minimal pour create_plan
export const ROUTER_IDL = {
  address: ROUTER_PROGRAM_ID.toString(),
  metadata: {
    name: "swapback_router",
    version: "0.1.0",
    spec: "0.1.0",
  },
  version: "0.1.0",
  name: "swapback_router",
  instructions: [
    {
      name: "createPlan",
      accounts: [
        { name: "dcaPlan", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "state", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "inputAmount", type: "u64" },
        { name: "destinationToken", type: "publicKey" },
        { name: "dcaInterval", type: "i64" },
        { name: "numberOfSwaps", type: "u64" },
        { name: "minOutputAmount", type: "u64" },
      ],
    },
  ],
} as unknown as Idl;
