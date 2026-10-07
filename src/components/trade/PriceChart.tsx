"use client";

import type { DiscoveredRepresentation } from "@/lib/types";

interface PriceChartProps {
  representations: DiscoveredRepresentation[];
  referencePrice: number | null;
}

export function PriceChart({ representations, referencePrice }: PriceChartProps) {
  if (representations.length === 0) return null;

  const prices = representations.map((r) => r.impliedSharePrice);
  const allPrices = referencePrice ? [...prices, referencePrice] : prices;
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 1;
  const padding = range * 0.2;
  const chartMin = min - padding;
  const chartMax = max + padding;
  const chartRange = chartMax - chartMin;

  function getPosition(price: number): number {
    return ((price - chartMin) / chartRange) * 100;
  }

  const sortedReps = [...representations].sort(
    (a, b) => a.impliedSharePrice - b.impliedSharePrice
  );

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Price Spread
        </h3>
        {referencePrice && (
          <span className="text-xs text-text-muted font-mono">
            Ref ${referencePrice.toFixed(2)}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="relative h-24">
          {/* Reference line */}
          {referencePrice && (
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-text-muted/40"
              style={{ left: `${getPosition(referencePrice)}%` }}
            />
          )}

          {/* Provider markers */}
          <div className="absolute inset-0 flex flex-col justify-center gap-4 pt-2">
            {sortedReps.map((rep) => {
              const pos = getPosition(rep.impliedSharePrice);
              const devColor = Math.abs(rep.priceDeviationPercent) > 2 ? "text-warning" : "text-text-secondary";

              return (
                <div key={rep.provider} className="relative h-5 flex items-center">
                  {/* Dot */}
                  <div
                    className="absolute w-2 h-2 rounded-full bg-accent"
                    style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
                  />
                  {/* Label */}
                  <div
                    className="absolute whitespace-nowrap"
                    style={{
                      left: `${pos}%`,
                      transform: pos > 65 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
                    }}
                  >
                    <span className="text-[10px] text-text-secondary">{rep.provider}</span>
                    <span className="text-[10px] font-mono text-text-muted ml-1.5">
                      ${rep.impliedSharePrice.toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-mono ml-1 ${devColor}`}>
                      {rep.priceDeviationPercent > 0 ? "+" : ""}
                      {rep.priceDeviationPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scale */}
        <div className="flex justify-between text-[10px] text-text-muted font-mono border-t border-border/50 pt-1.5 mt-1">
          <span>${chartMin.toFixed(2)}</span>
          <span>${chartMax.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
