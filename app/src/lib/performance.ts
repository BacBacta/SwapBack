/**
 * Performance Utilities
 * 
 * Collection of utility functions for optimizing app performance
 */

/**
 * Debounce function to limit rate of function calls
 * 
 * @param func - Function to debounce
 * @param wait - Milliseconds to wait
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit function calls to once per interval
 * 
 * @param func - Function to throttle
 * @param limit - Minimum milliseconds between calls
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Lazy load component with delay
 * Useful for preventing flash of loading state
 * 
 * @param importFunc - Dynamic import function
 * @param minDelay - Minimum delay in ms (default 200ms)
 * @returns Promise that resolves to component
 */
export async function lazyWithDelay<T>(
  importFunc: () => Promise<T>,
  minDelay = 200
): Promise<T> {
  const [component] = await Promise.all([
    importFunc(),
    new Promise(resolve => setTimeout(resolve, minDelay))
  ]);
  return component;
}

/**
 * Preload critical resources
 * Call this in _app.tsx or layout.tsx
 */
export function preloadCriticalResources() {
  // Preload critical fonts
  const fonts = [
    '/fonts/terminal-font.woff2',
    // Add your font paths here
  ];
  
  fonts.forEach(font => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.href = font;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

/**
 * Check if device is mobile for conditional rendering
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Measure and log performance metrics
 * 
 * @param metricName - Name of the metric
 * @param startTime - Performance.now() start time
 */
export function logPerformance(metricName: string, startTime: number): void {
  const duration = performance.now() - startTime;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`⚡ [Performance] ${metricName}: ${duration.toFixed(2)}ms`);
  }
  
  // Send to analytics in production
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // Example: window.gtag?.('event', 'timing_complete', {
    //   name: metricName,
    //   value: Math.round(duration),
    // });
  }
}

/**
 * Memoize expensive function results
 * 
 * @param fn - Function to memoize
 * @returns Memoized function
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Request idle callback with fallback
 * Useful for deferring non-critical work
 * 
 * @param callback - Function to call when idle
 * @param options - Idle callback options
 */
export function requestIdleCallback(
  callback: () => void,
  options?: { timeout?: number }
): number {
  if (typeof window === 'undefined') return 0;
  
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options) as number;
  }
  
  // Fallback for browsers without requestIdleCallback
  return (window as any).setTimeout(callback, 1);
}

/**
 * Cancel idle callback
 * 
 * @param id - Callback ID from requestIdleCallback
 */
export function cancelIdleCallback(id: number): void {
  if (typeof window === 'undefined') return;
  
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}
