/**
 * 🔑 PublicKey Utilities
 * 
 * Module utilitaire pour la manipulation sécurisée des PublicKey Solana.
 * Résout définitivement les erreurs "toBase58 is not a function" en
 * normalisant toutes les entrées en vraies instances PublicKey.
 * 
 * @author SwapBack Team
 * @date December 2025
 */

import { PublicKey } from "@solana/web3.js";

/**
 * Convertit de manière sécurisée n'importe quelle valeur en PublicKey.
 * 
 * Gère:
 * - PublicKey instances (retourne tel quel)
 * - Strings base58 (convertit en PublicKey)
 * - Objets avec méthode toBase58 (extraie et reconvertit)
 * - Objets avec propriété _bn (reconstruction interne)
 * 
 * @param value - La valeur à convertir (string | PublicKey | any)
 * @returns Une instance PublicKey valide
 * @throws Error si la conversion est impossible
 */
export function toPublicKey(value: PublicKey | string | unknown): PublicKey {
  // Cas 1: Déjà une PublicKey valide
  if (value instanceof PublicKey) {
    return value;
  }

  // Cas 2: String base58
  if (typeof value === "string") {
    try {
      return new PublicKey(value);
    } catch (e) {
      throw new Error(`Invalid base58 string for PublicKey: "${value}"`);
    }
  }

  // Cas 3: Objet avec toBase58() (pseudo-PublicKey)
  if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { toBase58?: () => string }).toBase58 === "function"
  ) {
    const base58 = (value as { toBase58: () => string }).toBase58();
    return new PublicKey(base58);
  }

  // Cas 4: Objet avec _bn (internal PublicKey representation)
  if (
    value !== null &&
    typeof value === "object" &&
    "_bn" in (value as object)
  ) {
    // Reconstruire depuis les bytes internes
    const bytes = (value as { _bn: { toArray: () => number[] } })._bn.toArray();
    // Pad to 32 bytes
    const padded = new Uint8Array(32);
    padded.set(bytes.slice(-32));
    return new PublicKey(padded);
  }

  // Cas 5: Buffer ou Uint8Array
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return new PublicKey(value);
  }

  // Cas 6: Tableau de nombres (bytes)
  if (Array.isArray(value) && value.every((v) => typeof v === "number")) {
    return new PublicKey(new Uint8Array(value));
  }

  throw new Error(
    `Cannot convert to PublicKey: ${JSON.stringify(value)} (type: ${typeof value})`
  );
}

/**
 * Convertit de manière sécurisée en PublicKey, retourne null si impossible.
 * Version non-throwing de toPublicKey.
 */
export function toPublicKeySafe(value: unknown): PublicKey | null {
  try {
    return toPublicKey(value);
  } catch {
    return null;
  }
}

/**
 * Convertit une valeur en string base58 de manière sécurisée.
 */
export function toBase58Safe(value: unknown): string {
  const pk = toPublicKeySafe(value);
  return pk ? pk.toBase58() : String(value);
}

/**
 * Vérifie si une valeur est une PublicKey valide.
 */
export function isValidPublicKey(value: unknown): boolean {
  return toPublicKeySafe(value) !== null;
}

/**
 * Normalise un objet de paramètres en convertissant tous les champs PublicKey.
 * Utile pour les params de swap où inputMint/outputMint peuvent être strings.
 */
export function normalizeSwapParams<T extends Record<string, unknown>>(
  params: T,
  publicKeyFields: (keyof T)[]
): T {
  const normalized = { ...params };
  
  for (const field of publicKeyFields) {
    const value = params[field];
    if (value !== undefined && value !== null) {
      try {
        (normalized as Record<string, unknown>)[field as string] = toPublicKey(value);
      } catch (e) {
        console.warn(`Failed to normalize ${String(field)}:`, e);
      }
    }
  }
  
  return normalized;
}

export default {
  toPublicKey,
  toPublicKeySafe,
  toBase58Safe,
  isValidPublicKey,
  normalizeSwapParams,
};
