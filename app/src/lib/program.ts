import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

function normalizeIdlAddress<T extends Idl>(idl: T, programId: PublicKey): T {
  const expectedAddress = programId.toBase58();
  if ((idl as Record<string, unknown>).address === expectedAddress) {
    return idl;
  }
  return {
    ...idl,
    address: expectedAddress,
  } as T;
}

export function createProgramWithProvider<T extends Idl>(
  idl: T,
  programId: PublicKey,
  provider: AnchorProvider
): Program<T> {
  const normalized = normalizeIdlAddress(idl, programId);
  return new Program(normalized as Idl, provider) as Program<T>;
}

export { normalizeIdlAddress };
