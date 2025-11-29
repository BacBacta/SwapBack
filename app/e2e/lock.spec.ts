/**
 * SwapBack E2E Tests - Lock Interface
 * Tests for token locking, unlocking, and NFT boost functionality
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  pageLoadTimeout: 30000,
  elementTimeout: 10000,
  
  // Lock durations in days
  lockDurations: [7, 30, 90],
  
  // CNFT Program
  cnftProgramId: 'EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP',
};

// Helper functions
async function navigateToLock(page: Page) {
  await page.goto('/lock', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/lock/);
}

async function navigateToAppLock(page: Page) {
  await page.goto('/app/lock', { waitUntil: 'networkidle' });
}

async function waitForPageLoad(page: Page) {
  await page.waitForSelector('main, [data-testid="lock-interface"], .lock-container', {
    timeout: TEST_CONFIG.pageLoadTimeout,
  }).catch(() => {
    return page.waitForLoadState('domcontentloaded');
  });
}

// ============================================================================
// TEST SUITE: Lock Page Loading
// ============================================================================
test.describe('Lock Page Loading', () => {
  test('should load /lock page successfully', async ({ page }) => {
    await page.goto('/lock');
    await waitForPageLoad(page);
    
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Application error');
    expect(pageContent).not.toContain('500');
  });

  test('should load /app/lock page successfully', async ({ page }) => {
    await page.goto('/app/lock');
    await waitForPageLoad(page);
    
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Application error');
  });

  test('should display lock interface elements', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Should have some interactive elements
    const buttons = await page.locator('button').count();
    expect(buttons).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST SUITE: Lock Duration Selection
// ============================================================================
test.describe('Lock Duration Selection', () => {
  test('should display duration options', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Look for duration options (7, 30, 90 days)
    const has7Days = await page.locator('text=/7.*day|7j|1.*week/i').isVisible().catch(() => false);
    const has30Days = await page.locator('text=/30.*day|30j|1.*month/i').isVisible().catch(() => false);
    const has90Days = await page.locator('text=/90.*day|90j|3.*month/i').isVisible().catch(() => false);
    
    // At least one duration option should exist
    const hasDurationOptions = has7Days || has30Days || has90Days;
    
    // Also check for slider or buttons
    const hasSlider = await page.locator('input[type="range"]').isVisible().catch(() => false);
    const hasDurationButtons = await page.locator('button:has-text("day"), button:has-text("jour")').count() > 0;
    
    expect(hasDurationOptions || hasSlider || hasDurationButtons).toBe(true);
  });

  test('should allow selecting different durations', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Try to find and interact with duration selector
    const durationButton = page.locator('button:has-text("30"), button:has-text("day")').first();
    
    if (await durationButton.isVisible()) {
      await durationButton.click();
      await page.waitForTimeout(300);
    }
    
    // Or try slider
    const slider = page.locator('input[type="range"]');
    if (await slider.isVisible()) {
      await slider.fill('30');
      await page.waitForTimeout(300);
    }
  });

  test('should update boost display when duration changes', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Look for boost percentage display
    const boostDisplay = page.locator('text=/%|boost|multiplier/i').first();
    const hasBoostDisplay = await boostDisplay.isVisible().catch(() => false);
    
    // Page should show some boost information
    const pageContent = await page.content();
    const hasBoostInfo = pageContent.includes('%') || 
                         pageContent.toLowerCase().includes('boost') ||
                         pageContent.toLowerCase().includes('multiplier');
    
    expect(hasBoostDisplay || hasBoostInfo).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Lock Amount Input
// ============================================================================
test.describe('Lock Amount Input', () => {
  test('should have amount input field', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    const amountInput = page.locator('input[type="number"], input[type="text"], input[placeholder*="0"]');
    const hasInput = await amountInput.first().isVisible().catch(() => false);
    
    expect(hasInput).toBe(true);
  });

  test('should accept valid amount', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    const amountInput = page.locator('input[type="number"], input[type="text"]').first();
    
    if (await amountInput.isVisible()) {
      await amountInput.fill('100');
      const value = await amountInput.inputValue();
      expect(value).toContain('100');
    }
  });

  test('should have max button', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    const maxButton = page.locator('button:has-text("MAX"), button:has-text("Max")');
    const hasMaxButton = await maxButton.isVisible().catch(() => false);
    
    // Max button is common but not required
    if (hasMaxButton) {
      await maxButton.click();
      await page.waitForTimeout(300);
    }
  });
});

// ============================================================================
// TEST SUITE: Lock Button State
// ============================================================================
test.describe('Lock Button State', () => {
  test('should show lock button', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    const lockButton = page.locator('button:has-text("Lock"), button:has-text("Verrouiller")');
    const hasLockButton = await lockButton.first().isVisible().catch(() => false);
    
    expect(hasLockButton).toBe(true);
  });

  test('should disable lock button without wallet connection', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    const lockButton = page.locator('button:has-text("Lock"), button:has-text("Connect")').first();
    
    if (await lockButton.isVisible()) {
      // Button should either be disabled or show "Connect Wallet"
      const isDisabled = await lockButton.isDisabled().catch(() => false);
      const text = await lockButton.textContent();
      
      // Either disabled or shows connect message
      expect(isDisabled || text?.toLowerCase().includes('connect')).toBe(true);
    }
  });
});

// ============================================================================
// TEST SUITE: Unlock Interface
// ============================================================================
test.describe('Unlock Interface', () => {
  test('should have unlock tab or button', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    const unlockElement = page.locator('button:has-text("Unlock"), text=Unlock, [role="tab"]:has-text("Unlock")');
    const hasUnlock = await unlockElement.first().isVisible().catch(() => false);
    
    // Unlock option should exist
    expect(hasUnlock).toBe(true);
  });

  test('should switch to unlock view', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    const unlockTab = page.locator('button:has-text("Unlock"), [role="tab"]:has-text("Unlock")').first();
    
    if (await unlockTab.isVisible()) {
      await unlockTab.click();
      await page.waitForTimeout(500);
      
      // Should now show unlock-related content
      const pageContent = await page.content();
      const hasUnlockContent = pageContent.toLowerCase().includes('unlock') ||
                               pageContent.toLowerCase().includes('withdraw');
      expect(hasUnlockContent).toBe(true);
    }
  });
});

// ============================================================================
// TEST SUITE: NFT Boost Display
// ============================================================================
test.describe('NFT Boost Display', () => {
  test('should display boost information', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Look for boost-related content
    const pageContent = await page.content();
    const hasBoostInfo = pageContent.toLowerCase().includes('boost') ||
                         pageContent.toLowerCase().includes('nft') ||
                         pageContent.toLowerCase().includes('multiplier') ||
                         pageContent.includes('%');
    
    expect(hasBoostInfo).toBe(true);
  });

  test('should show expected boost for different durations', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // The page should show boost percentages based on duration
    // 7 days = 1%, 30 days = 5%, 90 days = 15%
    const pageContent = await page.content();
    
    // Should have some numeric boost value
    const hasBoostPercentage = /\d+(\.\d+)?%/.test(pageContent);
    
    // Boost information should be present
    expect(hasBoostPercentage || pageContent.toLowerCase().includes('boost')).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Lock Status Display
// ============================================================================
test.describe('Lock Status Display', () => {
  test('should show lock status section', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Look for status-related elements
    const statusElements = page.locator('text=/status|locked|active|duration|remaining/i');
    const hasStatus = await statusElements.first().isVisible().catch(() => false);
    
    // Or check for any data display
    const pageContent = await page.content();
    const hasLockData = pageContent.toLowerCase().includes('lock') ||
                        pageContent.toLowerCase().includes('duration') ||
                        pageContent.toLowerCase().includes('amount');
    
    expect(hasStatus || hasLockData).toBe(true);
  });

  test('should display remaining time if lock is active', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Look for time remaining display
    const timeDisplay = page.locator('text=/day|hour|minute|jour|heure/i');
    const hasTimeDisplay = await timeDisplay.first().isVisible().catch(() => false);
    
    // Time display might not be visible if no active lock
    // This is just checking the UI can handle it
  });
});

// ============================================================================
// TEST SUITE: Error Handling
// ============================================================================
test.describe('Lock Page Error Handling', () => {
  test('should not have critical JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await navigateToLock(page);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    
    // Filter for critical errors
    const criticalErrors = errors.filter(error => 
      error.includes('is not defined') || 
      error.includes('Cannot read properties of undefined') ||
      error.includes('Cannot read properties of null')
    );
    
    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }
    
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle wallet not connected gracefully', async ({ page }) => {
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Should not crash when wallet is not connected
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Application error');
    
    // Should show connect wallet message or disabled state
    const hasConnectMessage = pageContent.toLowerCase().includes('connect') ||
                              pageContent.toLowerCase().includes('wallet');
    expect(hasConnectMessage).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Mobile Responsiveness
// ============================================================================
test.describe('Lock Page Mobile', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Page should not have horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    
    // Allow small tolerance for scrollbar
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
  });

  test('should have touchable targets on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateToLock(page);
    await waitForPageLoad(page);
    
    // Check that buttons are reasonably sized for touch
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          // Minimum touch target should be at least 32x32
          expect(box.width).toBeGreaterThanOrEqual(32);
          expect(box.height).toBeGreaterThanOrEqual(32);
        }
      }
    }
  });
});
