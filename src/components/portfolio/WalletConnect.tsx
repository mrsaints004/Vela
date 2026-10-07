"use client";

import { useWalletStore } from "@/lib/stores/wallet";
import { Wallet, Shield, BarChart3, Receipt } from "lucide-react";

export function WalletConnect() {
  const { connect, connecting } = useWalletStore();

  return (
    <div className="space-y-8">
      <div className="bg-surface-1 border border-border rounded-xl p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
          <Wallet className="w-7 h-7 text-accent" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Connect your wallet
        </h2>
        <p className="text-sm text-text-muted mb-6 max-w-md mx-auto leading-relaxed">
          View your tokenized stock positions, track exposure across providers,
          and execute trades directly from your portfolio.
        </p>
        <button
          onClick={connect}
          disabled={connecting}
          className="px-8 py-3 rounded-xl text-sm font-medium bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 transition-colors disabled:opacity-50"
        >
          {connecting ? "Connecting..." : "Connect MetaMask"}
        </button>
        <p className="text-xs text-text-muted mt-3">
          BSC Mainnet (Chain ID: 56)
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: BarChart3, title: "Positions", desc: "View balances across bStocks, Ondo, and xStocks tokens" },
          { icon: Shield, title: "Exposure", desc: "Concentration analysis and provider diversification" },
          { icon: Receipt, title: "History", desc: "Full execution receipts with verifiable audit trails" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-surface-1 border border-border rounded-xl p-4">
            <Icon className="w-4 h-4 text-text-muted mb-2" />
            <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
            <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
