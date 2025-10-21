/**
 * 🎫 GÉNÉRATEUR D'INVITATIONS BETA
 * Crée des codes d'invitation uniques pour les beta testeurs
 */

import { randomBytes } from "crypto";
import { writeFileSync } from "fs";

interface BetaInvite {
  code: string;
  email?: string;
  walletAddress?: string;
  createdAt: string;
  used: boolean;
  usedAt?: string;
  referrer?: string;
}

const TOTAL_INVITES = 50;

/**
 * Génère un code d'invitation unique
 */
function generateInviteCode(): string {
  const bytes = randomBytes(6);
  return bytes.toString("base64url").toUpperCase();
}

/**
 * Crée les invitations beta
 */
function createBetaInvites(count: number): BetaInvite[] {
  const invites: BetaInvite[] = [];
  const codes = new Set<string>();

  while (invites.length < count) {
    const code = generateInviteCode();
    
    // Éviter les duplicatas
    if (codes.has(code)) continue;
    
    codes.add(code);
    invites.push({
      code,
      createdAt: new Date().toISOString(),
      used: false,
    });
  }

  return invites;
}

/**
 * Génère l'URL d'invitation
 */
function getInviteUrl(code: string, baseUrl = "https://devnet.swapback.io"): string {
  return `${baseUrl}?invite=${code}`;
}

/**
 * Main execution
 */
function main() {
  console.log("🎫 Génération des invitations beta SwapBack\n");

  // Créer les invitations
  const invites = createBetaInvites(TOTAL_INVITES);

  // Générer CSV
  const csvHeader = "Code,URL,Created At,Used,Used At\n";
  const csvRows = invites.map((inv) => {
    const url = getInviteUrl(inv.code);
    return `${inv.code},${url},${inv.createdAt},${inv.used ? "Yes" : "No"},${inv.usedAt || ""}`;
  });
  const csvContent = csvHeader + csvRows.join("\n");

  // Générer JSON
  const jsonContent = JSON.stringify(invites, null, 2);

  // Générer Markdown (pour partage)
  let mdContent = "# 🎫 SwapBack Beta Invitations\n\n";
  mdContent += `**Total**: ${TOTAL_INVITES} invitations\n\n`;
  mdContent += "## Codes d'Invitation\n\n";
  mdContent += "| # | Code | URL |\n";
  mdContent += "|---|------|-----|\n";
  
  invites.forEach((inv, idx) => {
    const url = getInviteUrl(inv.code);
    mdContent += `| ${idx + 1} | \`${inv.code}\` | ${url} |\n`;
  });

  mdContent += "\n## Instructions\n\n";
  mdContent += "1. Partagez les URLs avec les beta testeurs\n";
  mdContent += "2. Chaque code est unique et usage unique\n";
  mdContent += "3. Trackez l'utilisation dans le fichier JSON\n";
  mdContent += "4. Les testeurs doivent rejoindre Discord après inscription\n";

  // Sauvegarder les fichiers
  const timestamp = new Date().toISOString().split("T")[0];
  
  writeFileSync(`beta-invites-${timestamp}.csv`, csvContent);
  writeFileSync(`beta-invites-${timestamp}.json`, jsonContent);
  writeFileSync(`beta-invites-${timestamp}.md`, mdContent);

  console.log("✅ Fichiers générés:");
  console.log(`   - beta-invites-${timestamp}.csv`);
  console.log(`   - beta-invites-${timestamp}.json`);
  console.log(`   - beta-invites-${timestamp}.md`);
  console.log("");
  console.log("📋 Exemples d'invitations:");
  console.log("");

  // Afficher 5 exemples
  invites.slice(0, 5).forEach((inv, idx) => {
    console.log(`   ${idx + 1}. ${inv.code} → ${getInviteUrl(inv.code)}`);
  });

  console.log("");
  console.log("🚀 Prochaines étapes:");
  console.log("   1. Partagez les URLs via Discord/Email");
  console.log("   2. Ajoutez validation côté frontend");
  console.log("   3. Trackez l'utilisation en DB/localStorage");
  console.log("   4. Révélez les rewards aux testeurs actifs");
}

// Exécution
main();
