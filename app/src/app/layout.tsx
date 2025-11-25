import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientWalletProvider } from "@/components/ClientWalletProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "react-hot-toast";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { DebugLogPanel } from "@/components/DebugLogPanel";
import { ConditionalNavbar } from "@/components/ConditionalNavbar";
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
              {/* Gradient Mesh Background - Global */}
              <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0C0C0C] via-[#1a1a1a] to-[#0C0C0C]" />
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#10B981] rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
                  <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
                  <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#10B981] rounded-full mix-blend-multiply filter blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
                </div>
                <div className="absolute inset-0 opacity-10">
                  <div 
                    className="h-full w-full"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, #10B981 1px, transparent 1px),
                        linear-gradient(to bottom, #10B981 1px, transparent 1px)
                      `,
                      backgroundSize: '50px 50px',
                    }}
                  />
                </div>
              </div>
              <ConditionalNavbar />
              <main id="main-content" className="relative z-10">
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
