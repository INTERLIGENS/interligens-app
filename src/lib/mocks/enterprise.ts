/**
 * /enterprise — institutional / partners / desks / investigations surface.
 *
 * The page sits next to /about and /press as an institutional surface,
 * not a sales page. Voice is institutional: declarative, specific,
 * non-commercial. Three product decisions are explicitly NOT acted on
 * here: Phantom Guard's product status, business model / pricing, and
 * the INTERLIGENS / LIBERTAS frontier. The page must read the same
 * regardless of how those land.
 *
 * Wording constraints (enforced):
 *  - "enterprise" appears in the route and the breadcrumb only. It is
 *    never used here as a marketing adjective.
 *  - No "licensing", "subscription", "tier", "annual", "monthly".
 *  - No "pricing", "fee", "billed", "starting from", "from $X".
 *  - No "30-min call", "weekly briefing", "demo call".
 *  - No "book a demo", "schedule a meeting", "get a quote".
 *  - Engagement modes use conversational phrasing only:
 *    "request access", "open a conversation", "introduce your team",
 *    "share your context".
 */

export type EnterpriseSection = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
};

export type AudienceCategory = {
  num: string;
  kicker: string;
  title: string;
  body: string;
};

export type SystemOffering = {
  num: string;
  kicker: string;
  title: string;
  body: string;
};

export type EngagementMode = {
  num: string;
  kicker: string;
  title: string;
  body: string;
  /** Conversational action label. Mailto only. */
  actionLabel:
    | "Request access"
    | "Open a conversation"
    | "Introduce your team"
    | "Share your context";
  /** Mail subject prefix appended to the partnerships address. */
  subjectHint: string;
};

// Single source of truth for the partnerships contact address. Real,
// not a TO_FILL — confirmed in the brief. Mailto only; the page does
// not host a form that submits anywhere.
export const PARTNERSHIPS_CONTACT_EMAIL = "partnerships@interligens.com";

export const ENTERPRISE_HERO = {
  kicker: "INSTITUTION · PARTNERS",
  title: "Beyond the score, a working surface.",
  dek: "INTERLIGENS publishes documented intelligence on crypto entities, wallets, and KOLs under a public editorial standard. This page is the working entry point for organisations, desks, and partners that want to read the system at depth — and, where it is appropriate, work alongside it.",
};

export const ENTERPRISE_OPENING: EnterpriseSection = {
  id: "opening",
  kicker: "00 · WHY BEYOND A SCORE",
  title: "Some readers need more than a verdict.",
  body: "A retail reader can act on a TigerScore in seconds. An investigator, a research desk, a compliance-adjacent analyst, a journalist on deadline — they need to walk the trail behind the score, weigh the bucket of evidence under it, see the topology around the entity, and understand the editorial standard that put the claim on the public record.\nINTERLIGENS was built so that work is the same artifact: the same casefile a retail reader skims is the casefile a structured reader takes apart. The score is the entry point. The system underneath is what this page is about.\nThis is not a pitch. It is a working address for organisations that read crypto-native risk professionally and want to know what the surface beneath the score offers them.",
};

export const AUDIENCE_INTRO = {
  kicker: "01 · WHO IT CAN SERVE",
  title: "Structured readers, not retail.",
  dek: "INTERLIGENS is publicly readable; the surface beneath it is built for organisations that already read crypto-native risk for a living. The categories below describe who that work tends to serve. They are not customer claims, and naming a category here is not a promise that we have served it.",
};

export const AUDIENCE_CATEGORIES: AudienceCategory[] = [
  {
    num: "01",
    kicker: "INVESTIGATORS",
    title: "On-chain investigations and analysts.",
    body: "Teams already running blockchain forensics workflows: cluster analysis, attribution, peel-chain reconstruction. INTERLIGENS surfaces casefiles and constellation topologies under a public editorial standard they can quote against.",
  },
  {
    num: "02",
    kicker: "RESEARCH DESKS",
    title: "Crypto-native research and intelligence.",
    body: "Sell-side and independent research desks that need a documented, hash-recoverable reading of an entity, a cluster, or a KOL — built so the artifact survives a careful review by a third party.",
  },
  {
    num: "03",
    kicker: "DUE DILIGENCE",
    title: "Counterparty and asset diligence teams.",
    body: "Teams responsible for reading a wallet, a token, or a public figure before a position, a partnership, or an exposure — and for documenting the basis on which that reading was made.",
  },
  {
    num: "04",
    kicker: "JOURNALISTS",
    title: "Investigative reporters and editors.",
    body: "The press address remains the working entry point for media work. Where a story needs an evidence-backed, hash-recoverable artifact, INTERLIGENS publishes one. Press queries: see /press.",
  },
  {
    num: "05",
    kicker: "COMPLIANCE-ADJACENT",
    title: "Analysts working next to formal compliance.",
    body: "Not a compliance product. Where an analyst already operates inside a documented framework and needs an external, independently-published reading to corroborate or challenge their own, the casefile artifact is built to be quoted on the record.",
  },
  {
    num: "06",
    kicker: "TRUST & INTEGRITY",
    title: "Incident, trust, and integrity teams.",
    body: "Teams reading a sudden incident — a token rug, a wallet exit, a KOL flip — under deadline. The constellation graph, evidence buckets, and takedown record exist so that reading is reproducible after the fact.",
  },
  {
    num: "07",
    kicker: "PARTNERS",
    title: "Aligned platforms and ecosystems.",
    body: "Surfaces and ecosystems that read crypto risk on behalf of their own users. Conversations about how INTERLIGENS work might be referenced, surfaced, or read alongside theirs are open — see modes of engagement below.",
  },
];

export const SYSTEM_OFFERINGS_INTRO = {
  kicker: "02 · WHAT THE SYSTEM OFFERS",
  title: "Five surfaces, one editorial standard.",
  dek: "The platform is not a single tool. It is a stack of surfaces, each documented, each governed by the same publication discipline — built so a structured reader can walk it without losing the thread.",
};

export const SYSTEM_OFFERINGS: SystemOffering[] = [
  {
    num: "01",
    kicker: "TIGERSCORE · TRIAGE",
    title: "A composite reading as entry point.",
    body: "On-chain behaviour, off-chain credibility, cluster proximity, sanction exposure — combined under a published methodology. For a structured reader, the score is triage: the signal that decides whether the casefile is worth opening at depth.",
  },
  {
    num: "02",
    kicker: "OPEN EVIDENCE",
    title: "Three buckets, one trail.",
    body: "Verified is hash-recoverable. Corroborated has two independent sources. Observed is a logged pattern. Tiers are never silently mixed. A desk re-reading our work can tell, by label, what the claim is allowed to support.",
  },
  {
    num: "03",
    kicker: "CASEFILES",
    title: "Court-readable artifacts.",
    body: "Dossier hero, flow stages, filing panel, evidence rail, annex grid, editorial standard footer. Every figure carries a hashref. Every claim links a bucket. The artifact is built to be quoted at length and re-walked from the citations.",
  },
  {
    num: "04",
    kicker: "CONSTELLATION",
    title: "The graph as the proof.",
    body: "Counterparties, peel chains, bridges, exits — the network around an entity, with role-typed nodes and kind-typed edges. A structured reader walks the topology directly; a casefile is a path through the graph that other readers can re-walk.",
  },
  {
    num: "05",
    kicker: "PUBLICATION DISCIPLINE",
    title: "Takedown-active, on the public record.",
    body: "Every casefile is published under a documented standard with a takedown channel open to anyone we name. Filings re-walk the trail under the same standard the work was built on; the revision history is part of the artifact, not an afterthought.",
  },
];

export const ENTERPRISE_DIFFERENCE: EnterpriseSection = {
  id: "difference",
  kicker: "03 · WHY IT IS DIFFERENT",
  title: "Not a scanner. Not a dashboard. Not an opaque feed.",
  body: "Token scanners stop at a score and never publish the trail behind it. Forensic-grade investigator tools sit behind enterprise paywalls and never surface the work to a public reader. AI summary engines generate prose without a chain of evidence. Compliance dashboards report data without taking a position.\nINTERLIGENS is the only one of these that publishes — under a documented standard, with a takedown channel, on a public surface a retail reader can read and a structured reader can re-walk. The depth is not behind a wall. The wall is the editorial standard, and it is published.",
};

export const ENGAGEMENT_MODES_INTRO = {
  kicker: "04 · MODES OF ENGAGEMENT",
  title: "Sober ways to start a conversation.",
  dek: "There is no contract implied by the modes below. They are conversational starting points — chosen so a serious reader can introduce themselves, share context, or ask for access without negotiating a commercial relationship in the first message.",
};

export const ENGAGEMENT_MODES: EngagementMode[] = [
  {
    num: "01",
    kicker: "ACCESS",
    title: "Read the system at depth.",
    body: "If your team already reads crypto-native risk professionally and wants to read INTERLIGENS at the depth a structured reader needs, request access. We will reply with what reading the work at depth currently looks like in practice.",
    actionLabel: "Request access",
    subjectHint: "Access — read at depth",
  },
  {
    num: "02",
    kicker: "PARTNERS",
    title: "Talk about how the work might fit.",
    body: "If you operate a surface, an ecosystem, or a research desk where INTERLIGENS work might be referenced or read alongside your own, open a conversation. We will tell you what is possible, what is not, and where the editorial line sits.",
    actionLabel: "Open a conversation",
    subjectHint: "Partners — context for a conversation",
  },
  {
    num: "03",
    kicker: "TEAMS",
    title: "Make an introduction.",
    body: "If your organisation is considering working alongside INTERLIGENS in a structured way and wants to introduce the team that would read the surface, write to us. A first reply outlines what the next step tends to look like.",
    actionLabel: "Introduce your team",
    subjectHint: "Teams — introduction",
  },
  {
    num: "04",
    kicker: "CONTEXT",
    title: "Share an investigation or a question.",
    body: "If you have a specific entity, cluster, or KOL the work would help you read, share the context. We do not take engagements on demand, but we will read what you send and reply on whether the surface can speak to it.",
    actionLabel: "Share your context",
    subjectHint: "Context — investigation or question",
  },
];

export const ENTERPRISE_BOUNDARY: EnterpriseSection = {
  id: "boundary",
  kicker: "05 · PUBLIC AND PRIVATE",
  title: "What is on the public record, and what is not.",
  body: "The public surface — TigerScores, casefiles, KOL profiles, the constellation graph, the methodology, the takedown channel, the legal notice — is the artifact. It is the record. A retail reader and a structured reader land on the same surface; the difference is the depth they bring to reading it.\nBeyond that surface, parts of the system live in deeper, controlled-access work that is not appropriate to expose publicly: ongoing investigations, sources, the trail of work that has not yet cleared the editorial standard. Those surfaces exist; they are not on this page, and they are not behind a marketing door. Conversations about access to them happen one at a time, on the record, through the address below.",
};

export const ENTERPRISE_PUBLIC_LINES: string[] = [
  "TigerScores on tokens, wallets, and KOLs.",
  "Casefiles under a documented editorial standard.",
  "Constellation graph with role-typed nodes and kind-typed edges.",
  "Methodology, charter, takedown channel, legal notice.",
  "Revision history attached to every published artifact.",
];

export const ENTERPRISE_DEEPER_LINES: string[] = [
  "Investigations that have not yet cleared the editorial standard.",
  "Sources that cannot be exposed without endangering them.",
  "Working notes, drafts, and pre-publication trail.",
  "Surfaces reserved for a structured reader, on a per-conversation basis.",
];

export const ENTERPRISE_CLOSING: EnterpriseSection = {
  id: "closing",
  kicker: "06 · ORIENTATION",
  title: "Where to read next, and where to write.",
  body: "Before writing, read the work. The methodology page documents how a claim is built. The case ledger is where the artifacts live. The constellation entry point is where the graph is read. The legal notice carries the publishing posture. If, after that, your reading is still that the surface beneath the score is something your team should engage with — write to the address below.",
};
