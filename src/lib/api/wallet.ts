import crypto from "crypto";
import { recordApiCall } from "./flight-recorder";

const BASE_URL = "https://web3.binance.com";
const BSC_CHAIN_ID = "56";

function getCredentials() {
  const apiKey = process.env.BINANCE_WEB3_API_KEY;
  const secretKey = process.env.BINANCE_WEB3_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("API credentials not configured");
  return { apiKey, secretKey };
}

function sign(secretKey: string, timestamp: string, method: string, pathWithQuery: string, body: string = "") {
  const preHash = `${timestamp}${method}${pathWithQuery}${body}`;
  return crypto.createHmac("sha256", secretKey).update(preHash, "utf8").digest("base64");
}

async function apiCall(method: "GET" | "POST", path: string, params?: Record<string, string>, body?: object) {
  const { apiKey, secretKey } = getCredentials();
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  let fullPath = `/build${path}`;
  if (params && method === "GET") {
    const qs = new URLSearchParams(params).toString();
    if (qs) fullPath += `?${qs}`;
  }

  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = sign(secretKey, timestamp, method, fullPath, bodyStr);

  const res = await fetch(`${BASE_URL}${fullPath}`, {
    method,
    headers: {
      "X-OC-APIKEY": apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": signature,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? bodyStr : undefined,
  });

  const data = await res.json();
  const latency = Date.now() - startTime;

  recordApiCall({
    endpoint: path,
    method,
    params: params || {},
    status: res.status,
    latency,
    success: res.ok && data.code === 0,
    error: !res.ok ? `HTTP ${res.status}` : data.code !== 0 ? data.msg : null,
    responseSize: JSON.stringify(data).length,
    notes: "wallet-api",
  });

  if (!res.ok || data.code !== 0) {
    throw new Error(`Wallet API error: ${data.msg || `HTTP ${res.status}`}`);
  }

  return { data: data.data, latency };
}

// --- Wallet API: Token Balances ---

export interface WalletTokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  balanceUsd: string;
  tokenPrice: string;
  decimals: number;
  logoUrl: string;
  isNative: boolean;
}

/**
 * Fetch wallet token balances via Binance Web3 Wallet API.
 * This uses the official Wallet API instead of raw RPC calls,
 * giving us enriched data (USD values, logos, token metadata).
 */
export async function getWalletBalances(walletAddress: string): Promise<{
  balances: WalletTokenBalance[];
  totalUsd: number;
  latency: number;
}> {
  const { data, latency } = await apiCall("GET", "/api/v1/wallet/token-balance", {
    walletAddress,
    chainId: BSC_CHAIN_ID,
  });

  const balances: WalletTokenBalance[] = (data || []).map((t: any) => ({
    tokenAddress: t.tokenAddress || "",
    tokenSymbol: t.tokenSymbol || "",
    tokenName: t.tokenName || "",
    balance: t.balance || "0",
    balanceUsd: t.balanceInUSD || t.balanceUsd || "0",
    tokenPrice: t.tokenPrice || "0",
    decimals: parseInt(t.decimals) || 18,
    logoUrl: t.tokenLogo || t.logoUrl || "",
    isNative: t.isNative || false,
  }));

  const totalUsd = balances.reduce((sum, b) => sum + parseFloat(b.balanceUsd), 0);

  return { balances, totalUsd, latency };
}

// --- Wallet API: Address Portfolio (DeFi positions) ---

export interface DeFiPosition {
  protocolName: string;
  protocolLogo: string;
  positionType: string;
  valueUsd: string;
  tokens: Array<{
    symbol: string;
    amount: string;
    valueUsd: string;
  }>;
}

/**
 * Fetch DeFi positions via Binance Web3 Address Portfolio API.
 */
export async function getAddressPortfolio(walletAddress: string): Promise<{
  positions: DeFiPosition[];
  totalDefiUsd: number;
  latency: number;
}> {
  try {
    const { data, latency } = await apiCall("GET", "/api/v1/wallet/address-portfolio", {
      walletAddress,
      chainId: BSC_CHAIN_ID,
    });

    const positions: DeFiPosition[] = (data?.positions || data || []).map((p: any) => ({
      protocolName: p.protocolName || p.projectName || "",
      protocolLogo: p.protocolLogo || "",
      positionType: p.positionType || p.type || "",
      valueUsd: p.valueInUSD || p.valueUsd || "0",
      tokens: (p.tokens || p.tokenList || []).map((t: any) => ({
        symbol: t.tokenSymbol || t.symbol || "",
        amount: t.amount || "0",
        valueUsd: t.valueInUSD || t.valueUsd || "0",
      })),
    }));

    const totalDefiUsd = positions.reduce((sum, p) => sum + parseFloat(p.valueUsd), 0);

    return { positions, totalDefiUsd, latency };
  } catch {
    return { positions: [], totalDefiUsd: 0, latency: 0 };
  }
}
