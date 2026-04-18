# INTERLIGENS Intelligence Inventory

Generated **2026-04-18** against `ep-square-band` (production).
Branch `feat/founding-intelligence-seed`.

## 1 · Row counts by table

### Curated actor graph (proprietary)

| Table | Rows |
|---|---:|
| KolProfile | **363** |
| KolWallet | **478** |
| KolAlias | 9 |
| KolEvidence | **61** |
| KolPromotionMention | 12 |
| KolTokenInvolvement | 15 |
| KolTokenLink | 17 |
| KolCase | 10 |

### Forensic / on-chain

| Table | Rows |
|---|---:|
| LaundryTrail | 5 |
| LaundrySignal | 21 |
| WalletFundingEdge | 38 (all SOL) |
| EvidenceSnapshot | 20 |

### External threat intel (founding seed)

| Table | Rows | Notes |
|---|---:|---|
| AddressLabel | **3,313** | 779 OFAC · 2,530 ScamSniffer · 4 INTERLIGENS proprietary |
| DomainLabel | **622,899** | 242,915 MetaMask · 44,852 Phantom · 330,059 ScamSniffer · 5,073 DefiLlama |
| ProtocolLabel | 7,358 | DefiLlama metadata |

### Intel feed + founder intel

| Table | Rows |
|---|---:|
| FounderIntelItem | 241 |
| FounderIntelSource | 20 |

### Market maker tracker

| Table | Rows |
|---|---:|
| MmAttribution | 32 |
| MmSource | 34 |

### Case workspace (encrypted)

| Table | Rows |
|---|---:|
| VaultCase | 3 |
| VaultCaseEntity | 4 |
| VaultCaseIntelligenceEvent | 3 |

### Legacy / out-of-band

| Table | Rows | Notes |
|---|---:|---|
| ExternalLookupCache | 0 | Populated on-demand by ENS / Chainabuse / GoPlus lookups |
| DomainIoc | 0 | Pre-orchestrator domain store; superseded by `DomainLabel` |
| WatchSource | 0 | Not used by orchestrator |
| WalletLabel | 0 | Not used by orchestrator |
| CaseFile | 0 | Legacy; superseded by `VaultCase*` |
| VaultPublishCandidate | 0 | Publish queue is clean |

---

## 2 · KolProfile distribution

- **By publish status**: 30 published · 333 draft
- **By risk flag**:
  - confirmed + confirmed_scammer + confirmed_scheme + confirmed_rug: **7**
  - high + high_risk: **4**
  - flagged: **18**
  - under_investigation: **1**
  - paid-promo + promoter: **3**
  - victim_pool: **1**
  - unverified (bulk sample, not reviewed): **330**

- **Coverage quality (out of 363)**:
  - with ≥1 wallet: **219 (60%)**
  - with ≥1 evidence: **15** (quality gate, not all published use evidence rows)
  - with ≥1 token link: **7**
  - with ≥1 promotion mention: **non-zero but unmeasured**
  - with ≥1 proceeds value: **4**

---

## 3 · Named-actor coverage (operator request list)

| Handle | risk | rugs | $scammed | $documented | wallets | aliases | evidence | tokens | trails | promos | publish |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **bkokoski** | confirmed_scammer | 12 | $4,500,000 | $1,077 | **22** | 1 | **20** | 3 | 1 | 3 | published |
| **GordonGekko** | high | 2 | — | $40,627 | **14** | 0 | 4 | 2 | 1 | 5 | published |
| **sxyz500** | confirmed_scammer | 2 | $1,200,000 | $4,356 | 9 | 1 | 2 | 2 | 1 | 0 | published |
| **planted** | high | 2 | — | $0 | 1 | 1 | 3 | 2 | 0 | 0 | published |
| **lynk0x** | unverified | 0 | — | $0 | 8 | 1 | 2 | 1 | 1 | 0 | published |
| **Regrets10x** | unverified | 0 | — | $0 | 1 | 1 | 1 | 0 | 0 | 0 | draft |
| **dione-protocol** | under_investigation | 0 | — | — | 0 | 4 | **11** | 6 | 0 | 0 | published |
| **ghostwareos** | confirmed | 5 | $327,790 | $6,750 | 6 | 0 | 0 | 0 | 1 | 0 | published |
| **OrbitApe** | unverified | 0 | — | $0 | 0 | 0 | 0 | 0 | 0 | 0 | draft |

Plus the 21 actors from the BOTIFY full-pedigree seed (CryptoZin, Brommy, Geppetto, Blackbeard, CoachTY, Ronnie, Exy, EduRio, MoneyLord, ElonTrades, Nekoz, Barbie, wulfcryptox, SolanaRockets, 0xBossman, sibeleth, ShmooNFT, SamuelXeus, …) — all present, all published.

Plus 14 Myrrha-cluster KOLs and 12 BOTIFY employees seeded via `seedBotifyLeakedDoc.ts`.

---

## 4 · LaundryTrail actor attribution

| kolHandle | trails | signals (summary) |
|---|---:|---|
| bkokoski | 1 | attached |
| sxyz500 | 1 | attached |
| GordonGekko | 1 | attached |
| lynk0x | 1 | attached |
| ghostwareos | 1 | CASH×3 · FRAG×2 · DEG×2 |

---

## 5 · Project-scoped wallets in AddressLabel (operator-provided, `sourceName = INTERLIGENS`)

| Address | Chain | Label | labelType |
|---|---|---|---|
| `4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4` | SOL | VINE deployer wallet | SCAM |
| `ESvvMoeA9ns4qReroyRQJ9jeMaudk3Kkyi16B8GMN2jQ` | SOL | VINE dev wallet | SCAM |
| `5Bb8LEnNdS3CBY6fDPBSegDmzx8WgXVzfBADP9tgB77Q` | SOL | $YE drainer | DRAINER |
| `B6PMDaB67v1MHwUaqqdnqquX2k4NntttxNn6fWiNhpii` | SOL | $YE collector | SCAM |

---

## 6 · Orchestrator engine → data-source coverage

| Engine | Reads | Rows available | Fired by |
|---|---|---:|---|
| **KOL_Registry** | `KolProfile` + `KolAlias` + `KolWallet` | 363 / 9 / 478 | HANDLE or WALLET leads |
| **Intel_Vault** | `AddressLabel` + `FounderIntelItem` | 3,313 / 241 | WALLET / CONTRACT / HANDLE / DOMAIN / URL |
| **Threat_Intel** | `DomainLabel` + `AddressLabel` (+ trusted) | 622,899 / 3,313 | DOMAIN / URL / WALLET / CONTRACT |
| **Observed_Proceeds** | `KolProfile.totalScammed` / `totalDocumented` | 4 actors with positive numbers | WALLET or HANDLE |
| **Laundry_Trail** | `LaundryTrail` + `LaundrySignal` | 5 / 21 | WALLET |
| **Wallet_Journey** | `WalletFundingEdge` | 38 | WALLET |
| **Case_Correlation** | `VaultCaseEntity` (workspace-scoped) | 4 entities | any type |
| **Related_Suggestions** | `KolTokenLink` + `KolWallet` siblings | 17 / 478 | HANDLE or WALLET |

Every engine has non-empty source rows in production.

---

## 7 · What's genuinely missing / thin (not gaps I can fabricate)

1. **$scammed / $documented left null** on most confirmed actors (e.g. GordonGekko, planted, lynk0x). The `Observed_Proceeds` engine only triggers when those numbers are populated. **Action**: the operator needs to supply documented USD figures per actor — I will not invent them.
2. **KolPromotionMention** only covers bkokoski (3) + GordonGekko (5) — the other 330+ profiles have zero promotions indexed. Requires manual curation or a promotion-ingestion pipeline.
3. **WalletFundingEdge** is sparse: 38 rows, all SOL, **0 project-linked**. The `Wallet_Journey` engine surfaces counterparties but can't flag project-linked funding because the flag isn't set on existing rows.
4. **LaundryTrail** is extremely sparse (5 trails, all manually created). The engine works, but only 5 wallets will hit.
5. **FounderIntelItem** has 241 items but only 3 categories (COMPETITOR / AI / ECOSYSTEM). The `Intel_Vault` engine text-searches them — useful for handle / domain mentions but won't hit raw wallet addresses.
6. **`OrbitApe` and `Regrets10x`** are placeholder drafts with 0 wallets. Operator provided no concrete wallet data to attach.
7. **CEX-cashout addresses** — operator mentioned 28 BOTIFY CEX deposits but did not provide the actual addresses in this session. Not added.
8. **KolEvidence idempotency** — `seedBotifyLeakedDoc.ts` creates evidence rows without a composite dedup check. Re-running twice will create duplicate evidence rows. This run added 10 new rows (KolEvidence 51 → 61). **Action**: tighten the seed's dedup predicate if rerun is intended.

---

## 8 · Seed scripts run this session (all against `ep-square-band`)

- `scripts/seed/seedGhostWareOS.ts` — GHOST OS profile now complete (5 rugs, $327,790 documented, 1 LaundryTrail + 7 signals, $6,750 proceeds event).
- `scripts/seed/seedKokoskiLoic.ts` — idempotent (already seeded).
- `scripts/seed/seedDioneProtocol.ts` — 4 aliases + 6 tokens + 11 evidence refreshed.
- `scripts/seed/seedBotifyComplete.ts` — 21 actors updated, 0 new wallets (all existed), +21 summary events.
- `scripts/seed/seedMyrrhaWallets.ts` — 112 MM wallets, all already present (idempotent skip).
- `scripts/seed/seedBotifyLeakedDoc.ts` — +10 KolEvidence rows (bkokoski + sxyz500 specific claims).

## 9 · Schema drift fix

- Added missing column `KolProfile.botifyDeal JSONB` to prod — was in Prisma schema but missing from DB, blocking any seed script that referenced it. Idempotent `ALTER TABLE ADD COLUMN IF NOT EXISTS`. Safe.

---

## 10 · Ground-truth rule

Every row added this session is either:
- produced by a **committed idempotent seed script**, OR
- a **concrete address / fact explicitly provided** by the operator in the session prompt (the 4 VINE / $YE wallets).

No USD amounts, no risk flags, no attribution has been fabricated from prose
description. Where the operator listed totals ("$485K+", "$817K+", "631K
VINE stolen") those were preserved in `evidence` free-text only — never
stamped on numeric columns.
