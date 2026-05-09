/**
 * /legal — LCEN imprint + publishing posture.
 *
 * The imprint values flagged TO_FILL must be replaced before any
 * production launch — they are the mandatory French LCEN disclosures
 * (Loi pour la Confiance dans l'Économie Numérique). Hosting record
 * (Vercel Inc.) is filled because it is invariant.
 */

export type LegalSection = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
};

export type ImprintEntry = {
  label: string;
  value: string;
  /** When true, value is rendered with the visible TO_FILL treatment. */
  pending?: boolean;
};

export const LEGAL_HERO = {
  kicker: "DISCIPLINE · LEGAL NOTICE",
  title: "Legal notice and publishing posture.",
  dek: "Mandatory disclosures, publishing posture, and the boundaries of what INTERLIGENS dossiers do and do not establish.",
};

export const IMPRINT_ENTRIES: ImprintEntry[] = [
  {
    label: "Raison sociale",
    value: "TO_FILL · raison sociale",
    pending: true,
  },
  {
    label: "Forme juridique",
    value: "TO_FILL · forme juridique",
    pending: true,
  },
  {
    label: "Capital social",
    value: "TO_FILL · capital social",
    pending: true,
  },
  {
    label: "Siège social",
    value: "TO_FILL · adresse siège",
    pending: true,
  },
  {
    label: "RCS / SIRET",
    value: "TO_FILL · numéro registre",
    pending: true,
  },
  {
    label: "Directeur de la publication",
    value: "TO_FILL · directeur publication",
    pending: true,
  },
  {
    label: "Contact général",
    value: "TO_FILL · contact email",
    pending: true,
  },
  {
    label: "Hébergeur",
    value:
      "Vercel Inc. — 440 N Barranca Ave #4133, Covina, CA 91723, USA",
  },
];

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    id: "nature",
    kicker: "01 · NATURE OF PUBLICATION",
    title: "Intelligence profile, not verdict.",
    body: "INTERLIGENS publishes intelligence dossiers under a documented editorial standard. A dossier is an analytical artifact, not a criminal verdict, civil judgement, or regulatory finding.\nReading a casefile does not establish liability. It establishes a documented trail.",
  },
  {
    id: "corrections",
    kicker: "02 · CORRECTIONS POSTURE",
    title: "How errors are handled.",
    body: "Errors of fact are corrected through the documented takedown channel. Material corrections appear in the case revision history with timestamp and reason.\nWe do not silent-edit. The casefile that was public on a given date is hash-recoverable on that date.",
  },
  {
    id: "privacy",
    kicker: "03 · PRIVACY POSTURE",
    title: "Public sources only.",
    body: "Identity claims rely on public sources: published wallet addresses, public social handles, public corporate filings, leaked datasets that have already entered the public record through journalism.\nWe do not deanonymize private individuals. We do not publish residential addresses. We do not publish medical, family, or unrelated personal information.",
  },
  {
    id: "cookies",
    kicker: "04 · COOKIES AND TRACKING",
    title: "Beta session only.",
    body: "INTERLIGENS uses a session cookie to gate the closed beta. We do not run advertising trackers, retargeting pixels, or third-party fingerprinters on this surface.\nOperational analytics measure page reach in aggregate; no personally identifying data leaves the deployment.",
  },
  {
    id: "ip",
    kicker: "05 · INTELLECTUAL PROPERTY",
    title: "Published artifacts.",
    body: "Casefiles, methodology pages, and design tokens are published under the INTERLIGENS editorial copyright. Citations of public sources retain their original attribution.\nRepublication of a casefile in part requires the source link and the editorial standard hash.",
  },
  {
    id: "beta",
    kicker: "06 · BETA NOTICE",
    title: "Closed beta posture.",
    body: "INTERLIGENS Website 2.0 is operating in closed beta under NDA. Access is granted by invitation.\nMaterial on this surface may be reorganised, withdrawn, or replaced as the beta program matures. Stable URLs are not guaranteed before general availability.",
  },
  {
    id: "contact",
    kicker: "07 · CONTACT POINTS",
    title: "Operational addresses.",
    body: "All operational correspondence flows through the addresses below. Other channels (DM, support tickets, social media) are not monitored for legal or editorial purposes.",
    bullets: [
      "Takedown filings: takedown@interligens.com",
      "Legal correspondence: TO_FILL · legal email",
      "General contact: TO_FILL · contact email",
    ],
  },
  {
    id: "law",
    kicker: "08 · APPLICABLE LAW",
    title: "Jurisdiction.",
    body: "Publishing decisions follow French law for the editorial entity (TO_FILL · raison sociale) under the LCEN regime.\nDisputes are addressed through the takedown channel before any judicial path is engaged.",
  },
];
