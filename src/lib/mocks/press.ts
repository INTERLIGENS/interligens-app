/**
 * /press — institutional press / media content.
 *
 * Voice is institutional, factual, non-commercial. The page exists as
 * an entry point for journalists, press analysts, and editors — not as
 * a marketing brochure. Three product decisions are explicitly NOT
 * acted on here: Phantom Guard's product status, business model /
 * pricing, and the INTERLIGENS / LIBERTAS frontier. Anything pending
 * editorial confirmation is rendered with the visible TO_FILL
 * treatment (orange signal, mono caps) so a reviewer cannot ship the
 * page with placeholders still in place.
 */

export type PressSection = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
};

export type CoverageEntry = {
  outlet: string;
  date: string;
  title: string;
  href: string;
  /** When true, fields are rendered with the visible TO_FILL treatment. */
  pending?: boolean;
};

export type TalkingPoint = {
  num: string;
  kicker: string;
  title: string;
  body: string;
};

export type Spokesperson = {
  name: string;
  title: string;
  languages: string;
  /** When true, fields are rendered with the visible TO_FILL treatment. */
  pending?: boolean;
};

export type PressAsset = {
  label: string;
  detail: string;
  /** "request" → available on request via PRESS_CONTACT_EMAIL; "internal" → not yet exposed. */
  availability: "request" | "internal";
};

// Single source of truth for the press contact address. Real, not a
// TO_FILL — confirmed in the brief.
export const PRESS_CONTACT_EMAIL = "press@interligens.com";

export const PRESS_HERO = {
  kicker: "INSTITUTION · PRESS",
  title: "A working address for the press.",
  dek: "INTERLIGENS publishes documented intelligence on crypto entities, wallets, and KOLs under a public editorial standard. This page is the working entry point for journalists, editors, and press analysts who want to read the work, ask a question, or ground a story in something verifiable.",
};

export const PRESS_OPENING: PressSection = {
  id: "opening",
  kicker: "00 · POSTURE",
  title: "How we talk to the press.",
  body: "We answer on the record when we can, on background when the file is still moving, and not at all when the question is about a subject we have not published.\nWe do not pitch stories. We do not run embargo cycles. We do not chase a news beat. The casefiles are the artifact; what we say to the press is what is already in them, or the editorial discipline that built them.\nThis page exists so a reporter does not have to chase a press contact through DMs. It is a working address, not a marketing surface.",
};

export const PRESS_ABOUT: PressSection = {
  id: "about",
  kicker: "01 · WHAT WE ARE",
  title: "Forensic intelligence, on the public record.",
  body: "INTERLIGENS is a publication system for crypto-native intelligence: TigerScores on tokens, wallets, and KOLs; casefiles built under a documented editorial standard; a constellation graph that lets a reader walk the network around a subject; a takedown channel open to anyone we name.\nEverything we publish is paired with an independently retrievable source. Every score is computed under a published methodology. We publish observable behaviour, not criminal verdicts — that line is the work.",
};

export const PRESS_COVERAGE_INTRO: PressSection = {
  id: "coverage",
  kicker: "02 · RECENT MEDIA",
  title: "Where the work has been read.",
  body: "Coverage entries below link to external publications that have referenced an INTERLIGENS casefile, scored entity, or methodology page. Entries flagged TO_FILL are placeholders — we do not list a piece until the URL, outlet, and date can be cited verbatim.",
};

export const COVERAGE_ENTRIES: CoverageEntry[] = [
  {
    outlet: "TO_FILL · outlet",
    date: "TO_FILL · date",
    title: "TO_FILL · headline",
    href: "#",
    pending: true,
  },
  {
    outlet: "TO_FILL · outlet",
    date: "TO_FILL · date",
    title: "TO_FILL · headline",
    href: "#",
    pending: true,
  },
  {
    outlet: "TO_FILL · outlet",
    date: "TO_FILL · date",
    title: "TO_FILL · headline",
    href: "#",
    pending: true,
  },
  {
    outlet: "TO_FILL · outlet",
    date: "TO_FILL · date",
    title: "TO_FILL · headline",
    href: "#",
    pending: true,
  },
  {
    outlet: "TO_FILL · outlet",
    date: "TO_FILL · date",
    title: "TO_FILL · headline",
    href: "#",
    pending: true,
  },
];

export const TALKING_POINTS_INTRO = {
  kicker: "03 · TALKING POINTS",
  title: "What we can speak to on the record.",
  dek: "Six angles where INTERLIGENS holds enough published material to comment substantively. We will decline questions outside this perimeter rather than improvise.",
};

export const TALKING_POINTS: TalkingPoint[] = [
  {
    num: "01",
    kicker: "EXTRACTION PATTERNS",
    title: "How retail capital is moved off-chain.",
    body: "Peel chains, bridge sequencing, exchange exits, and the recurring topologies we see in the casefiles. Specific numbers come from specific dossiers — we will not generalise across files we have not built.",
  },
  {
    num: "02",
    kicker: "KOL ACCOUNTABILITY",
    title: "Continuous surveillance of public figures.",
    body: "What it means to publish a KOL profile under a takedown-active editorial standard. Identity sourcing, behavioural rails, evidence density, and the line between a public-figure file and a private individual.",
  },
  {
    num: "03",
    kicker: "EVIDENCE-LED PUBLICATION",
    title: "Why every claim carries a hashref.",
    body: "The discipline of bucketed evidence — verified, corroborated, observed — and what each bucket can and cannot support in print. The point a careful reporter can re-walk against our trail.",
  },
  {
    num: "04",
    kicker: "ON-CHAIN FORENSIC METHOD",
    title: "Reproducibility over opacity.",
    body: "The methodology stack is published. A third party with the same dataset and the same standard should land on the same reading. That is the test we hold the system to.",
  },
  {
    num: "05",
    kicker: "OBSERVABLE BEHAVIOUR",
    title: "Where the work ends.",
    body: "INTERLIGENS publishes documented patterns. INTERLIGENS does not establish criminal liability, certify damages, or run reverse anonymization on retail wallets. The boundary is in the artifact, not implied around it.",
  },
  {
    num: "06",
    kicker: "EDITORIAL STANDARD",
    title: "Why the takedown channel exists.",
    body: "A publication that names subjects must accept correction under a documented standard. We re-walk the trail when the filing brings independent evidence; we do not move on tone, pressure, or volume.",
  },
];

export const SPOKESPEOPLE_INTRO = {
  kicker: "04 · SPOKESPEOPLE",
  title: "Who is on the record.",
  dek: "Names below are the only individuals authorised to speak for INTERLIGENS on the record. Other team members may speak on background through the press address; quotes are not attributed without prior agreement.",
};

export const SPOKESPEOPLE: Spokesperson[] = [
  {
    name: "TO_FILL · spokesperson",
    title: "TO_FILL · title",
    languages: "TO_FILL · languages",
    pending: true,
  },
  {
    name: "TO_FILL · spokesperson",
    title: "TO_FILL · title",
    languages: "TO_FILL · languages",
    pending: true,
  },
];

export const ASSETS_INTRO = {
  kicker: "06 · ASSETS",
  title: "Logo, mark, factsheet.",
  dek: "Press assets are released on request via the press address. We hold them centrally rather than expose static download links so we can confirm context of use and revoke superseded versions.",
};

export const ASSET_LIST: PressAsset[] = [
  {
    label: "Wordmark — light",
    detail: "INTERLIGENS lockup, light variant. SVG and PNG.",
    availability: "request",
  },
  {
    label: "Wordmark — dark",
    detail: "INTERLIGENS lockup, dark variant. SVG and PNG.",
    availability: "request",
  },
  {
    label: "Mark",
    detail: "Standalone glyph. SVG and PNG, square.",
    availability: "request",
  },
  {
    label: "Factsheet",
    detail: "One-page institutional factsheet. PDF, current revision.",
    availability: "request",
  },
  {
    label: "Product screenshots",
    detail: "Casefile, constellation, KOL dossier surfaces. PNG, retina.",
    availability: "request",
  },
];

export const PRESS_EDITORIAL_STANDARDS: PressSection = {
  id: "editorial-standards",
  kicker: "07 · EDITORIAL STANDARDS",
  title: "What our claims do and do not establish.",
  body: "INTERLIGENS publishes observable behaviour under a documented standard. A casefile is an analytical artifact, not a criminal verdict, civil judgement, or regulatory finding. Citing a claim from an INTERLIGENS file means citing the file, the methodology under which it was built, and the takedown channel it remains open to.\nThe methodology page documents how a claim is constructed. The legal notice documents the publishing posture. We expect both to be linked when our work is quoted at length.",
};

export const PRESS_CONTACT_INTRO: PressSection = {
  id: "contact",
  kicker: "05 · PRESS CONTACT",
  title: "A single working address.",
  body: "All press correspondence flows through one address. We acknowledge within two working days. Deadlines tighter than that should be flagged in the subject line — we will tell you fast whether we can help.",
};
