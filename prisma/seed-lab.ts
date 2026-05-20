/**
 * LAB — IL-PND-LAB-001 — first "Token Casefile" (pump-and-dump / insider
 * supply control). BNB Chain. Joint Specter × INTERLIGENS publication.
 *
 * Run (idempotent — upsert on `ref`, safe to re-run):
 *   set -a; source .env.local; set +a; pnpm tsx prisma/seed-lab.ts
 *
 * PREREQUISITE: the `token_casefiles` table must already exist in Neon.
 * Create it via the Neon SQL Editor — never `prisma db push`.
 *
 * The casefile body is embedded below as a string literal (assembled from
 * Downloads/IL-PND-LAB-001_v1.1_FINAL.md) so the seed has no runtime file
 * dependency — it re-seeds correctly from a fresh git checkout.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const REF = "IL-PND-LAB-001";

// Full casefile body — embedded literal, no external file needed.
const BODY_MARKDOWN = `
# INTERLIGENS CASEFILE — $LAB
## The $63M Pre-Pump Deposits Retail Never Saw

---

| Field | Value |
|---|---|
| **Case Reference** | IL-PND-LAB-001 |
| **Codename** | LAB |
| **Ticker** | $LAB |
| **Project** | LABtrade (@LABtrade_) |
| **Type** | Insider Supply Control / Coordinated Pre-Pump Deposits |
| **Primary Chain** | BNB Chain (confirmed on-chain) |
| **Secondary Chain** | Ethereum (Uniswap V3 — contract address not verified) |
| **Status** | \`⚠️ DOCUMENTED CRITICAL RISK — Token still trading\` |
| **TigerScore** | \`91 — AVOID\` |
| **Version** | v1.1 — Final (on-chain verified) |
| **Date** | 2026-05-20 |

> **Sources:** @SpecterAnalyst (May 7, 2026) · @zachxbt (May 14, 2026) · @arkham "THE LABVESTIGATION" (May 15, 2026) · INTERLIGENS independent on-chain verification (Host-010, May 19–20, 2026). 84 timestamped screenshots. All findings are analytical observations attributed to their original investigators. INTERLIGENS independently verified the supply concentration on BNB Chain. Nothing fabricated.

---

## ⚠️ Summary Alert

**Three independent on-chain investigators flagged the same pattern simultaneously. INTERLIGENS confirmed the central claim independently: 68.75% of total LAB supply is locked in 5 Gnosis Safe multisigs on BNB Chain, all controlled by the same two signers.**

Wallets linked to the LABtrade team deposited an estimated **136 million LAB tokens — worth approximately $76.6M — onto Bitget** in two phases before a 1,000% price pump. Between May 11–12, 2026, ten freshly created wallets withdrew 100 million LAB from Bitget in a 12-hour window. The pattern mirrors previously documented manipulation in $SkyAI, $RIVER, $RAVE, and $SIREN.

---

## 1. Executive Summary

LABtrade markets itself as a multi-chain AI trading terminal offering spot, futures, and perpetual contracts. Its token $LAB launched (TGE) in October 2025. Between October 2025 and May 1, 2026, the token traded near its all-time low of $0.074. In the week preceding May 1, wallets identified as team-linked by three separate investigators deposited a combined 136 million LAB onto Bitget. The token pumped +1,000% in days, reaching an all-time high of $6.70 and a fully diluted valuation of approximately $6 billion.

Between May 11–12, 2026, ten freshly created wallets withdrew 100 million LAB from Bitget in a 12-hour window — approximately $482M at the time. Retail buyers who purchased during the pump were left holding a collapsing asset.

Arkham Intelligence independently confirmed that 68.75% of the LAB supply sits in Gnosis Safe multisigs on Ethereum, all controlled by two signataires. **INTERLIGENS independently verified the same 68.75% concentration on BNB Chain** — confirming the structural supply control claim. One of those signers (\`0xf09C…\`) is also the named borrower in a private loan agreement obtained by @zachxbt and the wallet used for LAB's public buyback program.

---

## 2. Why This Case Matters

**For retail:** Anyone who bought $LAB between May 1–10, 2026 bought at or near the top of what three investigators describe as a coordinated insider exit. The pump-to-dump cycle ran in full view of the market while insiders had positioned months in advance.

**For the industry:** This is the same playbook — same market maker, same Chinese exchange pipeline, same wallet patterns — already documented in $RIVER ($300M+ profit per Bubblemaps), $RAVE, $SIREN, and $SKYAI. It is a repeatable, industrial-scale operation.

**For INTERLIGENS:** First casefile combining triple investigator sourcing (Specter + ZachXBT + Arkham) with independent on-chain verification by INTERLIGENS. The 68.75% supply concentration is no longer an allegation — it is verified.

---

## 3. Asset Overview

| Attribute | Detail |
|---|---|
| **Token name** | LAB |
| **Project** | LABtrade — "multi-chain AI trading terminal" |
| **Positioning** | Spot + futures + perpetuals across Solana, ETH, BNB Chain. DeSci narrative layer. |
| **TGE** | October 2025 |
| **BNB Chain contract** | \`0x7ec43Cf65F1663F820427C62A5780b8f2E25593A\` (verified on-chain) |
| **Token symbol / decimals** | LAB / 18 |
| **Total supply** | 1,000,000,000 LAB (confirmed on-chain) |
| **Circulating supply** | ~76.5M (per Arkham, May 15, 2026) |
| **ATH** | $6.70 |
| **ATL** | $0.0742 |
| **Price at investigation** | $3.55–$4.37 (mid-May 2026) |
| **Market cap at investigation** | ~$271M–$334M |
| **FDV at peak** | ~$6B |
| **Exchanges** | Bitget (primary) · Binance · Gate.io · KuCoin · OKX · PancakeSwap V3 · Uniswap V3 |
| **Claimed raise** | $1.5M institutional |
| **Stated backers** | Lemniscap, OKX, Animoca, GSR, Gate, KuCoin, Mirana, Amber |

> **Note on backers:** Several stated backers are also the exchanges on which $LAB trades. ZachXBT flagged this as a structural conflict — exchanges benefit from trading fees generated by the volatile price action.

---

## 4. Founders

| Person | Handle | Location | Prior project |
|---|---|---|---|
| **Vova Sadkov** (Vladimir Sadkov) | @vsadkovv | UAE | Eesee ($ESE), Blast chain, April 2024 |
| **Mark X** | @tokensaler | Dubai | Eesee ($ESE), "Listing & Marketing Advisor, 2000+ KOLs Network Worldwide" |

**Eesee ($ESE) precedent:** ZachXBT documented that both founders previously ran Eesee on the Blast chain (April 2024). Investors from that project reported feeling abandoned when the team moved on. No public response has been issued by either founder regarding the $LAB allegations.

---

## 5. Supply Control — On-Chain Verified

This is the structural core of the case. **Verified independently by INTERLIGENS on BNB Chain, May 19–20, 2026.**

### 68.75% of supply locked in Gnosis Safe multisigs

All multisigs on BNB Chain. All share **exactly the same 2 signers.**

**INTERLIGENS verification (Host-010, BNB Chain RPC):**

| Holder | Address (BNB Chain) | LAB held (verified) | % Supply | Nonce |
|---|---|---|---|---|
| Gnosis Safe Proxy | \`0xB4b74D63F30076870d54aB9E8E6a7D18293273c3\` | 200,000,000 | 20% | 1 |
| Gnosis Safe Proxy | \`0xB471837F03d01b628BFF32A515baF679CCdfAbb8\` | 150,000,000 | 15% | 1 |
| Gnosis Safe Proxy | \`0x7Cfd8d2d8626B287bEA569b5e65AB5CBb75E9265\` | 138,000,010 | 13.8% | 1 |
| Gnosis Safe Proxy | \`0x78a79D0fa0Eaf58741f5Bde7E05b5CC8F33D24d3\` | 108,000,000 | 10.8% | 1 |
| Gnosis Safe Proxy | \`0xf79ff8a5052E969a6d13E18c4E439fE5202B02Fa\` | 91,457,144 | 9.15% | 1 |
| **TOTAL** | — | **687,457,154 LAB** | **68.75%** | — |

**Holding wallet behavior:** All 5 multisigs have a nonce of 1 — they have received their LAB allocations and have not signed outbound transactions since. Pure holding wallets, behaviorally consistent with a coordinated locked-supply structure.

### Gnosis Safe Signers (BNB Chain — verified)

| Signer | Address | Behavior | Additional role |
|---|---|---|---|
| **Signer 1** | \`0xf09C19328C26088053a8c9CfB982427bafF2Bd0b\` | 350 tx · 2,367,029 LAB held | Borrower in private loan agreement · LAB buyback wallet · Active operational signer |
| **Signer 2** | \`0x1664535C2F4eb4D32c6591a1Ba36eA19682EB55D\` | 79 tx · 0 LAB | Identity not publicly attributed |

---

## 6. Key Timeline

| Date | Event | Source |
|---|---|---|
| April 2024 | Vova Sadkov + Mark X run Eesee ($ESE) on Blast — investors later report abandonment | ZachXBT |
| October 2025 | $LAB TGE | Arkham |
| October 2025 | ATL: $0.0742 | Arkham |
| January 2026 | Mark X openly solicits OTC buyers in public Telegram group | ZachXBT |
| Q1 2026 | Loan agreement drafted — The Lab Management Ltd. (BVI) / Vladimir Sadkov / 7.5%/month | ZachXBT |
| March 25, 2026 | SkyAI-linked wallets consolidate → deposits to Gate.io + Bitget | Specter / Arkham |
| **April 8, 2026** | \`0xe03722dedBf090Ad7A1C8F82ceB86637053E21dd\` deposits **40M LAB (~$13.6M)** on Bitget | Specter |
| ~April 24–25, 2026 | Gas fees (0.14 BNB) distributed — coordination signal | Specter |
| ~April 24–25, 2026 | Wallets deposit **96M LAB (~$63M)** on Bitget | Specter |
| **May 1, 2026** | **$LAB pumps: $0.33 → ~$4.00 (+1,000%)** | Multiple |
| May 1, 2026 | Volume peaks at $147.86M in 24h | Multiple |
| May 1, 2026 | FDV peaks ~$6B | ZachXBT |
| May 7, 2026, 05:29 UTC | **@SpecterAnalyst publishes investigation** — 606 likes | Screenshot SC001 |
| May 7, 2026 | ZachXBT responds, escalates, offers $10K bounty on vsadkovv identity / market maker proof | Screenshot SC008 |
| May 11–12, 2026 | **100M LAB (~$482M) withdrawn from Bitget to 10 fresh wallets in 12h** | ZachXBT |
| May 14, 2026 | **@zachxbt publishes full thread** — loan agreement, OTC pitch, >95% supply control allegation | Screenshots SC018–SC055 |
| May 15, 2026 | **@arkham publishes "THE LABVESTIGATION"** — 229K views — Gnosis Safe identification | Screenshots ARK001–ARK020 |
| **May 19–20, 2026** | **INTERLIGENS verifies 68.75% supply concentration on BNB Chain** | This casefile |

---

## 7. The Two-Phase Pre-Pump Deposit Pattern

Documented by @SpecterAnalyst and corroborated by @arkham.

### Phase 1 — April 8, 2026
| Element | Detail | Verification |
|---|---|---|
| **Wallet** | \`0xe03722dedBf090Ad7A1C8F82ceB86637053E21dd\` | INTERLIGENS confirmed: 0 LAB currently (drained) · nonce 11 |
| **Amount** | 40,000,000 LAB | Sourced from Specter / Arkham |
| **Value** | ~$13.6M | Sourced |
| **Destination** | Bitget | Sourced |
| **Tx hash** | \`0x77156a0a621d2Ac7A075C0AC3172707C2e4aa191\` | Specter SC001 |

### Phase 2 — ~April 24–25, 2026
| Wallet | Amount | Value | INTERLIGENS verification |
|---|---|---|---|
| \`0xDd77BFbDc11Cd37fD255AE35A4ac39Df1F9d570a\` | 50M LAB | ~$36M | 0 LAB currently · nonce 7 — drained ✅ |
| \`0x6593aa6c31C88397c37f71259625EC92Fe4EE0bF\` | 46M LAB | ~$31.6M | 0 LAB currently · nonce 5 — drained ✅ |
| \`0xe39F91A0dAFfc5547aDA79a09bE30b8556F7dfba\` | 60M LAB | ~$20.5M | Not directly verified (April history not retrievable on free-tier RPC) |
| \`0x77156a0a621d2Ac7A075C0AC3172707C2e4aa191\` | 40M LAB | ~$13.7M | Not directly verified |
| \`0xD425C56F2EB64646fdE7f3c53d7584E60E62fC94\` | 30M LAB | ~$5.3M | Not directly verified |

> **Arkham observation:** 4 out of 5 of these wallets link back to the same LAB Distribution Address, which received tokens directly from team multisigs.

> **INTERLIGENS observation:** All deposit wallets we could verify on BNB Chain show **0 LAB current balance with low nonce (5–11)** — behaviorally consistent with single-use deposit wallets that received tokens, forwarded them to Bitget, and went dormant.

### Coordination Signal
| Element | Detail |
|---|---|
| Gas fee distribution wallets | \`0x50f2760fd5E6d546EE7dcEB617F33497A3C38593\` |
| | \`0x0559694BbB47dbA8Bc3B7ac93004EF401F2da16d\` |
| Pattern | 0.14 BNB distributed ~1 week before pump — funds multiple deposit wallets |

### Phase 3 — Post-pump exit (May 11–12)
- 100,000,000 LAB (~$482M) withdrawn from Bitget to 10 freshly created wallets in 12 hours
- Represents 32.26% of circulating supply
- Wallets: identified by ZachXBT in his May 14 thread

---

## 8. Wallet \`0x2087D8…\` — INTERLIGENS Correction

@SpecterAnalyst's original thread suggested \`0x2087D8Fe927966fee758bA5563fB8f2347180b7c\` was a wallet "continuously feeding" the Gnosis Safes.

**INTERLIGENS on-chain verification (May 19–20, 2026) contradicts that framing.** The wallet's behavior is different:

| Indicator | Observation |
|---|---|
| **Current LAB balance** | 0 |
| **Nonce** | 1 (only 1 outbound transaction ever signed) |
| **Transfer activity (May 13–20)** | 3,954 inbound + 3,954 outbound transfers — 1:1 pattern |
| **Typical amounts** | 2–27 LAB per transfer |
| **Mechanism** | Triggered by external contract via \`transferFrom\` (allowance), not by the wallet itself |
| **Direction** | Receives from \`0x60b97709…\` and forwards to a third party with matching timestamps |
| **Transfers to any Gnosis Safe** | **NONE found in scanned window** |

**Verdict:** \`0x2087D8…\` is a **pass-through relay**, not a Safe feeder. It is part of LAB's routing/distribution mechanics — likely a smart-contract-driven swap or LP intermediary — not a team operational wallet. The amounts (2–27 LAB) are inconsistent with the volumes needed to fund 100M+ holdings in the Safes.

This is a correction to the original Specter framing and is added to the public record.

---

## 9. Cross-Token Pattern — SkyAI → LAB

The same operational infrastructure was deployed on $SkyAI before $LAB.

| Element | SkyAI | LAB |
|---|---|---|
| "Airdrop" distribution | 800M SKYAI → "airdrop wallet" (April 2025) — majority freshly created addresses | 68.75% in Gnosis Safes — same 2 signers (INTERLIGENS verified on BNB Chain) |
| Consolidation | March 25, 2026 — wallets consolidated → Gate.io + Bitget | April 2026 — same pattern |
| Exchange pipeline | Gate.io → Bitget | Bitget primary + Gate secondary |
| Cross-wallet | \`0x11fc12b988933966688d33B70651B5f2f450963C\` | Same wallet active in both tokens |

**SkyAI consolidation wallets (Specter/Arkham, March 25, 2026):**
- \`0xb638FF7a8D5ED132a0fFA3eC258fBDe4CBF61AF9\`
- \`0xa8C2519a695502e17Eb3227Dbf3AE676A2791b56\`
- \`0xFDC0167dDcE3aB9a4e684784CeA12dcD1cf0a216\`
- \`0xF77dcD21b53A9ccDc1472AFd24c49726d60C5c57\`
- \`0xdCf5692BD162CCd6E1851ad299aCbbAF66308814\`

---

## 10. Off-Chain Evidence

### The Loan Agreement
Obtained and published by @zachxbt (tweet 4/, May 14, 2026).

| Field | Detail |
|---|---|
| **Entity** | The Lab Management Ltd. |
| **Jurisdiction** | BVI (British Virgin Islands) |
| **Director/Borrower** | Vladimir (Vova) Sadkov |
| **Terms** | 7.5%/month for 6 months |
| **Default clause** | Repayment in LAB at "market price" |
| **Borrower wallet** | \`0xf09C19328C26088053a8c9CfB982427bafF2Bd0b\` |
| **Also used for** | LAB public buyback program · Signer 1 of all Gnosis Safe multisigs (verified on BNB Chain) |
| **Document status** | Draft Q1 2026 — unnamed source confirmed payments made under similar terms |

### The OTC Pitch (WhatsApp)
Obtained and published by @zachxbt (tweet 6/, May 14, 2026).

| Type | Terms |
|---|---|
| Loan | Stables, up to 5%/month |
| Classic OTC | -60% discount, 5-month cliff, 3-month vesting, cliff ends July 14 |
| Guaranteed discount OTC | -25% monthly (= 33% profit in 6 months), 1-month cliff |
| Guaranteed discount OTC | -20% discount, 1-month cliff, 3-month vesting |
| KOL Capital pitch | 80% discount, 50% unlock Aug 14 + 50% Sep 15 — *required to post multiple times before unlock or be blacklisted* |

### Vesting Manipulation
ZachXBT documented that LABtrade unilaterally changed public sale participants' cliff from 3 months to 9 months without consent.

### Documentation Opacity
LAB docs return zero results for "distribution", "unlock", or "vesting." Coingecko, RootData, and CMC all report different float figures.

---

## 11. Systemic Pattern — Same Playbook, Same Pipeline

| Token | Exchange | Profile |
|---|---|---|
| **$RIVER** | Bitget | 2,418 wallets, $300M+ profit (Bubblemaps) — same insider linked on-chain to LAB multisig signer |
| **$RAVE** | Binance + Bitget | -68% on manipulation allegations, -95% from ATH (INTERLIGENS casefile: TigerScore 95) |
| **$SIREN** | Bitget | ~47–50% supply in one related wallet cluster |
| **$SKYAI** | Gate.io + Bitget | 36 fresh wallets deposited 25% supply to Gate before pump |
| **$LAB** | Bitget primary | INTERLIGENS verified: 68.75% supply in 5 Gnosis Safes, same 2 signers |

---

## 12. What Is Established vs Unresolved

### ✅ Established (multi-source)
- LAB contract on BNB Chain: \`0x7ec43Cf65F1663F820427C62A5780b8f2E25593A\` — INTERLIGENS verified
- **68.75% supply in 5 Gnosis Safe multisigs — INTERLIGENS verified independently on-chain**
- All 5 Safes share the same 2 signers — Arkham + INTERLIGENS confirmed
- Signer 1 is also loan agreement borrower and LAB buyback wallet (ZachXBT + cross-referenced)
- Deposit wallets verified empty post-transfer (nonces 5–11, 0 LAB balance) — consistent with pre-pump pattern
- \`0x2087D8…\` is a pass-through relay, NOT a Safe feeder (INTERLIGENS correction)
- Private loan at 7.5%/month — document leaked (ZachXBT)
- OTC pitch with 4 deal types — WhatsApp message leaked (ZachXBT)
- Vesting changed unilaterally from 3 to 9 months (ZachXBT)
- 100M LAB withdrawn from Bitget post-pump to 10 fresh wallets (ZachXBT / Lookonchain)
- Playbook matches RIVER, RAVE, SIREN, SKYAI pattern
- No public response from team, Bitget, Binance, Gate.io

### ❓ Unresolved
- Exact transfer history of April 2026 (Phase 1 / Phase 2 deposits) — not retrievable on free-tier BNB Chain RPC (728/927 blocks scan failed with timeout)
- Identity of Signer 2 (\`0x1664…\`)
- LAB Ethereum contract address (Uniswap V3) — not provided in source threads
- Whether vsadkovv is formally the same person as Vladimir Sadkov (publicly named by ZachXBT, not judicially confirmed)
- Current KYC status with Bitget / exchange cooperation on freeze requests

---

## 13. What This Case Does NOT Claim

- It does **not** claim Bitget, Binance, Gate.io, or any other exchange knowingly facilitated manipulation.
- It does **not** assert that Vova Sadkov or Mark X have committed a criminal offense — findings are analytical, not judicial.
- It does **not** claim all listed backers (Lemniscap, OKX, Animoca, etc.) were aware of the supply control structure.
- It does **not** assert that $LAB has no legitimate product — LABtrade has a working trading interface.
- All figures (FDV, supply percentages, wallet balances) reflect on-chain state at time of investigation. Prices and balances change.

---

## 14. Retail Harm

| Metric | Value |
|---|---|
| ATH | $6.70 |
| Pre-pump entry (retail) | ~$0.33–$4.00 |
| Post-pump exit (insiders) | ~$4.00–$6.70 range |
| Volume at peak | $147.86M / 24h |
| Estimated exit value (100M LAB) | ~$482M |
| Affected exchanges | Bitget (primary) · Binance · Gate.io · KuCoin · OKX |

The mechanism is documented: insiders loaded Bitget with 136M LAB before the pump, retail bought the pump, insiders withdrew 100M LAB post-pump. The OTC pipeline gave additional participants guaranteed exits at discounts retail never saw.

---

## 15. Methodology & Limitations

| Element | Detail |
|---|---|
| Primary source 1 | @SpecterAnalyst, May 7, 2026 — x.com/SpecterAnalyst/status/2052334885776368019 |
| Primary source 2 | @zachxbt, May 14, 2026 — x.com/zachxbt/status/2054898821398962664 |
| Primary source 3 | @arkham "THE LABVESTIGATION", May 15, 2026 — x.com/arkham/status/2055263817215672790 |
| Screenshots | 84 PNG — 64 Specter/Zach + 20 Arkham — captured 2026-05-19, UTC-stamped |
| INTERLIGENS verification | On-chain via BNB Chain public RPC (\`bsc-rpc.publicnode.com\`, \`bsc.drpc.org\`) — Host-010, May 19–20, 2026 |
| Verified contract | \`0x7ec43Cf65F1663F820427C62A5780b8f2E25593A\` on BNB Chain |
| Off-chain documents | Loan agreement (ZachXBT tweet 4/) · WhatsApp OTC pitch (ZachXBT tweet 6/) |
| Limitations | (1) No paid API key for BNB Chain — Etherscan free tier and BscScan V1 deprecated. (2) Free-tier RPC scan failed on 728 of 927 chunks for April 2026 history — Phase 1 / Phase 2 transfer details not directly verified by INTERLIGENS (remain sourced via Specter/Arkham). (3) LAB Ethereum contract address not in source materials — only BNB Chain confirmed. (4) No Arkham API access. |
| Investigation files | \`investigations/LAB_onchain_verification_v2.json\` · \`investigations/LAB_onchain_verification_v2.md\` |

---

## 16. Credit

> *"This casefile is structured from the public investigations of @SpecterAnalyst (May 7, 2026), @zachxbt (May 14, 2026), and @arkham (May 15, 2026). The original on-chain findings — wallet identification, deposit patterns, supply control analysis, loan agreement, and OTC pitch — were established and published by these investigators. INTERLIGENS independently verified the 68.75% Gnosis Safe supply concentration on BNB Chain and corrected the framing of wallet \`0x2087D8…\` (relay, not feeder). All original findings remain attributed to their sources."*

**Collection:** Specter × INTERLIGENS

---

*IL-PND-LAB-001 — v1.1 Final — 2026-05-20*

`;

const LAB = {
  ref: REF,
  codename: "LAB",
  ticker: "$LAB",
  title: "The $63M Pre-Pump Deposits Retail Never Saw",
  family: "pump_and_dump",
  subtype: "insider_supply_control",
  tigerScore: 91,
  verdict: "AVOID",
  status: "DOCUMENTED_CRITICAL_RISK",
  statusNote: "Token still trading",
  primaryChain: "BNB Chain",
  secondaryChains: ["Ethereum"] as string[],
  contractAddresses: {
    "BNB Chain": "0x7ec43Cf65F1663F820427C62A5780b8f2E25593A",
    "Ethereum": null as string | null,
  },
  tokenName: "LAB",
  decimals: 18,
  totalSupply: "1000000000",
  circulatingSupply: "76500000",
  ath: new Prisma.Decimal("6.70"),
  atl: new Prisma.Decimal("0.0742"),
  fdvPeakUsd: BigInt(6_000_000_000),
  marketCapMinUsd: BigInt(271_000_000),
  marketCapMaxUsd: BigInt(334_000_000),
  tgeDate: new Date("2025-10-01"),
  claimedRaiseUsd: 1_500_000,
  backers: ["Lemniscap", "OKX", "Animoca", "GSR", "Gate", "KuCoin", "Mirana", "Amber"] as string[],
  founders: [
    {
      name: "Vova Sadkov (Vladimir Sadkov)",
      handle: "@vsadkovv",
      location: "UAE",
      priorProject: "Eesee ($ESE), Blast chain, April 2024",
    },
    {
      name: "Mark X",
      handle: "@tokensaler",
      location: "Dubai",
      priorProject: "Eesee ($ESE) — Listing & Marketing Advisor, 2000+ KOLs network",
    },
  ],
  exchanges: ["Bitget", "Binance", "Gate.io", "KuCoin", "OKX", "PancakeSwap V3", "Uniswap V3"] as string[],
  exitExchanges: ["Bitget"] as string[],
  keyWallets: [
    { role: "Gnosis Safe (20% supply)",  address: "0xB4b74D63F30076870d54aB9E8E6a7D18293273c3", holdingLab: "200000000" },
    { role: "Gnosis Safe (15% supply)",  address: "0xB471837F03d01b628BFF32A515baF679CCdfAbb8", holdingLab: "150000000" },
    { role: "Gnosis Safe (13.8% supply)",address: "0x7Cfd8d2d8626B287bEA569b5e65AB5CBb75E9265", holdingLab: "138000010" },
    { role: "Gnosis Safe (10.8% supply)",address: "0x78a79D0fa0Eaf58741f5Bde7E05b5CC8F33D24d3", holdingLab: "108000000" },
    { role: "Gnosis Safe (9.15% supply)",address: "0xf79ff8a5052E969a6d13E18c4E439fE5202B02Fa", holdingLab: "91457144"  },
    { role: "Signer 1 — loan borrower + buyback wallet", address: "0xf09C19328C26088053a8c9CfB982427bafF2Bd0b", holdingLab: "2367029.93" },
    { role: "Signer 2 — identity not publicly attributed", address: "0x1664535C2F4eb4D32c6591a1Ba36eA19682EB55D", holdingLab: "0" },
    { role: "Pre-pump deposit P1 (Apr 8, 2026) — drained", address: "0xe03722dedBf090Ad7A1C8F82ceB86637053E21dd", holdingLab: "0" },
    { role: "Pre-pump deposit P2 — drained", address: "0xDd77BFbDc11Cd37fD255AE35A4ac39Df1F9d570a", holdingLab: "0" },
    { role: "Pre-pump deposit P2 — drained", address: "0x6593aa6c31C88397c37f71259625EC92Fe4EE0bF", holdingLab: "0" },
    { role: "Pass-through relay (NOT Safe feeder — INTERLIGENS correction)", address: "0x2087D8Fe927966fee758bA5563fB8f2347180b7c", holdingLab: "0" },
  ],
  linkedTokens: ["$RIVER", "$RAVE", "$SIREN", "$SKYAI"] as string[],
  estimatedRetailHarmUsd: BigInt(482_000_000),
  currency: "USD",
  sources: [
    {
      investigator: "@SpecterAnalyst",
      date: "2026-05-07",
      url: "https://x.com/SpecterAnalyst/status/2052334885776368019",
      note: "Initial pre-pump deposits pattern, 606 likes",
    },
    {
      investigator: "@zachxbt",
      date: "2026-05-14",
      url: "https://x.com/zachxbt/status/2054898821398962664",
      note: "Loan agreement + OTC pitch + 100M LAB exit traced",
    },
    {
      investigator: "@arkham",
      date: "2026-05-15",
      url: "https://x.com/arkham/status/2055263817215672790",
      note: "THE LABVESTIGATION — 229K views — Gnosis Safe identification",
    },
    {
      investigator: "INTERLIGENS (Host-010)",
      date: "2026-05-19",
      url: null,
      note: "Independent on-chain verification: 68.75% supply concentration on BNB Chain confirmed; 0x2087D8 reclassified as pass-through relay (not Safe feeder)",
    },
  ],
  specterCollab: true,
  publishedDate: new Date("2026-05-20"),
  summary:
    "Three independent on-chain investigators flagged the same pattern simultaneously. INTERLIGENS confirmed the central claim independently: 68.75% of total LAB supply is locked in 5 Gnosis Safe multisigs on BNB Chain, all controlled by the same two signers. Wallets linked to the LABtrade team deposited an estimated 136 million LAB tokens — worth approximately $76.6M — onto Bitget in two phases before a 1,000% price pump.",
  summaryFr:
    "Trois enquêteurs on-chain indépendants ont signalé le même schéma simultanément. INTERLIGENS a confirmé la concentration centrale de façon indépendante : 68,75 % du supply total de LAB est verrouillé dans 5 multisigs Gnosis Safe sur BNB Chain, tous contrôlés par les deux mêmes signataires. Des wallets liés à l'équipe LABtrade ont déposé une estimation de 136 millions de tokens LAB — environ 76,6 M$ — sur Bitget en deux phases avant un pump de 1 000 %.",
  publishStatus: "published",
};

async function main() {
  const data = { ...LAB, bodyMarkdown: BODY_MARKDOWN.trim() };

  const result = await prisma.tokenCaseFile.upsert({
    where: { ref: REF },
    create: data,
    update: data,
  });

  console.log(
    `[seed-lab] upserted ${result.ref} (${result.codename} ${result.ticker}) — ` +
      `id=${result.id}, publishStatus=${result.publishStatus}, ` +
      `tigerScore=${result.tigerScore}, verdict=${result.verdict}, ` +
      `bodyMarkdown=${result.bodyMarkdown ? result.bodyMarkdown.length + " chars" : "null"}`,
  );
}

main()
  .catch((e) => {
    console.error("[seed-lab] FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
