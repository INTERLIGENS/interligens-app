import type { EvidenceTier, NodeGroup } from "@/lib/network/schema";

// Brand accent used for chrome (selected rings, focus, Save). Never on nodes.
export const ACCENT = "#FF6B00";

// Chrome surfaces.
export const CHROME = {
  bg: "#000000",
  panel: "#0b0b0b",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.1)",
  divider: "rgba(255,255,255,0.04)",
  textPrimary: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.5)",
  textFaint: "rgba(255,255,255,0.3)",
  textGhost: "rgba(255,255,255,0.25)",
} as const;

// Categorical node palette. 18 groups. Brand #FF6B00 is reserved for chrome;
// the node colours are whatever reads cleanly on black at 6–22px radii.
export const GROUP_COLOR: Record<NodeGroup, string> = {
  person: "#ff4040",
  project: "#ff9630",
  token: "#ffd060",
  wallet: "#60a5fa",
  wallet_family: "#93c5fd",
  infra_cex: "#a78bfa",
  infra_service: "#c084fc",
  source: "#34d399",
  claim: "#f472b6",
  handle: "#fca5a5",
  contract: "#fbbf24",
  domain: "#67e8f9",
  transaction: "#f97316",
  pool: "#22d3ee",
  bridge: "#a3e635",
  mixer: "#dc2626",
  email: "#fb7185",
  evidence: "#facc15",
};

export const GROUP_LABEL: Record<NodeGroup, string> = {
  person: "People",
  project: "Projects",
  token: "Tokens",
  wallet: "Key wallets",
  wallet_family: "Family (F&F)",
  infra_cex: "CEX hot wallets",
  infra_service: "Services",
  source: "External sources",
  claim: "Allegation bundles",
  handle: "Handles",
  contract: "Contracts",
  domain: "Domains",
  transaction: "Transactions",
  pool: "Pools",
  bridge: "Bridges",
  mixer: "Mixers",
  email: "Emails",
  evidence: "Evidence",
};

export const TIER_LABEL: Record<EvidenceTier, string> = {
  confirmed: "Confirmed",
  strong: "Strong",
  suspected: "Suspected",
  alleged: "Alleged",
};

// Edge stroke colour per tier. Mid-grey ramp keeps tier differences readable
// against the black canvas without borrowing the categorical palette.
export const TIER_STROKE: Record<EvidenceTier, string> = {
  confirmed: "#d0d0d0",
  strong: "#b0b0b0",
  suspected: "#808080",
  alleged: "#505050",
};

export const TIER_DASH: Record<EvidenceTier, string | null> = {
  confirmed: null,
  strong: "6 2",
  suspected: "2 3",
  alleged: "2 4",
};

// Tier visual weight on edges. Confirmed reads heaviest; alleged fades back.
export const TIER_WIDTH: Record<EvidenceTier, number> = {
  confirmed: 1.2,
  strong: 1,
  suspected: 1,
  alleged: 0.75,
};

export const TIER_OPACITY: Record<EvidenceTier, number> = {
  confirmed: 0.9,
  strong: 0.75,
  suspected: 0.55,
  alleged: 0.4,
};
