# Founding Intelligence Seed

A day-1 seed layer that makes INTERLIGENS **stop returning empty intelligence**
when an investigator adds a wallet, domain or URL as a lead.

Built on `feat/founding-intelligence-seed` — 2026-04-18.

## What the seed layer does

- **Cross-references any domain or URL** against 622,899 labelled rows from
  four public community-maintained blacklists.
- **Cross-references any wallet** against 3,309 labelled addresses from
  OFAC SDN and ScamSniffer.
- **Contextualises known protocol front-ends** via 7,358 DefiLlama protocol
  rows so the orchestrator can say "this domain is the real Uniswap app",
  not "unknown".
- **Distinguishes four source states** per engine, no more generic "checked
  N sources, none are in our datasets":
  - `INTERNAL_MATCH_FOUND` — our curation matched (KOL actor, proceeds, etc.)
  - `EXTERNAL_THREAT_SIGNAL_FOUND` — OFAC / MetaMask / Phantom / ScamSniffer
    fired
  - `NO_INTERNAL_MATCH_YET` — valid lead, nothing in our memory
  - `SOURCE_UNAVAILABLE` — dataset empty or upstream error; retry later

## What the seed layer does NOT do

- **No on-chain tracing.** We don't follow funds on any chain.
- **No KOL attribution from external feeds.** Bringing Kokoski/Gekko/Sam
  O'Leary-class actors in is proprietary work — curated by hand or by
  purpose-built ingestors that sit on top of social/onchain data. The seed
  layer helps on day-1 but does not replace that curation.
- **No laundry trail reconstruction.** `LaundryTrail` remains proprietary.
- **No cross-chain continuity.** Not in scope.
- **No heavy AML engine.** Zero third-party paid datasets, zero
  questionable-license scraped corpora.
- **No bulk Chainabuse / GoPlus ingest.** Their ToS restrict
  redistribution; skeletons exist for on-demand lookup only.

## Internal vs external sources

| Source | Rows | Confidence policy | Kind |
|---|---|---|---|
| **INTERLIGENS KolProfile + KolWallet + KolAlias + KolEvidence** | 363 / 478 profiles+wallets | HIGH for `confirmed_scammer`, else MEDIUM | **Internal** (proprietary curation) |
| **INTERLIGENS LaundryTrail / WalletFundingEdge** | sparse | derived from `laundryRisk` (CRITICAL/MODERATE/LOW) | **Internal** (proprietary) |
| **OFAC SDN (digital currency addresses)** | 779 | HIGH / severity CRITICAL | **External** (US Government, public domain — 17 USC §105) |
| **MetaMask eth-phishing-detect** | 242,915 | HIGH (blacklist) · MEDIUM (fuzzylist) | **External** (MetaMask copyright; attribution preserved) |
| **Phantom blocklist** | 44,852 | HIGH (blocklist / eth-blocklist) · MEDIUM (fuzzylist) | **External** (MIT) |
| **ScamSniffer addresses** | 2,530 | MEDIUM | **External** (GPL-3.0) |
| **ScamSniffer domains** | 330,059 | MEDIUM | **External** (GPL-3.0) |
| **DefiLlama protocols** | 7,358 labels + 5,073 trusted domains | HIGH (context label, not threat) | **External** (MIT / public data) |

Every row carries `sourceName`, `sourceUrl`, `license` fields so attribution
is durable and any derivative export respects upstream obligations.

## Why this improves day-1 investigator experience

Before this seed layer, the orchestrator engine fanout ran correctly but
every Tier-1 engine returned `events: 0, suggestions: 0` because the
curated datasets were too thin for a common lead — an arbitrary ETH wallet,
a phishing domain, a URL from a conversation. The reaction panel always
collapsed to "No matches yet".

After this seed layer:

- **Any of ~623k phishing / drainer / typosquat domains** immediately
  trigger a reaction panel with severity, source attribution, and a
  click-through to the labelled evidence.
- **Every OFAC-sanctioned wallet** is flagged CRITICAL.
- **Every DefiLlama-registered protocol front-end** is contextualised as
  trusted (stops false alarms on legitimate dApp URLs).
- **Unknown leads** produce a clear non-empty state — "No INTERLIGENS
  internal actor match yet. External threat signals didn't fire. Manual
  checks available." — instead of a dead panel.

## What still requires proprietary datasets later

The seed layer covers two primitives:
1. *Is this domain/wallet on a public threat list?*
2. *Is this a known-legitimate protocol?*

It does **not** cover:

- **Actor attribution** (who is behind `bkokoski`, `GordonGekko`,
  `sxyz500`, Vine, GHOST, Dione Protocol founders, BOTIFY operators).
  Proprietary curation in KolProfile + KolAlias is where the
  investigator-grade edge lives.
- **Proceeds quantification** — `totalScammed` / `totalDocumented` /
  `cashoutCache`. These require either manual documentation or a
  per-actor on-chain reconstruction engine.
- **Laundry-trail pattern detection** — requires pattern rules +
  per-chain indexing, not a public blocklist.
- **Cross-chain continuity** — out of scope for this session.
- **Retail-visible wallet attribution** — TigerScore + PERSON gating
  logic lives elsewhere and is unaffected by this seed.

## Operating model going forward

- Daily Vercel crons refresh every P0 source (all idempotent on composite
  unique keys):
  - `03:00 UTC` — OFAC SDN
  - `03:30 UTC` — ScamSniffer addresses
  - `04:00 UTC` — MetaMask phishing
  - `04:15 UTC` — Phantom blocklist
  - `04:30 UTC` — ScamSniffer domains
  - `04:45 UTC` — DefiLlama protocols
- Manual refresh: `npx tsx --env-file=.env.local scripts/run-founding-intelligence-seed.ts --source=<name>`.
- On-demand lookups (`ENS` / `Chainabuse` / `GoPlus`) go through
  `ExternalLookupCache` — positive TTL 7 days, negative 6 hours, error 15
  minutes. ENS is key-less; Chainabuse / GoPlus require env vars and
  return `SOURCE_UNAVAILABLE` cleanly when unconfigured.
