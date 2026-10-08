Developer Experience Report — Vela

Project: Vela — Policy-Bounded Autonomous Execution for Tokenized Equities
Team: Solo builder
Build window: Sep 16 – Oct 11, 2026
Stack used: RWA Data API, Trading API, Transaction API, Wallet API, Agentic Wallet, BNB Agent Studio (ERC-8004)

---

Onboarding

Time from opening docs to first successful API call: ~45 minutes.

Signed up at web3.binance.com/en/dev-portal, got API key and secret within minutes. The authentication docs at /dev-docs/authentication explained HMAC-SHA256 signing clearly — timestamp + method + path + body, base64-encoded. First authenticated call to /api/v1/dex/market/rwa/tokens succeeded on the second attempt.

Where I got stuck (first attempt): The signing function requires the full path including /build as the prefix. The docs show the path as /api/v1/... but the actual signed string must use /build/api/v1/.... I got "signature verification failed" three times before realizing the base URL path prefix is part of the signed payload. The auth docs should include a complete worked example showing exactly what string gets signed, character by character.

What helped: The llms-full.txt file at web3.binance.com/en/dev-docs/llms-full.txt was genuinely useful — I fed it into my development environment and it saved significant time understanding the API surface. This is a good practice other API providers should adopt.

---

Documentation Issues

1. RWA Data API: Two different token list endpoints, unclear which to use

There are two ways to get the tokenized stock list:

Public endpoint: https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai — no auth needed, returns chainId, contractAddress, symbol, ticker, type, but no reference prices, no market status, no company metadata.

Authenticated endpoint: GET /api/v1/dex/market/rwa/tokens?binanceChainId=56&platformId=bstock — requires auth, returns referencePrice, tokenPrice, statusInfo.openState, underlyingName, marketCap, peRatioTTM.

The docs don't explain the difference between these two or when to use which. I discovered through trial and error that:

- The public endpoint returns ALL tokens across all providers (bStocks type=3, Ondo type=1, xStocks type=2) in a single call.
- The authenticated endpoint requires a platformId parameter and only returns tokens for that specific platform. You need two calls (bstock + ondo) to get what the public endpoint gives you in one.
- The authenticated endpoint does NOT support platformId=xstock — it returns an empty array. xStocks tokens are only available via the public endpoint.
- The public endpoint uses a different success code format ("000000" string) than the authenticated endpoint (0 integer). This inconsistency caused a bug where my error handling worked for one but not the other.

Suggestion: Add a comparison table in the docs showing what each endpoint returns. Note that xStocks is not available via the authenticated API.

2. The "type" field in token data is undocumented

The public RWA list returns a type field per token: 1 = Ondo, 2 = xStocks, 3 = bStocks. This mapping is not documented anywhere. I discovered it by cross-referencing token symbols (tokens ending in "on" = Ondo, ending in "x" = xStocks, ending in "B" = bStocks) and confirming against the authenticated API's platformId field. There's also type 4 (SPCX) and type 9 (Binance) which appear in some responses but are not explained.

3. Reference price staleness is not indicated in the response

The authenticated API returns referencePrice and statusInfo.openState. When openState is false (market closed), the reference price is stale — it's the last price from when the market was open. But the API doesn't tell you how stale it is. There's no lastUpdated timestamp on the reference price.

I had to build my own staleness calculation: check if it's a weekday and the current time is outside NYSE hours (9:30 AM – 4:00 PM ET), then estimate hours since last close. For weekends, I calculate hours since Friday 4 PM ET. This works but it's fragile and timezone-dependent.

Suggestion: Add a referencePriceUpdatedAt timestamp to the response. This is critical for any product that makes trading decisions based on deviation from reference — which is exactly the use case tokenized stocks are designed for.

4. Quote API: "amount" parameter expects wei, not human-readable values

The /api/v1/dex/aggregator/quote endpoint requires amount in wei (18 decimals for USDT on BSC). The docs say "amount" but don't specify the unit. If you pass 500 meaning "$500", you get a quote for 0.0000000000000005 USDT. I had to multiply by 1e18 — BigInt(Math.floor(parseFloat(usdtAmount) * 1e18)).toString().

This is standard for on-chain amounts but the docs should state it explicitly, especially since this API targets developers who may be building their first BSC integration.

5. Simulation endpoint response structure varies

The /api/v1/dex/pre-transaction/simulate POST endpoint wraps the simulation result differently depending on whether the transaction succeeds or fails:

Success: data.data.status = "SUCCESS", data.data.balanceChanges is an array.
Failure: data.data.status = "FAILED", data.data.failReason is a string. But sometimes balanceChanges is undefined instead of an empty array, which causes runtime errors if you don't guard for it.

I had to add explicit null checks: data.data.balanceChanges || [].

---

API Pitfalls

1. Quote expiry is aggressive

Quote IDs from /api/v1/dex/aggregator/quote expire quickly (observed ~30 seconds). If a user reviews the comparison results for a minute before clicking "Execute", the quote is stale and the swap build fails with a generic error message: "swap build failed". The error doesn't say "quote expired" — it just fails.

Suggestion: Include expiresAt in the quote response and return a specific error code for expired quotes so the client can auto-refresh.

2. Price impact is inconsistent across vendors

The priceImpactPercent field in quote responses varies dramatically depending on the vendor (PancakeSwap vs other DEXes). For the same token and amount, one vendor might report 0.01% impact while another reports 2.3%. This isn't a bug per se — different liquidity pools have different depth — but it makes comparison harder. It would help if the docs explained that price impact is vendor-specific and comes directly from the DEX, not normalized by the aggregator.

3. Honeypot detection returns false negatives

The isHoneyPot field on toToken in quote responses was false for every tokenized stock token I tested, including some with very thin liquidity. This field appears to always be false for RWA tokens, which makes it useless as a safety signal for this asset class. It would be more useful to have a liquidityDepthUSD field so developers can make their own risk assessment.

4. Rate limiting is generous but undocumented

During development I made thousands of API calls without hitting rate limits. The docs mention "elevated rate limits" for hackathon participants but don't specify what the normal or elevated limits actually are. For a production product, I'd need to know the exact limits to implement proper backoff.

---

AI Stack Feedback

Agentic Wallet

I integrated the Agentic Wallet pipeline: token approval check, swap building, transaction simulation, and balance verification. The pipeline is functional — every step makes real API calls and returns useful data.

What worked:

- The approve, quote, swap, simulate, execute pipeline is logically sound and maps well to a multi-step autonomous agent flow.
- Transaction simulation before execution is the right pattern. I use it as a gate in the policy engine — if simulation fails, the agent blocks the trade.

What didn't work:

- The agentic pipeline cannot actually sign transactions server-side. The finalTxHash is always null because the server doesn't hold private keys. For true autonomous execution, I had to receive txData from the server and sign it client-side via ethers.js BrowserProvider. This means "agentic" execution still requires the user's wallet to be connected and to approve the transaction — it's not truly autonomous.
- There's no session key or delegated signing mechanism documented. The Binance Agentic Wallet SDK references session keys but the Web3 API doesn't expose them. For a truly agentic product, the agent needs to be able to sign within its own key scope, bounded by the user's policy. This is the biggest missing piece.

What's missing:

- Delegated signing with spending limits — "this agent can execute up to $X per day on my behalf without prompting my wallet."
- A callback/webhook mechanism so the agent can be notified when conditions change, rather than polling.
- The ability to set a trade expiry — "execute this trade if conditions are met within the next 4 hours, then expire."

BNB Agent Studio / ERC-8004

I registered Vela as an on-chain agent via the ERC-8004 IdentityRegistry on BSC. The registration mints an ERC-721 NFT that represents the agent's identity, with metadata describing its capabilities.

What worked:

- The ERC-8004 contract interface is clean. register(agentURI, metadata[]) with tuple encoding is straightforward if you know Solidity ABI encoding.
- The concept of agent identity as an NFT is sound — it gives the agent a verifiable, on-chain-provable identity that can be referenced in decision receipts.

What I'd want:

- Integration between Agent Studio identity and the Binance Web3 API — "this API call is being made by agent #4721, whose policy allows X." Right now the agent identity and the trading API are completely separate systems.
- A way to attach decision receipts to the agent's on-chain identity — proving not just that the agent exists, but what it decided and why.

---

Tokenized Stock Specifics

Liquidity depth varies dramatically

For the same underlying stock (e.g., NVDA), liquidity across providers differs by orders of magnitude:

bStocks: Generally highest volume. DEX quotes return tight spreads.
Ondo: Moderate volume. Spreads are wider but acceptable for amounts under $5,000.
xStocks: Very thin liquidity on most tickers. Price impact can exceed 5% on a $500 trade.

This is the core problem Vela solves — without comparing across providers, a user on xStocks might pay 5% more than they would on bStocks for the exact same exposure.

After-hours behavior is the real story

The hackathon description nails it: "The closing bell rings and every stock price in the country freezes." In practice:

- Reference prices freeze at NYSE close (4 PM ET). The on-chain tokens keep trading.
- By Saturday afternoon, I observed tokenized NVDA trading 2.37% above the last reference price. On a $500 trade, that's $12 of invisible overpayment.
- There is no warning in the API response that the reference is stale. The openState: false flag tells you the market is closed, but the reference price still looks like a real price.
- Monday morning, when the reference updates, the deviation snaps back. Any trade executed over the weekend was priced against stale data.

This is why I built the policy engine with blockAfterHours and maxDeviation constraints. Without them, an autonomous agent would happily execute trades at 2%+ deviation from reference — technically profitable for the market maker, costly for the user.

The three providers differ more than expected

bStocks:
  Token naming: {TICKER}B (e.g., NVDAB)
  Liquidity: High on popular tickers
  Price tracking: Tight to reference
  API coverage: Full (public + authenticated)
  Token-to-share ratio: Varies (often 0.001 or 0.01)

Ondo:
  Token naming: {TICKER}on (e.g., NVDAon)
  Liquidity: Moderate
  Price tracking: ~0.5-1% deviation typical
  API coverage: Full (public + authenticated)
  Token-to-share ratio: Usually 1:1

xStocks:
  Token naming: {TICKER}x (e.g., NVDAx)
  Liquidity: Low-very low
  Price tracking: 1-3%+ deviation common
  API coverage: Public only (no authenticated data)
  Token-to-share ratio: Varies

The token-to-share ratio is particularly tricky. A bStocks NVDA token priced at $0.13 represents 0.001 shares, so the implied share price is $130. But an Ondo NVDA token priced at $130 represents 1 share. You have to divide by tokenToShareRatio to get comparable prices, and this ratio is different for every token on every provider. I built this normalization into the comparison engine, but it should be documented clearly.

---

Redesign Suggestions

1. Unified token endpoint

Merge the public and authenticated token lists into a single endpoint that returns everything: contract addresses, reference prices, market status, company metadata, provider IDs, and a referencePriceUpdatedAt timestamp. One call instead of three.

2. Staleness metadata on every price

Every price field in the API (tokenPrice, referencePrice) should include:
  - updatedAt — timestamp of last update
  - source — where this price came from (DEX, oracle, NYSE)
  - isStale — boolean, set by the server based on market hours

3. Provider comparison endpoint

A new endpoint that takes a ticker and returns all representations side by side: providers, prices, liquidity depth, deviation from reference, and a recommended provider. This is what I had to build from scratch using 4 different API calls and a custom comparison engine.

4. WebSocket feed for reference price updates

The biggest gap for autonomous agents: there's no way to know when the reference price updates. I have to poll. A WebSocket that pushes reference price changes would enable event-driven agents that react to market opens rather than polling every minute.

---

Requested Capabilities

1. referencePriceUpdatedAt timestamp on all price responses
2. Provider comparison endpoint — /api/v1/dex/market/rwa/compare?ticker=NVDA returning all providers with normalized prices
3. Quote expiry timestamp in quote responses
4. Expired quote error code — distinct from generic failure
5. Delegated signing / session keys — so agents can truly execute autonomously within policy bounds
6. WebSocket feed for reference price updates and market open/close events
7. Liquidity depth metric (in USD) per token, not just isHoneyPot
8. xStocks in authenticated API — currently returns empty array for platformId=xstock
9. Consistent response format — use the same success/error structure across public and authenticated endpoints
10. Trade expiry — submit a conditional trade that expires after N hours if not executed

---

Modules Used

RWA Data API: Token discovery, reference prices, market status, company metadata, sector classification
Trading API: DEX aggregator quotes, swap building, cross-vendor comparison, real price impact
Transaction API: On-chain simulation as policy gate — block trade if simulation fails
Wallet API: Portfolio positions, balance checks, concentration calculation
Agentic Wallet: Multi-step execution pipeline: approve, quote, swap, simulate, verify
ERC-8004 (Agent Studio): On-chain agent identity registration, capability metadata, verifiable decision receipts

Build Telemetry

Vela includes a flight recorder that logs every API call: endpoint, method, latency, status, response size, and errors. This data informed this report. Typical latencies observed:

Public RWA list: ~200ms (fast, cacheable)
Authenticated RWA tokens (per platform): ~400ms (two calls needed for bstock + ondo)
DEX aggregator quote: ~800ms (varies by token liquidity)
Swap build: ~600ms (requires valid quote ID)
Transaction simulation: ~1.2s (slowest call in the pipeline)

Full discovery flow (find tokens, fetch representations, get quotes for each, reference price, policy evaluation): ~3-4 seconds total for a ticker with 3 providers. This is acceptable for interactive use but would benefit from parallel execution and caching for agent loops.
