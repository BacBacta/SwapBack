"use client";

import { motion } from "framer-motion";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">Manage your preferences and account settings</p>
      </motion.div>

      <div className="space-y-6">
        {/* General Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="swap-card"
        >
          <h2 className="text-xl font-bold mb-4">General</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Slippage Tolerance</div>
                <div className="text-sm text-gray-400">Default slippage for all swaps</div>
              </div>
              <select className="input-field w-32">
                <option>0.5%</option>
                <option>1%</option>
                <option>2%</option>
                <option>Custom</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Transaction Deadline</div>
                <div className="text-sm text-gray-400">Minutes until transaction expires</div>
              </div>
              <input
                type="number"
                className="input-field w-32"
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
          className="swap-card"
        >
          <h2 className="text-xl font-bold mb-4">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Transaction Alerts</div>
                <div className="text-sm text-gray-400">Get notified on transaction status</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary">
                <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">DCA Execution</div>
                <div className="text-sm text-gray-400">Notify when DCA orders execute</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary">
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
          className="swap-card"
        >
          <h2 className="text-xl font-bold mb-4">Advanced</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Expert Mode</div>
                <div className="text-sm text-gray-400">Enable advanced trading features</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-600">
                <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Auto Router</div>
                <div className="text-sm text-gray-400">Automatically find best routes</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary">
                <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
