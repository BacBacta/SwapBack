"use client";

import { useState } from 'react';
import { useKeyboardShortcuts, useEscapeKey, useFocusTrap } from '../hooks/useKeyboardShortcuts';

interface Shortcut {
  keys: string;
  description: string;
}

const shortcuts: Shortcut[] = [
  { keys: '⌘ K / Ctrl K', description: 'Open keyboard shortcuts menu' },
  { keys: 'Esc', description: 'Close modal or dialog' },
  { keys: 'Tab', description: 'Navigate through elements' },
  { keys: 'Shift Tab', description: 'Navigate backwards' },
  { keys: 'Enter', description: 'Confirm action or submit' },
  { keys: 'Space', description: 'Toggle button or checkbox' },
];

export const KeyboardShortcutsHelper = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Cmd/Ctrl + K to open
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrlKey: true,
      metaKey: true,
      callback: () => setIsOpen(prev => !prev),
      description: 'Toggle keyboard shortcuts menu',
    },
  ]);

  // Escape to close
  useEscapeKey(() => setIsOpen(false), isOpen);

  // Focus trap when open
  useFocusTrap(isOpen);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-fade-in"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <div className="swap-card animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-[var(--primary)]/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/10 flex items-center justify-center">
                <span className="text-xl">⌨️</span>
              </div>
              <h2 id="shortcuts-title" className="text-2xl font-bold">
                Keyboard Shortcuts
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-[var(--primary)]/10 transition-colors flex items-center justify-center text-gray-400 hover:text-[var(--primary)] focus-visible-ring"
              aria-label="Close shortcuts menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Shortcuts List */}
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-6">
              Use these keyboard shortcuts to navigate SwapBack more efficiently
            </p>

            <div className="grid gap-3">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between p-4 rounded-xl bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 transition-colors border border-[var(--primary)]/5"
                >
                  <span className="text-gray-300">{shortcut.description}</span>
                  <kbd className="px-3 py-1.5 rounded-lg bg-black/50 border border-[var(--primary)]/10 font-sans text-sm text-[var(--primary)] font-semibold">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>

            {/* Accessibility Note */}
            <div className="mt-8 p-4 rounded-xl bg-[var(--secondary)]/10 border border-[var(--secondary)]/20">
              <div className="flex gap-3">
                <span className="text-2xl flex-shrink-0">♿</span>
                <div>
                  <h3 className="font-semibold text-[var(--secondary)] mb-1">Accessibility Features</h3>
                  <p className="text-sm text-gray-400">
                    SwapBack is designed to be accessible to everyone. All interactive elements support keyboard navigation, 
                    and we provide ARIA labels for screen readers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[var(--primary)]/10 text-center">
            <p className="text-sm text-gray-500">
              Press <kbd className="px-2 py-1 rounded bg-black/30 border border-[var(--primary)]/10 font-sans text-xs">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
