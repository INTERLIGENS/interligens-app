// ─── S2 — Correspondance « source de résolution » → DataNature ──────────────
// Le résolveur de scan porte déjà, sous le nom `source`, un discriminateur de
// nature qui s'ignore : curated = affirmation éditoriale, mentions = observation
// du produit, dexscreener/coingecko = donnée tierce. Ce module le nomme.
//
// Vit hors chemin gelé pour que le diff sur `src/app/api/` reste minimal.

import type { DataNature } from "./nature";

/** Sources du résolveur V1 (`/api/scan/resolve`). */
export const RESOLVE_SOURCE_NATURE: Record<string, DataNature> = {
  curated: "EDITORIAL_ASSERTION",
  mentions: "PRIMARY_OBSERVATION",
  dexscreener: "THIRD_PARTY_DATA",
  coingecko: "THIRD_PARTY_DATA",
};

/** Sources du module de résolution V3 (`token-resolution/v3`). */
export const CANDIDATE_SOURCE_NATURE: Record<string, DataNature> = {
  explicit_ca: "PRIMARY_OBSERVATION",
  casefile: "EDITORIAL_ASSERTION",
  casefile_preset: "EDITORIAL_ASSERTION",
  curated: "EDITORIAL_ASSERTION",
  curated_draft: "EDITORIAL_ASSERTION",
  ca_map: "EDITORIAL_ASSERTION",
  case_index: "EDITORIAL_ASSERTION",
  mentions: "PRIMARY_OBSERVATION",
  involvement: "PRIMARY_OBSERVATION",
  launch_metric: "THIRD_PARTY_DATA",
  price_tracker: "INFERENCE",
  scan_aggregate: "INFERENCE",
  dexscreener: "THIRD_PARTY_DATA",
  coingecko: "THIRD_PARTY_DATA",
  onchain: "PRIMARY_OBSERVATION",
};

export function natureForResolveSource(source: string | null | undefined): DataNature | null {
  if (!source) return null;
  return RESOLVE_SOURCE_NATURE[source] ?? CANDIDATE_SOURCE_NATURE[source] ?? null;
}
