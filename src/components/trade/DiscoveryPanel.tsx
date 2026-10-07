"use client";

import type { DiscoveredRepresentation } from "@/lib/types";
import { NumberDisplay } from "@/components/shared/NumberDisplay";
import { StatusDot } from "@/components/shared/StatusDot";

interface DiscoveryPanelProps {
  ticker: string;
  representations: DiscoveredRepresentation[];
  selectedProvider: string | null;
  onSelect: (provider: string, tokenAddress: string) => void;
}

export function DiscoveryPanel({
  ticker,
  representations,
  selectedProvider,
  onSelect,
}: DiscoveryPanelProps) {
  if (representations.length === 0) {
    return (
      <div className="bg-surface-1 border border-border rounded-xl p-4">
        <p className="text-text-muted text-sm">No representations found for {ticker} on BSC</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Discovered Representations
        </h3>
      </div>
      <div className="divide-y divide-border/50">
        {representations.map((rep) => (
          <button
            key={rep.provider}
            onClick={() => onSelect(rep.provider, rep.tokenAddress)}
            className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
              selectedProvider === rep.provider
                ? "row-highlight"
                : "hover:bg-surface-2"
            }`}
          >
            <div className="flex items-center gap-3">
              <StatusDot status={rep.available ? "active" : "inactive"} />
              <div>
                <span className="text-sm text-text-primary font-medium">
                  {rep.provider}
                </span>
                <span className="ml-2 text-xs text-text-muted font-mono">
                  {rep.tokenSymbol}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <div className="text-xs text-text-muted">Share Price</div>
                <NumberDisplay
                  value={rep.impliedSharePrice}
                  format="currency"
                  className="text-sm"
                />
              </div>
              <div>
                <div className="text-xs text-text-muted">Deviation</div>
                <NumberDisplay
                  value={rep.priceDeviationPercent}
                  format="percent"
                  colored
                  showSign
                  className="text-sm"
                />
              </div>
              <div>
                <div className="text-xs text-text-muted">Liquidity</div>
                <span className={`text-sm font-mono ${
                  rep.liquidityRating === "high" ? "text-gain" :
                  rep.liquidityRating === "medium" ? "text-text-primary" :
                  rep.liquidityRating === "low" ? "text-warning" : "text-loss"
                }`}>
                  {rep.liquidityRating}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
