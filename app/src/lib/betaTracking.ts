/**
 * Beta Testing Tracking System
 * 
 * Manages beta user tracking, analytics, and feedback collection
 */

import mixpanel from 'mixpanel-browser';

// Beta tester status
export type BetaStatus = 'invited' | 'active' | 'churned' | 'completed';

// Beta tester tier
export type BetaTier = 'early_adopter' | 'power_user' | 'casual_user';

// Beta user interface
export interface BetaUser {
  id: string;
  walletAddress: string;
  email?: string;
  discordUsername?: string;
  twitterHandle?: string;
  inviteCode: string;
  invitedAt: Date;
  activatedAt?: Date;
  status: BetaStatus;
  tier: BetaTier;
  totalSwaps: number;
  totalVolume: number; // in USD
  feedbackCount: number;
  bugsReported: number;
  lastActiveAt?: Date;
}

// Feedback interface
export interface BetaFeedback {
  id: string;
  userId: string;
  walletAddress: string;
  type: 'feature_request' | 'bug_report' | 'general_feedback' | 'ux_improvement';
  category: 'swap' | 'buyback' | 'ui_ux' | 'performance' | 'mobile' | 'other';
  title: string;
  description: string;
  rating?: number; // 1-5 stars
  screenshot?: string; // base64 or URL
  metadata?: Record<string, string | number | boolean>;
  createdAt: Date;
  status: 'new' | 'reviewing' | 'planned' | 'in_progress' | 'completed' | 'wont_fix';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// Beta analytics event
export interface BetaEvent {
  userId: string;
  walletAddress: string;
  eventType: string;
  properties?: Record<string, string | number | boolean>;
  timestamp: Date;
}

// Beta metrics
export interface BetaMetrics {
  totalUsers: number;
  activeUsers: number;
  totalSwaps: number;
  totalVolume: number;
  averageSwapSize: number;
  retentionRate: number;
  nps: number; // Net Promoter Score
  avgSessionDuration: number; // in seconds
  bugReports: number;
  featureRequests: number;
  criticalIssues: number;
}

/**
 * Initialize beta tracking for a user
 */
export function initializeBetaTracking(walletAddress: string, inviteCode: string): void {
  if (typeof window === 'undefined') return;

  // Initialize Mixpanel with beta user properties
  if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
    mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV === 'development',
      track_pageview: true,
      persistence: 'localStorage',
    });

    // Identify beta user
    mixpanel.identify(walletAddress);
    
    // Set beta user properties
    mixpanel.people.set({
      $wallet_address: walletAddress,
      $invite_code: inviteCode,
      $beta_user: true,
      $signup_date: new Date().toISOString(),
      $app_version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    });

    // Track beta activation
    trackBetaEvent('beta_user_activated', {
      invite_code: inviteCode,
      wallet_address: walletAddress,
    });
  }

  // Store in localStorage for persistence
  const betaData = {
    walletAddress,
    inviteCode,
    activatedAt: new Date().toISOString(),
    isActive: true,
  };
  
  localStorage.setItem('swapback_beta_user', JSON.stringify(betaData));
}

/**
 * Track beta event
 */
export function trackBetaEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined') return;

  const betaData = getBetaUserData();
  if (!betaData) return;

  const eventProperties = {
    ...properties,
    wallet_address: betaData.walletAddress,
    invite_code: betaData.inviteCode,
    beta_user: true,
    timestamp: new Date().toISOString(),
  };

  // Track in Mixpanel
  if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
    mixpanel.track(eventName, eventProperties);
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Beta Event:', eventName, eventProperties);
  }
}

/**
 * Track swap event for beta analytics
 */
export function trackBetaSwap(
  inputToken: string,
  outputToken: string,
  inputAmount: number,
  outputAmount: number,
  route: string
): void {
  trackBetaEvent('beta_swap_executed', {
    input_token: inputToken,
    output_token: outputToken,
    input_amount: inputAmount,
    output_amount: outputAmount,
    route,
    pair: `${inputToken}/${outputToken}`,
  });

  // Update swap count
  updateBetaMetrics('totalSwaps', 1);
  updateBetaMetrics('totalVolume', inputAmount);
}

/**
 * Track buyback event
 */
export function trackBetaBuyback(
  usdcAmount: number,
  backAmount: number,
  backBurned: number
): void {
  trackBetaEvent('beta_buyback_executed', {
    usdc_amount: usdcAmount,
    back_amount: backAmount,
    back_burned: backBurned,
    burn_rate: (backBurned / backAmount) * 100,
  });
}

/**
 * Track page view
 */
export function trackBetaPageView(page: string, properties?: Record<string, string | number | boolean>): void {
  trackBetaEvent('beta_page_view', {
    page,
    ...properties,
  });
}

/**
 * Track user action
 */
export function trackBetaAction(
  action: string,
  category: string,
  properties?: Record<string, string | number | boolean>
): void {
  trackBetaEvent('beta_user_action', {
    action,
    category,
    ...properties,
  });
}

/**
 * Submit beta feedback
 */
export async function submitBetaFeedback(
  feedback: Omit<BetaFeedback, 'id' | 'userId' | 'walletAddress' | 'createdAt' | 'status' | 'priority'>
): Promise<{ success: boolean; feedbackId?: string; error?: string }> {
  const betaData = getBetaUserData();
  if (!betaData) {
    return { success: false, error: 'Not a beta user' };
  }

  const fullFeedback: BetaFeedback = {
    ...feedback,
    id: generateFeedbackId(),
    userId: betaData.walletAddress,
    walletAddress: betaData.walletAddress,
    createdAt: new Date(),
    status: 'new',
    priority: determineFeedbackPriority(feedback),
  };

  try {
    // Send to API
    const response = await fetch('/api/beta/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullFeedback),
    });

    if (!response.ok) {
      throw new Error('Failed to submit feedback');
    }

    const result = await response.json();

    // Track feedback submission
    trackBetaEvent('beta_feedback_submitted', {
      feedback_type: feedback.type,
      feedback_category: feedback.category,
      has_screenshot: !!feedback.screenshot,
      rating: feedback.rating ?? 0, // Utiliser 0 si undefined
    });

    // Update feedback count
    updateBetaMetrics('feedbackCount', 1);

    return { success: true, feedbackId: result.feedbackId };
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Report a bug
 */
export async function reportBug(
  title: string,
  description: string,
  steps: string[],
  screenshot?: string
): Promise<{ success: boolean; bugId?: string; error?: string }> {
  const feedback: Omit<BetaFeedback, 'id' | 'userId' | 'walletAddress' | 'createdAt' | 'status' | 'priority'> = {
    type: 'bug_report',
    category: 'other',
    title,
    description,
    screenshot,
    metadata: {
      steps: steps.join(' → '),
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      url: window.location.href,
    },
  };

  const result = await submitBetaFeedback(feedback);

  if (result.success) {
    updateBetaMetrics('bugsReported', 1);
  }

  return result;
}

/**
 * Get beta user data from localStorage
 */
export function getBetaUserData(): { walletAddress: string; inviteCode: string } | null {
  if (typeof window === 'undefined') return null;

  const data = localStorage.getItem('swapback_beta_user');
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Check if user is a beta tester
 */
export function isBetaUser(): boolean {
  return getBetaUserData() !== null;
}

/**
 * Update beta metrics in localStorage
 */
function updateBetaMetrics(metric: string, increment: number): void {
  if (typeof window === 'undefined') return;

  const metricsKey = 'swapback_beta_metrics';
  const data = localStorage.getItem(metricsKey);
  
  let metrics: Record<string, number> = {};
  if (data) {
    try {
      metrics = JSON.parse(data);
    } catch {
      metrics = {};
    }
  }

  metrics[metric] = (metrics[metric] || 0) + increment;
  metrics.lastUpdated = Date.now();

  localStorage.setItem(metricsKey, JSON.stringify(metrics));
}

/**
 * Get beta metrics
 */
export function getBetaMetrics(): Record<string, number> {
  if (typeof window === 'undefined') return {};

  const data = localStorage.getItem('swapback_beta_metrics');
  if (!data) return {};

  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Generate unique feedback ID
 */
function generateFeedbackId(): string {
  return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determine feedback priority based on type and content
 */
function determineFeedbackPriority(
  feedback: Omit<BetaFeedback, 'id' | 'userId' | 'walletAddress' | 'createdAt' | 'status' | 'priority'>
): BetaFeedback['priority'] {
  if (feedback.type === 'bug_report') {
    // Keywords indicating critical bugs
    const criticalKeywords = ['crash', 'loss', 'funds', 'stuck', 'error', 'failed transaction'];
    const descLower = feedback.description.toLowerCase();
    
    if (criticalKeywords.some(keyword => descLower.includes(keyword))) {
      return 'critical';
    }
    return 'high';
  }

  if (feedback.type === 'feature_request') {
    return feedback.rating && feedback.rating <= 2 ? 'high' : 'medium';
  }

  return 'medium';
}

/**
 * Track session duration
 */
let sessionStartTime: number | null = null;

export function startBetaSession(): void {
  if (typeof window === 'undefined') return;
  
  sessionStartTime = Date.now();
  
  trackBetaEvent('beta_session_started', {
    start_time: new Date().toISOString(),
  });
}

export function endBetaSession(): void {
  if (typeof window === 'undefined' || !sessionStartTime) return;

  const duration = Math.floor((Date.now() - sessionStartTime) / 1000); // in seconds
  
  trackBetaEvent('beta_session_ended', {
    end_time: new Date().toISOString(),
    duration_seconds: duration,
    duration_minutes: Math.floor(duration / 60),
  });

  sessionStartTime = null;
}

/**
 * Auto-track session on page visibility change
 */
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      endBetaSession();
    } else if (isBetaUser()) {
      startBetaSession();
    }
  });
}
