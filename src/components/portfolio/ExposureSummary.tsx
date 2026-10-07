"use client";

interface Position {
  ticker: string;
  provider: string;
  balance: number;
}

interface ExposureSummaryProps {
  positions: Position[];
}

export function ExposureSummary({ positions }: ExposureSummaryProps) {
  if (positions.length === 0) return null;

  // Group by ticker for concentration
  const byTicker: Record<string, number> = {};
  for (const pos of positions) {
    byTicker[pos.ticker] = (byTicker[pos.ticker] || 0) + pos.balance;
  }

  const totalPositions = Object.keys(byTicker).length;
  const tickers = Object.entries(byTicker).sort((a, b) => b[1] - a[1]);
  const maxBalance = Math.max(...tickers.map(([, b]) => b));

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Exposure
        </h3>
        <span className="text-xs text-text-muted font-mono">
          {totalPositions} ticker{totalPositions !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {tickers.map(([ticker, balance]) => {
          const pct = maxBalance > 0 ? (balance / maxBalance) * 100 : 0;
          return (
            <div key={ticker}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-mono text-text-primary">{ticker}</span>
                <span className="font-mono text-text-muted tabular-nums">
                  {balance.toFixed(4)}
                </span>
              </div>
              <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
