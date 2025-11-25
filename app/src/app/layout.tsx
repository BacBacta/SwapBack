import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientWalletProvider } from "@/components/ClientWalletProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "react-hot-toast";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { DebugLogPanel } from "@/components/DebugLogPanel";
import { Navbar } from "@/components/Navbar";
import "@/lib/patchBN";
// import { WalletConnectionGuide } from "@/components/WalletConnectionGuide";
// import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
// import { NetworkInfoModal } from "@/components/NetworkInfoModal";

const inter = Inter({ subsets: ["latin"] });

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
              <Navbar />
              <main id="main-content">
                {children}
              </main>
              {/* <WalletConnectionGuide /> */}
              {/* <NetworkStatusIndicator /> */}
              {/* <NetworkInfoModal /> */}
              <Toaster
                position="bottom-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: "#333",
                    color: "#fff",
                  },
                  success: {
                    iconTheme: {
                      primary: "#10b981",
                      secondary: "#fff",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#ef4444",
                      secondary: "#fff",
                    },
                  },
                }}
              />
              <DebugLogPanel />
            </ClientWalletProvider>
          </QueryProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
// Build timestamp: 1761769420
