import type { EvidenceTier, NetworkNode, NodeGroup } from "@/lib/network/schema";

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

// Label typography stacks. Inter for entity labels, JetBrains Mono for
// addresses/hashes/contract IDs. Both fonts are preloaded as CSS variables
// from app/layout.tsx; the fallbacks below cover SSR and PNG export.
export const LABEL_FONT_SANS =
  "var(--font-inter), ui-sans-serif, system-ui, sans-serif";
export const LABEL_FONT_MONO =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const MONO_GROUPS = new Set<NodeGroup>([
  "wallet",
  "wallet_family",
  "contract",
  "transaction",
]);

export function isMonoGroup(g: NodeGroup): boolean {
  return MONO_GROUPS.has(g);
}

export function labelFont(g: NodeGroup): string {
  return isMonoGroup(g) ? LABEL_FONT_MONO : LABEL_FONT_SANS;
}

// Truncate hex addresses (0x123…ABCD), prefix missing @ on handles, leave
// everything else as-is. Labels that aren't hex-ish flow through untouched.
export function formatNodeLabel(n: NetworkNode): string {
  const raw = n.label ?? "";
  if (/^0x[0-9a-f]{10,}$/i.test(raw)) {
    return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
  }
  if (/^[0-9a-f]{32,}$/i.test(raw)) {
    // Naked hash (tx, contract without 0x) — same truncation shape.
    return `${raw.slice(0, 4)}…${raw.slice(-4)}`;
  }
  if (n.group === "handle" && !raw.startsWith("@")) {
    return `@${raw}`;
  }
  return raw;
}

// Font-size ladder: hubs 12, standards 11, micro 10 (degree 0).
export function labelSize(
  nodeId: string,
  degree: Record<string, number>,
  top3Hubs: Set<string>,
): number {
  if (top3Hubs.has(nodeId)) return 12;
  return (degree[nodeId] ?? 0) === 0 ? 10 : 11;
}

// Pill padding and border — match the spec (3×6, radius 3). Reused by the
// two graph components so the pill geometry can't drift.
export const LABEL_PILL = {
  padX: 6,
  padY: 3,
  radius: 3,
  bg: "rgba(0,0,0,0.7)",
  border: "rgba(255,255,255,0.1)",
} as const;

// Rough character-width ratios for label width estimation (used by the
// custom anti-label-collision force). We can't call getBBox inside a force
// on every tick — estimation is good enough for layout.
const CHAR_W_SANS = 0.55;
const CHAR_W_MONO = 0.6;

export function estimatedLabelWidth(
  text: string,
  fontSize: number,
  mono: boolean,
): number {
  const avg = mono ? CHAR_W_MONO : CHAR_W_SANS;
  return text.length * fontSize * avg + LABEL_PILL.padX * 2;
}
