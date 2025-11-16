import { DEFAULT_SOLANA_NETWORK } from '@/config/constants';

/**
 * Utilitaires pour générer les URLs Solana Explorer
 * Utilise automatiquement le réseau configuré dans NEXT_PUBLIC_SOLANA_NETWORK
 */

type ClusterType = 'mainnet' | 'mainnet-beta' | 'devnet' | 'testnet';

/**
 * Obtient le cluster actuel depuis les variables d'environnement
 */
function getCurrentCluster(): ClusterType {
  return (process.env.NEXT_PUBLIC_SOLANA_NETWORK || DEFAULT_SOLANA_NETWORK) as ClusterType;
}

/**
 * Normalise le nom du cluster pour les URLs
 */
function normalizeCluster(cluster: ClusterType): string {
  // mainnet-beta doit être affiché comme mainnet dans les URLs
  return cluster === 'mainnet-beta' ? 'mainnet' : cluster;
}

/**
 * Génère l'URL Solana Explorer pour une transaction
 */
export function getExplorerTxUrl(signature: string, cluster?: ClusterType): string {
  const actualCluster = cluster || getCurrentCluster();
  const normalized = normalizeCluster(actualCluster);
  
  // Sur mainnet, pas de paramètre cluster
  const clusterParam = normalized === 'mainnet' ? '' : `?cluster=${normalized}`;
  
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
}

/**
 * Génère l'URL Solana Explorer pour une adresse (compte, token, etc.)
 */
export function getExplorerAddressUrl(address: string, cluster?: ClusterType): string {
  const actualCluster = cluster || getCurrentCluster();
  const normalized = normalizeCluster(actualCluster);
  
  const clusterParam = normalized === 'mainnet' ? '' : `?cluster=${normalized}`;
  
  return `https://explorer.solana.com/address/${address}${clusterParam}`;
}

/**
 * Génère l'URL Solscan pour une transaction
 */
export function getSolscanTxUrl(signature: string, cluster?: ClusterType): string {
  const actualCluster = cluster || getCurrentCluster();
  const normalized = normalizeCluster(actualCluster);
  
  const clusterParam = normalized === 'mainnet' ? '' : `?cluster=${normalized}`;
  
  return `https://solscan.io/tx/${signature}${clusterParam}`;
}

/**
 * Génère l'URL Solscan pour une adresse
 */
export function getSolscanAddressUrl(address: string, cluster?: ClusterType): string {
  const actualCluster = cluster || getCurrentCluster();
  const normalized = normalizeCluster(actualCluster);
  
  const clusterParam = normalized === 'mainnet' ? '' : `?cluster=${normalized}`;
  
  return `https://solscan.io/account/${address}${clusterParam}`;
}

/**
 * Génère l'URL Xray (Helius) pour une transaction
 */
export function getXrayTxUrl(signature: string, cluster?: ClusterType): string {
  const actualCluster = cluster || getCurrentCluster();
  const normalized = normalizeCluster(actualCluster);
  
  // Xray utilise 'network' au lieu de 'cluster'
  const networkParam = normalized === 'mainnet' ? '' : `?network=${normalized}`;
  
  return `https://xray.helius.xyz/tx/${signature}${networkParam}`;
}

/**
 * Obtient le label d'affichage du réseau actuel
 */
export function getNetworkLabel(cluster?: ClusterType): string {
  const actualCluster = cluster || getCurrentCluster();
  
  switch (actualCluster) {
    case 'mainnet':
    case 'mainnet-beta':
      return 'MAINNET';
    case 'devnet':
      return 'DEVNET';
    case 'testnet':
      return 'TESTNET';
    default:
      return String(actualCluster).toUpperCase();
  }
}

/**
 * Vérifie si on est sur mainnet
 */
export function isMainnet(cluster?: ClusterType): boolean {
  const actualCluster = cluster || getCurrentCluster();
  return actualCluster === 'mainnet' || actualCluster === 'mainnet-beta';
}
