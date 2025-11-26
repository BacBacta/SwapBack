"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Bars3Icon, 
  XMarkIcon,
  ArrowsRightLeftIcon,
  ClockIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  ChartPieIcon,
  HomeIcon
} from "@heroicons/react/24/outline";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const navItems = [
  { 
    href: "/app", 
    label: "Dashboard", 
    icon: HomeIcon 
  },
  { 
    href: "/app/swap", 
    label: "Swap", 
    icon: ArrowsRightLeftIcon 
  },
  { 
    href: "/app/dca", 
    label: "DCA", 
    icon: ClockIcon 
  },
  { 
    href: "/app/analytics", 
    label: "Analytics", 
    icon: ChartBarIcon 
  },
  { 
    href: "/app/lock", 
    label: "Lock Tokens", 
    icon: LockClosedIcon 
  },
  { 
    href: "/app/portfolio", 
    label: "Portfolio", 
    icon: ChartPieIcon 
  },
  { 
    href: "/app/settings", 
    label: "Settings", 
    icon: Cog6ToothIcon 
  }
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Hamburger Trigger - Mobile only */}
      <SheetTrigger asChild>
        <button 
          className="lg:hidden fixed top-4 left-4 z-40 
                     w-12 h-12 bg-emerald-500/10 backdrop-blur-xl
                     border border-emerald-500/30
                     rounded-full flex items-center justify-center
                     active:scale-95 transition-transform
                     shadow-lg shadow-emerald-500/20"
          aria-label="Open menu"
        >
          <Bars3Icon className="w-6 h-6 text-emerald-500" />
        </button>
      </SheetTrigger>

      {/* Sheet Content */}
      <SheetContent 
        side="left"
        className="w-[280px] bg-black/95 backdrop-blur-xl border-r border-emerald-500/20"
      >
        {/* Close Button */}
        <button 
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 w-10 h-10 
                     rounded-full bg-white/5 hover:bg-white/10 
                     flex items-center justify-center
                     transition-colors"
          aria-label="Close menu"
        >
          <XMarkIcon className="w-5 h-5 text-gray-400" />
        </button>

        {/* Logo/Title */}
        <div className="pt-6 px-4 mb-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
            SwapBack
          </h2>
          <p className="text-xs text-gray-500 mt-1">Decentralized Trading</p>
        </div>

        {/* Navigation Items */}
        <nav className="px-4 space-y-1 mb-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-all active:scale-95
                  ${isActive 
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }
                `}
              >
                <item.icon className="w-6 h-6 flex-shrink-0" />
                <span className="text-base font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Wallet Button at Bottom */}
        <div className="absolute bottom-6 left-4 right-4">
          <WalletMultiButton className="w-full !bg-[var(--primary)] !text-black hover:!bg-[var(--primary)]/90 !rounded-xl !font-semibold !py-3 !text-base" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
