"use client";

import Link from "next/link";
import {useTradeStore} from "@/lib/stores/trade";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { NumberDisplay } from "@/components/shared/NumberDisplay";

interface Position {
  ticker: string;
  symbol: string;
  provider: string;
  balance: number;
  contractAddress:string;
}

interface PositionsListProps {
  positions: Position[];
}

export function PositionsList({ positions }: PositionsListProps) {
  const mode=useTradeStore(s=>s.executionMode);
  const busy=useTradeStore(s=>['executing','verifying','quoting'].includes(s.step));
  const columns: Column<Position>[] = [
    {
      key: "ticker",
      label: "Ticker",
      render: (row) => (
        <span className="font-mono font-medium text-text-primary">{row.ticker}</span>
      ),
    },
    {
      key: "symbol",
      label: "Token",
      render: (row) => (
        <span className="text-xs text-text-secondary font-mono">{row.symbol}</span>
      ),
    },
    {
      key: "provider",
      label: "Provider",
      render: (row) => (
        <span className="text-text-secondary">{row.provider}</span>
      ),
    },
    {
      key: "balance",
      label: "Balance",
      align: "right",
      mono: true,
      sortable: true,
      sortValue: (row) => row.balance,
      render: (row) => (
        <NumberDisplay value={row.balance} format="decimal" decimals={6} />
      ),
    },
    {key:'sell',label:'Action',render:row=>busy?<span className="text-xs text-text-secondary">Trade in progress</span>:<Link className="min-h-11 inline-flex items-center text-accent text-xs" href={`/trade?${new URLSearchParams({ticker:row.ticker,action:'sell',token:row.contractAddress,wallet:mode})}`}>Review sell all</Link>},
  ];

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Positions
        </h3>
      </div>
      <DataTable
        columns={columns}
        data={positions}
        emptyMessage="No positions found"
      />
    </div>
  );
}
