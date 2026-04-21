import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";

/**
 * Public /scan surface — mocked content.
 *
 * This file is the only data source for the retail entry page. Future wiring
 * to the real scan pipeline should keep this shape and swap the `resolve`
 * helpers — no page or component rewrite expected.
 */

export const SCAN_HERO = {
  kicker: "PRODUCT ENTRY · INTAKE 01",
  title: "Scan before",
  titleEm: "you get hit.",
  dek:
    "Paste a token address, a wallet, or an X handle. You get a TigerScore, the signals behind it, and the evidence trail — in under ten seconds.",
} as const;

export const SCAN_PLACEHOLDER =
  "Token address  ·  Wallet  ·  @handle  ·  Case keyword";

export const SCAN_MICRO_HELP =
  "Solana · Ethereum · X handles · Evidence-backed TigerScore · No login required";

export type QuickExample = {
  kind: "token" | "wallet" | "handle" | "case";
  label: string;              // "$VINE"
  sub: string;                // "Live case · 6AJcP…Hjq3"
  value: string;              // what gets placed in the input
  href: string;               // deep-link destination
};

/**
 * Curated starter inputs. Each one deep-links to a surface that actually
 * renders (no dead links). Order matters: token first, then a live case,
 * then a KOL handle, then a case keyword.
 */
export const SCAN_QUICK_EXAMPLES: QuickExample[] = [
  {
    kind: "token",
    label: "$VINE",
    sub: "Solana · live forensic case",
    value: "6AJcP4j4uDkL8EwbF1wEyJ3s4nTkv8XKyRzM7mZcHjq3",
    href: "/result/vine",
  },
  {
    kind: "handle",
    label: "@bkokoski",
    sub: "X handle · documented deployer",
    value: "@bkokoski",
    href: "/kol/bkokoski",
  },
  {
    kind: "case",
    label: "BOTIFY",
    sub: "Case keyword · published",
    value: "BOTIFY",
    href: "/cases/botify",
  },
  {
    kind: "wallet",
    label: "6AJcP…Hjq3",
    sub: "Solana wallet · deployer cluster",
    value: "6AJcP4j4uDkL8EwbF1wEyJ3s4nTkv8XKyRzM7mZcHjq3",
    href: "/result/vine",
  },
];

/**
 * `/scan` routes unrecognized free-form input here while the real scan
 * pipeline is not wired. Keeping this in the mock layer makes the swap
 * trivial when the API is ready.
 */
export const SCAN_DEFAULT_RESULT_HREF = "/result/vine";

export type FlowStep = {
  idx: string;
  label: string;
  body: string;
};

export const SCAN_FLOW: FlowStep[] = [
  {
    idx: "01",
    label: "You enter",
    body:
      "Token, wallet, handle, or case keyword. Same field for every input type — the router detects the format.",
  },
  {
    idx: "02",
    label: "TigerScore lands",
    body:
      "A deterministic 0–100 score with verdict. No opinion layer. The breakdown stays visible next to the number.",
  },
  {
    idx: "03",
    label: "Evidence opens",
    body:
      "Every signal links back to an independently retrievable source: on-chain tx, archived capture, or cited oracle.",
  },
  {
    idx: "04",
    label: "Network, if any",
    body:
      "When the subject is connected to a published case, you land on the constellation and the actor list. Otherwise it stops at the score.",
  },
];

export type ConfidencePillar = {
  tag: string;
  title: string;
  body: string;
};

export const SCAN_CONFIDENCE: ConfidencePillar[] = [
  {
    tag: "01 · TIGERSCORE",
    title: "Computed, not narrated.",
    body:
      "Every score is a function of the signals below it. You can reconstruct the number from its parts. No tone, no spin, no marketing overlay.",
  },
  {
    tag: "02 · EVIDENCE",
    title: "Independent retrieval.",
    body:
      "Signals carry sources you can open yourself: transaction hashes, archived snapshots, third-party oracles. No anonymous claims for factual statements.",
  },
  {
    tag: "03 · DISCIPLINE",
    title: "Publication gate.",
    body:
      "Subjects are invited to respond via a signed takedown channel before a case is published. Filings carry revision history and hash proof.",
  },
];

export const SCAN_CROSS_LINKS: CrossLink[] = [
  {
    num: "01",
    title: "Last scanned",
    meta: ["$VINE · Solana", "Score 88 / 100", "Verdict: high"],
    amount: "LIVE",
    status: "Open result",
    href: "/result/vine",
    preview: { tone: "risk", label: "HIGH" },
  },
  {
    num: "02",
    title: "Case Ledger",
    meta: ["06 published investigations", "$BOTIFY lead story"],
    amount: "$2.1M",
    status: "Active",
    href: "/cases",
    preview: { tone: "risk", label: "HIGH ACTIVITY" },
  },
  {
    num: "03",
    title: "KOL Dossiers",
    meta: ["215 profiles documented", "52 wallets network"],
    amount: "963 Victims",
    status: "Published",
    href: "/kol",
    preview: { tone: "caution", label: "UNDER REVIEW" },
  },
  {
    num: "04",
    title: "Constellation",
    meta: ["Public graph snapshots", "Cases linked to clusters"],
    amount: "—",
    status: "Open",
    href: "/constellation",
  },
];

export type InputKind = QuickExample["kind"] | "unknown";

/**
 * Best-effort format detection for retail free-form input. Used to show a
 * small "detected" hint under the input and to route cleanly once the real
 * scan API is wired. Never blocks submission.
 */
export function detectInputKind(raw: string): InputKind {
  const s = raw.trim();
  if (!s) return "unknown";
  if (s.startsWith("@") || /^[A-Za-z0-9_]{3,15}$/.test(s)) return "handle";
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return "wallet";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return "wallet";
  if (/^\$?[A-Z0-9]{2,10}$/.test(s)) return "token";
  if (/^[A-Z][A-Z0-9\s-]{2,}$/.test(s)) return "case";
  return "unknown";
}
