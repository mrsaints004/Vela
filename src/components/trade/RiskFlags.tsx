"use client";

import type { PolicyResult } from "@/lib/types";
import { Check, AlertTriangle, X } from "lucide-react";

interface RiskFlagsProps {
  policy: PolicyResult;
}

const STATUS_ICON = {
  pass: Check,
  warn: AlertTriangle,
  fail: X,
};

const STATUS_COLOR = {
  pass: "text-gain",
  warn: "text-warning",
  fail: "text-loss",
};

export function RiskFlags({ policy }: RiskFlagsProps) {
  if (policy.checks.length === 0) return null;

  const passCount = policy.checks.filter((c) => c.status === "pass").length;

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Policy
        </h3>
        <span className="text-xs font-mono text-text-muted">
          {passCount}/{policy.checks.length} pass
        </span>
      </div>
      <div className="px-4 py-2 space-y-0.5">
        {policy.checks.map((check, i) => {
          const Icon = STATUS_ICON[check.status];
          return (
            <div key={i} className="flex items-center gap-2 py-1">
              <Icon className={`w-3 h-3 shrink-0 ${STATUS_COLOR[check.status]}`} />
              <span className="text-xs text-text-secondary flex-1">{check.name}</span>
              {check.status !== "pass" && check.message && (
                <span className="text-[10px] text-text-muted truncate max-w-[140px]">
                  {check.message}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {policy.action === "block" && (
        <div className="px-4 py-2 border-t border-border">
          <span className="text-xs text-loss">Execution blocked — fix failing checks</span>
        </div>
      )}
    </div>
  );
}
