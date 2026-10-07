import crypto from "crypto";

const BASE_URL = "https://web3.binance.com";
const BSC_CHAIN_ID = "56";
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";

function getCredentials() {
  const apiKey = process.env.BINANCE_WEB3_API_KEY;
  const secretKey = process.env.BINANCE_WEB3_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error(
      "BINANCE_WEB3_API_KEY and BINANCE_WEB3_SECRET_KEY must be set"
    );
  }
  return { apiKey, secretKey };
}

function sign(
  secretKey: string,
  timestamp: string,
  method: string,
  pathWithQuery: string,
  body: string = ""
): string {
  const preHash = `${timestamp}${method}${pathWithQuery}${body}`;
  return crypto
    .createHmac("sha256", secretKey)
    .update(preHash, "utf8")
    .digest("base64");
}

async function authenticatedRequest(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string>,
  body?: object
): Promise<any> {
  const { apiKey, secretKey } = getCredentials();
  const timestamp = new Date().toISOString();

  let pathWithQuery = `/build${path}`;
  if (params && method === "GET") {
    const qs = new URLSearchParams(params).toString();
    if (qs) pathWithQuery += `?${qs}`;
  }

  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = sign(secretKey, timestamp, method, pathWithQuery, bodyStr);

  const url = `${BASE_URL}${pathWithQuery}`;
  const headers: Record<string, string> = {
    "X-OC-APIKEY": apiKey,
    "X-OC-TIMESTAMP": timestamp,
    "X-OC-SIGN": signature,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? bodyStr : undefined,
  });

  const data = await res.json();
  if (!res.ok || data.code !== 0 || data.success === false) {
    throw new Error(
      `Binance Web3 API error: ${data.msg || JSON.stringify(data)}`
    );
  }

  return data.data;
}

// --- RWA Data (Authenticated) ---

export interface AuthenticatedRWAToken {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  underlyingTicker: string;
  tokenToShareRatio: string;
  statusInfo: {
    openState: boolean;
    marketStatus: string;
    reasonCode: string;
    reasonMsg: string;
    nextOpenTime: number;
  };
  tokenPrice: string;
  referencePrice: string;
}

export async function fetchAuthenticatedRWATokens(
  platformId?: string
): Promise<AuthenticatedRWAToken[]> {
  const params: Record<string, string> = { binanceChainId: BSC_CHAIN_ID };
  if (platformId) params.platformId = platformId;

  return authenticatedRequest("GET", "/api/v1/dex/market/rwa/tokens", params);
}

export async function fetchRWAPrices(
  addresses: string[]
): Promise<any[]> {
  return authenticatedRequest("GET", "/api/v1/dex/market/rwa/price", {
    binanceChainId: BSC_CHAIN_ID,
    tokenContractAddresses: addresses.join(","),
  });
}

// --- Trading API ---

export interface QuoteResult {
  quoteId: string;
  vendorName: string;
  toTokenAmount: string;
  tradeFee: string;
  priceImpactPercent: string;
  fromToken: { isHoneyPot: boolean };
  toToken: { isHoneyPot: boolean };
}

export async function getQuote(
  fromToken: string,
  toToken: string,
  amount: string,
  walletAddress: string
): Promise<QuoteResult[]> {
  return authenticatedRequest("GET", "/api/v1/dex/aggregator/quote", {
    binanceChainId: BSC_CHAIN_ID,
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    amount,
    userWalletAddress: walletAddress,
  });
}

export interface SwapResult {
  executionMode: string;
  tx?: {
    from: string;
    to: string;
    value: string;
    data: string;
  };
  rfq?: {
    typedDataToSign: string;
  };
}

export async function buildSwap(
  fromToken: string,
  toToken: string,
  amount: string,
  walletAddress: string,
  quoteId: string,
  slippagePercent: string = "0.5"
): Promise<SwapResult> {
  return authenticatedRequest("GET", "/api/v1/dex/aggregator/swap", {
    binanceChainId: BSC_CHAIN_ID,
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    amount,
    quoteId,
    userWalletAddress: walletAddress,
    slippagePercent,
  });
}

// --- Transaction API ---

export interface SimulationResult {
  status: "SUCCESS" | "FAILED";
  failReason?: string;
  balanceChanges?: Array<{
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
    direction: string;
  }>;
}

export async function simulateTransaction(
  from: string,
  to: string,
  value: string,
  data: string
): Promise<SimulationResult> {
  return authenticatedRequest(
    "POST",
    "/api/v1/dex/pre-transaction/simulate",
    undefined,
    {
      binanceChainId: BSC_CHAIN_ID,
      evmTx: { from, to, value, data },
    }
  );
}

export { BSC_CHAIN_ID, USDT_BSC };
