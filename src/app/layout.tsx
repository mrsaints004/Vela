import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/layout/TopNav";

export const metadata: Metadata = {
  title: "Vela — Tokenized Stock Execution Intelligence",
  description:
    "Discover, compare, simulate, and execute tokenized stock trades on BSC with verifiable receipts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <TopNav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border px-4 sm:px-6 py-5 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="text-xs text-text-muted">
                  Vela — Execution intelligence for tokenized stocks
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className="font-mono">BSC Mainnet</span>
                <span className="hidden sm:inline">·</span>
                <span>3 Providers</span>
                <span className="hidden sm:inline">·</span>
                <span>Non-custodial</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
