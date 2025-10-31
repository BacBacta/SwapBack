'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';

// Program IDs et constants
const BUYBACK_PROGRAM_ID = new PublicKey('92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir');
const BACK_TOKEN_MINT = new PublicKey('3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Discriminators
const DEPOSIT_USDC_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
const EXECUTE_BUYBACK_DISCRIMINATOR = Buffer.from([238, 194, 144, 180, 105, 2, 209, 111]);

interface BuybackState {
  authority: string;
  backMint: string;
  usdcVault: string;
  totalUsdcCollected: number;
  totalBackBurned: number;
  minBuybackAmount: number;
  lastBuybackTime: number;
  bump: number;
}

export default function BuybackDashboard() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  
  const [buybackState, setBuybackState] = useState<BuybackState | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [buybackAmount, setBuybackAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string>('');

  // Calculer les PDAs
  const [buybackStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('buyback_state')],
    BUYBACK_PROGRAM_ID
  );

  const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('usdc_vault')],
    BUYBACK_PROGRAM_ID
  );

  // Charger l'état du buyback
  useEffect(() => {
    loadBuybackState();
    const interval = setInterval(loadBuybackState, 10000); // Refresh toutes les 10s
    return () => clearInterval(interval);
  }, [connection, loadBuybackState]);

  const loadBuybackState = async () => {
    try {
      // Charger le compte buyback state
      const accountInfo = await connection.getAccountInfo(buybackStatePDA);
      if (accountInfo) {
        // Parser les données (simplifié - à adapter selon votre struct)
        const data = accountInfo.data;
        const authority = new PublicKey(data.slice(8, 40)).toBase58();
        const backMint = new PublicKey(data.slice(40, 72)).toBase58();
        const usdcVault = new PublicKey(data.slice(72, 104)).toBase58();
        const totalUsdcCollected = new BN(data.slice(104, 112), 'le').toNumber();
        const totalBackBurned = new BN(data.slice(112, 120), 'le').toNumber();
        const minBuybackAmount = new BN(data.slice(120, 128), 'le').toNumber();
        const lastBuybackTime = new BN(data.slice(128, 136), 'le').toNumber();
        const bump = data[136];

        setBuybackState({
          authority,
          backMint,
          usdcVault,
          totalUsdcCollected: totalUsdcCollected / 1e6, // USDC has 6 decimals
          totalBackBurned: totalBackBurned / 1e9, // $BACK has 9 decimals
          minBuybackAmount: minBuybackAmount / 1e6,
          lastBuybackTime,
          bump,
        });
      }

      // Charger le balance du vault
      const vaultInfo = await connection.getTokenAccountBalance(usdcVaultPDA);
      setVaultBalance(parseFloat(vaultInfo.value.uiAmount?.toString() || '0'));
    } catch (error) {
      console.error('Error loading buyback state:', error);
    }
  };

  // Déposer USDC
  const handleDepositUSDC = async () => {
    if (!publicKey || !depositAmount) return;
    
    setLoading(true);
    setTxStatus('Préparation du dépôt...');

    try {
      const amount = parseFloat(depositAmount) * 1e6; // USDC decimals
      
      // Get user's USDC token account
      const userUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        publicKey
      );

      const data = Buffer.concat([
        DEPOSIT_USDC_DISCRIMINATOR,
        Buffer.alloc(8)
      ]);
      new BN(amount).toArrayLike(Buffer, 'le', 8).copy(data, 8);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: buybackStatePDA, isSigner: false, isWritable: true },
          { pubkey: userUsdcAccount, isSigner: false, isWritable: true },
          { pubkey: usdcVaultPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: BUYBACK_PROGRAM_ID,
        data,
      });

      const transaction = new Transaction().add(instruction);
      
      setTxStatus('Envoi de la transaction...');
      const signature = await sendTransaction(transaction, connection);
      
      setTxStatus('Confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');
      
      setTxStatus(`✅ Dépôt réussi! Signature: ${signature.slice(0, 8)}...`);
      setDepositAmount('');
      loadBuybackState();
      
      setTimeout(() => setTxStatus(''), 5000);
    } catch (error) {
      console.error('Error depositing USDC:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTxStatus(`❌ Erreur: ${errorMessage}`);
      setTimeout(() => setTxStatus(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Exécuter le buyback
  const handleExecuteBuyback = async () => {
    if (!publicKey || !buybackAmount) return;
    
    setLoading(true);
    setTxStatus('Préparation du buyback...');

    try {
      const usdcAmount = parseFloat(buybackAmount) * 1e6;
      
      // Get user's $BACK token account
      const userBackAccount = await getAssociatedTokenAddress(
        BACK_TOKEN_MINT,
        publicKey
      );

      const data = Buffer.concat([
        EXECUTE_BUYBACK_DISCRIMINATOR,
        Buffer.alloc(8)
      ]);
      new BN(usdcAmount).toArrayLike(Buffer, 'le', 8).copy(data, 8);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: buybackStatePDA, isSigner: false, isWritable: true },
          { pubkey: usdcVaultPDA, isSigner: false, isWritable: true },
          { pubkey: BACK_TOKEN_MINT, isSigner: false, isWritable: true },
          { pubkey: userBackAccount, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: BUYBACK_PROGRAM_ID,
        data,
      });

      const transaction = new Transaction().add(instruction);
      
      setTxStatus('Envoi de la transaction...');
      const signature = await sendTransaction(transaction, connection);
      
      setTxStatus('Confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');
      
      setTxStatus(`✅ Buyback exécuté! Signature: ${signature.slice(0, 8)}...`);
      setBuybackAmount('');
      loadBuybackState();
      
      setTimeout(() => setTxStatus(''), 5000);
    } catch (error) {
      console.error('Error executing buyback:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTxStatus(`❌ Erreur: ${errorMessage}`);
      setTimeout(() => setTxStatus(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const canExecuteBuyback = buybackState && vaultBalance >= buybackState.minBuybackAmount;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white flex items-center gap-2">
          🔥 Buyback Dashboard
        </h2>
        <div className="bg-green-500/10 px-4 py-2 rounded-lg border border-green-500/30">
          <span className="text-green-400 text-sm font-medium">🟢 Live</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">💰 USDC dans le Vault</div>
          <div className="text-2xl font-bold text-white">
            {vaultBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Seuil: {buybackState?.minBuybackAmount.toFixed(2) || '0'} USDC
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">📊 Total USDC Collecté</div>
          <div className="text-2xl font-bold text-blue-400">
            {buybackState?.totalUsdcCollected.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) || '0'} USDC
          </div>
          <div className="text-xs text-gray-500 mt-1">Depuis le lancement</div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">🔥 Total $BACK Brûlé</div>
          <div className="text-2xl font-bold text-orange-400">
            {buybackState?.totalBackBurned.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) || '0'} $BACK
          </div>
          <div className="text-xs text-gray-500 mt-1">Impact déflationniste</div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deposit USDC Card */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">💵 Déposer USDC</h3>
          <p className="text-gray-400 text-sm mb-4">
            Déposez des USDC dans le vault pour alimenter le mécanisme de buyback
          </p>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Montant USDC</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="10.00"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                disabled={loading || !publicKey}
              />
            </div>
            
            <button
              onClick={handleDepositUSDC}
              disabled={loading || !publicKey || !depositAmount}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? '⏳ Traitement...' : publicKey ? 'Déposer USDC' : 'Connectez votre wallet'}
            </button>
          </div>
        </div>

        {/* Execute Buyback Card */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">🔥 Exécuter Buyback</h3>
          <p className="text-gray-400 text-sm mb-4">
            Vendez vos $BACK contre USDC du vault et brûlez automatiquement
          </p>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Montant USDC à utiliser</label>
              <input
                type="number"
                value={buybackAmount}
                onChange={(e) => setBuybackAmount(e.target.value)}
                placeholder="10.00"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                disabled={loading || !publicKey || !canExecuteBuyback}
              />
            </div>
            
            {!canExecuteBuyback && buybackState && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <p className="text-orange-400 text-sm">
                  ⚠️ Seuil non atteint: {vaultBalance.toFixed(2)} / {buybackState.minBuybackAmount.toFixed(2)} USDC
                </p>
              </div>
            )}
            
            <button
              onClick={handleExecuteBuyback}
              disabled={loading || !publicKey || !buybackAmount || !canExecuteBuyback}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? '⏳ Traitement...' : canExecuteBuyback ? 'Exécuter Buyback' : 'Seuil non atteint'}
            </button>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {txStatus && (
        <div className={`mt-4 p-4 rounded-lg ${
          txStatus.startsWith('✅') 
            ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
            : txStatus.startsWith('❌')
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
        }`}>
          {txStatus}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-6 bg-gray-800/30 rounded-xl p-4 border border-gray-700">
        <h4 className="text-white font-semibold mb-2">ℹ️ Comment ça marche?</h4>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>• 25% des frais de swap sont collectés en USDC dans le vault</li>
          <li>• Quand le seuil est atteint, n'importe qui peut exécuter un buyback</li>
          <li>• Les $BACK rachetés sont automatiquement brûlés</li>
          <li>• Cela réduit la supply totale et crée une pression déflationniste</li>
        </ul>
      </div>

      {/* Program Info */}
      <div className="mt-4 text-center">
        <a 
          href={`https://explorer.solana.com/address/${BUYBACK_PROGRAM_ID.toBase58()}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          📍 Voir le programme sur Solana Explorer
        </a>
      </div>
    </div>
  );
}
