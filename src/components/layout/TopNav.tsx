"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Activity } from "lucide-react";
import { MarketStatus } from "./MarketStatus";
import { useWalletStore } from "@/lib/stores/wallet";

const NAV_LINKS = [
  { href: "/trade", label: "Trade" },
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/receipts", label: "Receipts" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const { address, connected, connecting, connect, disconnect } = useWalletStore();

  return (
    <header className="sticky top-0 z-40 bg-surface-1 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-4 sm:gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
              <Activity className="w-4 h-4 text-accent" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-text-primary tracking-tight leading-tight">
                Vela
              </span>
              <span className="text-[10px] text-text-muted leading-tight hidden sm:block">
                Execution Intelligence
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    active
                      ? "text-text-primary bg-surface-2 font-medium"
                      : "text-text-muted hover:text-text-secondary hover:bg-surface-2/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Market status + Wallet */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden sm:block">
            <MarketStatus />
          </div>
          <div className="w-px h-5 bg-border hidden sm:block" />
          <button
            onClick={connected ? disconnect : connect}
            disabled={connecting}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-colors ${
              connected
                ? "border-accent/30 text-accent bg-accent/5 hover:bg-accent/10"
                : "border-border text-text-secondary hover:text-text-primary hover:border-border-active hover:bg-surface-2"
            }`}
          >
            <Wallet className="w-4 h-4" />
            {connecting
              ? "Connecting..."
              : connected && address
              ? `${address.slice(0, 6)}...${address.slice(-4)}`
              : "Connect Wallet"}
          </button>
        </div>
      </div>
    </header>
  );
}
