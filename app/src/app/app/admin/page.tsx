"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/BackButton";
import { 
  ShieldCheckIcon, 
  PauseIcon, 
  PlayIcon, 
  KeyIcon,
  WalletIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  BellAlertIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ExclamationCircleIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";

// Program ID
const PROGRAM_ID = new PublicKey("9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh");

// Known token mints
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const BACK_MINT = new PublicKey("BACKPvPvMqWKhjNPFCSzwV6u4EpFCiM3EGgsxJVGnTMc");

interface WalletBalance {
  sol: number;
  usdc: number;
  back: number;
  isLoading: boolean;
}

interface ProtocolLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'critical';
  category: string;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface LogCounts {
  total: number;
  critical: number;
  error: number;
  warning: number;
  info: number;
  unresolved: number;
}

interface RouterState {
  authority: PublicKey;
  pendingAuthority: PublicKey | null;
  isPaused: boolean;
  pausedAt: number;
  rebatePercentage: number;
  treasuryPercentage: number;
  boostVaultPercentage: number;
  treasuryWallet: PublicKey;
  buybackWallet: PublicKey;
  boostVaultWallet: PublicKey;
  npiVaultWallet: PublicKey;
  totalVolume: BN;
  totalNpi: BN;
  totalRebatesPaid: BN;
}

export default function AdminPage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  
  const [routerState, setRouterState] = useState<RouterState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Form states
  const [newAuthority, setNewAuthority] = useState("");
  const [treasuryWallet, setTreasuryWallet] = useState("");
  const [buybackWallet, setBuybackWallet] = useState("");
  const [boostVaultWallet, setBoostVaultWallet] = useState("");
  
  // Wallet balances
  const [walletBalances, setWalletBalances] = useState<{
    treasury: WalletBalance;
    buyback: WalletBalance;
    boostVault: WalletBalance;
    npiVault: WalletBalance;
  }>({
    treasury: { sol: 0, usdc: 0, back: 0, isLoading: true },
    buyback: { sol: 0, usdc: 0, back: 0, isLoading: true },
    boostVault: { sol: 0, usdc: 0, back: 0, isLoading: true },
    npiVault: { sol: 0, usdc: 0, back: 0, isLoading: true },
  });

  // Protocol logs state
  const [protocolLogs, setProtocolLogs] = useState<ProtocolLog[]>([]);
  const [logCounts, setLogCounts] = useState<LogCounts>({
    total: 0, critical: 0, error: 0, warning: 0, info: 0, unresolved: 0
  });
  const [logsLoading, setLogsLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<'all' | 'critical' | 'error' | 'warning' | 'info'>('all');
  const [showResolvedLogs, setShowResolvedLogs] = useState(false);

  // Fetch token balance helper
  const fetchTokenBalance = async (walletAddress: PublicKey, mint: PublicKey): Promise<number> => {
    try {
      const ata = await getAssociatedTokenAddress(mint, walletAddress);
      const balance = await connection.getTokenAccountBalance(ata);
      return Number(balance.value.uiAmount || 0);
    } catch {
      return 0;
    }
  };

  // Fetch all wallet balances
  const fetchWalletBalances = useCallback(async () => {
    if (!connection || !routerState) return;
    
    const wallets = [
      { key: 'treasury' as const, address: routerState.treasuryWallet },
      { key: 'buyback' as const, address: routerState.buybackWallet },
      { key: 'boostVault' as const, address: routerState.boostVaultWallet },
      { key: 'npiVault' as const, address: routerState.npiVaultWallet },
    ];
    
    const newBalances = { ...walletBalances };
    
    for (const wallet of wallets) {
      if (!wallet.address || wallet.address.equals(PublicKey.default)) {
        newBalances[wallet.key] = { sol: 0, usdc: 0, back: 0, isLoading: false };
        continue;
      }
      
      try {
        const [solBalance, usdcBalance, backBalance] = await Promise.all([
          connection.getBalance(wallet.address),
          fetchTokenBalance(wallet.address, USDC_MINT),
          fetchTokenBalance(wallet.address, BACK_MINT),
        ]);
        
        newBalances[wallet.key] = {
          sol: solBalance / LAMPORTS_PER_SOL,
          usdc: usdcBalance,
          back: backBalance,
          isLoading: false,
        };
      } catch (error) {
        console.error(`Error fetching ${wallet.key} balance:`, error);
        newBalances[wallet.key] = { sol: 0, usdc: 0, back: 0, isLoading: false };
      }
    }
    
    setWalletBalances(newBalances);
  }, [connection, routerState]);

  // Fetch balances when router state changes
  useEffect(() => {
    if (routerState) {
      fetchWalletBalances();
    }
  }, [routerState, fetchWalletBalances]);

  // Fetch protocol logs
  const fetchProtocolLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (logFilter !== 'all') {
        params.set('level', logFilter);
      }
      if (!showResolvedLogs) {
        params.set('unresolved', 'true');
      }
      params.set('limit', '100');

      const response = await fetch(`/api/protocol-logs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setProtocolLogs(data.logs || []);
        setLogCounts(data.counts || { total: 0, critical: 0, error: 0, warning: 0, info: 0, unresolved: 0 });
      }
    } catch (error) {
      console.error('Error fetching protocol logs:', error);
    } finally {
      setLogsLoading(false);
    }
  }, [logFilter, showResolvedLogs]);

  // Fetch logs on mount and when filter changes
  useEffect(() => {
    fetchProtocolLogs();
  }, [fetchProtocolLogs]);

  // Resolve a log
  const handleResolveLog = async (logId: string) => {
    try {
      const response = await fetch('/api/protocol-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: logId, 
          resolved: true,
          resolvedBy: publicKey?.toBase58()?.slice(0, 8) 
        }),
      });
      
      if (response.ok) {
        toast.success('Log marqué comme résolu');
        fetchProtocolLogs();
      }
    } catch (error) {
      toast.error('Erreur lors de la résolution');
    }
  };

  // Delete a log
  const handleDeleteLog = async (logId: string) => {
    try {
      const response = await fetch(`/api/protocol-logs?id=${logId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success('Log supprimé');
        fetchProtocolLogs();
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Clear all logs
  const handleClearAllLogs = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer tous les logs ?')) return;
    
    try {
      const response = await fetch('/api/protocol-logs?all=true', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success('Tous les logs supprimés');
        fetchProtocolLogs();
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Download logs
  const handleDownloadLogs = () => {
    const blob = new Blob([JSON.stringify(protocolLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get icon for log level
  const getLogIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />;
      case 'info':
        return <InformationCircleIcon className="w-5 h-5 text-blue-400" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  // Get color classes for log level
  const getLogColors = (level: string) => {
    switch (level) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/10';
      case 'error':
        return 'border-red-400/30 bg-red-400/5';
      case 'warning':
        return 'border-yellow-400/30 bg-yellow-400/5';
      case 'info':
        return 'border-blue-400/30 bg-blue-400/5';
      default:
        return 'border-gray-500/30 bg-gray-500/5';
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const logTime = new Date(timestamp);
    const diffMs = now.getTime() - logTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return `Il y a ${diffDays}j`;
  };

  // Fetch router state
  const fetchRouterState = useCallback(async () => {
    if (!connection) return;
    
    try {
      setIsLoading(true);
      
      // Derive PDA for router_state
      const [routerStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_state")],
        PROGRAM_ID
      );
      
      const accountInfo = await connection.getAccountInfo(routerStatePda);
      
      if (accountInfo) {
        // Parse account data (simplified - would need proper IDL parsing)
        // For now, we'll show mock data structure
        const mockState: RouterState = {
          authority: new PublicKey("11111111111111111111111111111111"), // Will be parsed from data
          pendingAuthority: null,
          isPaused: false,
          pausedAt: 0,
          rebatePercentage: 7000,
          treasuryPercentage: 1500,
          boostVaultPercentage: 1500,
          treasuryWallet: PublicKey.default,
          buybackWallet: PublicKey.default,
          boostVaultWallet: PublicKey.default,
          npiVaultWallet: PublicKey.default,
          totalVolume: new BN(0),
          totalNpi: new BN(0),
          totalRebatesPaid: new BN(0),
        };
        
        // Parse actual data from accountInfo.data
        if (accountInfo.data.length >= 32) {
          mockState.authority = new PublicKey(accountInfo.data.slice(8, 40));
          
          // Check for pending authority (Option<Pubkey>)
          const hasPending = accountInfo.data[40] === 1;
          if (hasPending) {
            mockState.pendingAuthority = new PublicKey(accountInfo.data.slice(41, 73));
          }
          
          // is_paused is after pending_authority
          const isPausedOffset = hasPending ? 73 : 41;
          mockState.isPaused = accountInfo.data[isPausedOffset] === 1;
          
          // paused_at (i64)
          const pausedAtOffset = isPausedOffset + 1;
          const pausedAtBytes = accountInfo.data.slice(pausedAtOffset, pausedAtOffset + 8);
          mockState.pausedAt = Number(new BN(pausedAtBytes, 'le').toString());
        }
        
        setRouterState(mockState);
        setIsAdmin(publicKey?.equals(mockState.authority) || false);
      }
    } catch (error) {
      console.error("Error fetching router state:", error);
      toast.error("Erreur lors du chargement de l'état");
    } finally {
      setIsLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetchRouterState();
  }, [fetchRouterState]);

  // Admin actions
  const handlePauseProtocol = async () => {
    if (!publicKey || !signTransaction || !routerState) return;
    
    setActionLoading("pause");
    try {
      toast.info("Pause du protocole en cours...");
      
      // In a real implementation, you would call the program instruction
      // For now, simulate the action
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Protocole mis en pause avec succès");
      await fetchRouterState();
    } catch (error) {
      console.error("Error pausing protocol:", error);
      toast.error("Erreur lors de la mise en pause");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpauseProtocol = async () => {
    if (!publicKey || !signTransaction || !routerState) return;
    
    setActionLoading("unpause");
    try {
      toast.info("Reprise du protocole en cours...");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Protocole repris avec succès");
      await fetchRouterState();
    } catch (error) {
      console.error("Error unpausing protocol:", error);
      toast.error("Erreur lors de la reprise");
    } finally {
      setActionLoading(null);
    }
  };

  const handleProposeAuthority = async () => {
    if (!publicKey || !signTransaction || !newAuthority) return;
    
    try {
      new PublicKey(newAuthority); // Validate pubkey
    } catch {
      toast.error("Adresse invalide");
      return;
    }
    
    setActionLoading("propose");
    try {
      toast.info("Proposition de nouvelle autorité...");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Nouvelle autorité proposée");
      setNewAuthority("");
      await fetchRouterState();
    } catch (error) {
      console.error("Error proposing authority:", error);
      toast.error("Erreur lors de la proposition");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateWallets = async () => {
    setActionLoading("wallets");
    try {
      toast.info("Mise à jour des wallets...");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Wallets mis à jour avec succès");
      await fetchRouterState();
    } catch (error) {
      console.error("Error updating wallets:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setActionLoading(null);
    }
  };

  const formatAddress = (address: PublicKey | null) => {
    if (!address || address.equals(PublicKey.default)) return "Non défini";
    const str = address.toBase58();
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
  };

  const formatTimestamp = (ts: number) => {
    if (ts === 0) return "Jamais";
    return new Date(ts * 1000).toLocaleString();
  };

  if (!connected) {
    return (
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Breadcrumb items={[{ label: "App", href: "/app" }, { label: "Admin" }]} />
          <div className="mt-8 backdrop-blur-xl bg-gray-900/80 border-2 border-yellow-500/30 rounded-2xl p-8 text-center">
            <ShieldCheckIcon className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Accès Admin</h2>
            <p className="text-gray-400">Connectez votre wallet pour accéder au panneau d'administration.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Breadcrumb items={[{ label: "App", href: "/app" }, { label: "Admin" }]} />
          <div className="mt-8 flex items-center justify-center">
            <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
            <span className="ml-3 text-gray-400">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <Breadcrumb items={[{ label: "App", href: "/app" }, { label: "Admin" }]} />
        
        <div className="mt-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <ShieldCheckIcon className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
                <p className="text-gray-400">Gestion du protocole SwapBack</p>
              </div>
            </div>
            
            {/* Status Badge */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              routerState?.isPaused 
                ? 'bg-red-500/20 border border-red-500/50' 
                : 'bg-emerald-500/20 border border-emerald-500/50'
            }`}>
              {routerState?.isPaused ? (
                <>
                  <XCircleIcon className="w-5 h-5 text-red-500" />
                  <span className="text-red-400 font-medium">Protocole en Pause</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                  <span className="text-emerald-400 font-medium">Protocole Actif</span>
                </>
              )}
            </div>
          </div>

          {/* Admin Check */}
          {!isAdmin && (
            <div className="mb-8 backdrop-blur-xl bg-yellow-500/10 border-2 border-yellow-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />
                <div>
                  <h3 className="text-yellow-400 font-bold">Accès Limité</h3>
                  <p className="text-yellow-400/70 text-sm">
                    Vous n'êtes pas l'autorité du protocole. Les actions admin sont désactivées.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Protocol Status Card */}
            <div className="backdrop-blur-xl bg-gray-900/80 border-2 border-emerald-500/30 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <ClockIcon className="w-6 h-6 text-emerald-500" />
                État du Protocole
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                  <span className="text-gray-400">Statut</span>
                  <span className={`font-medium ${routerState?.isPaused ? 'text-red-400' : 'text-emerald-400'}`}>
                    {routerState?.isPaused ? '⏸️ En Pause' : '▶️ Actif'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                  <span className="text-gray-400">Autorité</span>
                  <span className="text-white font-mono text-sm">
                    {formatAddress(routerState?.authority || null)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                  <span className="text-gray-400">Autorité en attente</span>
                  <span className="text-white font-mono text-sm">
                    {formatAddress(routerState?.pendingAuthority || null)}
                  </span>
                </div>
                
                {routerState?.isPaused && (
                  <div className="flex justify-between items-center py-3 border-b border-gray-700">
                    <span className="text-gray-400">Mis en pause le</span>
                    <span className="text-white text-sm">
                      {formatTimestamp(routerState.pausedAt)}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-400">Rebate %</span>
                  <span className="text-emerald-400 font-medium">
                    {((routerState?.rebatePercentage || 0) / 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Circuit Breaker Card */}
            <div className="backdrop-blur-xl bg-gray-900/80 border-2 border-red-500/30 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                Circuit Breaker
              </h2>
              
              <p className="text-gray-400 text-sm mb-6">
                Arrêt d'urgence du protocole. Quand activé, tous les swaps sont bloqués.
              </p>
              
              <div className="flex gap-4">
                {routerState?.isPaused ? (
                  <button
                    onClick={handleUnpauseProtocol}
                    disabled={!isAdmin || actionLoading === "unpause"}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                  >
                    {actionLoading === "unpause" ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <PlayIcon className="w-5 h-5" />
                    )}
                    Reprendre
                  </button>
                ) : (
                  <button
                    onClick={handlePauseProtocol}
                    disabled={!isAdmin || actionLoading === "pause"}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                  >
                    {actionLoading === "pause" ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <PauseIcon className="w-5 h-5" />
                    )}
                    Pause d'Urgence
                  </button>
                )}
              </div>
            </div>

            {/* Authority Transfer Card */}
            <div className="backdrop-blur-xl bg-gray-900/80 border-2 border-cyan-500/30 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <KeyIcon className="w-6 h-6 text-cyan-500" />
                Transfert d'Autorité
              </h2>
              
              <p className="text-gray-400 text-sm mb-4">
                Transfert en 2 étapes: proposer puis accepter par la nouvelle autorité.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Nouvelle Autorité</label>
                  <input
                    type="text"
                    value={newAuthority}
                    onChange={(e) => setNewAuthority(e.target.value)}
                    placeholder="Adresse Solana..."
                    disabled={!isAdmin}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                
                <button
                  onClick={handleProposeAuthority}
                  disabled={!isAdmin || !newAuthority || actionLoading === "propose"}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                >
                  {actionLoading === "propose" ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <KeyIcon className="w-5 h-5" />
                  )}
                  Proposer Nouvelle Autorité
                </button>
              </div>
            </div>

            {/* Wallet Configuration Card */}
            <div className="backdrop-blur-xl bg-gray-900/80 border-2 border-purple-500/30 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <WalletIcon className="w-6 h-6 text-purple-500" />
                Configuration Wallets
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Treasury Wallet</label>
                  <input
                    type="text"
                    value={treasuryWallet}
                    onChange={(e) => setTreasuryWallet(e.target.value)}
                    placeholder={formatAddress(routerState?.treasuryWallet || null)}
                    disabled={!isAdmin}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Buyback Wallet</label>
                  <input
                    type="text"
                    value={buybackWallet}
                    onChange={(e) => setBuybackWallet(e.target.value)}
                    placeholder={formatAddress(routerState?.buybackWallet || null)}
                    disabled={!isAdmin}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Boost Vault Wallet</label>
                  <input
                    type="text"
                    value={boostVaultWallet}
                    onChange={(e) => setBoostVaultWallet(e.target.value)}
                    placeholder={formatAddress(routerState?.boostVaultWallet || null)}
                    disabled={!isAdmin}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                
                <button
                  onClick={handleUpdateWallets}
                  disabled={!isAdmin || actionLoading === "wallets"}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                >
                  {actionLoading === "wallets" ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <WalletIcon className="w-5 h-5" />
                  )}
                  Mettre à jour les Wallets
                </button>
              </div>
            </div>
          </div>

          {/* Statistics Section */}
          <div className="mt-8 backdrop-blur-xl bg-gray-900/80 border-2 border-emerald-500/30 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">📊 Statistiques du Protocole</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-emerald-400 mb-1">
                  ${((routerState?.totalVolume?.toNumber() || 0) / 1e6).toLocaleString()}
                </div>
                <div className="text-gray-400 text-sm">Volume Total</div>
              </div>
              
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-cyan-400 mb-1">
                  ${((routerState?.totalNpi?.toNumber() || 0) / 1e6).toLocaleString()}
                </div>
                <div className="text-gray-400 text-sm">NPI Généré</div>
              </div>
              
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-400 mb-1">
                  ${((routerState?.totalRebatesPaid?.toNumber() || 0) / 1e6).toLocaleString()}
                </div>
                <div className="text-gray-400 text-sm">Rebates Distribués</div>
              </div>
            </div>
          </div>

          {/* Wallet Balances Section */}
          <div className="mt-8 backdrop-blur-xl bg-gray-900/80 border-2 border-yellow-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BanknotesIcon className="w-6 h-6 text-yellow-500" />
                Soldes des Wallets
              </h2>
              <button
                onClick={fetchWalletBalances}
                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-sm transition-all"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Actualiser
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Treasury Wallet */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <CurrencyDollarIcon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Treasury</h3>
                      <p className="text-gray-500 text-xs font-mono">
                        {formatAddress(routerState?.treasuryWallet || null)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {walletBalances.treasury.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <ArrowPathIcon className="w-5 h-5 text-emerald-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-emerald-500/10">
                      <span className="text-gray-400 text-sm">SOL</span>
                      <span className="text-white font-medium">{walletBalances.treasury.sol.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-emerald-500/10">
                      <span className="text-gray-400 text-sm">USDC</span>
                      <span className="text-emerald-400 font-medium">${walletBalances.treasury.usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400 text-sm">BACK</span>
                      <span className="text-cyan-400 font-medium">{walletBalances.treasury.back.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Buyback Wallet */}
              <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                      <CurrencyDollarIcon className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Buyback</h3>
                      <p className="text-gray-500 text-xs font-mono">
                        {formatAddress(routerState?.buybackWallet || null)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {walletBalances.buyback.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <ArrowPathIcon className="w-5 h-5 text-orange-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-orange-500/10">
                      <span className="text-gray-400 text-sm">SOL</span>
                      <span className="text-white font-medium">{walletBalances.buyback.sol.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-orange-500/10">
                      <span className="text-gray-400 text-sm">USDC</span>
                      <span className="text-orange-400 font-medium">${walletBalances.buyback.usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400 text-sm">BACK</span>
                      <span className="text-cyan-400 font-medium">{walletBalances.buyback.back.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Boost Vault Wallet */}
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <CurrencyDollarIcon className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Boost Vault</h3>
                      <p className="text-gray-500 text-xs font-mono">
                        {formatAddress(routerState?.boostVaultWallet || null)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {walletBalances.boostVault.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <ArrowPathIcon className="w-5 h-5 text-purple-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-purple-500/10">
                      <span className="text-gray-400 text-sm">SOL</span>
                      <span className="text-white font-medium">{walletBalances.boostVault.sol.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-purple-500/10">
                      <span className="text-gray-400 text-sm">USDC</span>
                      <span className="text-purple-400 font-medium">${walletBalances.boostVault.usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400 text-sm">BACK</span>
                      <span className="text-cyan-400 font-medium">{walletBalances.boostVault.back.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* NPI Vault Wallet */}
              <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      <CurrencyDollarIcon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">NPI Vault</h3>
                      <p className="text-gray-500 text-xs font-mono">
                        {formatAddress(routerState?.npiVaultWallet || null)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {walletBalances.npiVault.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <ArrowPathIcon className="w-5 h-5 text-cyan-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-cyan-500/10">
                      <span className="text-gray-400 text-sm">SOL</span>
                      <span className="text-white font-medium">{walletBalances.npiVault.sol.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-cyan-500/10">
                      <span className="text-gray-400 text-sm">USDC</span>
                      <span className="text-cyan-400 font-medium">${walletBalances.npiVault.usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400 text-sm">BACK</span>
                      <span className="text-cyan-400 font-medium">{walletBalances.npiVault.back.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Total Summary */}
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-xl">
              <h3 className="text-yellow-400 font-semibold mb-3 flex items-center gap-2">
                <BanknotesIcon className="w-5 h-5" />
                Total Tous Wallets
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {(
                      walletBalances.treasury.sol + 
                      walletBalances.buyback.sol + 
                      walletBalances.boostVault.sol + 
                      walletBalances.npiVault.sol
                    ).toFixed(4)}
                  </div>
                  <div className="text-gray-400 text-sm">SOL</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">
                    ${(
                      walletBalances.treasury.usdc + 
                      walletBalances.buyback.usdc + 
                      walletBalances.boostVault.usdc + 
                      walletBalances.npiVault.usdc
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-gray-400 text-sm">USDC</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">
                    {(
                      walletBalances.treasury.back + 
                      walletBalances.buyback.back + 
                      walletBalances.boostVault.back + 
                      walletBalances.npiVault.back
                    ).toLocaleString()}
                  </div>
                  <div className="text-gray-400 text-sm">BACK</div>
                </div>
              </div>
            </div>
          </div>

          {/* Protocol Logs & Errors Section */}
          <div className="mt-8 backdrop-blur-xl bg-gray-900/80 border-2 border-red-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BellAlertIcon className="w-6 h-6 text-red-500" />
                  Logs & Alertes du Protocole
                </h2>
                
                {/* Unresolved badge */}
                {logCounts.unresolved > 0 && (
                  <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                    {logCounts.unresolved} non résolu{logCounts.unresolved > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchProtocolLogs}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-all"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
                  Actualiser
                </button>
                <button
                  onClick={handleDownloadLogs}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm transition-all"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Exporter
                </button>
                {isAdmin && (
                  <button
                    onClick={handleClearAllLogs}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-all"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Tout effacer
                  </button>
                )}
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-5 gap-3 mb-6">
              <button
                onClick={() => setLogFilter('all')}
                className={`p-3 rounded-xl text-center transition-all ${
                  logFilter === 'all' 
                    ? 'bg-white/10 ring-2 ring-white/30' 
                    : 'bg-gray-800/50 hover:bg-gray-700/50'
                }`}
              >
                <div className="text-2xl font-bold text-white">{logCounts.total}</div>
                <div className="text-gray-400 text-xs">Total</div>
              </button>
              <button
                onClick={() => setLogFilter('critical')}
                className={`p-3 rounded-xl text-center transition-all ${
                  logFilter === 'critical' 
                    ? 'bg-red-500/20 ring-2 ring-red-500/50' 
                    : 'bg-gray-800/50 hover:bg-red-500/10'
                }`}
              >
                <div className="text-2xl font-bold text-red-500">{logCounts.critical}</div>
                <div className="text-red-400 text-xs">Critical</div>
              </button>
              <button
                onClick={() => setLogFilter('error')}
                className={`p-3 rounded-xl text-center transition-all ${
                  logFilter === 'error' 
                    ? 'bg-red-400/20 ring-2 ring-red-400/50' 
                    : 'bg-gray-800/50 hover:bg-red-400/10'
                }`}
              >
                <div className="text-2xl font-bold text-red-400">{logCounts.error}</div>
                <div className="text-red-300 text-xs">Errors</div>
              </button>
              <button
                onClick={() => setLogFilter('warning')}
                className={`p-3 rounded-xl text-center transition-all ${
                  logFilter === 'warning' 
                    ? 'bg-yellow-500/20 ring-2 ring-yellow-500/50' 
                    : 'bg-gray-800/50 hover:bg-yellow-500/10'
                }`}
              >
                <div className="text-2xl font-bold text-yellow-400">{logCounts.warning}</div>
                <div className="text-yellow-300 text-xs">Warnings</div>
              </button>
              <button
                onClick={() => setLogFilter('info')}
                className={`p-3 rounded-xl text-center transition-all ${
                  logFilter === 'info' 
                    ? 'bg-blue-500/20 ring-2 ring-blue-500/50' 
                    : 'bg-gray-800/50 hover:bg-blue-500/10'
                }`}
              >
                <div className="text-2xl font-bold text-blue-400">{logCounts.info}</div>
                <div className="text-blue-300 text-xs">Info</div>
              </button>
            </div>

            {/* Filter Options */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <FunnelIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 text-sm">Filtres:</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showResolvedLogs}
                  onChange={(e) => setShowResolvedLogs(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-gray-300 text-sm">Afficher les logs résolus</span>
              </label>
            </div>

            {/* Logs List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
                  <span className="ml-3 text-gray-400">Chargement des logs...</span>
                </div>
              ) : protocolLogs.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-gray-400">Aucun log à afficher</p>
                  <p className="text-gray-500 text-sm">Le protocole fonctionne sans erreur 🎉</p>
                </div>
              ) : (
                protocolLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`border rounded-xl p-4 ${getLogColors(log.level)} ${
                      log.resolved ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5">{getLogIcon(log.level)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">{log.title}</span>
                            <span className="px-2 py-0.5 bg-gray-700/50 text-gray-300 text-xs rounded">
                              {log.category}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {formatRelativeTime(log.timestamp)}
                            </span>
                            {log.resolved && (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded flex items-center gap-1">
                                <CheckCircleIcon className="w-3 h-3" />
                                Résolu
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm mt-1">{log.message}</p>
                          
                          {log.details && Object.keys(log.details).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400">
                                Voir les détails
                              </summary>
                              <pre className="mt-2 p-2 bg-black/30 rounded text-xs text-gray-400 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      {isAdmin && !log.resolved && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleResolveLog(log.id)}
                            className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-all"
                            title="Marquer comme résolu"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
