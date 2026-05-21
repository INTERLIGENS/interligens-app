---
title: "Dark Patterns in Crypto: A Taxonomy of Manipulation Tactics"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-21"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["investigators", "researchers", "retail-investors", "regulators"]
abstract: "Cryptocurrency platforms, presale sites, and social channels routinely deploy user-interface and discourse patterns designed to push retail participants into irreversible on-chain actions before they can deliberate. This document catalogues fifteen such patterns, grouped into five categories — manufactured urgency, social pressure, technical interface manipulation, financial misrepresentation, and identity manipulation. For each pattern we describe the psychological mechanism exploited, observable indicators, and counter-measures available to investigators and users. The taxonomy is intended as a foundation for detection tooling, regulatory analysis, and consumer education. It draws on the broader dark-patterns literature (Brignull, Gray, Mathur) and adapts it to the specific affordances of permissionless blockchains, where a single signature can transfer value irreversibly and where the absence of an intermediary removes the conventional safety net of reversal, chargeback, or dispute resolution."
---

## 1. Abstract

A *dark pattern* is a user-interface or discourse design choice that benefits the operator of a service at the expense of the user, typically by exploiting cognitive bias, asymmetry of information, or attention scarcity. The term was coined by Harry Brignull in 2010 and has since been adopted by regulators in the European Union (Digital Services Act, Article 25), the United States (Federal Trade Commission, 2022), and the OECD.

Cryptocurrency is a uniquely fertile environment for dark patterns. Transactions are irreversible, settlement is final within seconds, intermediaries are absent by design, and the average retail participant is asked to evaluate technical artefacts — contract addresses, calldata, signature payloads, liquidity-pool composition — that are difficult to interpret even for specialists. Manipulation that would be merely annoying on a consumer site becomes financially terminal when the same friction is applied to a wallet signature.

This document catalogues fifteen patterns observed across presale launchpads, token-launch sites, decentralized exchange front-ends, and social channels. We deliberately exclude two adjacent topics: (a) purely on-chain manipulation such as wash trading and rug pulls, which we treat as *consequences* of upstream dark patterns rather than dark patterns themselves; and (b) malicious calldata and signature-payload manipulation, which is the subject of a separate technical document. The scope here is the persuasive surface that brings a user to the point of signing.

The taxonomy is descriptive, not accusatory. No real project, person, or case file is named. The document is intended to be used by enquêteurs OSINT, retail investors with technical literacy, researchers, and regulators looking for an operational vocabulary.

## 2. Introduction

### 2.1 What is a dark pattern?

Harry Brignull's original definition (2010) characterised a dark pattern as a user-interface choice that "tricks users into doing things they didn't mean to". Gray et al. (2018) refined the framing as designs that benefit an online service by coercing, steering, or deceiving users into making unintended and potentially harmful decisions. Mathur et al. (2019, 2021) developed an empirical taxonomy of dark patterns across more than eleven thousand shopping sites and proposed five attributes — asymmetry, restriction, covertness, deception, and information-hiding — useful for classification.

Regulators have since produced operational definitions. EU Regulation 2022/2065 (Digital Services Act), Article 25, prohibits providers of online platforms from designing or operating their online interfaces "in a way that deceives or manipulates" recipients. The U.S. Federal Trade Commission staff report *Bringing Dark Patterns to Light* (September 2022) catalogued four categories of practice that the agency considers actionable under Section 5 of the FTC Act. The OECD's *Dark commercial patterns* working paper (2022) provides cross-jurisdictional comparison.

### 2.2 Why crypto is a special case

Three structural properties separate crypto from the e-commerce environment in which the dark-patterns literature originated:

- **Irreversibility.** Once a signature is broadcast and a block is finalised, the transaction cannot be reversed by the operator, by a payments network, or by a court without recovering the private key of the receiving address. The user has no chargeback, no fraud-protection window, no recourse to a payment processor.
- **Technical opacity.** Wallet pop-ups display hexadecimal addresses, function selectors, and gas estimates. The cognitive cost of verifying that a signature is safe is high, and the cost of being wrong is total. Front-ends frequently exploit this asymmetry by interposing a familiar visual interface over an unfamiliar contract call.
- **Composability and speed.** Permissionless deployment means a new token, pool, or front-end can be created in minutes, evaluated socially in hours, and abandoned within days. The pace removes the institutional friction (legal review, compliance, advertising-standards approval) that constrains analogous behaviour in regulated finance.

### 2.3 Scope and out-of-scope

This document covers manipulative patterns that occur *before* a wallet signature: the site, the social channel, the launchpad, the chat room. It does not cover malicious calldata, blind-signing exploits, EIP-712 payload manipulation, or permit-based drainers; those belong to a companion document on signature intent. It also does not cover purely on-chain misconduct (wash trading, sandwich attacks, MEV extraction, rug pulls), which is the *outcome* a dark pattern enables. The boundary chosen here is the persuasive surface — the layer that decides whether the user proceeds to signature at all.

## 3. A Taxonomy of Crypto Dark Patterns

Patterns are grouped into five categories: manufactured urgency, social pressure, technical interface manipulation, financial misrepresentation, and identity manipulation. Each entry includes the mechanism exploited, observable indicators, and counter-measures. Where a pattern is documented in the academic literature, the source is cited; where it is widely reported but lacks formal academic treatment, it is described conservatively.

### Category A — Manufactured Urgency

#### A.1 Fake Countdown

**Category.** Manufactured urgency.
**Mechanism exploited.** Loss aversion (Kahneman & Tversky, 1979); fear of missing out; the bias toward closure under time pressure.
**Presentation.** A visible timer on a presale, mint, allocation, or "whitelist closes" page. The timer may reset on page reload, restart after expiry, or be re-seeded to a fresh value on every visit. In some implementations the countdown is hard-coded client-side and bears no relation to any server-side or on-chain deadline.
**Why dangerous.** Time pressure measurably reduces deliberation and increases the probability of completing a transaction without due diligence (FTC, 2022, ch. 3). When the underlying urgency is artificial, the user makes a high-stakes decision on a manufactured premise.
**Detection indicators.**
- Timer value differs across browsers or after a hard refresh.
- Countdown reaches zero and is replaced with a new countdown of identical duration.
- No equivalent on-chain deadline (e.g., a `saleEndsAt` field) is exposed in the contract.
- The page source contains a hard-coded `Date.now() + N` rather than a deadline fetched from the contract.
**Counter-measures.** Investigators should compare the displayed deadline to any deadline encoded in the contract. Users should treat any sale that *cannot* be paused on a refresh as a signal worth investigating, not a signal to act faster.

#### A.2 Limited Supply Theater

**Category.** Manufactured urgency.
**Mechanism exploited.** Scarcity heuristic (Cialdini, 1984): items perceived as scarce are valued more highly and decisions about them are made faster.
**Presentation.** Counters such as "Only 47 spots left", "Whitelist 92% full", or a progress bar approaching completion. The number may be fully cosmetic — generated client-side, decremented on a timer regardless of actual sales — or may be re-seeded between sessions.
**Why dangerous.** The scarcity heuristic compounds with urgency: a user who would otherwise pause to verify a contract address may sign immediately to "secure their spot".
**Detection indicators.**
- "Spots remaining" decrements without correlated on-chain activity.
- The counter resets or jumps between page loads.
- No on-chain allow-list, supply cap, or per-address quota is verifiable in the contract.
**Counter-measures.** Cross-reference any displayed scarcity claim against the contract's actual supply, mint count, or allow-list state. Where the front-end refuses to expose the contract address before signature, the entire interaction should be treated as adversarial.

#### A.3 FOMO Triggers

**Category.** Manufactured urgency.
**Mechanism exploited.** Anticipated regret; social proof of imagined future gains.
**Presentation.** Banners and copy such as "Don't miss the next 100x", "Last chance before listing", "First mover advantage", "This is the new [established asset]". The copy frames *not participating* as the risky choice and *participating* as the default.
**Why dangerous.** Reframing the default decision is among the most effective manipulations in the dark-patterns literature (Mathur et al., 2021). When the alternative being foreclosed is fictional ("the next 100x"), the user is being asked to weigh a real loss against an invented gain.
**Detection indicators.**
- Comparative claims that reference price multiples without source.
- Absence of any concrete description of the underlying product.
- Reliance on third-person testimonials of past returns that cannot be verified.
**Counter-measures.** Treat any sale whose marketing copy describes outcomes rather than mechanics as marketing-led rather than product-led. Investigators should weight such language as a risk signal but not as conclusive evidence; FOMO copy is not in itself unlawful in most jurisdictions.

### Category B — Social Pressure

#### B.1 Astroturfing and Sockpuppets

**Category.** Social pressure.
**Mechanism exploited.** Informational social proof (Cialdini, 1984): the heuristic that if many independent people believe a thing, it is likely true.
**Presentation.** Coordinated accounts post enthusiastic but generic commentary on a token, project, or launch. Accounts may share creation dates, posting cadence, follower overlap, or visual templates. Replies to neutral or sceptical posts are disproportionately positive.
**Why dangerous.** The deception is structural: the user infers a popular consensus from what is in fact a single actor or a small coordinated group. This pattern is explicitly named in the FTC report (2022) and is one of the violations enumerated in DSA Article 25.
**Detection indicators.**
- Cluster of accounts with similar bios, similar creation dates, low follower-to-following ratios.
- Replies that repeat phrasing with minor lexical variation.
- Posting timezone inconsistent with claimed location of the project.
- Engagement metrics (likes, reposts) disproportionate to view counts.
**Counter-measures.** Sample accounts and inspect history; look for inorganic concentration of activity within the same project ecosystem. Where engagement metrics are accessible via API, compute follower-overlap matrices.

#### B.2 KOL-Orchestrated FOMO

**Category.** Social pressure.
**Mechanism exploited.** Authority heuristic (Cialdini, 1984): attributions of expertise transfer credibility to the object being endorsed.
**Presentation.** Influential accounts post supposedly organic enthusiasm about a project without disclosing that they hold allocations, were paid, or were granted early access. The endorsement looks like discovery rather than marketing. Where multiple influencers post simultaneously or within a short window, the orchestration becomes visible to careful observers but is not disclosed.
**Why dangerous.** Undisclosed paid endorsement is illegal in most jurisdictions for traditional securities and is the subject of ongoing enforcement in crypto (U.S. SEC actions through 2024 and 2025). For users, the structural deception — believing one is observing organic consensus when one is observing orchestrated marketing — is identical to astroturfing but harder to detect because each individual account is real and high-profile.
**Detection indicators.**
- Multiple influencers post about the same project within a narrow window.
- Posts lack the `#ad`, `#sponsored`, or jurisdiction-specific disclosure tags.
- Influencer wallet addresses (where known) appear among early recipients of the token.
- Endorsement language varies stylistically across accounts but is semantically near-identical.
**Counter-measures.** Treat correlated influencer activity as a marketing campaign by default and require disclosure to upgrade that classification. Investigators may correlate posting times with known token-distribution events.

#### B.3 Confirmshaming

**Category.** Social pressure.
**Mechanism exploited.** In-group conformity; aversion to being categorised as low-status.
**Presentation.** Refusal copy that frames the act of declining as a moral or status failure. Examples in crypto include "Diamond hands only", "Paper hands exit here", or refusal dialogs labelled with the slang for cowardice. The user is offered two buttons whose labels are not symmetrical: one neutral or affirming, one stigmatising.
**Why dangerous.** The pattern is documented in the consumer-protection literature outside crypto (Mathur et al., 2019) and is explicitly named in the FTC report. In crypto contexts it appears in token-claim flows, sell-confirmation dialogs, and community channels.
**Detection indicators.**
- Asymmetric labelling of opt-in versus opt-out controls.
- Use of community-coded slang to stigmatise prudent behaviour.
- Confirmation prompts that change wording depending on whether the user is buying or selling.
**Counter-measures.** Treat asymmetric labelling as a strong signal of manipulation regardless of context. Investigators should screenshot both states of any toggle or confirmation flow.

### Category C — Technical Interface Manipulation

#### C.1 Sniper Button Positioning

**Category.** Technical interface manipulation.
**Mechanism exploited.** Motor habituation; the Fitts's-law tendency to click the visually-prominent target.
**Presentation.** Buttons such as *Approve unlimited spending*, *Confirm swap*, and *Sign permit* are placed in spatial or chromatic proximity to less consequential controls. Default-button focus is on the most expensive option. Visual hierarchy (size, colour, shadow) draws the eye to the highest-risk action.
**Why dangerous.** Approve-unlimited transactions delegate ongoing spending authority over an ERC-20 token to a contract. A misclick can leave a permanent allowance that subsequent compromise of the contract can drain.
**Detection indicators.**
- The default-focused button performs the highest-cost action.
- *Approve* and *Confirm* are placed within a small radius without intermediate confirmation.
- Cancel or Back controls are rendered low-contrast or hidden in a menu.
**Counter-measures.** Users should never sign approvals from a page they did not arrive at deliberately. Investigators should inventory the contract permissions a typical user flow grants — full-token approval, unlimited allowance, or scoped permit — and flag flows that default to unlimited.

#### C.2 Slippage Trap

**Category.** Technical interface manipulation.
**Mechanism exploited.** Information hiding; default-value bias.
**Presentation.** A swap interface pre-fills slippage tolerance to a high value (commonly 15 percent or more) under the rationale of "preventing failed transactions". The user, often unfamiliar with what slippage means, accepts the default. Sandwich attackers extract the difference between expected price and accepted execution price up to the slippage limit.
**Why dangerous.** Slippage tolerance is a permission granted to the routing contract to execute the swap at a worse price than quoted. High default slippage is a documented vector for value extraction (Werner et al., 2022, on MEV).
**Detection indicators.**
- Default slippage above conventional values (typically 0.5–3 percent for liquid pairs).
- Slippage setting hidden behind an advanced-options toggle.
- Warning text absent or pre-acknowledged.
- Inability to set a lower slippage value than the displayed default.
**Counter-measures.** Verify slippage default before every swap. Treat any front-end that resists lowering the slippage as adversarial. For thin-liquidity pairs, accept that price impact is real and slippage tolerance is not the same as guaranteed price.

#### C.3 Hidden Tax Tokens

**Category.** Technical interface manipulation.
**Mechanism exploited.** Information hiding; the assumption that a swap interface fully discloses the cost of the swap.
**Presentation.** A token contract levies a transfer fee (commonly between 5 and 30 percent) on buys, sells, or both. The fee accrues to a developer wallet or to the liquidity pool. Front-ends and aggregators may not disclose the fee, and the apparent quote does not include it.
**Why dangerous.** The user receives substantially less than the quoted amount, often without immediate awareness. The pattern is most damaging when the sell-side tax is higher than the buy-side tax — entry is cheap, exit is expensive, and the asymmetry is opaque.
**Detection indicators.**
- Discrepancy between quoted output and received amount.
- Contract source containing a non-zero `taxFee`, `marketingFee`, `liquidityFee`, `_takeFee` function, or equivalent.
- Excluded addresses (`isExcludedFromFee`) that include the deployer or related wallets.
- Buy and sell paths produce different effective output ratios.
**Counter-measures.** Inspect the contract source for fee-on-transfer logic before interacting. Use a swap aggregator that reports effective received amount, not just quoted amount.

#### C.4 Honeypot UI

**Category.** Technical interface manipulation.
**Mechanism exploited.** Trust transfer from successful purchase to expected ability to exit.
**Presentation.** A token allows buys but blocks sells. The block may be implemented as a contract-level revert on `transfer` from non-allow-listed addresses, as a 100-percent sell-tax, as a paused pool, or as a hidden cooldown. The front-end may not signal the asymmetry; users observe a successful buy and assume symmetric exit liquidity exists.
**Why dangerous.** This is among the most consequential patterns because it weaponises the buy experience itself as a deception: the apparent success of a small initial purchase establishes false confidence that supports a larger second purchase.
**Detection indicators.**
- Contract source containing conditional reverts on the sell path.
- Allow-list logic that restricts `transfer` to specific addresses.
- Externally-callable functions that can pause or block trading post-launch.
- Pre-launch simulation (e.g., via `eth_call` against a fork) showing buys succeed and sells revert.
**Counter-measures.** Use a contract-simulation service before any non-trivial purchase. For new tokens with no audit trail, simulate a buy *and* a sell as part of the same dry run. Some patterns are detectable only through bytecode-level analysis and may require investigator tooling.

### Category D — Financial Misrepresentation

#### D.1 Bait-and-Switch Roadmap

**Category.** Financial misrepresentation.
**Mechanism exploited.** Sunk-cost bias; commitment and consistency (Cialdini, 1984).
**Presentation.** A project publishes an ambitious roadmap at launch — partnerships, products, audits, exchange listings — and amends or quietly removes items after raising funds. Versions of the roadmap on archived snapshots differ materially from versions presented on the live site. Specific quantitative commitments soften into aspirational language.
**Why dangerous.** Users who buy at launch are doing so on the basis of the initial roadmap; once committed, sunk-cost bias makes them resistant to acknowledging that the proposition has changed.
**Detection indicators.**
- Roadmap items disappear or are reworded between archived snapshots.
- Specific commitments (named partners, dates, deliverables) become generic.
- Communication frequency drops after token-generation event.
- "Phase 1" remains permanently in progress while later phases are removed.
**Counter-measures.** Snapshot the roadmap at the point of investment and compare against the current version periodically. Public archives (Wayback Machine and equivalents) are sufficient evidence for most cases.

#### D.2 Vesting Theater

**Category.** Financial misrepresentation.
**Mechanism exploited.** Anchoring on the published vesting schedule; the assumption that a smart contract enforces the disclosed terms.
**Presentation.** The project publishes a vesting schedule that suggests team and insider allocations are locked for a specified period. The actual contract may include early-release functions, multi-signature withdrawal paths, or a separate allocation not covered by the disclosed schedule. In some cases the vesting contract is not deployed at all and the tokens remain in a standard externally-owned account.
**Why dangerous.** Users underestimate near-term sell pressure because they trust the disclosed schedule. The on-chain reality of vesting can only be assessed by reading the actual contract addresses, not the schedule on the website.
**Detection indicators.**
- No on-chain vesting contract is verifiable.
- The vesting contract is upgradeable, ownable, or has admin-callable withdrawal.
- Allocation totals on the website do not reconcile with on-chain token balances.
- Tokens listed as "locked" sit in an externally-owned account rather than a contract.
**Counter-measures.** Treat any vesting claim that is not reducible to a specific verifiable contract address with an immutable schedule as marketing rather than commitment.

#### D.3 Fake Audit Badges

**Category.** Financial misrepresentation.
**Mechanism exploited.** Authority heuristic; visual association with trusted institutions.
**Presentation.** A project displays badges or logos suggesting third-party security audit by a recognised firm. The badge may link to no report, to an unrelated report, to a self-published document, or to a fabricated lookalike. In some cases the audit was performed on a different contract than the one deployed.
**Why dangerous.** Audit attestation is one of the few institutional signals available to retail participants. Subverting it removes a load-bearing trust primitive.
**Detection indicators.**
- Badge does not link to a published, dated report on the audit firm's official domain.
- Report covers a contract address different from the one deployed.
- Audit firm's domain is a typosquat or homoglyph of a legitimate firm.
- Audit firm publishes a public registry of audits and the project does not appear in it.
**Counter-measures.** Validate audit claims at source. Maintain a known-good list of audit-firm domains. Compare audited bytecode against deployed bytecode where feasible.

### Category E — Identity Manipulation

#### E.1 Impersonation Stacking

**Category.** Identity manipulation.
**Mechanism exploited.** Visual identity heuristic; trust transfer from a known account to its lookalike.
**Presentation.** Multiple accounts impersonate a project's founder, support team, or community moderators across Twitter/X, Telegram, Discord, and Farcaster. The accounts use the same avatar, near-identical handles (zero-width characters, homoglyphs, suffix variations), and reply quickly to users discussing the project. They direct victims to phishing sites or to "support tickets" that request seed phrases.
**Why dangerous.** Crypto support channels are unregulated and consist primarily of community moderators; the cost of impersonation is near zero and the rewards are high. Victims who would not enter their seed phrase on a website will enter it in a DM with someone who appears to be the founder.
**Detection indicators.**
- Account handle contains visually-similar but distinct characters.
- Account was created within hours of the legitimate account's activity peak.
- Replies appear unsolicited and direct the user off-platform.
- Multiple accounts use the same avatar but different join dates.
**Counter-measures.** Project teams should maintain a single authoritative list of official channels and refer users to it. Investigators should monitor for newly-created accounts that replicate visual identity, especially around catalyst events (listings, exploits, announcements).

#### E.2 Doxx Theater

**Category.** Identity manipulation.
**Mechanism exploited.** Accountability heuristic: a known identity is presumed to be a constrained identity.
**Presentation.** A project publishes the legal name, photograph, or social-media profile of its supposed founder to suggest accountability. The identity may be fabricated, stolen from an unrelated individual, generated by an image-synthesis model, or belong to a person with no actual operational role. Conferences and podcast appearances may be staged or misattributed.
**Why dangerous.** A doxxed founder shifts the user's risk assessment from "anonymous and unaccountable" to "named and reachable". When the doxx is false, the user has been moved into a less cautious posture on the strength of a fabricated signal.
**Detection indicators.**
- Reverse image search returns no provenance prior to project launch.
- LinkedIn or equivalent profile created within months of the project.
- Conference appearance is not corroborated by event organiser or independent recording.
- Domain registration data inconsistent with named jurisdiction.
**Counter-measures.** Treat a doxx as a hypothesis to be tested, not a proof of accountability. Verify identities against pre-existing institutional traces (academic publications, prior employment, regulated-industry filings).

## 4. Case Studies (Anonymised)

The following composites describe pattern combinations observed in the field. No real project, token, person, or transaction is referenced; the cases are illustrative.

**Case I — Presale launchpad combining A.1, A.2, and B.1.**
A presale page displayed a thirty-minute countdown and a "spots remaining" counter that decremented client-side. Coordinated accounts on a public social platform posted enthusiasm with shared lexical templates. The contract address was revealed only after wallet connection. Combined effect: users completed the deposit in a median time substantially shorter than the time required to read the contract. Funds raised in the low seven figures of U.S.-dollar equivalent before the front-end ceased to respond. No subsequent product was delivered.

**Case II — Token deploy combining C.3, C.4, and D.3.**
A token launched with a published audit badge linking to a report that covered an earlier version of the contract. The deployed contract included a sell-side transfer fee of approximately one quarter of the transaction value, not present in the audited version. After the first day of trading, an externally-callable admin function disabled non-allow-listed sells entirely. Combined effect: a honeypot pattern concealed behind a partially-honest audit. Estimated low six-figure U.S.-dollar equivalent losses across several hundred wallets.

**Case III — Influencer-led launch combining B.2, D.1, and E.2.**
Multiple high-following accounts posted enthusiastic but undisclosed-promotional content about a project within a window of several hours. The project's website published a roadmap with named institutional partners. Within three months the partners disappeared from the roadmap and the founder's published identity could not be corroborated against any independent institutional record. The token's market value fell substantially. No legal action followed in the relevant jurisdiction.

**Case IV — Phishing campaign combining E.1 and C.1.**
Following a legitimate protocol's public exploit, impersonation accounts surfaced within minutes offering "recovery assistance". The accounts directed users to a site that mimicked the legitimate protocol's interface but proxied wallet interactions through a contract that requested unlimited token approvals. The pattern combined an identity attack on the social layer with a sniper-button placement on the technical layer. Reported losses across several dozen wallets in the mid five figures of U.S.-dollar equivalent.

These composites are constructed to illustrate combination effects; each individual pattern is widely reported in industry post-mortems and consumer-protection literature.

## 5. Detection Methodology

The taxonomy supports two related detection workflows: (a) a single-investigator triage, performed manually within minutes of encountering a candidate project, and (b) an automated screening, suitable for batch evaluation of token launches.

### 5.1 Triage workflow

The investigator should resolve, in order:

1. **Identity layer.** Does the project name a founder? Is that identity supported by pre-existing institutional traces? Are the official channels authoritatively listed?
2. **Audit and disclosure layer.** Are any displayed audit badges traceable to a dated report on the audit firm's domain? Does the audited contract match the deployed contract?
3. **Contract layer.** Read the deployed contract source. Look specifically for: transfer fees, owner-callable trade-pauses, allow-list logic on `transfer`, upgrade-proxy admins, vesting contracts versus externally-owned addresses.
4. **Front-end layer.** Inspect the swap or sale interface for default-slippage values, button placement, asymmetric confirmation labels, and the presence of countdowns whose deadlines correspond to no on-chain field.
5. **Social layer.** Sample recent positive posts and inspect for the clustering signatures described in B.1 and B.2.

The investigator should record findings against the taxonomy and assign a per-category risk note. Combined risk is not a simple sum; certain combinations (D.3 + C.4; E.1 + C.1) are markedly more dangerous than the individual patterns.

### 5.2 Automated screening

Automated screening can address a subset of these patterns:
- Contract-source analysis (C.2, C.3, C.4, D.2, D.3) is mechanically tractable.
- Audit-badge validation (D.3) reduces to domain and hash comparison against a known-good registry.
- Front-end analysis (A.1, C.1) requires browser-automation but is feasible at small scale.
- Social-layer analysis (B.1, B.2, E.1) requires platform APIs and is rate-limited; it scales poorly without dedicated infrastructure.

Patterns relying on subjective interpretation of language and visual hierarchy (A.3, B.3) resist automation and remain best handled by human review.

The INTERLIGENS *Investigator Launchpad* surface is one such triage tool; this document is intended to provide the conceptual scaffolding such tools should operationalise.

## 6. Regulatory Implications

### 6.1 European Union

EU Regulation 2022/2065 (Digital Services Act), Article 25, prohibits providers of online platforms from "designing, organising or operating their online interfaces in a way that deceives or manipulates the recipients of their service" with reference to the impairment of the recipient's "ability to make free and informed decisions". Recital 67 enumerates examples directly applicable to several patterns in this document, including manipulative timers (A.1), social-pressure framing (B.3), and asymmetric default options (C.1).

EU Regulation 2023/1114 (MiCA) brings issuers of crypto-assets and crypto-asset service providers into a regulated perimeter, requiring fair, clear, and non-misleading marketing communications (Article 7, asset-referenced tokens; Article 29, crypto-asset service providers). Patterns D.1, D.2, and D.3 fall squarely within the marketing-communications standard.

National data-protection authorities have produced complementary guidance. The French CNIL's 2022 recommendation on dark patterns addresses interface design across sectors and is relevant by analogy to crypto front-ends targeting EU users.

### 6.2 United States

The Federal Trade Commission's September 2022 staff report *Bringing Dark Patterns to Light* identifies four categories of practice — designed to induce false beliefs, to hide material information, to sneak items into baskets, and to subvert user privacy choices — as actionable under Section 5 of the FTC Act. Several enforcement actions in 2023–2024 have applied this framework to non-crypto subscription services; application to crypto front-ends remains nascent but available in principle.

The U.S. Securities and Exchange Commission has pursued cases against undisclosed paid promoters of crypto-assets under existing securities law, particularly Section 17(b) of the Securities Act of 1933 (anti-touting). Pattern B.2 is the direct subject of such enforcement.

### 6.3 Limits

Crypto's jurisdictional structure constrains enforcement. Front-ends can be hosted in jurisdictions with no relevant regulator, smart contracts run on permissionless networks not controlled by any operator, and the operators of social-layer manipulation are routinely pseudonymous. Even where a pattern is plainly unlawful, the cost of identifying, serving, and prosecuting a defendant is high relative to the value at stake in most individual cases.

The result is that, in practice, the operative defence against the patterns documented here is investigator and user education combined with detection tooling, not enforcement.

## 7. Recommendations

### 7.1 For users

Before signing any crypto transaction sourced from a discovery via social media:
1. Verify the contract address from a source independent of the front-end that presented it.
2. Inspect any countdown for behaviour under refresh.
3. Set slippage tolerance explicitly; do not accept defaults above 3 percent on liquid pairs.
4. Reject unlimited-approval requests; use scoped permits where the wallet supports them.
5. Simulate buys and sells on a forked node or via a simulation service before non-trivial purchases.
6. Validate audit badges by following the link to the audit firm's domain and confirming the deployed contract matches.
7. Treat unsolicited support contact as adversarial by default.
8. Maintain a separate wallet for unfamiliar interactions; never sign experimental contracts from a wallet holding long-term positions.
9. Snapshot roadmaps and team disclosures at the point of investment.
10. Recognise that confirmshaming is a manipulation, not a community norm.

### 7.2 For regulators

1. Treat the dark-patterns framework developed for consumer interfaces (Brignull, Mathur, FTC) as directly applicable to crypto front-ends, with adaptations for irreversibility.
2. Require disclosure of paid influencer relationships analogous to securities anti-touting rules; enforce where the influencer is within jurisdictional reach.
3. Establish a registry of audit firms whose attestations are recognised, analogous to recognition of statutory auditors in traditional finance.
4. Require front-ends within jurisdiction to expose contract address and effective fees prior to wallet connection.
5. Maintain inter-jurisdictional coordination on patterns affecting cross-border retail participants; isolated national enforcement scales poorly.

### 7.3 For protocols and front-ends

1. Default slippage tolerance to the lowest value consistent with execution; do not pre-fill aggressive defaults for routing convenience.
2. Make contract address, ownership, upgrade authority, and fee schedule available pre-connection.
3. Use scoped approvals (EIP-2612 permits or equivalent) rather than unlimited approvals as the default.
4. Publish channel-of-record lists in a single, signed, machine-readable location accessible from the front-end.

## 8. Glossary

**Allow-list.** A contract-enforced set of addresses permitted to perform a specified action (purchase, transfer, claim). Off-allowlist addresses revert.

**Approve-unlimited.** A transaction that grants a contract permission to spend an unlimited quantity of an ERC-20 token from the user's wallet. Permission persists until explicitly revoked.

**Astroturfing.** Coordinated activity by accounts presented as independent, designed to manufacture the appearance of organic consensus.

**Calldata.** The encoded function call and arguments sent in a transaction. Wallets display this as hexadecimal payload during signing.

**Confirmshaming.** A dark-pattern category in which the option to decline is labelled in stigmatising language.

**Doxx.** The disclosure (genuine or fabricated) of a real-world identity behind a pseudonymous online presence.

**EIP-712.** An Ethereum standard for typed structured data signing, used by permit-style approvals.

**FOMO.** Fear of missing out: a colloquial label for anticipated-regret-driven decisions.

**Front-end.** The user-facing website or application interfacing with a smart contract; legally and technically separable from the contract itself.

**Honeypot.** A token or contract that admits inflows but blocks or punitively taxes outflows.

**KOL.** Key opinion leader; an account with substantial reach whose endorsements influence followers.

**Liquidity pool.** A smart-contract holding pair (or set) of assets that prices and executes swaps against its reserves.

**MEV.** Maximal extractable value: value captured by reordering, including, or excluding transactions within a block.

**Permit.** A signature granting scoped approval (typically EIP-2612), often time-limited and amount-bounded.

**Roadmap.** A published schedule of project deliverables.

**Slippage tolerance.** A user-set maximum acceptable difference between quoted and executed price for a swap.

**Sockpuppet.** An account operated by an actor distinct from its presented identity, used to manufacture support.

**Tax token.** A token that levies a transfer fee on buys, sells, or both.

**Vesting.** A schedule restricting when and how much of an allocation can be transferred or sold.

**Wash trading.** Trades between addresses controlled by the same actor, used to manufacture apparent volume.

**Whitelist.** Synonym for allow-list, often used informally in marketing contexts.

## 9. References

The following references are intended to be verifiable through primary sources. Where a document is published by a public institution, the institutional name is the locator.

1. Brignull, H. (2010). *Dark Patterns* (originally darkpatterns.org, now deceptive.design). Foundational definition of the term.
2. Cialdini, R. B. (1984). *Influence: The Psychology of Persuasion*. HarperCollins. Source for the scarcity, authority, and social-proof heuristics applied throughout.
3. European Parliament and Council. (2022). *Regulation (EU) 2022/2065 on a Single Market for Digital Services (Digital Services Act)*. Article 25 and Recital 67 on dark patterns.
4. European Parliament and Council. (2023). *Regulation (EU) 2023/1114 on Markets in Crypto-Assets (MiCA)*. Articles 7 and 29 on marketing communications.
5. Federal Trade Commission. (2022, September). *Bringing Dark Patterns to Light*. FTC Staff Report.
6. Gray, C. M., Kou, Y., Battles, B., Hoggatt, J., & Toombs, A. L. (2018). *The Dark (Patterns) Side of UX Design*. Proceedings of the 2018 CHI Conference on Human Factors in Computing Systems.
7. Kahneman, D. (2011). *Thinking, Fast and Slow*. Farrar, Straus and Giroux. Source for the dual-process framing relevant to time-pressured decisions.
8. Kahneman, D., & Tversky, A. (1979). *Prospect Theory: An Analysis of Decision under Risk*. Econometrica, 47(2). Foundational paper on loss aversion.
9. Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., & Narayanan, A. (2019). *Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites*. Proceedings of the ACM on Human-Computer Interaction, CSCW.
10. Mathur, A., Kshirsagar, M., & Mayer, J. (2021). *What Makes a Dark Pattern... Dark? Design Attributes, Normative Considerations, and Measurement Methods*. Proceedings of the 2021 CHI Conference.
11. Norwegian Consumer Council (Forbrukerrådet). (2018). *Deceived by Design*. Report on dark patterns in consumer interfaces.
12. OECD. (2022). *Dark commercial patterns*. OECD Digital Economy Papers, No. 336.
13. Thaler, R. H., & Sunstein, C. R. (2008). *Nudge: Improving Decisions About Health, Wealth, and Happiness*. Yale University Press. Reference framework for default-bias and choice architecture.

Practitioners may additionally consult ENISA reports on cryptocurrency-related threats and national competent authority guidance (e.g., France's CNIL recommendations on deceptive interface design, 2022).

## 10. Disclaimer

This document is a descriptive analysis of observable interface and discourse patterns. It does not name any specific entity, project, token, person, or case. Any resemblance between the composite cases in Section 4 and real events is descriptive, not accusatory; the composites are constructed from widely-reported public phenomena and do not allege misconduct by any identifiable party.

The taxonomy is offered as a vocabulary for investigators, researchers, regulators, and educated retail participants. It is not legal advice. Specific enforcement questions should be referred to competent counsel in the relevant jurisdiction.

INTERLIGENS Research, 2026. Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). Permitted to be redistributed and adapted for non-commercial purposes with attribution.
