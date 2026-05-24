---
title: "Anatomy of a Rugpull — A Technical and Behavioural Walkthrough"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-23"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["investigators", "researchers", "journalists", "investors", "compliance-officers", "students"]
abstract: "A monothematic deep-dive on the rugpull mechanism in cryptocurrency markets. The paper traces the lifecycle of a rugpull from preparation through promotion, peak, extraction, and post-mortem, covering both the technical layer (smart contracts, liquidity pools, MEV) and the behavioural layer (founder narrative, victim psychology, community dynamics). It is intended as a companion to the Dark Patterns Crypto whitepaper, focusing on a single attack pattern in full granular detail."
---

## 1. Preface

The companion document to this paper, *Dark Patterns in Crypto: A Taxonomy of Manipulation Tactics*, catalogued fifteen persuasive patterns observed on the surface that leads a retail participant to a wallet signature. That work was deliberately broad: it described the *upstream* layer of manipulation, leaving the *downstream* outcome — what happens after the signature — to other documents.

The present whitepaper takes the opposite stance. It selects a single downstream outcome — the rugpull — and traces it end to end, from the conditions that make it possible to the wreckage it leaves behind. It is monothematic by design. The rugpull was chosen because it is structurally simple (the operator absconds with pooled value), socially complex (it requires a community to fund the pool first), and unusually well-documented in both the academic literature and the public on-chain record.

The methodology is descriptive aggregation. No real project, person, exchange, token, or jurisdiction-bound investigation is named. The patterns described here are inferred from the academic corpus on cryptocurrency fraud (Vasek & Moore, Foley et al., Xu & Livshits, Mazorra et al., Cernera et al.), from the annual industry reports of chain-analysis firms and law-enforcement agencies, and from the directly observable on-chain record of permissionless deployments since 2017. The fictional cases used elsewhere in the present pedagogical corpus are not reused here; this document deliberately stays at the level of typology.

The intended audience is wide: investigators building a mental model of what they are reconstructing after the fact, researchers seeking a structured vocabulary, journalists drafting explanatory pieces, retail investors trying to understand how the assets they hold could disappear overnight, compliance officers evaluating counterparty risk, and students approaching the topic for the first time.

A final remark belongs in the preface. The paper describes, it does not instruct. Sections 4 (Preparation), 5 (Launch and Promotion), and 7 (Extraction) carry an explicit warning box and were rewritten in the past indicative to mark the distance between analytic description and operational tutorial. A reader interested in defrauding investors will not find a usable recipe in these pages; a reader interested in recognising the next rugpull while it is still in motion may.

## 2. Definition and Scope

A *rugpull* is the abrupt or progressive withdrawal of value, by the operators of a cryptocurrency project, from a pool of funds raised from third-party participants on the implicit or explicit understanding that the funds would be used for a continuing enterprise. The defining feature is the *severing of the agreement*: the operator stops being an operator and becomes an exit liquidity holder. In the colloquial vocabulary of the industry, the operator "pulls the rug" out from under the holders.

This is not the only colloquial use of the term. In day-to-day chat the word is applied loosely to any price collapse, even one with no fraudulent component. The academic and investigative use is narrower: the project must have raised value from third parties, and the operators must have extracted that value in a way that breaks the implicit contract of continued operation. A failed honest project is not a rugpull; the absence of fraudulent intent is what separates abandonment from extraction. The distinction is conceptually clean and operationally fuzzy — see §11.

The taxonomy below distinguishes four sub-types, chosen for the descriptive clarity they offer rather than for any claim to exhaustive coverage.

- **Hard rugpull.** The liquidity supporting the token is withdrawn from the decentralised exchange in a single transaction or a tight burst. Trading becomes impossible, the token quotes to zero against the pair asset, and the value held by retail participants evaporates within seconds. The mechanical signature is unambiguous on the public ledger.

- **Soft rugpull.** The operators do not withdraw liquidity in one move; instead, the team wallets sell their allocations into the market over hours, days, or weeks, depressing the price progressively while denying intent. The endpoint is the same — the operators have exited and the community holds an inert asset — but the on-chain signature is diffused across many transactions and is harder to attribute as a coordinated act.

- **Liquidity migration scam.** The operators announce a migration of the project to a "new contract", a "new chain", or a "v2 token", and instruct holders to swap or stake their tokens through a contract or front-end that does not deliver what it promises. The migration contract is the extraction vehicle. The pattern is structurally close to a phishing campaign launched by the operators against their own community.

- **Slow rug.** A hybrid in which the project continues to operate at a low level of activity while the operators dilute supply (through unannounced mints, vested release accelerations, or treasury sales) and exit value gradually. The community is kept engaged by a thin layer of activity until the asset is hollowed out. Slow rugs are the hardest to date and the most contested in attribution.

The document does not cover: centralised exit scams in which an exchange or custodial service vanishes with deposits (a related but distinct category treated elsewhere in the literature, see Glossary #37); pure MEV extraction (sandwich attacks, arbitrage, see Glossary #41 and #42); governance attacks on decentralised autonomous organisations; or smart-contract exploits in which an external attacker drains a protocol that was operating in good faith. Each of these has its own grammar and deserves its own document.

For internal vocabulary the reader is referred to Glossary entries #36 (rugpull), #37 (exit scam), #38 (honeypot), and #39 (pump and dump), which together delineate the conceptual neighbourhood.

## 3. Economic and Cultural Preconditions

A rugpull does not appear in a vacuum. It requires a set of market, technical, and sociological conditions, none of which is sufficient on its own but which together compose the soil in which the pattern reliably grows.

**Market conditions.** Rugpulls cluster during local bull phases. The mechanism is straightforward: the funnel of incoming retail capital widens, the median holding period shortens, the willingness to allocate to unaudited tokens rises, and the social cost of due diligence falls because every undue caution looks, in retrospect, like a missed opportunity. The base rate of fraudulent launches tracks the base rate of all launches with a lag: as the market heats up, the proportion of bad-faith launches in the total flow does not drop, and may rise. Vasek & Moore (2015) observed the same dynamic in the early Bitcoin scam ecosystem; Chainalysis annual Crypto Crime Reports document the same cyclicality across the more recent token cycles.

**Technical conditions.** The permissionless deployment infrastructure of contemporary blockchains is the second precondition. The capital cost of issuing a token on a general-purpose smart-contract chain is measured in fractions of a unit of the native asset. The skill cost is similarly low: template contracts are widely available, copy-paste deployment is a documented practice, and dedicated launchpads abstract away most of the residual friction. On chains optimised for speed and low gas, the technical floor approaches zero. A bad-faith operator does not need to overcome any infrastructural barrier; the same rails that lower the cost of legitimate experimentation lower the cost of fraudulent imitation.

**Sociological conditions.** The third precondition is the attention economy that surrounds the technical infrastructure. Key opinion leaders (Glossary #61) and influencers (#66) operate within a reputation market where being early is rewarded and being wrong is forgiven on a short half-life. Their incentive is to surface novelty, and the cost of surfacing a fraudulent project is borne primarily by their audience rather than by themselves. The behavioural literature documents the underlying biases — fear of missing out, social proof, base-rate neglect, loss aversion asymmetrically applied to gains, and the disposition effect (Kahneman & Tversky, classic results). The companion *Dark Patterns* whitepaper (§A on manufactured urgency, §B on social pressure, §D on financial misrepresentation) describes how these biases are operationalised by interface and discourse design.

A useful framing borrowed from Foley, Karlsen & Putniņš (2019), who studied illicit activity in Bitcoin: the size of the illicit cohort is not determined by the supply of bad actors (which is essentially unlimited) but by the porosity of the surrounding system. A rugpull cluster is a measurement of porosity, not of malevolence.

## 4. Phase 1 — Preparation

> **⚠ Note on this section.** What follows is a descriptive reconstruction of the preparation phase as it has been documented in the public record. The text is written in the past indicative to mark distance from any operational reading. No sequence, parameter, or artefact below is provided with the specificity required to reproduce the pattern; readers seeking a tutorial will find none.

The preparation phase is the *before*: everything that has been put in place by the time the first third-party participant sees the project. In a hard rugpull, this phase has often consumed more time than the active campaign that follows.

**Choice of chain.** Operators have historically selected the chain on which the project will be deployed according to three criteria: the marginal cost of deployment and transaction (favouring chains with low native gas fees), the size and composition of the retail audience already present on the chain (favouring chains with active social channels and accessible launchpads), and the perceived effort required for forensic attribution (favouring chains whose tooling ecosystem for chain analysis is younger or whose bridging surface increases the cost of cross-chain reconstruction). The selection is not a technical decision; it is a market-fit decision.

**Choice of decentralised exchange and trading pair.** Within the chosen chain, the operators have typically deployed on the dominant permissionless decentralised exchange (Glossary #29), pairing the new token against either the native asset, a major stablecoin, or a wrapped equivalent. The pair selection determines what is extracted at the end: a USDC pair extracts USDC; a native-asset pair extracts the native asset and exposes the operators to the asset's own volatility during the campaign.

**Token contract.** The on-chain artefact has typically been a standard fungible-token contract (ERC-20 on EVM chains, SPL on Solana, equivalents elsewhere). The decision points historically observed in the public record concern features that materially affect the contract's behaviour after deployment: whether the supply is mintable beyond the initial issuance, whether addresses can be blacklisted from transferring, whether transfer fees are charged and can be modified, and whether the contract owner retains the ability to alter parameters or has renounced ownership. Each of these features has legitimate uses; each is also load-bearing in the fraudulent variants documented in the academic literature (Mazorra et al. 2022; Cernera et al. 2023). The absence of an audit, or the presence of an audit that cannot be verified against a published methodology and a named auditor, has been a recurrent companion feature.

**Wallet architecture.** The pre-launch wallet topology has typically included at least: a deployer address from which the token contract is created, one or more team addresses receiving an initial allocation, a marketing address used to fund promotion, and the liquidity-provider address that will seed the pool on launch and will, in the hard variant, be the address that withdraws it. The relationships between these addresses are often obscured by intermediate routing, the use of mixers or bridges, and the recycling of addresses across unrelated prior projects.

**Narrative artefacts.** A whitepaper, a website, social-channel presences (typically X, Telegram, Discord) and sometimes a developer-style GitHub repository have been prepared in advance. The visible age of these artefacts is one of the few weakly informative ex-ante signals: in the cases documented in the public record, narrative artefacts have often been freshly created, the website has been built from a template, and the development repository, when present, has shown a thin commit history concentrated in a short window.

**Reputational scaffolding.** The preparation phase has also included the manufacturing or purchase of social signals. Documented practices include the procurement of follower counts on social platforms, the orchestration of early endorsements through paid or covertly paid influencers, the staging of mentions on adjacent projects, and the publication of "audit" pages that link to PDF documents whose provenance cannot be confirmed. The companion *Dark Patterns* whitepaper (§B.1 on astroturfing and sockpuppets, §E.1 on impersonation stacking) describes the family of techniques in detail.

The output of the preparation phase is a project that, from the outside, displays the surface markers of a legitimate launch: a contract on-chain, a pool seeded on a known venue, a website, social channels, an audit page, and a small number of voices already discussing it. The launch can now begin.

## 5. Phase 2 — Launch and Promotion

> **⚠ Note on this section.** As in §4, this section reconstructs the launch and promotion phase from the public record. The description focuses on observable surface markers and does not provide configuration details.

The launch is the moment at which the prepared structure begins to interact with external capital. From a forensic standpoint, it is the phase that generates the bulk of the off-chain artefacts (posts, screenshots, chat logs) that an investigator will later have to reconstruct.

**Liquidity bootstrap.** The pool has typically been seeded by the operator's own liquidity-provider address with a quantity of the native asset or stablecoin denominated in the pair, against an initial allocation of the new token. The ratio of these two sides defines the initial implied price. In the patterns documented in the academic literature on token spammers (Cernera et al. 2023), the seeding amount has often been small relative to the supply, with the explicit intent of producing a steep price response to even moderate retail inflow.

**Early buyers.** The first inflows have frequently come from addresses that were either directly controlled by the operator team or coordinated with it: sniper bots (Glossary #65) tuned to detect the pool's creation block and to execute a buy in the first available transaction window, and pre-funded addresses that have placed orders before the public announcement. The effect, visible from the outside as a vertical opening candle, has been to bake in the impression that the project was "missed" by anyone who had not been positioned in advance. The companion *Dark Patterns* whitepaper §A.1 (fake countdown) and §A.2 (limited-supply theatre) describes the upstream interface tactics that prime retail to react to such openings.

**First wave of promotion.** Within minutes of the opening, coordinated posts on social platforms have typically begun: synchronised messages on X carrying identical hashtags and visual templates, raids on Telegram chats unrelated to the project, and outreach to mid-tier influencers offering allocation in exchange for posts. The companion *Dark Patterns* whitepaper §B.1 (astroturfing) describes the structural pattern; the difference at launch time is intensity rather than nature.

**Narrative construction.** Alongside the price action, a narrative has been put in place: a roadmap declaring milestones at three, six, and twelve months; an airdrop teased but not yet executed; partnerships announced with names that, on inspection, often turn out to be either unilateral references (the partner has not confirmed) or genuine but minor. The narrative serves two purposes: it provides a reason to hold rather than to sell, and it provides a reason to recruit further holders.

**Engagement mechanics.** Staking schemes, NFT companion drops, lottery distributions, and referral programs have been routinely deployed during the first days. Each of these increases the surface area of the project's social presence and, mechanically, locks token supply that would otherwise circulate. The dual function is engagement and float reduction; the second is the more important for what comes next.

**Detection at launch time.** The honest difficulty of detection at this stage must be acknowledged. To a participant without forensic tooling, the surface of a fraudulent launch is often indistinguishable from the surface of a legitimate but optimistic launch. The signals that separate the two are statistical (wallet-clustering, liquidity-lock status, contract-owner status), not perceptual. The patterns enumerated in §10 below describe what can be inspected ex ante; the patterns enumerated in §4 describe what the operator put in place to defeat that inspection.

For the methodology of after-the-fact reconstruction of this phase, the reader is referred to the *Investigation Checklist* §5 (off-chain identifier collection) for the social-platform forensics and §6 (behavioural patterns) for the post-pattern attribution.

## 6. Phase 3 — Peak and Euphoria

The third phase is the apex of the price curve. It is shorter than the two phases that preceded it — typically hours to a few days — and it is the phase in which the gap between the social narrative and the operator's internal posture widens to its maximum.

The visible markers at the peak are well-documented. The price has reached its all-time high relative to the pair asset. On-chain volume is at its session maximum; the pool's reserves on the trading venue are large enough that even the operator team would face slippage if it tried to exit in a single transaction. The story has crossed the boundary from the project's own channels into the secondary crypto media: aggregator feeds, screenshot accounts, and tier-two influencers who were not part of the initial coordination wave but who now feel the pressure to comment on what is clearly *trending*. Retail flow is at its highest; the late entrants are paying the highest prices, with the shortest expected holding horizon, and the lowest information about what they hold.

Inside the operator team, the posture has begun to invert. The public communication that was hyperactive in §5 starts to thin. Roadmap milestones that were promised for the third month are quietly postponed under the cover of "technical issues". Specific channels — typically the channels where holders ask the most operationally precise questions — go silent or are moderated with increasing latency. The team's wallet addresses, if visible, begin to show preparatory movement: consolidation of small balances, test transactions, the funding of fresh intermediary addresses that have no prior history.

The weak signals of the peak are real but rarely detected in time. The reason is asymmetric: the operator has perfect information about the upcoming extraction and zero incentive to surface it; the community has imperfect information about its own holdings and a strong disposition not to surface what would crash the price. The literature on disposition effect, on the herding behaviour of crypto investors (Xu & Livshits 2019, on pump-and-dump dynamics), and on the social cost of being publicly bearish during a community-wide bullish phase explains the under-detection. The signals that *would* support a forecast — operator wallet activity, narrative thinning, abnormal channel latency — require both forensic tooling and a willingness to act against the community's prevailing direction, neither of which is the default state of a retail participant at this point in the cycle.

In retrospect, the peak is the most informationally dense moment of the entire lifecycle. Almost every signal that an investigator will use to reconstruct the operation post hoc was already observable here. The challenge is not that the information was hidden; the challenge is that the framing through which the information was presented made it socially expensive to act on.

## 7. Phase 4 — Extraction

> **⚠ Note on this section.** Extraction is the moment of the rugpull itself. The mechanisms below are described at the level of typology, not implementation. No combination of parameters, addresses, contract signatures, or sequencing details that could be transposed by a bad-faith reader into an operational plan is provided. Forensic indicators useful for after-the-fact reconstruction are listed; operational instructions are not.

The extraction phase converts the value pooled by the community into liquid value held by the operator. The mechanics divide along two axes: the technical mechanism by which the value moves, and the communicative posture the operators adopt while it does.

### 7.1 Technical variants

> ⚠️ **Forensic intent only.** This section describes observable forensic indicators after deployment or during post-incident review. It is not a deployment guide, a parameter guide, or an implementation checklist. No code, value, signature, or operational sequence is provided.

The technical variants observed in the academic and investigative corpus fall into the four families introduced in §2 and detailed here.

**Hard liquidity withdrawal.** The most direct mechanism is the withdrawal of the liquidity-provider position from the decentralised exchange by the operator address that originally deposited it. The pool collapses, the token quote against the pair asset falls to zero in a single block, and trading becomes mechanically impossible. The on-chain signature is a single transaction (or a tight cluster) involving the liquidity-provider contract, the operator's address, and the withdrawal of the pair-side reserves into a routing path that has typically been pre-established. The transaction is visible immediately on any block explorer (Glossary #51).

**Progressive team selling.** A softer variant in which the team's allocations, often distributed across multiple addresses, are sold into the market in calibrated portions over a period ranging from days to several weeks. Each individual sale is small enough to absorb without crashing the price; the cumulative effect is a steady transfer of value from incoming buyers to outgoing team addresses. The on-chain signature is diffuse: a stream of transactions of moderate size, originating from addresses whose common ownership can sometimes be inferred from clustering heuristics (Glossary #53, #54) but is rarely undeniable from a single observation.

**Migration-vehicle extraction.** A communicative variant in which the operators announce a migration to a "v2 token", a "new contract", or a "new chain" and instruct holders to interact with a migration contract or front-end. The migration is the extraction vehicle: it absorbs the v1 tokens, the pair-side asset, or the holder's wallet approval, and routes value to the operator. The pattern is structurally close to a phishing campaign executed by the operators against their own community.

**Honeypot activation.** A variant in which the token contract, deployed in §4 with the necessary capabilities, has its parameters altered or its dormant restrictions activated such that transfers from non-operator addresses are blocked or routed back to the operator. Holders find themselves unable to sell. Combined with hard liquidity withdrawal or progressive selling on the operator side, the holder is doubly trapped: the price collapses, and the only address authorised to dispose of remaining liquid value is the operator. The pattern is documented in Mazorra et al. (2022) as one of the discriminators that a machine-learning classifier can use to label a contract ex ante.

A related but distinct variant is selective blacklisting, in which specific addresses (typically those identified by the operator as well-funded or unusually active sellers) are added to a contract-level blacklist that prevents them from transferring tokens, while the rest of the pool can continue to trade for the duration of the extraction.

### 7.2 Communicative variants

The technical extraction is rarely accompanied by candid communication. The dominant communicative postures observed across documented cases include:

- **Silence.** The most frequent posture. The operator team simply stops responding on all channels. The community is left to infer the rugpull from the on-chain state.
- **Denial then disappearance.** The operator team initially attributes the price collapse to "market manipulation", "a coordinated attack by a competitor", or "a technical bug to be fixed shortly". The denial buys a window of additional inflow (occasionally including from the same community attempting to "defend the price") before the operator disappears entirely.
- **Explicit announcement.** Rare. In a small number of documented cases, the operator has acknowledged the extraction publicly, often framed as a fait accompli with no contact channel for restitution.
- **Frame inversion.** A subset of cases in which the operator returns to the channels after the extraction to recast the event as the community's failure (insufficient buying pressure, lack of conviction, betrayal by specific named members). The discursive function is to displace responsibility and to seed enough confusion that recovery efforts are fragmented.

### 7.3 On-chain indicators

For after-the-fact reconstruction, the indicators most commonly used by investigators include: the drain timestamp and the block in which the extracting transaction was finalised; the path taken by the extracted value through subsequent addresses (frequently involving a peeling chain, Glossary #55, designed to fragment the trail); the use of cross-chain bridges (Glossary #30) to move the extracted value to a chain whose forensic tooling is less mature; and the presence or absence of mempool patterns indicating that the extraction was anticipated by external MEV bots (Glossary #25) that detected the operator's preparatory transactions and front-ran or back-ran them.

The methodology for collecting and structuring these indicators is the subject of *Investigation Checklist* §4 (on-chain identifier collection). For the vocabulary of post-hoc attribution, see Glossary #57 (taint analysis), #58 (heuristic vs deterministic attribution), and #43 (drainer) for the family of automated tools that have professionalised parts of the extraction step in recent years.

### 7.4 Temporal envelope

The extraction phase is short. In the hard variant it lasts seconds. In the migration-vehicle variant it can extend over the days during which holders are migrating. In the slow-rug variant, extraction blurs into a sustained activity that is difficult to date precisely. The temporal envelope is one of the inputs to the §11 discussion of why attribution remains probabilistic.

## 8. Phase 5 — Post-Mortem and Aftershocks

The aftermath of a rugpull unfolds in two layered timeframes: the immediate emotional response of the community in the hours after the extraction, and the longer process of investigation, attribution, and (rarely) recovery that can run for months or years.

**The community arc.** Within hours of the extraction, the chat channels that survive moderation pass through a recognisable sequence: an initial wave of disbelief and requests for confirmation ("is the contract paused? is this an explorer bug?"); a wave of anger directed at the operators, at influencers who promoted the project, and at vocal holders who are accused, often incorrectly, of having been complicit; a wave of bargaining in which proposals emerge to "buy back" the project, to mount a class action, or to negotiate directly with the operator team through any channel that remains active; and, finally, a wave of withdrawal in which most of the community simply stops engaging. The arc compresses Kübler-Ross's stages into a span of days. It is not unique to crypto, but the speed and the totality of the loss compress it more than in most other financial settings.

> **⚠ Note on secondary scams.** The post-rugpull window is itself a targeting environment. Within hours, a parallel ecosystem of "recovery services", "asset recovery lawyers", and "blockchain forensics consultants" routinely contacts victims through the same channels in which they have just expressed losses. The overwhelming majority of these outreach attempts, as documented across multiple law-enforcement public communications and consumer-protection advisories, are themselves fraudulent — designed to extract a second tranche of value from a population that has been preconditioned by the first loss to act under emotional pressure. The reader is referred to the *Dark Patterns* whitepaper §E.1 (impersonation stacking) for the general grammar of secondary-targeting fraud.

**Community-driven investigation.** A subset of the affected community typically attempts an investigation: aggregating screenshots of the operator team's posts, reconstructing the wallet topology from public block-explorer queries, comparing the project's narrative artefacts with prior artefacts to detect template reuse across rugpulls, and publishing the findings. The quality of community-driven investigation varies widely; in the better-documented cases it has produced reconstructions that meet a journalistic standard, in the worst it has produced misattributions that have caused secondary harm to innocent third parties. The *Investigation Checklist* §3 (evidence preservation) and §8 (methodological limits and red flags) cover the procedural minimum for this work to be useful rather than harmful.

**Journalistic and academic attention.** Coverage in specialist and general media depends on the magnitude of the loss, the prominence of the project, and the presence of identifiable secondary victims. The academic literature on the long tail of rugpulls (Cernera et al. 2023, on the population of token spammers) suggests that the great majority of cases receive no coverage at all and are recorded only in the on-chain ledger and in the aggregate statistics of chain-analysis firms.

**Judicial process.** The legal aftermath of a rugpull is structurally difficult. The operators are frequently pseudonymous, the value has frequently transited cross-border infrastructure, the jurisdictional anchoring of a decentralised exchange transaction is contested, and the criminal qualification of the act varies across legal systems (fraud, embezzlement, market manipulation, breach of fiduciary duty, or no qualification at all depending on whether the token was characterised as a security, a commodity, or a payment instrument under the local framework). The FATF Updated Guidance for VASPs (2021) and Europol's IOCTA annual reports document the state of the field. Successful prosecutions exist; they are a small minority of cases and typically involve either an operational mistake by the perpetrators (operational-security failure, custodial-exchange withdrawal under verified identity) or sustained multi-jurisdictional cooperation.

The honest summary is that the post-mortem phase produces information far more often than it produces restitution. Information has its own value — it is the substrate of the present document — but it should not be confused with recovery.

## 9. Consolidated Technical View

This section synthesises the lifecycle described above as a timeline and a set of phase-keyed observables. It is intended for the reader who wants a single page of reference; it adds no new content and is deliberately compressed.

**Timeline (rough envelope, days relative to launch T):**

- T − 30 to T − 7: preparation. Contract development, wallet setup, narrative artefacts, scaffolding of reputational signals.
- T − 7 to T − 1: pre-launch promotion. Whitelist signups, teaser content, coordination of launch-day participants.
- T 0: launch. Pool seeded, contract opened to public trading, first promotional wave.
- T 0 to T + 7: ascent. Coordinated promotion, secondary media pickup, engagement mechanics activated.
- T + 3 to T + 30 (variable): peak. Maximum price, maximum volume, narrative thinning begins.
- T + N: extraction. In the hard variant, a single block; in the soft variant, a stretched-out period that overlaps with the previous phase.
- T + N to T + 90: post-mortem. Community arc, secondary-scam targeting, community-driven investigation, occasional journalistic coverage, rare judicial follow-up.

**Phase-keyed on-chain observables:**

- Preparation: contract deployment from a fresh address; contract-feature inventory (mint, blacklist, fee-modify, ownership status); seeding of liquidity-provider position; pre-funding of team addresses.
- Launch: first-block buys from addresses with prior coordination markers; rapid pool reserve growth; sustained net inflow.
- Ascent: stable or increasing pool reserves; growing holder count; concentration of holdings in operator-linked addresses if clustering can be applied.
- Peak: maximum pool reserves; team-linked addresses begin preparatory transactions; cross-chain bridge utilisation appears.
- Extraction: liquidity-provider withdrawal transaction (hard); stream of team-address sales (soft); migration contract interaction (migration variant); contract-parameter alteration or blacklist trigger (honeypot variant); peeling-chain pattern on the receiving side.
- Post-mortem: dispersion across additional addresses; mixer or cross-chain bridge transit; consolidation into addresses interacting with centralised exchanges or fiat off-ramps.

**Phase-keyed off-chain observables:**

- Preparation: fresh creation dates on social channels, website, domain registration; template-reuse markers on the website.
- Launch: synchronised post timing across nominally independent accounts; engagement-to-follower ratios outside normal distributions; named partnerships with no reciprocal confirmation.
- Ascent: KOL endorsements appearing in waves; mid-tier influencer adoption; secondary-media coverage with shallow due diligence.
- Peak: thinning operator presence on operationally precise channels; latency increase on holder questions; postponements framed as "technical".
- Extraction: communication blackout; or denial-followed-by-disappearance; or rare explicit announcement.
- Post-mortem: emergence of "recovery" outreach; reconstruction efforts on independent forums; misattribution risk to third parties.

**Five questions for residual risk assessment of a still-active project:**

1. Is the liquidity provider position locked, and verifiably so, for a duration consistent with the announced roadmap?
2. Has ownership of the token contract been renounced, and if not, what specific capabilities (mint, blacklist, fee-modify, pause) does the owner retain?
3. What is the distribution of holdings across addresses, and what proportion of the supply is concentrated in addresses with clustering relationships to the deployer?
4. What is the verifiable history of the team — across prior projects, audited or attested identities, and operational footprints predating this specific project by a non-trivial interval?
5. Is the social presence around the project structurally healthy (organic engagement distribution, independent technical commentary, criticism that is responded to substantively) or structurally astroturfed (synchronised promotion, hostility to critical questions, opaque moderation)?

The five questions are descriptive, not exhaustive. A residual risk assessment is a probabilistic exercise; see §11.

## 10. Ex-Ante Risk Indicators

> **⚠ Note on this section.** The indicators below are descriptive markers visible to an investigator or a technically literate participant. They are not a checklist for "how not to be rugpulled": no such checklist is complete, because operators adapt their methods to whichever indicators are publicly known to be screened. The indicators are a structured vocabulary, not a defence.

The ex-ante indicators are organised by the layer at which they are observable.

**Code level.** The token contract, when published and verifiable against a known compiler output, can be inspected for the presence of features whose combination has historically correlated with rugpull behaviour: a mint function callable by an address other than a verifiably burnt one; a blacklist function; transfer fees whose rate is modifiable by an operator address; ownership retained rather than renounced; an absence of time-locks on parameter changes; an absence of a multisignature requirement on operator-privileged functions. The presence of any single feature is not damning; the combination of multiple unguarded features is informative. The literature on machine-learning detection of rugpulls ex ante (Mazorra et al. 2022; Cernera et al. 2023) uses precisely this feature space.

**Capital level.** The liquidity-provider position is the most consequential single artefact. Its size relative to the token's market capitalisation, the duration of any lock, the verifiability of the lock against a reputable lock contract, and the identity of the address holding it are all observable. Beyond the LP, the distribution of token holdings across addresses can be inspected: a high Gini coefficient, a small number of addresses controlling a large fraction of supply, and clustering relationships between top holders and the deployer all raise the probability that an exit by a small set of addresses can move the price catastrophically. Pre-sale or private-allocation arrangements, when present, can be inspected for opacity: a pre-sale whose participants are not disclosed, whose terms are not published, and whose vesting schedule cannot be verified on-chain is structurally different from one whose terms are public and on-chain.

**Team level.** The identity, history, and accountability surface of the operator team is the indicator most often discussed in the popular discourse and the most often misunderstood. A "doxx" (Glossary #50, in its inverse sense — verifiable identity rather than involuntary disclosure) is not a guarantee against fraud; it is a constraint on the operator's exit options. Verifiable identity, verifiable prior projects, public vesting schedules, and a track record of operational presence predating the project are informative. The absence of any of these is not proof of bad faith; the simultaneous absence of all of them is a structural signal.

**Social level.** The community around a project can be inspected for surface markers of organic versus manufactured engagement: the distribution of engagement across accounts (a healthy distribution has a long tail; an astroturfed one is concentrated in a small set of high-volume accounts); the ratio of engagement to follower count for the project's main channels (anomalously high or low ratios are informative); the presence of identifiable sockpuppet networks (clusters of accounts created in the same window, following overlapping sets, posting at correlated times); and the project's response to substantive critical questions (substantive engagement versus moderation, banning, or thread-derailment). The *Dark Patterns* whitepaper §B.1 (astroturfing and sockpuppets) and §E.1 (impersonation stacking) provides the underlying grammar.

The four layers compose. No single indicator is sufficient on its own; the conjunction of indicators across multiple layers raises the probability of an unfavourable outcome to a level at which a risk-averse participant would, by their own internal standards, decline to participate. The same conjunction does not constitute proof of intent; many projects with poor surface markers turn out to be honest-but-amateurish, and some projects with excellent surface markers turn out to be sophisticated frauds. The discussion of why this irreducible uncertainty matters belongs to §11.

For the cross-references most directly relevant to this section, see Glossary #36 (rugpull), #50 (impersonation), #61 (KOL), and #66 (influencer/shill).

## 11. Limits of This Document

The honesty of a typology document is measured by what it acknowledges it does not cover. Five limitations belong on the record.

**Typology versus reality.** The four sub-types in §2 (hard, soft, migration, slow) are presented as discrete categories. The reality is a continuum. Most documented cases display features of more than one sub-type — a project that begins as a slow rug can terminate with a hard withdrawal; a migration-vehicle scam often follows a period of soft selling. The categories are useful as analytic handles; they should not be reified into clean diagnostic boxes.

**Indistinguishability of failure and extraction in real time.** A subset of rugpulls is operationally indistinguishable in real time from honest projects that are failing for non-fraudulent reasons. Both produce a community that stops being responded to, a roadmap that stops being executed, a token whose price collapses. The distinguishing element is operator *intent*, which is not observable. The distinction can sometimes be reconstructed post hoc, often by combining on-chain evidence with off-chain admissions, but in the moment the two trajectories are not reliably separable. This is a difficulty for the participant and a constraint for the investigator.

**Probabilistic attribution.** Ex-post attribution of a rugpull to specific natural persons is rarely deterministic. It is built from a chain of inferences — wallet clustering, off-chain identifier correlation, operational-security failures by the operator, behavioural fingerprints in communication. Each link in the chain carries an error probability. The aggregate is a probabilistic assertion, not a forensic certainty, even in the cases that have led to successful prosecution. The investigator who treats a chain-analysis output as a deterministic identification will, sooner or later, attribute incorrectly. The *Investigation Checklist* §8 (methodological limits and red flags) discusses the operational implications.

**Boundary between intentional rugpull and abandonment by incompetence.** Legally and ethically, the distinction between an operator who extracted with prior intent and an operator who abandoned a project under personal pressure and converted the residual treasury for personal use carries significant weight. On-chain, the two can look identical. The legal qualification varies by jurisdiction and depends heavily on artefacts (internal communications, prior commitments, marketing claims) that may or may not be available to a public investigator. Documents like the present one cannot resolve the distinction; they can only signal that it exists.

**Evolving taxonomy.** The four sub-types presented here capture the dominant patterns of the period 2018-2025 in the public record. New variants have been documented in the more recent literature: pre-launch rugpulls in which the extraction occurs during a pre-sale or whitelist phase before any public trading; governance rugpulls in which the extraction is executed by an apparently decentralised governance vote whose participants are operator-controlled; cross-protocol rugpulls in which the extraction transits multiple smart contracts deployed for the purpose. The taxonomy will need to be revised. The present document is a snapshot, not a fixed framework.

The five limitations are not reasons to discount the typology; they are reasons to use it with the calibration it deserves.

## 12. Internal Glossary

This is a short list of the terms used most often in the present document. For the broader vocabulary, the reader is referred to the public *OSINT and Crypto Glossary* published alongside this paper, in which each of the following terms is cross-referenced by number.

- **Rugpull.** The abrupt or progressive withdrawal of value by operators from a pool funded by third-party participants on the implicit understanding of continued operation. See Glossary #36.
- **Hard rug.** Rugpull variant characterised by withdrawal of the liquidity-provider position in a single transaction or tight burst.
- **Soft rug.** Rugpull variant characterised by progressive selling of team allocations into the market over a period of days to weeks.
- **Honeypot.** A token contract whose transfer logic prevents holders other than the operator from selling. See Glossary #38.
- **Drainer.** Automated tooling that executes the extraction step of a campaign once activation conditions are met. See Glossary #43.
- **Peeling chain.** A pattern in which extracted value is moved through a sequence of addresses with each step removing a fraction, designed to fragment the trail. See Glossary #55.
- **LP (Liquidity Provider position).** The deposit of paired assets into a decentralised-exchange pool that enables trading and earns fees. See Glossary #26.
- **Locked LP.** A liquidity-provider position held in a lock contract that prevents withdrawal until a published date.
- **Vesting.** A schedule that releases token allocations to a recipient over time rather than at once.
- **Doxx.** A verifiable disclosure (voluntary or involuntary) of the identity behind a pseudonymous actor. See Glossary #7, #50.
- **Sockpuppet.** A secondary account operated by an actor who already has an identity, used to manufacture the appearance of independent voices. See Glossary #5.
- **Sniper bot.** An automated agent that monitors block production for the creation of a new liquidity pool and executes a buy in the first available transaction window. See Glossary #65.
- **MEV (Maximal Extractable Value).** Value extractable by reordering, inserting, or censoring transactions within a block. See Glossary #25.
- **Mint function.** A contract function that creates new tokens, increasing supply.
- **Blacklist.** A contract-level mechanism by which specific addresses can be prevented from transferring the token.

## 13. References

The references below are limited to works that the authors have read and can attest to. Items about which there is residual uncertainty have been omitted; a shorter list of confirmed references is preferable to a longer list with errors.

- Vasek, M. & Moore, T. (2015). *There's No Free Lunch, Even Using Bitcoin: Tracking the Popularity and Profits of Virtual Currency Scams.* Proceedings of Financial Cryptography and Data Security.
- Foley, S., Karlsen, J. R. & Putniņš, T. J. (2019). *Sex, Drugs, and Bitcoin: How Much Illegal Activity Is Financed Through Cryptocurrencies?* Review of Financial Studies, 32(5).
- Xu, J. & Livshits, B. (2019). *The Anatomy of a Cryptocurrency Pump-and-Dump Scheme.* USENIX Security Symposium.
- Mazorra, B., Adan, V. & Daza, V. (2022). *Do Not Rug on Me: Leveraging Machine Learning Techniques for Automated Scam Detection.* Mathematics, 10(6).
- Cernera, F., La Morgia, M., Mei, A. & Sassi, F. (2023). *Token Spammers, Rug Pulls, and Sniper Bots: An Analysis of the Ecosystem of Tokens in Ethereum and the Binance Smart Chain.* USENIX Security Symposium.
- Chainalysis. *Crypto Crime Report.* Annual editions (2023, 2024).
- Europol. *Internet Organised Crime Threat Assessment (IOCTA).* Annual editions.
- Financial Action Task Force. *Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers.* October 2021.
- Brignull, H. (2010). *Dark Patterns: dark side of design.* darkpatterns.org and subsequent writings.
- Mathur, A. et al. (2019). *Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites.* Proceedings of the ACM on Human-Computer Interaction, 3(CSCW).
- Mathur, A., Kshirsagar, M. & Mayer, J. (2021). *What Makes a Dark Pattern... Dark? Design Attributes, Normative Considerations, and Measurement Methods.* CHI Conference on Human Factors in Computing Systems.

For the dark-patterns literature in general, the regulatory references cited in the companion *Dark Patterns in Crypto* whitepaper (DSA Article 25, FTC *Bringing Dark Patterns to Light*, OECD working paper) remain applicable.

## 14. Disclaimer

This document is published for educational and research purposes under a Creative Commons Attribution-NonCommercial 4.0 International license. It is descriptive, not prescriptive. It does not constitute legal advice, financial advice, or operational guidance. It does not authorise, encourage, or facilitate the conduct it describes; the descriptive choices throughout the text were made specifically to prevent operational reuse. The authors have aggregated patterns from the public record and the academic literature; no specific project, person, exchange, or jurisdiction-bound investigation is named, and no inference about any specific real entity should be drawn from the typological descriptions provided.

The reader is responsible for the use they make of this material. Decisions about investment, participation, or counterparty selection in cryptocurrency markets remain the reader's own, made under their own diligence, and the authors decline any liability for losses or harms arising from reliance on the contents of this document.
