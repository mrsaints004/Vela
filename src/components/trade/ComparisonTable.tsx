"use client";

import type { EffectiveCost } from "@/lib/types";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { NumberDisplay } from "@/components/shared/NumberDisplay";

interface ComparisonTableProps {
  costs: EffectiveCost[];
  selectedProvider: string | null;
  onSelect: (provider: string) => void;
}

export function ComparisonTable({ costs, selectedProvider, onSelect }: ComparisonTableProps) {
  const columns: Column<EffectiveCost>[] = [
    {
      key: "rank",
      label: "#",
      align: "center",
      mono: true,
      render: (row) => (
        <span className="text-text-muted">{row.rank}</span>
      ),
    },
    {
      key: "provider",
      label: "Provider",
      render: (row) => (
        <span className="font-medium text-text-primary">{row.provider}</span>
      ),
    },
    {
      key: "quotedPrice",
      label: "Share Price",
      align: "right",
      mono: true,
      sortable: true,
      sortValue: (row) => row.quotedPrice,
      render: (row) => <NumberDisplay value={row.quotedPrice} format="currency" />,
    },
    {
      key: "priceDeviationPercent",
      label: "Deviation",
      align: "right",
      mono: true,
      sortable: true,
      sortValue: (row) => Math.abs(row.priceDeviationPercent),
      render: (row) => (
        <NumberDisplay value={row.priceDeviationPercent} format="percent" colored showSign />
      ),
    },
    {
      key: "liquidityRating",
      label: "Liquidity",
      align: "right",
      render: (row) => (
        <span className={`text-xs font-mono ${
          row.liquidityRating === "high" ? "text-gain" :
          row.liquidityRating === "medium" ? "text-text-secondary" :
          row.liquidityRating === "low" ? "text-warning" : "text-loss"
        }`}>
          {row.liquidityRating}
        </span>
      ),
    },
    {
      key: "estimatedSlippage",
      label: "Slippage",
      align: "right",
      mono: true,
      sortable: true,
      sortValue: (row) => row.estimatedSlippage,
      render: (row) => <NumberDisplay value={row.estimatedSlippage} format="percent" />,
    },
    {
      key: "totalEffectiveCost",
      label: "Eff. Cost",
      align: "right",
      mono: true,
      sortable: true,
      sortValue: (row) => row.totalEffectiveCost,
      render: (row) => <NumberDisplay value={row.totalEffectiveCost} format="currency" />,
    },
  ];

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Provider Comparison
        </h3>
      </div>
      <DataTable
        columns={columns}
        data={costs}
        highlightRow={(row) => row.rank === 1 || row.provider === selectedProvider}
        onRowClick={(row) => onSelect(row.provider)}
        emptyMessage="No provider data available"
      />
    </div>
  );
}
