import type { ConstellationSnapshot } from "@/lib/contracts/website";
import { MOCK_CLASSIFICATION } from "./_context";

/**
 * Frozen public snapshot for /constellation.
 *
 * Layout is BAKED IN — no force simulation, no client-side randomness.
 * Investigator live graph runs separately on the same GraphData shape.
 */

export const CONSTELLATION_VINE: ConstellationSnapshot = {
  id: "vine",
  caseRef: "vine",
  capturedAt: "2026-04-18T22:17:00Z",
  graph: {
    nodes: [
      { id: "token-vine", kind: "token",    label: "$VINE",         verdict: "critical",   x: 500, y: 300, r: 16 },
      { id: "w-dep",      kind: "wallet",   label: "6AJcP…Hjq3",    verdict: "critical",   x: 340, y: 220, role: "deployer" },
      { id: "w-dep-2",    kind: "wallet",   label: "4nXpB…Tx02",    verdict: "critical",   x: 320, y: 360, role: "deployer" },
      { id: "w-exit",     kind: "wallet",   label: "9fRdk…GcP1",    verdict: "high",       x: 700, y: 220, role: "exit" },
      { id: "w-exit-2",   kind: "wallet",   label: "2sQRz…9bK8",    verdict: "high",       x: 740, y: 360, role: "exit" },
      { id: "cex-a",      kind: "cex",      label: "CEX-A",         verdict: "monitoring", x: 880, y: 280, role: "liquidity" },
      { id: "cex-b",      kind: "cex",      label: "CEX-B",         verdict: "monitoring", x: 880, y: 340, role: "liquidity" },
      { id: "kol-bk",     kind: "kol",      label: "@bkokoski",     verdict: "critical",   x: 200, y: 120 },
      { id: "kol-gg",     kind: "kol",      label: "@gordongekko",  verdict: "high",       x: 140, y: 260 },
      { id: "kol-pl",     kind: "kol",      label: "@planted",      verdict: "monitoring", x: 180, y: 400 },
      { id: "ev-mint",    kind: "evidence", label: "EV · MINT",     verdict: "critical",   x: 420, y: 160 },
      { id: "ev-cluster", kind: "evidence", label: "EV · CLUSTER",  verdict: "high",       x: 600, y: 160 },
    ],
    edges: [
      { id: "e1", source: "w-dep",   target: "token-vine", kind: "transaction" },
      { id: "e2", source: "w-dep-2", target: "token-vine", kind: "transaction" },
      { id: "e3", source: "token-vine", target: "w-exit",   kind: "money_flow" },
      { id: "e4", source: "token-vine", target: "w-exit-2", kind: "money_flow" },
      { id: "e5", source: "w-exit",    target: "cex-a",     kind: "money_flow" },
      { id: "e6", source: "w-exit-2", target: "cex-b",      kind: "money_flow" },
      { id: "e7", source: "kol-bk",    target: "token-vine", kind: "kol_relation" },
      { id: "e8", source: "kol-gg",    target: "token-vine", kind: "kol_relation" },
      { id: "e9", source: "kol-pl",    target: "token-vine", kind: "kol_relation" },
      { id: "e10", source: "kol-bk",   target: "w-dep",      kind: "suspicious" },
      { id: "e11", source: "kol-gg",   target: "w-dep-2",    kind: "suspicious" },
      { id: "e12", source: "ev-mint",  target: "w-dep",      kind: "transaction" },
      { id: "e13", source: "ev-cluster", target: "w-exit",   kind: "transaction" },
    ],
    clusters: [
      { id: "c-deployer", label: "Deployer cluster", nodeIds: ["w-dep", "w-dep-2", "token-vine"], tint: "alpha" },
      { id: "c-exit",     label: "Exit cluster",     nodeIds: ["w-exit", "w-exit-2", "cex-a", "cex-b"], tint: "beta" },
      { id: "c-kol",      label: "KOL cluster",      nodeIds: ["kol-bk", "kol-gg", "kol-pl"], tint: "gamma" },
    ],
  },
  signalBrief: [
    { id: "sb-1", priority: "critical", title: "Mint authority retained", detail: "Deployer keeps unilateral power to mint.", nodeIds: ["w-dep", "token-vine"] },
    { id: "sb-2", priority: "high",     title: "KOL pre-placement",      detail: "Recipient address surfaced in all three posts.", nodeIds: ["kol-bk", "kol-gg", "kol-pl"] },
    { id: "sb-3", priority: "high",     title: "36h exit arc",           detail: "62% of supply moved to CEX within 36h.", nodeIds: ["w-exit", "cex-a", "cex-b"] },
  ],
  timeline: [
    { at: "2025-12-04T11:22:00Z", label: "Mint", detail: "Deployer mints 100M.", evidenceIds: ["ev-mint"] },
    { at: "2026-04-12T18:04:00Z", label: "KOL window opens", detail: "3 posts in 47 minutes.", evidenceIds: [] },
    { at: "2026-04-13T06:00:00Z", label: "CEX fan-out", detail: "19 deposits, 2 venues.", evidenceIds: ["ev-cluster"] },
  ],
  classification: MOCK_CLASSIFICATION,
};

const SNAPSHOTS: Record<string, ConstellationSnapshot> = {
  vine: CONSTELLATION_VINE,
  default: CONSTELLATION_VINE,
};

export function getConstellationSnapshot(id: string): ConstellationSnapshot | null {
  return SNAPSHOTS[id] ?? null;
}
