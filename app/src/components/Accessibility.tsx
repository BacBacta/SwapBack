/**
 * Accessibility Utilities
 * WCAG 2.1 AA compliant helpers
 */

"use client";

import { useEffect, useRef } from "react";

// Skip to main content link
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 terminal-button px-6 py-3"
    >
      <span className="terminal-text">SKIP TO MAIN CONTENT</span>
    </a>
  );
}

// Focus trap hook for modals
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element
    firstElement?.focus();

    document.addEventListener('keydown', handleTabKey);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
}

// Announce to screen readers
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined') return;

  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Keyboard navigation hook
export function useKeyboardNavigation(
  items: unknown[],
  onSelect: (index: number) => void
) {
  const selectedIndexRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndexRef.current = Math.min(
            selectedIndexRef.current + 1,
            items.length - 1
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndexRef.current = Math.max(
            selectedIndexRef.current - 1,
            0
          );
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(selectedIndexRef.current);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items, onSelect]);

  return selectedIndexRef.current;
}

// Screen reader only text
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

// Accessible icon button
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
}

export function IconButton({ icon, label, className = '', ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`terminal-button p-3 ${className}`}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
      <ScreenReaderOnly>{label}</ScreenReaderOnly>
    </button>
  );
}

// Loading announcement
export function LoadingAnnouncement({ isLoading, message }: { isLoading: boolean; message: string }) {
  useEffect(() => {
    if (isLoading) {
      announceToScreenReader(message, 'polite');
    }
  }, [isLoading, message]);

  return null;
}

// ARIA live region for dynamic updates
export function LiveRegion({
  message,
  priority = 'polite',
}: {
  message: string;
  priority?: 'polite' | 'assertive';
}) {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

// Form field with proper ARIA
interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ id, label, error, required, children }: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="block terminal-text text-[var(--primary)] mb-2"
      >
        {label}
        {required && <span className="text-[var(--error)] ml-1">*</span>}
      </label>

      <div
        className={error ? 'border-2 border-[var(--error)]' : ''}
      >
        {children}
      </div>

      {error && (
        <div
          id={errorId}
          role="alert"
          className="terminal-text text-[var(--error)] text-sm mt-2"
        >
          ❌ {error}
        </div>
      )}
    </div>
  );
}

// Tooltip with ARIA
interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2)}`);

  return (
    <div className="relative group inline-block">
      <div aria-describedby={tooltipId.current}>
        {children}
      </div>
      <div
        id={tooltipId.current}
        role="tooltip"
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black border-2 border-[var(--primary)] terminal-text text-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50"
      >
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-[var(--primary)]"></div>
      </div>
    </div>
  );
}

// Progress indicator with ARIA
interface ProgressProps {
  value: number;
  max?: number;
  label: string;
}

export function ProgressBar({ value, max = 100, label }: ProgressProps) {
  const percentage = (value / max) * 100;

  return (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        <span className="terminal-text text-[var(--primary)]">{label}</span>
        <span className="terminal-text text-[var(--primary)]">{percentage.toFixed(0)}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        className="h-4 bg-black/40 border-2 border-[var(--primary)]/30"
      >
        <div
          className="h-full bg-[var(--primary)] terminal-glow transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
