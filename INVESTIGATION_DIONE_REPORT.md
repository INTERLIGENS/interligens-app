# INVESTIGATION — SafeMoon → Dione → BOTIFY serial pattern

Compiled 2026-04-17 for the BEFTI judicial dossier.
Lead subjects: Brandon Kokoski (@KokoskiB), Dione Protocol LLC, BOTIFY.
Peripheral subjects: Ryan Arriaga (@TheFudHound), Onchain Solutions Inc / Blockchain Dev Shop.

This report separates **verified facts with open-source citations** from **prior assertions in the INTERLIGENS database that I could not corroborate or that require reframing**. The latter are flagged `⚠️ RECONCILIATION` because they are load-bearing for the existing `seedDioneProtocol` narrative and must not be carried into a judicial filing without revision.

---

## 1. Critical reconciliation — "Ryan Arriaga the operator" vs "Ryan Arriaga the whistleblower"

The existing seed (`scripts/seed/seedDioneProtocol.ts`, `seed-dione-protocol.mjs`, `scripts/osint/rebuildRecitPdf.ts`) asserts two claims that are **in tension**:

- *Operator framing*: "SafeMoon → Dione → BOTIFY serial-rug pattern attributed to operator Ryan Arriaga."
- *Victim framing*: "TheFudHound — dev contractuel Dione Protocol non payé — témoin direct."

Open sources confirm **TheFudHound = Ryan Arriaga** ([CoinChapter](https://coinchapter.com/safemoon-fraud-sfm-plummets-following-new-allegations-against-protocols-leadership/), [@TheFudHound](https://x.com/thefudhound), [Nov 2023 post](https://x.com/TheFudHound/status/1719996012964798494)). Arriaga was SafeMoon's **Head of Products** who resigned/was terminated and then publicly accused John Karony & Thomas "Papa" Smith of running a rug pull. Karony was since convicted of securities fraud and sentenced to **100 months** in February 2026 ([IRS-CI release](https://www.irs.gov/compliance/criminal-investigation/ceo-of-digital-asset-company-safemoon-sentenced-to-100-months-in-prison-for-multimillion-dollar-crypto-fraud-scheme), [CoinDesk](https://www.coindesk.com/policy/2026/02/10/ex-safemoon-ceo-gets-8-year-prison-sentence-for-defrauding-investors)); Thomas Smith pleaded guilty Feb 2025.

Arriaga's company **Onchain Solutions Inc / Blockchain Dev Shop** was subsequently contracted by Dione in January 2023 and forked Avalanche for the Odyssey chain ([Newsfile release 151359](https://www.newsfilecorp.com/release/151359), [152842](https://www.newsfilecorp.com/release/152842)). He was titled Head of Blockchain. Arriaga has **no publicly documented connection to BOTIFY**.

**Implication for BEFTI**: the "serial operator across SafeMoon, Dione, and BOTIFY" is NOT Arriaga. The only individual who publicly overlaps Dione and BOTIFY is **Brandon Kokoski** — and he has no documented SafeMoon role. The seed's attribution of the serial pattern to Arriaga should be removed or substantially rewritten; otherwise it risks defaming the most visible whistleblower in the SafeMoon criminal case.

⚠️ `RECONCILIATION` — required before any judicial filing uses the current DB narrative.

---

## 2. Verified facts — people and corporate

**Brandon Kokoski** ([LinkedIn](https://www.linkedin.com/in/brandon-kokoski-9b3761190/), [IQ.wiki](https://iq.wiki/wiki/brandon-kokoski), [@KokoskiB](https://x.com/kokoskib)):
- Canadian, Toronto-based; self-described "VP & co-founding member" of Dione Protocol.
- LinkedIn now shows him at **Dione Labs** (post-Dione Protocol rebrand).
- Claims "launched & advised multiple tokens actively traded today" — *no specific pre-Dione token ever named in a public third-party source*.

**Dione Protocol LLC** ([LinkedIn](https://www.linkedin.com/company/dione-protocol-llc), [Crunchbase](https://www.crunchbase.com/organization/dione-protocol)):
- Registered Newark, Delaware.
- Precise file number / formation date / registered agent: **not retrievable via open web** — requires manual ICIS lookup at https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx.

**Team members (all verified via public-facing sources)**:
| Name | Title | Notable prior |
| --- | --- | --- |
| Ryan Arriaga (TheFudHound) | Head of Blockchain (via Blockchain Dev Shop / Onchain Solutions) | Ex-SafeMoon Head of Products; resigned & publicly accused Karony |
| Maxim Prishchepo | Head of Nebra | CEO Sfxdx; original lead dev of Fantom ($FTM) |
| Jacob Smith | Head of Website Development | 10+ years web dev |
| Parth Kapadia | Head of Energy | Co-founder & CEO OpenVPP; ex-Exelon / Sunrun / Schneider Electric |
| Stefan Kermer, PhD | Head of Orion / BizDev | Founder Carbon Insights; decarb study for City of Vienna |
| Hristo Piyankov | Head of Data Science | Tokenomics consultant (FinDaS, Brinc, Linguard Labs) |
| Phil Needs | Head of NFT & BizDev | NFT analyst/trader |

None of these individuals has an open-source enforcement or criminal record that I could locate.

**Partnerships — all *named entities exist*; specific partnership depth is the open question**:
- [Energiekreislauf GmbH](https://at.linkedin.com/company/energiekreislauf-gmbh) (Mürzzuschlag, Austria) — real agricultural solar company.
- [IBC SOLAR AG](https://en.wikipedia.org/wiki/IBC_SOLAR) — legitimate German solar manufacturer, founded 1982. Dione announced "initial steps in strategic business development" — this is the lightest form of partnership language; **no signed agreement or press release from IBC SOLAR's side** was found.
- TRAKEN (Serbia) — reported by Dione to have "close connections with the European Energy Union and World Bank". Independent confirmation of corporate existence was not verified in this pass.
- [ITU SEED](https://incubatorlist.com/itu-seed/) — Istanbul technopark accelerator. Real. Extent of investment in Dione not documented beyond Dione's own press.

**Newsfile Corp** (Toronto): the funding-announcement releases are **paid press-release distribution** — not editorial journalism. Cited press releases 151359 (Jan 2023) and 152842 (Feb 2023) were not independently verified by a news outlet; Yahoo Finance and Benzinga merely republished the Newsfile wire.

---

## 3. Verified facts — on-chain forensics

**Dione: Deployer = `0xbB2A56543df6D2070cfB6A68f8e16bf5B2237A2e`** ([Etherscan](https://etherscan.io/address/0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e)):
- ENS: `dioneprotocol.eth`. Name tag: "Dione: Deployer".
- **First transaction**: ~3y 245d ago (matches claimed 14 Aug 2022 Dione V1 launch).
- **Funded initially by KuCoin** ~3y 288d ago.
- **Latest transaction**: 11 Aug 2025.
- **151 transactions**.
- Current portfolio **$45,224** (down from any prior peak).
  - 100M DIONE (~$9.3k), 55.3M Wrapped DIONE (~$5.1k)
  - **490,470 MAGA (Trump Project 2025) on Base = ~$30,761 ≈ 68% of portfolio.**
- Extensive Uniswap V2/V3 LP activity.

**BK personal EVM wallet (per repo attribution): `0x32B6006e5b942F47Ab4DB68eE70f683370853ecF`** ([Etherscan](https://etherscan.io/address/0x32B6006e5b942F47Ab4DB68eE70f683370853ecF)):
- **No ENS, no public name tag.**
- ETH: 0.0357 ETH (~$83).
- Holdings: 3.48M DOGE on BSC (~$338k), 513k FTM (~$23k), 46k WLD (~$14k), 11.7k USDC (~$11.7k).
- **First transaction**: ~2y 292d ago (~Jun 2023).
- **Funded by Gate.io deposit address** ~2y 294d ago.
- **NO visible direct interactions** with the Dione deployer `0xbb2a…`.

⚠️ `RECONCILIATION` — implication: the Dione deployer wallet is funded by a *different* CEX (KuCoin) than BK's claimed personal wallet (Gate.io), and the two wallets have no visible direct transfer between them. Any claim that BK personally controls the Dione deployer requires **additional off-chain evidence** (internal docs, communications, multisig signer identity). Absent that evidence, the deployer is best described as "Dione Protocol team treasury / contract-deployment wallet, operator unidentified."

---

## 4. V1 → V2 migration (Oct 30 2024) — what is and isn't a "rug"

Documented by the project itself and the three CEXs it listed on:
- **Trading suspended**: 30 Oct 2024 07:00 UTC (MEXC, Gate.io, CoinEx).
- **Snapshot**: 30 Oct 2024 11:00 UTC; LP withdrawn from Ethereum.
- **Trading resumed**: 5 Nov 2024, on Odyssey mainnet.
- **Swap ratio**: 1:1 for on-chain balances in the snapshot.
- **"100% of LP re-seeded on Odyssey Chain"** — this is the project's claim ([CoinCarp event page](https://www.coincarp.com/events/dione-protocol-token-swap/), [Gate.com announcement 40198](https://www.gate.com/announcements/article/40198)).
- **Explicit warning published by the team**: "DO NOT buy the old token on Uniswap you will LOSE your money!" ([@DioneProtocol tweet](https://x.com/DioneProtocol/status/1854636683083530699)).

**The specific claims `539.28 ETH extraction` and `$1.26M siphoned during swap window` that appear in the existing seed are not corroborated by any open-source third-party reporting that I could locate**. The deployer wallet's current $45k portfolio is consistent with either scenario (the funds could have been moved out, or they could have been re-seeded on Odyssey as promised — the existing on-chain view on Ethereum cannot distinguish those). ⚠️ `RECONCILIATION` — the quantified extraction claim needs a citable on-chain trace (Dune query, Arkham note, Chainalysis report) before it lands in a judicial filing.

The migration's *forensic concern* is not that holders got 1:1 but that trading suspension + LP withdrawal + "don't buy the old token" is a known **soft-exit pattern**: the project retains unilateral control over V2 issuance on its own chain (no public Odyssey explorer audit-trail equivalent to Etherscan at the time of migration) and old-token holders who missed the announcement window are stranded.

---

## 5. Vaporware claims — Spark, OVPP, energy credits

- **Spark**: Confirmed *not* a token but a grants & accelerator program launched Nov 22 2024 ([GlobeNewswire](https://www.globenewswire.com/news-release/2024/11/22/2986196/0/en/Dione-Protocol-Announces-DIONE-SPARK-A-Grants-Accelerator-Program-to-Propel-Green-Web3-Innovation.html)). First cohort publicly lists Spectre AI, OpenVPP, Cosmic Network, Arkreen, Polytrade, PAW Chain, Router Protocol. **The repo's framing of "Spark tokens never delivered" is incorrect** — Spark isn't a token. ⚠️ `RECONCILIATION`.

- **OVPP**: **Two separate tokens** exist with confusion between them:
  - `0xB4C6fedD984bC983b1a758d0875f1Ea34F81A6af` — ETH-chain OpenVPP.
  - `0x8c0d3adcf8ce094e1ae437557ec90a6374dc9bdd` — BASE-chain OpenVPP.
  - OpenVPP is **Parth Kapadia's project** (Dione's Head of Energy, externally the CEO of OpenVPP). It is one of the **first SPARK cohort recipients**.
  - **Self-dealing / conflict-of-interest flag**: a Dione executive's external company is receiving Dione grant funding. This is documented in primary sources and is a legitimate, citable concern.

- **Energy credits / "Internet of Energy" tokenization**: roadmapped; no documented on-chain credit-issuance product at time of writing.

---

## 6. Social-engineering / "insider language" documented

- "I've been in vaults, penthouses, and backrooms with people who run this space" — @KokoskiB, **Jan 13 2023** (verified via search-engine snippet on [x.com/kokoskib](https://x.com/kokoskib); body paywalled).
- "rooms most DeFi projects never touch" — @KokoskiB, [Sep 20 2025 post](https://x.com/KokoskiB/status/1969063171420766515) endorsing OpenVPP.
- "Seen in the rooms you tweet about" — **attribution to his Instagram bio could not be confirmed**. An earlier search returned this phrase but no archived/cached Instagram page confirms it. ⚠️ treat as unverified pending Instagram scrape.

The recurring frame is *access through proximity* — privileged space, privileged people, privileged information. Consistent with a marketing-led operator (his pre-crypto background is marketing/e-commerce).

---

## 7. Financial flows — TrustSwap OTC, CEX funding

- **Dione OTC sale via TrustSwap** ([TrustSwap blog](https://trustswap.com/blog/dione-protocol-otc-sale/)): explicit text "**KYC is not required**". Vesting via Team Finance on Odyssey chain. For a BEFTI filing this is a relevant AML-posture fact — the project ran a primary sale to retail without identification.
- **KuCoin → Dione deployer** funding path (Jul 2022). KuCoin KYC is accessible via MLAT (Mutual Legal Assistance Treaty) to the deployer's beneficial owner.
- **Gate.io → `0x32B6…`** funding path (Jun 2023). Gate.io KYC similarly accessible via MLAT.
- Both CEX paths are the **most actionable leads** for identifying the real-world controllers of each wallet. Neither requires open-source speculation — it's a subpoena question.

---

## 8. Legal / regulatory status

- **No SEC, CFTC, FinCEN, or US state enforcement action** naming Dione Protocol, Brandon Kokoski, Ryan Arriaga, Onchain Solutions, Blockchain Dev Shop, or BOTIFY could be located.
- **No Canadian securities regulator action** surfaced in open search.
- **No civil lawsuits** involving the subjects located via open search (PACER would be the authoritative check).
- California DFPI Crypto Scam Tracker — no match.
- BBB Scam Tracker — no match.
- The only SEC/DOJ activity in the adjacent network is the SafeMoon prosecution of Karony / Smith / Nagy (Arriaga is **not** named as a defendant; he appears to have been a resigning insider and a cooperating witness in spirit if not in formal capacity).

For BEFTI, this is significant: the US has not treated Dione/Kokoski as a criminal matter as of the date of this report. France / BEFTI would be the first jurisdiction.

---

## 9. Gaps requiring non-open-source follow-up

1. **Delaware ICIS lookup** for Dione Protocol LLC — file number, formation date, registered agent, officer disclosures.
2. **Ontario Business Registry** (obr.ontario.ca) lookup for Kokoski-linked entities.
3. **PACER / CourtListener** query for "Kokoski" and "Dione Protocol" as defendants or plaintiffs.
4. **MLAT request drafts** to KuCoin (deployer `0xbb2a…`) and Gate.io (`0x32B6…`) for KYC on funding wallets.
5. **Arkham / Nansen labelled-wallet queries** for the deployer and for the BOTIFY wallet to find clusters.
6. **Dune Analytics query** quantifying V1→V2 migration flows: how much Dione-on-Ethereum LP was withdrawn on 30 Oct 2024, how much re-seeded on Odyssey, how much stranded.
7. **Archive.org CDX direct API** for @KokoskiB snapshots (blocked in this harness but available externally).
8. **Internal docs subpoena** — Dione Protocol team communications that would either confirm or refute BK's operational control of the deployer wallet.

---

## 10. Prioritised evidence for BEFTI — what is filing-grade today

Ranked by citability and strength:

**P1 (citable, independent, documented)**
1. SafeMoon DOJ/SEC prosecution and Karony conviction (establishes the fraud-adjacent history of Ryan Arriaga as *victim-whistleblower*, not perpetrator).
2. Dione's own admission: KYC-less OTC sale via TrustSwap.
3. Parth Kapadia conflict-of-interest: Dione exec's company (OpenVPP) receives Dione SPARK grant.
4. Dione deployer funded via KuCoin (MLAT target).
5. BK wallet `0x32B6…` funded via Gate.io (MLAT target).
6. Migration mechanics: trading suspension + LP withdrawal + "don't buy old token on Uniswap" — *soft-exit pattern*.

**P2 (plausible, needs reinforcement)**
7. Kokoski's "insider-access" self-presentation (Jan 2023 + Sep 2025 tweets) — circumstantial but consistent with marketing-to-manipulation pipeline.
8. Paid press releases via Newsfile Corp presented as editorial coverage.
9. Partnership depth with IBC SOLAR, TRAKEN, Energiekreislauf — *asserted* by Dione, not confirmed by the counterparties.

**P3 (currently weak — do not file without reinforcement)**
10. Specific "$1.26M extracted" / "539.28 ETH siphoned" amount claims — no citable on-chain trace located in this pass.
11. "12 rugs by BK: GOLD1, XMEN, TOBE, PUPPET, EBE, BOTIFY, GHOST, OPENVPP, PREDIC, AMARA, STUDY +30 others" — internal repo claim with no external corroboration located.
12. Attribution of Ryan Arriaga as serial operator across SafeMoon→Dione→BOTIFY — **contradicted** by the whistleblower record and should be retracted or heavily rewritten.

---

## 11. Recommended edits to INTERLIGENS database

The updates below are reflected in the companion seed-file revision (see `scripts/seed/seedDioneProtocol.ts` diff alongside this report). They do **not** execute automatically — the seed is left unrun per the project's DB-prod safety rule (migrations via Neon SQL Editor only).

- **Tone down** the Ryan Arriaga operator attribution; add a new evidence entry reframing him as *whistleblower / contracted dev* with appropriate source citations.
- **Demote** the specific `$1.26M / 539.28 ETH` figure to "alleged pending on-chain verification" until a Dune / Arkham trace is attached.
- **Add** evidences for:
  - Parth Kapadia / OpenVPP conflict-of-interest (SPARK cohort funding).
  - TrustSwap KYC-less OTC primary sale.
  - CEX funding paths for `0xbb2a…` (KuCoin) and `0x32B6…` (Gate.io).
  - Migration mechanics characterisation.
- **Add aliases** for additional known handles (TheFudHound, OpenVPP, Dione Labs).
- **Add token links** for the two OpenVPP contracts (ETH + Base) noting the Kapadia conflict.
- **Flag** the "12 rugs by BK" internal list as `partialFacts` pending external corroboration.

---

## Appendix A — full source list

Corporate / press:
- https://www.linkedin.com/in/brandon-kokoski-9b3761190/
- https://www.linkedin.com/company/dione-protocol-llc
- https://www.crunchbase.com/organization/dione-protocol
- https://iq.wiki/wiki/brandon-kokoski
- https://www.newsfilecorp.com/release/151359
- https://www.newsfilecorp.com/release/152842
- https://www.globenewswire.com/news-release/2024/11/22/2986196/0/en/Dione-Protocol-Announces-DIONE-SPARK-A-Grants-Accelerator-Program-to-Propel-Green-Web3-Innovation.html

Team:
- https://www.linkedin.com/in/ryanarriaga/
- https://www.linkedin.com/in/jacob-smith-9a0462122/
- https://www.linkedin.com/in/kapadia23/
- https://www.linkedin.com/in/mprishchepo/

SafeMoon prosecution:
- https://www.sec.gov/enforcement-litigation/litigation-releases/lr-25888
- https://www.irs.gov/compliance/criminal-investigation/ceo-of-digital-asset-company-safemoon-sentenced-to-100-months-in-prison-for-multimillion-dollar-crypto-fraud-scheme
- https://www.coindesk.com/policy/2023/11/01/sec-charges-safemoon-team-with-fraud-offering-unregistered-crypto-securities
- https://www.coindesk.com/policy/2026/02/10/ex-safemoon-ceo-gets-8-year-prison-sentence-for-defrauding-investors
- https://coinchapter.com/safemoon-fraud-sfm-plummets-following-new-allegations-against-protocols-leadership/
- https://x.com/TheFudHound/status/1719996012964798494
- https://beincrypto.com/resigned-or-terminated-safemoon-and-ryan-arriaga-cant-agree/

Migration:
- https://www.gate.com/announcements/article/40198/gate.io-supports-dione-protocol-dione-mainnet-migration
- https://www.gate.com/announcements/article/40446
- https://www.coincarp.com/events/dione-protocol-token-swap/
- https://x.com/DioneProtocol/status/1854636683083530699
- https://x.com/DioneProtocol/status/1851308654609256497

Partnerships:
- https://at.linkedin.com/company/energiekreislauf-gmbh
- https://en.wikipedia.org/wiki/IBC_SOLAR
- https://incubatorlist.com/itu-seed/

On-chain:
- https://etherscan.io/address/0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e
- https://etherscan.io/address/0x32B6006e5b942F47Ab4DB68eE70f683370853ecF
- https://etherscan.io/token/0x89b69f2d1adffa9a253d40840b6baa7fc903d697
- https://etherscan.io/token/0x65278f702019078e9ab196c0da0a6ee55e7248b7
- https://etherscan.io/token/0xb4c6fedd984bc983b1a758d0875f1ea34f81a6af
- https://basescan.org/token/0x8c0d3adcf8ce094e1ae437557ec90a6374dc9bdd

Other:
- https://trustswap.com/blog/dione-protocol-otc-sale/
- https://www.team.finance/view-coin/0x89B69F2d1adffA9A253d40840B6Baa7fC903D697
- https://x.com/KokoskiB/status/1969063171420766515
- https://x.com/kokoskib
- https://www.pcrisk.com/removal-guides/33997-dione-protocol-dione-vote-rewards-scam
