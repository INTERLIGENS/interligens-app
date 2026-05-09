/**
 * /takedown — editorial review channel content.
 *
 * Static content for the takedown discipline page. The page exists as a
 * real public surface; the form is intentionally absent until the
 * backend is wired (Dood directive). All filings flow through the email
 * address declared in TAKEDOWN_CONTACT until that lands.
 */

export type TakedownSection = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
};

export type TakedownSla = {
  label: string;
  metric: string;
  detail: string;
};

export const TAKEDOWN_HERO = {
  kicker: "DISCIPLINE · TAKEDOWN",
  title: "Contesting a published claim.",
  dek: "INTERLIGENS treats the takedown channel as part of the editorial standard, not as an afterthought. This page documents who can request review, what evidence is required, and what we will and will not retract.",
};

// Replace with the production address before launch. Kept here as the
// single source of truth so it can move without page edits.
export const TAKEDOWN_CONTACT = "takedown@interligens.com";

export const TAKEDOWN_SECTIONS: TakedownSection[] = [
  {
    id: "who-may-file",
    kicker: "01 · WHO MAY FILE",
    title: "Eligible filers.",
    body: "A subject named in a published casefile may file. A legal representative with documented authority may file on their behalf. A direct counterparty whose identity we have published may file.\nWe do not accept anonymous filings. We do not act on filings sent through unverified intermediaries.",
  },
  {
    id: "what-to-provide",
    kicker: "02 · WHAT TO PROVIDE",
    title: "The minimum filing.",
    body: "A complete filing carries identity, scope, basis, evidence, and a window in which the filer is reachable. Anything short of this is acknowledged but not actioned.",
    bullets: [
      "Identity proof of the filer, or a signed mandate from the named subject.",
      "The exact claim under contest — section reference or paragraph hash.",
      "The factual basis for the request: what is wrong, what is missing, what is misleading.",
      "Independent evidence supporting the correction. Hash, link, signed capture, or third-party citation. Self-attestation alone does not move a claim.",
      "A response window — when the filer is reachable for clarification.",
    ],
  },
  {
    id: "what-we-review",
    kicker: "03 · WHAT WE REVIEW",
    title: "Editorial standard, not feeling.",
    body: "We re-walk the trail. We re-pull the buckets. We compare the contested claim against its original sources.\nIf the corroboration broke — source removed, capture poisoned, oracle re-issued — we reflect it. If a source we cited is genuinely refuted by independent evidence the filer brings, we reflect it. We do not move on tone, pressure, or volume.",
  },
  {
    id: "insufficient",
    kicker: "04 · INSUFFICIENT GROUNDS",
    title: "What does not trigger removal.",
    body: "Disagreement with our reading. Discomfort with the language. Threat of suit absent reproducible error. Generic denials. PR campaigns. Volume of complaints.\nNone of these are sufficient. We retract on demonstrable error, not on discomfort.",
  },
  {
    id: "outcomes",
    kicker: "05 · OUTCOMES",
    title: "What a review can produce.",
    body: "Every outcome is filed under the same hash trail as the original publication.",
    bullets: [
      "Correction — the disputed claim is replaced or amended, with revision noted.",
      "Annotation — the claim stands; a counter-statement from the filer is appended.",
      "Withdrawal — the casefile is removed in full, with a public withdrawal note explaining why.",
      "No change — the original record stands; the filing is logged in the case revision history.",
    ],
  },
  {
    id: "workflow",
    kicker: "06 · WORKFLOW",
    title: "How a filing moves.",
    body: "Receipt within 72 hours. Acknowledgement to the filer with a case number and an editor assigned.\nFull review within 21 days for standard filings, 7 days for material on-chain corrections.\nThe filer is notified at decision; the public record is updated within 48 hours of the decision.",
  },
  {
    id: "contact",
    kicker: "07 · CONTACT",
    title: "Where to file.",
    body: `All takedown filings go to ${TAKEDOWN_CONTACT} from a verifiable address. PGP key on request.\nWe do not accept filings via DM, support tickets, or social media.`,
  },
];

export const TAKEDOWN_SLA: TakedownSla[] = [
  {
    label: "RECEIPT",
    metric: "72H",
    detail: "Acknowledged with case number.",
  },
  {
    label: "STANDARD REVIEW",
    metric: "21D",
    detail: "Full editorial re-walk.",
  },
  {
    label: "MATERIAL ERROR",
    metric: "7D",
    detail: "Accelerated track for on-chain corrections.",
  },
];
