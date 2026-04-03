// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Source Registry
// Static metadata for every intelligence source. No runtime logic.
// ─────────────────────────────────────────────────────────────────────────────

export const SOURCES = {
  ofac: {
    slug: "ofac",
    tier: 1 as const,
    name: "OFAC SDN List",
    jurisdiction: "US",
    listType: "SDN",
    schedule: "0 6 * * *",
    entityTypes: ["ADDRESS"] as const,
  },
  amf: {
    slug: "amf",
    tier: 1 as const,
    name: "AMF Blacklist",
    jurisdiction: "FR",
    listType: "AMF_BLACKLIST",
    schedule: "0 8 * * 1",
    entityTypes: ["DOMAIN", "PROJECT"] as const,
  },
  fca: {
    slug: "fca",
    tier: 1 as const,
    name: "FCA Warning List",
    jurisdiction: "UK",
    listType: "FCA_WARNING",
    schedule: "30 7 * * *",
    entityTypes: ["DOMAIN", "PROJECT"] as const,
  },
  scamsniffer: {
    slug: "scamsniffer",
    tier: 2 as const,
    name: "Scam Sniffer Blacklist",
    jurisdiction: null,
    listType: null,
    schedule: "0 7 * * *",
    entityTypes: ["DOMAIN", "CONTRACT"] as const,
  },
  forta: {
    slug: "forta",
    tier: 2 as const,
    name: "Forta Scam Detector",
    jurisdiction: null,
    listType: null,
    schedule: "0 */6 * * *",
    entityTypes: ["ADDRESS", "CONTRACT"] as const,
  },
  goplus: {
    slug: "goplus",
    tier: 2 as const,
    name: "GoPlus Security",
    jurisdiction: null,
    listType: null,
    schedule: "realtime",
    entityTypes: ["TOKEN_CA"] as const,
  },
} as const;

export type SourceSlug = keyof typeof SOURCES;
