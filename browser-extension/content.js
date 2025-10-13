/**
 * SwapBack Content Script
 * S'injecte dans les pages web pour détecter et optimiser les swaps
 */

console.log('🔄 SwapBack: Content script loaded');

// Détecter si on est sur une page de swap
const SWAP_PLATFORMS = {
  phantom: {
    domain: 'phantom.app',
    selectors: {
      swapButton: '[data-testid="swap-button"]',
      fromToken: '[data-testid="from-token-input"]',
      toToken: '[data-testid="to-token-input"]',
      amount: '[data-testid="swap-amount"]',
    }
  },
  jupiter: {
    domain: 'jup.ag',
    selectors: {
      swapButton: '.swap-button',
      fromToken: '.from-token-select',
      toToken: '.to-token-select',
      amount: '.swap-input',
    }
  },
  raydium: {
    domain: 'raydium.io',
    selectors: {
      swapButton: '.swap-btn',
      fromToken: '.token-from',
      toToken: '.token-to',
      amount: '.amount-input',
    }
  }
};

/**
 * Détecte la plateforme actuelle
 */
function detectPlatform() {
  const hostname = window.location.hostname;
  
  for (const [name, config] of Object.entries(SWAP_PLATFORMS)) {
    if (hostname.includes(config.domain)) {
      return { name, config };
    }
  }
  
  return null;
}

/**
 * Injecte un badge SwapBack sur la page
 */
function injectSwapBackBadge(platform) {
  // Vérifier si déjà injecté
  if (document.getElementById('swapback-badge')) return;

  const badge = document.createElement('div');
  badge.id = 'swapback-badge';
  badge.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.2s;
    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
      <span style="font-size: 20px;">🔄</span>
      <div>
        <div>SwapBack Active</div>
        <div style="font-size: 11px; opacity: 0.9;">Get rebates on this swap</div>
      </div>
    </div>
  `;
  
  badge.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });
  
  document.body.appendChild(badge);
}

/**
 * Intercepte les tentatives de swap
 */
function interceptSwap(platform) {
  const swapButton = document.querySelector(platform.config.selectors.swapButton);
  
  if (!swapButton) return;
  
  // Clone le bouton original
  const originalButton = swapButton.cloneNode(true);
  
  // Remplacer par notre bouton
  swapButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔄 SwapBack: Swap intercepted');
    
    // Récupérer les détails du swap
    const swapDetails = {
      fromToken: document.querySelector(platform.config.selectors.fromToken)?.value,
      toToken: document.querySelector(platform.config.selectors.toToken)?.value,
      amount: document.querySelector(platform.config.selectors.amount)?.value,
      platform: platform.name,
    };
    
    // Envoyer au background script pour traitement
    chrome.runtime.sendMessage({
      action: 'routeSwapThroughSwapBack',
      data: swapDetails,
    }, (response) => {
      if (response.success) {
        showSwapBackNotification(response);
      } else {
        // Fallback au swap original
        console.warn('SwapBack routing failed, using original swap');
        originalButton.click();
      }
    });
  }, true);
}

/**
 * Affiche une notification SwapBack
 */
function showSwapBackNotification(data) {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 10001;
      animation: slideIn 0.3s ease;
      cursor: pointer;
    " onclick="this.remove()">
      <div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">
        ✅ Swap via SwapBack
      </div>
      <div style="font-size: 13px; opacity: 0.95;">
        ${data.estimatedRebate ? `Rebate estimé: ${data.estimatedRebate}` : 'Meilleur route trouvé!'}
      </div>
      ${data.boost ? `<div style="font-size: 12px; margin-top: 4px;">Boost ${data.boost}% appliqué</div>` : ''}
      <div style="font-size: 11px; margin-top: 8px; opacity: 0.8;">Cliquez pour voir les détails</div>
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
  `;
  
  notification.addEventListener('click', () => {
    showOptimizationModal(data);
  });
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, 8000);
}

/**
 * Affiche un modal détaillé d'optimisation
 */
function showOptimizationModal(data) {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(5px);
      z-index: 10002;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    " onclick="this.remove()">
      <div style="
        background: white;
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        font-family: system-ui, -apple-system, sans-serif;
      " onclick="event.stopPropagation()">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <span style="font-size: 24px; margin-right: 12px;">🔄</span>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700;">SwapBack Optimization</h3>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #666;">Route optimisée trouvée</p>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Route originale:</span>
            <span style="color: #dc3545;">${data.originalCost || 'N/A'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Route SwapBack:</span>
            <span style="color: #10b981; font-weight: 600;">${data.optimizedCost || 'N/A'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid #eee;">
            <span style="font-weight: 600;">Économie:</span>
            <span style="color: #10b981; font-weight: 700;">${data.savings || 'N/A'}</span>
          </div>
        </div>
        
        ${data.boost ? `
        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #666;">🎁 Boost cNFT appliqué</div>
          <div style="font-size: 16px; font-weight: 600; color: #10b981;">+${data.boost}% de rebate supplémentaire</div>
        </div>
        ` : ''}
        
        <div style="display: flex; gap: 12px;">
          <button style="
            flex: 1;
            background: #10b981;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          " onclick="this.closest('[onclick]').click(); executeOptimizedSwap()">
            ✅ Utiliser SwapBack
          </button>
          <button style="
            flex: 1;
            background: #6c757d;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          " onclick="this.closest('[onclick]').remove()">
            ✕ Continuer normal
          </button>
        </div>
      </div>
    </div>
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    </style>
  `;
  
  document.body.appendChild(modal);
}

/**
 * Exécute le swap optimisé
 */
function executeOptimizedSwap() {
  chrome.runtime.sendMessage({ action: 'executeOptimizedSwap' }, (response) => {
    if (response.success) {
      showSuccessNotification('Swap exécuté avec succès via SwapBack!');
    } else {
      showErrorNotification('Erreur lors du swap optimisé');
    }
  });
}

/**
 * Notification de succès
 */
function showSuccessNotification(message) {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 10001;
      animation: slideIn 0.3s ease;
    ">
      <div style="font-size: 16px; font-weight: 700;">
        ✅ ${message}
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

/**
 * Notification d'erreur
 */
function showErrorNotification(message) {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 10001;
      animation: slideIn 0.3s ease;
    ">
      <div style="font-size: 16px; font-weight: 700;">
        ❌ ${message}
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

/**
 * Ajoute un indicateur de boost sur l'UI
 */
async function addBoostIndicator() {
  // Récupérer le niveau cNFT de l'utilisateur
  chrome.runtime.sendMessage({ action: 'getUserCNFTLevel' }, (response) => {
    if (response && response.level) {
      const indicator = document.createElement('div');
      indicator.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(10px);
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          font-family: system-ui;
          font-size: 12px;
          z-index: 9999;
          border: 1px solid ${response.level === 'Gold' ? '#fbbf24' : response.level === 'Silver' ? '#d1d5db' : '#fb923c'};
        ">
          ${response.level === 'Gold' ? '🥇' : response.level === 'Silver' ? '🥈' : '🥉'} 
          ${response.level} • +${response.boost}% boost
        </div>
      `;
      document.body.appendChild(indicator);
    }
  });
}

/**
 * Injecte le script dans la page
 */
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

/**
 * Initialisation
 */
function init() {
  console.log('🔄 SwapBack: Initializing...');
  
  const platform = detectPlatform();
  
  if (platform) {
    console.log(`🔄 SwapBack: Detected platform: ${platform.name}`);
    
    // Injecter le badge
    injectSwapBackBadge(platform);
    
    // Ajouter l'indicateur de boost
    addBoostIndicator();
    
    // Intercepter les swaps après chargement de la page
    setTimeout(() => {
      interceptSwap(platform);
    }, 2000);
    
    // Injecter le script
    injectScript();
  } else {
    console.log('🔄 SwapBack: No supported swap platform detected');
  }
}

// Démarrer quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Écouter les messages du background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'swapCompleted') {
    showSwapBackNotification(request.data);
    sendResponse({ received: true });
  }
  return true;
});
