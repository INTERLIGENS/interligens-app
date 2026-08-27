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

import { CURATED_SOURCES, type CandidateSource, type TemporalVerdict, type TokenCandidate } from "./types";
import type { ResolutionPolicy } from "./policy";

/**
 * RÈGLE TEMPORELLE CANONIQUE
 * ──────────────────────────
 * Pour écarter un candidat comme temporellement impossible, il faut une borne
 * portant sur le CONTRAT / le token lui-même. Rien d'autre ne compte.
 *
 * Ce qui compte :
 *   launch_metric  launchAt        — lancement declare du token
 *   casefile       tgeDate         — generation du token
 *   dexscreener    pairCreatedAt   — premiere paire de marche du contrat
 *
 * Ce qui NE compte PAS, et n'est plus lu du tout :
 *   KolTokenLink.createdAt        date d'ecriture de la relation en base
 *   KolPromotionMention.postedAt  date du post — borne HAUTE de l'observation
 *
 * Un post date 2025 ne prouve PAS que le contrat est ne en 2025 : il prouve
 * seulement que le contrat existait au plus tard a cette date. Lire une date de
 * post comme une date de naissance inverse la charge de la preuve et ecarte de
 * vrais tokens.
 *
 * ─── Deux regimes, et pourquoi ──────────────────────────────────────────
 * NAISSANCE (launch_metric, casefile) : la date vise l'apparition du token.
 *   Tolerance stricte — decalages d'horloge et dates declarees a la journee.
 * ACTIVITE (dexscreener) : pairCreatedAt vise la premiere PAIRE. Une paire ne
 *   peut pas preceder son contrat, mais elle peut lui succeder de loin — un
 *   token peut exister, etre pousse, et n'obtenir sa paire que plus tard.
 *   Tolerance elargie, pour que ce decalage ne supprime pas de vrais tokens.
 */
export const CONTRACT_BIRTH_SOURCES: ReadonlySet<CandidateSource> = new Set<CandidateSource>([
  "launch_metric",
  "casefile",
]);

export const CONTRACT_ACTIVITY_SOURCES: ReadonlySet<CandidateSource> = new Set<CandidateSource>([
  "dexscreener",
]);

/**
 * Une source peut-elle DATER LE CONTRAT ? Toute source hors de ces deux
 * ensembles est refusee a la porte : mergeSignals ignore purement et simplement
 * son firstSeenAt. Le garde-fou vit dans le moteur, pas seulement dans le
 * lecteur — pour qu'une regression cote SQL ne puisse pas reintroduire une date
 * de relation ou de post dans le calcul d'impossibilite.
 */
export function isContractRelativeDate(source: CandidateSource | null | undefined): boolean {
  return !!source && (CONTRACT_BIRTH_SOURCES.has(source) || CONTRACT_ACTIVITY_SOURCES.has(source));
}

/** Preuve visant la naissance du contrat (par opposition a sa premiere activite). */
export function isStrongBirthEvidence(source: CandidateSource | null): boolean {
  return !!source && CONTRACT_BIRTH_SOURCES.has(source);
}

/** Conserve pour compatibilite de nommage : l'ensemble « naissance ». */
export const STRONG_BIRTH_EVIDENCE = CONTRACT_BIRTH_SOURCES;

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
        `${strong ? "stricte" : "elargie"} — retenu`,
    };
  }

  return {
    verdict: "impossible",
    deltaMs,
    detail:
      `contrat attesté ${formatDelta(deltaMs)} APRÈS l'observation ` +
      `(preuve ${strong ? "de naissance" : "d'activite"}: ${source}) — ne peut pas être le token observé`,
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
 *
 * ─── Curseur curatedRequiresTemporalCompatibility ───────────────────────
 * L'invariant encodé : une curation humaine ne peut pas ÉCRASER une
 * impossibilité temporelle. Une revue peut être postérieure au fait ; elle
 * n'inverse pas la flèche du temps.
 *
 *   true  (défaut) : le curé est écarté comme les autres s'il est impossible.
 *   false          : permissif EXPLICITE — le curé survit, marqué
 *                    temporalWaived. Tests et backtests seulement.
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
    if (
      !policy.curatedRequiresTemporalCompatibility &&
      c.sources.some((s) => CURATED_SOURCES.has(s))
    ) {
      return { ...c, temporal: a.verdict, temporalWaived: true };
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
