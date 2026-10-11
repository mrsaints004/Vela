import crypto from 'node:crypto';
import { recordApiCall } from './flight-recorder';
export type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected API response object');
  return value as JsonObject;
}
export function textField(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
export function numberField(value: unknown): number { const n = Number(value); if (!Number.isFinite(n)) throw new Error('Invalid numeric API field'); return n; }
export async function signedCall(method: 'GET' | 'POST', path: string, params?: Record<string, string>, body?: unknown): Promise<{ data: unknown; latency: number }> {
  const key = process.env.BINANCE_WEB3_API_KEY, secret = process.env.BINANCE_WEB3_SECRET_KEY;
  if (!key || !secret) throw new Error('Configure BINANCE_WEB3_API_KEY and BINANCE_WEB3_SECRET_KEY in .env.local, then restart Vela.');
  const timestamp = new Date().toISOString();
  const fullPath = `/build${path}${params ? `?${new URLSearchParams(params)}` : ''}`;
  const bodyString = body === undefined ? '' : JSON.stringify(body);
  const signature = crypto.createHmac('sha256', secret).update(timestamp + method + fullPath + bodyString).digest('base64');
  const start = Date.now(); let status = 0, size = 0, error: string | null = null;
  try {
    const res = await fetch(`https://web3.binance.com${fullPath}`, { method, headers: { 'X-OC-APIKEY': key, 'X-OC-TIMESTAMP': timestamp, 'X-OC-SIGN': signature, 'Content-Type': 'application/json' }, body: method === 'POST' ? bodyString : undefined, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    status = res.status;
    const raw = await res.text(); size = raw.length;
    let parsed: JsonObject;
    try { parsed = object(JSON.parse(raw)); } catch { throw new Error(`Binance returned non-JSON data (HTTP ${status}).`); }
    if (!res.ok || parsed.code !== 0) throw new Error(`Binance ${String(parsed.code ?? status)}: ${textField(parsed.msg, 'Request failed')}`);
    return { data: parsed.data, latency: Date.now() - start };
  } catch (e) { error = e instanceof Error ? e.message : 'API request failed'; throw e; }
  finally { recordApiCall({ endpoint: path, method, params: params || {}, status, latency: Date.now() - start, success: error === null, error, responseSize: size, notes: null }); }
}
