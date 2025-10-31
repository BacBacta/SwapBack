/**
 * Analytics Module for SwapBack
 * Tracks user interactions, swaps, and buyback events
 * 
 * Production-ready integration with Mixpanel
 */

import mixpanel from 'mixpanel-browser';

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
  private mixpanelInitialized: boolean = false;

  private constructor() {
    // Check if analytics should be enabled (opt-in for privacy)
    this.enabled = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
    
    if (this.enabled && typeof window !== 'undefined') {
      const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
      
      if (mixpanelToken) {
        try {
          mixpanel.init(mixpanelToken, {
            debug: process.env.NODE_ENV === 'development',
            track_pageview: true,
            persistence: 'localStorage',
          });
          this.mixpanelInitialized = true;
          console.log('📊 Analytics enabled (Mixpanel)');
        } catch (error) {
          console.error('Failed to initialize Mixpanel:', error);
          this.mixpanelInitialized = false;
        }
      } else {
        console.warn('📊 Analytics enabled but NEXT_PUBLIC_MIXPANEL_TOKEN not set - using console logging only');
      }
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

    const eventData = {
      input_token: event.inputToken,
      output_token: event.outputToken,
      input_amount: event.inputAmount / 1e6,
      output_amount: event.outputAmount / 1e6,
      fee: event.fee / 1e6,
      buyback_contribution: event.buybackDeposit / 1e6,
      route: event.route,
      wallet: event.walletAddress,
    };

    console.log('📊 Analytics: Swap', {
      input: `${eventData.input_amount.toFixed(2)} ${event.inputToken}`,
      output: `${eventData.output_amount.toFixed(2)} ${event.outputToken}`,
      fee: `${eventData.fee.toFixed(4)} USDC`,
      buyback: `${eventData.buyback_contribution.toFixed(4)} USDC`,
      route: event.route,
    });

    if (this.mixpanelInitialized) {
      mixpanel.track('Swap Executed', eventData);
    }
  }

  /**
   * Track a buyback execution
   */
  trackBuyback(event: BuybackEvent) {
    if (!this.enabled) return;

    const eventData = {
      usdc_amount: event.usdcAmount / 1e6,
      back_burned: event.backBurned / 1e6,
      executor: event.executor,
      signature: event.signature,
    };

    console.log('📊 Analytics: Buyback', {
      usdc: `${eventData.usdc_amount.toFixed(2)} USDC`,
      burned: `${eventData.back_burned.toFixed(2)} BACK`,
      executor: event.executor.slice(0, 8) + '...',
      tx: event.signature.slice(0, 8) + '...',
    });

    if (this.mixpanelInitialized) {
      mixpanel.track('Buyback Executed', eventData);
    }
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

    if (this.mixpanelInitialized) {
      mixpanel.track('Page View', {
        page: event.page,
        referrer: event.referrer,
        timestamp: event.timestamp,
      });
    }
  }

  /**
   * Track wallet connection
   */
  trackWalletConnect(walletAddress: string) {
    if (!this.enabled) return;

    console.log('📊 Analytics: Wallet Connected', {
      wallet: walletAddress.slice(0, 8) + '...',
    });

    if (this.mixpanelInitialized) {
      mixpanel.track('Wallet Connected', {
        wallet_address: walletAddress,
      });
      mixpanel.identify(walletAddress);
      mixpanel.people.set({
        $last_login: new Date().toISOString(),
        wallet_address: walletAddress,
      });
    }
  }

  /**
   * Track wallet disconnection
   */
  trackWalletDisconnect() {
    if (!this.enabled) return;

    console.log('📊 Analytics: Wallet Disconnected');

    if (this.mixpanelInitialized) {
      mixpanel.track('Wallet Disconnected');
      mixpanel.reset(); // Clear user identity
    }
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

    if (this.mixpanelInitialized) {
      mixpanel.track('Error', {
        error_message: error.message,
        error_stack: error.stack,
        ...context,
      });
    }
  }

  /**
   * Set user properties (for logged-in users or wallet addresses)
   */
  setUserProperties(properties: Record<string, unknown>) {
    if (!this.enabled) return;

    console.log('📊 Analytics: User Properties', properties);

    if (this.mixpanelInitialized) {
      mixpanel.people.set(properties);
    }
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
