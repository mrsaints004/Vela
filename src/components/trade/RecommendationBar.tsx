"use client";

import type { RecommendationFactor } from "@/lib/types";
import { CheckCircle, AlertCircle } from "lucide-react";

interface RecommendationBarProps {
  recommendation: string;
  factors: RecommendationFactor[];
}

export function RecommendationBar({ recommendation, factors }: RecommendationBarProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-xl px-4 py-3">
      <div className="flex items-start gap-3">
        <CheckCircle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary">{recommendation}</p>
          {factors.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-2">
              {factors.map((f, i) => (
                <span key={i} className="text-xs text-text-muted">
                  <span className={f.favorable ? "text-gain" : "text-warning"}>
                    {f.favorable ? "+" : "!"}
                  </span>{" "}
                  {f.label}: <span className="font-mono">{f.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
