# Vela

Execution intelligence for tokenized stocks on BNB Smart Chain.

The same stock trades at different prices across bStocks, Ondo, and xStocks on BSC. Vela finds every representation, compares real execution costs, simulates the trade on-chain, and generates a verifiable receipt proving the outcome.

## The Problem

Tokenized equities landed on-chain faster than the tooling did. NVDA can differ by 2%+ across providers — invisible without comparison. Low-liquidity providers quote one price but execute at another. When traditional markets close, reference prices go stale while on-chain trading continues.

## What Vela Does

1. **Discover** — Type a natural-language intent (e.g. "Buy $500 of NVDA"). Vela finds every tokenized version across providers on BSC.
2. **Compare** — Each provider ranked by effective execution cost: price deviation from reference, slippage (from DEX aggregator quotes), liquidity depth, and gas.
3. **Simulate** — Policy engine checks market hours, deviation thresholds, volume, and honeypot risk. Transaction simulated on-chain via the Transaction API before signing.
4. **Execute & Receipt** — Wallet signs the swap. Vela generates a verifiable receipt: intent, alternatives considered, reasoning, simulation result, and on-chain outcome.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js Frontend (React 19, Tailwind, Zustand)         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Trade    │ │ Markets  │ │Portfolio │ │ Receipts  │  │
│  │ Terminal  │ │ Browser  │ │ Viewer   │ │ Audit Log │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
├───────┴────────────┴────────────┴───────────────┴───────┤
│  API Routes (Next.js Server)                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Engine: Intent Parser → Comparison → Policy      │   │
│  │          → Receipt Generation                     │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Flight Recorder (API call logging for DX report) │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Binance Web3 API Integration                            │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐  │
│  │RWA Data │ │Trading  │ │Transaction│ │ Wallet API │  │
│  │(public +│ │API quote│ │API sim   │ │ balances   │  │
│  │ authed) │ │& swap   │ │& verify  │ │ & state    │  │
│  └─────────┘ └─────────┘ └──────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## API Modules Used

| Module | Usage |
|--------|-------|
| **RWA Data API** (public) | Token discovery, kline data, provider identification |
| **RWA Data API** (authenticated) | Reference prices, market status, enriched token metadata |
| **Trading API** | DEX aggregator quotes, swap building, approval checks |
| **Transaction API** | On-chain simulation before execution |
| **Wallet API** | Portfolio balances and positions |

## Setup

### Prerequisites

- Node.js 18+
- Binance Web3 API key ([get one here](https://web3.binance.com/en/dev-portal))

### Install & Run

```bash
git clone <repo-url>
cd equitytwin
npm install
cp .env.example .env.local
# Edit .env.local with your API credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```
BINANCE_WEB3_API_KEY=your_api_key
BINANCE_WEB3_SECRET_KEY=your_secret_key
```

## Key Features

- **Cross-provider comparison**: Automatically discovers and ranks all tokenized representations of a stock
- **Market-hours awareness**: Detects stale reference prices during weekends/after-hours and applies uncertainty penalties
- **Policy engine**: Multi-check firewall (market status, price deviation, liquidity, volume, slippage, simulation, honeypot) with allow/warn/block actions
- **Verifiable receipts**: Full audit trail of every trade decision — what was asked, what was chosen, why, and what happened
- **Flight recorder**: Logs every API call with latency and errors for developer experience analysis
- **MetaMask execution**: Direct wallet signing for on-chain swaps via DEX aggregation

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **State**: Zustand
- **Data fetching**: TanStack React Query
- **Styling**: Tailwind CSS 4
- **Wallet**: ethers.js v6
- **Chain**: BNB Smart Chain (BSC) mainnet

## Project Structure

```
src/
├── app/
│   ├── api/           # Server-side API routes
│   │   ├── trade/     # Core trade flow (discover, quote, simulate, execute)
│   │   ├── markets/   # Market data endpoints
│   │   ├── portfolio/ # Wallet portfolio data
│   │   ├── receipts/  # Receipt storage and retrieval
│   │   └── flight-recorder/ # API call log export
│   ├── trade/         # Trade terminal page
│   ├── markets/       # Market browser page
│   ├── portfolio/     # Portfolio page
│   └── receipts/      # Receipt audit log page
├── components/
│   ├── trade/         # Trade terminal components
│   ├── markets/       # Market browser components
│   ├── portfolio/     # Portfolio components
│   ├── layout/        # Navigation, market status
│   └── shared/        # Reusable components
└── lib/
    ├── api/           # API client modules
    ├── engine/        # Core logic (intent, comparison, policy, receipt)
    ├── stores/        # Zustand state stores
    └── types/         # TypeScript type definitions
```

## License

MIT
