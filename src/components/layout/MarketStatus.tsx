"use client";

import { useEffect, useState } from "react";
import { useMarketStore } from "@/lib/stores/market";
import { StatusDot } from "@/components/shared/StatusDot";
import { Clock, Info } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  regular: "US Market Open",
  pre_market: "Pre-Market",
  post_market: "Post-Market",
  closed: "Market Closed",
  weekend: "Weekend",
  holiday: "Holiday",
};

const STATUS_CONTEXT: Record<string, string> = {
  regular: "Live reference prices from NYSE/NASDAQ",
  pre_market: "Limited volume — reference prices may shift at open",
  post_market: "After-hours — reference prices may shift at next open",
  closed: "Reference prices are from last close. On-chain prices may diverge.",
  weekend: "Markets reopen Monday. On-chain prices may diverge from Friday close.",
  holiday: "Markets closed for holiday. On-chain prices may diverge.",
};

export function MarketStatus() {
  const { status, fetchStatus } = useMarketStore();
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!status) {
    return <div className="skeleton h-5 w-28 rounded" />;
  }

  const dotStatus = status.isOpen ? "active" : status.referenceStale ? "warning" : "closed";
  const label = STATUS_LABELS[status.status] || status.status;
  const context = STATUS_CONTEXT[status.status] || "";

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
        onClick={() => setShowContext(!showContext)}
        onBlur={() => setTimeout(() => setShowContext(false), 200)}
      >
        <StatusDot status={dotStatus} pulse={status.isOpen} />
        <span className="text-text-secondary">{label}</span>
        {status.referenceStale && status.staleDuration != null && status.staleDuration > 0 && (
          <span className="text-text-muted text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {status.staleDuration.toFixed(0)}h stale
          </span>
        )}
        <Info className="w-3 h-3 text-text-muted" />
      </button>

      {/* Context tooltip */}
      {showContext && context && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-surface-2 border border-border rounded-xl p-3 shadow-lg shadow-black/20 z-50">
          <p className="text-xs text-text-secondary leading-relaxed">{context}</p>
          {!status.isOpen && (
            <p className="text-xs text-text-muted mt-2">
              Trades can still execute, but quoted prices may differ from traditional market prices.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
