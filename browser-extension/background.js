/**
 * SwapBack Background Service Worker
 * Gère le routing des swaps et la communication avec le programme Solana
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';

const SOLANA_RPC = 'https://api.devnet.solana.com';
const ROUTER_PROGRAM_ID = new PublicKey('APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN');
const CNFT_PROGRAM_ID = new PublicKey('FPNibu4RhrTt9yLDxcc8nQuHiVkFCfLVJ7DZUn6yn8K8');
const BACK_TOKEN_MINT = new PublicKey('nKnrana1TdBHZGmVbNkpN1Dazj8285VftqCnkHCG8sh');

console.log('🔄 SwapBack: Background service worker initialized');

/**
 * Récupère le niveau cNFT de l'utilisateur
 */
async function getUserCNFTLevel(walletAddress) {
  try {
    const connection = new Connection(SOLANA_RPC);
    const userPubkey = new PublicKey(walletAddress);
    
    // Dériver le PDA UserNft
    const [userNftPda] = await PublicKey.findProgramAddress(
      [Buffer.from('user_nft'), userPubkey.toBuffer()],
      CNFT_PROGRAM_ID
    );
    
    // Fetch account data
    const accountInfo = await connection.getAccountInfo(userNftPda);
    
    if (!accountInfo) {
      return { level: null, boost: 0 };
    }
    
    // Décoder (simplifié - en production, utiliser Anchor IDL)
    const data = accountInfo.data;
    const level = data[8]; // Offset du champ level
    const boost = data[9]; // Offset du champ boost
    
    const levelNames = ['Bronze', 'Silver', 'Gold'];
    
    return {
      level: levelNames[level] || 'Bronze',
      boost: boost || 5,
    };
  } catch (error) {
    console.error('Error fetching cNFT level:', error);
    return { level: null, boost: 0 };
  }
}

/**
 * Route un swap via SwapBack
 */
async function routeSwapThroughSwapBack(swapDetails, walletAddress) {
  try {
    console.log('🔄 Routing swap through SwapBack:', swapDetails);
    
    // 1. Récupérer le niveau cNFT pour le boost
    const { level, boost } = await getUserCNFTLevel(walletAddress);
    
    // 2. Appeler Jupiter pour obtenir la meilleure route
    const jupiterQuote = await getJupiterQuote(
      swapDetails.fromToken,
      swapDetails.toToken,
      swapDetails.amount
    );
    
    // 3. Construire la transaction SwapBack
    // (qui inclura le swap + calcul du rebate)
    const swapTransaction = await buildSwapBackTransaction({
      ...swapDetails,
      jupiterRoute: jupiterQuote.route,
      userBoost: boost,
      walletAddress,
    });
    
    // 4. Calculer le rebate estimé
    const estimatedRebate = calculateEstimatedRebate(
      swapDetails.amount,
      boost,
      jupiterQuote.fees
    );
    
    return {
      success: true,
      transaction: swapTransaction,
      estimatedRebate,
      boost: boost > 0 ? boost : null,
      route: jupiterQuote.route,
    };
  } catch (error) {
    console.error('Error routing through SwapBack:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Obtient une quote de Jupiter
 */
async function getJupiterQuote(inputMint, outputMint, amount) {
  try {
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amount}&` +
      `slippageBps=50`
    );
    
    const data = await response.json();
    
    return {
      route: data.data[0],
      fees: data.data[0]?.platformFee || 0,
    };
  } catch (error) {
    console.error('Error fetching Jupiter quote:', error);
    throw error;
  }
}

/**
 * Construit une transaction SwapBack
 */
async function buildSwapBackTransaction(params) {
  // TODO: Implémenter avec Anchor
  // Pour l'instant, retourne une transaction basique
  
  const connection = new Connection(SOLANA_RPC);
  const transaction = new Transaction();
  
  // Ajouter l'instruction swap() du router program
  // + L'instruction pour enregistrer le rebate
  
  return transaction.serialize({ requireAllSignatures: false });
}

/**
 * Calcule le rebate estimé
 */
function calculateEstimatedRebate(amount, boost, fees) {
  const baseRebateRate = 0.003; // 0.3%
  const boostedRate = baseRebateRate * (1 + boost / 100);
  const rebate = amount * boostedRate;
  
  return rebate.toFixed(4);
}

/**
 * Gestion des messages
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request);
  
  if (request.action === 'getUserCNFTLevel') {
    // Récupérer le wallet depuis le storage
    chrome.storage.local.get(['walletAddress'], async (result) => {
      if (result.walletAddress) {
        const levelData = await getUserCNFTLevel(result.walletAddress);
        sendResponse(levelData);
      } else {
        sendResponse({ level: null, boost: 0 });
      }
    });
    return true; // Async response
  }
  
  if (request.action === 'routeSwapThroughSwapBack') {
    chrome.storage.local.get(['walletAddress'], async (result) => {
      if (result.walletAddress) {
        const routingResult = await routeSwapThroughSwapBack(
          request.data,
          result.walletAddress
        );
        sendResponse(routingResult);
      } else {
        sendResponse({ success: false, error: 'Wallet not connected' });
      }
    });
    return true; // Async response
  }
  
  if (request.action === 'openPopup') {
    chrome.action.openPopup();
    sendResponse({ success: true });
  }
  
  if (request.action === 'connectWallet') {
    // Stocker l'adresse du wallet
    chrome.storage.local.set({ walletAddress: request.walletAddress });
    sendResponse({ success: true });
  }
  
  return true;
});

/**
 * Écouter l'installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 SwapBack extension installed!');
    
    // Ouvrir la page d'accueil
    chrome.tabs.create({
      url: 'https://swapback.app/welcome',
    });
  }
});

/**
 * Badge sur l'icône
 */
chrome.storage.local.get(['walletAddress'], async (result) => {
  if (result.walletAddress) {
    const { level } = await getUserCNFTLevel(result.walletAddress);
    
    if (level) {
      chrome.action.setBadgeText({ text: level[0] }); // B, S, ou G
      chrome.action.setBadgeBackgroundColor({ 
        color: level === 'Gold' ? '#fbbf24' : level === 'Silver' ? '#d1d5db' : '#fb923c'
      });
    }
  }
});
