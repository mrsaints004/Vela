"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketSearch } from "@/components/markets/MarketSearch";
import { MarketTable } from "@/components/markets/MarketTable";
import { SkeletonTable } from "@/components/shared/SkeletonLoader";
import { StatusDot } from "@/components/shared/StatusDot";
import { Layers } from "lucide-react";

export default function MarketsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const res = await fetch("/api/markets");
      if (!res.ok) throw new Error("Failed to fetch markets");
      return res.json();
    },
  });

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const filteredTickers = data?.tickers?.filter((t: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toUpperCase();
    return (
      t.ticker.toUpperCase().includes(q) ||
      t.name.toUpperCase().includes(q)
    );
  }) ?? [];

  // Count stats
  const multiProvider = data?.tickers?.filter((t: any) => t.providerCount >= 2)?.length ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight mb-1">
          Markets
        </h1>
        <p className="text-sm text-text-muted">
          Browse all tokenized equities on BSC. Click any ticker to trade.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-text-muted" />
          <span className="text-text-secondary">
            <span className="font-mono text-text-primary">{data?.total ?? "--"}</span> equities
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status="active" />
          <span className="text-text-secondary">
            <span className="font-mono text-text-primary">{multiProvider}</span> multi-provider
          </span>
        </div>
        {data?.marketStatus && (
          <div className="flex items-center gap-2">
            <StatusDot
              status={data.marketStatus.isOpen ? "active" : "closed"}
              pulse={data.marketStatus.isOpen}
            />
            <span className="text-text-secondary">
              US Market {data.marketStatus.isOpen ? "Open" : "Closed"}
            </span>
          </div>
        )}
      </div>

      {/* Search */}
      <MarketSearch onSearch={handleSearch} />

      {/* Results count */}
      {searchQuery && (
        <div className="text-xs text-text-muted">
          {filteredTickers.length} result{filteredTickers.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-surface-1 border border-border rounded-xl">
          <SkeletonTable rows={10} cols={5} />
        </div>
      ) : (
        <MarketTable tickers={filteredTickers} />
      )}
    </div>
  );
}
