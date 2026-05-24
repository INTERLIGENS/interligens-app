---
title: "Crypto Fraud Cases — Anonymized and Fictionalized Studies"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-23"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["investigators", "researchers", "journalists", "students", "educators"]
abstract: "Four fictional case studies illustrating recurring patterns in crypto fraud: a token rugpull, a centralized exit scam, an orchestrated pump-and-dump, and a phishing drainer campaign. All names, addresses, dates, and amounts are invented. The cases are constructed from academically documented patterns and from publicly reported incidents, but no case in this document reproduces, represents, or alludes to any specific real investigation. The studies are designed for pedagogical use alongside the Dark Patterns Whitepaper, the Investigation Checklist, and the OSINT-Crypto Glossary."
---

## 1. Methodological Preface

The four studies collected in this document are fictional. Every project name, platform name, social-media handle, wallet address, transaction hash, dollar amount, and date has been invented for the purpose of pedagogical illustration. No case here represents, reproduces, or alludes to any specific real investigation, whether internal to the publishing institution or already discussed in the public record. The composites are constructed from patterns documented in academic and regulatory literature (see references) and from the general phenomenology of retail crypto fraud as it has been reported by industry, by consumer-protection authorities, and by competent law-enforcement agencies. They are not retellings.

The choice to fictionalize, rather than to anonymize real cases, is deliberate. Anonymized real cases carry residual identifiability: a date, a token symbol, a chain of intermediaries, or a sum of money can suffice to re-identify a project, a team, or a victim, particularly within a small ecosystem. Re-identification can expose victims to renewed harassment, expose investigators to legal challenge from named parties (some of whom may eventually be exonerated), and expose the publishing institution to defamation risk. Fully fictional cases sidestep these problems without losing pedagogical value, provided the underlying patterns are faithful.

The cases below were built by selecting a target pattern, drawing its structural anatomy from the documented literature, then populating the slots — actors, infrastructure, timelines, sums — with invented parameters. Parameters were chosen to be plausible at the scale of retail crypto fraud: modest sums in the low-to-mid six figures of dollar equivalent, small named teams, ecosystems loosely resembling the public DEX/CEX/social-media triangle on which most retail fraud actually unfolds. Sums in the hundreds of millions and chronologies measured in days of headline saturation belong to a different class of events and would not serve the pedagogical objective of teaching pattern recognition.

The cases do not purport to be exhaustive. A real rugpull, exit scam, pump, or drainer campaign is almost always more entangled than a written case can convey. Multiple patterns co-occur, evidence arrives in fragments, and elements that look central in retrospect were invisible in real time. A reader who treats these cases as templates rather than as illustrations will not become a better investigator. They are intended as a vocabulary, not as a manual.

The four cases are designed to be read alongside the *Dark Patterns in Crypto* whitepaper, the *Investigation Checklist* playbook, and the *OSINT-Crypto Glossary* produced in the same series. Where this document uses a numbered glossary entry (e.g., #36), the reference is to the *Glossary*; a section symbol (e.g., §A.1) refers to the *Dark Patterns* whitepaper; a numbered section (e.g., §5.4) refers to the *Investigation Checklist*. The disclaimer in the closing section applies to the document as a whole.

---

## 2. How to Read These Cases

Each of the four cases follows the same internal structure, designed to mirror the casefile sequence proposed in §7 of the *Investigation Checklist*:

1. **Context** — what kind of project, what kind of ecosystem, what kind of audience.
2. **Chronology** — the sequence of observable events, given at the precision of the relevant pattern (typically weeks or months, not minutes).
3. **Actors** — the named entities visible in the case (all invented), with the role each played.
4. **On-chain indicators** — wallets, contracts, liquidity pools, transaction patterns. All addresses and transaction hashes shown are fictional; the format is correct (Solana base58 or EVM hex) but the values do not correspond to any real address.
5. **Off-chain indicators** — social-media activity, marketing material, off-platform communications, victim reports. Posts and messages are paraphrased; no claimed screenshot is reproduced.
6. **Patterns detected** — explicit mapping to the *Dark Patterns* taxonomy, plus references to relevant glossary terms.
7. **Pedagogical lessons** — three to five takeaways framed as recognition heuristics or methodological cautions, not as advice to a specific actor.

All four cases are set in 2024–2025. The temporal precision is intentionally coarse (a quarter, a month, occasionally a week) to avoid coincidental alignment with any real event. The reader should not attempt to map the chronology onto a real calendar; if a date appears to coincide with a real incident, the coincidence is an artefact of the broad time windows used.

---

## 3. Case 1 — "The PhotonGarden Token: a Classic Rugpull with Liquidity Withdrawal"

### 3.1 Context

PhotonGarden was a fictional Solana-based memecoin issued in mid-2024, with ticker $PGRD. The project marketed itself as a "solar-themed DeFi micro-ecosystem", a label characteristic of the period: a thematic identity sufficient to occupy a few weeks of social-media attention without committing to any specific technical roadmap. The project's official channels comprised a single-page website, an X account, a Telegram broadcast channel, and a Discord server with one open lobby.

The team was pseudonymous. The website listed three first names — Kai, Solenn, and Ravi — without surnames, without photographs verified against any institutional record, and without any public résumé predating the token's announcement. The contract was deployed on Solana; the token was tradeable via the principal Solana automated market maker, referred to in this case as the "primary AMM" to avoid naming the specific venue, which is irrelevant to the pattern.

The retail audience was estimated, on the basis of unique wallets that interacted with the liquidity pool, at approximately 1,400 to 1,800 distinct addresses. Aggregate retail exposure peaked at approximately USD 380,000 in liquidity-pool deposits, plus an estimated USD 220,000 in spot purchases routed through the AMM but never deposited as liquidity. These figures are fictional but were chosen to reflect the scale at which a small, single-cycle rugpull typically operates.

### 3.2 Chronology

The visible chronology unfolded across approximately six weeks.

- **Week 1** (early Q3 2024). The X account posted its first message, a teaser image and a tagline. Three pseudonymous accounts began amplifying the teaser within hours. The website went live.
- **Weeks 2–3.** Daily posts established the project's thematic identity. A countdown widget on the website displayed "Token launch in 9 days" and decremented continuously, including past the announced date by a further 48 hours after a "technical delay".
- **Week 3, late.** Token deployed on Solana. Liquidity pool initialized at the primary AMM. The team wallet retained a fraction of the supply for "marketing and community incentives".
- **Week 4.** Coordinated promotional posts from approximately a dozen mid-sized X accounts within a 36-hour window. The token price rose by approximately 14× from initial AMM price.
- **Week 5.** A second promotional wave from a different cluster of accounts. Price reached an apparent all-time high. The team announced an "ecosystem expansion" — a staking module — without publishing the contract.
- **Week 6, mid-week.** Within a window of approximately ninety minutes, the team wallet executed three transactions: (a) a withdrawal of the LP tokens it controlled, (b) a swap of those LP tokens for the underlying base assets, (c) a transfer of the base assets to two intermediate wallets which subsequently fragmented across multiple addresses.
- **Week 6, evening.** The X account went silent. The website returned a 503 within twelve hours. The Telegram channel was deleted within twenty-four hours.

### 3.3 Actors

Three pseudonymous social-media identities played visible roles. All handles below are invented and should not be mapped to any real account; the names were chosen to be sufficiently unusual that incidental collision with a real account is unlikely.

- **@photon_forge_dev** — presented as the project's lead developer. Posted contract addresses, liquidity-pool announcements, and technical updates. Posting cadence and lexical choices were broadly consistent with a single operator, though no formal stylometric analysis was undertaken.
- **@stellar_anchor_oracle** — a promotional account with approximately 31,000 followers at the time of engagement, presenting as an independent commentator. Promotional posts during the launch window did not carry a sponsorship disclosure.
- **@nebula_ribbon_seven** — a smaller account with approximately 4,200 followers, active in the project's Telegram channel as a moderator. The account's posting history began approximately three weeks before the project's first teaser.

A fourth cluster of approximately eight accounts amplified posts during the two promotional waves. Their posting patterns — overlapping active hours, shared lexical templates, near-simultaneous engagement with the same posts — are consistent with the astroturfing signature described in §B.1 of the *Dark Patterns* whitepaper and in glossary entry #6.

### 3.4 On-Chain Indicators

The following addresses are fictional and are presented in the correct base58 format for Solana but with random values. They do not correspond to any real wallet.

- **Team treasury (presumed deployer)**: `7Hk8nP3xR9wK4LmDvQ2tBjNcF5gYpTzMaWeXrSyVuJzA`
- **LP deployer (single-use)**: `5kQ7fyBhXpRtNvCMaWLbqRzPTk2HnUsVgyKpMcFzdRcX`
- **First intermediate sweep wallet**: `7gMxqFbWPyKnL4ZtBxRsDvVcJpHeUgSnYwFaErTzkLqM`
- **Second intermediate sweep wallet**: `8hRtXjLpMaKzNvDwCqBeFvGsHnYrLpTkMcWnQpSrZxYa`

The pattern visible on-chain followed the canonical rugpull shape (#36): liquidity provided by the team wallet, with no time-lock contract; LP tokens held in the same externally-owned address that deployed the token; an admin function on the token contract allowing exclusion of arbitrary addresses from the sell-side path, which was not exercised but was available; a single observed event of LP withdrawal followed by an immediate swap and a peeling-chain dispersal (#55) across two and then four wallets.

A clustering heuristic (#53) applied retrospectively to the intermediate wallets clustered them, with high confidence, into a single operator. The cluster's earlier history, where visible, did not match any externally-labelled cluster.

### 3.5 Off-Chain Indicators

The social-media footprint consisted of approximately 240 posts across the six-week visible window, distributed across the team account and the three pseudonymous identities described above. Two promotional waves accounted for approximately 60% of total external engagement.

Three patterns were notable off-chain:

- **Lexical clustering.** Promotional posts during both waves shared a recurring set of unusual phrasings: a specific four-word slogan, a particular emoji combination, and a stylistic preference for ellipses after price claims. This clustering is one of the recognized astroturfing signatures described in §B.1 and §5.4 of the *Investigation Checklist*.
- **Engagement timing.** Replies and quote-posts on the project's launch announcement clustered within a 90-second window, which is consistent with coordinated activation but is not by itself proof of coordination.
- **Roadmap drift.** The website's roadmap was edited at least three times in the visible window. Initial roadmap items ("CEX listing", "audit by named firm") were removed in successive versions and replaced by less specific items ("ecosystem partnerships", "Phase 2 expansion"). The audit firm initially named was never approached, according to a public response from the firm.

### 3.6 Patterns Detected

The case maps to the *Dark Patterns* taxonomy as follows:

- **§A.1 Fake Countdown.** The launch countdown widget continued past the announced launch and was reset without acknowledgment.
- **§A.3 FOMO Triggers.** Multiple posts used scarcity framing ("first 500 wallets", "limited window") without on-chain correlates.
- **§B.1 Astroturfing.** Coordinated promotional waves with lexical and timing signatures characteristic of single-operator amplification.
- **§B.2 KOL-Orchestrated FOMO.** Mid-sized accounts posted without disclosure during the launch window.
- **§D.1 Bait-and-Switch Roadmap.** Roadmap items were quietly removed and replaced.

Relevant glossary entries: #5 Sockpuppet, #6 Astroturfing, #36 Rugpull, #53 Clustering, #55 Peeling chain, #61 KOL, #66 Influencer.

### 3.7 Pedagogical Lessons

- **Liquidity lock is not a guarantee, but its absence is a near-certainty.** A liquidity pool whose LP tokens are held in an externally-owned address controlled by a pseudonymous deployer is a precondition for the canonical rugpull shape. Absence of a locked-LP contract should be recorded as a structural risk before any other consideration.
- **Roadmap edits leave traces.** The web archive of a project's roadmap, captured incrementally, is one of the most informative off-chain artefacts. The presence of a "named audit firm" item that disappears, followed by silence from the named firm, is the §D.1 pattern in its most legible form.
- **Astroturfing signatures are stylistic before they are technical.** Coordination is detectable in lexical choices and timing patterns before any platform API is required. A reader who notices the same four-word slogan in twelve accounts within an hour already has a working hypothesis.
- **The investigator's first task is reconstruction, not adjudication.** The casefile that results from this kind of investigation should describe the pattern, not assert the team's intent. Intent is an evidentiary question for competent authority; pattern is a methodological question for the investigator.

---

## 4. Case 2 — "Kalyssa Exchange: a Centralized Exit Scam"

### 4.1 Context

Kalyssa Exchange was a fictional centralized cryptocurrency trading venue presented as headquartered in a Gulf-region free zone and operating under a licence issued by a small Caribbean offshore jurisdiction. *The combination of jurisdictions, product type, retail audience, and chronology in this case is synthetic and deliberately composite; it is constructed to illustrate a pattern, not to allude to any specific real-world platform.* Its native token, $KLSX, was traded on its own platform and on a small number of secondary venues. The platform operated for approximately fourteen months between mid-2024 and mid-2025 before withdrawals were suspended.

Kalyssa marketed itself primarily to a Latin American Spanish-language retail audience reached through Spanish-language Telegram trading communities and through paid promotion on a major social platform aimed at the same regional audience. At its peak, the platform claimed approximately 47,000 verified users and a 24-hour spot trading volume in the high single-digit millions of dollar equivalent. These figures, the platform's own, were never audited by a third party.

The platform's stated business model combined spot trading, leveraged futures on a small set of pairs, a "yield" product paying a deliberately modest 4.2% annual percentage to depositors — positioned as a "compliance-grade alternative" to the higher rates prevailing among competitors — and a distinctive side-product: a "fine-wine futures" tokenization programme offering fractional exposure to vintage bottles claimed to be held in a bonded warehouse, accessible through a custodial sub-token. These two products drove the bulk of customer deposit growth from month four onward and are the two central elements in the case.

### 4.2 Chronology

The visible chronology unfolded over approximately fourteen months.

- **Months 1–3.** Platform soft-launch. KYC onboarding implemented through a third-party identity-verification service. Initial marketing emphasized multi-jurisdictional compliance and "Tier-1 audit standards".
- **Months 4–6.** Aggressive growth campaign. The yield product launched at approximately 4.2% APY, marketed as funded by "market-making activity and platform fees" and positioned as a "compliance-grade" product distinguished by its "measured" rate. The fine-wine futures programme launched in parallel, offering fractional tokenized exposure to bottles claimed to be inventoried in a bonded warehouse referenced only in marketing material. Promotional appearances at two industry conferences (named in the platform's communications, neither of which confirmed Kalyssa's presence as a sponsor).
- **Months 7–10.** Steady user growth. Two minor incidents of delayed withdrawals attributed in customer service communications to "scheduled maintenance" and "third-party bank processing delays". Trustpilot reviews bifurcated sharply during this period.
- **Months 11–12.** Native token $KLSX listed on two secondary venues. A "compliance certificate" was added to the website, with a logo that resembled but did not exactly match a real regulator's logo.
- **Month 13.** Withdrawal delays became systematic. Customer support response times degraded from same-day to multi-day. A blog post attributed the situation to "unprecedented withdrawal pressure" and announced a temporary withdrawal cap.
- **Month 14, week 1.** The platform announced a 72-hour "scheduled maintenance" for "infrastructure upgrades". The window was extended twice.
- **Month 14, week 2.** Communication ceased. The website returned a holding page. The CEO's social-media accounts were deleted within 48 hours. The native token's price collapsed across all venues where it remained tradeable.

### 4.3 Actors

The platform presented a semi-doxed leadership team. The names below are invented; any resemblance to a real person is coincidental.

- **Sven Takashima** — listed as Chief Executive Officer. Public photograph appeared on the platform's "About" page; the photograph was reverse-image-searched after the collapse and was found to match a stock-photography library. No verifiable institutional record matched the name.
- **Nina Orozco** — listed as Head of Communications. Active on the platform's X and LinkedIn channels. The LinkedIn profile was created approximately five weeks before the platform's soft launch.
- **A "Compliance Officer"** — named only by first name on the platform's compliance page. No public record corresponded to the name and role.

A network of approximately fifteen mid-sized promotional accounts engaged with the platform's content during the growth phase. Several of the accounts were later identified as members of a paid-promotion network active in the same regional retail audience; none of the promotional posts carried a sponsorship disclosure.

### 4.4 On-Chain Indicators

The fictional EVM addresses below are presented in the correct hex format with arbitrary values. They do not correspond to any real wallet.

- **Platform "hot wallet" (deposits)**: `0xa3F87B91dE2c54bC9eaC718fF35E29D7bA1c92E4`
- **Platform "cold wallet"**: `0xc81fB29eAd7C4196FEa873d6520cB89e7DbF316a`
- **Withdrawal sweep wallet (observed in final week)**: `0xe7B4Aa28cF91d35E26b8A491EfCc70dB4296fE12`

In the final two weeks before the announced "maintenance", funds previously consolidated in the "cold wallet" were moved in a series of transactions to the sweep wallet. From the sweep wallet, funds were distributed across multiple intermediaries, with a noticeable share routed through a public cross-chain bridge (#30) to a second EVM-compatible chain and then to a privacy mixer (#31). The final destinations were not fully reconstructable from public data.

The pattern is the canonical exit-scam shape (#37): a centralized custodian whose internal accounting is opaque to depositors; an externally observable consolidation event in the days preceding the suspension of withdrawals; a dispersal pattern using cross-chain bridging and mixing that frustrates attribution at the destination.

### 4.5 Off-Chain Indicators

The off-chain footprint was extensive. Several elements were diagnostic.

- **The compliance certificate.** The certificate added in months 11–12 used a logo that resembled but did not match the logo of a real regulator. The regulator subsequently issued a public statement clarifying that no relationship existed. This is a §D.3 pattern in its clearest form, compounded by the §E.2 dynamic of regulator-impersonation.
- **The CEO photograph.** A simple reverse image search would have identified the photograph as stock imagery before any deposit was made. The photograph was nevertheless used unchallenged for approximately fourteen months.
- **The yield product's stated funding mechanism.** "Market-making activity and platform fees" was offered as the funding source for the 4.2% APY paid to depositors. The platform's audited trading volume — i.e., none — did not support this claim, and the "compliance-grade" framing that justified the modesty of the rate also concealed the absence of any reconcilable revenue surface. Where a yield product's stated funding mechanism cannot be reconciled with the platform's public revenue, the depositor is funding the yield, and the product is structurally Ponzi-shaped (a description, not a legal characterization) irrespective of whether the headline rate is conservative or aggressive.
- **The fine-wine futures programme's stated backing.** The claim that the wine-futures tokens were backed by physical bottles in a bonded warehouse was never substantiated by inspection reports, independent audits, or the warehouse operator's confirmation. Depositors who attempted in-kind redemption received only platform-internal credits, never delivery. A custodial product whose backing depends on physical inventory in an unverifiable third-party warehouse asks the depositor to trust the existence of an asset they have never seen.
- **Communications hygiene at suspension.** The transition from "scheduled maintenance" to silence was operationally rapid and consistent with the exit-scam template, where the operator's goal is to convert as much time as possible into additional deposits before public recognition of the collapse forecloses the deposit channel.

### 4.6 Patterns Detected

The case maps to the *Dark Patterns* taxonomy as follows:

- **§D.3 Fake Audit Badges.** The compliance certificate displayed without a verifiable counterparty.
- **§E.1 Impersonation Stacking.** The CEO photograph, the LinkedIn profile age, and the named "Compliance Officer" together constructed a fictional institutional presence.
- **§E.2 Doxx Theater.** Public-facing identities were constructed for credibility, not for accountability.
- **§C.1 Sniper Button Positioning.** The withdrawal flow placed the "Withdraw" button below the "Stake" and "Reinvest" buttons, in a smaller font, on the platform's primary post-login screen, throughout the platform's existence.

Relevant glossary entries: #28 CEX, #37 Exit scam, #30 Bridge, #31 Mixer, #50 Impersonation.

### 4.7 Pedagogical Lessons

- **A centralized custodian is a single point of failure regardless of marketing.** The depositor in $KLSX-type platforms is structurally an unsecured creditor. Promotional language about "Tier-1" standards does not change this status.
- **Stock photography is the cheapest fraud and the cheapest detection.** A reverse image search performed within minutes of arriving at a platform's "About" page would have flagged this case in month one. Few retail investors perform this step; the fact that they should is one of the modest interventions a consumer-protection programme can advocate.
- **A yield product whose funding mechanism is not reconcilable with the platform's public revenue is structurally suspect.** The arithmetic does not need to be precise. The order of magnitude is the test. Where the order of magnitude cannot be reconciled, the depositor is funding the yield.
- **The regulator-resembling logo is a small detail that closes the trust gap.** It is also the single design choice most likely to attract regulatory enforcement action after the fact. Investigators should capture the logo at the moment of evidence preservation (§3 of the *Investigation Checklist*), because it is among the elements most likely to be removed in the platform's last hours.

---

## 5. Case 3 — "The FerroLynx Coordinated Pump: an Operation on a Small Cap"

### 5.1 Context

FerroLynx ($FRLX) was a fictional small-capitalization token on an EVM chain, with a circulating supply of approximately 12 million units and a total market capitalization, at the start of the case, in the low five figures of dollar equivalent. The token had no team activity for approximately seven months before the events described; the contract was deployed by an externally-owned address whose subsequent activity was sporadic and consistent with abandonment.

The token came to attention not because of any team activity, but because of its selection as the vehicle for a coordinated pump-and-dump operation organized through a private Telegram channel referred to in this case as "Apex Tide Insiders". The case is illustrative of the small-cap pump-and-dump (#39) as a typology: a thinly-traded token whose dormant state makes price manipulation arithmetically straightforward, coordinated buyers organized off-platform, retail participants drawn in by visible price action without awareness of the coordination, and an organizer exit timed to maximize asymmetric distribution.

### 5.2 Chronology

The visible chronology unfolded over approximately four hours.

- **T-72h.** Apex Tide Insiders private Telegram channel announced an upcoming "operation" without naming the token. Approximately 4,800 members were on the channel at the time. The announcement framed the operation as a "community moonshot" and required members to accept a code-of-conduct binding them to "buy and hold for 72 hours".
- **T-24h.** A second message identified the token by name. Members were instructed to prepare wallets, fund them with at least 0.05 ETH equivalent, and stand by for the "T0 trigger".
- **T-0.** Trigger message posted. Coordinated buys began within ninety seconds across approximately 800 wallets. Price rose by approximately 6× in the first ten minutes and 12× in the first thirty minutes.
- **T+30 min.** Retail interest began appearing in adjacent chat venues and on the X feed. Mid-sized accounts (none participating in the coordination) began noting the price action.
- **T+60 min.** Price peaked at approximately 18× the pre-operation baseline.
- **T+60 to T+90 min.** Coordinated sell-side activity began from a smaller subset of approximately 35 wallets. The price began to descend.
- **T+90 to T+180 min.** Retail buying continued during the descent, slowing it. The coordinating subset completed its exit.
- **T+180 min.** Price returned to approximately 1.4× the pre-operation baseline. By the end of the same day it returned to baseline.
- **T+24h.** The Apex Tide Insiders channel was wiped.

### 5.3 Actors

Three roles can be distinguished within the operation, all played by invented identities below.

- **@nova_blue_handler** — the Telegram channel's principal admin. Posted operational messages, framing language, and the T-0 trigger. Posting style during the operation was substantially different from posts attributed to the same handle in the days preceding, suggesting either a different operator at the keyboard or a deliberate stylistic shift.
- **@apex_meridian_44** — a co-admin who posted reinforcement messages during the rise and counter-narrative messages during the descent ("hold the line", "shake-out incoming"). The pattern is the canonical "exit-bag" rhetoric described in the literature on pump-and-dump operations.
- **The "exit cluster"** — approximately 35 wallets that bought in the first ninety seconds and began selling within the first hour. These wallets clustered, by common-input heuristic (#54) and by chain analysis (#52), into approximately seven distinct operators.

A larger group of approximately 800 wallets followed the public instructions and participated as "members". A minority of these wallets exited at a profit; the majority exited at a loss as the descent accelerated. A further group of approximately 2,200 retail wallets bought during the descent, without any participation in the coordinating channel, and exited at a substantial loss.

### 5.4 On-Chain Indicators

The fictional addresses below are presented in the correct EVM format with arbitrary values.

- **Token contract**: `0xb52e0F4d2A91cE7DcFf38A6920a8c3F7DcEa54B9`
- **Liquidity pool (single AMM)**: `0x7f3cE19D6aF8512BA09bd47cE2197fA836eB05f7`
- **Representative exit-cluster wallet**: `0x47cFa18B6dE92dC7F4830aB5167cE99d8E1Bf2A6`

The pattern visible on-chain followed the canonical pump shape (#39): a thin liquidity pool whose depth was approximately USD 30,000 at the start of the operation, capable of absorbing only modest sell pressure before significant slippage (#24); a wave of buy-side transactions within a narrow time window; a higher-fee transaction pattern from the exit cluster, indicating willingness to pay for transaction priority in the sell-side path; a peeling-chain dispersal (#55) of proceeds across multiple wallets within the same hour.

The slippage trap (§C.2 of the *Dark Patterns* whitepaper) is illustrated mechanically here. A retail buyer arriving at T+45 min with a default slippage tolerance of, say, 2% would have transacted at a price well above their intended limit, because the front-end slippage display did not reflect the dynamic conditions of the rising pool. The exit cluster was, in effect, extracting the difference between retail intent and retail execution.

### 5.5 Off-Chain Indicators

Three off-chain elements are diagnostic.

- **The "code of conduct" framing.** The requirement that members "buy and hold for 72 hours" was a coordination device to prevent member sell-side activity from competing with the exit cluster. Read literally, it was a request that the members fund the operators' exit; read in the operators' frame, it was a "community" commitment. The reframing is the §B.3 confirmshaming pattern operating on the participants' identity as members.
- **The post-operation rhetoric.** Messages during the descent invoked "weak hands", "paper hands", and "shake-out" framing. This rhetoric is well documented in the literature on pump-and-dump operations and is intended to delay member sell-side activity past the point at which member exits could be profitable.
- **The channel wipe.** The destruction of the Telegram channel within twenty-four hours is consistent with the operators' interest in eliminating the most explicit off-chain evidence of coordination.

### 5.6 Patterns Detected

The case maps to the *Dark Patterns* taxonomy as follows:

- **§A.3 FOMO Triggers.** Both the "operation" framing and the visible price action.
- **§B.2 KOL-Orchestrated FOMO.** Operational, in the small group of organizers rather than in publicly visible influencers.
- **§B.3 Confirmshaming.** The "weak hands" / "shake-out" rhetoric during the descent.
- **§C.2 Slippage Trap.** Mechanical, in the AMM dynamics under the rising pool.

Relevant glossary entries: #24 Slippage, #26 LP, #29 DEX, #39 Pump and dump, #41 Front-running (operationally adjacent), #54 Common-input heuristic, #62 Retail, #65 Sniper bot.

### 5.7 Pedagogical Lessons

- **Coordination is the operationally decisive element, not the price action.** The retail investor who observes the price action sees a rising token; the investigator who maps the coordination sees an extraction. The investigative emphasis should be on the off-chain coordination structure, not on the on-chain price chart.
- **Asymmetric information is the substance of the harm.** The operators knew the operation was an operation; the participants believed they were part of a "community"; the retail bystanders saw a chart. The harm is the asymmetric distribution of awareness, not the price chart in isolation.
- **The "code of conduct" frame is a manipulation of identity.** Participants are framed as members of a group whose loyalty test is to hold during the descent. The operator's exit depends on the participants' compliance with this framing.
- **Pump-and-dump cases are not "victimless".** The argument that "the participants knew what they signed up for" presumes a symmetric understanding that the typology refutes. The participants believed in the coordination; they did not believe they were the coordination's exit liquidity. Channel destruction within hours of the operation, observed here, is among the highest-value evidence-preservation losses (§3 of the *Investigation Checklist*); capture in advance, where suspicion exists, is the only reliable option.

---

## 6. Case 4 — "The QuasarPath Drainer Campaign: Mass Phishing via Fake Airdrop"

### 6.1 Context

The QuasarPath campaign was a fictional mass-phishing operation conducted in early 2025, targeting holders of wallets across two EVM chains via a fraudulent "airdrop claim" interface. The campaign impersonated a legitimate but fictional protocol referred to in this case as "Protocol Q" (a stand-in for the class of recently-launched protocols whose tokenholder audience is a recognizable target).

The operation was a commodity-grade phishing-drainer (#43) deployment: the visible elements (landing page, social-media presence, "claim" interface) were paint over a generic underlying drainer kit available, during the period, in semi-public channels. The typology has become routine; most retail wallets encountering a fraudulent airdrop in 2024–2025 encountered one of approximately a dozen recurring kit variants, dressed for the target ecosystem.

Total losses across the visible campaign were estimated, by aggregating the drainer contract's observable inflows, at approximately USD 1.4 million across approximately 280 victim wallets over a six-week window.

### 6.2 Chronology

The visible chronology unfolded over approximately six weeks, with two distinct waves.

- **Pre-launch (week 0).** Infrastructure preparation. A domain visually resembling Protocol Q's domain (using letter substitution and a non-Latin character) was registered. A landing page was deployed. Drainer contract was deployed on the target chain. Social-media accounts impersonating Protocol Q were created with cropped versions of Protocol Q's avatar.
- **Wave 1 (weeks 1–2).** Targeting through X and Telegram. Reply-spam under Protocol Q's official posts directing users to the fake claim site. Direct messages from impersonator accounts to selected wallets that had previously interacted with Protocol Q. A "limited claim window" framing of 48 hours.
- **Wave 1 outcome (week 2).** Approximately 180 wallets victimized, with median loss in the low four figures of dollar equivalent.
- **Adaptation (week 3).** Protocol Q's team posted public warnings. The fake domain was reported and partially suppressed on the principal social platforms. The operators rotated to a second domain (similar substitution pattern) and a new set of impersonator accounts.
- **Wave 2 (weeks 4–5).** Resumed targeting through the new infrastructure. Refined social engineering: messages framed as "second-chance claim" for "wallets that missed the first round". Approximately 100 additional wallets victimized.
- **Suppression (week 6).** Combined action by the social platforms and the registrar of the second domain reduced visible activity. The drainer contract continued to receive smaller inflows for an additional two weeks before activity ceased.

### 6.3 Actors

The operators were anonymous and the actor structure was inferred rather than observed. The handle below is invented.

- **@quasarpath_claim** — the principal impersonator account during Wave 1. Cropped Protocol Q avatar; display name within three characters of Protocol Q's; posting cadence and timezone overlap consistent with an Eastern European or Central Asian operating window.
- **@nodevault_airdrop** — the principal impersonator account during Wave 2. Stylistically distinct from @quasarpath_claim but operationally similar.
- **A diffuse set of approximately 40 reply-spam accounts** during Wave 1, with overlapping creation dates clustered within a 96-hour window approximately two weeks before Wave 1, consistent with a pre-staged account batch.

Indications of a single operator or a small operator team for the on-chain side were strong: the drainer contract on each chain was a near-identical deployment with the same initialization parameters and the same withdrawal pattern.

### 6.4 On-Chain Indicators

The fictional addresses below are presented in the correct EVM format with arbitrary values.

- **Drainer contract (target chain 1)**: `0xd9c2e4a3F8B176eC5b0d29fAa84cE7bD5621FA90`
- **Drainer contract (target chain 2)**: `0xb47Ef25a83cD1F947B6128A0F593E7eC2861aF34`
- **Sweep wallet (terminal)**: `0x3eF9c186A7B58c2dE4A0fb91752C84eD0B1FE5a8`

The on-chain pattern is the canonical drainer shape (#43, #49): the victim wallet, having clicked through the fake claim interface, signed a transaction whose ostensible purpose was to "claim" an airdrop but whose effective payload was a token-approval transaction (#49) granting the drainer contract unlimited spending authority over one or more tokens held in the victim wallet. Following the approval, the drainer contract pulled the highest-value tokens from the victim wallet in a single follow-up transaction.

Cross-chain bridging (#30) and subsequent mixing (#31) of the proceeds frustrated attribution at the destination. The operators showed routine awareness of bridge timing and bridge throttling, suggesting an experienced operator rather than a first-time deployment.

### 6.5 Off-Chain Indicators

Several off-chain elements were diagnostic.

- **The domain substitution.** Both Wave 1 and Wave 2 domains used the same family of visually-similar substitutions: letter pairs (e.g., "rn" for "m") and a non-Latin character in a position where the eye is unlikely to inspect. This is the canonical homoglyph technique, characteristic of mass phishing rather than targeted attacks.
- **The reply-spam pattern under Protocol Q's official posts.** Replies appeared within minutes of Protocol Q's official posts and were posted by accounts whose other activity was minimal. The pattern is the §E.1 impersonation pattern operating on the social-media reply layer rather than on the account layer alone.
- **The "second-chance claim" framing in Wave 2.** This framing is well documented in the literature on phishing iteration: a Wave 2 narrative that reframes the failure of Wave 1 to capture a given wallet as a "second opportunity" specifically targets the wallets that exhibited prior caution.
- **The visible cooperation between social-platform reporting and registrar action in week 6.** This element is included to flag that suppression in this typology is feasible but slow; the operationally meaningful interval is the window before suppression, which in this case was approximately five weeks.

### 6.6 Patterns Detected

The case maps to the *Dark Patterns* taxonomy as follows:

- **§A.2 Limited Supply Theater.** The "limited claim window" framing of 48 hours in Wave 1 and the "second-chance" framing in Wave 2.
- **§E.1 Impersonation Stacking.** The cropped avatar, the near-identical display name, the homoglyph domain, and the staged reply accounts together constructed a sustained impersonation pattern.
- **§C.1 Sniper Button Positioning.** The "Claim" button on the fake landing page was positioned and styled to receive the user's attention; the small-print disclosure of the underlying transaction's nature was absent.

Relevant glossary entries: #43 Drainer, #44 Phishing, #49 Approval exploit, #50 Impersonation, #30 Bridge, #31 Mixer.

### 6.7 Pedagogical Lessons

- **Approval revocation is a default-on-recovery posture, not an emergency response.** Wallets that have signed token approvals to addresses that are no longer trusted should revoke those approvals as a matter of routine. The signature is the harm, not the subsequent transfer; the transfer is the materialization of the harm that has already been authorized.
- **Homoglyph domains are detectable by an inspection that costs seconds.** Hovering over a link, copying the URL, and visually comparing it to the legitimate domain is sufficient to detect the technique. This recognition habit is among the highest-leverage retail interventions available.
- **The reply layer is a phishing surface.** Treating "official" replies under an official post as if they shared the safety of the original post is the cognitive error the impersonator depends on. Investigators encountering reports of phishing should examine the reply layer of recent legitimate posts in the relevant ecosystem before concluding that the campaign is bespoke.
- **Drainer kits are a commodity, and so the operational tells of one campaign are predictive of others.** An investigator who recognizes the kit signature in one campaign should expect to see it elsewhere with cosmetic variations. The signature is in the on-chain pattern (#43), not in the landing page; suppression through the appropriate channels is feasible but slow, and the intervention window is the window before suppression, measured in weeks.

---

## 7. Transversal Synthesis

The four cases were selected to illustrate distinct typologies. Their points of overlap and their points of divergence are themselves pedagogically informative.

**Common to all four cases is the management of attention.** Each typology exploits an asymmetry between what the victim is asked to notice and what the operator depends on the victim not noticing. In PhotonGarden, the victim was directed to the price chart and the countdown; the relevant artefact was the unlocked LP. In Kalyssa, the victim was directed to the yield and the "compliance certificate"; the relevant artefact was the unreconcilable funding. In FerroLynx, the victim was directed to the rising price; the relevant artefact was the coordination structure off-chain. In QuasarPath, the victim was directed to the "claim"; the relevant artefact was the underlying approval transaction. The investigator's task is symmetric: redirect attention to the relevant artefact, document its presence, and reconstruct the path by which the victim was kept from it.

**Common to all four cases is the use of identity construction.** The operator built an identity surface resembling a legitimate counterparty (team, custodian, community, protocol). The construction was cheap relative to the proceeds; in three of the four cases, it would have been detected by routine OSINT verification within minutes. The economy of the attack depends on the rarity of routine verification.

**Where the cases differ is in the methodological sequence the investigator should follow.** A rugpull is best approached on-chain first (LP structure, team-wallet activity); an exit scam through the off-chain identity surface first (the discrepancy between claimed institutional status and any independent record); a pump-and-dump through the coordination layer (capture of the off-platform organizing channel); a drainer campaign through the infrastructure layer (the drainer contract, domain pattern, and reply-account batch will together identify the campaign as an instance of a recognizable kit). Investigators who use the same methodological order for every case will find themselves doing the wrong work first.

**Where the cases differ is in the temporal cadence of evidence preservation.** A rugpull's most decisive evidence persists on-chain indefinitely while off-chain evidence (website, Telegram channel, roadmap versions) degrades within hours. An exit scam's compliance-page screenshots, CEO accounts, and customer-support transcripts are removed within days. A pump-and-dump's coordinating channel may not survive the operation; capture in advance is the only reliable option. A drainer campaign's infrastructure persists for weeks but social-media accounts may be suspended at any point. Evidence-preservation plans should be calibrated to the typology, not generic.

**Limits of these case studies.** A real case is more complex than its narrative reconstruction. Investigators should expect, in any given engagement, additional patterns not described here, ambiguity in the attribution layer that the narrative resolves, witness reports that contradict each other, and elements that look central in retrospect but were invisible in real time. The case studies in this document teach pattern recognition, not pattern certainty.

---

## 8. Annex — Cross-Reference Table

The table below maps each of the four cases to the *Dark Patterns* taxonomy and to the *Investigation Checklist* sections, for reference use.

| Case | Pattern(s) (Dark Patterns) | Checklist sections (most relevant) | Glossary entries (principal) |
|---|---|---|---|
| Case 1 — PhotonGarden (rugpull) | §A.1, §A.3, §B.1, §B.2, §D.1 | §3, §4.1, §4.2, §4.4, §5.4, §6.4 | #5, #6, #36, #53, #55, #61, #66 |
| Case 2 — Kalyssa Exchange (exit scam) | §C.1, §D.3, §E.1, §E.2 | §3, §5.1, §5.3, §6.3, §7.4, §7.5 | #28, #30, #31, #37, #50 |
| Case 3 — FerroLynx (pump-and-dump) | §A.3, §B.2, §B.3, §C.2 | §3, §5.1, §6.1, §6.4, §7.6 | #24, #26, #29, #39, #54, #62 |
| Case 4 — QuasarPath (drainer) | §A.2, §C.1, §E.1 | §3, §4.2, §5.4, §6.1, §7.4 | #30, #31, #43, #44, #49, #50 |

The reader should interpret the mappings as the principal correspondences, not as exhaustive lists. Each case contains incidental references to patterns and sections not listed in the table.

---

## 9. References

The following references are intended to be verifiable through primary sources. Practitioners are encouraged to consult them in their published versions.

1. Chainalysis. (2024). *The 2024 Crypto Crime Report*. Annual report on illicit cryptocurrency activity. Subsequent editions update the typology counts and the share of proceeds attributable to scams, sanctioned entities, and ransomware.
2. Europol. (2023). *Internet Organised Crime Threat Assessment (IOCTA) 2023*. The annual IOCTA reports include sections on cryptocurrency-enabled fraud and on the evolution of phishing-drainer infrastructure.
3. Financial Action Task Force (FATF). (2021). *Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers*. Reference framework for VASP supervision relevant to centralized-exchange cases.
4. Foley, S., Karlsen, J. R., & Putniņš, T. J. (2019). *Sex, Drugs, and Bitcoin: How Much Illegal Activity Is Financed Through Cryptocurrencies?* The Review of Financial Studies, 32(5). Methodological reference on attribution at scale.
5. Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., & Narayanan, A. (2019). *Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites*. Proceedings of the ACM on Human-Computer Interaction, CSCW. Foundational empirical study on dark patterns.
6. Xu, J., & Livshits, B. (2019). *The Anatomy of a Cryptocurrency Pump-and-Dump Scheme*. Proceedings of the 28th USENIX Security Symposium. Empirical analysis of coordinated small-cap pump-and-dump operations.
7. Vasek, M., & Moore, T. (2015). *There's No Free Lunch, Even Using Bitcoin: Tracking the Popularity and Profits of Virtual Currency Scams*. Financial Cryptography and Data Security (FC 2015). Early systematic study of crypto scam typologies.

No reference in this document corresponds to a named real-world investigation; all sources cited are public scholarly, regulatory, or industry publications.

---

## 10. Disclaimer

The cases presented in this document are entirely fictional. All project names, platform names, social-media handles, wallet addresses, transaction hashes, dollar amounts, and dates have been invented for pedagogical purposes. Any resemblance between a case in this document and a real project, platform, person, address, or transaction is coincidental.

The document is descriptive and educational. It does not provide legal advice, does not authorise any action that would itself be unlawful, and does not name any specific real entity, project, or person. It is not a manual for the conduct of any operation described; the descriptions are sufficient to support pattern recognition and are insufficient to support reproduction.

Practitioners using this document for training purposes are encouraged to remind their audiences of the fictional status of the cases, particularly in pedagogical settings where the narrative form of the cases may encourage misreading as reportage.

Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). Permitted to be redistributed and adapted for non-commercial purposes with attribution.
