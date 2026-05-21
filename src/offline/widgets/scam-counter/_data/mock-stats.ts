/**
 * Scam Counter widget — mocked stats.
 *
 * OFFLINE MODE V2. Data is 100% static, inventable, neutral. No reference to
 * internal casefile numbers (BOTIFY / RAVE / GHOST / VINE / SOLAXY), no
 * KOL counts, no traced-USD totals.
 *
 * `lastUpdated` is a static ISO date — DO NOT use `new Date()` here, the
 * widget is server-rendered and must be deterministic across renders.
 */

export type ScamCategory =
  | "rugpull"
  | "honeypot"
  | "phishing"
  | "exit-scam"
  | "fake-airdrop"
  | "impersonation"
  | "pump-and-dump";

export const SCAM_CATEGORIES: readonly ScamCategory[] = [
  "rugpull",
  "honeypot",
  "phishing",
  "exit-scam",
  "fake-airdrop",
  "impersonation",
  "pump-and-dump",
] as const;

// Human-readable labels for each category. Used by CategoryBreakdown to
// avoid rendering raw kebab-case tokens. Keep in lock-step with ScamCategory:
// every category MUST have an entry (asserted in mock-stats.test.ts).
export const CATEGORY_LABELS: Record<ScamCategory, string> = {
  rugpull: "Rugpull",
  honeypot: "Honeypot",
  phishing: "Phishing",
  "exit-scam": "Exit Scam",
  "fake-airdrop": "Fake Airdrop",
  impersonation: "Impersonation",
  "pump-and-dump": "Pump & Dump",
};

export interface ScamStats {
  total: number;
  lastUpdated: string;
  byCategory: Record<ScamCategory, number>;
  trend: {
    period: "7d" | "30d";
    delta: number;
    direction: "up" | "down" | "flat";
  };
}

// Distribution plausible et neutre — chiffres inventés, somme = 487.
// Ne reflète aucun dossier INTERLIGENS publié.
export const MOCK_STATS: ScamStats = {
  total: 487,
  lastUpdated: "2026-05-20",
  byCategory: {
    rugpull: 142,
    honeypot: 89,
    phishing: 76,
    "exit-scam": 64,
    "fake-airdrop": 58,
    impersonation: 41,
    "pump-and-dump": 17,
  },
  trend: {
    period: "7d",
    delta: 12,
    direction: "up",
  },
};
