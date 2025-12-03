import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientWalletProvider } from "@/components/ClientWalletProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "sonner";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { ConditionalNavbar } from "@/components/ConditionalNavbar";
import "@/lib/patchBN";

// 🚀 Lazy load heavy debug components
import dynamic from "next/dynamic";
const DebugLogPanel = dynamic(
  () => import("@/components/DebugLogPanel").then(mod => ({ default: mod.DebugLogPanel })),
  { ssr: false }
);

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap', // 🚀 Faster font loading
  preload: true,
});

export const metadata: Metadata = {
  title: "SwapBack - Best Execution Router for Solana",
  description:
    "Optimisez vos swaps sur Solana et gagnez des remises avec SwapBack",
  icons: {
    icon: [
      {
        url: "/icons/icon_swapback.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/icons/icon_swapback.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Skip to main content - Accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <GlobalErrorBoundary>
          <QueryProvider>
            <ClientWalletProvider>
              {/* 🚀 Optimized Background - CSS only, no JS animation */}
              <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0C0C0C] via-[#1a1a1a] to-[#0C0C0C]">
                {/* Static gradient orbs - GPU accelerated with will-change */}
                <div className="absolute inset-0 opacity-15 will-change-transform">
                  <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#10B981] rounded-full mix-blend-multiply filter blur-3xl" />
                  <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-3xl" />
                  <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#10B981] rounded-full mix-blend-multiply filter blur-3xl" />
                </div>
                {/* Grid - Pure CSS */}
                <div 
                  className="absolute inset-0 opacity-5"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #10B981 1px, transparent 1px),
                      linear-gradient(to bottom, #10B981 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px',
                  }}
                />
              </div>
              <ConditionalNavbar />
              <main id="main-content" className="relative z-10">
                {children}
              </main>
              <Toaster 
                position="top-center"
                theme="dark"
                richColors
                closeButton
                toastOptions={{
                  style: {
                    background: 'rgba(0, 0, 0, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    color: '#fff',
                  },
                  className: 'sonner-toast',
                }}
              />
              {/* 🚀 Debug panel only in development */}
              {process.env.NODE_ENV === 'development' && <DebugLogPanel />}
            </ClientWalletProvider>
          </QueryProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
