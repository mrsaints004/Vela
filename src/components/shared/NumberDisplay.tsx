"use client";

type NumberFormat = "currency" | "percent" | "decimal";

interface NumberDisplayProps {
  value: number;
  format?: NumberFormat;
  decimals?: number;
  colored?: boolean;
  showSign?: boolean;
  className?: string;
}

function formatNumber(value: number, format: NumberFormat, decimals: number): string {
  switch (format) {
    case "currency":
      return `$${Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    case "percent":
      return `${Math.abs(value).toFixed(decimals)}%`;
    case "decimal":
      return Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    default:
      return String(value);
  }
}

export function NumberDisplay({
  value,
  format = "decimal",
  decimals = 2,
  colored = false,
  showSign = false,
  className = "",
}: NumberDisplayProps) {
  const formatted = formatNumber(value, format, decimals);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const display = showSign ? `${sign}${formatted}` : value < 0 ? `-${formatted}` : formatted;

  let colorClass = "";
  if (colored) {
    if (value > 0) colorClass = "text-gain";
    else if (value < 0) colorClass = "text-loss";
    else colorClass = "text-text-secondary";
  }

  return (
    <span className={`font-mono tabular-nums ${colorClass} ${className}`}>
      {display}
    </span>
  );
}
