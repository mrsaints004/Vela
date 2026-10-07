"use client";

import { useQuery } from "@tanstack/react-query";
import { useWalletStore } from "@/lib/stores/wallet";
import { WalletConnect } from "@/components/portfolio/WalletConnect";
import { PositionsList } from "@/components/portfolio/PositionsList";
import { ExposureSummary } from "@/components/portfolio/ExposureSummary";
import { SkeletonTable } from "@/components/shared/SkeletonLoader";
import { Wallet } from "lucide-react";

export default function PortfolioPage() {
  const { address, connected } = useWalletStore();

  const { data, isLoading } = useQuery({
    queryKey: ["portfolio", address],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio?wallet=${address}`);
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      return res.json();
    },
    enabled: !!address,
  });

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <WalletConnect />
      </div>
    );
  }

  const holdings = data?.holdings || [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight mb-1">
          Portfolio
        </h1>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Wallet className="w-3.5 h-3.5" />
          <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          <span className="text-text-muted">on BSC</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="skeleton h-6 w-32 mb-3" />
            <div className="skeleton h-4 w-48" />
          </div>
          <div className="bg-surface-1 border border-border rounded-xl">
            <SkeletonTable rows={4} cols={4} />
          </div>
        </div>
      ) : holdings.length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-xl p-10 text-center">
          <p className="text-sm text-text-muted mb-1">No tokenized stock positions found</p>
          <p className="text-xs text-text-muted">
            Execute a trade to see your positions here.
          </p>
        </div>
      ) : (
        <>
          <ExposureSummary positions={holdings} />
          <PositionsList positions={holdings} />
        </>
      )}
    </div>
  );
}
