import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export function normalizeIdlAddress<T extends Idl>(idl: T, programId: PublicKey): T {
  const expected = programId.toBase58();
  if ((idl as Record<string, unknown>).address === expected) {
    return idl;
  }
  return {
    ...idl,
    address: expected,
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
