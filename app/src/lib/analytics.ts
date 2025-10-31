/**
 * Analytics Module for SwapBack
 * Tracks user interactions, swaps, and buyback events
 * 
 * Note: This is a lightweight wrapper. In production, integrate with:
 * - Mixpanel
 * - Amplitude
 * - PostHog
 * - Google Analytics 4
 */

interface SwapEvent {
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  fee: number;
  route: string;
  buybackDeposit: number;
  walletAddress?: string;
}

interface BuybackEvent {
  usdcAmount: number;
  backBurned: number;
  executor: string;
  signature: string;
}

interface PageViewEvent {
  page: string;
  referrer?: string;
  timestamp: number;
}

export class Analytics {
  private static instance: Analytics;
  private enabled: boolean;

  private constructor() {
    // Check if analytics should be enabled (opt-in for privacy)
    this.enabled = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
    
    if (this.enabled) {
      console.log('📊 Analytics enabled');
    }
  }

  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  /**
   * Track a swap transaction
   */
  trackSwap(event: SwapEvent) {
    if (!this.enabled) return;

    console.log('📊 Analytics: Swap', {
      input: `${(event.inputAmount / 1e6).toFixed(2)} ${event.inputToken}`,
      output: `${(event.outputAmount / 1e6).toFixed(2)} ${event.outputToken}`,
      fee: `${(event.fee / 1e6).toFixed(4)} USDC`,
      buyback: `${(event.buybackDeposit / 1e6).toFixed(4)} USDC`,
      route: event.route,
    });

    // TODO: Send to analytics platform
    // Example for Mixpanel:
    // mixpanel.track('Swap Executed', {
    //   input_token: event.inputToken,
    //   output_token: event.outputToken,
    //   input_amount_usd: event.inputAmount / 1e6,
    //   output_amount_usd: event.outputAmount / 1e6,
    //   fee_usd: event.fee / 1e6,
    //   buyback_contribution_usd: event.buybackDeposit / 1e6,
    //   route: event.route,
    // });
  }

  /**
   * Track a buyback execution
   */
  trackBuyback(event: BuybackEvent) {
    if (!this.enabled) return;

    console.log('📊 Analytics: Buyback', {
      usdc: `${(event.usdcAmount / 1e6).toFixed(2)} USDC`,
      burned: `${(event.backBurned / 1e6).toFixed(2)} BACK`,
      executor: event.executor.slice(0, 8) + '...',
      tx: event.signature.slice(0, 8) + '...',
    });

    // TODO: Send to analytics platform
  }

  /**
   * Track page views
   */
  trackPageView(event: PageViewEvent) {
    if (!this.enabled) return;

    console.log('📊 Analytics: Page View', {
      page: event.page,
      referrer: event.referrer,
    });

    // TODO: Send to analytics platform
  }

  /**
   * Track wallet connection
   */
  trackWalletConnect(walletAddress: string) {
    if (!this.enabled) return;

    console.log('📊 Analytics: Wallet Connected', {
      wallet: walletAddress.slice(0, 8) + '...',
    });

    // TODO: Send to analytics platform
  }

  /**
   * Track wallet disconnection
   */
  trackWalletDisconnect() {
    if (!this.enabled) return;

    console.log('📊 Analytics: Wallet Disconnected');

    // TODO: Send to analytics platform
  }

  /**
   * Track errors
   */
  trackError(error: Error, context?: Record<string, unknown>) {
    if (!this.enabled) return;

    console.error('📊 Analytics: Error', {
      message: error.message,
      stack: error.stack,
      ...context,
    });

    // TODO: Send to error tracking service (e.g., Sentry)
  }

  /**
   * Set user properties (for logged-in users or wallet addresses)
   */
  setUserProperties(properties: Record<string, unknown>) {
    if (!this.enabled) return;

    console.log('📊 Analytics: User Properties', properties);

    // TODO: Send to analytics platform
  }
}

// Export singleton instance
export const analytics = Analytics.getInstance();

// Export convenience functions
export const trackSwap = (event: SwapEvent) => analytics.trackSwap(event);
export const trackBuyback = (event: BuybackEvent) => analytics.trackBuyback(event);
export const trackPageView = (page: string, referrer?: string) => 
  analytics.trackPageView({ page, referrer, timestamp: Date.now() });
export const trackWalletConnect = (walletAddress: string) => 
  analytics.trackWalletConnect(walletAddress);
export const trackWalletDisconnect = () => analytics.trackWalletDisconnect();
export const trackError = (error: Error, context?: Record<string, unknown>) => 
  analytics.trackError(error, context);
