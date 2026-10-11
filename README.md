# Vela

Vela helps you buy and sell tokenized stocks on BNB Smart Chain. It discovers representations across bStocks, Ondo and xStocks, checks a wallet-specific quote against your policy, requests your signature, and verifies the resulting token transfers. Each preview and execution leaves a decision receipt with the inputs, checks and outcome.

## Features

- Stock discovery and comparison across issuers, with normalized share exposure and reference-market status.
- USDT purchases from $5, subject to policy limits and vendor minimums.
- Sales of a specified stock-token quantity or the full balance of the selected issuer.
- Browser-wallet signing and local Binance Agentic Wallet MPC signing.
- Transaction simulation for EVM swaps; typed-order validation for RFQ orders.
- Persistent execution and refusal receipts, individual receipt links, checksums and BscScan links for settlement transactions.
- Portfolio balances and exposure summaries.
- Optional natural-language parsing and ERC-8004 identity registration.

Trading uses **BSC mainnet, chain 56**. ERC-8004 identity registration has a separate network selection; registering an identity does not authorize trades or deploy a runtime.

## Mainnet demonstration

The recorded demo includes a $5.30 NVDA purchase using Binance Agentic Wallet on BSC mainnet. The recorder verified its funded settlement against the decision receipt and matching on-chain token transfers.

[View the settlement transaction on BscScan](https://bscscan.com/tx/0xaca1fc2c13170efa9ffa68cbe02bd499c35b429ee139d63087f50950494db57b)

This demonstrates the purchase flow; a completed buy-and-sell round trip is not claimed.

## Run locally

Requires Node.js 20.9 or later and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open the local URL printed by the server. Set the required Binance Web3 credentials in `.env.local`, then restart the server.

| Variable | Purpose |
| --- | --- |
| `BINANCE_WEB3_API_KEY` | Binance Web3 API key |
| `BINANCE_WEB3_SECRET_KEY` | Binance Web3 signing secret |
| `GROQ_API_KEY` | Optional AI intent parsing; deterministic parsing remains available |
| `BSC_RPC_URL` | Optional BSC mainnet RPC endpoint |
| `VELA_DATA_DIR` | Optional directory for durable preview and receipt storage |
| `VELA_BAW_PATH` | Optional absolute path to an installed `baw` executable |
| `BINANCE_BAW_DIR` | Optional CLI session directory; defaults to `.data/baw` |

Credentials stay on the server. Never prefix secrets with `NEXT_PUBLIC_`. Local sessions, receipts and installed CLI files are excluded from Git.

For a production build running locally:

```sh
npm run build
npm start
```

The app uses Next.js, React, TypeScript, ethers, Zustand and TanStack Query. Production builds use Webpack; development uses Turbopack.

## Buy or sell

1. Choose Browser wallet or Binance Agentic Wallet. Browser signing requires the connected account to be on BSC mainnet.
2. Enter `Buy $6 of NVDA`, `Sell all NVDA`, or `Sell 0.01 tokens of NVDA`.
3. Select the issuer. A sale must use the representation actually held by the selected account.
4. Review discovery, then select **Get Quote & Evaluate** for the executable preview.
5. Review the quote, funding, policy and preflight results. If approval is required, approve the exact input amount and refresh the quote before signing the stock order.
6. Confirm signing and wait for settlement. Open the decision receipt to inspect the result and its explorer link.

The $5 application floor also applies to estimated sale notional. Vendor minimums may be higher. Sale quantities are token units; share-count, dollar-value and percentage sales are unsupported. A sale does not guarantee recovery of the original purchase cost.

Purchases need BSC USDT and may need BNB for approval gas. Sales need the selected stock tokens and may need BNB. Approval changes a token allowance; it does not complete the stock trade. Quotes are short-lived, and changing the wallet, network or order invalidates the preview. Recheck a pending order rather than submitting a duplicate.

## Binance Agentic Wallet

```sh
npm run agentic:install
npm run dev
```

The installer pins the official `@binance/agentic-wallet@1.10.0` CLI inside `.tools/agentic-wallet`. Vela calls its external-signing interface; the Binance CLI and App manage the MPC wallet and permissions.

1. On localhost, open Agent or select Binance Agentic Wallet in Trade.
2. Select **Sign in with Binance**, open the returned Binance link, compare the pairing code, and confirm in Binance App. Keep the local server running while verification completes.
3. Enable Developer Mode and the required signing permissions in Binance App. Choose spending limits appropriate to your intended trade.
4. Fund the BSC address displayed by Vela. This account can differ from your browser wallet.
5. Obtain a trade preview, then request the Binance signing preview. Review the parsed operation, risks and authority changes before confirming. Complete any additional confirmation required in Binance App.

API keys authenticate data and trading requests; they do not connect the MPC wallet. Connected status and available quota do not establish a funded balance. Vela reads Binance settings but cannot enable Developer Mode or change App permissions.

The bridge runs on a local Node server with a single wallet session. It accepts predefined operations bound to retained trade previews, checks local host/origin and session capabilities, and does not expose arbitrary CLI commands. A public hosted instance cannot use this local bridge. Session credentials and recovery records remain private in the local data directory.

## Policy and execution

Execution checks include supported intent, token and wallet binding, trade size, allowed assets, market-hours preference, reference deviation, quoted price impact, token safety, funding, quote freshness and successful preflight. Missing required evidence blocks execution.

EVM swaps simulate the retained transaction payload through the Transaction API. An allowance-only failure can permit an exact approval when the other checks pass; the trade still requires a fresh successful preflight afterward. RFQ preflight validates the EIP-712 domain, tokens, amounts, recipient, deadline and wallet funds. This is order validation, not a simulation of the relayer's eventual settlement transaction. Unsupported typed-order structures are refused.

The discovery ranking is a **reference-risk score**, not an executable price or best-execution guarantee. Volume activity and impact heuristics do not establish liquidity depth. A closed-market reference is not current fair value; fallback market-hour estimates do not fully model exchange holidays.

Daily aggregate spending, portfolio concentration and executable liquidity-depth limits are not enforced by Vela. Portfolio exposure is informational. Binance wallet quotas are separate permissions enforced by its signing system.

Vela uses assisted execution: each signing operation requires explicit review and confirmation. Unattended strategies, a managed BNB Agent Studio runtime, ERC-8183 tasks and x402 self-funding are not implemented.

## Decision receipts

Previews and receipts are written atomically under `.data/`, or `VELA_DATA_DIR` when configured. Keep this directory on durable storage and back it up; ephemeral serverless storage cannot retain this execution state. Browser history uses localStorage and links to server-held receipts.

Individual records are accessible through `/receipts/<id>` and `/api/receipts?id=<id>&verify=true`. Receipt links grant access to the record; avoid sharing private trading details unintentionally. There is no global server receipt-list endpoint.

A SHA-256 checksum detects edits to a receipt. It is not a signed attestation or proof that the original inputs were truthful. Confirmed settlements additionally require a successful BSC transaction and matching net input/output token transfers. A signature, approval, order ID or pending transaction is not reported as a completed stock trade. Legacy records without evidence remain unverified.

## Development checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests use fixtures and mocks; they do not sign or spend funds. Mainnet execution and buy/sell round trips require separate wallet-approved verification.

## Documentation

- [Developer experience report](DX-REPORT.md)
- [Binance authentication](https://web3.binance.com/en/dev-docs/authentication)
- [RWA Data API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data)
- [Trading API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api)
- [Transaction API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api)
- [Wallet API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/wallet-api)
- [Binance Agentic Wallet](https://developers.binance.com/en/docs/products/agentic-wallet/welcome)
