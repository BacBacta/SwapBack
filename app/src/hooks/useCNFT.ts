import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useEffect, useState } from 'react';

// Utilise les Program IDs depuis les variables d'environnement
const CNFT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || 'GFnJ59QDC4ANdMhsvDZaFoBTNUiq3cY3rQfHCoDYAQ3B'
);
const ROUTER_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || 'yeKoCvFPTmgn5oCejqFVU5mUNdVbZSxwETCXDuBpfxn'
);

export interface CNFTData {
  level: number;
  boost: number;
  lockedAmount: number;
  lockDuration: number;
  unlockDate: Date;
  isActive: boolean;
  exists: boolean;
}

export interface LockData {
  amount: number;
  boost: number;
  unlockTime: number;
  isActive: boolean;
}

export function useCNFT() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [cnftData, setCnftData] = useState<CNFTData | null>(null);
  const [lockData, setLockData] = useState<LockData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Dériver le PDA pour le UserNft
  const getUserNftPDA = async (userPubkey: PublicKey): Promise<PublicKey> => {
    const [pda] = await PublicKey.findProgramAddress(
      [
        Buffer.from('user_nft'),
        userPubkey.toBuffer(),
      ],
      CNFT_PROGRAM_ID
    );
    return pda;
  };

  // Dériver le PDA pour LockState
  const getLockStatePDA = async (userPubkey: PublicKey): Promise<PublicKey> => {
    const [pda] = await PublicKey.findProgramAddress(
      [
        Buffer.from('lock'),
        userPubkey.toBuffer(),
      ],
      ROUTER_PROGRAM_ID
    );
    return pda;
  };

  // Charger les données cNFT depuis la blockchain
  const fetchCNFTData = async () => {
    if (!publicKey || !connection) {
      setCnftData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Récupérer le PDA du UserNft
      const userNftPDA = await getUserNftPDA(publicKey);
      
      // Fetch account data
      const accountInfo = await connection.getAccountInfo(userNftPDA);
      
      if (!accountInfo) {
        // Aucun cNFT n'existe pour cet utilisateur
        setCnftData({
          level: 0,
          boost: 0,
          lockedAmount: 0,
          lockDuration: 0,
          unlockDate: new Date(),
          isActive: false,
          exists: false,
        });
        return;
      }

      // Décoder les données du compte
      // Structure UserNft: authority(32) + level(1) + boost(2) + locked_amount(8) + lock_duration(8) + is_active(1)
      const data = accountInfo.data;
      
      // Skip discriminator (8 bytes) si présent
      let offset = 8;
      
      // authority: 32 bytes
      offset += 32;
      
      // level: u8 (1 byte)
      const level = data.readUInt8(offset);
      offset += 1;
      
      // boost: u16 (2 bytes, little endian)
      const boost = data.readUInt16LE(offset);
      offset += 2;
      
      // locked_amount: u64 (8 bytes, little endian)
      const lockedAmount = Number(data.readBigUInt64LE(offset));
      offset += 8;
      
      // lock_duration: i64 (8 bytes, little endian)
      const lockDuration = Number(data.readBigInt64LE(offset));
      offset += 8;
      
      // is_active: bool (1 byte)
      const isActive = data.readUInt8(offset) === 1;
      
      // Calculer unlock date (maintenant + duration)
      const unlockDate = new Date(Date.now() + lockDuration * 1000);

      setCnftData({
        level,
        boost,
        lockedAmount,
        lockDuration,
        unlockDate,
        isActive,
        exists: true,
      });
    } catch (err) {
      console.error('Error fetching cNFT data:', err);
      setError(err as Error);
      setCnftData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les données de lock depuis le router
  const fetchLockData = async () => {
    if (!publicKey || !connection) {
      setLockData(null);
      return;
    }

    try {
      const lockStatePDA = await getLockStatePDA(publicKey);
      const accountInfo = await connection.getAccountInfo(lockStatePDA);
      
      if (!accountInfo) {
        setLockData(null);
        return;
      }

      // Décoder LockState
      const data = accountInfo.data;
      let offset = 8; // Skip discriminator
      
      // user: 32 bytes
      offset += 32;
      
      // amount: u64
      const amount = Number(data.readBigUInt64LE(offset));
      offset += 8;
      
      // boost: u16
      const boost = data.readUInt16LE(offset);
      offset += 2;
      
      // unlock_time: i64
      const unlockTime = Number(data.readBigInt64LE(offset));
      offset += 8;
      
      // is_active: bool
      const isActive = data.readUInt8(offset) === 1;

      setLockData({
        amount,
        boost,
        unlockTime,
        isActive,
      });
    } catch (err) {
      console.error('Error fetching lock data:', err);
      setLockData(null);
    }
  };

  // Auto-refresh quand le wallet change
  useEffect(() => {
    fetchCNFTData();
    fetchLockData();
  }, [publicKey, connection]);

  // Fonction pour rafraîchir manuellement
  const refresh = async () => {
    await Promise.all([fetchCNFTData(), fetchLockData()]);
  };

  // Calculer le niveau textuel
  const getLevelName = (): 'Bronze' | 'Silver' | 'Gold' | null => {
    if (!cnftData?.exists) return null;
    
    switch (cnftData.level) {
      case 0:
        return 'Bronze';
      case 1:
        return 'Silver';
      case 2:
        return 'Gold';
      default:
        return null;
    }
  };

  // Calculer le temps restant en jours
  const getDaysRemaining = (): number | null => {
    if (!cnftData || !cnftData.exists || !cnftData.isActive) return null;
    
    const now = Date.now();
    const unlock = cnftData.unlockDate.getTime();
    const remaining = unlock - now;
    
    if (remaining <= 0) return 0;
    
    return Math.ceil(remaining / (1000 * 60 * 60 * 24));
  };

  return {
    // Données
    cnftData,
    lockData,
    
    // États
    isLoading,
    error,
    isConnected: !!publicKey,
    hasCNFT: cnftData?.exists ?? false,
    
    // Helpers
    levelName: getLevelName(),
    daysRemaining: getDaysRemaining(),
    
    // Actions
    refresh,
  };
}
