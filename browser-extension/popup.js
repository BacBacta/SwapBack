/**
 * SwapBack Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Load user stats
    loadUserStats();

    // Update status
    updateStatus();
});

async function loadUserStats() {
    try {
        // Get user wallet from storage
        const { walletAddress } = await chrome.storage.local.get('walletAddress');

        if (walletAddress) {
            // Fetch cNFT data
            const response = await fetch(`http://localhost:3001/user/${walletAddress}/cnft`);
            const cnftData = await response.json();

            document.getElementById('cnft-level').textContent = cnftData.exists ? 'Silver' : 'None';

            // Fetch global stats
            const statsResponse = await fetch('http://localhost:3001/stats/global');
            const stats = await statsResponse.json();

            document.getElementById('total-rebates').textContent = `$${stats.totalRebates.toLocaleString()}`;
            document.getElementById('total-swaps').textContent = stats.totalSwaps.toLocaleString();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        // Fallback values
        document.getElementById('cnft-level').textContent = 'Unknown';
    }
}

function updateStatus() {
    const status = document.getElementById('status');

    // Check if we're on a supported site
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const supportedSites = ['phantom.app', 'solflare.com', 'raydium.io', 'jup.ag'];

        const isSupported = supportedSites.some(site =>
            currentTab.url.includes(site)
        );

        if (isSupported) {
            status.textContent = '✅ Active - Ready to optimize swaps';
            status.style.color = '#10b981';
        } else {
            status.textContent = '⏸️ Not active on this site';
            status.style.color = '#6b7280';
        }
    });
}

function openDashboard() {
    chrome.tabs.create({ url: 'https://swapback.app/dashboard' });
}

function openSettings() {
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
}