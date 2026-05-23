---
title: "OSINT, Crypto and Investigation Glossary"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-22"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["investigators", "researchers", "journalists", "students", "compliance-officers"]
abstract: "A reference glossary of 70 terms across three intersecting domains: open-source intelligence (OSINT), cryptocurrency and blockchain mechanics, and investigation methodology. Definitions are short, neutral, and source-aware. The glossary is designed to be used alongside the Dark Patterns whitepaper and the Investigation Checklist."
---

## Preface

This glossary collects seventy terms drawn from three overlapping fields: open-source intelligence (OSINT) as practised in investigative journalism and law-enforcement support, cryptocurrency and blockchain mechanics as encountered in retail fraud cases, and the investigation methodology that joins the two. It is designed to be used alongside the *Dark Patterns in Crypto* whitepaper and the *Investigation Checklist — Crypto Fraud Cases* playbook produced in the same series, which it cross-references throughout.

The selection criterion is operational: a term qualifies if a reader without subject-matter background is likely to encounter it in the course of triaging or reading a crypto-fraud casefile, in technical reporting on a token incident, or in correspondence with counsel or authorities. Specialist vocabulary that does not survive this filter has been omitted; specialist vocabulary that does is glossed rather than expanded.

Definitions are short by design. Each entry states the working definition, the domain (OSINT, Crypto, Fraud Pattern, On-Chain Analysis, or Ecosystem), related entries within the glossary, and where applicable a pointer to the section of the whitepaper or checklist where the term is used in context. Where a term is colloquial or contested, the entry says so explicitly; where a term names an attack technique, the entry describes the category without becoming a manual. Operational guidance belongs in the playbook, not the dictionary.

A complete alphabetical index follows the categories. References, addressed to readers who wish to consult primary sources, appear after the index. The disclaimer in the closing section applies to the document as a whole.

The glossary is descriptive and pedagogical. It does not provide legal advice, does not authorise any action that would itself be unlawful, and does not name any specific entity, project, or person.

---

## Category A — OSINT and Digital Investigation

### 1. OSINT (Open-Source Intelligence)

**Domain**: OSINT
**Related**: #2, #3, #11, #15
**See also**: Investigation Checklist §5 (Off-Chain Identifier Collection)

OSINT designates the structured collection and analysis of information drawn from publicly available sources, including websites, social networks, public registries, archives, and open data sets. The term originates in military and intelligence literature and is widely adopted in civilian investigative practice.

OSINT is defined by the public character of its sources, not by the legality of any particular method; not every public technique is itself lawful in every jurisdiction.

### 2. SOCMINT (Social Media Intelligence)

**Domain**: OSINT
**Related**: #1, #5, #6, #14
**See also**: Investigation Checklist §5.1

SOCMINT is the subset of OSINT focused on social-media platforms and their public content. It includes the analysis of accounts, posts, networks of interaction, and platform-specific metadata.

The boundary between SOCMINT and intrusive practice is platform-specific: content that is technically accessible may still be protected by platform terms of service or by data-protection law in the analyst's jurisdiction.

### 3. GEOINT (Geospatial Intelligence)

**Domain**: OSINT
**Related**: #1, #2
**See also**: Investigation Checklist §3 (Evidence Preservation)

GEOINT covers the collection and analysis of geographic information, including satellite imagery, mapping data, geotagged content, and location metadata embedded in photographs or social-media posts. In crypto investigation it appears chiefly when verifying claimed locations of teams, events, or infrastructure.

### 4. Pivot

**Domain**: OSINT
**Related**: #1, #9, #53
**See also**: Investigation Checklist §4.3 (Relationships between addresses)

A pivot is the use of a discovered identifier to find further related identifiers. Typical pivots include moving from a username to an email address, from an email address to a domain, or from a wallet address to a transaction counterparty. Successful investigation is usually a sequence of pivots, each documented in the casefile.

### 5. Sockpuppet

**Domain**: OSINT
**Related**: #6, #50, #66
**See also**: Dark Patterns Whitepaper §B.1 / Investigation Checklist §5.4

A sockpuppet is an online account operated by an actor distinct from the identity the account presents. Sockpuppets are used to manufacture apparent support, to harass under a fictitious identity, or to seed information whose true source the operator wishes to obscure.

The term is informal in origin but is widely used in academic literature on platform manipulation.

### 6. Astroturfing

**Domain**: OSINT
**Related**: #5, #66
**See also**: Dark Patterns Whitepaper §B.1 / Investigation Checklist §6.4

Astroturfing is the coordinated activity of multiple accounts, often sockpuppets, designed to manufacture the appearance of organic grassroots support for an idea, product, or project. The deception is structural: the audience infers a popular consensus from what is in fact a single actor or a small coordinated group.

### 7. Doxxing / Doxx

**Domain**: OSINT
**Related**: #1, #15
**See also**: Dark Patterns Whitepaper §E.2 / Investigation Checklist §5.2

Doxxing is the disclosure of personally identifying information about a person whose identity was previously private or pseudonymous. The term is most often used to describe disclosure for retributive or harassing purposes.

In an investigative context, documenting an identity in a casefile for legitimate handover to authorities is operationally distinct from doxxing in this popular sense; the two should not be conflated.

### 8. Plain sight / Hidden in plain sight

**Domain**: OSINT
**Related**: #1, #4
**See also**: Investigation Checklist §3.1

Plain sight designates evidence accessible without intrusion — public posts, public chains, public registries — that nevertheless requires deliberate collection to be useful. The companion expression *hidden in plain sight* describes material whose evidentiary value is overlooked because it appears mundane.

### 9. Attribution

**Domain**: OSINT
**Related**: #4, #53, #58
**See also**: Investigation Checklist §8.2

Attribution is the reasoned linkage of an action, an artefact, or an address to a specified actor. In practice attribution is always probabilistic: it ranks from weak (a single observable indicator) to strong (multiple independent indicators, each checkable). The casefile should label its attributions on this scale rather than asserting a certainty it has not earned.

### 10. Chain of custody

**Domain**: OSINT
**Related**: #11, #13
**See also**: Investigation Checklist §3.2

Chain of custody is the documented sequence of who possessed an item of evidence, when, and how, sufficient to demonstrate that the item has not been altered between collection and presentation. The concept is borrowed from forensic practice and applies equally to digital artefacts; a SHA-256 hash recorded at collection is the typical anchor.

### 11. Red team

**Domain**: OSINT
**Related**: #9, #12
**See also**: Investigation Checklist §8.1 (Confirmation bias)

A red team is a perspective in which an analyst deliberately attempts to disprove a working hypothesis. The discipline is the practical antidote to confirmation bias and produces a stronger casefile than partisan advocacy of an initial theory.

### 12. Threat model

**Domain**: OSINT
**Related**: #11, #15
**See also**: Investigation Checklist §5.2 (OSINT red line)

A threat model is an explicit description of who an investigator (or a victim) needs to defend against, what those actors are likely to do, and what costs the investigator is willing to bear to defend against them. In crypto investigation, threat-modelling guides the trade-off between operational security and analytic depth.

### 13. Indicator of Compromise (IOC)

**Domain**: OSINT
**Related**: #9, #10, #43, #44
**See also**: Investigation Checklist §3.3

An IOC is an observable artefact associated with malicious activity — an address, a domain, a file hash, a URL, a network indicator. IOCs are shareable across investigators when stripped of sensitive context and are central to threat-intelligence practice in security-operations centres.

### 14. Pretexting

**Domain**: OSINT
**Related**: #44, #45
**See also**: Investigation Checklist §5.2 (OSINT red line)

Pretexting is a social-engineering category in which an attacker assumes a fabricated identity or scenario in order to elicit information from a target. The term is included here as a category encountered in adversary analysis; it is named *in order to be recognised and avoided*, never as a method recommended to investigators. Pretexting against a third party is, in most jurisdictions, an offence.

### 15. Operational Security (OPSEC)

**Domain**: OSINT
**Related**: #12, #14
**See also**: Investigation Checklist §5.2

OPSEC is the practice of protecting non-public information about one's own operation from inference by adversaries. For investigators, OPSEC includes the segregation of investigative wallets from personal wallets, the use of disposable infrastructure for high-risk lookups, and the avoidance of public commentary on live cases.

---

## Category B — Crypto and Blockchain

### 16. Blockchain

**Domain**: Crypto
**Related**: #18, #34, #51
**See also**: Investigation Checklist §4 (On-Chain Identifier Collection)

A blockchain is a distributed, append-only ledger maintained by a network of nodes that agree on its state through a consensus mechanism. The data is organised into blocks linked by cryptographic hashes; the ledger's content, once finalised, is durable and publicly readable on most relevant networks.

### 17. EOA (Externally Owned Account)

**Domain**: Crypto
**Related**: #18, #22, #34
**See also**: Investigation Checklist §4.1

An EOA is a blockchain address controlled by a private key held outside the chain itself, as distinct from a smart-contract address whose behaviour is governed by deployed code. The distinction is essential to on-chain analysis: an EOA acts only when its owner signs, whereas a contract acts on the conditions written into it.

### 18. Smart contract

**Domain**: Crypto
**Related**: #16, #17, #19, #67
**See also**: Investigation Checklist §4.1

A smart contract is code deployed to a blockchain that executes deterministically when invoked by a transaction. Contracts can hold balances, call other contracts, and enforce arbitrary conditions on transfers, subject to the gas cost of computation.

### 19. Token / Token contract

**Domain**: Crypto
**Related**: #18, #20, #33
**See also**: Investigation Checklist §4.2

A token is a unit of value tracked by a token contract, distinct from the native currency of the underlying chain. A token contract is a smart contract that maintains balances for many addresses and exposes transfer functions; the balances are entries in the contract's state, not separate ledger objects.

### 20. ERC-20 / SPL / equivalents

**Domain**: Crypto
**Related**: #19, #33
**See also**: Investigation Checklist §4.2

ERC-20 is a token-contract interface standard on Ethereum and most EVM-compatible chains, defining a minimum set of functions (transfer, approve, balance queries). SPL is the Solana counterpart. Other ecosystems define their own conventions; the standards are interoperability scaffolding, not guarantees of trustworthiness.

### 21. Wallet

**Domain**: Crypto
**Related**: #17, #22
**See also**: Investigation Checklist §4.1

A wallet, in the common usage, is the combination of a user-facing application and the keys it manages. *Custodial* wallets are operated by a service that holds the keys; *non-custodial* wallets place the keys with the user. *Hot* wallets connect to the network during normal use; *cold* wallets stay offline except when signing. The choice affects both the user's exposure and the investigator's recovery options.

### 22. Private key / seed phrase

**Domain**: Crypto
**Related**: #17, #21, #43
**See also**: Investigation Checklist §2.2 (Not to do)

A private key is the cryptographic secret that authorises transactions from a given address. A seed phrase, typically a sequence of words, is a human-readable encoding of one or more private keys. Possession of either confers full control of the corresponding wallet.

Seed phrases must never be collected from victims beyond the strict minimum required and must never be stored in casefile material.

### 23. Gas / gas fee

**Domain**: Crypto
**Related**: #16, #18
**See also**: Investigation Checklist §4.1

Gas is the unit of computational cost on Ethereum and most EVM chains; the *gas fee* is the price paid for the gas consumed by a transaction. Other chains have different fee models, but the principle is similar: transactions pay for the computation and the storage they impose on the network.

### 24. Slippage

**Domain**: Crypto
**Related**: #26, #27, #41, #42
**See also**: Dark Patterns Whitepaper §C.2

Slippage is the difference between the price quoted for a swap and the price at which it actually executes. The user-set *slippage tolerance* is the maximum such difference the user authorises; a permission granted to the routing contract. High default slippage is a documented vector for value extraction.

### 25. MEV (Maximal Extractable Value)

**Domain**: Crypto
**Related**: #41, #42
**See also**: Investigation Checklist §8.3

MEV is the value that can be extracted by reordering, including, or excluding transactions within a block, beyond the standard transaction fee. MEV captures the economic effect of the fact that block proposers (and the searchers who supply them) have privileged power over transaction sequencing.

### 26. Liquidity Pool (LP)

**Domain**: Crypto
**Related**: #19, #27, #29, #36
**See also**: Investigation Checklist §4.4

A liquidity pool is a smart contract that holds a pair (or set) of assets and prices swaps against its reserves. Liquidity providers deposit assets and receive *LP tokens* representing a proportional claim on the pool, including the trading fees it accrues.

### 27. AMM (Automated Market Maker)

**Domain**: Crypto
**Related**: #26, #29
**See also**: Investigation Checklist §4.4

An AMM is a market-maker design that prices trades algorithmically against a liquidity pool, rather than by matching counterparties on an order book. The constant-product formula is the simplest variant; many extensions exist for concentrated liquidity and other specialisations.

### 28. CEX (Centralized Exchange)

**Domain**: Crypto
**Related**: #29
**See also**: Investigation Checklist §4.3

A CEX is a centralised platform that holds customer assets and matches trades on an order book under the platform's operational control. CEX deposit addresses are pivotal points in on-chain investigation because they sit at the boundary between the public chain and non-public customer information.

### 29. DEX (Decentralized Exchange)

**Domain**: Crypto
**Related**: #26, #27, #28
**See also**: Dark Patterns Whitepaper §C

A DEX is an exchange whose trading is executed by smart contracts on a public blockchain, typically against AMM pools, without a centralised operator holding customer assets. The user interacts directly with the protocol from their own wallet.

### 30. Bridge (cross-chain)

**Domain**: Crypto
**Related**: #33
**See also**: Investigation Checklist §4.3

A bridge is a protocol that allows assets or messages to move between blockchains. Bridges typically lock or burn assets on the source chain and mint or release them on the destination; their security depends on the integrity of the bridging protocol and the parties operating it.

### 31. Mixer / Tumbler

**Domain**: Crypto
**Related**: #30, #56, #57
**See also**: Investigation Checklist §4.3

A mixer (sometimes called a tumbler) is a protocol that pools deposits from many users and disburses funds to fresh addresses, intended to break the public linkage between source and destination. Several mixers have been the subject of regulatory action in major jurisdictions; the legal status of using or operating one varies.

### 32. Stablecoin

**Domain**: Crypto
**Related**: #19, #33
**See also**: Investigation Checklist §4.4

A stablecoin is a token whose value is designed to track a reference asset, most commonly the US dollar. Mechanisms vary: fiat-collateralised (held by an issuer), crypto-collateralised (over-collateralised in another asset), and algorithmic (maintained by protocol-level interventions of varying reliability).

### 33. Wrapped token

**Domain**: Crypto
**Related**: #19, #30
**See also**: Investigation Checklist §4.2

A wrapped token is a token on one chain that represents an asset native to another chain (or to a different standard on the same chain). The wrap-unwrap operation is usually performed by a bridge or by a designated custodian.

### 34. Block height / block number

**Domain**: Crypto
**Related**: #16, #51
**See also**: Investigation Checklist §3.3

Block height is the sequence number of a block within its chain, used as a stable, ordered identifier for the chain's state at a point in time. On chains that produce blocks at irregular intervals (notably Solana), the analogue is the *slot* or equivalent identifier.

### 35. txhash (transaction hash)

**Domain**: Crypto
**Related**: #10, #16, #51
**See also**: Investigation Checklist §3.3

A txhash is the unique identifier of a confirmed transaction on a blockchain, derived as a cryptographic hash of the transaction's serialised contents. In a casefile, the txhash is the minimum citation needed for a third party to retrieve and re-verify the underlying transaction.

---

## Category C — Crypto Fraud Patterns

### 36. Rugpull

**Domain**: Fraud Pattern
**Related**: #37, #26, #50
**See also**: Dark Patterns Whitepaper §D / Investigation Checklist §7.6 (C6 — Patterns detected)

A rugpull is a fraud scheme in which the founders or operators of a crypto project withdraw all liquidity or sell their token reserves shortly after promoting the project, leaving holders with valueless or untradable assets. Rugpulls typically combine on-chain liquidity removal with off-chain abandonment of communications and infrastructure.

The term is colloquial; legal qualification varies by jurisdiction (fraud, breach of fiduciary duty, market manipulation, or other).

### 37. Exit scam

**Domain**: Fraud Pattern
**Related**: #36, #50
**See also**: Dark Patterns Whitepaper §D.1

An exit scam is the broader category of fraud in which operators of a service raise funds (through a token sale, a yield product, or a hosted exchange) and then disappear with the deposited assets. Rugpulls are a subset; the term applies equally to non-tokenised crypto services.

### 38. Honeypot (token)

**Domain**: Fraud Pattern
**Related**: #19, #43
**See also**: Dark Patterns Whitepaper §C.4

A honeypot token is a token that admits inflows but blocks or punitively taxes outflows. The block may be implemented as a contract-level revert on the sell path, as a 100-percent sell-tax, or as a hidden cooldown; the user observes a successful buy and assumes symmetric exit liquidity that does not exist.

### 39. Pump and dump

**Domain**: Fraud Pattern
**Related**: #40, #50, #61
**See also**: Dark Patterns Whitepaper §A, §B

A pump-and-dump is a coordinated effort to inflate the price of an asset through promotional activity, then sell into the inflated demand. The mechanism predates crypto; on permissionless chains it is accelerated by the absence of listing controls and by the speed at which coordinated narratives propagate on social media.

### 40. Wash trading

**Domain**: Fraud Pattern
**Related**: #39, #58
**See also**: Investigation Checklist §8.3

Wash trading is the practice of trading between accounts controlled by the same actor in order to manufacture apparent volume or price. Detection on-chain relies on heuristic clustering and on patterns inconsistent with arms-length trading; on-chain volume figures that include wash trades systematically overstate genuine economic activity.

### 41. Front-running

**Domain**: Fraud Pattern
**Related**: #25, #42
**See also**: Dark Patterns Whitepaper §C.2

Front-running is the practice of observing a pending transaction (typically in a public mempool) and submitting a transaction that benefits from the anticipated execution of the observed one. In permissionless networks, front-running is one of the principal channels of MEV extraction.

### 42. Sandwich attack

**Domain**: Fraud Pattern
**Related**: #24, #25, #41
**See also**: Dark Patterns Whitepaper §C.2

A sandwich attack is a specific MEV technique in which an attacker places a buy order immediately before, and a sell order immediately after, a victim's swap, profiting from the price impact the victim's swap creates. High default slippage tolerance is a contributing factor.

### 43. Drainer

**Domain**: Fraud Pattern
**Related**: #22, #49
**See also**: Dark Patterns Whitepaper §C.1

A drainer is a category of malicious smart contract or script that, once authorised by a victim signature, transfers value out of the victim's wallet. Drainers are most commonly delivered via phishing sites that mimic legitimate front-ends; the user signs an approval or a transfer believing they are interacting with a familiar protocol.

### 44. Phishing (crypto-specific)

**Domain**: Fraud Pattern
**Related**: #13, #43, #50
**See also**: Dark Patterns Whitepaper §E.1

Crypto phishing is the use of deceptive websites, messages, or impersonation to induce a user to sign a malicious transaction or to disclose a seed phrase. The medium of harm — an irreversible blockchain transaction — makes the consequences more severe than in conventional consumer phishing.

### 45. SIM swap

**Domain**: Fraud Pattern
**Related**: #14, #44
**See also**: Investigation Checklist §5.2

A SIM swap is an attack in which an actor causes a mobile-network operator to transfer a victim's phone number to a SIM the actor controls, defeating any two-factor authentication that relies on SMS. The term is included here for recognition; this glossary does not document operational method. Investigators do not deploy SIM-swap techniques.

### 46. Sybil attack

**Domain**: Fraud Pattern
**Related**: #5, #6
**See also**: Investigation Checklist §6.4

A Sybil attack is an attack on a system in which a single actor controls many distinct identities to gain disproportionate influence — over a vote, an airdrop allocation, a reputation metric, or a social-media perception. The term originates in distributed-systems research and is widely used in crypto contexts.

### 47. Dusting attack

**Domain**: Fraud Pattern
**Related**: #53, #55
**See also**: Investigation Checklist §4.3

A dusting attack is the transfer of a trivial amount of token to many addresses, typically with the intent of tracking subsequent movements to deanonymise the recipients, or of seeding a downstream phishing attempt against them. Recipients of dust should not interact with the resulting tokens.

### 48. Address poisoning

**Domain**: Fraud Pattern
**Related**: #35, #44
**See also**: Investigation Checklist §3.3

Address poisoning is the use of an address visually similar to a target's recent counterparty, sent in a low-value transaction, in the hope that the target will later copy the poisoned address from their transaction history and send funds to the attacker. Defences rely on full-address comparison rather than on truncated displays.

### 49. Approval exploit

**Domain**: Fraud Pattern
**Related**: #20, #43
**See also**: Dark Patterns Whitepaper §C.1

An approval exploit is the abuse of an ERC-20 (or analogous) approval that a user has previously granted to a contract, when that contract is subsequently malicious or compromised. Unlimited approvals are the most damaging variant; a single granted approval can be drained at any time until revoked.

### 50. Impersonation (token / brand)

**Domain**: Fraud Pattern
**Related**: #5, #36, #44
**See also**: Dark Patterns Whitepaper §E.1

Impersonation in the crypto context covers tokens that mimic the name or branding of a legitimate project, front-ends that mimic a legitimate site, and accounts that mimic a legitimate team. The user is invited to confuse the impersonator with the original; the consequences range from worthless tokens to direct theft via phishing.

---

## Category D — On-Chain Analysis

### 51. Block explorer

**Domain**: On-Chain Analysis
**Related**: #16, #34, #35
**See also**: Investigation Checklist §4.5

A block explorer is a website or application that exposes the contents of a blockchain in a human-readable form: transactions, addresses, contracts, blocks. Block explorers are primary tools for individual lookups; their labels are unaudited and should be treated with caution in casework. Investigators should refer to *block explorers* generically rather than to any specific commercial product.

### 52. Chain analysis

**Domain**: On-Chain Analysis
**Related**: #53, #57, #58
**See also**: Investigation Checklist §4.5

Chain analysis is the structured study of blockchain transaction graphs, including the clustering of addresses into entities and the tracing of flows. The discipline combines deterministic queries (what is on-chain) with heuristics (what is likely true about entities), the latter requiring careful labelling.

### 53. Clustering (heuristic)

**Domain**: On-Chain Analysis
**Related**: #52, #54, #58
**See also**: Investigation Checklist §4.3

Clustering is the grouping of addresses believed to be controlled by the same entity, on the basis of observable behaviour. Common heuristics include the common-input heuristic (see #54), shared change addresses, and coordinated funding. Heuristic clusters are working hypotheses, not facts.

### 54. Common-input heuristic

**Domain**: On-Chain Analysis
**Related**: #53
**See also**: Investigation Checklist §4.3

The common-input heuristic, originally formulated for UTXO-based chains, holds that if multiple addresses are used as inputs to the same transaction, they are likely controlled by the same actor. The heuristic is approximate; CoinJoin and similar mixing protocols are deliberate counter-examples.

### 55. Peeling chain

**Domain**: On-Chain Analysis
**Related**: #31, #56
**See also**: Investigation Checklist §4.3

A peeling chain is a pattern of successive transfers in which an address sends most of its balance to a fresh address and a small remainder to another address, repeated. The pattern is associated with obfuscation of large flows and with consolidation of proceeds; the small "peels" may eventually reach a cashing-out point.

### 56. Mixing / unmixing

**Domain**: On-Chain Analysis
**Related**: #31, #55, #57
**See also**: Investigation Checklist §4.3

Mixing is the use of a mixer or analogous protocol to obscure source-destination linkage. *Unmixing* designates the analytic effort to defeat mixing through timing analysis, amount matching, and behavioural fingerprinting. Unmixing is rarely deterministic; conclusions should be expressed with appropriate uncertainty.

### 57. Taint analysis

**Domain**: On-Chain Analysis
**Related**: #52, #56
**See also**: Investigation Checklist §4.3

Taint analysis is the propagation of a label (e.g. "stolen") through the transaction graph from a known source. Methodologies vary: poison-style taint marks everything reachable, while haircut or first-in-first-out approaches distribute the taint proportionally. The choice of methodology materially affects the conclusions and must be disclosed.

### 58. Heuristic vs deterministic attribution

**Domain**: On-Chain Analysis
**Related**: #9, #52, #53
**See also**: Investigation Checklist §8.2

A *deterministic* attribution rests on facts derivable directly from on-chain data (e.g., this address signed this transaction). A *heuristic* attribution rests on a probabilistic inference (e.g., this address is part of a cluster owned by entity X). Conflating the two is among the most common methodological errors in retail-facing chain analysis.

### 59. Address label / tag

**Domain**: On-Chain Analysis
**Related**: #51, #52
**See also**: Investigation Checklist §4.1

An address label (or tag) is human-readable metadata associated with an address — for instance, an exchange name or a known scammer flag. Labels are produced by block explorers, by chain-analysis platforms, and by community lists. They are useful as leads and dangerous as conclusions; the source and date of a label should always be recorded.

### 60. Liquidity sniping

**Domain**: On-Chain Analysis
**Related**: #26, #41, #65
**See also**: Dark Patterns Whitepaper §C.1

Liquidity sniping is the use of automated bots to detect newly added liquidity for a token and to execute a buy in the same block (or as early as possible thereafter), profiting from the typical post-launch price discovery. Snipers may be operated by the launching team themselves, which converts the practice into a form of pre-arranged front-running of retail buyers.

---

## Category E — Actors and Ecosystem

### 61. KOL (Key Opinion Leader)

**Domain**: Ecosystem
**Related**: #6, #39, #66
**See also**: Dark Patterns Whitepaper §B.2

A KOL is an account with substantial reach whose endorsements influence followers. In crypto, KOL economics include paid placements, allocation grants, and direct equity in promoted projects; disclosure obligations vary by jurisdiction and are inconsistently observed in practice.

### 62. Retail investor

**Domain**: Ecosystem
**Related**: #63, #64
**See also**: Dark Patterns Whitepaper §2.2

A retail investor, in this context, is a non-professional individual participant in crypto markets, as distinct from institutional participants. The retail population is the target of most consumer-protection frameworks and of most of the manipulation patterns documented in the whitepaper.

### 63. Whale

**Domain**: Ecosystem
**Related**: #62, #64
**See also**: Investigation Checklist §4.1

A whale is a holder of a large position in a given token or chain, sufficient to move price or to dominate governance votes through their actions. The term is colloquial and threshold-dependent: "large" varies with the asset.

### 64. Market maker (legit vs adversarial)

**Domain**: Ecosystem
**Related**: #27, #40, #65
**See also**: Dark Patterns Whitepaper §C

A market maker is a participant that provides bid and ask liquidity on a market, profiting from the spread and from balance-management strategies. Legitimate market making is contracted and disclosed; adversarial market making, in retail contexts, may include coordinated wash trading or pre-arranged price support designed to attract victims.

### 65. Bot / sniper bot

**Domain**: Ecosystem
**Related**: #60, #41
**See also**: Dark Patterns Whitepaper §C.1

A bot is any automated script that executes on-chain or off-chain actions without per-action human input. A *sniper bot* is the specific case of a bot designed to act at the first opportunity in a target event — for instance, buying a token in the same block as its first liquidity addition.

### 66. Influencer / shill

**Domain**: Ecosystem
**Related**: #6, #39, #61
**See also**: Dark Patterns Whitepaper §B.2

An influencer is, in the broad sense, any account whose endorsements move attention. *Shill* is a pejorative subset designating an account paid or otherwise compensated to promote a project without disclosure; the term is colloquial but widely used in the field.

### 67. Auditor (smart contract audit)

**Domain**: Ecosystem
**Related**: #18, #68
**See also**: Dark Patterns Whitepaper §D.3

A smart-contract auditor is an entity (typically a firm) commissioned to review the code of a deployed or to-be-deployed contract for vulnerabilities and design issues. Audit reports are not insurance; their scope is bounded, their conclusions are versioned to a specific bytecode, and post-audit modifications are common.

### 68. Bug bounty

**Domain**: Ecosystem
**Related**: #67, #69
**See also**: Investigation Checklist §9.1

A bug bounty is a programme through which a project rewards external researchers for the responsible disclosure of vulnerabilities. Bug-bounty platforms structure the relationship between researcher and project, including scope, payment, and confidentiality.

### 69. White hat / grey hat / black hat

**Domain**: Ecosystem
**Related**: #11, #68
**See also**: Investigation Checklist §5.2

The terms designate a spectrum of security-practitioner ethics: a *white hat* discloses vulnerabilities through legitimate channels; a *black hat* exploits them for personal gain; a *grey hat* operates between the two, sometimes disclosing but sometimes acting unilaterally on findings. The labels are informal and contested.

### 70. Self-regulatory organization (SRO)

**Domain**: Ecosystem
**Related**: #62, #67
**See also**: Investigation Checklist §9.1

A self-regulatory organisation is an industry body that issues standards binding on its members, in place of or in addition to public regulation. In crypto contexts, SROs are nascent and their authority is contested; their existence is mentioned where they are an addressable interlocutor, not where they substitute for statutory authority.

---

## Alphabetical Index

- Address label / tag — #59
- Address poisoning — #48
- AMM (Automated Market Maker) — #27
- Approval exploit — #49
- Astroturfing — #6
- Attribution — #9
- Auditor (smart contract audit) — #67
- Block explorer — #51
- Block height / block number — #34
- Blockchain — #16
- Bot / sniper bot — #65
- Bridge (cross-chain) — #30
- Bug bounty — #68
- CEX (Centralized Exchange) — #28
- Chain analysis — #52
- Chain of custody — #10
- Clustering (heuristic) — #53
- Common-input heuristic — #54
- DEX (Decentralized Exchange) — #29
- Doxxing / Doxx — #7
- Drainer — #43
- Dusting attack — #47
- EOA (Externally Owned Account) — #17
- ERC-20 / SPL / equivalents — #20
- Exit scam — #37
- Front-running — #41
- Gas / gas fee — #23
- GEOINT (Geospatial Intelligence) — #3
- Heuristic vs deterministic attribution — #58
- Honeypot (token) — #38
- Impersonation (token / brand) — #50
- Indicator of Compromise (IOC) — #13
- Influencer / shill — #66
- KOL (Key Opinion Leader) — #61
- Liquidity Pool (LP) — #26
- Liquidity sniping — #60
- Market maker — #64
- MEV (Maximal Extractable Value) — #25
- Mixer / Tumbler — #31
- Mixing / unmixing — #56
- OPSEC (Operational Security) — #15
- OSINT (Open-Source Intelligence) — #1
- Peeling chain — #55
- Phishing (crypto-specific) — #44
- Pivot — #4
- Plain sight / Hidden in plain sight — #8
- Pretexting — #14
- Private key / seed phrase — #22
- Pump and dump — #39
- Red team — #11
- Retail investor — #62
- Rugpull — #36
- Sandwich attack — #42
- Self-regulatory organization (SRO) — #70
- SIM swap — #45
- Slippage — #24
- Smart contract — #18
- SOCMINT (Social Media Intelligence) — #2
- Sockpuppet — #5
- Stablecoin — #32
- Sybil attack — #46
- Taint analysis — #57
- Threat model — #12
- Token / Token contract — #19
- txhash (transaction hash) — #35
- Wallet — #21
- Wash trading — #40
- Whale — #63
- White hat / grey hat / black hat — #69
- Wrapped token — #33

---

## References

The following sources informed several of the definitions above. Readers are encouraged to consult primary materials directly; institutional publications are located by issuer rather than by URL, since URLs are unstable.

1. European Union Agency for Cybersecurity (ENISA). *Threat Landscape* reports, annual editions. ENISA.
2. Europol. *Internet Organised Crime Threat Assessment (IOCTA)*, annual editions. Europol Publications.
3. Financial Action Task Force. (2021). *Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers*. FATF.
4. National Institute of Standards and Technology. (Various dates). *Glossary of Key Information Security Terms* (NIST IR 7298). NIST.
5. International Organization for Standardization. *ISO/IEC 27000* (current edition). Definitions of information-security terms used in this glossary's OPSEC, IOC, and chain-of-custody entries.
6. Möser, M., Böhme, R., & Breuker, D. (2013). *An Inquiry into Money Laundering Tools in the Bitcoin Ecosystem*. eCrime Researchers Summit. Foundational on mixing and unmixing.
7. Meiklejohn, S., Pomarole, M., Jordan, G., Levchenko, K., McCoy, D., Voelker, G. M., & Savage, S. (2013). *A Fistful of Bitcoins: Characterizing Payments Among Men with No Names*. ACM Internet Measurement Conference. Foundational on the common-input heuristic.

---

## Disclaimer

This document is educational. It describes a vocabulary and does not name any specific entity, project, person, or case. It is not legal advice, does not authorise any action that would be unlawful in the reader's jurisdiction, and does not substitute for the institutional procedures of any authority.

Several entries refer to techniques associated with criminal conduct (notably entries on phishing, drainers, SIM swap, pretexting, and impersonation). Such entries are descriptive of the category, not operational instructions for it; investigators do not deploy these techniques, and reading this glossary confers no authorisation to do so.

The legal qualification of the patterns named in Category C varies by jurisdiction. References to fraud, market manipulation, and related categories are summary in nature and are not a substitute for advice from counsel qualified in the relevant jurisdiction.

INTERLIGENS Research, 2026. Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). Permitted to be redistributed and adapted for non-commercial purposes with attribution.
