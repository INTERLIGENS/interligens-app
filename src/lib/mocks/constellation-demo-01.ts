/**
 * Synthetic constellation dataset for the 3D POC at /demo/constellation.
 *
 * 45 nodes (1 deployer hub, 6 insiders, 3 LP, 8 relays, 2 bridges, 6 CEX
 * exits, 19 counterparties) + 70 edges modelling a money-flow pattern
 * INTERLIGENS analysts recognise: seed team, LP inflation, staged
 * laundering through a relay ring, cross-chain bridge, CEX cashout, and
 * retail-counterparty scatter.
 *
 * Every personna, handle, wallet and token here is FICTIONAL. Handles are
 * prefixed with @demo_, EVM wallets start 0xDEM0, Solana-shaped strings
 * use a `DemoSoL` prefix so nothing can be mis-indexed against a real
 * chain. Do not import this file outside the /demo/constellation POC.
 */

import type { ConstellationSnapshot, GraphData, GraphEdge, GraphNode } from "@/lib/contracts/website";

type Role =
  | "deployer"
  | "insider"
  | "lp"
  | "relay"
  | "bridge"
  | "cex"
  | "counterparty";

interface DemoNode {
  id: string;
  role: Role;
  label: string;
  display: string;
  x: number;
  y: number;
  verdict: GraphNode["verdict"];
  kind: GraphNode["kind"];
  actorRole: GraphNode["role"];
  description: string;
}

// ─── 45 nodes ──────────────────────────────────────────────────────────────

const NODES: DemoNode[] = [
  // 1 — deployer hub
  {
    id: "DEPLOY_0",
    role: "deployer",
    label: "0xDEM0a01f4829cde9b71cc",
    display: "Deployer · Alpha",
    x: 0, y: 0,
    verdict: "critical",
    kind: "wallet",
    actorRole: "deployer",
    description: "Origin wallet for the $DEMO01 token contract. Funded 6 insider wallets 48h before launch and directly seeded the three initial LPs.",
  },

  // 6 — insiders (fan of deployer-sourced pre-launch wallets)
  {
    id: "INS_1", role: "insider", label: "0xDEM01n5a9bcf71103c47ee",
    display: "Insider · @demo_maker", x: -180, y: -120,
    verdict: "critical", kind: "wallet", actorRole: "treasury",
    description: "Received 4.2% of supply from the deployer 37h pre-launch. Sold into liquidity within 11 minutes of public trading.",
  },
  {
    id: "INS_2", role: "insider", label: "0xDEM01n9c00ab4432ff218d",
    display: "Insider · @demo_kelvin", x: 60, y: -220,
    verdict: "critical", kind: "wallet", actorRole: "treasury",
    description: "Secondary insider. Bridged proceeds to an Ethereum mixer three hours after the first public rug signal.",
  },
  {
    id: "INS_3", role: "insider", label: "0xDEM01nb3412ef70a8a5521",
    display: "Insider · @demo_havoc", x: 180, y: -130,
    verdict: "critical", kind: "wallet", actorRole: "treasury",
    description: "Insider cluster member. Co-wallet shares identical funding signature with INS_1 and INS_4.",
  },
  {
    id: "INS_4", role: "insider", label: "0xDEM01nd7720c5b02ab4491",
    display: "Insider · @demo_nyx", x: -90, y: -260,
    verdict: "critical", kind: "wallet", actorRole: "treasury",
    description: "Insider. First sale placed inside the same block as the deployer's initial liquidity withdrawal.",
  },
  {
    id: "INS_5", role: "insider", label: "0xDEM01nf1110ee68cc44823",
    display: "Insider · @demo_orbital", x: 140, y: -250,
    verdict: "critical", kind: "wallet", actorRole: "treasury",
    description: "Insider. Pre-sale allocation split across three sub-wallets within 6 hours of receiving funds.",
  },
  {
    id: "INS_6", role: "insider", label: "0xDEM01n02221200ddf66714",
    display: "Insider · @demo_pallas", x: -230, y: -30,
    verdict: "critical", kind: "wallet", actorRole: "treasury",
    description: "Quiet insider. Holds a documented history of launching three prior tokens under alternate deployer aliases.",
  },

  // 3 — liquidity pools (direct targets of deployer funding)
  {
    id: "LP_1", role: "lp", label: "DemoSoL_lp_solq2mm77aa",
    display: "LP · DEMO/SOL", x: 0, y: 160,
    verdict: "elevated", kind: "wallet", actorRole: "liquidity",
    description: "Main DEMO/SOL pool. Withdrawn 74% of reserves during the first rug sequence.",
  },
  {
    id: "LP_2", role: "lp", label: "DemoSoL_lp_usdcz7b88bb",
    display: "LP · DEMO/USDC", x: -120, y: 170,
    verdict: "elevated", kind: "wallet", actorRole: "liquidity",
    description: "Secondary USDC pool. Thin liquidity (≈ $18k synthetic depth); used to signal activity without real capital.",
  },
  {
    id: "LP_3", role: "lp", label: "DemoSoL_lp_ethe9c99cc",
    display: "LP · DEMO/ETH", x: 120, y: 170,
    verdict: "elevated", kind: "wallet", actorRole: "liquidity",
    description: "Bridged pool added post-launch. Received only token-side liquidity — no matching ETH reserve.",
  },

  // 8 — relay ring (money through intermediate wallets before bridge/CEX)
  ...Array.from({ length: 8 }, (_, i): DemoNode => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return {
      id: `REL_${i + 1}`,
      role: "relay",
      label: `0xDEM0rel${String(i + 1).padStart(2, "0")}aabbccdd${1000 + i}`,
      display: `Relay · ${"αβγδεζηθ"[i]}`,
      x: Math.round(Math.cos(angle) * 260),
      y: Math.round(Math.sin(angle) * 260 + 50),
      verdict: "elevated",
      kind: "wallet",
      actorRole: "mixer",
      description: `Transit wallet hop ${i + 1} of 8. Forwards value onward within 90 seconds of receipt — consistent with a scripted peel chain.`,
    };
  }),

  // 2 — bridges
  {
    id: "BRG_1", role: "bridge", label: "DemoSoL_brg_allbridge_01",
    display: "Bridge · Allbridge-style", x: -340, y: 80,
    verdict: "elevated", kind: "bridge", actorRole: "bridge",
    description: "Outbound bridge contract. ~$1.8M synthetic volume routed toward EVM over a 72h window.",
  },
  {
    id: "BRG_2", role: "bridge", label: "0xDEM0brg44ff9988ccde1122",
    display: "Bridge · Wormhole-style", x: 340, y: 80,
    verdict: "elevated", kind: "bridge", actorRole: "bridge",
    description: "Secondary bridge path. Used for the tail ~20% of flows after the primary bridge throttled.",
  },

  // 6 — CEX exits (known deposit addresses at major exchanges)
  ...([
    ["CEX_1", "Exchange · Atlas-demo", -400, -60],
    ["CEX_2", "Exchange · Meridian-demo", -280, -200],
    ["CEX_3", "Exchange · Orion-demo", -120, -300],
    ["CEX_4", "Exchange · Polaris-demo", 120, -300],
    ["CEX_5", "Exchange · Solace-demo", 280, -200],
    ["CEX_6", "Exchange · Venture-demo", 400, -60],
  ] as const).map(([id, display, x, y]): DemoNode => ({
    id,
    role: "cex",
    label: `0xDEM0cex${id.slice(4).padStart(2, "0")}000111222333444555666`,
    display,
    x, y,
    verdict: "elevated",
    kind: "cex",
    actorRole: "cex",
    description: `Known deposit address cluster for ${display}. Received staged deposits in the 5-50 SOL-equivalent range, sized to stay under common monitoring thresholds.`,
  })),

  // 19 — counterparty scatter (retail peripherals)
  ...Array.from({ length: 19 }, (_, i): DemoNode => {
    const angle = (i / 19) * Math.PI * 2;
    const radius = 360 + (i % 3) * 40;
    return {
      id: `CP_${i + 1}`,
      role: "counterparty",
      label: `DemoSoL_cp_${String(i + 1).padStart(2, "0")}${"afghjkmnpqrstuvwxyz"[i]}${2000 + i}`,
      display: `Counterparty · ${String(i + 1).padStart(2, "0")}`,
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius + 120),
      verdict: i % 5 === 0 ? "monitoring" : "cleared",
      kind: "wallet",
      actorRole: "exit",
      description: `Downstream counterparty ${i + 1}. Pattern signature indicates a retail holder acquired at or after the rug sequence.`,
    };
  }),
];

if (NODES.length !== 45) {
  throw new Error(`[constellation-demo-01] expected 45 nodes, got ${NODES.length}`);
}

// ─── 70 edges ──────────────────────────────────────────────────────────────

type DemoEdge = Omit<GraphEdge, "id">;

const EDGE_DRAFTS: DemoEdge[] = [];

// 1. deployer → 6 insiders (6)
for (let i = 1; i <= 6; i++) {
  EDGE_DRAFTS.push({ source: "DEPLOY_0", target: `INS_${i}`, kind: "money_flow", weight: 0.9 });
}
// 2. deployer → 3 LPs (3)
for (let i = 1; i <= 3; i++) {
  EDGE_DRAFTS.push({ source: "DEPLOY_0", target: `LP_${i}`, kind: "transaction", weight: 0.95 });
}
// 3. 3 LPs → 3 relays (3)
EDGE_DRAFTS.push({ source: "LP_1", target: "REL_1", kind: "money_flow", weight: 0.8 });
EDGE_DRAFTS.push({ source: "LP_2", target: "REL_3", kind: "money_flow", weight: 0.75 });
EDGE_DRAFTS.push({ source: "LP_3", target: "REL_5", kind: "money_flow", weight: 0.78 });
// 4. insiders → relays (6)
EDGE_DRAFTS.push({ source: "INS_1", target: "REL_2", kind: "money_flow", weight: 0.7 });
EDGE_DRAFTS.push({ source: "INS_2", target: "REL_4", kind: "money_flow", weight: 0.72 });
EDGE_DRAFTS.push({ source: "INS_3", target: "REL_4", kind: "money_flow", weight: 0.68 });
EDGE_DRAFTS.push({ source: "INS_4", target: "REL_6", kind: "money_flow", weight: 0.66 });
EDGE_DRAFTS.push({ source: "INS_5", target: "REL_7", kind: "money_flow", weight: 0.69 });
EDGE_DRAFTS.push({ source: "INS_6", target: "REL_8", kind: "money_flow", weight: 0.64 });
// 5. relay chaining (peel chain) — 7 hop edges
for (let i = 1; i <= 7; i++) {
  EDGE_DRAFTS.push({ source: `REL_${i}`, target: `REL_${i + 1}`, kind: "suspicious", weight: 0.6 });
}
// 6. relays → bridges (6)
EDGE_DRAFTS.push({ source: "REL_1", target: "BRG_1", kind: "money_flow", weight: 0.85 });
EDGE_DRAFTS.push({ source: "REL_3", target: "BRG_1", kind: "money_flow", weight: 0.82 });
EDGE_DRAFTS.push({ source: "REL_5", target: "BRG_1", kind: "money_flow", weight: 0.78 });
EDGE_DRAFTS.push({ source: "REL_2", target: "BRG_2", kind: "money_flow", weight: 0.74 });
EDGE_DRAFTS.push({ source: "REL_6", target: "BRG_2", kind: "money_flow", weight: 0.7 });
EDGE_DRAFTS.push({ source: "REL_8", target: "BRG_2", kind: "money_flow", weight: 0.67 });
// 7. bridges → CEX (6)
EDGE_DRAFTS.push({ source: "BRG_1", target: "CEX_1", kind: "money_flow", weight: 0.9 });
EDGE_DRAFTS.push({ source: "BRG_1", target: "CEX_2", kind: "money_flow", weight: 0.8 });
EDGE_DRAFTS.push({ source: "BRG_1", target: "CEX_3", kind: "money_flow", weight: 0.77 });
EDGE_DRAFTS.push({ source: "BRG_2", target: "CEX_4", kind: "money_flow", weight: 0.85 });
EDGE_DRAFTS.push({ source: "BRG_2", target: "CEX_5", kind: "money_flow", weight: 0.7 });
EDGE_DRAFTS.push({ source: "BRG_2", target: "CEX_6", kind: "money_flow", weight: 0.68 });
// 8. insiders → CEX (direct cashout paths — 2)
EDGE_DRAFTS.push({ source: "INS_3", target: "CEX_2", kind: "money_flow", weight: 0.55 });
EDGE_DRAFTS.push({ source: "INS_5", target: "CEX_5", kind: "money_flow", weight: 0.52 });
// 9. relays → counterparties (suspicious interactions — 12)
for (let i = 0; i < 12; i++) {
  EDGE_DRAFTS.push({
    source: `REL_${(i % 8) + 1}`,
    target: `CP_${i + 1}`,
    kind: "suspicious",
    weight: 0.35,
  });
}
// 10. LP → counterparty retail trades (6)
for (let i = 13; i <= 18; i++) {
  EDGE_DRAFTS.push({
    source: `LP_${((i - 13) % 3) + 1}`,
    target: `CP_${i}`,
    kind: "transaction",
    weight: 0.25,
  });
}
// 11. counterparty → counterparty (retail trades, 13)
const CP_CROSS: Array<[number, number]> = [
  [1, 4], [2, 7], [5, 9], [8, 11], [10, 14], [13, 16], [15, 19],
  [3, 6], [6, 12], [9, 17], [11, 18], [14, 17], [16, 19],
];
for (const [a, b] of CP_CROSS) {
  EDGE_DRAFTS.push({
    source: `CP_${a}`,
    target: `CP_${b}`,
    kind: "transaction",
    weight: 0.2,
  });
}

if (EDGE_DRAFTS.length !== 70) {
  throw new Error(`[constellation-demo-01] expected 70 edges, got ${EDGE_DRAFTS.length}`);
}

const EDGES: GraphEdge[] = EDGE_DRAFTS.map((e, i) => ({
  id: `E_${String(i + 1).padStart(3, "0")}`,
  source: e.source,
  target: e.target,
  kind: e.kind,
  weight: e.weight,
}));

// ─── Exported GraphData / extended node metadata ──────────────────────────

export interface DemoConstellationNode extends GraphNode {
  /** POC-only: role taxonomy used by the 3D renderer. */
  demoRole: Role;
  display: string;
  description: string;
}

export const DEMO_01_NODES: DemoConstellationNode[] = NODES.map((n) => ({
  id: n.id,
  kind: n.kind,
  role: n.actorRole,
  label: n.label,
  verdict: n.verdict,
  x: n.x,
  y: n.y,
  demoRole: n.role,
  display: n.display,
  description: n.description,
}));

export const DEMO_01_GRAPH: GraphData = {
  nodes: DEMO_01_NODES,
  edges: EDGES,
};

export const DEMO_01_SNAPSHOT: ConstellationSnapshot = {
  id: "DEMO-01",
  caseRef: "DEMO-01",
  capturedAt: "2026-04-21T08:00:00.000Z",
  graph: DEMO_01_GRAPH,
  signalBrief: [],
  timeline: [],
  classification: {
    sessionId: "demo-constellation-01",
    issuedAt: "2026-04-21T08:00:00.000Z",
    standard: "Forensic Editorial v2",
  },
};
