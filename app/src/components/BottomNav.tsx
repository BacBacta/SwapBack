"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  HomeIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  FireIcon,
  LockClosedIcon,
  EllipsisHorizontalIcon,
  Cog6ToothIcon,
  ChartPieIcon,
  GiftIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  ArrowsRightLeftIcon as ArrowsRightLeftIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  FireIcon as FireIconSolid,
} from "@heroicons/react/24/solid";
import { Sheet, SheetContent } from "@/components/ui/Sheet";

const mobileNavItems = [
  { name: "Home", href: "/", icon: HomeIcon, iconSolid: HomeIconSolid },
  { name: "Swap", href: "/app/swap", icon: ArrowsRightLeftIcon, iconSolid: ArrowsRightLeftIconSolid },
  { name: "DCA", href: "/app/dca", icon: ChartBarIcon, iconSolid: ChartBarIconSolid },
  { name: "Buyback", href: "/app/buyback", icon: FireIcon, iconSolid: FireIconSolid },
];

const moreNavItems = [
  { name: "Lock Tokens", href: "/app/lock", icon: LockClosedIcon },
  { name: "My Rebates", href: "/app/rebates", icon: GiftIcon },
  { name: "Portfolio", href: "/app/portfolio", icon: ChartPieIcon },
  { name: "Settings", href: "/app/settings", icon: Cog6ToothIcon },
  { name: "Admin", href: "/app/admin", icon: ShieldCheckIcon, isAdmin: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0C0C0C]/95 backdrop-blur-xl border-t border-primary/20 pb-safe-or-4">
        <div className="flex justify-around items-center h-16 px-2">{mobileNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = isActive ? item.iconSolid : item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center gap-1
                  min-w-[64px] h-12 rounded-xl transition-all
                  active:scale-90
                  ${isActive ? "text-primary" : "text-gray-400 active:text-primary"}
                `}
              >
                {/* Icon with badge */}
                <div className="relative">
                  <Icon className="w-7 h-7" />
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 
                                    bg-primary rounded-full 
                                    animate-pulse" />
                  )}
                </div>
                
                {/* Label */}
                <span className={`
                  text-[10px] font-medium transition-all
                  ${isActive && "scale-110"}
                `}>
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center justify-center gap-1
                       min-w-[64px] h-12 rounded-xl transition-all
                       active:scale-90 text-gray-400 active:text-primary"
          >
            <EllipsisHorizontalIcon className="w-7 h-7" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Sheet */}
      <Sheet open={showMore} onOpenChange={setShowMore}>
        <SheetContent 
          side="right"
          className="w-[280px] bg-black/95 backdrop-blur-xl border-l border-primary/20"
        >
          <div className="pt-6 px-4">
            <h3 className="text-lg font-bold text-white mb-4">More Options</h3>
            <div className="space-y-1">
              {moreNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                const isAdminItem = 'isAdmin' in item && item.isAdmin;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${isAdminItem 
                        ? "border border-yellow-500/30 bg-yellow-500/5"
                        : ""
                      }
                      ${isActive 
                        ? isAdminItem 
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-primary/20 text-primary" 
                        : isAdminItem
                          ? "text-yellow-400/70 hover:bg-yellow-500/10 hover:text-yellow-400"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }
                    `}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-base font-medium">{item.name}</span>
                    {isAdminItem && (
                      <span className="ml-auto text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                        Authority
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
