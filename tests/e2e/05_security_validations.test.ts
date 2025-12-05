/**
 * Tests E2E - Validations de Sécurité (25 Nov 2025)
 * 
 * ⚠️ DEPRECATED: Ces tests utilisent l'ancienne architecture avec des vaults séparés.
 * L'architecture actuelle utilise le modèle 100% burn.
 * 
 * Les validations de sécurité sont testées dans:
 * - tests/e2e/06_security_checks_simple.test.ts (vérification IDL)
 * - tests/e2e/buyback-flow.test.ts (tests fonctionnels)
 */

import { describe, it } from "vitest";

// DEPRECATED: Ces tests ne correspondent plus à l'architecture actuelle
describe("Security Validations E2E Tests", () => {
  it.skip("⚠️ Tests skippés - Architecture dépréciée. Voir 06_security_checks_simple.test.ts", () => {
    console.log("Ces tests utilisent l'ancienne architecture avec back_vault.");
    console.log("Les validations sont maintenant dans 06_security_checks_simple.test.ts");
  });
});
