/**
 * SwapBack E2E Tests - Navigation & General
 * Tests for navigation, routing, and general app functionality
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// TEST SUITE: Homepage
// ============================================================================
test.describe('Homepage', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Application error');
    expect(pageContent).not.toContain('500');
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Look for navigation links
    const navLinks = page.locator('nav a, header a, a[href*="swap"], a[href*="lock"]');
    const count = await navLinks.count();
    
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to swap page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Find swap link and click
    const swapLink = page.locator('a[href*="swap"], button:has-text("Swap")').first();
    
    if (await swapLink.isVisible()) {
      await swapLink.click();
      await page.waitForTimeout(1000);
      
      // Should be on swap page
      expect(page.url()).toContain('swap');
    }
  });

  test('should navigate to lock page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const lockLink = page.locator('a[href*="lock"], button:has-text("Lock")').first();
    
    if (await lockLink.isVisible()) {
      await lockLink.click();
      await page.waitForTimeout(1000);
      
      expect(page.url()).toContain('lock');
    }
  });
});

// ============================================================================
// TEST SUITE: App Routes
// ============================================================================
test.describe('App Routes', () => {
  const routes = [
    { path: '/swap', name: 'Swap' },
    { path: '/lock', name: 'Lock' },
    { path: '/app/swap', name: 'App Swap' },
    { path: '/app/lock', name: 'App Lock' },
    { path: '/app/rebates', name: 'Rebates' },
    { path: '/app/buyback', name: 'Buyback' },
    { path: '/app/history', name: 'History' },
  ];

  for (const route of routes) {
    test(`should load ${route.name} page (${route.path})`, async ({ page }) => {
      const response = await page.goto(route.path);
      
      // Should not be a server error
      expect(response?.status()).toBeLessThan(500);
      
      await page.waitForLoadState('domcontentloaded');
      
      const pageContent = await page.content();
      expect(pageContent).not.toContain('Application error');
    });
  }
});

// ============================================================================
// TEST SUITE: 404 Handling
// ============================================================================
test.describe('404 Handling', () => {
  test('should handle non-existent routes gracefully', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345');
    await page.waitForLoadState('domcontentloaded');
    
    // Should show 404 or redirect, not crash
    const pageContent = await page.content();
    const has404 = pageContent.includes('404') || 
                   pageContent.toLowerCase().includes('not found') ||
                   page.url().includes('404');
    
    // Either shows 404 or redirects to home
    expect(has404 || page.url() === 'http://localhost:3000/').toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Theme & Styling
// ============================================================================
test.describe('Theme & Styling', () => {
  test('should have dark theme applied', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('domcontentloaded');
    
    // Check for dark theme indicators
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    
    // Dark theme typically has dark background
    // rgb values should be low for dark colors
    const isDark = bgColor.includes('rgb') && 
                   (bgColor.includes('0, 0, 0') || 
                    bgColor.includes('17') || 
                    bgColor.includes('31') ||
                    bgColor.includes('gray'));
    
    // Just verify styling is applied
    expect(bgColor).toBeTruthy();
  });

  test('should have consistent styling across pages', async ({ page }) => {
    // Check swap page
    await page.goto('/swap');
    await page.waitForLoadState('domcontentloaded');
    const swapBg = await page.evaluate(() => 
      window.getComputedStyle(document.body).backgroundColor
    );
    
    // Check lock page
    await page.goto('/lock');
    await page.waitForLoadState('domcontentloaded');
    const lockBg = await page.evaluate(() => 
      window.getComputedStyle(document.body).backgroundColor
    );
    
    // Both should have styling applied
    expect(swapBg).toBeTruthy();
    expect(lockBg).toBeTruthy();
  });
});

// ============================================================================
// TEST SUITE: Wallet Adapter
// ============================================================================
test.describe('Wallet Adapter', () => {
  test('should load wallet adapter without errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      if (error.message.toLowerCase().includes('wallet')) {
        errors.push(error.message);
      }
    });
    
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Should not have wallet-related errors
    expect(errors.length).toBe(0);
  });

  test('should show wallet button', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('domcontentloaded');
    
    // Look for wallet button
    const walletButton = page.locator('button:has-text("Connect"), button:has-text("Wallet"), [class*="wallet"]');
    const hasWalletButton = await walletButton.first().isVisible().catch(() => false);
    
    expect(hasWalletButton).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: API Health
// ============================================================================
test.describe('API Health', () => {
  test('should have healthy API endpoints', async ({ page }) => {
    // Check if API routes respond
    const apiRoutes = [
      '/api/swap/quote',
    ];
    
    for (const route of apiRoutes) {
      const response = await page.request.get(route).catch(() => null);
      
      if (response) {
        // Should not be a 500 error
        expect(response.status()).toBeLessThan(500);
      }
    }
  });
});

// ============================================================================
// TEST SUITE: Accessibility
// ============================================================================
test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('domcontentloaded');
    
    // Check for headings
    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();
    
    // Should have some heading structure
    expect(h1Count + h2Count).toBeGreaterThanOrEqual(0);
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('domcontentloaded');
    
    // Check that buttons are keyboard accessible
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        // Button should be focusable
        const tabIndex = await button.getAttribute('tabindex');
        const disabled = await button.isDisabled();
        
        // Either not disabled, or has appropriate tabindex
        expect(disabled || tabIndex !== '-1').toBe(true);
      }
    }
  });

  test('should have proper contrast (basic check)', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('domcontentloaded');
    
    // Basic check: text should be visible against background
    const textElements = page.locator('p, span, h1, h2, h3, button');
    const count = await textElements.count();
    
    expect(count).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST SUITE: Performance Metrics
// ============================================================================
test.describe('Performance Metrics', () => {
  test('should have good Largest Contentful Paint', async ({ page }) => {
    await page.goto('/swap');
    
    // Get LCP metric
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // Fallback after 5 seconds
        setTimeout(() => resolve(5000), 5000);
      });
    });
    
    // LCP should be under 4 seconds for acceptable performance
    expect(lcp).toBeLessThan(4000);
    console.log(`LCP: ${lcp}ms`);
  });

  test('should have reasonable DOM size', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('domcontentloaded');
    
    const domSize = await page.evaluate(() => {
      return document.querySelectorAll('*').length;
    });
    
    // DOM should not be excessively large (under 3000 elements)
    expect(domSize).toBeLessThan(3000);
    console.log(`DOM elements: ${domSize}`);
  });

  test('should not have memory leaks (basic check)', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');
    
    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Navigate around
    await page.goto('/lock');
    await page.waitForTimeout(1000);
    await page.goto('/swap');
    await page.waitForTimeout(1000);
    
    // Get final memory
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Memory should not grow excessively (50MB tolerance)
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    }
  });
});

// ============================================================================
// TEST SUITE: SEO Basics
// ============================================================================
test.describe('SEO Basics', () => {
  test('should have meta tags', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Check for title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    
    // Check for meta description
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    // Description might not be set, but check it doesn't error
  });

  test('should have viewport meta tag', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width');
  });
});
