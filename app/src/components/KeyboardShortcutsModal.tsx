/**
 * Keyboard Shortcuts Help Modal
 * Display all available shortcuts
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, CommandLineIcon } from "@heroicons/react/24/outline";

interface ShortcutItem {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  category: string;
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS: ShortcutItem[] = [
  // Navigation
  { key: "K", ctrl: true, description: "Open token search", category: "Navigation" },
  { key: "Escape", description: "Close modal / Clear selection", category: "Navigation" },
  { key: "Tab", description: "Navigate between fields", category: "Navigation" },
  { key: "?", shift: true, description: "Show this help", category: "Navigation" },
  
  // Actions
  { key: "S", ctrl: true, description: "Execute swap", category: "Actions" },
  { key: "R", ctrl: true, description: "Refresh prices & routes", category: "Actions" },
  { key: "F", ctrl: true, description: "Toggle favorites panel", category: "Actions" },
  { key: "Enter", description: "Confirm current action", category: "Actions" },
  
  // Quick Amounts
  { key: "1", description: "Set 10% of balance", category: "Quick Amounts" },
  { key: "2", description: "Set 25% of balance", category: "Quick Amounts" },
  { key: "3", description: "Set 50% of balance", category: "Quick Amounts" },
  { key: "4", description: "Set 75% of balance", category: "Quick Amounts" },
  { key: "5", description: "Set 100% (MAX)", category: "Quick Amounts" },
  
  // Slippage
  { key: "L", ctrl: true, description: "Toggle slippage settings", category: "Slippage" },
  { key: "[", ctrl: true, description: "Decrease slippage", category: "Slippage" },
  { key: "]", ctrl: true, description: "Increase slippage", category: "Slippage" },
];

const KeyBadge = ({ keys, ctrl, shift }: { keys: string; ctrl?: boolean; shift?: boolean }) => (
  <div className="flex items-center gap-1">
    {ctrl && (
      <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-xs font-mono">
        {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
      </kbd>
    )}
    {shift && (
      <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-xs font-mono">
        ⇧
      </kbd>
    )}
    <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-xs font-mono">
      {keys}
    </kbd>
  </div>
);

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUTS.map(s => s.category)));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative max-w-2xl w-full bg-gradient-to-br from-gray-900 to-gray-800 
                   rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gray-900/95 backdrop-blur-lg border-b border-white/10 p-6 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CommandLineIcon className="w-6 h-6 text-emerald-400" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
                  <p className="text-sm text-gray-400">Navigate faster with these shortcuts</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
              >
                <XMarkIcon className="w-6 h-6 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {categories.map((category, catIndex) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: catIndex * 0.1 }}
                className="space-y-3"
              >
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
                  {category}
                </h3>
                <div className="space-y-2">
                  {SHORTCUTS.filter(s => s.category === category).map((shortcut, index) => (
                    <motion.div
                      key={`${shortcut.key}-${shortcut.ctrl}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: catIndex * 0.1 + index * 0.05 }}
                      className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 
                               rounded-lg transition-colors"
                    >
                      <span className="text-sm text-gray-300">{shortcut.description}</span>
                      <KeyBadge keys={shortcut.key} ctrl={shortcut.ctrl} shift={shortcut.shift} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div className="text-sm text-gray-300 space-y-1">
                  <p className="font-medium text-emerald-400">Pro Tips:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>Hold Shift while clicking amounts for quick multi-selection</li>
                    <li>Use arrow keys in token selector for faster browsing</li>
                    <li>Press Escape twice to reset the entire form</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
