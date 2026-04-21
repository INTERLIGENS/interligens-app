/**
 * Public Constellation pipeline.
 *
 * Frontier rule (see MASTER):
 *   - public surface  = FROZEN snapshot JSON, no live polling, no randomness.
 *   - investigator    = live graph, same schema, wired to real sources.
 * Both sides read the exact `GraphData` shape from `lib/contracts/website`.
 * This module is the ONLY allowed entry point for the public side.
 *
 * ── VALIDATION RULE ─────────────────────────────────────────────────────
 *   Any source of a `ConstellationSnapshot` — frozen fixture, signed URL,
 *   API response, or future live feed — MUST pass `validateSnapshot()`
 *   before reaching a renderer. The default `loadSnapshot` below already
 *   does this; custom fetchers plugged in via `createSnapshotLoader()`
 *   inherit the same guarantee. Rendering an unvalidated snapshot is a
 *   bug: broken coordinates or dangling edges must fail loudly at load
 *   time, not silently in the DOM.
 */

import type {
  ConstellationSnapshot,
  GraphData,
} from "@/lib/contracts/website";

export type SnapshotLoader = (id: string) => Promise<ConstellationSnapshot>;
export type RawSnapshotFetcher = (id: string) => Promise<ConstellationSnapshot>;

/**
 * Sanity: a snapshot must have coordinates for every node and every edge
 * must reference known nodes. Throws with a useful message so a broken
 * mock fails loudly at build time, not silently in the DOM.
 */
export function validateSnapshot(snap: ConstellationSnapshot): void {
  const ids = new Set(snap.graph.nodes.map((n) => n.id));
  for (const n of snap.graph.nodes) {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
      throw new Error(`node ${n.id} missing coordinates`);
    }
  }
  for (const e of snap.graph.edges) {
    if (!ids.has(e.source)) throw new Error(`edge ${e.id} source ${e.source} unknown`);
    if (!ids.has(e.target)) throw new Error(`edge ${e.id} target ${e.target} unknown`);
  }
}

/**
 * Wrap any raw snapshot fetcher with `validateSnapshot()` so no unvalidated
 * payload can reach a renderer. Use this when swapping in a signed-URL or
 * API fetcher — do not call a raw fetcher directly from a page.
 */
export function createSnapshotLoader(fetcher: RawSnapshotFetcher): SnapshotLoader {
  return async (id) => {
    const snap = await fetcher(id);
    validateSnapshot(snap);
    return snap;
  };
}

/**
 * Default loader: reads a frozen snapshot from the in-repo mocks layer and
 * validates it. Real deployments swap the fetcher via `createSnapshotLoader`
 * so validation stays enforced; do not bypass it.
 */
export const loadSnapshot: SnapshotLoader = createSnapshotLoader(async (id) => {
  const { getConstellationSnapshot } = await import("@/lib/mocks/constellation");
  const snap = getConstellationSnapshot(id);
  if (!snap) throw new Error(`constellation snapshot not found: ${id}`);
  return snap;
});

export type { GraphData, ConstellationSnapshot };
