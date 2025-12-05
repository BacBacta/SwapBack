/**
 * Tests E2E - Buyback Flow (25 Nov 2025)
 * 
 * ⚠️ DEPRECATED: Ces tests utilisent l'ancienne architecture avec des vaults séparés.
 * L'architecture actuelle utilise le modèle 100% burn sans back_vault.
 * 
 * Les tests fonctionnels sont dans: tests/e2e/buyback-flow.test.ts
 */

import { describe, it } from "vitest";

// DEPRECATED: Ces tests ne correspondent plus à l'architecture actuelle
describe("Buyback Flow E2E Test", () => {
  it.skip("⚠️ Tests skippés - Architecture dépréciée. Voir buyback-flow.test.ts", () => {
    console.log("Ces tests utilisent l'ancienne architecture avec back_vault.");
    console.log("L'architecture actuelle utilise le modèle 100% burn.");
  });
});
