/**
 * Case Snapshot — selection & ranking logic.
 *
 * Pure functions only. No I/O. No React. No Prisma.
 * The Case Snapshot UI imports these to compress a CaseFile dossier into
 * a 20-30s readable surface.
 *
 * Inputs are the existing shapes already returned by `/api/explorer` and
 * `/api/evidence/snapshots` — we do NOT introduce a new fetch path.
 */

import {
  BEHAVIOR_FLAG_LABELS,
  type BehaviorFlagKey,
} from "@/lib/kol/behaviorFlags"

// ── Input shapes (subset of DossierItem and Snapshot) ──────────────────────

export interface SnapshotLinkedActor {
  handle: string
  displayName: string | null
  role: string
  tier: string | null
}

export interface SnapshotDossier {
  title: string
  summary: string | null
  linkedActors: SnapshotLinkedActor[]
  linkedActorsCount: number
  proceedsObservedTotal: number | null
  proceedsCoverage: string
  evidenceDepth: string // none | weak | moderate | strong | comprehensive
  strongestFlags: string[] // BehaviorFlagKey[]
  documentationStatus: string // documented | partial
  multiLaunchRecurrence: boolean
  multiLaunchCount?: number
  topCoordinationSignal?:
    | { labelEn: string; labelFr: string; strength: string }
    | null
}

export interface SnapshotEvidenceItem {
  id: string
  snapshotType: string // evidence_image | document_excerpt | tweet_post | other
  title: string
  caption: string
  sourceLabel: string | null
  observedAt: string | null
  imageUrl: string | null
}

// ── Solidity tier ──────────────────────────────────────────────────────────

export type SolidityTier = "CONFIRMED" | "PROBABLE" | "SIGNAL"

const DEPTH_RANK: Record<string, number> = {
  none: 0,
  weak: 1,
  moderate: 2,
  strong: 3,
  comprehensive: 4,
}

export function deriveSolidity(d: SnapshotDossier): SolidityTier {
  const depth = DEPTH_RANK[d.evidenceDepth] ?? 0
  const documented = d.documentationStatus === "documented"

  if (documented && depth >= 3) return "CONFIRMED"
  if (documented || depth >= 2) return "PROBABLE"
  return "SIGNAL"
}

export function solidityCopy(tier: SolidityTier, locale: "en" | "fr" = "en") {
  if (locale === "fr") {
    if (tier === "CONFIRMED")
      return { label: "CONFIRMÉ", line: "Affaire confirmée — preuves multi-sources" }
    if (tier === "PROBABLE")
      return { label: "PROBABLE", line: "Schéma probable — corroboration en cours" }
    return { label: "SIGNAL", line: "Signal précoce — preuves partielles" }
  }
  if (tier === "CONFIRMED")
    return { label: "CONFIRMED", line: "Confirmed case — multi-source evidence" }
  if (tier === "PROBABLE")
    return { label: "PROBABLE", line: "Probable pattern — corroboration in progress" }
  return { label: "SIGNAL", line: "Early signal — partial evidence" }
}

// ── Signal ranking (max 4) ────────────────────────────────────────────────

const FLAG_PRIORITY: Record<BehaviorFlagKey, number> = {
  LAUNDERING_INDICATORS: 100,
  COORDINATED_PROMOTION: 90,
  CROSS_CASE_RECURRENCE: 80,
  MULTI_LAUNCH_LINKED: 70,
  REPEATED_CASHOUT: 60,
  MULTI_HOP_TRANSFER: 50,
  KNOWN_LINKED_WALLETS: 40,
}

export type KeySignalKind =
  | "coordination"
  | "multi_launch"
  | "behavior_flag"
  | "proceeds"
  | "actor_density"

export interface KeySignal {
  kind: KeySignalKind
  label: string
  weight: number
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "K"
  return "$" + Math.round(n).toLocaleString("en-US")
}

export function selectKeySignals(
  d: SnapshotDossier,
  locale: "en" | "fr" = "en",
  max = 4,
): KeySignal[] {
  const out: KeySignal[] = []
  const fr = locale === "fr"

  // 1. Coordination signal (strongest takes priority)
  if (d.topCoordinationSignal) {
    const cs = d.topCoordinationSignal
    const weight = cs.strength === "strong" ? 95 : 75
    out.push({
      kind: "coordination",
      label: fr ? cs.labelFr : cs.labelEn,
      weight,
    })
  }

  // 2. Multi-launch recurrence (only if not already represented above)
  if (d.multiLaunchRecurrence && d.multiLaunchCount && d.multiLaunchCount >= 2) {
    out.push({
      kind: "multi_launch",
      label: fr
        ? `Acteurs partagés sur ${d.multiLaunchCount} dossiers`
        : `Shared actors across ${d.multiLaunchCount} dossiers`,
      weight: 88,
    })
  }

  // 3. Behavior flags ranked
  for (const raw of d.strongestFlags) {
    const key = raw as BehaviorFlagKey
    const labelObj = BEHAVIOR_FLAG_LABELS[key]
    if (!labelObj) continue
    const weight = FLAG_PRIORITY[key] ?? 30
    out.push({
      kind: "behavior_flag",
      label: labelObj[locale],
      weight,
    })
  }

  // 4. Proceeds observed
  if (d.proceedsObservedTotal != null && d.proceedsObservedTotal > 0) {
    const amt = fmtUsd(d.proceedsObservedTotal)
    out.push({
      kind: "proceeds",
      label: fr
        ? `Min. ${amt} de produits observés`
        : `Min. ${amt} in observed proceeds`,
      weight: 65,
    })
  }

  // 5. Actor density
  if (d.linkedActorsCount >= 3) {
    out.push({
      kind: "actor_density",
      label: fr
        ? `${d.linkedActorsCount} acteurs publiés liés`
        : `${d.linkedActorsCount} published actors linked`,
      weight: 55,
    })
  }

  // Dedup by label, sort by weight desc, cap at max
  const seen = new Set<string>()
  const deduped: KeySignal[] = []
  for (const s of out.sort((a, b) => b.weight - a.weight)) {
    const k = s.label.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    deduped.push(s)
    if (deduped.length >= max) break
  }
  return deduped
}

// ── Evidence ranking (max 3) ──────────────────────────────────────────────

const EVIDENCE_TYPE_WEIGHT: Record<string, number> = {
  evidence_image: 100, // on-chain artifact
  document_excerpt: 80,
  tweet_post: 60,
  other: 30,
}

export function selectCoreEvidence(
  snapshots: SnapshotEvidenceItem[],
  max = 3,
): SnapshotEvidenceItem[] {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return []
  const ranked = [...snapshots].sort((a, b) => {
    const wa = EVIDENCE_TYPE_WEIGHT[a.snapshotType] ?? 0
    const wb = EVIDENCE_TYPE_WEIGHT[b.snapshotType] ?? 0
    if (wb !== wa) return wb - wa
    const ta = a.observedAt ? new Date(a.observedAt).getTime() : 0
    const tb = b.observedAt ? new Date(b.observedAt).getTime() : 0
    return tb - ta
  })
  return ranked.slice(0, max)
}

// ── Core evidence fallback (pure copy selector) ───────────────────────────
//
// Rendered by CaseSnapshot only when selectCoreEvidence() returns an empty
// array. We never invent archived evidence — each branch below maps to a
// real field already present on the dossier, so the fallback is a truthful
// restatement of what the dossier *does* contain, not a promise of proofs
// that don't exist.
//
// Ordering = strongest truthful claim first.

export function coreEvidenceFallback(
  d: SnapshotDossier,
  locale: "en" | "fr" = "en",
): string {
  const fr = locale === "fr"
  const documented = d.documentationStatus === "documented"
  const depth = DEPTH_RANK[d.evidenceDepth] ?? 0
  const hasFlags = Array.isArray(d.strongestFlags) && d.strongestFlags.length > 0
  const hasCoord = d.topCoordinationSignal != null
  const hasActors = d.linkedActorsCount > 0
  const hasSummary = !!(d.summary && d.summary.length > 0)

  // CONFIRMED-equivalent: documented + strong/comprehensive depth
  if (documented && depth >= 3) {
    return fr
      ? "Preuves documentées dans les dossiers liés"
      : "Evidence documented in linked records"
  }

  // Documented OR published coordination/behavior signals
  if (documented || hasCoord || hasFlags) {
    return fr ? "Signaux publiés au dossier" : "Published signals on file"
  }

  // Moderate+ evidence depth with a source-backed record
  if (depth >= 2) {
    return fr
      ? "Enregistrement de cas source disponible"
      : "Source-backed case record available"
  }

  // Anything truly on file: actors or a written summary
  if (hasActors || hasSummary) {
    return fr
      ? "Éléments de dossier documentés disponibles"
      : "Documented case inputs available"
  }

  // Truly minimal — no docs, no signals, no actors, no summary
  return fr ? "Archivage de preuves en attente" : "Evidence archival pending"
}

// ── Featured actor ────────────────────────────────────────────────────────

const TIER_RANK: Record<string, number> = {
  s: 100,
  a: 80,
  b: 60,
  c: 40,
  d: 20,
}

export function selectFeaturedActor(
  d: SnapshotDossier,
): SnapshotLinkedActor | null {
  if (!d.linkedActors || d.linkedActors.length === 0) return null
  // Highest tier first; fallback to first
  const sorted = [...d.linkedActors].sort((a, b) => {
    const ra = a.tier ? TIER_RANK[a.tier.toLowerCase()] ?? 0 : 0
    const rb = b.tier ? TIER_RANK[b.tier.toLowerCase()] ?? 0 : 0
    return rb - ra
  })
  return sorted[0]
}

// ── Recommended next action ───────────────────────────────────────────────

export interface NextAction {
  label: string
  hint: string
}

export function deriveNextAction(
  tier: SolidityTier,
  d: SnapshotDossier,
  locale: "en" | "fr" = "en",
): NextAction {
  const fr = locale === "fr"
  if (tier === "CONFIRMED") {
    return fr
      ? {
          label: "OUVRIR LE DOSSIER COMPLET",
          hint:
            d.linkedActorsCount > 0
              ? `Investiguer les ${d.linkedActorsCount} acteurs liés`
              : "Examiner les preuves complètes",
        }
      : {
          label: "OPEN FULL DOSSIER",
          hint:
            d.linkedActorsCount > 0
              ? `Investigate ${d.linkedActorsCount} linked actors`
              : "Review full evidence chain",
        }
  }
  if (tier === "PROBABLE") {
    return fr
      ? {
          label: "CORROBORER LES PREUVES",
          hint: "Croiser avec la timeline KOL et l'historique on-chain",
        }
      : {
          label: "CORROBORATE EVIDENCE",
          hint: "Cross-reference with KOL timeline and on-chain history",
        }
  }
  return fr
    ? {
        label: "MONITORER",
        hint: "Preuves insuffisantes pour escalader — surveillance active",
      }
    : {
        label: "MONITOR",
        hint: "Insufficient evidence to escalate — active surveillance",
      }
}

// ── Subline (compression narrative, 1 line) ──────────────────────────────

export function buildSubline(
  d: SnapshotDossier,
  locale: "en" | "fr" = "en",
): string {
  const fr = locale === "fr"
  const parts: string[] = []
  if (d.linkedActorsCount > 0) {
    parts.push(
      fr
        ? `${d.linkedActorsCount} acteur${d.linkedActorsCount > 1 ? "s" : ""} publié${d.linkedActorsCount > 1 ? "s" : ""}`
        : `${d.linkedActorsCount} published actor${d.linkedActorsCount > 1 ? "s" : ""}`,
    )
  }
  if (d.proceedsObservedTotal != null && d.proceedsObservedTotal > 0) {
    parts.push(
      fr
        ? `min. ${fmtUsd(d.proceedsObservedTotal)} observés`
        : `min. ${fmtUsd(d.proceedsObservedTotal)} observed`,
    )
  }
  if (d.evidenceDepth && d.evidenceDepth !== "none") {
    parts.push(
      fr
        ? `profondeur de preuve : ${d.evidenceDepth}`
        : `evidence depth: ${d.evidenceDepth}`,
    )
  }
  if (d.topCoordinationSignal) {
    parts.push(
      fr ? d.topCoordinationSignal.labelFr.toLowerCase() : d.topCoordinationSignal.labelEn.toLowerCase(),
    )
  }
  return parts.join(" · ")
}
