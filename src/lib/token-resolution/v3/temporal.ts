// ─── D2 — le temps est une contrainte d'identité ───────────────────────────
// En V2, postTimestamp était décoratif : reçu dans la requête, jamais lu. Un
// tweet de 2024 pouvait donc être « résolu » sur un mint créé en 2026, parce
// que ce mint était le plus liquide au moment du scan. C'est un faux positif
// silencieux, et le pire genre : il a l'air d'une réponse.
//
// Un contrat né APRÈS l'observation ne peut pas être le token observé. Ce n'est
// pas une baisse de confiance, c'est une impossibilité. Le candidat est ÉCARTÉ.
//
// ─── Le piège à ne pas reproduire ────────────────────────────────────────
// Toutes les dates dont on dispose ne bornent PAS la même chose :
//
//   pairCreatedAt (DexScreener)   date de la PAIRE, pas du mint. Un token peut
//                                 exister, être poussé, et n'obtenir sa paire
//                                 que bien plus tard. Une paire postérieure à
//                                 l'observation NE PROUVE PAS que le mint l'est.
//   KolTokenLink.createdAt        date de la LIGNE en base, pas du token.
//   KolPromotionMention.postedAt  date du POST — borne HAUTE d'existence : le
//                                 token existait au plus tard à cette date.
//   TokenLaunchMetric.launchAt    date de lancement déclarée — proche du mint.
//   token_casefiles.tgeDate       événement de génération du token.
//
// D'où deux régimes de tolérance : les preuves qui bornent réellement la
// naissance du contrat, et les preuves indirectes qu'on ne laisse conclure à
// l'impossibilité qu'au-delà d'un écart franc. Confondre les deux ferait
// disparaître des tokens réels — l'erreur inverse, et tout aussi grave.

import type { CandidateSource, TemporalVerdict, TokenCandidate } from "./types";
import type { ResolutionPolicy } from "./policy";

/**
 * Sources dont la date borne SÉRIEUSEMENT la naissance du contrat.
 * Tout le reste est traité comme preuve indirecte.
 */
export const STRONG_BIRTH_EVIDENCE: ReadonlySet<CandidateSource> = new Set<CandidateSource>([
  "launch_metric",
  "casefile",
]);

export function isStrongBirthEvidence(source: CandidateSource | null): boolean {
  return !!source && STRONG_BIRTH_EVIDENCE.has(source);
}

export interface TemporalAssessment {
  verdict: TemporalVerdict;
  /** Écart en millisecondes : positif = le candidat est né APRÈS l'observation. */
  deltaMs: number | null;
  detail: string | null;
}

/**
 * Verdict temporel d'un candidat face à une observation.
 * Sans date d'observation, tout est "unknown" : le module ne fabrique pas de
 * contrainte qu'on ne lui a pas donnée.
 */
export function assessTemporal(
  candidate: Pick<TokenCandidate, "signals" | "symbol">,
  observedAt: Date | null | undefined,
  policy: ResolutionPolicy,
): TemporalAssessment {
  if (!observedAt) return { verdict: "unknown", deltaMs: null, detail: null };
  const observedMs = observedAt.getTime();
  if (!Number.isFinite(observedMs)) {
    return { verdict: "unknown", deltaMs: null, detail: "date d'observation invalide" };
  }

  const born = candidate.signals.firstSeenAt;
  const source = candidate.signals.firstSeenSource;
  if (born == null) return { verdict: "unknown", deltaMs: null, detail: null };

  const deltaMs = born - observedMs;
  if (deltaMs <= 0) return { verdict: "compatible", deltaMs, detail: null };

  const strong = isStrongBirthEvidence(source);
  const tolerance = strong ? policy.temporalToleranceMs : policy.temporalWeakToleranceMs;

  if (deltaMs <= tolerance) {
    return {
      verdict: "compatible",
      deltaMs,
      detail:
        `naissance attestée ${formatDelta(deltaMs)} après l'observation, dans la tolérance ` +
        `${strong ? "stricte" : "indirecte"} — retenu`,
    };
  }

  return {
    verdict: "impossible",
    deltaMs,
    detail:
      `contrat attesté ${formatDelta(deltaMs)} APRÈS l'observation ` +
      `(preuve ${strong ? "directe" : "indirecte"}: ${source}) — ne peut pas être le token observé`,
  };
}

function formatDelta(ms: number): string {
  const days = ms / 86_400_000;
  if (days >= 365) return `${(days / 365).toFixed(1)} an(s)`;
  if (days >= 1) return `${Math.round(days)} jour(s)`;
  const hours = ms / 3_600_000;
  if (hours >= 1) return `${Math.round(hours)} h`;
  return `${Math.round(ms / 60_000)} min`;
}

/**
 * Applique le verdict temporel à une liste de candidats.
 * Les impossibles ne sont pas supprimés : ils sont MARQUÉS écartés, avec le
 * motif. Un candidat qui disparaît sans trace est un candidat qu'on ne pourra
 * pas expliquer en revue.
 */
export function applyTemporal(
  candidates: TokenCandidate[],
  observedAt: Date | null | undefined,
  policy: ResolutionPolicy,
): TokenCandidate[] {
  return candidates.map((c) => {
    const a = assessTemporal(c, observedAt, policy);
    if (a.verdict !== "impossible") {
      return { ...c, temporal: a.verdict };
    }
    return {
      ...c,
      temporal: a.verdict,
      excluded: {
        reason: "temporally_impossible" as const,
        detail: a.detail ?? "postérieur à l'observation",
      },
    };
  });
}

/** Rang temporel pour le classement : attesté antérieur d'abord. */
export function temporalRank(v: TemporalVerdict): number {
  switch (v) {
    case "compatible":
      return 2;
    case "unknown":
      return 1;
    default:
      return 0;
  }
}
