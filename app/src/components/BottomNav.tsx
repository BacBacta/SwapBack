"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  FireIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

const mobileNavItems = [
  { name: "Home", href: "/app", icon: HomeIcon },
  { name: "Swap", href: "/app/swap", icon: ArrowsRightLeftIcon },
  { name: "DCA", href: "/app/dca", icon: ChartBarIcon },
  { name: "Buyback", href: "/app/buyback", icon: FireIcon },
  { name: "History", href: "/app/history", icon: ClockIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0C0C0C]/95 backdrop-blur-xl border-t border-primary/20 safe-area-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex flex-col items-center justify-center flex-1 h-full
                transition-all duration-200
                ${isActive ? "text-primary" : "text-gray-400"}
              `}
            >
              <Icon
                className={`
                  h-6 w-6 mb-1
                  ${isActive ? "text-primary scale-110" : "text-gray-400"}
                `}
              />
              <span
                className={`
                  text-xs font-medium
                  ${isActive ? "text-primary" : "text-gray-400"}
                `}
              >
                {item.name}
              </span>
              {isActive && (
                <div className="absolute -top-0.5 h-0.5 w-12 bg-primary rounded-full"></div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
