"use client";

/**
 * AdminConfigPanel - Configuration du RouterState sur Mainnet
 * 
 * Ce composant permet de :
 * 1. update_wallets - Configurer les wallets (treasury, buyback, boost, npi)
 * 2. initialize_config - Initialiser la configuration des pourcentages
 * 3. initialize_rebate_vault - Créer le vault USDC pour les rebates
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Settings,
  Wallet,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Percent,
  Database
} from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import toast from "react-hot-toast";

// Lazy-loaded Constants to avoid SSR issues
let _programId: PublicKey | null = null;
function getProgramId(): PublicKey {
  if (!_programId) {
    _programId = new PublicKey(process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "5K7kKoYd1E2S2gycBMeAeyXnxdbVgAEqJWKERwW8FTMf");
  }
  return _programId;
}

let _usdcMint: PublicKey | null = null;
function getUsdcMint(): PublicKey {
  if (!_usdcMint) {
    _usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  }
  return _usdcMint;
}

const ADMIN_AUTHORITY = process.env.NEXT_PUBLIC_ADMIN_AUTHORITY || "";

// Discriminators from IDL
const DISCRIMINATORS = {
  updateWallets: Buffer.from([161, 63, 139, 31, 207, 236, 60, 42]),
  initializeConfig: Buffer.from([208, 127, 21, 1, 194, 190, 196, 70]),
  initializeRebateVault: Buffer.from([229, 225, 212, 22, 49, 72, 54, 244]),
};

interface RouterStateInfo {
  authority: string;
  treasuryWallet: string;
  buybackWallet: string;
  boostVault: string;
  npiVault: string;
  isPaused: boolean;
  rebatePercent: number;
  treasuryPercent: number;
  boostPercent: number;
  totalVolume: number;
  totalFees: number;
  totalRebates: number;
}

interface ConfigStatus {
  routerStateExists: boolean;
  configExists: boolean;
  rebateVaultExists: boolean;
  walletsConfigured: boolean;
}

export function AdminConfigPanel() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [routerState, setRouterState] = useState<RouterStateInfo | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    routerStateExists: false,
    configExists: false,
    rebateVaultExists: false,
    walletsConfigured: false,
  });

  // PDAs
  const [routerStatePda, setRouterStatePda] = useState<PublicKey | null>(null);
  const [routerConfigPda, setRouterConfigPda] = useState<PublicKey | null>(null);
  const [rebateVaultPda, setRebateVaultPda] = useState<PublicKey | null>(null);

  // Check admin access and fetch data
  useEffect(() => {
    if (!connected || !publicKey) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const isAdminWallet = ADMIN_AUTHORITY 
      ? publicKey.toBase58() === ADMIN_AUTHORITY
      : true;
    
    setIsAdmin(isAdminWallet);
    
    if (isAdminWallet) {
      // Derive PDAs
      const programId = getProgramId();
      const [statePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_state")],
        programId
      );
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_config")],
        programId
      );
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("rebate_vault"), statePda.toBuffer()],
        programId
      );
      
      setRouterStatePda(statePda);
      setRouterConfigPda(configPda);
      setRebateVaultPda(vaultPda);
      
      fetchData(statePda, configPda, vaultPda);
    } else {
      setLoading(false);
    }
  }, [connected, publicKey, connection]);

  const fetchData = useCallback(async (
    statePda: PublicKey, 
    configPda: PublicKey, 
    vaultPda: PublicKey
  ) => {
    if (!connection) return;
    
    setLoading(true);
    try {
      // Check RouterState
      const stateInfo = await connection.getAccountInfo(statePda);
      const configInfo = await connection.getAccountInfo(configPda);
      const vaultInfo = await connection.getAccountInfo(vaultPda);
      
      const status: ConfigStatus = {
        routerStateExists: !!stateInfo,
        configExists: !!configInfo,
        rebateVaultExists: !!vaultInfo,
        walletsConfigured: false,
      };

      if (stateInfo && stateInfo.data.length >= 180) {
        const data = stateInfo.data;
        let offset = 8; // Skip discriminator
        
        const authority = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        
        const treasuryWallet = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        
        const buybackWallet = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        
        const boostVault = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        
        const npiVault = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        
        const isPaused = data[offset] === 1;
        offset += 1;
        
        const rebatePercent = data.readUInt16LE(offset);
        offset += 2;
        
        const treasuryPercent = data.readUInt16LE(offset);
        offset += 2;
        
        const boostPercent = data.readUInt16LE(offset);
        offset += 2;
        
        const totalVolume = Number(data.readBigUInt64LE(offset)) / 1e6;
        offset += 8;
        
        const totalFees = Number(data.readBigUInt64LE(offset)) / 1e6;
        offset += 8;
        
        const totalRebates = Number(data.readBigUInt64LE(offset)) / 1e6;

        // Check if wallets are configured (not default/system program)
        const systemProgram = "11111111111111111111111111111111";
        status.walletsConfigured = 
          treasuryWallet.toBase58() !== systemProgram &&
          buybackWallet.toBase58() !== systemProgram;

        setRouterState({
          authority: authority.toBase58(),
          treasuryWallet: treasuryWallet.toBase58(),
          buybackWallet: buybackWallet.toBase58(),
          boostVault: boostVault.toBase58(),
          npiVault: npiVault.toBase58(),
          isPaused,
          rebatePercent: rebatePercent / 100,
          treasuryPercent: treasuryPercent / 100,
          boostPercent: boostPercent / 100,
          totalVolume,
          totalFees,
          totalRebates,
        });
      }

      setConfigStatus(status);
    } catch (error) {
      console.error("Error fetching config data:", error);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const handleRefresh = () => {
    if (routerStatePda && routerConfigPda && rebateVaultPda) {
      fetchData(routerStatePda, routerConfigPda, rebateVaultPda);
    }
  };

  // ========== STEP 1: Update Wallets ==========
  const handleUpdateWallets = async () => {
    if (!publicKey || !sendTransaction || !routerStatePda) return;
    
    setActionLoading("wallets");
    const toastId = toast.loading("Configuration des wallets...");
    
    try {
      // Use authority wallet as destination for all wallets
      const targetWallet = publicKey;
      
      // Build instruction data
      // Option<Pubkey> = 1 byte (Some=1) + 32 bytes pubkey
      const data = Buffer.alloc(8 + 4 * 33);
      let offset = 0;
      
      DISCRIMINATORS.updateWallets.copy(data, offset);
      offset += 8;
      
      // Treasury (Some)
      data.writeUInt8(1, offset); offset += 1;
      targetWallet.toBuffer().copy(data, offset); offset += 32;
      
      // Buyback (Some)
      data.writeUInt8(1, offset); offset += 1;
      targetWallet.toBuffer().copy(data, offset); offset += 32;
      
      // Boost Vault (Some)
      data.writeUInt8(1, offset); offset += 1;
      targetWallet.toBuffer().copy(data, offset); offset += 32;
      
      // NPI Vault (Some)
      data.writeUInt8(1, offset); offset += 1;
      targetWallet.toBuffer().copy(data, offset); offset += 32;
      
      const instruction = new TransactionInstruction({
        programId: getProgramId(),
        keys: [
          { pubkey: routerStatePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: false },
        ],
        data,
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Use sendTransaction instead of signTransaction for better wallet compatibility
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      toast.success("Wallets configurés!", { id: toastId });
      handleRefresh();
    } catch (error) {
      console.error("Update wallets error:", error);
      const message = error instanceof Error ? error.message : "Erreur";
      toast.error(message, { id: toastId });
    } finally {
      setActionLoading(null);
    }
  };

  // ========== STEP 2: Initialize Config ==========
  const handleInitializeConfig = async () => {
    if (!publicKey || !sendTransaction || !routerStatePda || !routerConfigPda) return;
    
    setActionLoading("config");
    const toastId = toast.loading("Initialisation de la configuration...");
    
    try {
      const instruction = new TransactionInstruction({
        programId: getProgramId(),
        keys: [
          { pubkey: routerConfigPda, isSigner: false, isWritable: true },
          { pubkey: routerStatePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: DISCRIMINATORS.initializeConfig,
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Use sendTransaction for better wallet compatibility
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      toast.success("Configuration initialisée! (70% rebate, 15% treasury, 15% boost)", { id: toastId });
      handleRefresh();
    } catch (error) {
      console.error("Initialize config error:", error);
      const message = error instanceof Error ? error.message : "Erreur";
      toast.error(message, { id: toastId });
    } finally {
      setActionLoading(null);
    }
  };

  // ========== STEP 3: Initialize Rebate Vault ==========
  const handleInitializeRebateVault = async () => {
    if (!publicKey || !sendTransaction || !routerStatePda || !rebateVaultPda) return;
    
    setActionLoading("vault");
    const toastId = toast.loading("Création du Rebate Vault USDC...");
    
    try {
      const instruction = new TransactionInstruction({
        programId: getProgramId(),
        keys: [
          { pubkey: routerStatePda, isSigner: false, isWritable: true },
          { pubkey: rebateVaultPda, isSigner: false, isWritable: true },
          { pubkey: getUsdcMint(), isSigner: false, isWritable: false },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: DISCRIMINATORS.initializeRebateVault,
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Use sendTransaction for better wallet compatibility
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      toast.success("Rebate Vault créé!", { id: toastId });
      handleRefresh();
    } catch (error) {
      console.error("Initialize rebate vault error:", error);
      const message = error instanceof Error ? error.message : "Erreur";
      toast.error(message, { id: toastId });
    } finally {
      setActionLoading(null);
    }
  };

  // Access denied
  if (!connected) {
    return (
      <div className="card-simple text-center py-12">
        <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Configuration Admin</h2>
        <p className="text-gray-400">Connectez votre wallet administrateur</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card-simple text-center py-12">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Accès Refusé</h2>
        <p className="text-gray-400">Ce wallet n'est pas l'administrateur</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-simple p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      </div>
    );
  }

  const allConfigured = configStatus.walletsConfigured && 
    configStatus.configExists && 
    configStatus.rebateVaultExists;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card-simple">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Configuration Mainnet</h2>
              <p className="text-sm text-gray-400">Configurer le RouterState pour les rebates</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="card-simple">
        <h3 className="font-medium text-white mb-4">État de la Configuration</h3>
        <div className="space-y-3">
          <StatusItem 
            label="RouterState" 
            status={configStatus.routerStateExists}
            description={routerStatePda?.toBase58().slice(0, 20) + "..."}
          />
          <StatusItem 
            label="Wallets configurés" 
            status={configStatus.walletsConfigured}
            description={configStatus.walletsConfigured ? "Treasury, Buyback, Boost, NPI" : "Non configurés"}
          />
          <StatusItem 
            label="Configuration (pourcentages)" 
            status={configStatus.configExists}
            description={configStatus.configExists ? "70% rebate, 15% treasury, 15% boost" : "Non initialisée"}
          />
          <StatusItem 
            label="Rebate Vault USDC" 
            status={configStatus.rebateVaultExists}
            description={rebateVaultPda?.toBase58().slice(0, 20) + "..."}
          />
        </div>

        {allConfigured && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Configuration complète! Les rebates sont opérationnels.</span>
            </div>
          </div>
        )}
      </div>

      {/* Current Values */}
      {routerState && (
        <div className="card-simple">
          <h3 className="font-medium text-white mb-4">Valeurs Actuelles</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="text-gray-400 mb-1">Authority</div>
              <div className="text-white font-mono text-xs break-all">
                {routerState.authority.slice(0, 20)}...
              </div>
            </div>
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="text-gray-400 mb-1">Status</div>
              <div className={routerState.isPaused ? "text-yellow-400" : "text-emerald-400"}>
                {routerState.isPaused ? "En pause" : "Actif"}
              </div>
            </div>
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="text-gray-400 mb-1">Rebate %</div>
              <div className="text-white">{routerState.rebatePercent}%</div>
            </div>
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="text-gray-400 mb-1">Treasury %</div>
              <div className="text-white">{routerState.treasuryPercent}%</div>
            </div>
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="text-gray-400 mb-1">Volume Total</div>
              <div className="text-white">${routerState.totalVolume.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="text-gray-400 mb-1">Rebates Distribués</div>
              <div className="text-emerald-400">${routerState.totalRebates.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="card-simple">
        <h3 className="font-medium text-white mb-4">Actions de Configuration</h3>
        <div className="space-y-3">
          
          {/* Step 1: Update Wallets */}
          <ActionButton
            onClick={handleUpdateWallets}
            loading={actionLoading === "wallets"}
            disabled={!configStatus.routerStateExists || configStatus.walletsConfigured}
            completed={configStatus.walletsConfigured}
            icon={<Wallet className="w-5 h-5" />}
            label="1. Configurer les Wallets"
            description="Configure treasury, buyback, boost vault, npi vault vers votre wallet"
          />

          {/* Step 2: Initialize Config */}
          <ActionButton
            onClick={handleInitializeConfig}
            loading={actionLoading === "config"}
            disabled={!configStatus.routerStateExists || configStatus.configExists}
            completed={configStatus.configExists}
            icon={<Percent className="w-5 h-5" />}
            label="2. Initialiser Configuration"
            description="Configure les pourcentages: 70% rebate, 15% treasury, 15% boost"
          />

          {/* Step 3: Initialize Rebate Vault */}
          <ActionButton
            onClick={handleInitializeRebateVault}
            loading={actionLoading === "vault"}
            disabled={!configStatus.routerStateExists || configStatus.rebateVaultExists}
            completed={configStatus.rebateVaultExists}
            icon={<Database className="w-5 h-5" />}
            label="3. Créer Rebate Vault"
            description="Crée le vault USDC pour stocker les rebates à distribuer"
          />
        </div>
      </div>

      {/* Warning */}
      {!configStatus.routerStateExists && (
        <div className="card-simple border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-400">RouterState non trouvé</h4>
              <p className="text-sm text-gray-400 mt-1">
                Le RouterState doit d'abord être initialisé via l'instruction `initialize` du programme.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function StatusItem({ 
  label, 
  status, 
  description 
}: { 
  label: string; 
  status: boolean; 
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
      <div>
        <div className="text-white">{label}</div>
        {description && (
          <div className="text-xs text-gray-500 font-mono mt-0.5">{description}</div>
        )}
      </div>
      {status ? (
        <CheckCircle className="w-5 h-5 text-emerald-400" />
      ) : (
        <XCircle className="w-5 h-5 text-gray-500" />
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  disabled,
  completed,
  icon,
  label,
  description,
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  completed: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        w-full p-4 rounded-xl text-left transition-all
        ${completed 
          ? "bg-emerald-500/10 border border-emerald-500/30" 
          : disabled
            ? "bg-white/5 opacity-50 cursor-not-allowed"
            : "bg-white/5 hover:bg-white/10 border border-transparent hover:border-emerald-500/30"
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${completed ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-gray-400"}`}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : completed ? <CheckCircle className="w-5 h-5" /> : icon}
        </div>
        <div className="flex-1">
          <div className={`font-medium ${completed ? "text-emerald-400" : "text-white"}`}>
            {label}
            {completed && <span className="ml-2 text-xs">✓ Fait</span>}
          </div>
          <div className="text-sm text-gray-400">{description}</div>
        </div>
      </div>
    </button>
  );
}

export default AdminConfigPanel;
