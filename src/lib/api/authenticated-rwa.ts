import crypto from "crypto";
import { recordApiCall } from "./flight-recorder";

const BASE_URL = "https://web3.binance.com";
const BSC_CHAIN_ID = "56";

interface Credentials {
  apiKey: string;
  secretKey: string;
}

function getCredentials(): Credentials | null {
  const apiKey = process.env.BINANCE_WEB3_API_KEY;
  const secretKey = process.env.BINANCE_WEB3_SECRET_KEY;
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey };
}

function sign(secretKey: string, timestamp: string, method: string, pathWithQuery: string): string {
  const preHash = `${timestamp}${method}${pathWithQuery}`;
  return crypto.createHmac("sha256", secretKey).update(preHash, "utf8").digest("base64");
}

export interface AuthRWAToken {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  assetType: number;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl: string;
  decimals: string;
  underlyingTicker: string;
  underlyingName: string;
  tokenToShareRatio: string;
  tags: string[];
  statusInfo: {
    openState: boolean;
    marketStatus: string | null;
    reasonCode: string;
    reasonMsg: string | null;
    nextOpenTime: number | null;
    nextCloseTime: number | null;
  };
  tokenPrice: string;
  referencePrice: string;
  volume24H: string;
  marketCap: string | null;
  peRatioTTM: string | null;
}

async function fetchPlatform(creds: Credentials, platformId: string): Promise<AuthRWAToken[]> {
  const timestamp = new Date().toISOString();
  const path = `/build/api/v1/dex/market/rwa/tokens?binanceChainId=${BSC_CHAIN_ID}&platformId=${platformId}`;
  const signature = sign(creds.secretKey, timestamp, "GET", path);

  const startTime = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-OC-APIKEY": creds.apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": signature,
      "Content-Type": "application/json",
    },
  });

  const rawText = await res.text();
  const latency = Date.now() - startTime;
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { data: [] };
  }

  recordApiCall({
    endpoint: `/api/v1/dex/market/rwa/tokens (${platformId})`,
    method: "GET",
    params: { binanceChainId: BSC_CHAIN_ID, platformId },
    status: res.status,
    latency,
    success: res.ok && data.code === 0,
    error: !res.ok ? `HTTP ${res.status}` : data.code !== 0 ? data.msg : null,
    responseSize: rawText.length,
    notes: `${(data.data || []).length} tokens returned`,
  });

  return data.data || [];
}

// Cache
let authCache: { tokens: AuthRWAToken[]; timestamp: number } | null = null;
const AUTH_CACHE_TTL = 2 * 60 * 1000; // 2 min for authenticated data

/**
 * Fetch enriched token data from the authenticated API.
 * Returns null if credentials are not configured.
 */
export async function fetchAuthenticatedTokens(): Promise<AuthRWAToken[] | null> {
  const creds = getCredentials();
  if (!creds) return null;

  if (authCache && Date.now() - authCache.timestamp < AUTH_CACHE_TTL) {
    return authCache.tokens;
  }

  try {
    const [bstock, ondo] = await Promise.all([
      fetchPlatform(creds, "bstock"),
      fetchPlatform(creds, "ondo"),
    ]);

    // xStock returns 0 from authenticated API — we'll get it from public
    const tokens = [...bstock, ...ondo];
    authCache = { tokens, timestamp: Date.now() };
    return tokens;
  } catch {
    return null;
  }
}

/**
 * Find authenticated data for a specific ticker across providers
 */
export async function findAuthenticatedRepresentations(
  ticker: string
): Promise<AuthRWAToken[]> {
  const tokens = await fetchAuthenticatedTokens();
  if (!tokens) return [];

  return tokens.filter(
    (t) => t.underlyingTicker.toUpperCase() === ticker.toUpperCase()
  );
}

/**
 * Get the reference price for a ticker from the authenticated API
 */
export async function getReferencePrice(ticker: string): Promise<number | null> {
  const tokens = await findAuthenticatedRepresentations(ticker);
  if (tokens.length === 0) return null;

  // Use the first available reference price
  for (const t of tokens) {
    const ref = parseFloat(t.referencePrice);
    if (ref > 0) return ref;
  }
  return null;
}

/**
 * Get trading quote via authenticated API
 */
export async function getTradeQuote(
  fromToken: string,
  toToken: string,
  amount: string,
  walletAddress: string
): Promise<any> {
  const creds = getCredentials();
  if (!creds) throw new Error("API credentials not configured");

  const timestamp = new Date().toISOString();
  const params = new URLSearchParams({
    binanceChainId: BSC_CHAIN_ID,
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    amount,
    userWalletAddress: walletAddress,
  });
  const path = `/build/api/v1/dex/aggregator/quote?${params}`;
  const signature = sign(creds.secretKey, timestamp, "GET", path);

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-OC-APIKEY": creds.apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": signature,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  return data;
}

/**
 * Simulate a transaction via authenticated API
 */
export async function simulateTransaction(
  from: string,
  to: string,
  value: string,
  calldata: string
): Promise<any> {
  const creds = getCredentials();
  if (!creds) throw new Error("API credentials not configured");

  const timestamp = new Date().toISOString();
  const path = "/build/api/v1/dex/pre-transaction/simulate";
  const body = JSON.stringify({
    binanceChainId: BSC_CHAIN_ID,
    evmTx: { from, to, value, data: calldata },
  });
  const preHash = `${timestamp}POST${path}${body}`;
  const signature = crypto.createHmac("sha256", creds.secretKey).update(preHash, "utf8").digest("base64");

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "X-OC-APIKEY": creds.apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": signature,
      "Content-Type": "application/json",
    },
    body,
  });

  return res.json();
}
