"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";

export function ConditionalNavbar() {
  const pathname = usePathname();
  
  // Don't show Navbar on /app/* routes (they have their own header in AppLayout)
  if (pathname?.startsWith("/app")) {
    return null;
  }
  
  return <Navbar />;
}
