"use client";

import { DataTable, type Column } from "@/components/shared/DataTable";
import { NumberDisplay } from "@/components/shared/NumberDisplay";
import { StatusDot } from "@/components/shared/StatusDot";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

interface MarketTicker {
  ticker: string;
  name: string;
  providerCount: number;
  providers: Array<{ provider: string; symbol: string }>;
  referencePrice: number | null;
  marketCap: string | null;
  isOpen: boolean | null;
}

interface MarketTableProps {
  tickers: MarketTicker[];
}

export function MarketTable({ tickers }: MarketTableProps) {
  const router = useRouter();

  const columns: Column<MarketTicker>[] = [
    {
      key: "ticker",
      label: "Ticker",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-text-primary">{row.ticker}</span>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.ticker,
    },
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <span className="text-text-secondary">{row.name}</span>
      ),
    },
    {
      key: "providerCount",
      label: "Providers",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          <span className="font-mono text-text-primary">{row.providerCount}</span>
          <div className="flex gap-1">
            {row.providers.map((p) => (
              <span
                key={p.provider}
                className="text-[10px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded"
              >
                {p.provider}
              </span>
            ))}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.providerCount,
    },
    {
      key: "referencePrice",
      label: "Ref. Price",
      align: "right",
      mono: true,
      sortable: true,
      sortValue: (row) => row.referencePrice ?? 0,
      render: (row) =>
        row.referencePrice ? (
          <NumberDisplay value={row.referencePrice} format="currency" />
        ) : (
          <span className="text-text-muted">--</span>
        ),
    },
    {
      key: "isOpen",
      label: "Status",
      align: "center",
      render: (row) => (
        <StatusDot
          status={row.isOpen === true ? "active" : row.isOpen === false ? "closed" : "neutral"}
          pulse={row.isOpen === true}
        />
      ),
    },
    {
      key: "trade",
      label: "",
      align: "right",
      render: (row) => (
        <span className="text-text-muted group-hover:text-accent transition-colors">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      ),
    },
  ];

  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      <DataTable
        columns={columns}
        data={tickers}
        onRowClick={(row) => router.push(`/trade?ticker=${row.ticker}`)}
        emptyMessage="No tokenized equities found"
      />
    </div>
  );
}
