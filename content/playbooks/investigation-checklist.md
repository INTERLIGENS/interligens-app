---
title: "Investigation Checklist — Crypto Fraud Cases (Operational Playbook)"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-22"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["investigators", "researchers", "journalists", "legal-counsel", "osint-analysts"]
abstract: "An operational checklist for first-line response, evidence preservation, on-chain and off-chain identifier collection, behavioural analysis, casefile construction, and victim orientation in crypto fraud cases. The document is educational; it does not substitute legal counsel or law enforcement procedures."
---

## 1. Preface

### 1.1 Purpose

This playbook proposes an operational sequence for handling a crypto-fraud report from the moment it arrives at an investigator's desk to the moment a structured casefile can be handed to competent authorities or to journalists for further verification. It is checklist-oriented: each section is intended to be read in order during a real engagement, ticked off, and revisited as new information surfaces.

The playbook is not a substitute for legal training, for jurisdictional expertise, or for the institutional procedures of any specific agency. It is a methodological scaffold — a way to ensure that the first hours of an investigation, where most evidence is lost, are spent collecting the right things in the right order.

### 1.2 Audience

The document is written for four audiences whose work routinely intersects:

- **Financial investigators** in regulated bodies and in private firms, who triage reports of suspected fraud involving crypto-assets and decide whether to escalate.
- **Investigative journalists** covering crypto markets, where evidence preservation and source verification are operationally similar to those of a financial investigator and where the legal exposure of publication is high.
- **Specialised counsel** advising victims, where a structured early record materially affects the chances of recovery, of disclosure obligations being met, and of statute-of-limitation considerations being correctly framed.
- **OSINT analysts** contributing to any of the above, particularly where on-chain and off-chain evidence must be joined into a single narrative.

Readers in adjacent roles — compliance officers, exchange investigators, academic researchers — may find the methodological core useful even where their procedural environment differs.

### 1.3 Scope

The playbook addresses retail-facing crypto fraud: rug pulls, exit scams, pump-and-dump schemes, drainer-based phishing, impersonation, fake recovery services, and the social-layer manipulation that typically precedes each of these. It treats these cases at the methodological level — what to capture, how to record it, how to reason about the captured material — rather than as a recipe for any particular case archetype.

### 1.4 Out of scope

The following are deliberately excluded:

- **Violent crime**, including extortion, kidnapping for ransom, and human-trafficking financing. Such cases must be referred to law enforcement immediately and are not amenable to civilian investigation.
- **Counter-terrorism financing**, which is regulated under specific national and international frameworks (FATF Recommendation 5 and equivalents) and falls under the exclusive remit of designated authorities.
- **Sanctions evasion**, which intersects with national and supranational sanctions regimes whose interpretation requires specialised legal counsel.

Where these elements appear during an investigation that began as a routine fraud case, the investigator should pause, document the trigger, and refer to the relevant authority before continuing.

### 1.5 Disclaimer summary

This document is educational. It does not constitute legal advice, does not authorise any action that would itself be unlawful in the reader's jurisdiction, and relies exclusively on public sources. A complete disclaimer appears in Section 12.

## 2. First Reflexes — Receiving a Report

The first contact with a victim or witness is the most evidence-rich moment of an investigation and also the most fragile. Volatile material — social-media posts, websites, chat logs, transactions in mempool — may be removed within hours. The investigator's task in this phase is preservation, not analysis.

### 2.1 To do

- Record the exact local date and time of first contact, in UTC and in the victim's local timezone.
- Capture the report verbatim: a written transcript or a recorded statement, with the victim's consent.
- Preserve every URL cited by the victim, in full, including query strings and fragment identifiers.
- Save full-page screenshots of any web surface mentioned, before content is removed.
- Collect every wallet address referenced — victim's wallet, suspect wallet, intermediate wallets — as plain text, not as truncated display strings.
- Note every transaction hash, token contract address, and chain mentioned, with the chain identified explicitly (Ethereum mainnet, Solana mainnet, BNB Smart Chain, Base, Arbitrum One, and so on; chain identifiers matter).
- Record amounts in both native units and the token denomination claimed by the victim, with the exchange rate at the time of the loss if known.
- Note the initial platform of contact (exchange, social network, messaging app, dating site, group chat) and the persona presented to the victim.
- Take a non-clinical note of the victim's emotional state. Decisions taken under acute distress need contextualisation later.

### 2.2 Not to do

- Do not promise fund recovery. Recovery rates in retail crypto fraud are low; promising recovery is a re-victimisation risk and may itself meet the legal definition of misrepresentation.
- Do not declare an attribution ("I know who is behind this") before the work supports it. Premature attribution leaks, even within a small team, can compromise both the investigation and the named individual.
- Do not publish details of the case on social media. Doing so warns the suspect, contaminates witnesses, and may breach data-protection obligations.
- Do not contact suspected perpetrators directly. Even a polite contact may trigger destruction of evidence, may amount to harassment under local law, and crosses the line between investigation and law enforcement.
- Do not access accounts, devices, or systems that do not belong to the investigator and to which authorised access has not been granted. Doing so converts the investigator into an offender in most jurisdictions.
- Do not store sensitive material (seed phrases, identity documents) the victim may volunteer beyond the strict minimum needed; if collected at all, store under appropriate security and delete on schedule.

### 2.3 Five triage questions

The intake interview can be reduced to five questions whose answers structure everything that follows:

1. **When.** When did the events occur? When was the loss first noticed? When did the victim last hold the assets?
2. **Where.** On which platforms, websites, chats, or in-person settings did the interaction occur?
3. **How much.** What was the magnitude of the loss, in fiat-denominated terms at the time it occurred and at the time of report?
4. **Who.** What identities, handles, names, or pseudonyms did the counterparties present?
5. **How.** What was the apparent mechanism — promised investment return, romance approach, recovery offer, wallet-connect prompt on a website, support DM, airdrop claim?

Each answer should be recorded in the victim's own words, with the investigator's interpretation marked separately.

### 2.4 Criticality triage

A first-pass criticality grade orients downstream work. The grade is provisional and revisable as facts develop. The grid below combines reported amount with apparent victim count; the higher of the two ratings governs the overall classification.

| Class    | Reported amount per victim (USD equivalent) | Apparent victim count   | Typical disposition |
|----------|---------------------------------------------|-------------------------|---------------------|
| Low      | Under 5,000                                  | One                     | Self-help guidance; signpost to consumer-protection channels |
| Medium   | 5,000 to 50,000                              | Several (under ten)     | Casefile opened; structured evidence preservation |
| High     | 50,000 to 500,000                            | Tens                    | Casefile opened; coordination with law enforcement considered |
| Critical | Above 500,000 or unknown but plausibly high   | Hundreds or unbounded   | Immediate escalation to competent authorities; investigator becomes contributor, not lead |

The grade should be recorded in the casefile header and revised explicitly when new information moves it across a threshold.

## 3. Evidence Preservation

Evidence preservation underpins everything else. A finding is only useful to the degree the underlying material can be re-inspected, attributed, and dated. The default working assumption is that any web surface relevant to the case will be modified or removed before the investigation closes.

### 3.1 What to capture

- **Full-page screenshots** of every relevant web page, capturing the entire rendered content, not just the visible viewport. The browser's developer tools or operating-system screenshot facilities can produce full-page captures without third-party software.
- **Public web archives**: submit each relevant URL to public archiving services such as the Internet Archive's Wayback Machine and archive.today. Submission produces a third-party-hosted dated snapshot useful when later disputed.
- **Screencast recordings** for any interaction whose meaning depends on temporal behaviour (a countdown, a button flow, a modal sequence). A short video captures evidence that no static screenshot can.
- **Source captures**: where the page renders client-side (JavaScript-heavy single-page applications), saving the rendered DOM via the browser's "save as" plus the loaded resources protects against later changes that archives may miss.
- **Chat exports** in the platform's native export format where available; otherwise, full-channel screenshots ordered chronologically.
- **Email headers** in full, including the routing trail, when an email is in scope.

### 3.2 Chain of custody

Every item collected should be entered in a chain-of-custody log with at least the following fields:

- Item identifier (a sequential reference internal to the casefile).
- Source URL or origin description.
- Collection timestamp in UTC.
- Collection method (manual screenshot, archive service, export tool).
- SHA-256 hash of the file, recorded immediately after collection.
- Storage location (path or cloud reference, with access controls noted).
- Collector identity (the investigator who captured it).

Hashing is straightforward on every common operating system; the resulting hexadecimal digest is recorded alongside the filename. A later auditor can rehash the file and confirm it has not been altered. If the file is altered (for instance, redacted before sharing), the redacted version is given its own entry, with both hashes recorded and the relationship to the original made explicit.

### 3.3 On-chain identifiers

Wallet addresses, transaction hashes, and token contract addresses should be captured both as plain text and in their original context. A wallet address copied from a tweet is more probative if the original tweet is preserved with the address visible than if the address is extracted in isolation.

Each transaction of interest should be recorded with: hash, originating chain, block height (or slot, on Solana), timestamp, sender, receiver, value, and any token transfer the transaction triggers. Block explorers expose all of this; the investigator should not rely on the explorer remaining accessible — the underlying data should be saved.

### 3.4 The legality boundary

Preservation is the lawful gathering of public information. It is not law enforcement. Three lines must be respected:

- **No unauthorised access.** Public web pages, public chains, and content the victim shares willingly are within scope. Accounts belonging to others, even where credentials are guessable or have been shared, are not.
- **No impersonation.** The investigator should not assume a false identity to obtain information from suspects, victims, or third parties beyond the minimal pseudonymity that platforms ordinarily allow.
- **No tampering.** Evidence is preserved as found. Altering content before saving, or saving in a way that obscures provenance, weakens or destroys the value of the material.

A casefile that documents unlawful collection methods is, in most jurisdictions, worse than a casefile that has nothing at all.

## 4. On-Chain Identifier Collection

The second collection phase converts a list of mentions into a structured map of on-chain entities and their relationships. This phase is mechanical when done properly and ambiguous when done quickly.

### 4.1 Wallet addresses

For every wallet address in scope, record:

- The chain on which it exists (an address that looks similar across EVM chains is not necessarily the same actor).
- Whether it is an externally-owned account (EOA) or a smart contract, by inspecting the address on the chain's block explorer.
- For EOAs: first activity date, last activity date, total inflow and outflow in native currency, and any labels offered by the block explorer (with caution — explorer labels are unaudited).
- For smart contracts: deployer address, deployment block, verified source where available, and the contract's effective function set.

### 4.2 Token contracts

Token contracts deserve a dedicated record:

- Address, chain, symbol, name, decimals.
- Deployer address and deployment transaction.
- Whether the source is verified on a block explorer.
- Notable functions, particularly those affecting supply (mint, burn), transfer (taxes, allow-lists, pauses), and ownership (renounceOwnership, transferOwnership, upgradeable proxies).
- Initial supply distribution: how many addresses received tokens at deployment, in what proportions.

### 4.3 Relationships between addresses

The investigator should construct, at minimum:

- **Direct transactions**: which addresses have sent value or tokens directly to which others, in what amounts and at what times.
- **Indirect flows via aggregators**: where funds pass through mixers, bridges, or aggregating services, note the entry and exit points even where the through-path is not recoverable.
- **Deposits to centralised platforms**: where funds reach an address operated by a centralised exchange, custodian, or payment processor, note the address and the platform if it can be identified. The KYC information of the depositor is *not* public and can only be obtained through legal process.

### 4.4 Liquidity-pool inspection

Where the case involves a token launched against a liquidity pool, the investigator should record:

- The pool's contract address, the pair it contains, and the chain.
- The address that provided initial liquidity, the LP tokens received, and where those tokens are currently held.
- Any subsequent liquidity additions or removals, with addresses, times, and amounts.
- Whether the LP position is locked (in a recognisable lock contract) or remains transferable.

A liquidity removal that coincides with social-media silence and a price collapse is the on-chain signature of a rug pull; the timing comparison must be precise.

### 4.5 Tooling, generically

Block explorers are the canonical primary source for on-chain data. Major EVM networks (Ethereum, BNB Smart Chain, Polygon, Arbitrum, Base, Optimism) each have at least one widely-used explorer; Solana has its own; other ecosystems have local equivalents. Commercial chain-analysis platforms exist and offer entity-level labelling and clustering at scale; their findings are not public-source and must be cited carefully if used in a deliverable that will be challenged.

For investigators outside commercial-tool subscriptions, the practical workflow is: block explorer for individual transactions, full-node access (own or hosted) for batch queries, and one or more lightweight clustering scripts for relationship mapping. None of these are necessary for casework that does not require quantitative claims about flows; the simple chronology of named addresses is often sufficient.

### 4.6 Public versus non-public

A persistent confusion deserves explicit framing. The chain is public; the identities behind addresses are not. Anything the investigator can derive from chain data alone is in principle reproducible and disclosable. Anything that connects an address to a real-world identity must be derived either from a public statement by the address owner, from a leaked or otherwise-public association, or from legal process. The casefile must reflect this distinction; conflating chain data with identity data is the most common methodological error in retail-facing crypto investigation.

## 5. Off-Chain Identifier Collection (OSINT)

The off-chain phase joins the on-chain map to the social layer. It is also the phase where the largest number of investigators err on the wrong side of the legality boundary.

### 5.1 What to collect

- **Founder and team identities** as presented on the project website, on the launchpad page, and on professional networks (LinkedIn, GitHub, academic profiles). The presented identity is collected as-is; verification follows separately.
- **Domain history**: WHOIS records (acknowledging that registrar privacy is now widespread), DNS history if available, registrar identity, and historical archives via public web archiving services.
- **Social-media presence**: project accounts, founder accounts, promoter accounts. For each, record handle, display name, creation date, follower count at the time of collection, location and other declared metadata, and at least the first and last visible posts.
- **Public messaging channels**: Telegram and Discord servers, with the channel name, creation date, admin list (where visible), and a chronological export of announcements.
- **Promoter activity**: where key opinion leaders endorsed the project, capture the endorsing posts, their dates, and the disclosure attached (or its absence).
- **Press coverage and second-order references**: blog posts, podcast appearances, conference listings. These are useful both as primary content and as cross-references against the project's own claims.

### 5.2 The OSINT red line

OSINT, properly defined, is the structured collection of information that is genuinely public. It is not a euphemism for intrusion. The following are *not* OSINT and must not appear in the playbook of a credible investigator:

- **Social engineering** of suspects, victims, or third parties to elicit non-public information.
- **SIM swap, phishing, or any technique that aims to take over an account**, including a suspect's account. The investigator who does this becomes an offender and loses the protection of every other section of this document.
- **Credential reuse** of leaked password dumps, except in narrowly defined research contexts authorised by counsel.
- **Access to private chats** to which the investigator was not knowingly invited.
- **Doxxing** in the sense of publishing personally identifiable information of natural persons for retributive purposes, as opposed to documenting it in a casefile for legitimate handover to authorities.

Any technique that would be a crime if performed by a private citizen against a private citizen does not become permissible because the target is suspected of fraud. The presumption of innocence applies; the investigator's role is to compile evidence, not to render verdicts.

### 5.3 Founder identity verification

Where a founder is named, verification proceeds against pre-existing institutional traces. A genuine identity tends to leave a trail predating the project: an academic publication, a corporate registry entry, prior employment that is corroborated by an institution rather than self-asserted, a passport-grade photograph in a context outside the project itself. Absence of such traces is not proof of fabrication, but it is a relevant data point to record.

Reverse image searches against the founder's photograph, comparison of declared employment dates against the corresponding institution's public records, and cross-checking against patent or publication databases are within scope and lawful. Inferring an identity by means that would intrude on third parties — for instance, by contacting former employers under false pretences — is not.

### 5.4 Sockpuppet detection

Detection of coordinated inauthentic activity proceeds on observable signals: account creation dates clustered around a launch window, profile photos that reverse-image-search to AI generation or stock-image origins, posting cadence inconsistent with a human schedule, lexical templates repeated across nominally independent accounts. The methodological caution: clustering signals are statistical, not deterministic, and apparent sockpuppets can be ordinary fans of a project. The casefile should record observations as observations, not as conclusions.

### 5.5 Cross-referencing the on-chain map

A productive off-chain phase will revisit Section 4 repeatedly. A wallet that received tokens at deployment may belong to an account that publicly endorsed the project later; an account that posts a particular wallet as a tip address has bound the two surfaces. Each such bridge should be recorded explicitly and dated.

## 6. Behavioural Patterns

The behavioural phase reads what has been collected for patterns that recur across fraud cases. The aim is to characterise the case, not to render judgment.

### 6.1 Dark-pattern catalogue

A separate document in this series catalogues fifteen interface and discourse patterns observed in crypto fraud cases. The investigator should refer to it as the controlled vocabulary for naming patterns in the casefile, rather than re-deriving categories case by case. The five high-level categories — manufactured urgency, social pressure, technical interface manipulation, financial misrepresentation, identity manipulation — capture most of the relevant surface.

### 6.2 Unrealistic-return claims

Marketing copy promising fixed or high returns ("guaranteed yield", "next 100x") is one of the most reliable signatures. Recordable observations include the exact phrasing, the date of first appearance, the platform on which it appeared, and any quantitative claims (percentages, multiples, timelines). The investigator should resist the temptation to dismiss such copy as merely "puffery"; in many jurisdictions, specific return promises in the context of an investment product are a regulated act.

### 6.3 Sudden team behaviour shifts

The signature of an exit is operational: roadmap items disappear, channel admins go quiet or rotate, posts are deleted, liquidity is moved or removed, and customer-support channels stop responding. A chronological reconstruction of the last week of project activity often shows a recognisable pattern. The casefile should preserve the surfaces that disappear, in archive form, before they are lost.

### 6.4 Astroturfing and sockpuppets

Recapitulating Section 5.4 in the analytical register: the case for astroturfing is built on multiple weak signals, not on one strong signal. Account creation clustering, lexical reuse, follower-overlap, posting-time inconsistency, and engagement-to-reach disproportion each contribute. The casefile should enumerate the signals observed and the inference made, rather than asserting the conclusion as fact.

### 6.5 Victim profile

Without speculating about individuals, the case can usefully record the cognitive vulnerabilities the operation appears to exploit. Common archetypes include: the fear-of-missing-out victim (high promised returns; urgency framing), the authority-deference victim (apparent endorsement by a respected figure), the catch-up victim (the perception of a last chance to recoup prior losses), the romance victim (a months-long social relationship preceding the financial request), and the recovery-scam victim (a second loss inflicted by an actor claiming to help recover the first).

The profile is descriptive: it characterises what the operation targets, not what is wrong with the victim. The shift from one register to the other is a recurrent ethical failure of the field.

## 7. Casefile Structure

A casefile is the durable artefact the investigation produces. The structure below is a minimum: it captures the elements that must be present for the casefile to be useful to a third party — a successor investigator, a lawyer, a journalist, an authority — who did not participate in the original work.

### 7.1 C1 — Identification

- Project name, ticker, mint or contract address.
- Chain(s) on which the project operates.
- First observed date; date of report; date of presumed exit, if known.
- The platforms on which the project was promoted.

### 7.2 C2 — Chronology

A dated table of events: project creation, social-media debut, presale, token-generation event, liquidity addition, peak activity, anomalies, suspected exit, public reports. Each event is dated to UTC where possible, and the source of the date is cited (an archived page, a transaction hash, a public post).

### 7.3 C3 — Actors

- **Project team**: names presented, social-media handles, supporting institutional traces (or their absence).
- **Promoters**: key opinion leaders, with handles, dates of relevant posts, and disclosure status.
- **Victims**: numbered and anonymised. The casefile must never identify victims by name in a document that may be shared. A separate, access-controlled register may hold the mapping between case-numbers and identities for the duration the investigation requires.

### 7.4 C4 — On-chain flows

The structured map produced in Section 4: wallets, transactions, token contracts, pool activity, and the relationships among them. Where the casefile makes a quantitative claim (total inflow, total loss, beneficiary share), the underlying transactions are cited.

### 7.5 C5 — Off-chain flows

The structured material from Section 5: domains, social-media accounts, channel exports, press coverage. Each artefact is referenced by its chain-of-custody identifier rather than re-included in the narrative; the casefile is the index, the evidence repository is the storage.

### 7.6 C6 — Patterns detected

The named patterns from Section 6 that the case displays, with the specific evidence supporting each. A pattern is not asserted without evidence; if a pattern is suspected but not evidenced, it is noted as a hypothesis pending verification.

### 7.7 C7 — Loss estimation

Loss estimation is the section in which methodological humility matters most. A defensible loss estimate distinguishes between gross outflows from victims' wallets, net outflows after price recovery, and the operator's realised proceeds, which may differ from either. The casefile should:

- Define the loss measure being used.
- Cite the price source and the timestamp at which prices were taken.
- Provide a range rather than a point estimate where data is sparse.
- Note assumptions, particularly about whether transactions are net of slippage and fees, and whether on-chain volume includes wash trading.

### 7.8 C8 — Recommendations

Recommendations addressed to victims are descriptive of the options that exist in their jurisdiction. Possible elements include: reporting channels (Section 9), the option to consult counsel, victim-support organisations, and the operational fact that recovery rates are low and that further "recovery services" approaching the victim are themselves typically fraudulent.

The casefile does not direct victims; it presents options. The line between informing and advising is jurisdiction-dependent and should be respected.

## 8. Methodological Limits and Red Flags

### 8.1 Confirmation bias

The most common error in investigation is to construct a theory early and then collect material to support it. The discipline of disconfirmation — actively seeking the evidence that would falsify the working theory — is the practical antidote. A casefile that does not include a section on the evidence considered and rejected is incomplete.

### 8.2 Attribution

"Wallet controlled by X" is not the same as "wallet used by X". Addresses are lent, compromised, phished, traded as accessories, and operated by services on behalf of users. An attribution that rests on a single signal is brittle; an attribution that rests on multiple signals, each of which can be checked independently, is durable. The casefile should label its attributions on this scale and avoid the appearance of certainty it has not earned.

### 8.3 Price reconstruction

Historical prices on illiquid tokens are difficult to recover faithfully. Aggregator APIs may differ across sources; on-chain reconstruction requires careful handling of slippage, fees, and MEV; reported volumes frequently include wash trades. Loss estimates that depend on price are necessarily ranges; the casefile should express them as such.

### 8.4 Mistaken identity

Real identities are routinely confused with one another in the field: shared names, similar handles, repurposed photographs, identities that have themselves been compromised or assumed by an unrelated party. Where the casefile names an individual, the investigator should be prepared to defend the attribution against the most strenuous challenge.

### 8.5 The ethical envelope

A public investigation, badly calibrated, can harm an innocent person. Investigators carry a duty of care that survives the strength of their belief in their working theory. Rigour here is not procedural decoration; it is the ethical obligation that distinguishes investigation from accusation.

## 9. Reporting and Victim Orientation

### 9.1 Reporting channels by jurisdiction

The table below lists the principal first-line reporting channels in selected jurisdictions. It is not exhaustive; readers should verify each entry against the relevant authority's current materials, as agency names and remits change.

| Jurisdiction | Primary fraud reporting | Securities-related conduct | Money laundering / financial intelligence |
|--------------|--------------------------|----------------------------|--------------------------------------------|
| France       | Procureur de la République; PHAROS (online content); SignalConso | Autorité des marchés financiers (AMF) | Tracfin |
| Germany      | Local police; central cybercrime units (LKA) | Bundesanstalt für Finanzdienstleistungsaufsicht (BaFin) | Financial Intelligence Unit (Zoll-FIU) |
| Italy        | Polizia Postale; Carabinieri | Commissione Nazionale per le Società e la Borsa (CONSOB) | Unità di Informazione Finanziaria (UIF) |
| Spain        | Policía Nacional; Guardia Civil GDT | Comisión Nacional del Mercado de Valores (CNMV) | SEPBLAC |
| United Kingdom | Action Fraud | Financial Conduct Authority (FCA) | National Crime Agency (NCA) |
| Netherlands  | Politie; Fraudehelpdesk | Autoriteit Financiële Markten (AFM) | FIU-Nederland |
| United States | FBI Internet Crime Complaint Center (IC3); Federal Trade Commission (FTC) | Securities and Exchange Commission (SEC); Commodity Futures Trading Commission (CFTC) | Financial Crimes Enforcement Network (FinCEN) |
| Canada       | Canadian Anti-Fraud Centre (CAFC) | Canadian Securities Administrators (provincial) | FINTRAC |
| Australia    | Scamwatch; ReportCyber | Australian Securities and Investments Commission (ASIC) | AUSTRAC |
| Switzerland  | Cantonal police; National Cybersecurity Centre (NCSC) | Eidgenössische Finanzmarktaufsicht (FINMA) | MROS |
| Singapore    | Singapore Police Force | Monetary Authority of Singapore (MAS) | Suspicious Transaction Reporting Office |
| Japan        | National Police Agency Cyber Bureau | Financial Services Agency (FSA) | Japan Financial Intelligence Center (JAFIC) |

European Union-level coordination is provided through ESMA on securities matters and Europol on serious cross-border crime; neither receives individual victim reports directly.

### 9.2 Victim-support organisations

Several non-profit organisations dedicated to crypto-fraud victims operate in major markets. They typically provide initial guidance, peer support, and referral to specialist counsel. Their existence is mentioned here without naming any in particular, because the population is fluid and a list that is current at publication is unlikely to remain so. The investigator should maintain a current local list outside this document.

### 9.3 The recovery-scam warning

Victims who have already lost funds are at heightened risk of being targeted again by actors claiming to recover those funds. The pattern is sufficiently common that the casefile recommendations should mention it explicitly, with the practical guidance that legitimate recovery does not normally require upfront payment, sharing of seed phrases, or remote access to wallets.

### 9.4 Limits

Reporting opens a process; it does not guarantee an outcome. Investigators advising victims should set expectations honestly: most retail crypto fraud cases produce no recovery, even where reported promptly and well. A casefile that goes unprosecuted is nevertheless a contribution to the public record and to the prevention of repetition.

## 10. Glossary

**Astroturfing.** Coordinated activity by accounts presented as independent, designed to manufacture an appearance of organic consensus.

**Attribution.** The reasoned linkage of an action, address, or artefact to a specified actor; in practice always a probabilistic claim, never a certainty.

**Block height.** The sequence number of a block within its chain, used as a stable timestamp surrogate.

**Casefile.** The structured record of an investigation, including chronology, actors, evidence references, and analytical conclusions.

**Chain analysis.** The structured study of blockchain transaction graphs, including clustering of addresses into entities and the tracing of flows.

**Chain of custody.** The documented sequence of who possessed an item of evidence and when, sufficient to demonstrate that the item has not been altered between collection and presentation.

**Doxx.** The disclosure of a real-world identity behind a pseudonymous online presence. Documenting an identity in a casefile is distinct from publishing it for retributive purposes; the latter is what the term typically denotes in popular use.

**Drainer.** A class of malicious smart contract or script that, when authorised by a victim signature, transfers value out of the victim's wallet.

**Dusting.** The transfer of a trivial amount of token to many addresses, often as a tactic to track wallet linkage or to seed phishing.

**EOA.** Externally-owned account; a blockchain address controlled by a private key, as distinct from a smart-contract address.

**Hash.** A fixed-length digest of arbitrary input, used here both as a cryptographic identifier for evidence files (typically SHA-256) and for transactions (the transaction hash).

**KOL.** Key opinion leader; an account with substantial reach whose endorsements influence followers.

**LP.** Liquidity provider, or, by extension, the LP token representing a claim on a liquidity pool's reserves.

**MEV.** Maximal extractable value; value captured by reordering, including, or excluding transactions within a block.

**Mixer.** A protocol that pools deposits from many users and disburses them to fresh addresses, intended to break the public linkage between source and destination.

**OSINT.** Open-source intelligence; the structured collection of genuinely public information for investigative purposes.

**Peeling chain.** A pattern of successive transfers in which a wallet sends most of its balance to a fresh address and a small remainder to another address, repeated; the pattern is associated with obfuscation of large flows.

**Plain sight.** A descriptive register for evidence accessible without intrusion: public posts, public chains, public registries.

**Red team.** A perspective in which an analyst deliberately attempts to disprove a working hypothesis.

**Retail.** Non-professional individual participants in financial markets, in contrast to institutional participants.

**Slippage.** The difference between the price quoted for a swap and the price at which it executes; permitted slippage is a permission granted to the routing contract.

**Smart contract.** Code deployed to a blockchain that executes deterministically when invoked; functionally distinct from an externally-owned account.

**Sockpuppet.** An account operated by an actor distinct from its presented identity.

**Txhash.** Transaction hash; the unique identifier of a confirmed transaction on a blockchain.

## 11. References

The following references are cited in the playbook or in the closely related dark-patterns taxonomy. Readers are encouraged to verify currency and to consult primary sources directly; where institutional documents are referenced, the institutional name is the authoritative locator.

1. Brignull, H. (2010). *Dark Patterns* (originally darkpatterns.org, now deceptive.design). Foundational treatment of the term used in Section 6.
2. European Parliament and Council. (2022). *Regulation (EU) 2022/2065 on a Single Market for Digital Services (Digital Services Act)*. Article 25 on dark patterns.
3. European Parliament and Council. (2023). *Regulation (EU) 2023/1114 on Markets in Crypto-Assets (MiCA)*. Marketing-communication obligations.
4. Financial Action Task Force. (2021). *Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers*. FATF.
5. Federal Trade Commission. (2022, September). *Bringing Dark Patterns to Light*. FTC Staff Report.
6. Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., & Narayanan, A. (2019). *Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites*. Proceedings of the ACM on Human-Computer Interaction, CSCW.
7. Mathur, A., Kshirsagar, M., & Mayer, J. (2021). *What Makes a Dark Pattern... Dark? Design Attributes, Normative Considerations, and Measurement Methods*. Proceedings of the 2021 CHI Conference.
8. Europol. *Internet Organised Crime Threat Assessment (IOCTA)*, annual editions. Europol Publications.
9. Eurojust. *Report on Eurojust's Casework on Crypto Assets*. Eurojust Publications.
10. OECD. (2022). *Dark commercial patterns*. OECD Digital Economy Papers, No. 336.

Additional references on chain analysis and on-chain investigation methodology are available in the academic literature on cryptocurrency forensics; readers undertaking quantitative work should consult that literature directly rather than relying on intermediated summaries.

## 12. Disclaimer

This document is educational. It describes a methodology and does not name any specific entity, project, person, or case. It is not legal advice, does not authorise any action that would be unlawful in the reader's jurisdiction, and does not substitute for the institutional procedures of any authority.

The reporting channels listed in Section 9 were believed to be current at the date of publication; agency names and remits change, and the reader is responsible for confirming current contact information before using the listings operationally.

References to legal frameworks (Digital Services Act, MiCA, FATF guidance, and others) are summary in nature and are not a substitute for reading the underlying texts or for advice from counsel qualified in the relevant jurisdiction.

The investigator who applies this playbook does so on their own responsibility. The authors decline any liability for the consequences of its use or misuse.

INTERLIGENS Research, 2026. Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). Permitted to be redistributed and adapted for non-commercial purposes with attribution.
