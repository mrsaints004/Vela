"use client";

import type { TradeFlowStep, QuoteSnapshot, SimulationSnapshot, PolicyResult } from "@/lib/types";
import { NumberDisplay } from "@/components/shared/NumberDisplay";
import { StatusDot } from "@/components/shared/StatusDot";
import { Skeleton } from "@/components/shared/SkeletonLoader";

interface ExecutionFlowProps {
  step: TradeFlowStep;
  quote: QuoteSnapshot | null;
  simulation: SimulationSnapshot | null;
  policy: PolicyResult | null;
  onApprove: () => void;
  onExecute: () => void;
  txHash: string | null;
}

const STEPS = [
  { id: "quoting", label: "Quote" },
  { id: "simulating", label: "Simulate" },
  { id: "approving", label: "Approve" },
  { id: "executing", label: "Execute" },
  { id: "receipt", label: "Receipt" },
] as const;

function getStepStatus(
  stepId: string,
  currentStep: TradeFlowStep
): "completed" | "active" | "pending" {
  const stepOrder = STEPS.map((s) => s.id);
  const currentIdx = stepOrder.indexOf(currentStep as any);
  const stepIdx = stepOrder.indexOf(stepId as any);
  if (stepIdx < 0 || currentIdx < 0) return "pending";
  if (stepIdx < currentIdx) return "completed";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export function ExecutionFlow({
  step,
  quote,
  simulation,
  policy,
  onApprove,
  onExecute,
  txHash,
}: ExecutionFlowProps) {
  const isInFlow = ["quoting", "simulating", "approving", "executing", "receipt"].includes(step);
  if (!isInFlow) return null;

  return (
    <div className="bg-surface-1 border border-border rounded-xl">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Execution Flow
        </h3>
      </div>

      {/* Step indicators */}
      <div className="px-4 py-3 flex items-center gap-1 border-b border-border/50">
        {STEPS.map((s, i) => {
          const status = getStepStatus(s.id, step);
          return (
            <div key={s.id} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5">
                <StatusDot
                  status={
                    status === "completed" ? "active" :
                    status === "active" ? "warning" : "idle"
                  }
                  pulse={status === "active"}
                />
                <span className={`text-xs ${
                  status === "active" ? "text-text-primary font-medium" :
                  status === "completed" ? "text-text-secondary" : "text-text-muted"
                }`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span className="text-text-muted mx-1">&rarr;</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Quote details */}
        {step === "quoting" && !quote && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}

        {quote && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Expected Output</span>
              <NumberDisplay value={quote.toAmount} format="decimal" decimals={6} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Expected Price</span>
              <NumberDisplay value={quote.expectedPrice} format="currency" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Price Impact</span>
              <NumberDisplay value={quote.priceImpact} format="percent" colored />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Gas Fee</span>
              <NumberDisplay value={quote.gasFee} format="currency" decimals={4} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Route</span>
              <span className="text-xs font-mono text-text-secondary">
                {quote.routes.join(" → ")}
              </span>
            </div>
            {quote.isHoneyPot && (
              <div className="text-xs text-loss font-medium mt-1">
                Warning: Token flagged as potential honeypot
              </div>
            )}
          </div>
        )}

        {/* Simulation result */}
        {simulation && (
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center gap-2 text-sm">
              <StatusDot status={simulation.status === "SUCCESS" ? "active" : "fail"} />
              <span className={simulation.status === "SUCCESS" ? "text-gain" : "text-loss"}>
                Simulation {simulation.status.toLowerCase()}
              </span>
              {simulation.failReason && (
                <span className="text-xs text-text-muted">— {simulation.failReason}</span>
              )}
            </div>
          </div>
        )}

        {/* Approve button */}
        {step === "approving" && (
          <div className="border-t border-border/50 pt-3">
            <button
              onClick={onApprove}
              disabled={policy?.action === "block"}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {policy?.action === "block" ? "Blocked by Policy" : "Approve & Execute"}
            </button>
            {policy?.action === "block" && (
              <p className="text-xs text-loss mt-2">
                Trade blocked. Review policy checks above.
              </p>
            )}
          </div>
        )}

        {/* Executing */}
        {step === "executing" && !txHash && (
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center gap-2">
              <StatusDot status="warning" pulse />
              <span className="text-sm text-text-secondary">Executing trade...</span>
            </div>
          </div>
        )}

        {/* Receipt */}
        {step === "receipt" && (
          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <StatusDot status="active" />
              <span className="text-gain">Trade complete</span>
            </div>
            {txHash && (
              <div className="text-xs text-text-muted">
                <span>TX: </span>
                <a
                  href={`https://bscscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-accent hover:underline"
                >
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
