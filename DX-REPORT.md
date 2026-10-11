# Vela — Developer Experience Report

Updated 11 October 2026.

Vela is a tokenized-stock execution interface for BSC mainnet. It discovers stock representations, obtains a wallet-specific quote, evaluates execution constraints, requests signing, and records the decision and settlement evidence. The integration uses Binance RWA and market data, Trading, Transaction and Wallet APIs, plus the official Binance Agentic Wallet CLI. ERC-8004 identity registration is a separate optional feature. Managed BNB Agent Studio deployment and x402 payments are outside the implemented scope.

This report distinguishes problems observed in the application from behavior established by code and fixture tests. The live recorder subsequently verified a funded $5.30 NVDA purchase on BSC mainnet. Identity registration, a completed sale and measured platform performance are not claimed without supporting records.

## Onboarding

There are three separate setup steps: Web3 API credentials, a funded BSC execution account, and signing permission. Treating them as one connection caused confusion during development.

The API key and secret belong in the server's `.env.local`. They enable authenticated requests; they do not pair the Agentic Wallet. A connected browser wallet is another account, and a Binance MPC wallet has its own BSC address. Funding the browser address does not fund the MPC address.

The application now offers both execution accounts explicitly. The Agentic Wallet panel shows connection state, BSC address, wallet quota, Developer Mode quota, lock state and session expiry. A connected, unlocked MPC account with Developer Mode enabled was visible during setup. That establishes pairing and permission visibility, not a stock purchase or a funded balance.

Elapsed time from opening the documentation to the first successful API call was not recorded reliably. No onboarding-time estimate is included. The most useful improvement would be a single onboarding guide that separates API authentication, wallet pairing, Developer Mode, funding and the first signing request.

## Documentation and integration issues

### RWA discovery and executable metadata

The application combines public stock discovery with authenticated RWA metadata. Discovery identifies representations; execution additionally needs a verified token-to-share ratio, decimals, reference price and market state for the selected contract.

The current adapter joins records by contract address. A discovered stock can be visible without having enough verified metadata to trade. In that case, execution is refused. Discovery coverage is therefore not a guarantee of executable coverage across all three providers.

The relevant documentation is the [RWA Data API reference](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data). A useful addition would be a worked example showing how discovery records, platform identifiers, contract addresses and executable metadata connect, including the expected behavior when one representation has no authenticated record. This is an integration request, not a verified claim that a particular platform is unsupported by the API.

### Reference prices and market closure

The interface displayed weekend or closed-market status with a stale reference, including approximately 28–31 hours since the estimated close during the recorded setup. These are application estimates; they are not a measured timestamp supplied by the reference-price publisher.

A token can trade while its underlying market is closed. Comparing that token with the last underlying reference does not prove overpayment, fair value or an arbitrage opportunity. Earlier discovery wording overstated this by presenting a heuristic as effective execution cost. It now uses “reference-risk score” and explicitly distinguishes discovery from an executable wallet quote.

The requested improvement is a reference-price publication timestamp, source, currency, exchange calendar and corporate-action status attached to the price. A closed-market flag alone cannot establish the age or meaning of a reference. Vela's fallback market-hour calculation does not fully model exchange holidays.

### Amounts, decimals and share exposure

Execution amounts are expressed in the input token's base units. BSC USDT uses 18 decimals in this integration. Stock-token decimals and token-to-share ratios cannot be assumed to match USDT or each other.

Vela converts amounts using decimal-string parsing rather than multiplying floating-point numbers by a large power of ten. Buying and selling reverse the token pair: purchases spend USDT; sales spend the selected issuer's stock token. On-chain stock decimals and balances are checked before a sale.

The interface distinguishes stock-token quantity from normalized share exposure. Discovery normalizes token price by the token-to-share ratio; execution calculates share exposure from the actual quoted token quantity. Sales accept an explicit token quantity or sell-all for one selected issuer. Share-count, dollar-value and percentage sales are rejected.

The [Trading API reference](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api) would benefit from a complete stock buy-and-sell example covering raw amounts, decimals, share ratios, the approval token and the reversed RFQ pair.

## API pitfalls and error handling

### Approval failures are not trade failures with the same remedy

A browser-wallet AAPL preview for $5.10 showed:

`execution reverted: BEP20: transfer amount exceeds allowance`

The failed preflight blocked execution. The immediate problem was allowance, rather than evidence that the stock purchase had completed or that the wallet necessarily lacked funds. Approval and funding are separate checks.

The corrected browser flow permits an exact token approval only when this is an allowance-only failure, the quote remains fresh and the other policy checks pass. The server rechecks the account, input balance, BNB and current allowance. After approval, the old quote is discarded and the actual swap must pass a fresh preflight. Approval is never recorded as stock settlement.

A structured simulation result distinguishing insufficient allowance, insufficient token balance and insufficient gas would make this recovery less dependent on matching a revert message. The relevant integration point is the [Transaction API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api).

### Small orders and vendor minimums

Vela's application minimum is $5. A minimum accepted by the application does not override the venue's order rules. The interface now states that vendor minimums may be higher and that insufficient funds are checked during preview.

The same distinction matters when selling: a residual stock balance may have a notional value below the executable minimum. A $6 purchase is not a promise that its later sale returns $6 after price movement, spread and fees.

A quote response should expose the applicable minimum, its currency or token unit, whether fees are included, and whether the rule applies to purchases, sales or both. These fields would allow the interface to explain a refusal before requesting signing.

### Quote lifetime and signing latency

Vela applies a 25-second freshness window to its execution previews. This is an application safeguard, not a measured statement that every vendor quote expires after exactly 25 seconds.

Wallet review and App confirmation can consume that window. The retained order binds the wallet, token pair, amount, deadline and signing payload; expired or changed state must be refreshed rather than silently replaced under an existing signature.

The requested API improvement is an explicit quote expiry and a distinct expired-quote error. For RFQ orders, an order-status reference should remain usable after submission so recovery does not depend on resubmitting the same trade.

### EVM simulation and RFQ validation are different

An EVM swap has calldata that can be simulated before broadcast. An RFQ has an EIP-712 order that a relayer settles later. Validating the typed order does not simulate that future transaction.

Vela labels these separately. RFQ validation checks domain, token pair, spend, recipient, output bound and deadline, as well as funding. Unsupported typed-data structures are refused. A successful signature or returned order ID remains pending until settlement is verified.

A single documented example tracing quote, swap construction, order signature, submission, order status and settlement hash would reduce ambiguity. Separate examples are needed for EVM swaps and RFQ orders.

## Agentic Wallet and AI stack

### Pairing and permission visibility

Initial setup surfaced “Invalid Binance pairing response” and subsequently a rejected sign-in link. The local adapter needed to handle the actual CLI response while preserving strict link validation. Supported login links are HTTPS on trusted Binance hosts; lookalike hosts and malformed links remain rejected.

The current integration uses official `@binance/agentic-wallet@1.10.0`, installed locally, and the CLI's supported session-directory configuration. An expiry-format mismatch also blocked signing despite an enabled Developer Mode flag: the wallet-settings reference describes Unix seconds, but the installed CLI converts the expiry to a timezone-qualified date string. Vela now accepts both forms, normalizes them to seconds, and still refuses missing or expired permission. Developer Mode expiry is shown separately from login session expiry. The pairing verifier remains active while the user completes Binance App confirmation. The connected wallet panel subsequently displayed a BSC address, unlocked state, session expiry and Developer Mode enabled.

The [Agentic Wallet documentation](https://developers.binance.com/en/docs/products/agentic-wallet/welcome) and its authentication/external-signing references would be easier to integrate with a versioned JSON schema for success, pending confirmation, rejection and expiry. Copyable response examples should include the exact sign-in URL and pairing-code fields.

### Local origin handling

“Cross-origin execution requests are not permitted” appeared during local use. This was an application origin-check problem, unrelated to API-key validity or account balance. Next.js can add forwarding headers and an internal request URL that differs from the browser-facing origin.

The corrected guard validates the browser-facing host/origin pair and matching framework forwarding information, while rejecting mismatched authorities and cross-site requests. The local signing bridge remains unavailable through public hosts.

### Signing scope

Vela requests external-signing previews, displays the parsed operation and risks, and requires explicit confirmation. Additional Binance App confirmation depends on the wallet's rules. The application reads security settings; it cannot enable Developer Mode or change the user's quotas.

This is assisted MPC execution, not an unattended strategy runtime. AI intent parsing does not grant spending authority. Natural-language input has a deterministic fallback and unsupported intents are rejected before signing.

Useful additions would be documented permission scopes for external signing, clear quota units, structured reasons for App-required confirmation, and recovery guidance for a timeout after signing may already have begun. A retry must not create a second financial operation merely because the first response was delayed.

### ERC-8004 and Agent Studio

The Agent page supports identity metadata registration. An observed registration error was:

`Failed to execute 'btoa' on 'Window': The string to be encoded contains characters outside of the Latin1 range.`

The fix encodes metadata as UTF-8 before producing the data URI. This was a browser encoding bug in Vela, not an ERC-8004 contract failure or evidence of insufficient BNB.

Identity registration is separate from wallet provisioning, autonomous hosting and x402 payments. No completed identity registration or managed Agent Studio runtime is claimed in this report. The requested platform improvement is a worked example connecting agent identity, signing permissions, runtime tasks and verifiable execution evidence without treating these as interchangeable features.

## Tokenized-stock behavior

Vela treats issuer representations as distinct tokens. Holdings in one issuer cannot be sold by selecting another issuer with the same underlying ticker. Contract address, chain, decimals and share ratio matter throughout quote construction and settlement verification.

The available volume fields are shown as source units and activity proxies. They are not a measured executable liquidity-depth curve. This report does not rank provider liquidity, quote a universal maximum trade size, or claim a honeypot false negative from thin liquidity. A honeypot flag and market depth answer different questions.

Cross-provider discovery also does not establish cross-provider arbitrage. That would require executable quotes for both legs, fees, inventory, settlement timing and equivalent exposure. Vela currently assists a selected representation's spot trade.

Requested stock-specific fields include verified share-ratio effective dates, corporate-action status, reference timestamps and executable depth for a stated order size. These would make refusals explainable and comparisons less dependent on local assumptions.

## Decision evidence and recovery

An earlier interface showed “Trade complete” with a receipt link whose record was empty. That is an application correctness issue: a success label without settlement evidence cannot establish execution.

Current previews and receipts are stored atomically on the local server. Browser history points to those records. Confirmation requires a successful BSC mainnet transaction and matching net input/output token transfers. Receipts retain the quote, policy result, preflight scope, signing evidence where available, execution state and refusal reason. Pending operations can be rechecked rather than automatically repeated.

Receipt checksums detect modifications but are not signed attestations. Refusal records document application decisions; they do not independently prove historical market inputs. A BscScan link becomes settlement evidence only when it points to the actual matching transaction, not an approval or unrelated transfer.

The storage design requires a durable Node server filesystem. Ephemeral serverless storage cannot preserve local signing sessions and execution recovery records. This deployment limitation is documented rather than presenting a static frontend as a complete hosted execution service.

## Measurement and remaining evidence

The flight recorder keeps up to 500 API records in memory for the server process and exposes endpoint, status, latency, response size and error summaries. It is not a permanent audit log of every request. Its export must be saved before a restart when used as measurement evidence.

No retained benchmark dataset supports the earlier draft's precise latency figures, rate-limit claims or first-call timing. Those figures have been removed. The fixture tests exercise failure handling, order validation, approval boundaries, pairing and receipts; they do not demonstrate a funded mainnet round trip.

A wallet-approved $5.30 NVDA purchase now has a matching decision receipt and verified BSC settlement: [settlement transaction](https://bscscan.com/tx/0xaca1fc2c13170efa9ffa68cbe02bd499c35b429ee139d63087f50950494db57b). The live recorder retained this evidence with the actual app footage. A separate sell verification is still needed if round-trip behavior is claimed, as is saved API telemetry for performance conclusions. Personal onboarding timing and documentation-page observations should come from the participant's own records.

## Priority platform recommendations

| Request | Practical benefit |
| --- | --- |
| Versioned CLI JSON schemas and pairing examples | Reliable authentication and confirmation handling |
| Complete stock EVM and RFQ lifecycle examples | Clear distinction between approval, signature, submission and settlement |
| Quote expiry and structured order minimums | Useful refusal messages before signing |
| Structured simulation failure categories | Safe allowance recovery without misclassifying balance or gas failures |
| Reference timestamps, exchange calendars and corporate-action metadata | Explicit treatment of stale references and changing share exposure |
| Per-size executable depth and documented volume units | Meaningful comparisons without presenting volume as liquidity |
| Idempotent recovery and confirmation-status examples | Fewer duplicate submissions after timeouts |
| Clear separation of identity, wallet permissions and managed runtime | Accurate onboarding for the optional AI stack |

These requests follow the integration boundaries encountered in Vela. They are not assertions that an undocumented capability is unavailable across the entire Binance platform.
