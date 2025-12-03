"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  HomeIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  FireIcon,
  ClockIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  ChartPieIcon,
  GiftIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const navigationItems = [
  { name: "Home", href: "/app", icon: HomeIcon },
  { name: "Swap", href: "/app/swap", icon: ArrowsRightLeftIcon },
  { name: "DCA", href: "/app/dca", icon: ChartBarIcon },
  { name: "Lock/Unlock", href: "/app/lock", icon: LockClosedIcon },
  { name: "My Rebates", href: "/app/rebates", icon: GiftIcon },
  { name: "Buyback", href: "/app/buyback", icon: FireIcon },
  { name: "Analytics", href: "/app/analytics", icon: ChartPieIcon },
  { name: "History", href: "/app/history", icon: ClockIcon },
  { name: "Settings", href: "/app/settings", icon: Cog6ToothIcon },
  { name: "Admin", href: "/app/admin", icon: ShieldCheckIcon, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:z-50 md:w-56 lg:w-64 bg-[#0C0C0C]/95 backdrop-blur-xl border-r border-primary/20">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Logo */}
        <div className="flex items-center h-16 flex-shrink-0 px-6 border-b border-primary/20">
          <Link href="/" className="flex items-center space-x-3 group">
            <Image
              src="/icons/icon_swapback.svg"
              alt="SwapBack"
              width={32}
              height={32}
              className="transition-transform group-hover:scale-110"
              priority
            />
            <span className="text-xl font-bold">
              SWAP<span className="text-primary">BACK</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const isAdminLink = 'adminOnly' in item && item.adminOnly;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium rounded-lg
                  transition-all duration-200 group
                  ${
                    isActive
                      ? isAdminLink 
                        ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                        : "bg-primary/10 text-primary border border-primary/30"
                      : isAdminLink
                        ? "text-yellow-400/70 hover:bg-yellow-500/5 hover:text-yellow-400 border border-transparent"
                        : "text-gray-300 hover:bg-primary/5 hover:text-primary border border-transparent"
                  }
                `}
              >
                <Icon
                  className={`
                    mr-3 h-5 w-5 flex-shrink-0
                    ${isActive 
                      ? isAdminLink ? "text-yellow-400" : "text-primary" 
                      : isAdminLink 
                        ? "text-yellow-500/50 group-hover:text-yellow-400" 
                        : "text-gray-400 group-hover:text-primary"
                    }
                  `}
                />
                {item.name}
                {isAdminLink && (
                  <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                    🔐
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Network Status Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-primary/20 bg-primary/5">
          <div className="text-xs text-gray-400">
            <div className="flex justify-between mb-1">
              <span>Network</span>
              <span className="text-primary font-mono">Solana</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className="flex items-center">
                <span className="w-2 h-2 bg-primary rounded-full mr-1 animate-pulse"></span>
                <span className="text-primary font-mono">Live</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
