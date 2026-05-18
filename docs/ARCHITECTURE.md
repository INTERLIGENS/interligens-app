# INTERLIGENS — Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| ORM | Prisma 5.22 |
| Database | Neon (PostgreSQL, pgBouncer port 6543) |
| Hosting | Vercel |
| Storage | Cloudflare R2 |
| RPC (Solana) | Helius (`mainnet.helius-rpc.com`) |
| RPC (Ethereum) | `ethereum.publicnode.com` |

## Design System

- Background: `#000000`
- Accent: `#FF6B00`
- Text: `#FFFFFF`
- Never use cyan (`#00E5FF`)

---

## Module Map — `src/lib/`

### Intelligence & Scoring

| Module | Description |
|--------|-------------|
| `tigerscore/` | Core TigerScore engine. Computes risk score (0–100) from scan inputs via weighted drivers. Intelligence hard-cap 0.20. |
| `tigre/` | TigerScore presentation layer — verdict labels, badge config. |
| `intelligence/` | AI-generated intel overlays. Loads from Neon, applies to TigerScore via `computeTigerScoreWithIntel`. |
| `intel/` | Intel record management (admin CRUD, ingest pipeline). |
| `intel-vault/` | Secure intel vault — compliance review, submissions, redactions. |
| `scoring/` | Generic scoring utilities shared across modules. |
| `publicScore/` | Public-facing score schema, rate limiting for `/api/v1/score`. |

### Scan & Analysis

| Module | Description |
|--------|-------------|
| `scan/` | Chain-specific scan orchestrators (SOL, ETH, BSC, BASE, ARB, TRON). |
| `freshness/` | LOCKED — freshness signal: tracks token activity recency. |
| `shill-to-exit/` | LOCKED — detects shill-to-exit patterns from on-chain timeline. |
| `narrative/` | LOCKED — AI-generated threat narrative for a token/wallet. |
| `destination-risk/` | LOCKED — risk scoring for transfer destination addresses. |
| `signature-intent/` | LOCKED — classifies wallet signature intent patterns. |
| `off-chain-credibility/` | LOCKED — off-chain social credibility signals. |
| `wallet-scan/` | LOCKED — full wallet risk scan (activity, exposure, labels). |
| `risk/` | Risk model primitives (severity levels, risk categories). |

### Wallet & Identity

| Module | Description |
|--------|-------------|
| `wallet-connect/` | Scan-before-connect companion — intercepts WalletConnect sessions, scans wallet before approval. |
| `wallet-adapters/` | Wallet adapter registry (Rabby, Coinbase, Trust Wallet). |
| `ens/` | ENS resolution utilities. |
| `entities/` | Known-bad address registry (EVM + SOL). |
| `labels/` | On-chain address label lookup. |
| `kol/` | KOL (Key Opinion Leader) profiles, alerts, and scan snapshots. |

### Market & Tokens

| Module | Description |
|--------|-------------|
| `market/` | Market data aggregator — DexScreener + GeckoTerminal. |
| `token/` | Token intel enrichment (metadata, links). |
| `helius/` | Helius API client (Solana RPC + metadata). |
| `solana/` | Solana RPC helpers (account info, token holders). |
| `solanaGraph/` | Solana transaction graph analysis. |
| `evm/` | EVM chain utilities (contract detection, ABI calls). |
| `tron/` | TRON chain utilities. |
| `chains/` | Chain detection and normalization. |

### Watcher & Alerts

| Module | Description |
|--------|-------------|
| `watcher/` | On-chain watcher daemon (v2) — monitors addresses via cron. |
| `telegram-watcher/` | V3 Telegram channel watcher — parser, detector, channel manager. |
| `telegram/` | Telegram webhook handler and message processing. |
| `watch/` | Watch list management per user. |
| `alerts/` | Alert generation and delivery (email, Telegram). |
| `surveillance/` | Surveillance module — signals, social heat, reports. |

### Case Intelligence

| Module | Description |
|--------|-------------|
| `case/` | Case management — create, update, link evidence. |
| `casefile/` | Casefile generation and PDF export. |
| `evidence/` | Evidence vault — snapshots, manual evidence, presigned upload. |
| `cluster/` | Address cluster analysis (shared funding, common patterns). |
| `graph/` | Case graph (nodes, edges, PDF). |
| `network/` | Network graph — investigators, case connections. |
| `laundry/` | Laundering pattern detection. |
| `proceeds/` | Illicit proceeds tracking. |

### Partner & API

| Module | Description |
|--------|-------------|
| `config/` | API key management and partner config. |
| `auth/` | Authentication helpers (admin check, session). |
| `security/` | Security headers, rate limiting, SDLC tooling. |

### Investigator Platform

| Module | Description |
|--------|-------------|
| `investigators/` | Investigator directory, profiles, trust levels. |
| `investigator/` | Single investigator dashboard (cases, alerts, PDFs). |
| `community/` | Community submission pipeline. |
| `coordination/` | Multi-investigator case coordination. |
| `governance/` | Investigator governance (revoke, suspend). |

### Operations & Admin

| Module | Description |
|--------|-------------|
| `admin/` | Admin utilities (stats, ops, intake review). |
| `ops/` | Operational tooling (batch jobs, processing). |
| `ingest/` | Data ingestion pipeline (RSS, signals, intel). |
| `ingestion/` | Raw ingestion helpers. |
| `intake/` | Intake queue — new signal review. |
| `digest/` | Weekly/daily digest generation. |
| `email/` | Transactional email (Resend). |
| `osint/` | OSINT signal collection (Twitter/X, web). |
| `xapi/` | Twitter/X API client. |
| `storage/` | R2 file storage (upload, presign, CDN). |
| `pdf/` | PDF generation (casefiles, KOL reports). |
| `report/` | Report assembly and delivery. |
| `vault/` | Vault rate limiting, scan count, bootstrap. |

### AI & Explanation

| Module | Description |
|--------|-------------|
| `llm/` | LLM abstraction layer (Claude). |
| `ask/` | "Ask INTERLIGENS" — grounding context + why bullets. |
| `explanation/` | Verdict explanation types and builder. |
| `qa/` | QA scoring — explanation quality evaluation. |

### Frontend / Demo

| Module | Description |
|--------|-------------|
| `demo/` | Demo page data + mock generator. |
| `retail/` | Retail verdict banner logic. |
| `simulator/` | Interactive score simulator. |
| `copy/` | UI copy strings. |
| `i18n/` | Internationalisation helpers (en/fr). |

### Finance

| Module | Description |
|--------|-------------|
| `equity/` | Equity / investor data. |
| `mm/` | Market maker tracking — scan, assess, badge. |
| `mm-tracker/` | MM tracker spec implementation. |
| `rwa-registry/` | Real-world asset registry. |
| `market/` | See above (Market & Tokens). |

---

## Key API Flows

### Public Score (`GET /api/v1/score?mint=…`)

```
Request → Rate Limit (60 req/min/IP)
        → isValidMint / isValidEvmAddress
        → EVM path: computeTigerScoreWithIntel → corsHeaders → 200
        → SOL path: loadCaseByMint + getMarketSnapshot + Helius + scamLineage graph
                  → computeTigerScoreFromScan + computeTigerScoreWithIntel
                  → merge scores → PublicScoreResponse → 200
```

### Scan Context (`GET /api/v1/scan-context?target=…`)

```
Request → Rate Limit → detectChain → normalizeAddress
        → SOL: Helius metadata + DexScreener (parallel) → merge → token/wallet
        → EVM: DexScreener → token/wallet
        → TRON: address-only → low confidence
        → In-memory cache (60s market / 5min wallet)
```

### Mobile Scan (`POST /api/mobile/v1/scan`)

```
Request → X-Mobile-Api-Token (timing-safe compare)
        → Rate Limit (MOBILE preset)
        → { address, chain } → detectChain → computeTigerScoreFromScan
        → KOL alert + snapshot → { score, tier, riskLevel, drivers }
```

### Watcher Flow

```
Cron /api/cron/watcher-v2 → watcher/lib → forEach watched address
  → scan/solana or scan/evm → TigerScore delta
  → if delta threshold → alerts/lib → email + Telegram
```

### Telegram Watcher V3

```
Channel list → telegram-watcher/channelManager
  → parser (message tokenizer)
  → detector (shill pattern matching, address extraction)
  → if hit → alert pipeline → admin inbox
```

### Partner API (`/api/partner/v1/`)

```
X-Api-Key header → config/lib key lookup → rate limit per tier
  → proxies to internal /api/v1/* endpoints
  → response + usage tracking
```

---

## Infrastructure

```
Vercel (Next.js host)
  └─ /api/* → Serverless functions (Node.js runtime)
  └─ Static assets → CDN

Neon (PostgreSQL)
  └─ ep-square-band (prod)
  └─ pgBouncer port 6543 (pooled)
  └─ Schema: prisma/schema.prod.prisma (additive only)

Cloudflare R2
  └─ PDFs, evidence snapshots, casefile exports

Helius (Solana RPC)
  └─ getAsset, getParsedAccountInfo, token-metadata

Host-005 (Watcher daemon)
  └─ krypt@MacBook-Pro-4
  └─ launchctl, 29 handles
  └─ /Users/krypt/interligens-watcher/
```

---

## Locales

Pages exist in two locale trees:
- `src/app/en/` — English (19 pages)
- `src/app/fr/` — French (20 pages)
- `src/app/[locale]/` — Dynamic locale root

---

## KOL Registry

- 215 profiles published
- 9 investigated in depth (bkokoski, GordonGekko, sxyz500, lynk0x, planted, DonWedge)
- PERSON-type profiles: never retail-visible
- TigerScore intelligence hard-cap: 0.20
- OFAC match: floor 15
