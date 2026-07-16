# VYRON — Every goal. Executed.

VYRON is an autonomous execution agent built for the **OKX.AI Agent Marketplace**. Give it one objective and it plans the work, hires the right Agent Service Providers (ASPs) from the marketplace, escrows payment on-chain, monitors delivery, and settles — with no chat back-and-forth and no manual babysitting.

Built for the **OKX Build-X hackathon**.

## What it actually does

Most "AI agent" demos are a chatbot with tool calls. VYRON is closer to an autonomous COO: it runs a real, staged execution pipeline and keeps running it in the background whether or not anyone is watching the dashboard.

1. **Plan** — a single objective is decomposed into a dependency-ordered workflow of concrete tasks.
2. **Match** — each task is scored against the marketplace on price, quality, track record, and availability to find the best ASP.
3. **Negotiate & assign** — terms are agreed and the task is handed off.
4. **Escrow** — payment locks on-chain the moment a task is assigned; it only releases after delivery is verified.
5. **Monitor** — a background loop (`lib/monitor.ts` + `instrumentation.ts`, ticking every few seconds) checks progress with zero clicks required.
6. **Self-heal** — if an ASP is running slower than its committed rate (a real delay factor derived from rating/availability), the monitor detects it and reassigns the task on its own — no manual trigger.
7. **Verify & settle** — deliverables are checked against the task spec before escrow releases funds.

Every stage above is a real computed state transition (`lib/engine/*`), not a scripted animation.

## Real on-chain settlement

VYRON is also a **registered ASP on OKX's ERC-8004 Task Marketplace** (agent `#4962`), offering two live services other agents can hire:

- **Autonomous Objective Execution** (`#30913`) — hand VYRON any objective; it runs the same pipeline above for you and delivers a compiled report.
- **Honeypot & Rug Risk Scanner** (`#30914`) — plain-English honeypot/rug-pull risk verdicts for any token or contract (EVM + Solana), used like a human auditor rather than static rules.

Escrow settlement itself is live on **X Layer Testnet** — real contracts, real transactions, no simulation in the funding path:

| Contract | Address |
|---|---|
| `Escrow` | `0x5345ff0fcbdd07a644a46e6e1c758415ee1dfa23` |
| `AgentRegistry` | `0x99dd3da31e0ffe399fd129ee5af443cf46416e95` |
| `Reputation` | `0xf126ed6a58d35b7fb73a2c018b9d7e938e851c4a` |

Wallet connect is a real `viem`/`wagmi` integration (OKX Wallet, MetaMask, WalletConnect) — not a placeholder button.

## Architecture

```
app/                Next.js 15 App Router — dashboard UI + API routes
  api/asp/           HTTP bridge for the OKX.AI ASP services (#4962)
  api/cron/tick      Vercel Cron backstop that drives the engine forward
  dashboard/         Goal creation, workflows, marketplace, agents, history
lib/
  engine/            The autonomous execution engine (plan/match/execute/verify)
  escrow/            EscrowProvider interface — simulated + real xlayer-provider.ts
  web3/              wagmi/viem config, on-chain reputation reads
  monitor.ts          Background tick loop (self-healing, stall detection)
contracts/           Hardhat project — Escrow / AgentRegistry / Reputation
prisma/              Postgres schema + seed data
```

The engine talks to the OKX.AI marketplace through the `onchainos` CLI / `okx-a2a` daemon (agent-to-agent communication over XMTP) — designated tasks arrive as on-chain events, get matched against VYRON's registered services, and are applied to or declined automatically based on a price-floor and capability check.

## Getting started

```bash
npm install
npm run db:seed   # optional — seeds demo data if DATABASE_URL is unset/local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Nothing in `.env` is required to run it.** Copy `.env.example` to `.env.local` and fill in only what you want to switch on — with everything unset, VYRON runs fully offline: a fixed demo identity, seeded data, and a heuristic goal planner instead of a live LLM call. See the comments in `.env.example` for what each variable turns on (database, Clerk auth, OpenAI-compatible planner, and real X Layer escrow).

> Running `npm run dev` locally with the escrow contract addresses unset falls back to `lib/escrow/simulated-provider.ts` (same interface, no chain calls) — set `ESCROW_PROVIDER=xlayer` plus the contract addresses above to hit the real deployed contracts.

### Deploying the contracts yourself

```bash
cd contracts
npm install
npm run compile
npm run deploy:xlayer-testnet   # needs a funded X Layer Testnet wallet key in contracts/.env
```

## Stack

Next.js 15 · React 19 · Prisma + Postgres (Neon) · viem / wagmi · Tailwind + shadcn/ui · Hardhat (Solidity contracts) · Vercel AI SDK

## License

Private — built for OKX Build-X.
