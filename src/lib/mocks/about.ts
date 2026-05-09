/**
 * /about — institutional content.
 *
 * Static, durable. Voice is institutional but not corporate: declarative,
 * specific, evidence-led. No pricing, no product-strategy claims, no
 * Phantom Guard or LIBERTAS positioning — those are unresolved business
 * decisions and the page must read the same regardless of how they land.
 */

export type AboutSection = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
};

export type AboutLayer = {
  num: string;
  kicker: string;
  title: string;
  body: string;
};

export type AboutColumn = {
  kicker: string;
  title: string;
  lines: string[];
  /** Footer note rendered in dim mono, optional. */
  note?: string;
};

export const ABOUT_HERO = {
  kicker: "INTERLIGENS · INSTITUTION",
  title: "Forensic intelligence for the open market.",
  dek: "INTERLIGENS publishes documented intelligence on crypto entities, wallets, and KOLs — built so a retail reader can act on it and an investigator can reproduce it. This page describes what the system does, why it is structured the way it is, and where the line of the work ends.",
};

export const ABOUT_MISSION: AboutSection = {
  id: "mission",
  kicker: "01 · MISSION",
  title: "What we are trying to do.",
  body: "The crypto market produces sophisticated extraction faster than the public can read.\nBy the time a retail victim asks the right question, the trail is already cold and the asset has moved through three bridges and a peel chain.\nINTERLIGENS exists to close that gap — to publish the kind of evidence-led, hash-recoverable intelligence that has historically lived behind subscriptions, NDAs, and law-enforcement walls, and to publish it in a form a careful reader can actually use.",
};

export const ABOUT_WHAT_THIS_IS: AboutSection = {
  id: "what-this-is",
  kicker: "02 · WHAT THIS IS",
  title: "Anti-scam crypto intelligence, on the public record.",
  body: "INTERLIGENS is not a dashboard. It is not a wallet scanner. It is not an AI summary engine.\nIt is a publication system. Every claim is paired with an independently retrievable source. Every score is computed under a documented methodology. Every casefile carries the same editorial standard, the same takedown channel, and the same revision history.\nThe artifact a reader takes away is built to be re-walked by a third party — that is the test we hold ourselves to.",
};

export const ABOUT_DIFFERENCE: AboutSection = {
  id: "difference",
  kicker: "03 · DIFFERENCE",
  title: "Not a feature. A discipline.",
  body: "Generic wallet scanners stop at a verdict number. AI summary tools generate prose without a chain of evidence. Compliance dashboards report data without taking a position. Investigator tools sit behind enterprise paywalls.\nINTERLIGENS is the only one of these that publishes — under a documented standard, with a takedown channel, on a public surface a retail reader can read.\nThe difference is not the technology. The difference is the discipline.",
};

export const ABOUT_LAYERS: AboutLayer[] = [
  {
    num: "01",
    kicker: "TIGERSCORE",
    title: "A composite reading.",
    body: "On-chain behaviour, off-chain credibility, cluster proximity, sanction exposure — combined under a published methodology, not a hidden weight set.",
  },
  {
    num: "02",
    kicker: "OPEN EVIDENCE",
    title: "Three buckets, one trail.",
    body: "Verified is hash-recoverable. Corroborated has two independent sources. Observed is a logged pattern. The label is in the artifact; tiers are never silently mixed.",
  },
  {
    num: "03",
    kicker: "CONSTELLATION",
    title: "The graph is the proof.",
    body: "Counterparties, peel chains, bridges, exits — the network around an entity, with role-typed nodes and kind-typed edges. The reader walks the topology to read the case.",
  },
  {
    num: "04",
    kicker: "CASEFILES",
    title: "Court-readable artifacts.",
    body: "Dossier hero, flow stages, filing panel, evidence rail, annex grid, editorial standard footer. Every figure carries a hashref. Every claim links a bucket.",
  },
  {
    num: "05",
    kicker: "KOL REGISTRY",
    title: "Continuous surveillance.",
    body: "Profiles under the same editorial standard as cases. Behavioural rails, identity strips, evidence density — published, contestable, takedown-active.",
  },
];

export const ABOUT_PUBLICATION_DISCIPLINE: AboutSection = {
  id: "publication-discipline",
  kicker: "04 · PUBLICATION DISCIPLINE",
  title: "Why the artifact has rules.",
  body: "Every published claim is bound by the same five rules. The discipline is not a wrapper around the product. The discipline is the product.",
  bullets: [
    "Bucket label — verified, corroborated, or observed. Tiers are never silently mixed.",
    "Hashref — the source is retrievable: capture, on-chain transaction, or oracle response.",
    "Revision history — every correction carries a timestamp, an editor, and a reason.",
    "Takedown channel — open, documented, reviewed under the editorial standard.",
    "Methodology — published; the standard is testable end to end.",
  ],
};

export const ABOUT_RETAIL_COLUMN: AboutColumn = {
  kicker: "RETAIL · SIMPLE READ",
  title: "Read in seconds.",
  lines: [
    "A score that says yes, caution, or no.",
    "Plain language behind the number.",
    "A clear line: avoid, watch, or proceed with care.",
    "Worked examples from cases you can browse.",
  ],
};

export const ABOUT_INVESTIGATOR_COLUMN: AboutColumn = {
  kicker: "INVESTIGATOR · DEEP READ",
  title: "Walk the trail.",
  lines: [
    "Bucket-by-bucket evidence rail.",
    "Constellation graph with role-typed edges.",
    "Hashrefs, revision history, takedown record.",
    "Methodology stack reproducible end to end.",
  ],
};

export const ABOUT_READER_NOTE =
  "Same system. Two depths of reading. The retail surface is not a stripped-down version — it is the conclusion of the deep work, surfaced in plain language.";

export const ABOUT_BOUNDARIES_DO: AboutColumn = {
  kicker: "WHAT WE DO",
  title: "The work we publish.",
  lines: [
    "Document trails that are independently re-walkable.",
    "Score behaviour against a published methodology.",
    "Publish casefiles under a takedown-active editorial standard.",
    "Surveil KOLs and clusters continuously.",
    "Make the artifact public so a retail reader can act on it.",
  ],
};

export const ABOUT_BOUNDARIES_DONT: AboutColumn = {
  kicker: "WHAT WE DO NOT",
  title: "The work that is not ours.",
  lines: [
    "Establish criminal liability.",
    "Certify damages or volume.",
    "Give investment, custody, or legal advice.",
    "Publish living individuals under medical, legal, or family categories.",
    "Run reverse anonymization on retail wallets.",
  ],
};
