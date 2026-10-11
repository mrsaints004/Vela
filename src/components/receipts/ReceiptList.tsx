"use client";

import type { VelaReceipt, DecisionReceipt } from "@/lib/types";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { NumberDisplay } from "@/components/shared/NumberDisplay";
import { StatusDot } from "@/components/shared/StatusDot";


type AnyReceipt = DecisionReceipt | VelaReceipt;

function isDecisionReceipt(r: AnyReceipt): r is DecisionReceipt {
  return "policySnapshot" in r;
}

interface ReceiptListProps {
  receipts: AnyReceipt[];
  onSelect: (receipt: AnyReceipt) => void;
}

export function ReceiptList({ receipts, onSelect }: ReceiptListProps) {
  const columns: Column<AnyReceipt>[] = [
    {
      key: "timestamp",
      label: "Time",
      render: (row) => (
        <span className="text-xs text-text-muted font-mono">
          {new Date(row.timestamp).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.timestamp,
    },
    {
      key: "intent",
      label: "Intent",
      render: (row) => (
        <span className="text-text-primary">
          <span className="font-medium">{row.intent.action.toUpperCase()}</span>{" "}
          <span className="font-mono text-accent">
            {row.intent.unit === "usd"
              ? `$${row.intent.amount}`
              : `${row.intent.amount} sh`}
          </span>{" "}
          <span className="font-mono">{row.intent.ticker}</span>
        </span>
      ),
    },
    {
      key: "selectedProvider",
      label: "Provider",
      render: (row) => (
        <span className="text-text-secondary">{row.selectedProvider}</span>
      ),
    },
    {
      key: "quote",
      label: "Price",
      align: "right",
      mono: true,
      render: (row) =>
        row.quote ? (
          <NumberDisplay value={row.quote.expectedPrice} format="currency" />
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "mode",
      label: "Mode",
      align: "center",
      render: (row) => {
        if (isDecisionReceipt(row)) {
          return <span className="text-[10px] text-text-muted">{row.digest ? row.executionMode : 'legacy'}</span>;
        }
        return <span className="text-text-muted text-xs">—</span>;
      },
    },
    {
      key: "policy",
      label: "Policy",
      align: "center",
      render: (row) => {
        if (isDecisionReceipt(row)) {
          return (
            <StatusDot
              status={
                row.policyEvaluation.action === "allow" ? "active" :
                row.policyEvaluation.action === "warn" ? "warning" : "fail"
              }
            />
          );
        }
        return (
          <StatusDot
            status={row.policy.action === "allow" ? "active" : row.policy.action === "warn" ? "warning" : "fail"}
          />
        );
      },
    },
    {
      key: "execution",
      label: "Status",
      align: "center",
      render: (row) => {
        const status=isDecisionReceipt(row)&&row.digest?row.outcome:'unverified';
        return <span className={status==='confirmed'?'text-gain text-xs':status==='failed'||status==='refused'?'text-loss text-xs':'text-text-muted text-xs'}>{status||'unverified'}</span>;
      },
    },
  ];

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <DataTable
        columns={columns}
        data={receipts}
        onRowClick={onSelect}
        emptyMessage="No decision receipts yet. Get an execution preview to generate one."
      />
    </div>
  );
}
