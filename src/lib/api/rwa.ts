import { RWAToken, Kline, PROVIDER_NAMES } from "../types";
import { recordApiCall } from "./flight-recorder";

const RWA_LIST_URL =
  "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const KLINE_URL =
  "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/dex/market/token/kline/ai";

// Cache for token list (refreshed every 5 min)
let tokenCache: { tokens: RWAToken[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function fetchAllTokens(): Promise<RWAToken[]> {
  if (tokenCache && Date.now() - tokenCache.timestamp < CACHE_TTL) {
    return tokenCache.tokens;
  }

  const startTime = Date.now();
  const res = await fetch(RWA_LIST_URL);
  const body = await res.json();
  const latency = Date.now() - startTime;

  recordApiCall({
    endpoint: "rwa/stock/detail/list (public)",
    method: "GET",
    params: {},
    status: res.status,
    latency,
    success: body.code === "000000",
    error: body.code !== "000000" ? `code: ${body.code}` : null,
    responseSize: JSON.stringify(body).length,
    notes: `${(body.data || []).length} tokens`,
  });

  if (!body.success && body.code !== "000000") {
    throw new Error(`RWA list fetch failed: ${JSON.stringify(body)}`);
  }

  const tokens: RWAToken[] = body.data;
  tokenCache = { tokens, timestamp: Date.now() };
  return tokens;
}

export async function fetchTokensByProvider(
  type: number
): Promise<RWAToken[]> {
  const all = await fetchAllTokens();
  return all.filter((t) => t.type === type);
}

export async function fetchBSCTokens(): Promise<RWAToken[]> {
  const all = await fetchAllTokens();
  return all.filter((t) => t.chainId === "56");
}

/**
 * Find all representations of a ticker on BSC across providers
 */
export async function findRepresentations(
  ticker: string
): Promise<RWAToken[]> {
  const bscTokens = await fetchBSCTokens();
  return bscTokens.filter(
    (t) => t.ticker.toUpperCase() === ticker.toUpperCase()
  );
}

/**
 * Find all tickers that have 2+ providers on BSC
 */
export async function findMultiProviderTickers(): Promise<
  Map<string, RWAToken[]>
> {
  const bscTokens = await fetchBSCTokens();
  const byTicker = new Map<string, RWAToken[]>();

  for (const token of bscTokens) {
    const existing = byTicker.get(token.ticker) || [];
    existing.push(token);
    byTicker.set(token.ticker, existing);
  }

  // Filter to tickers with 2+ providers
  const multi = new Map<string, RWAToken[]>();
  for (const [ticker, tokens] of byTicker) {
    if (tokens.length >= 2) {
      multi.set(ticker, tokens);
    }
  }

  return multi;
}

export function parseKline(raw: (string | number)[]): Kline {
  return {
    openTime: Number(raw[0]),
    open: parseFloat(String(raw[1])),
    high: parseFloat(String(raw[2])),
    low: parseFloat(String(raw[3])),
    close: parseFloat(String(raw[4])),
    volume: parseFloat(String(raw[5])),
    closeTime: Number(raw[6]),
  };
}

export async function fetchKlines(
  chainId: string,
  contractAddress: string,
  interval: string = "1d",
  limit: number = 7
): Promise<Kline[]> {
  const params = new URLSearchParams({
    chainId,
    contractAddress,
    interval,
    limit: String(limit),
  });

  const res = await fetch(`${KLINE_URL}?${params}`);
  const body = await res.json();

  if (!body.success && body.code !== "000000") {
    throw new Error(`Kline fetch failed: ${JSON.stringify(body)}`);
  }

  const rawKlines = body.data?.klineInfos || [];
  return rawKlines.map(parseKline);
}

export function getProviderName(type: number): string {
  return PROVIDER_NAMES[type] || `Provider_${type}`;
}
