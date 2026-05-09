/**
 * /guard — Phantom Guard, the live distribution layer of the
 * INTERLIGENS engine.
 *
 * Voice: producer-side, descriptive, not promotional. Phantom Guard is
 * positioned as the moment the dossier engine reaches the wallet. It is
 * not a wallet scanner. It is not a freebie. Pricing is not yet decided
 * — the page never names a model. Distribution language stays at
 * "early access".
 *
 * Single working address: guard@interligens.com.
 */

import type { ClassificationContext } from "@/lib/contracts/website";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";

export const GUARD_CLASSIFICATION: ClassificationContext = MOCK_CLASSIFICATION;

export const GUARD_EARLY_ACCESS_EMAIL = "guard@interligens.com";

export const GUARD_EARLY_ACCESS_SUBJECT = "Phantom Guard · Early Access Request";

export const GUARD_HERO = {
  kicker: "DISTRIBUTION · PHANTOM GUARD",
  title: "Intelligence at the point of signature.",
  dek: "Phantom Guard is the live distribution layer of the INTERLIGENS engine. It carries the dossier — the score, the casefile, the cluster — to the place a decision is actually made: the wallet, the approval, the transaction.",
  primaryCta: "Request early access",
  secondaryCta: { label: "Read the engine", href: "/methodology" },
  positionLine: "Before the signature. Not after.",
};

export type GuardScenario = {
  num: string;
  tag: string;
  title: string;
  body: string;
  signal: string;
  tone: "risk" | "caution" | "signal";
};

export const GUARD_SCENARIOS: GuardScenario[] = [
  {
    num: "01",
    tag: "APPROVAL · UNLIMITED",
    title: "A setApprovalForAll on a contract whose deployer sits inside a documented drainer cluster.",
    body: "Guard reads the calldata before the wallet asks you to sign. The deployer is matched against published drainer clusters. The approval is named for what it is — full delegation — and the casefile reference is shown in line.",
    signal: "TigerScore 17/100 · Unlimited approval · Deployer: cluster published 2026-03",
    tone: "risk",
  },
  {
    num: "02",
    tag: "HONEYPOT · TRANSFER TRAP",
    title: "A token whose bytecode contains a transfer-blacklist function.",
    body: "Guard runs a static read of the contract bytecode at the moment of intent. A blacklist function is matched. The path is named — buy permitted, sell blocked — and the source of the read is hashed into the verdict.",
    signal: "Bytecode trap · Sell path obstructed · Source: on-chain bytecode, hashref attached",
    tone: "risk",
  },
  {
    num: "03",
    tag: "KOL CLUSTER · CASEFILE LINK",
    title: "A contract pushed by an account inside a published KOL cluster.",
    body: "Guard cross-walks the originating address and front-running pattern against published actor dossiers. When the cluster has a casefile open, the verdict carries a link to the casefile rather than a generic warning.",
    signal: "Linked to @bkokoski cluster · Casefile open · See /cases/botify",
    tone: "caution",
  },
  {
    num: "04",
    tag: "SIGNATURE · UNSAFE PATH",
    title: "A signed message that grants control without being a transaction.",
    body: "Permits, off-chain orders, opaque EIP-712 payloads. Guard parses the signature payload, reconstructs what is actually being authorised, and refuses to translate it into a single-line summary unless the structure is safe to summarise.",
    signal: "Signature, not transaction · Spender: external · Reconstructed payload shown",
    tone: "caution",
  },
];

export type GuardEnginePillar = {
  num: string;
  label: string;
  title: string;
  body: string;
};

export const GUARD_ENGINE_PILLARS: GuardEnginePillar[] = [
  {
    num: "01",
    label: "TIGERSCORE",
    title: "The reading the dossier already gave.",
    body: "Guard does not compute its own score. It surfaces the same TigerScore the public registry carries — the same composite of on-chain behaviour, cluster proximity, and credibility — at the wallet, not on a page.",
  },
  {
    num: "02",
    label: "OPEN EVIDENCE",
    title: "Verdicts pinned to verifiable buckets.",
    body: "Every Guard verdict references the bucket — verified, corroborated, observed — that supports it. The bucket is the contract; Guard does not invent a tier of its own.",
  },
  {
    num: "03",
    label: "CASEFILES",
    title: "When a casefile exists, Guard links it.",
    body: "If the contract or counterparty falls inside a published casefile, the verdict carries a casefile reference rather than a generic warning. The reader is one click from the artifact.",
  },
  {
    num: "04",
    label: "KOL · ACTOR INTELLIGENCE",
    title: "Cluster identity, surfaced live.",
    body: "Guard maps the originating address against the published actor registry. When the address belongs to a documented cluster, Guard names the cluster and carries the dossier link.",
  },
  {
    num: "05",
    label: "CONSTELLATION",
    title: "The graph reaches the wallet.",
    body: "Counterparty topology — peel chains, bridges, exits, KOL relations — is read from the same graph that powers /constellation. Guard surfaces the relevant edges; the reader can walk the rest.",
  },
  {
    num: "06",
    label: "PUBLICATION DISCIPLINE",
    title: "What we hold, Guard holds.",
    body: "Entities under verification do not surface as verdicts. The takedown window is honoured. PERSON-type intelligence is never retail-visible. The publication threshold is the same on the page and in the wallet.",
  },
];

export type GuardDifferencePoint = {
  num: string;
  generic: string;
  guard: string;
};

export const GUARD_DIFFERENCE_POINTS: GuardDifferencePoint[] = [
  {
    num: "01",
    generic: "Generic wallet scanners flag known scams from a static list.",
    guard: "Guard reads from a registry that is investigated, scored, and published — and updated by the same editorial discipline as /cases.",
  },
  {
    num: "02",
    generic: "Pop-ups warn after the transaction is structured, when the wallet asks for a signature.",
    guard: "Guard reads intent at the moment a contract is hovered, an approval is being prepared, a payload is being assembled — before the signature is asked for.",
  },
  {
    num: "03",
    generic: "Risk widgets compress every signal into a colour and a number.",
    guard: "Guard surfaces the underlying claim — the bucket, the casefile, the cluster — so the verdict is auditable, not a vibe.",
  },
  {
    num: "04",
    generic: "Most security extensions never publish what they catch.",
    guard: "Guard runs against the same public record INTERLIGENS publishes. Every verdict can be walked back to a dossier, an evidence bucket, or a casefile.",
  },
];

export type GuardChainStage = {
  num: string;
  label: string;
  title: string;
  body: string;
  href?: string;
};

export const GUARD_CHAIN_STAGES: GuardChainStage[] = [
  {
    num: "01",
    label: "SCAN",
    title: "An address, a token, a handle.",
    body: "Public-side intake. The retail entry to the engine.",
    href: "/scan",
  },
  {
    num: "02",
    label: "EVIDENCE",
    title: "Three buckets, one trail.",
    body: "Verified, corroborated, observed. Every signal is labelled before it is used.",
    href: "/evidence/vine",
  },
  {
    num: "03",
    label: "CASEFILES",
    title: "What a court could read.",
    body: "Hashes, flow stages, filing panel. The artifact stands on its own.",
    href: "/cases",
  },
  {
    num: "04",
    label: "CONSTELLATION",
    title: "The graph is the proof.",
    body: "Counterparties, peel chains, bridges, KOL relations. The topology of the case.",
    href: "/constellation",
  },
  {
    num: "05",
    label: "GUARD",
    title: "At the point of signature.",
    body: "The same intelligence, surfaced where the decision is made.",
  },
];

export const GUARD_DIFFERENCE_INTRO = {
  kicker: "DISTINCTION",
  title: "Why Guard is not a wallet scanner.",
  dek: "Wallet scanners react to known scams from a static list. Guard distributes a published forensic record at the moment of signature. The two are not adjacent products; they are different categories.",
};

export const GUARD_ENGINE_INTRO = {
  kicker: "ENGINE",
  title: "Built on the INTERLIGENS engine.",
  dek: "Guard is not autonomous. It is the live face of the same engine that produces the public registry — the dossiers, the casefiles, the constellation. The discipline is the same; only the surface changes.",
};

export const GUARD_SCENARIO_INTRO = {
  kicker: "SCOPE · WHAT GUARD SEES",
  title: "Four scenes, read before the signature.",
  dek: "These are the kinds of moments Guard intercepts. Not exhaustive — illustrative. Each scenario shows what is read, what is matched, and which part of the public record the verdict references.",
};

export const GUARD_CHAIN_INTRO = {
  kicker: "SYSTEM · WHERE GUARD FITS",
  title: "From scan to signature, one engine.",
  dek: "Scan, evidence, casefiles, constellation, Guard. The dossier engine produces the record; Guard is the surface that carries it to the moment a wallet is asked to act.",
};

export const GUARD_EARLY_ACCESS = {
  kicker: "DISTRIBUTION · EARLY ACCESS",
  title: "Available via early access.",
  body: "Phantom Guard is rolled out by request. There is one working address. Write from a domain you operate, name the surface you are signing on, and we open the channel from there.",
  noteLine: "One working address · Read before writing.",
};

export const GUARD_CLOSING = {
  id: "closing",
  kicker: "10 · CLOSING",
  title: "The engine reaches the wallet.",
  body: "INTERLIGENS publishes the dossier. Phantom Guard carries it forward — to the approval, to the signature, to the moment the decision is irreversible.\nThe credibility comes from the engine. The point of contact is Guard.",
};
