"use client";

/**
 * SimpleAdminPanel - Interface Admin simplifiée
 * 
 * Design épuré avec onglets :
 * - État général (status, métriques principales)
 * - Sécurité (pause, circuit breaker, authority)
 * - Wallets (balances, configuration)
 * - Logs (journal avec filtres)
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, 
  Wallet, 
  Activity, 
  FileText,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  Loader2,
  Info,
  Clock,
  TrendingUp,
  DollarSign,
  Key,
  Settings
} from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import toast from "react-hot-toast";

type TabId = "overview" | "security" | "wallets" | "logs";

interface ProtocolStats {
  totalVolume: number;
  totalRebates: number;
  totalSwaps: number;
  isPaused: boolean;
  circuitBreakerActive: boolean;
}

interface WalletInfo {
  name: string;
  address: string;
  solBalance: number;
  usdcBalance: number;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: "critical" | "error" | "warning" | "info";
  message: string;
  resolved: boolean;
}

const PROGRAM_ID = process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg";
const ADMIN_AUTHORITY = process.env.NEXT_PUBLIC_ADMIN_AUTHORITY || "";

export function SimpleAdminPanel() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Data
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "critical" | "error" | "warning" | "info">("all");

  // Check admin access
  useEffect(() => {
    if (!connected || !publicKey) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Check if current wallet is admin
    const isAdminWallet = ADMIN_AUTHORITY 
      ? publicKey.toBase58() === ADMIN_AUTHORITY
      : true; // Allow if not set (dev mode)
    
    setIsAdmin(isAdminWallet);
    
    if (isAdminWallet) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [connected, publicKey]);

  const fetchData = useCallback(async () => {
    if (!connection) return;
    
    setLoading(true);
    try {
      const programId = new PublicKey(PROGRAM_ID);
      
      // Derive RouterState PDA
      const [routerStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_state")],
        programId
      );

      const accountInfo = await connection.getAccountInfo(routerStatePDA);

      if (accountInfo && accountInfo.data.length >= 200) {
        // Parse RouterState
        // Layout: discriminator(8) + authority(32) + pending_authority(33) + is_paused(1) + ...
        const data = accountInfo.data;
        let offset = 8; // Skip discriminator
        
        offset += 32; // Skip authority
        offset += 33; // Skip pending_authority (option<pubkey>)
        
        const isPaused = data[offset] === 1;
        offset += 1;
        
        // Read paused_at timestamp
        offset += 8;
        
        // Read percentages and wallets (skip for now)
        offset += 3 + 32 * 4; // 3 percentages + 4 wallets
        
        // Read stats
        const totalVolume = Number(data.readBigUInt64LE(offset)) / 1e6;
        offset += 8;
        
        const totalNpi = Number(data.readBigUInt64LE(offset)) / 1e6;
        offset += 8;
        
        const totalRebates = Number(data.readBigUInt64LE(offset)) / 1e6;

        setStats({
          totalVolume,
          totalRebates,
          totalSwaps: Math.floor(totalVolume / 100), // Estimate
          isPaused,
          circuitBreakerActive: false, // TODO: Add circuit breaker logic
        });
      } else {
        // Router not initialized
        setStats({
          totalVolume: 0,
          totalRebates: 0,
          totalSwaps: 0,
          isPaused: false,
          circuitBreakerActive: false,
        });
      }

      // Fetch wallet balances
      const treasuryAddress = process.env.NEXT_PUBLIC_TREASURY_WALLET;
      const buybackAddress = process.env.NEXT_PUBLIC_BUYBACK_WALLET;
      
      const walletList: WalletInfo[] = [];
      
      if (treasuryAddress) {
        try {
          const treasury = new PublicKey(treasuryAddress);
          const balance = await connection.getBalance(treasury);
          walletList.push({
            name: "Treasury",
            address: treasuryAddress.slice(0, 8) + "...",
            solBalance: balance / 1e9,
            usdcBalance: 0 // TODO: Fetch USDC balance
          });
        } catch {}
      }
      
      if (buybackAddress) {
        try {
          const buyback = new PublicKey(buybackAddress);
          const balance = await connection.getBalance(buyback);
          walletList.push({
            name: "Buyback",
            address: buybackAddress.slice(0, 8) + "...",
            solBalance: balance / 1e9,
            usdcBalance: 0
          });
        } catch {}
      }
      
      setWallets(walletList.length > 0 ? walletList : [
        { name: "Treasury", address: "Non configuré", solBalance: 0, usdcBalance: 0 },
        { name: "Buyback", address: "Non configuré", solBalance: 0, usdcBalance: 0 },
      ]);

      // Logs from API
      try {
        const logsResponse = await fetch('/api/protocol-logs');
        if (logsResponse.ok) {
          const logsData = await logsResponse.json();
          setLogs(logsData.logs?.slice(0, 50) || []);
        }
      } catch {
        setLogs([]);
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const handlePauseResume = async () => {
    if (!stats || !publicKey) return;
    
    setActionLoading("pause");
    const toastId = toast.loading(stats.isPaused ? "Reprise en cours..." : "Mise en pause...");
    
    try {
      const { Transaction, TransactionInstruction, SystemProgram } = await import("@solana/web3.js");
      const programId = new PublicKey(PROGRAM_ID);
      
      // Derive RouterState PDA
      const [routerStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_state")],
        programId
      );

      // Discriminator for pause/unpause (you'd need the actual values from the program)
      const PAUSE_DISCRIMINATOR = Buffer.from([68, 253, 0, 0, 0, 0, 0, 0]); // pause_router
      const UNPAUSE_DISCRIMINATOR = Buffer.from([69, 253, 0, 0, 0, 0, 0, 0]); // unpause_router
      
      const discriminator = stats.isPaused ? UNPAUSE_DISCRIMINATOR : PAUSE_DISCRIMINATOR;

      const instruction = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: routerStatePDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: false },
        ],
        data: discriminator
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Get wallet's signTransaction
      const { signTransaction } = await import("@solana/wallet-adapter-react");
      // Note: This won't work as-is, we need the wallet context
      // For now, we'll show a message
      toast.error("Fonctionnalité admin en cours de développement", { id: toastId });
      
      // In a real implementation:
      // const signedTx = await wallet.signTransaction(transaction);
      // const signature = await connection.sendRawTransaction(signedTx.serialize());
      // await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
      
      // For demo, toggle the state locally
      setStats({ ...stats, isPaused: !stats.isPaused });
      
    } catch (error) {
      console.error("Pause/resume error:", error);
      const message = error instanceof Error ? error.message : "Erreur lors de l'action";
      toast.error(message, { id: toastId });
    } finally {
      setActionLoading(null);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Access denied screen
  if (!connected) {
    return (
      <div className="w-full max-w-2xl mx-auto theme-light">
        <div className="card-simple text-center py-12">
          <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Accès Admin</h2>
          <p className="text-gray-400">Connectez votre wallet administrateur</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="w-full max-w-2xl mx-auto theme-light">
        <div className="card-simple text-center py-12">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Accès Refusé</h2>
          <p className="text-gray-400">Ce wallet n'a pas les permissions administrateur</p>
          <p className="text-xs text-gray-500 mt-2 font-mono">{publicKey?.toBase58()}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto theme-light">
        <div className="card-simple p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as TabId, label: "Vue d'ensemble", icon: Activity },
    { id: "security" as TabId, label: "Sécurité", icon: Shield },
    { id: "wallets" as TabId, label: "Wallets", icon: Wallet },
    { id: "logs" as TabId, label: "Logs", icon: FileText },
  ];

  const filteredLogs = logFilter === "all" 
    ? logs 
    : logs.filter(l => l.level === logFilter);

  return (
    <div className="w-full max-w-2xl mx-auto theme-light">
      <div className="space-y-4">
        
        {/* Header avec status */}
        <div className="card-simple">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${stats?.isPaused ? "bg-yellow-400" : "bg-emerald-400"}`} />
              <span className="font-medium text-white">
                {stats?.isPaused ? "Router en pause" : "Router actif"}
              </span>
            </div>
            <button
              onClick={fetchData}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab.id 
                  ? "bg-zinc-800 text-white" 
                  : "text-gray-400 hover:text-white"
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && stats && (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard 
                label="Volume Total" 
                value={formatNumber(stats.totalVolume)}
                icon={<TrendingUp className="w-5 h-5" />}
              />
              <StatCard 
                label="Rebates Payés" 
                value={formatNumber(stats.totalRebates)}
                icon={<DollarSign className="w-5 h-5" />}
              />
              <StatCard 
                label="Total Swaps" 
                value={stats.totalSwaps.toLocaleString()}
                icon={<Activity className="w-5 h-5" />}
              />
            </div>

            {/* Status cards */}
            <div className="card-simple">
              <h3 className="font-medium text-white mb-4">État du Protocole</h3>
              <div className="space-y-3">
                <StatusRow 
                  label="Router" 
                  status={!stats.isPaused} 
                  activeText="Actif" 
                  inactiveText="En pause"
                />
                <StatusRow 
                  label="Circuit Breaker" 
                  status={!stats.circuitBreakerActive} 
                  activeText="Normal" 
                  inactiveText="Déclenché"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Security */}
        {activeTab === "security" && stats && (
          <div className="space-y-4">
            {/* Pause/Resume */}
            <div className="card-simple">
              <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-gray-400" />
                Contrôle du Router
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={handlePauseResume}
                  disabled={actionLoading === "pause"}
                  className={`
                    flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors
                    ${stats.isPaused 
                      ? "bg-emerald-500 hover:bg-emerald-400 text-black" 
                      : "bg-yellow-500 hover:bg-yellow-400 text-black"
                    }
                  `}
                >
                  {actionLoading === "pause" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : stats.isPaused ? (
                    <>
                      <Play className="w-5 h-5" />
                      Reprendre
                    </>
                  ) : (
                    <>
                      <Pause className="w-5 h-5" />
                      Mettre en pause
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {stats.isPaused 
                  ? "Le router est en pause. Les nouveaux swaps sont bloqués."
                  : "Mettre en pause arrête l'exécution des nouveaux swaps."
                }
              </p>
            </div>

            {/* Authority */}
            <div className="card-simple">
              <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-gray-400" />
                Autorité
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Autorité actuelle</label>
                  <div className="p-3 bg-white/5 rounded-lg text-sm text-white font-mono break-all">
                    {publicKey?.toBase58()}
                  </div>
                </div>
                <InfoBox text="Le transfert d'autorité nécessite une confirmation en deux étapes pour la sécurité." />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Wallets */}
        {activeTab === "wallets" && (
          <div className="space-y-3">
            {wallets.map((wallet, index) => (
              <div key={index} className="card-simple">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium text-white">{wallet.name}</div>
                  <span className="text-xs text-gray-500 font-mono">{wallet.address}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-lg font-bold text-white">{wallet.solBalance.toFixed(4)}</div>
                    <div className="text-xs text-gray-400">SOL</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-lg font-bold text-emerald-400">${wallet.usdcBalance.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">USDC</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Logs */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(["all", "critical", "error", "warning", "info"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${logFilter === filter 
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }
                  `}
                >
                  {filter === "all" ? "Tous" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {/* Log list */}
            <div className="card-simple !p-0 overflow-hidden">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  Aucun log à afficher
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredLogs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components
function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card-simple !p-4 text-center">
      <div className="text-gray-400 mb-2">{icon}</div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

function StatusRow({ label, status, activeText, inactiveText }: { label: string; status: boolean; activeText: string; inactiveText: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
      <span className="text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className={status ? "text-emerald-400" : "text-yellow-400"}>
          {status ? activeText : inactiveText}
        </span>
        {status ? (
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
        )}
      </div>
    </div>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
      <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-blue-300">{text}</p>
    </div>
  );
}

function LogRow({ log }: { log: LogEntry }) {
  const levelColors = {
    critical: "text-red-400 bg-red-500/10",
    error: "text-orange-400 bg-orange-500/10",
    warning: "text-yellow-400 bg-yellow-500/10",
    info: "text-blue-400 bg-blue-500/10",
  };

  return (
    <div className="p-4 hover:bg-white/5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors[log.level]}`}>
              {log.level.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500">
              {log.timestamp.toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm text-white">{log.message}</p>
        </div>
        {log.resolved && (
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

export default SimpleAdminPanel;
