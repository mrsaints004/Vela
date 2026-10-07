import { NextRequest, NextResponse } from "next/server";
import { getLogs, getStats } from "@/lib/api/flight-recorder";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");
  const stats = getStats();
  const logs = getLogs(500);

  // Export as markdown for the Developer Experience Report
  if (format === "dx-report") {
    const lines: string[] = [];
    lines.push("# API Flight Recorder — Developer Experience Data\n");
    lines.push(`Generated: ${new Date().toISOString()}\n`);

    lines.push("## Summary\n");
    lines.push(`- **Total API calls**: ${stats.totalCalls}`);
    lines.push(`- **Success rate**: ${stats.successRate}%`);
    lines.push(`- **Average latency**: ${stats.avgLatency}ms`);
    lines.push(`- **P95 latency**: ${stats.p95Latency}ms`);
    lines.push(`- **Error count**: ${stats.errorCount}\n`);

    lines.push("## By Endpoint\n");
    lines.push("| Endpoint | Calls | Avg Latency | Errors |");
    lines.push("|----------|-------|-------------|--------|");
    for (const [endpoint, data] of Object.entries(stats.byEndpoint)) {
      const d = data as { count: number; avgLatency: number; errors: number };
      lines.push(`| ${endpoint} | ${d.count} | ${d.avgLatency}ms | ${d.errors} |`);
    }
    lines.push("");

    // Error log
    const errors = logs.filter((l) => !l.success);
    if (errors.length > 0) {
      lines.push("## Errors\n");
      for (const err of errors.slice(0, 20)) {
        lines.push(`- **${err.endpoint}** (${new Date(err.timestamp).toISOString()}): ${err.error || "Unknown"} — HTTP ${err.status}, ${err.latency}ms`);
      }
      lines.push("");
    }

    // Latency outliers
    const slow = logs.filter((l) => l.latency > 2000);
    if (slow.length > 0) {
      lines.push("## Slow Calls (>2s)\n");
      for (const s of slow.slice(0, 20)) {
        lines.push(`- **${s.endpoint}**: ${s.latency}ms — ${s.notes || ""}`);
      }
      lines.push("");
    }

    lines.push("## Raw Log (last 50)\n");
    lines.push("| Time | Endpoint | Method | Status | Latency | Size | Notes |");
    lines.push("|------|----------|--------|--------|---------|------|-------|");
    for (const log of logs.slice(0, 50)) {
      const time = new Date(log.timestamp).toISOString().split("T")[1]?.split(".")[0] || "";
      lines.push(`| ${time} | ${log.endpoint} | ${log.method} | ${log.status} | ${log.latency}ms | ${log.responseSize}B | ${log.notes || ""} |`);
    }

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": "attachment; filename=vela-dx-report.md",
      },
    });
  }

  return NextResponse.json({ stats, logs });
}
