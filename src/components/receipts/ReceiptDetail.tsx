"use client";

import type { VelaReceipt } from "@/lib/types";
import { NumberDisplay } from "@/components/shared/NumberDisplay";
import { StatusDot } from "@/components/shared/StatusDot";
import { X } from "lucide-react";

interface ReceiptDetailProps {
  receipt: VelaReceipt;
  onClose: () => void;
}

export function ReceiptDetail({ receipt, onClose }: ReceiptDetailProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Receipt
          </h3>
          <span className="text-xs text-text-muted font-mono">{receipt.id}</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-secondary">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 text-sm">
        {/* Intent */}
        <Section title="Intent">
          <Row label="Raw" value={receipt.intent.raw} mono />
          <Row label="Action" value={receipt.intent.action.toUpperCase()} />
          <Row label="Ticker" value={receipt.intent.ticker} mono />
          <Row
            label="Amount"
            value={
              receipt.intent.unit === "usd"
                ? `$${receipt.intent.amount.toLocaleString()}`
                : `${receipt.intent.amount} shares`
            }
            mono
          />
        </Section>

        {/* Selection */}
        <Section title="Selection">
          <Row label="Provider" value={receipt.selectedProvider} />
          <Row label="Recommendation" value={receipt.recommendation} />
          {receipt.factors.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {receipt.factors.map((f, i) => (
                <span key={i} className="text-xs text-text-muted">
                  {f.label}: <span className="font-mono">{f.value}</span>
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* Quote */}
        {receipt.quote && (
          <Section title="Quote">
            <Row label="Expected Price" mono>
              <NumberDisplay value={receipt.quote.expectedPrice} format="currency" />
            </Row>
            <Row label="Output" mono>
              <NumberDisplay value={receipt.quote.toAmount} format="decimal" decimals={6} />
            </Row>
            <Row label="Price Impact" mono>
              <NumberDisplay value={receipt.quote.priceImpact} format="percent" colored />
            </Row>
            <Row label="Route" value={receipt.quote.routes.join(" → ")} mono />
          </Section>
        )}

        {/* Simulation */}
        {receipt.simulation && (
          <Section title="Simulation">
            <div className="flex items-center gap-2">
              <StatusDot status={receipt.simulation.status === "SUCCESS" ? "active" : "fail"} />
              <span className={receipt.simulation.status === "SUCCESS" ? "text-gain" : "text-loss"}>
                {receipt.simulation.status}
              </span>
              {receipt.simulation.failReason && (
                <span className="text-text-muted text-xs">— {receipt.simulation.failReason}</span>
              )}
            </div>
          </Section>
        )}

        {/* Execution */}
        {receipt.execution && (
          <Section title="Execution">
            <Row label="Status">
              <StatusDot status={receipt.execution.status === "confirmed" ? "active" : "fail"} />
              <span className="ml-1.5">{receipt.execution.status}</span>
            </Row>
            {receipt.execution.txHash && (
              <Row label="TX Hash">
                <a
                  href={`https://bscscan.com/tx/${receipt.execution.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-accent hover:underline text-xs"
                >
                  {receipt.execution.txHash.slice(0, 10)}...{receipt.execution.txHash.slice(-8)}
                </a>
              </Row>
            )}
          </Section>
        )}

        {/* Policy */}
        <Section title="Policy">
          <span className={`text-xs font-medium ${
            receipt.policy.action === "allow" ? "text-gain" :
            receipt.policy.action === "warn" ? "text-warning" : "text-loss"
          }`}>
            {receipt.policy.action.toUpperCase()}
          </span>
          <div className="mt-1 space-y-1">
            {receipt.policy.checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <StatusDot status={c.status} />
                <span className="text-text-muted w-24">{c.name}</span>
                <span className="text-text-secondary">{c.message}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Timestamp */}
        <div className="text-xs text-text-muted border-t border-border/50 pt-3">
          {new Date(receipt.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/50 pt-3 first:border-t-0 first:pt-0">
      <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      {children || (
        <span className={`text-text-primary ${mono ? "font-mono text-xs" : ""}`}>
          {value}
        </span>
      )}
    </div>
  );
}
