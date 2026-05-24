---
title: "Crypto for Investigators — A 10-Lesson Course"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-23"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["beginner-investigators", "students", "journalists", "compliance-trainees", "self-taught-researchers"]
duration: "Approximately 10 hours of study, plus practice"
prerequisites: "Basic familiarity with the internet and with reading English. No prior cryptocurrency knowledge required."
abstract: "A structured 10-lesson course designed to take a beginner from zero crypto knowledge to the ability to read a basic on-chain investigation. Each lesson is self-contained, builds on the previous one, and cross-references the INTERLIGENS Research corpus (Dark Patterns Whitepaper, Investigation Checklist, OSINT-Crypto Glossary, Anonymized Case Studies, Anatomy of a Rugpull). The course is descriptive and methodological, never operational for offensive use."
---

## Preface

This course is written for readers who have never opened a wallet, never read a blockchain explorer, and who nevertheless expect to encounter a crypto-related case in their professional or academic work. The audiences are beginner investigators in financial-crime units or civilian collectives; students of journalism, law, or criminology; compliance trainees; and self-taught researchers wanting an ordered framework.

After ten lessons and the exercises, a reader should be able to read a transaction on a generic block explorer, recognise the typical structural patterns of crypto retail fraud, assemble a basic casefile, and articulate the legal and ethical limits within which civilian investigation operates.

The course does not teach offensive technique. Every exercise asks what the reader would *look for* and *how they would reason*, never *how they would act* against a target. Where a lesson touches a sensitive area, the relevant safety constraints are stated in the body, repeated in a marked box, and revisited in the exercises.

The lessons are intended to be read in order, since each builds vocabulary used in the next. A reasonable cadence is one lesson per study session of roughly an hour, with the exercises attempted in writing before consulting Appendix D.

The course is the seventh document in a coordinated educational corpus. The taxonomical material lives in the *Dark Patterns in Crypto* whitepaper, the operational sequence in the *Investigation Checklist* playbook, the reference vocabulary in the *OSINT, Crypto and Investigation Glossary*, worked examples in the *Anonymized Case Studies*, a focused deep dive in the *Anatomy of a Rugpull* whitepaper. An internal procedural manual exists separately for INTERLIGENS beta testers and is not covered here.

Two methodological commitments hold throughout. First, attribution is probabilistic; investigators do not assert what they cannot demonstrate. Second, the legal envelope of OSINT and of public commentary is narrower than its technical envelope; what a reader *can* do is not what they *may* do.

This document is educational. It is not legal advice, does not authorise any action that would be unlawful, and relies exclusively on public sources.

## How this course is structured

Each lesson follows the same internal structure. **Learning Objectives** state three to five outcomes. **Prerequisites** list the prior lessons assumed. The **Content** section is the body, between seven hundred and thirteen hundred words. A **Key Concepts** box lists five to eight terms with pointers to the *OSINT-Crypto Glossary*. **Descriptive Examples** illustrate the lesson without naming any real project, address, or person. **Conceptual Exercises** pose three to five methodological questions, with answers in Appendix D. **Further Reading** cross-references the corpus; no commercial product is named on principle. A short **Recap** closes the lesson.

Four appendices follow: a six-week reading plan (A), further reading (B), a flash glossary (C), and answers to the exercises (D).

---

## Lesson 1 — What is a blockchain?

### Learning objectives

- Define a blockchain in terms a non-specialist can repeat.
- Distinguish a blockchain from a conventional database in three precise ways.
- Name the principal blockchain families an investigator is likely to encounter.
- State the consequence of public, pseudonymous, immutable ledgers for investigation.

### Prerequisites

None.

### Content

A blockchain is a distributed, append-only ledger maintained by a network of computers that agree on its contents through a defined consensus procedure. The data is grouped into *blocks*; each block carries a cryptographic reference to the previous one, and altering an old block would invalidate every block that follows. Most blockchains relevant to retail-facing fraud are *public* and *permissionless*: anyone may read the ledger, and anyone may submit a transaction subject to paying the network's fee.

The contrast with a conventional database is instructive. A conventional database has an owner who can edit or restore its rows; a public blockchain has no such owner. A conventional database is queried only by authorised parties; a public blockchain may be read by anyone. A conventional database trusts the operator; a public blockchain replaces operator trust with cryptographic verification and economic incentives applied to many independent participants. These differences are why on-chain history is hard to falsify once recorded.

A few core concepts underpin the picture. A *transaction* is an instruction issued by an address — transfer value, call a function on a contract, deploy new code. A *block* is a bundle of transactions accepted as the next entry in the ledger. *Consensus* is the procedure by which competing candidate blocks are reconciled into a single canonical chain. A *node* is any computer running the chain's software.

Three families dominate retail-fraud casework. Bitcoin uses a *UTXO* (unspent-transaction-output) accounting model. Ethereum and the *EVM-compatible* chains — including most L2 networks — use an *account* model and support arbitrary computation through smart contracts. Solana also uses an account model, with a distinct performance profile. For this course the difference between the EVM family and Solana matters more than any third option.

The investigative consequence is direct. Everything on a public blockchain is public: every transfer, deployment, approval, swap is readable by anyone. At the same time, the ledger is *pseudonymous*: addresses are not identities. Linking an address to a person, a team, or a company requires off-chain evidence and is generally probabilistic. Public actions, pseudonymous actors — that combination defines both the opportunity and the limit of on-chain investigation.

Blockchains are durable but the *interpretations* placed on their content are not. A "scam" label on an explorer may be a sound community consensus, a mistake, or stale. The chain records what happened; what the action *meant* is a question the investigator must reason about.

### Key concepts

- Blockchain (Glossary #16)
- Block height (Glossary #34)
- txhash (Glossary #35)
- Block explorer (Glossary #51)
- Smart contract (Glossary #18)
- EOA (Glossary #17)

### Descriptive examples

A team launches a token on an EVM-compatible chain. The deployment transaction is a single entry on the public ledger, retrievable later by its txhash. Months later, when retail holders complain the project has gone silent, the same transaction is still on the ledger.

A different team prefers a chain whose explorer surfaces internal transactions less prominently. The action is the same; the surface a retail observer sees is shaped by the explorer.

### Conceptual exercises

1. In one sentence, explain to a non-technical colleague the practical difference between a public blockchain and a database their bank maintains.
2. An investigator says, "the chain proves the founder stole the funds". Identify what the chain can prove and what it cannot.
3. Given that on-chain data is permanent, what does it mean for a casefile to be "outdated"?

### Further reading

- *OSINT-Crypto Glossary* §B (entries #16 through #20).
- *Investigation Checklist* §4 (On-Chain Identifier Collection), as orientation.
- *Dark Patterns in Crypto*, Preface — for context on why public chains attract the patterns this course will catalogue.

### Recap

A blockchain is a public, append-only ledger maintained by independent computers. Its contents are durable and readable by anyone, but the actors are pseudonymous. The investigator inherits an unprecedented public record and an enduring attribution problem in the same gesture.

---

## Lesson 2 — Wallets, addresses, and keys

### Learning objectives

- Distinguish an externally owned account (EOA) from a smart-contract address.
- Distinguish custodial, non-custodial, hot, and cold wallets in functional terms.
- Explain the relationship between private key, seed phrase, and address.
- State, without ambiguity, the rule against requesting or storing victim secrets.

### Prerequisites

Lesson 1.

### Content

A *wallet* is the combination of an application a user interacts with and the cryptographic keys it manages. The colloquial usage blurs three distinct objects: the *application*, the *keys*, and the *address*.

A *private key* is a long random number whose possession authorises transactions from a specific address. A *seed phrase* is a human-readable encoding of one or more private keys, typically twelve or twenty-four words drawn from a standardised wordlist. Possession of the seed phrase is functionally equivalent to possession of every private key it encodes. A *public key* is derived from the private key by a one-way operation; the *address* is in turn derived from the public key. The flow is asymmetric: easy from private key to address, infeasible in reverse. This asymmetry is the foundation of the system.

Addresses come in two kinds. An *externally owned account* (EOA) is controlled by a private key held outside the chain; it acts only when its owner signs. A *smart-contract address* is governed by deployed code; the contract acts on conditions written into it. The distinction matters because investigators sometimes encounter the claim that "the address moved the funds". If the address is an EOA, *someone with the private key* moved them; if a contract, *the rules in the contract* did, possibly with no human action at the moment of movement. Confusing the two weakens attribution.

Wallets are described along two axes. The *custodial* axis distinguishes wallets where a third party holds the keys, from *non-custodial* wallets where the user does. The *temperature* axis distinguishes *hot* wallets, on internet-connected devices, from *cold* wallets, offline. Real users mix the combinations.

What an investigator can see differs across these combinations. For a custodial wallet at a regulated exchange, identity information sits with the exchange and is reachable only through proper channels. For a non-custodial wallet, no third party holds identity information; investigation proceeds by on-chain analysis and by off-chain OSINT against whatever public surface the owner has exposed.

> **⚠ Safety box.** An investigator never asks a victim, a witness, or any third party for their seed phrase, their private key, or any equivalent secret. No legitimate analytical purpose requires such material; every request is, at best, malpractice and in most jurisdictions a criminal act. A "recovery service" demanding these is the next attacker, not the help. This rule has no exceptions. Casefile material must not contain a seed phrase or private key, even if a victim offers one voluntarily.

The pseudonymity of the public blockchain is asymmetric in time. At the moment of action, an address is anonymous; over time, it may sign other transactions, interact with services that hold identity information, or post itself publicly on social media — each interaction an opportunity for attribution. Investigators do not break pseudonymity by force; they accumulate observations until pseudonymity ceases to hold.

### Key concepts

- EOA (Glossary #17)
- Smart contract (Glossary #18)
- Wallet (Glossary #21)
- Private key / seed phrase (Glossary #22)
- Pivot (Glossary #4)
- Attribution (Glossary #9)

### Descriptive examples

A retail victim reports that "their wallet was drained". On inspection, the source address is an EOA; therefore someone signed the transaction. The question is no longer *how the chain moved the funds* but *how the signature was produced*.

A different report describes the same outcome but the source address is a contract holding the victim's deposits. The chain did move the funds, under the contract's conditions. The investigation turns on the contract code, on who controls its parameters, and on whether the conditions executed were those advertised.

### Conceptual exercises

1. A casefile note reads, "the founder's wallet emptied the treasury". Identify the missing information that prevents this from being a complete claim.
2. List three observable signals that distinguish a custodial wallet from a non-custodial wallet for the purposes of investigation.
3. A would-be helper offers to "recover the lost funds" if the victim shares their seed phrase. State the correct response in one sentence and explain why.

### Further reading

- *OSINT-Crypto Glossary* entries #17, #18, #21, #22.
- *Investigation Checklist* §2.2 (Not to do) — the same rule against secret collection.
- *Investigation Checklist* §4.1 (Wallet addresses) — the operational treatment.

### Recap

A wallet is an application plus keys plus addresses. Private keys and seed phrases are secrets whose possession equals control; investigators never collect them. EOAs are signed by humans, contracts execute by code, and confusing the two weakens attribution. Pseudonymity erodes through observation over time.

---

## Lesson 3 — Tokens: ERC-20, SPL, and NFTs

### Learning objectives

- Distinguish a native asset from a token.
- Recognise the principal token standards encountered in retail casework.
- Identify, descriptively, the contract-level features that elevate fraud risk.
- State why most retail-facing fraud rides on token contracts rather than on native assets.

### Prerequisites

Lessons 1 and 2.

### Content

A *native asset* is the unit of value the underlying chain accounts for at the protocol level: ETH on Ethereum, BTC on Bitcoin, SOL on Solana. A *token* is a unit of value tracked by a contract deployed on the chain. Tokens are how the same chain hosts thousands of independent assets — stablecoins, governance tokens, project tokens, collectibles — each with its own contract, supply, and behaviour.

Two patterns of standardisation dominate. On EVM chains, *ERC-20* defines a minimum interface for fungible tokens: a balance per address, a transfer function, and an *approval* mechanism whereby a holder authorises a third party to spend up to a stated amount. *ERC-721* and *ERC-1155* define interfaces for NFTs and mixed collections. Solana's analogue is *SPL*. The standards are scaffolding for interoperability, not certifications of trustworthiness.

A token contract is a smart contract. Like any contract, it executes the code its deployer wrote. Three categories of feature attract the investigator's attention.

First, *minting capability*. A contract that retains an unlimited mint function, callable by an owner address, can dilute holders at any moment; large issuance immediately sold functions as an exit at the holders' expense. Investigators check whether the mint function is renounced or restricted, and whether the owner key has been moved to a multisignature wallet.

Second, *transfer restrictions*. Blacklists, whitelists, variable transfer taxes, or cooldown windows. Each is a legitimate primitive in some contexts and a fraud vector in others. The relevant questions are whether the restrictions are disclosed in public materials, whether they were present at deployment or added later, and whether they apply asymmetrically — holders can buy but cannot sell.

Third, *ownership and upgradeability*. An upgradeable contract whose owner key remains active can be rewritten at any time. The investigator looks for whether the contract uses an upgrade proxy, who controls the upgrade key, and whether the upgrade key has been moved to a multisig or renounced.

These features map onto specific fraud archetypes catalogued elsewhere in the corpus. A *honeypot* is a token whose contract reverts or punitively taxes sell transactions. An *approval exploit* abuses an approval the user previously granted to a contract that is subsequently malicious. An *impersonation token* duplicates the name or branding of a legitimate project. Each is a feature of a contract, readable in advance.

In retail-facing crypto fraud, the token contract is usually the proximate vehicle. Native assets appear at the boundary, but the asset that the victim was sold, and whose contract carries the malicious provisions, is typically a project token. A reader who can identify three or four risk features in a token contract has the working vocabulary needed to read most retail-fraud casefiles.

The lesson does not teach the reader to *deploy* such a contract. The risk features are described as objects the investigator reads.

### Key concepts

- Token / Token contract (Glossary #19)
- ERC-20 / SPL (Glossary #20)
- Honeypot (Glossary #38)
- Approval exploit (Glossary #49)
- Impersonation (Glossary #50)
- Smart contract (Glossary #18)

### Descriptive examples

A token contract is deployed with a public *renounce ownership* transaction in the first hours after launch. The investigator can verify on the chain that the owner address has been set to the zero address; the privileged functions are disabled.

A second token contract claims renouncement on its marketing site but the chain shows the owner address pointing to an active wallet. The discrepancy is itself a finding.

### Conceptual exercises

1. List three contract-level features whose presence raises the prior probability of harm to retail holders, and for each, the public observation that would settle the question.
2. A project advertises that "ownership has been renounced". Identify what an investigator would check before treating that claim as established.
3. Explain in two sentences why native-asset transfers alone rarely tell the full story of a retail-fraud case.

### Further reading

- *OSINT-Crypto Glossary* entries #19, #20, #38, #49, #50.
- *Anatomy of a Rugpull* §4 (Phase 1 — Preparation), where the token contract is the central artefact.
- *Investigation Checklist* §4.2 (Token contracts).

### Recap

A token is an entry in a contract's state. The contract's features — minting, transfer restrictions, upgradeability — are readable, and their interaction with the project's claims is where most retail-fraud signals first appear. Native assets sit at the edges; the token contract sits at the centre.

---

## Lesson 4 — DEX, AMM, and liquidity

### Learning objectives

- Distinguish a centralised exchange (CEX) from a decentralised exchange (DEX) in functional terms.
- Describe the intuition of an automated market maker (AMM) without algebraic detail.
- Define a liquidity pool, an LP token, and the act of "locking" liquidity.
- Connect each of the above to the mechanics of a liquidity-extraction fraud.

### Prerequisites

Lessons 1 through 3.

### Content

Trading in crypto happens on two architecturally distinct kinds of venue. A *centralised exchange* (CEX) is a service operated by a company that holds customer assets and matches trades on an internal order book. A *decentralised exchange* (DEX) is a system of smart contracts; the user interacts directly with those contracts from their own wallet. The two have different risk profiles, different evidence trails, and different points of contact for an investigator.

Most DEX activity is run by *automated market makers* (AMMs). An AMM replaces the order book with a *liquidity pool* — a contract holding a pair of assets, for instance the project token and a stablecoin. The contract prices a swap algorithmically against the pool's reserves: the *constant-product* formula keeps the product of the two reserves approximately the same across a trade. The investigator needs to understand the consequence: a trade against a small pool moves the price more than the same trade against a large pool, and the larger the trade as a fraction of the pool, the more the user pays in *slippage*.

A *liquidity provider* deposits both assets and receives *LP tokens* representing a proportional claim. To withdraw, the holder burns the LP tokens and receives back the underlying assets. That withdrawal is what a retail observer experiences as "liquidity being removed".

Two operational concepts close the picture. *Slippage tolerance* is a parameter the user sets: the maximum acceptable deviation from the quoted price. The *Dark Patterns* whitepaper treats high default slippage as an interface manipulation. *Locked liquidity* refers to sending LP tokens to a contract that prevents withdrawal for a stated period; the lock is publicly verifiable. Unlocked LP tokens held by the launching team can be redeemed at any time.

A *rugpull* is, mechanically, the redemption of LP tokens held by the launching team. The team withdraws the assets the retail buyers swapped in and the price collapses against the now-empty pool. The chain records each step in order; what is opaque is the identity of the redeemer. The investigator's task is rarely "did this happen" and almost always "who controlled the LP tokens".

The same vocabulary illuminates non-rugpull cases. *Liquidity sniping* depends on a bot observing the addition of liquidity in one block and submitting a buy in the same or next block; the sniper is sometimes operated by the launching team itself. A *sandwich attack* requires mempool transparency sufficient to observe a victim's swap and wrap it with the attacker's own buy-then-sell.

A methodological note: the investigator reads liquidity pools, does not interact with them during an investigation. Reading is free; trading creates new evidence the investigator will have to disentangle.

### Key concepts

- DEX (Glossary #29)
- CEX (Glossary #28)
- AMM (Glossary #27)
- Liquidity Pool (Glossary #26)
- Slippage (Glossary #24)
- Liquidity sniping (Glossary #60)
- Rugpull (Glossary #36)

### Descriptive examples

A team adds liquidity to a pool of their project token and a stablecoin; LP tokens are minted to the team's address. Three weeks later, the team's address burns the LP tokens and the stablecoin flows out. The two transactions are the on-chain signature of a liquidity withdrawal; whether the act constitutes fraud depends on what the team had promised in public materials.

In a different case, the LP tokens have been sent to a verifiable lock contract with a stated expiration date. The lock changes the risk profile materially; it does not, by itself, guarantee outcomes.

### Conceptual exercises

1. A retail report says, "the team rugged us". Translate this into an on-chain claim that can be confirmed or refuted from a block explorer.
2. List three observable facts about a liquidity pool that bear on the prior probability of an exit through liquidity removal.
3. Explain why the size of a swap relative to the pool reserves matters more than the absolute size of the swap.

### Further reading

- *OSINT-Crypto Glossary* entries #24, #26, #27, #28, #29, #36, #60.
- *Anatomy of a Rugpull* §4 through §7 (preparation, launch, peak, extraction).
- *Investigation Checklist* §4.4 (Liquidity-pool inspection).

### Recap

A DEX is a contract; a CEX is a company. An AMM prices swaps against a pool's reserves. LP tokens represent claims on the pool, and their custody decides who can pull liquidity. A rugpull is, mechanically, the redemption of LP tokens by the team. Investigators read these objects; they do not transact with them on a live case.

---

## Lesson 5 — The mempool, gas, and MEV

### Learning objectives

- Define the mempool and its role as the antechamber of transactions.
- Explain gas as the price of inclusion in a block.
- Describe MEV as the value extractable by reordering transactions.
- Recognise front-running, sandwich attacks, and sniping as concrete instances of MEV.

### Prerequisites

Lessons 1 through 4.

### Content

When a user signs a transaction, it is broadcast to the network and joins the *mempool* — the set of pending transactions waiting to be included in a block. On most public chains the mempool is, to a substantial degree, *visible*: third parties operating their own nodes can observe pending transactions before finalisation. This visibility is the surface on which several mempool-exploiting patterns operate.

*Gas* is the unit of computational cost on Ethereum and most EVM chains; the *gas fee* is the price paid for the gas the transaction consumes. Higher gas-price bids lead to faster inclusion; this is the lever by which an actor can purchase priority. Other chains have different fee models, but the principle is similar.

*MEV* — maximal extractable value — names the value an actor can extract by reordering, including, or excluding transactions within a block, beyond the standard fee. MEV depends on privileged sequencing power, either directly (a validator) or indirectly (a *searcher* who pays a validator for guaranteed sequencing).

Three patterns are particularly visible. *Front-running*: observing a pending transaction and submitting a transaction that benefits from its execution. The classical case is a swap large enough to move the price; a front-runner buys before the victim and sells after. *Sandwich attacks* are a specific implementation in which the same actor places both the leading buy and the trailing sell; high default slippage tolerances make the attack more profitable. *Liquidity sniping* uses bots to detect newly added liquidity and execute a buy in the same block; when the launching team operates the sniper, retail buyers become systematic counterparties of an internal operation.

The investigator does not, by default, intervene against MEV; the discipline is observational. Two narrower roles arise. First, certain dark-pattern designs *exploit* the visibility of the mempool to extract value (notably high-default-slippage interfaces); recognising the on-chain signature is a finding. Second, investigation activities — a high-value test transaction — can themselves be observed and front-run; hence disposable wallets and minimal predictable activity.

The intuition that the mempool is "secret" and the chain "public" is the wrong way round. The chain records what already happened; the mempool exposes what is about to happen. The casefile cites finalised state, not mempool snapshots, unless the snapshot has been independently preserved with chain-of-custody discipline.

### Key concepts

- Gas / gas fee (Glossary #23)
- MEV (Glossary #25)
- Front-running (Glossary #41)
- Sandwich attack (Glossary #42)
- Slippage (Glossary #24)
- Liquidity sniping (Glossary #60)

### Descriptive examples

A retail user submits a large swap against a thin pool with default slippage. A searcher observes the pending transaction, submits a buy ahead of it, lets the victim's swap execute at a worse price, and submits a sell behind it. The transactions are visible after inclusion; the adversarial relationship is inferred from sequencing and address relationships, not from any label.

A launching team operates an internal sniper. In the same block as the team's liquidity-add transaction, the sniper's buy appears; retail buyers arrive at prices already elevated. The pattern is consistent with internal sniping but not, on its own, dispositive; the investigator looks for funding-trail relationships between the team wallet and the sniper wallet.

### Conceptual exercises

1. A casefile note reads, "the price impact of the victim's swap was extracted by a sandwich". Identify what evidence would substantiate the claim from on-chain data.
2. Explain why MEV is sometimes referred to as a "tax on visibility" of intent.
3. Why might an investigator use a fresh wallet, with a small balance, to interact with a live case rather than a long-standing wallet of their own?

### Further reading

- *OSINT-Crypto Glossary* entries #23, #24, #25, #41, #42, #60.
- *Dark Patterns in Crypto*, Category C (Technical interface manipulation).
- *Investigation Checklist* §8.3 (Price reconstruction).

### Recap

The mempool exposes pending transactions; gas buys priority; MEV is the value extractable by sequencing. Front-running, sandwich attacks, and sniping are concrete instances. Investigators read these signatures; they do not engineer them. Predictable activity from a known investigator wallet is itself an exposure.

---

## Lesson 6 — Reading a block explorer

### Learning objectives

- Recognise the standard sections of an address page on a generic block explorer.
- Describe the contents of a transaction page and the meaning of each field.
- Identify the limits of explorer-provided labels and enrichments.
- Apply a fixed sequence of checks when arriving at an unfamiliar address.

### Prerequisites

Lessons 1 through 5.

### Content

A *block explorer* is a website or application that exposes the contents of a blockchain in human-readable form. This lesson describes the generic structure for the EVM family; the conceptual structure carries to Solana and to UTXO chains with adjustments.

An address page typically opens with a summary panel: the address, the native-asset balance, an optional human-readable label, the date of first activity, and transaction counts. Below, several tabs organise the history. The *transactions* tab lists outbound transactions signed by the address. The *internal transactions* tab lists value movements triggered by contract calls; these are critical because EVM contracts can move value as a side effect of a parent call, and a reader who only consults the top-level tab can miss the actual flow. The *token transfers* tab lists ERC-20 transfers; the *NFT transfers* tab lists ERC-721 and ERC-1155 movements. The *contract* tab, present when the address is itself a contract, exposes the bytecode and — if the deployer published it — the verified source code.

A transaction page opens with the *txhash*, the block, the timestamp, *from* and *to* addresses, the native-asset value transferred, and the gas used. The *input data* field carries the calldata; explorers decode it when the contract is verified. The *logs* section lists emitted events; standard token transfers emit a `Transfer` event, and a sequence of `Transfer` events is the canonical way to reconstruct an actual movement of value. The *status* field indicates whether the transaction succeeded or reverted.

Two limits of explorer data matter. First, *labels are unaudited*: a "scam" tag may be a sound consensus, a contested allegation, or stale; an "exchange" tag may be inaccurate or at the wrong granularity. The casefile cites the *facts* — addresses, transactions, balances, code — and treats labels as leads. Second, *enrichments are commercial*. "Money flow" diagrams and risk scores produced by third-party platforms are useful as a first read, but their methodologies are often opaque, and the casefile should record the underlying on-chain fact.

A general-purpose checklist for the *first read* of an unfamiliar address: when it first appears and what its first inbound funding was; whether it is a contract or an EOA; volume and asset mix of transfers; most frequent counterparties (CEX deposit addresses, bridges, mixers); and any interpretive label, treated as a lead. The first-read pass produces hypotheses, not conclusions.

> **⚠ Safety box.** A block explorer is a *reading* surface. Some explorers expose a "write" tab on verified contracts, allowing a visitor to call state-changing functions through a connected wallet. The investigator never connects an investigative wallet to a contract under investigation through that tab — a wrong click can spend a balance, sign an approval, or trigger an unwanted on-chain footprint. Investigation is read-only. If a contract behaviour must be verified, it is verified in a sandbox with a throwaway address.

The lesson shows no screenshots. Interfaces change; the point is to develop a vocabulary general enough that any explorer the reader subsequently opens is comprehensible by analogy.

### Key concepts

- Block explorer (Glossary #51)
- Chain analysis (Glossary #52)
- Address label / tag (Glossary #59)
- txhash (Glossary #35)
- Internal transaction (Glossary #51, context)
- Heuristic vs deterministic attribution (Glossary #58)

### Descriptive examples

An investigator opens the address page of a token's deployer. The summary panel shows three transactions and a small native-asset balance; the contracts tab lists a deployed token contract. The token contract's *Holders* tab is dominated by a single address holding most of the supply, and its earliest entries are the deployment and the initial liquidity-pool funding. None is yet a conclusion; together they form a plausible starting picture of a small-scale launch.

A second example. An address carries a community-contributed label flagging it as associated with a known phishing campaign. The investigator records the label, source, and date, but cites the underlying transactions — not the label — when describing the address's behaviour. Labels migrate; transactions do not.

### Conceptual exercises

1. On the page of an unfamiliar address, what five observations would you record before proposing any hypothesis about its function?
2. The same address page carries a "verified contract" tab and a "scam" label. Identify which of these statements you can rely on as fact, and which require additional attribution.
3. A casefile cites a "money flow" enrichment from an explorer. List two questions you would put to the casefile author before accepting the enrichment as evidence.
4. Why does the *internal transactions* tab matter as much as the standard *transactions* tab when reconstructing a contract-mediated flow?
5. State, in one sentence, the rule for connecting a wallet to an explorer's write interface during an investigation.

### Further reading

- *OSINT-Crypto Glossary* entries #35, #51, #52, #58, #59.
- *Investigation Checklist* §4 (On-Chain Identifier Collection), §4.5 (Tooling, generically).
- *Anatomy of a Rugpull* §9 (Consolidated technical view).

### Recap

A block explorer is a structured reading surface. Address pages, transaction pages, internal transactions, and event logs are the standard objects; labels and enrichments are leads, not facts. The investigator reads, does not transact, and cites the underlying chain state rather than the explorer's interpretation.

---

## Lesson 7 — Recognising fraud patterns

### Learning objectives

- Recognise five major retail-fraud archetypes on their off-chain and on-chain surfaces.
- Articulate the structural features that distinguish each archetype from the next.
- Identify the typical signals that a single case may combine more than one archetype.
- Avoid the common pedagogical error of confusing a fraud pattern with a fraud diagnosis.

### Prerequisites

Lessons 1 through 6.

### Content

Retail-facing crypto fraud is unusually patterned. The combination of irreversible transactions, permissionless deployment, and a social ecosystem optimised for fast attention has produced a finite number of recurring archetypes. This lesson catalogues five, each with off-chain and on-chain signals.

The first archetype is the **rugpull**. The *Anatomy of a Rugpull* whitepaper treats this case in depth. Off-chain, a rugpull accumulates social signal and ends abruptly with abandoned communication channels. On-chain, it ends with the redemption of LP tokens held by the launching team, leaving the project token tradeable against an empty pool. Once the operation has dispersed, recovery becomes structurally harder.

The second archetype is the **exit scam**: the operators of a service collect funds and disappear. The service may be a tokenless yield product, a hosted exchange, or any structure that holds user assets. Off-chain it is recognisable by a sequence — promise, deposit growth, withdrawal friction, silence. On-chain, the signature is the consolidation of deposit-side flows into a small number of cashing-out addresses, often passing through bridges or mixers.

The third archetype is the **pump and dump**: a coordinated effort to inflate an asset's price through promotional activity and then sell into the inflated demand. Off-chain, it is signalled by a sudden uptick in coordinated commentary across several platforms. On-chain, the signature combines accumulation by insider addresses prior to the visible activity, abnormally large trading volume during the window, and rapid distribution into smaller addresses once retail attention arrives. Wash trading frequently accompanies a pump and dump.

The fourth archetype is the **drainer**: a malicious smart contract or script that, once authorised by a victim signature, transfers value out of the victim's wallet. The victim typically arrives through a phishing site, a malicious advertisement, or a compromised front-end. Off-chain, the surface is the deceptive interface. On-chain, the signature is a single sweeping transaction immediately after signature, into a freshly funded address that consolidates many victims.

The fifth archetype is **phishing**, in its narrower retail-investor sense: deceptive websites, messages, or impersonation inducing a user to disclose a seed phrase or sign a malicious transaction. Drainers are the technical implementation of one phishing class; the broader category also includes pure social-engineering attempts ("verify" a wallet by entering a seed phrase, or transfer funds to a "safe" address).

Two pedagogical cautions close the lesson. First, *patterns are not diagnoses*. A casefile that says "this is a rugpull" is making an attribution; it should be supported by the signals listed for that archetype and labelled with the strength of the support. Second, *cases combine archetypes*. A real case may begin as a social-pressure-driven pump-and-dump, mature into a rugpull, and end with proceeds running through bridges and mixers. The casefile describes what was observed, in order, rather than choosing one archetype and forcing the evidence to fit. The *Anonymized Case Studies* illustrate this layering.

The five archetypes each maximise the gap between *signature* and *understanding*. The investigator's discipline is the inverse.

### Key concepts

- Rugpull (Glossary #36)
- Exit scam (Glossary #37)
- Pump and dump (Glossary #39)
- Drainer (Glossary #43)
- Phishing (Glossary #44)
- Wash trading (Glossary #40)
- Honeypot (Glossary #38)

### Descriptive examples

A token launches with strong social signal and a stated locked-liquidity promise. Within forty-eight hours, the channels are quiet, the front-end is offline, and the chain shows that the LP tokens — never actually transferred to the lock contract — have been redeemed by the team wallet. The case combines a social-pressure dark pattern and a rugpull.

A separate case: a small-cap token with no signs of liquidity withdrawal but with three days of coordinated commentary on multiple platforms, followed by a price spike, followed by rapid distribution from a cluster of pre-funded addresses into a long tail of recipients. The structure is consistent with a pump-and-dump.

### Conceptual exercises

1. A retail report calls a case "an obvious rugpull". Identify the on-chain and off-chain observations you would need before adopting the description in a casefile.
2. A pump-and-dump and a rugpull can co-occur. Describe how you would record the chronology so that a reader can distinguish them.
3. List two off-chain and two on-chain signals that would shift your prior in favour of a drainer rather than a rugpull diagnosis.
4. Why is the distinction between "the pattern is present" and "the pattern is the right diagnosis" especially important in early casefile drafts?

### Further reading

- *Anatomy of a Rugpull*, the whole document.
- *Dark Patterns in Crypto*, the whole document, with particular attention to categories C (technical) and D (financial misrepresentation).
- *Anonymized Case Studies*, all four cases, for layered worked examples.
- *OSINT-Crypto Glossary* entries #36, #37, #38, #39, #40, #43, #44.

### Recap

Five archetypes — rugpull, exit scam, pump and dump, drainer, phishing — cover most retail-facing crypto fraud. Each has off-chain and on-chain signatures. Patterns are starting points; cases combine them; investigators describe observations and label attributions with the strength of their support.

---

## Lesson 8 — OSINT for the crypto investigator

### Learning objectives

- Identify the principal public sources for off-chain investigation in crypto cases.
- Apply generic, non-commercial OSINT tools to verify, archive, and pivot.
- State the legal and ethical limits of OSINT and the actions excluded by them.
- Cross-reference on-chain and off-chain evidence into a single, defensible narrative.

### Prerequisites

Lessons 1 through 7.

### Content

OSINT — open-source intelligence — is the structured collection and analysis of information drawn from publicly available sources. In a crypto investigation, OSINT supplies the off-chain evidence the on-chain record cannot: the identity, intent, and history of the people behind the addresses.

The principal public surfaces are conventional. *Public social media* is the primary source for the discourse around a project. *Public messaging communities* — open channels on Telegram, public servers on Discord — are where retail interaction plays out. *Code-hosting sites* supply technical history, contributor identities, and artefacts inadvertently committed at earlier stages. *Web archives* preserve material the project may later remove. *Public registries* — WHOIS records, corporate registries, court records, regulatory filings — supply the institutional layer.

Generic, non-commercial tooling sufficient for an introductory pass includes web archives, a reverse image search engine, general search engines used with site-restricted queries, and the metadata viewers built into modern operating systems. Specialist OSINT communities maintain freely available tool catalogues; the investigator should keep one bookmarked rather than try to memorise tools. This course names no commercial product, on principle.

The methodological core of an OSINT pass is the *pivot*: moving from one identifier to another along a public link — from a username to a profile, to a domain, to a registrant footprint, to a code-hosting account, back to an on-chain address mentioned in a commit message. Successful investigation is a sequence of pivots, each documented.

> **⚠ Safety box.** OSINT relies on sources that are *public*. Pretexting (assuming a fabricated identity to elicit information from a third party), social engineering, intrusion into private accounts, SIM-swap techniques, access to messages or accounts not your own, and the manufacture of evidence are *outside the envelope* and not part of OSINT — and, in most jurisdictions, criminal acts. A casefile containing material obtained through any of these techniques is contaminated and exposes its author.

Cross-referencing on-chain and off-chain evidence is the practical synthesis. A typical sequence: an on-chain address behaves consistently with a launching-team wallet; OSINT identifies a public social account in which the team has posted that address; the social account is linked to a personal account through an archived post; the personal account has a comment history on a code-hosting site referencing another address that appears, on-chain, as the destination of the treasury transfer. The chain supplies facts; OSINT supplies attribution. Together they support a *probabilistic* attribution.

The casefile records, for every off-chain finding: the source, the date of capture, a hash of the captured artefact, and any redactions. Chain-of-custody discipline applies to digital artefacts as to physical ones.

The investigator's footprint in the OSINT pass is itself observable. A sudden spike of profile views, archived captures, or domain lookups can alert a project and accelerate its dispersal. OSINT OPSEC — disposable infrastructure, deliberate pacing, separation of investigative identifiers from personal ones — is part of the discipline rather than a separate skill.

### Key concepts

- OSINT (Glossary #1)
- SOCMINT (Glossary #2)
- GEOINT (Glossary #3)
- Pivot (Glossary #4)
- Sockpuppet (Glossary #5)
- Pretexting (Glossary #14)
- OPSEC (Glossary #15)
- Chain of custody (Glossary #10)

### Descriptive examples

An investigator wishes to verify a claimed conference appearance by a project's founder. A reverse image search on the announcement photograph returns a hit on an unrelated event from two years earlier. The misrepresentation is itself a finding; whether it rises to a fraud signal depends on what the project claimed and how the claim mattered to retail decisions.

A second example. An on-chain address has appeared as the destination of incoming treasury transfers. A web archive of the project's earliest landing page shows the same address listed as the "team multisig"; the current page has removed this reference. The archived capture gives the casefile a stronger probabilistic attribution than either source alone.

### Conceptual exercises

1. List the four pieces of metadata you would record for every off-chain artefact added to a casefile, and explain what each prevents.
2. Describe a sequence of three pivots from a public social media handle that would help triangulate a team wallet on-chain.
3. State, in one paragraph, the OSINT red line — what is and is not part of the discipline — and one reason why crossing it would harm the casefile even if the technique "worked".
4. A casefile relies entirely on the current state of a project's landing page. Identify the methodological weakness and the OSINT remedy.

### Further reading

- *OSINT-Crypto Glossary* entries #1, #2, #3, #4, #5, #10, #14, #15.
- *Investigation Checklist* §5 (Off-Chain Identifier Collection), with particular attention to §5.2 (The OSINT red line).
- *Anonymized Case Studies*, for cross-referenced on-chain × off-chain narratives.

### Recap

OSINT supplies off-chain evidence that on-chain data cannot. Pivots move along public links; chain-of-custody discipline records every step. The OSINT envelope is public sources only; pretexting, social engineering, intrusion, and SIM-swap techniques are outside the envelope and outside the discipline. On-chain and off-chain evidence are synthesised into probabilistic attribution, not certainty.

---

## Lesson 9 — Building an investigation file

### Learning objectives

- Apply a standard eight-component casefile template (C1 through C8).
- Distinguish chronology from causation in a casefile narrative.
- State the basic chain-of-custody and hashing requirements for digital artefacts.
- Recognise common methodological errors in early casefile drafts.

### Prerequisites

Lessons 1 through 8.

### Content

The output of an investigation is a *casefile* — a structured record meant to be re-read, audited, transferred, and handed to authorities or counsel. The *Investigation Checklist* proposes an eight-component template, C1 through C8.

**C1 — Identification.** Case identifier, date of opening, analyst, source of the original report, and a one-paragraph summary of the suspected matter. The summary is descriptive, not evaluative.

**C2 — Chronology.** A timestamped sequence of every event bearing on the case. Each entry contains a date and time (with timezone), the event, and a reference to the underlying evidence (a txhash, an archived URL, a screenshot file with its SHA-256 hash). Chronology is the spine of the casefile.

**C3 — Actors.** A list of the persons, entities, and pseudonyms appearing in the case, with the evidence supporting each identification. The strength of each attribution is stated (weak, moderate, strong) and the supporting observations are cited.

**C4 — On-chain flows.** The principal addresses, the contracts involved, the relevant transactions, and a description of the value movements. Where flows pass through bridges, mixers, or CEX deposit addresses, the boundary is noted; flows into a CEX deposit address are not "lost", they are *redirected to a non-public investigative channel*.

**C5 — Off-chain flows.** The corresponding off-chain narrative: social channels, websites, messaging communities, press coverage. For each item the source, the date of capture, and the artefact hash are recorded. C5 cross-references C4.

**C6 — Patterns detected.** The fraud archetypes (Lesson 7) and dark patterns observed, each with supporting observations from C4 and C5. C6 is descriptive of patterns observed, not a legal qualification — which is the role of counsel.

**C7 — Loss estimation.** The estimated value lost, expressed at the time of the events and at the time of the casefile's writing, with an explicit methodology (which prices, which addresses attributed, which assumptions). The methodology must be stated openly enough that a reviewer can replicate the calculation.

**C8 — Recommendations.** The actions the casefile recommends — typically the authority to which the case should be referred, the further enquiry that would strengthen attribution, the specific protective steps a victim might take. C8 is the only normative section.

Two methodological errors recur. *Causal language under the appearance of chronology*: a casefile that says "the team then drained the LP" is making a causal claim. The event is "the LP tokens were burned and the assets withdrew"; the attribution to "the team" belongs in C3 with supporting evidence. *Labelling as evidence*: citing an explorer "scam" tag as a finding inherits the tag's uncertainty; the underlying transactions, not the tag, are the evidence.

Chain-of-custody applies to every artefact. Each off-chain file carries a SHA-256 hash recorded at capture; each on-chain reference cites a txhash and the block height.

> **⚠ Safety box.** A public investigation can harm an innocent. A casefile that names a person attaches reputational consequences that survive any subsequent correction. The investigator applies attribution strength labels, refuses to publish weak attributions outside the casefile, and revisits the file when new evidence revises a conclusion. Rigour is an ethical obligation; "rigorous" is what an innocent person harmed by an early publication asks of you in retrospect.

A casefile is finished only when a different analyst could re-open it months later, find every artefact at its cited location, recompute every hash, and trace every conclusion to its supporting evidence.

### Key concepts

- Casefile structure C1–C8 (Investigation Checklist §7)
- Chain of custody (Glossary #10)
- Attribution (Glossary #9)
- Heuristic vs deterministic attribution (Glossary #58)
- Confirmation bias (Investigation Checklist §8.1)
- IOC (Glossary #13)

### Descriptive examples

A casefile draft in C3 attributes a wallet to "the founder" on the basis of a single archived screenshot. The reviewer asks for a second independent observation; the author finds a corresponding code-hosting handle that posted the same address in a commit message. The attribution moves from weak to moderate.

A second example. A casefile in C7 reports a loss figure derived from a single explorer enrichment. The author re-derives the figure from raw on-chain volumes and public price snapshots, citing each input. The figure changes by a few percent; the methodology is now legible.

### Conceptual exercises

1. A casefile statement reads, "the launching team rugged on May 5". Rewrite the statement as a chronology entry in C2 plus an attribution claim in C3, each with its supporting evidence.
2. A reviewer challenges a casefile's loss estimation as "too round". Identify the methodological elements you would document to defend or revise the figure.
3. Describe the difference between a *finding* and a *lead* in the context of an explorer label flagged on an address in C4.
4. Why is C8 the only normative section of the casefile, and what would be wrong with a casefile that introduced normative language in C6?

### Further reading

- *Investigation Checklist* §7 (Casefile Structure), §8 (Methodological Limits and Red Flags).
- *OSINT-Crypto Glossary* entries #9, #10, #13, #58.
- *Anonymized Case Studies*, all four cases, for examples of the template populated.

### Recap

The casefile template C1–C8 organises a case for audit. Chronology is descriptive; attribution is labelled with its strength; chain-of-custody discipline applies to every artefact. Causal language and label-as-evidence are the typical early errors. Rigour is an ethical obligation because publication harms.

---

## Lesson 10 — Reporting, ethics, and legal limits

### Learning objectives

- Identify the principal categories of authority to which a crypto-fraud casefile can be referred.
- State the ethical limits of civilian investigation in distinction from judicial authority.
- Recognise the personal-risk profile of public investigation in crypto and the basic protective measures.
- Articulate, in the reader's own words, the principle that closes the course.

### Prerequisites

Lessons 1 through 9.

### Content

A casefile is a working document. Its destination is rarely a publication; more often it is a handover to a person or institution with the standing and legal authority to act on it. This final lesson outlines the destinations, the ethical envelope, the risks the investigator runs, and the principle that closes the course.

The categories of authority vary by jurisdiction; the reader should consult *Investigation Checklist* §9 for the developed treatment. *Law enforcement* handles criminal qualification. *Financial regulators* and *consumer-protection authorities* handle market-conduct, disclosure, and consumer-harm angles. *Tax authorities* sometimes have jurisdiction over proceeds where market-conduct authorities do not. *Data-protection authorities* may be the relevant interlocutor where the case involves misuse of personal data. *Specialised counsel* advises victims on civil recovery. *Newsrooms* with established reporting practices may be appropriate for cases with a strong public-interest dimension; the relationship is editorial, not investigative.

The ethical envelope is narrower than the technical envelope. The investigator does not substitute for a court, does not assert criminal liability, does not pronounce verdicts. The investigator describes patterns, attributes observations with their strength labelled, hands material to those with the standing to act. Publicly accusing a named person before any authority has examined the case has well-known costs to innocent people and to the investigator's standing. The distinction between *publicly investigated* and *publicly accused* is not stylistic.

The investigator's risk profile has three components. *Defamation exposure* is the legal risk of publication, varying by jurisdiction; a publication that overstates or omits material context can expose the publisher to civil action. *Harassment exposure* is the practical risk of becoming a target of the project's followers or operators. *Reverse doxxing* — public disclosure of the investigator's identity or personal information — is the most operationally severe, and is documented across the field. The protective measures align with general OPSEC: segregation of investigative identifiers from personal ones, disposable infrastructure for sensitive lookups, deliberate restraint in public commentary on live cases. The general principle is universal — the investigator who is harder to target is harder to silence.

The principle that closes the course is one this preface has stated and to which every lesson has returned. *The course teaches the reader to understand, to read, to record, and to escalate; it does not teach the reader to attack, drain, defraud, or punish.* The five fraud archetypes were catalogued so the reader can recognise them, not replicate them. The OSINT envelope was described to be respected. The casefile template was offered as a discipline of rigour, not a tool of denunciation. The investigator's authority is the authority of patient, honest description; it does not exceed that mandate.

The corpus to which this course belongs is dense enough that one pass is the beginning of an apprenticeship, not the end of a syllabus. The next steps are practice on the worked cases in the *Anonymized Case Studies* and on the operational sequence in the *Investigation Checklist*.

> **⚠ Safety box.** Two final reminders. First, a casefile is not a verdict; civilian investigators describe and refer, they do not adjudicate. Second, the investigator's protective discipline — OPSEC, restraint in public commentary, attention to one's own digital footprint — is not optional; it is the condition under which the work remains sustainable.

### Key concepts

- OPSEC (Glossary #15)
- Doxxing (Glossary #7)
- Attribution (Glossary #9)
- Heuristic vs deterministic attribution (Glossary #58)
- Threat model (Glossary #12)
- Self-regulatory organization (Glossary #70)

### Descriptive examples

A casefile concludes with strong on-chain evidence and moderate off-chain attribution. The investigator drafts a public summary; in review, a colleague notes it names a person whose attribution is moderate. The summary is rewritten to describe patterns and on-chain facts, withholding the named attribution pending further evidence.

A second example. An investigator publishes findings on a public platform and within seventy-two hours faces a coordinated harassment campaign. The threat model anticipated this; investigative and personal identifiers are segregated, the casefile is preserved with chain-of-custody discipline, and the case has been transmitted to the appropriate authority before public discussion. The course of action survives the harassment because the investigator did not depend on public publication for the case to be heard.

### Conceptual exercises

1. A victim asks you to "publish the name of the founder" of a project you have investigated. State your response in two sentences, distinguishing what you have established from what you can responsibly publish.
2. Identify three protective measures an investigator can apply before publishing any finding on a public platform, and explain what each prevents.
3. Distinguish, in the reader's own words, the difference between a casefile sent to law enforcement and a public publication of the same material.
4. State the closing principle of the course in one sentence, and identify one decision you would make differently if you forgot it.

### Further reading

- *Investigation Checklist* §9 (Reporting to Authorities), §10 (Victim Orientation), §11 (Casefile Closure and Reopening).
- *Operating Manual for INTERLIGENS Beta Investigators*, §2 (Cadre légal et déontologique) — for the beta-tester procedural envelope.
- *OSINT-Crypto Glossary* entries #7, #9, #12, #15, #58, #70.

### Recap

A casefile is handed to authorities, not to the public by default. Civilian investigators describe and refer; they do not adjudicate. Defamation, harassment, and reverse doxxing are real risks; OPSEC is part of the discipline. The course teaches reading and reasoning, not attack.

---

## Appendix A — Suggested six-week reading plan

| Week | Lessons | Approximate time | Objective |
|------|---------|------------------|-----------|
| 1 | 1–2 | 2 hours | Blockchain and wallet fundamentals |
| 2 | 3–4 | 2 hours | Tokens and decentralised exchanges |
| 3 | 5–6 | 2 hours | Mempool and reading a block explorer |
| 4 | 7 | 1 hour | Recognising fraud patterns |
| 5 | 8 | 1 hour | OSINT discipline |
| 6 | 9–10 | 2 hours | Casefile construction and ethics |

A reader on a slower pace can spread each pair across a week, using the second session for the exercises and the cross-referenced corpus. A faster pace collapses the plan into two intensive weekends.

## Appendix B — Further reading

Five companion documents in the INTERLIGENS Research corpus:

- *Dark Patterns in Crypto: A Taxonomy of Manipulation Tactics* — fifteen persuasive patterns at the surface of retail-facing crypto.
- *Investigation Checklist — Crypto Fraud Cases (Operational Playbook)* — the operational sequence of a casefile.
- *OSINT, Crypto and Investigation Glossary* — seventy definitions.
- *Crypto Fraud Cases — Anonymized and Fictionalized Studies* — four worked examples.
- *Anatomy of a Rugpull* — a single-archetype deep dive.

External public references appropriate for a beginner reading beyond the corpus. The list is institutional rather than personal, and excludes all commercial courses, bootcamps, paid platforms, and proprietary tools.

- Financial Action Task Force (FATF). *Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers* (2021).
- Europol. *Internet Organised Crime Threat Assessment (IOCTA)*, annual editions.
- European Union Agency for Cybersecurity (ENISA). *Threat Landscape* reports, annual editions.
- U.S. Federal Trade Commission. *Bringing Dark Patterns to Light* (September 2022), staff report.
- OECD. *Dark commercial patterns* (2022), working paper.
- Meiklejohn, S., et al. (2013). *A Fistful of Bitcoins: Characterizing Payments Among Men with No Names*. ACM IMC. (Foundational on common-input heuristic.)
- Möser, M., Böhme, R., & Breuker, D. (2013). *An Inquiry into Money Laundering Tools in the Bitcoin Ecosystem*. eCrime Researchers Summit. (Foundational on mixing analysis.)

URLs are unstable; the references are located by issuer and title.

## Appendix C — Flash glossary

The fifteen terms most useful as anchors for the course. Each points to the corresponding entry of the main *OSINT-Crypto Glossary*.

- OSINT — Glossary #1
- Pivot — Glossary #4
- Attribution — Glossary #9
- Chain of custody — Glossary #10
- OPSEC — Glossary #15
- Blockchain — Glossary #16
- EOA — Glossary #17
- Smart contract — Glossary #18
- Wallet — Glossary #21
- Private key / seed phrase — Glossary #22
- AMM — Glossary #27
- Liquidity Pool — Glossary #26
- Rugpull — Glossary #36
- Block explorer — Glossary #51
- Heuristic vs deterministic attribution — Glossary #58

## Appendix D — Suggested answers to the conceptual exercises

The answers below are methodological. They describe what to look for, how to reason, what to record; they do not describe how to act, attack, or extract value. A reader who finds an answer drifting toward operational specifics has misread the spirit of the exercise.

### Lesson 1

1. The bank's database can be edited by the bank; a public blockchain cannot be edited after a transaction is finalised, and its contents are readable by anyone.
2. The chain can prove that a specific address signed specific transactions and that funds moved between addresses. It cannot prove the identity of the natural person controlling the address, nor the intent of any actor.
3. A casefile is "outdated" when its *interpretations* no longer reflect available evidence, even though the underlying on-chain facts remain unchanged.

### Lesson 2

1. The note conflates the address with its controller. The complete statement names which address acted, identifies it as an EOA or a contract, and (in C3) attributes control of the private key with a strength label.
2. The address's funding pattern (CEX-style deposit clusters versus standalone funding), large inbound flows from many EOAs typical of customer deposits, and interaction with known custodial infrastructure.
3. Refuse and warn the victim that any party requesting a seed phrase or private key is the next attacker. Possession of a seed phrase equals control of the wallet; a legitimate analyst never needs it.

### Lesson 3

1. An active mint function callable by an owner address (verifiable from contract source and owner state); an upgradeability proxy with an active admin (verifiable from the proxy admin slot); an active blacklist or transfer-tax function (verifiable from contract source). The observation settles whether the feature is present; whether it has been used adversarially is a separate question.
2. Verify on-chain that the owner address has been set to the zero address or to a contract with no callable transfer-of-ownership path; that no upgrade proxy can restore ownership; and that the project's claim and the on-chain state agree.
3. Native-asset flows are necessary but not sufficient. Retail-facing fraud typically rides on a project token whose contract carries the malicious provisions; native assets appear at the edges. A casefile that traces only native-asset flows misses the heart of the matter.

### Lesson 4

1. The LP tokens corresponding to the project pool were redeemed by an address attributed to the team, and the underlying assets flowed out, leaving the pool empty or near-empty.
2. The proportion of LP tokens held by team-attributed addresses; whether the LP tokens are held by a verifiable lock contract with a stated expiration; the size of the pool relative to expected trading volume.
3. The AMM prices the swap as a function of *the pool's reserves*. Price impact, slippage, and vulnerability to sandwich attacks all scale with the ratio of trade size to pool size, not with the absolute size.

### Lesson 5

1. The victim's transaction and the two adjacent transactions, with their inclusion order; the pool reserves before, between, and after; and a relationship (funding or behavioural) between the bracketing addresses, supporting the inference of a common operator.
2. Because MEV extracts value from the visibility of pending intent — the visibility itself is the lever.
3. A long-standing wallet is a fingerprint that can be matched across cases, can leak the analyst's identity, and can be front-run on its routine activity. A fresh, narrowly funded wallet limits the footprint.

### Lesson 6

1. The date of first activity; whether the address is an EOA or a contract; the volume and asset composition of its main flows; the principal counterparties (especially CEX deposits and bridges); and any interpretive label, recorded as a lead.
2. Verified contract status is a fact. The scam label is a lead: it requires attribution to a source, a date, and a reason; even a sound label can be stale.
3. Which on-chain inputs the enrichment used (which addresses, which time window) and which heuristics it applied (clustering rules, taint methodology). A casefile that cannot answer either should cite the underlying transactions instead.
4. EVM contracts move value as side effects of calls. The *transactions* tab shows only the top-level call, while *internal transactions* show the actual value movements.
5. The investigator never connects an investigative wallet to a contract under investigation through an explorer's write interface; investigation is read-only.

### Lesson 7

1. The redemption of LP tokens by team-attributed addresses; the abandonment of off-chain channels; and the chronology of the two relative to the team's public communications about liquidity.
2. Record each event with its timestamp, the underlying evidence, and a description of the *action*, not its interpretation. A reader should infer the layered pattern from the sequence.
3. Off-chain favouring a drainer: a lookalike domain mimicking a familiar protocol, a phishing distribution channel. On-chain: a single sweeping transaction draining the victim's wallet shortly after signature, into a freshly funded address that consolidates many similar transactions.
4. An early diagnosis becomes the lens through which subsequent evidence is read; confirmation bias accelerates if the diagnosis is locked in before the evidence is in.

### Lesson 8

1. Source, date of capture, hash, redactions. Source prevents anchoring to a missing artefact; date prevents implicit assumption of currency; hash prevents tampering disputes; redactions prevent invisible omissions.
2. From a handle, find archived and current posts citing any address; verify the address on-chain for relationships expected of a team wallet; pivot from any associated domain or code-hosting account; correlate with on-chain treasury flows.
3. The OSINT envelope is *public sources only*. Pretexting, social engineering, intrusion, and SIM-swap techniques are outside the discipline and the law; material obtained outside the envelope contaminates the casefile.
4. The weakness is assuming the current page reflects the full public history; the remedy is to consult web archives for earlier captures and compare the trajectory of the page across time.

### Lesson 9

1. C2: "[date, time, timezone] — LP tokens redeemed; underlying assets flowed to address [X]; pool reserves observed as [...]. Evidence: txhash [...]". C3: "Address [X] attributed to team — strength: moderate. Supporting observations: archived team post citing [X] as multisig; commit message referencing [X]."
2. Which prices were used, with source and timestamp; which addresses were attributed to which actors; assumptions about double-counting between volume figures; whether wash-trading-adjusted volume was used.
3. A finding is established by the casefile's own evidence; a lead is a third-party hint that must itself be substantiated. A scam label is a lead until the casefile produces its own corroborating findings.
4. The casefile's role is to *describe*; normative claims belong in C8. Mixing normative language into C6 unconsciously leans the descriptive material toward the recommendation, weakening the discipline.

### Lesson 10

1. "I have established the on-chain facts and a moderate attribution; I am not in a position to publish the name responsibly, and I will refer the casefile to the appropriate authority for the qualification of intent."
2. Segregation of investigative identifiers from personal ones (prevents reverse doxxing); review by an independent reader (prevents overstatement); pre-emptive transmission to the relevant authority (prevents loss of the case if public retaliation disrupts the analyst).
3. A handover transmits the casefile, with its evidence and labelled attributions, to a body with the standing and resources to act. A public publication exposes the claims to a much larger audience, with weaker due-process protections for the targets and significant exposure for the publisher.
4. "The course teaches the reader to understand, to read, to record, and to escalate; it does not teach the reader to attack, drain, defraud, or punish." A decision changed if forgotten: how much to publish on a public platform before the casefile has been handed to the appropriate authority.

---

## Disclaimer

This document is educational. It is not legal advice, does not authorise any action that would be unlawful in the reader's jurisdiction, relies exclusively on public sources, and makes no operational recommendations whose application would itself constitute an offence.

The course describes investigative methodology. Several sections refer to techniques associated with criminal conduct (phishing, drainers, social engineering, market manipulation, impersonation). Such references are descriptive of the techniques as objects of investigation, not operational guidance.

Real persons, projects, addresses, transactions, and events are not named in this document. Where the course refers to the wider INTERLIGENS Research corpus, it does so because the course is itself a document of that corpus; no other product, service, person, or institution is endorsed by mention.

INTERLIGENS Research, 2026. Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0).
