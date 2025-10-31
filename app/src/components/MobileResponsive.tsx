/**
 * Mobile Responsive Utilities
 * Hooks and components for mobile-first design
 */

"use client";

import { useState, useEffect } from "react";

// Breakpoints matching Tailwind
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

// Detect screen size
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

// Mobile detection hook
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
}

// Tablet detection hook
export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`
  );
}

// Desktop detection hook
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
}

// Touch detection hook
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return isTouch;
}

// Responsive container component
interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  mobileClassName?: string;
  tabletClassName?: string;
  desktopClassName?: string;
}

export function ResponsiveContainer({
  children,
  className = '',
  mobileClassName = '',
  tabletClassName = '',
  desktopClassName = '',
}: ResponsiveContainerProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

  const responsiveClass = isMobile
    ? mobileClassName
    : isTablet
    ? tabletClassName
    : isDesktop
    ? desktopClassName
    : '';

  return <div className={`${className} ${responsiveClass}`}>{children}</div>;
}

// Mobile navigation component
interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileNav({ isOpen, onClose, children }: MobileNavProps) {
  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu */}
      <nav
        className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-black border-l-2 border-[var(--primary)] z-50 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--primary)] text-2xl hover:text-[var(--accent)] transition-colors"
          aria-label="Close menu"
        >
          ✕
        </button>

        {/* Menu content */}
        <div className="p-6 pt-16">{children}</div>
      </nav>
    </>
  );
}

// Mobile-friendly button sizes
export function MobileButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const isMobile = useIsMobile();
  const isTouch = useIsTouchDevice();

  const sizeClass = isMobile || isTouch ? 'min-h-[48px] px-6 text-base' : 'px-4 py-2 text-sm';

  return (
    <button className={`terminal-button ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

// Responsive grid
interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: string;
  className?: string;
}

export function ResponsiveGrid({
  children,
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = '4',
  className = '',
}: ResponsiveGridProps) {
  const gridClass = `grid gap-${gap} 
    grid-cols-${cols.mobile || 1} 
    md:grid-cols-${cols.tablet || 2} 
    lg:grid-cols-${cols.desktop || 3} 
    ${className}`;

  return <div className={gridClass}>{children}</div>;
}

// Bottom sheet for mobile (alternative to modal)
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // On desktop, show as modal instead
  if (!isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg">
          <div className="terminal-box p-6">
            {title && (
              <div className="flex justify-between items-center mb-4">
                <h2 className="terminal-text text-xl text-[var(--primary)]">{title}</h2>
                <button
                  onClick={onClose}
                  className="text-[var(--primary)] hover:text-[var(--accent)]"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            )}
            {children}
          </div>
        </div>
      </>
    );
  }

  // Mobile bottom sheet
  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 z-40"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-black border-t-2 border-[var(--primary)] rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto">
          {/* Drag handle */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-1 bg-[var(--primary)]/30 rounded-full" />
          </div>

          {title && (
            <h2 className="terminal-text text-xl text-[var(--primary)] mb-4 text-center">
              {title}
            </h2>
          )}

          {children}
        </div>
      </div>
    </>
  );
}

// Viewport height fix for mobile browsers (handles address bar)
export function useViewportHeight() {
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);
}

// Safe area padding for iOS notches
export function SafeAreaView({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`
        pt-[env(safe-area-inset-top)]
        pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)]
        pr-[env(safe-area-inset-right)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}
