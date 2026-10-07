"use client";

import { useState } from "react";
import { useReceiptsStore } from "@/lib/stores/receipts";
import { ReceiptList } from "@/components/receipts/ReceiptList";
import { ReceiptDetail } from "@/components/receipts/ReceiptDetail";
import type { VelaReceipt } from "@/lib/types";
import { FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ReceiptsPage() {
  const { receipts } = useReceiptsStore();
  const [selected, setSelected] = useState<VelaReceipt | null>(null);

  if (receipts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-surface-1 border border-border rounded-xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-5">
            <FileText className="w-7 h-7 text-text-muted" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            No execution receipts yet
          </h2>
          <p className="text-sm text-text-muted mb-6 max-w-md mx-auto leading-relaxed">
            Every trade you execute through Vela generates a verifiable receipt
            with a complete audit trail — intent, selection reasoning, simulation results,
            and final execution details.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 transition-colors"
          >
            Start Trading
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight mb-1">
          Execution Receipts
        </h1>
        <p className="text-sm text-text-muted">
          <span className="font-mono text-text-secondary">{receipts.length}</span> receipt{receipts.length !== 1 ? "s" : ""} —
          each with full audit trail from intent to execution.
        </p>
      </div>

      {selected ? (
        <ReceiptDetail receipt={selected} onClose={() => setSelected(null)} />
      ) : (
        <ReceiptList receipts={receipts} onSelect={setSelected} />
      )}
    </div>
  );
}
