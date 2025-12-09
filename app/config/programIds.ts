/**
 * 📍 Configuration des Program IDs
 * 
 * Centralise tous les Program IDs pour les différents environnements.
 * Les IDs sont automatiquement extraits lors du déploiement via deploy-devnet.sh
 * 
 * @author SwapBack Team
 * @date October 26, 2025
 */

import { PublicKey } from '@solana/web3.js';

export type NetworkEnvironment = 'devnet' | 'testnet' | 'mainnet-beta' | 'localnet';

/**
 * Configuration par environnement
 */
export interface ProgramIds {
  cnftProgram: PublicKey;
  routerProgram: PublicKey;
  buybackProgram: PublicKey;
}

/**
 * URLs RPC par environnement
 */
export const RPC_ENDPOINTS: Record<NetworkEnvironment, string> = {
  'localnet': 'http://127.0.0.1:8899',
  'devnet': 'https://api.devnet.solana.com',
  'testnet': 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};

/**
 * Program IDs - DEVNET
 * 
 * ✅ Programme déployé sur devnet avec unlock_tokens (vérifié Nov 23, 2025)
 * Router: 9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh
 * CNFT: EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP
 * Buyback: 746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6
 */
const DEVNET_PROGRAM_IDS: ProgramIds = {
  cnftProgram: new PublicKey(
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || 'EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP'
  ),
  routerProgram: new PublicKey(
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || '9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh'
  ),
  buybackProgram: new PublicKey(
    process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || '746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6'
  ),
};

/**
 * Program IDs - TESTNET
 * 
 * ✅ Mêmes IDs que devnet pour le moment
 */
const TESTNET_PROGRAM_IDS: ProgramIds = {
  cnftProgram: new PublicKey(
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || 'EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP'
  ),
  routerProgram: new PublicKey(
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || '9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh'
  ),
  buybackProgram: new PublicKey(
    process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || '746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6'
  ),
};

/**
 * Program IDs - MAINNET (Deployed December 8, 2025)
 */
const MAINNET_PROGRAM_IDS: ProgramIds = {
  cnftProgram: new PublicKey('EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP'), // cNFT Program
  routerProgram: new PublicKey('APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN'), // Router - Deployed Dec 8, 2025
  buybackProgram: new PublicKey('7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ'), // Buyback Program
};

/**
 * Program IDs - LOCALNET (pour développement)
 */
const LOCALNET_PROGRAM_IDS: ProgramIds = {
  cnftProgram: new PublicKey('11111111111111111111111111111111'),
  routerProgram: new PublicKey('11111111111111111111111111111111'),
  buybackProgram: new PublicKey('11111111111111111111111111111111'),
};

/**
 * Map de tous les Program IDs
 */
const PROGRAM_IDS_MAP: Record<NetworkEnvironment, ProgramIds> = {
  devnet: DEVNET_PROGRAM_IDS,
  testnet: TESTNET_PROGRAM_IDS,
  'mainnet-beta': MAINNET_PROGRAM_IDS,
  localnet: LOCALNET_PROGRAM_IDS,
};

/**
 * Obtenir l'environnement courant
 */
export function getCurrentEnvironment(): NetworkEnvironment {
  // Vérifier les variables d'environnement
  const envNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (envNetwork && isValidNetwork(envNetwork)) {
    return envNetwork as NetworkEnvironment;
  }

  // Par défaut: testnet (déployé le 28 Oct 2025)
  return 'testnet';
}

/**
 * Vérifier si un réseau est valide
 */
function isValidNetwork(network: string): network is NetworkEnvironment {
  return ['devnet', 'testnet', 'mainnet-beta', 'localnet'].includes(network);
}

/**
 * Obtenir les Program IDs pour l'environnement courant
 */
export function getProgramIds(network?: NetworkEnvironment): ProgramIds {
  const env = network || getCurrentEnvironment();
  return PROGRAM_IDS_MAP[env];
}

/**
 * Obtenir l'URL RPC pour l'environnement courant
 */
export function getRpcEndpoint(network?: NetworkEnvironment): string {
  const env = network || getCurrentEnvironment();
  
  // Vérifier si un RPC custom est défini
  const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (customRpc) {
    return customRpc;
  }

  return RPC_ENDPOINTS[env];
}

/**
 * Obtenir l'URL de l'explorer pour l'environnement courant
 */
export function getExplorerUrl(
  type: 'tx' | 'address' | 'block',
  identifier: string,
  network?: NetworkEnvironment
): string {
  const env = network || getCurrentEnvironment();
  const cluster = env === 'mainnet-beta' ? '' : `?cluster=${env}`;
  
  return `https://explorer.solana.com/${type}/${identifier}${cluster}`;
}

/**
 * Charger les Program IDs depuis le fichier JSON généré par le déploiement
 * 
 * Utilisé côté serveur uniquement (Node.js)
 */
export async function loadProgramIdsFromFile(
  filePath: string = './deployed-program-ids.json'
): Promise<ProgramIds | null> {
  try {
    const fs = await import('fs');
    const data = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(data);

    return {
      cnftProgram: new PublicKey(json.cnft),
      routerProgram: new PublicKey(json.router),
      buybackProgram: new PublicKey(json.buyback),
    };
  } catch (err) {
    console.error('Erreur lors du chargement des Program IDs:', err);
    return null;
  }
}

/**
 * Mettre à jour les Program IDs dans ce fichier
 * 
 * Utilisé par le script de déploiement
 */
export function generateProgramIdsCode(ids: {
  cnft: string;
  router: string;
  buyback: string;
}, network: NetworkEnvironment): string {
  return `
// Program IDs - ${network.toUpperCase()}
const ${network.toUpperCase()}_PROGRAM_IDS: ProgramIds = {
  cnftProgram: new PublicKey('${ids.cnft}'),
  routerProgram: new PublicKey('${ids.router}'),
  buybackProgram: new PublicKey('${ids.buyback}'),
};
`.trim();
}

/**
 * Export des constantes principales
 */
export const CURRENT_NETWORK = getCurrentEnvironment();
export const PROGRAM_IDS = getProgramIds();
export const RPC_ENDPOINT = getRpcEndpoint();

/**
 * Utilitaire pour logger la configuration
 */
export function logConfiguration() {
  console.log('🌐 Configuration Solana:');
  console.log('  Network:', CURRENT_NETWORK);
  console.log('  RPC:', RPC_ENDPOINT);
  console.log('  CNFT Program:', PROGRAM_IDS.cnftProgram.toBase58());
  console.log('  Router Program:', PROGRAM_IDS.routerProgram.toBase58());
  console.log('  Buyback Program:', PROGRAM_IDS.buybackProgram.toBase58());
}

/**
 * Vérifier que les Program IDs sont valides
 */
export function validateProgramIds(ids: ProgramIds): boolean {
  const defaultKey = '11111111111111111111111111111111';
  
  return (
    ids.cnftProgram.toBase58() !== defaultKey &&
    ids.routerProgram.toBase58() !== defaultKey &&
    ids.buybackProgram.toBase58() !== defaultKey
  );
}

/**
 * Export pour faciliter l'accès
 */
export default PROGRAM_IDS;
