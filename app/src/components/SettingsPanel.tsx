/**
 * Settings Panel Component
 * Sound, haptic, keyboard shortcuts toggles
 */

"use client";

import { motion } from "framer-motion";
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  DevicePhoneMobileIcon,
  CommandLineIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useHaptic } from "@/hooks/useHaptic";
import { useState } from "react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onShowKeyboardShortcuts: () => void;
}

export function SettingsPanel({ 
  isOpen, 
  onClose,
  onShowKeyboardShortcuts 
}: SettingsPanelProps) {
  const { isEnabled: soundEnabled, volume, toggleSound, setVolume } = useSoundEffects();
  const haptic = useHaptic();
  const [hapticEnabled, setHapticEnabled] = useState(true);

  if (!isOpen) return null;

  const handleHapticToggle = () => {
    const newState = !hapticEnabled;
    setHapticEnabled(newState);
    if (newState) {
      haptic.light();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center 
               bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative max-w-md w-full bg-gradient-to-br from-gray-900 to-gray-800 
                 rounded-t-2xl md:rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900/95 border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
            >
              <XMarkIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Sound Effects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {soundEnabled ? (
                  <SpeakerWaveIcon className="w-5 h-5 text-emerald-400" />
                ) : (
                  <SpeakerXMarkIcon className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <div className="font-medium text-white">Sound Effects</div>
                  <div className="text-xs text-gray-400">UI interaction sounds</div>
                </div>
              </div>
              <button
                onClick={toggleSound}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  soundEnabled ? 'bg-emerald-500' : 'bg-gray-700'
                }`}
              >
                <motion.div
                  animate={{ x: soundEnabled ? 24 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg"
                />
              </button>
            </div>

            {/* Volume Slider */}
            {soundEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pl-8 space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Volume</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume * 100}
                  onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                           [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                           [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </motion.div>
            )}
          </div>

          {/* Haptic Feedback */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DevicePhoneMobileIcon className={`w-5 h-5 ${
                hapticEnabled ? 'text-emerald-400' : 'text-gray-500'
              }`} />
              <div>
                <div className="font-medium text-white">Haptic Feedback</div>
                <div className="text-xs text-gray-400">Vibration on mobile</div>
              </div>
            </div>
            <button
              onClick={handleHapticToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                hapticEnabled ? 'bg-emerald-500' : 'bg-gray-700'
              }`}
            >
              <motion.div
                animate={{ x: hapticEnabled ? 24 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg"
              />
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <button
            onClick={() => {
              onClose();
              onShowKeyboardShortcuts();
            }}
            className="w-full flex items-center justify-between p-3 bg-white/5 
                     hover:bg-white/10 rounded-xl transition-colors active:scale-95"
          >
            <div className="flex items-center gap-3">
              <CommandLineIcon className="w-5 h-5 text-gray-400" />
              <div className="text-left">
                <div className="font-medium text-white">Keyboard Shortcuts</div>
                <div className="text-xs text-gray-400">View all shortcuts</div>
              </div>
            </div>
            <span className="text-gray-500">→</span>
          </button>

          {/* Info */}
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center">
              Settings are saved locally in your browser
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
