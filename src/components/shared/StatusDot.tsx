"use client";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-gain",
  open: "bg-gain",
  success: "bg-gain",
  pass: "bg-gain",
  warning: "bg-warning",
  warn: "bg-warning",
  stale: "bg-warning",
  error: "bg-loss",
  fail: "bg-loss",
  block: "bg-loss",
  closed: "bg-neutral",
  inactive: "bg-neutral",
  idle: "bg-neutral",
  neutral: "bg-neutral",
};

interface StatusDotProps {
  status: string;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ status, pulse = false, className = "" }: StatusDotProps) {
  const color = STATUS_COLORS[status.toLowerCase()] || "bg-neutral";

  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${color} ${
        pulse ? "animate-pulse" : ""
      } ${className}`}
    />
  );
}
