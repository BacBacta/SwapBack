"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  HomeIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  FireIcon,
  ClockIcon,
  Cog6ToothIcon,
  BellIcon,
  WalletIcon,
  LockClosedIcon,
  ChartPieIcon,
} from "@heroicons/react/24/outline";

const commands = [
  { id: "home", name: "Go to home", icon: HomeIcon, href: "/app", shortcut: "H" },
  { id: "swap", name: "Swap tokens", icon: ArrowsRightLeftIcon, href: "/app/swap", shortcut: "S" },
  { id: "dca", name: "Create DCA plan", icon: ChartBarIcon, href: "/app/dca", shortcut: "D" },
  { id: "lock", name: "Lock/Unlock tokens", icon: LockClosedIcon, href: "/app/lock", shortcut: "L" },
  { id: "buyback", name: "Claim buyback rewards", icon: FireIcon, href: "/app/buyback", shortcut: "B" },
  { id: "analytics", name: "View analytics", icon: ChartPieIcon, href: "/app/analytics", shortcut: "A" },
  { id: "history", name: "View transaction history", icon: ClockIcon, href: "/app/history", shortcut: "T" },
  { id: "settings", name: "Open settings", icon: Cog6ToothIcon, href: "/app/settings", shortcut: "," },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Open/Close with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearch("");
        setSelectedIndex(0);
        return;
      }

      if (!isOpen) return;

      // Navigate with arrows
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      }

      // Select with Enter
      if (e.key === "Enter" && filteredCommands[selectedIndex]) {
        e.preventDefault();
        router.push(filteredCommands[selectedIndex].href);
        setIsOpen(false);
        setSearch("");
      }

      // Close with Escape
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    },
    [isOpen, filteredCommands, selectedIndex, router]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4"
      onClick={() => setIsOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>

      {/* Command Palette */}
      <div
        className="relative w-full max-w-2xl bg-[#0C0C0C]/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-[0_0_40px_rgba(16,185,129,0.3)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-primary/20">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 mr-3" />
          <input
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 font-sans"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-mono text-gray-400 bg-gray-800/50 rounded border border-gray-700">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div className="max-h-96 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const Icon = cmd.icon;
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={cmd.id}
                  className={`
                    w-full flex items-center px-4 py-3 text-left transition-all
                    ${
                      isSelected
                        ? "bg-primary/10 border-l-2 border-primary"
                        : "hover:bg-primary/5"
                    }
                  `}
                  onClick={() => {
                    router.push(cmd.href);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Icon
                    className={`h-5 w-5 mr-3 ${
                      isSelected ? "text-primary" : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`flex-1 ${
                      isSelected ? "text-white" : "text-gray-300"
                    }`}
                  >
                    {cmd.name}
                  </span>
                  <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-mono text-gray-400 bg-gray-800/50 rounded border border-gray-700">
                    {cmd.shortcut}
                  </kbd>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-primary/20 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <kbd className="px-1.5 py-0.5 bg-gray-800/50 rounded border border-gray-700 mr-1">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center">
              <kbd className="px-1.5 py-0.5 bg-gray-800/50 rounded border border-gray-700 mr-1">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <span className="hidden sm:inline">
            <kbd className="px-1.5 py-0.5 bg-gray-800/50 rounded border border-gray-700">
              ⌘K
            </kbd>{" "}
            to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
