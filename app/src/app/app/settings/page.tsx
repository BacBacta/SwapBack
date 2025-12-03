"use client";

import { motion } from "framer-motion";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-8 text-center sm:text-left"
      >
        <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">Settings</h1>
        <p className="text-gray-400 text-sm sm:text-base">Manage your preferences and account settings</p>
      </motion.div>

      <div className="space-y-4 sm:space-y-6">
        {/* General Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="swap-card p-4 sm:p-6"
        >
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">General</h2>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
              <div>
                <div className="font-medium text-sm sm:text-base">Slippage Tolerance</div>
                <div className="text-xs sm:text-sm text-gray-400">Default slippage for all swaps</div>
              </div>
              <select className="input-field w-full sm:w-32">
                <option>0.5%</option>
                <option>1%</option>
                <option>2%</option>
                <option>Custom</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
              <div>
                <div className="font-medium text-sm sm:text-base">Transaction Deadline</div>
                <div className="text-xs sm:text-sm text-gray-400">Minutes until transaction expires</div>
              </div>
              <input
                type="number"
                className="input-field w-full sm:w-32"
                defaultValue={20}
              />
            </div>
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="swap-card p-4 sm:p-6"
        >
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Notifications</h2>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm sm:text-base">Transaction Alerts</div>
                <div className="text-xs sm:text-sm text-gray-400">Get notified on transaction status</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary flex-shrink-0">
                <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm sm:text-base">DCA Execution</div>
                <div className="text-xs sm:text-sm text-gray-400">Notify when DCA orders execute</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary flex-shrink-0">
                <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Advanced */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="swap-card p-4 sm:p-6"
        >
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Advanced</h2>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm sm:text-base">Expert Mode</div>
                <div className="text-xs sm:text-sm text-gray-400">Enable advanced trading features</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-600 flex-shrink-0">
                <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm sm:text-base">Auto Router</div>
                <div className="text-xs sm:text-sm text-gray-400">Automatically find best routes</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary flex-shrink-0">
                <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
