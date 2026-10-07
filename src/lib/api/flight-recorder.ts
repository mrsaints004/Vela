// API Flight Recorder — logs every API call for the Developer Experience Report

export interface FlightLog {
  id: string;
  timestamp: number;
  endpoint: string;
  method: string;
  params: Record<string, string>;
  status: number;
  latency: number;
  success: boolean;
  error: string | null;
  responseSize: number;
  notes: string | null;
}

// In-memory log store (persisted per server lifetime)
const logs: FlightLog[] = [];
const MAX_LOGS = 500;

export function recordApiCall(log: Omit<FlightLog, "id" | "timestamp">): FlightLog {
  const entry: FlightLog = {
    id: `FL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    ...log,
  };

  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.pop();

  return entry;
}

export function getLogs(limit: number = 50): FlightLog[] {
  return logs.slice(0, limit);
}

export function getStats() {
  if (logs.length === 0) {
    return {
      totalCalls: 0,
      successRate: 0,
      avgLatency: 0,
      p95Latency: 0,
      errorCount: 0,
      byEndpoint: {},
    };
  }

  const latencies = logs.map((l) => l.latency).sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);

  const byEndpoint: Record<string, { count: number; avgLatency: number; errors: number }> = {};
  for (const log of logs) {
    const key = log.endpoint;
    if (!byEndpoint[key]) {
      byEndpoint[key] = { count: 0, avgLatency: 0, errors: 0 };
    }
    byEndpoint[key].count++;
    byEndpoint[key].avgLatency += log.latency;
    if (!log.success) byEndpoint[key].errors++;
  }

  for (const key of Object.keys(byEndpoint)) {
    byEndpoint[key].avgLatency = Math.round(byEndpoint[key].avgLatency / byEndpoint[key].count);
  }

  return {
    totalCalls: logs.length,
    successRate: Math.round((logs.filter((l) => l.success).length / logs.length) * 100),
    avgLatency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p95Latency: latencies[p95Index] || 0,
    errorCount: logs.filter((l) => !l.success).length,
    byEndpoint,
  };
}

export function clearLogs() {
  logs.length = 0;
}
