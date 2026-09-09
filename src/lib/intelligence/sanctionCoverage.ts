// ─── BUILD 10 / P1 — « PAS DE SANCTION » EXIGE D'AVOIR REGARDÉ ─────────────
//
// ██  Un booléen `hasSanction: false` ne peut pas signifier « contrôle        ██
// ██  sanctions négatif » si des sources réglementaires attendues n'ont pas   ██
// ██  été consultées.                                                        ██
//
// Mesuré le 2026-09-08 : `amf` et `fca` sont déclarées TIER 1 au registre et
// n'ont AUCUN run en base. Les deux routes de consultation rendaient pourtant
// `hasSanction: false` — une affirmation booléenne, sans dire quelles sources
// avaient été regardées.
//
// ─── Ce que ce module fait, et ce qu'il ne fait pas ───────────────────────
//
//   fait          porter la COUVERTURE À CÔTÉ du booléen
//   ne fait pas   transformer `false` en `true`, inventer une sanction,
//                 changer un poids, un seuil ou une formule
//
// La dégradation voyage à côté de la valeur : `hasSanction` garde exactement la
// valeur qu'il avait, et `coverage` la qualifie.
//
// ─── Vocabulaire : celui qui existe déjà ──────────────────────────────────
//
// Les états par source sont ceux de `src/lib/watchdog/sourceFreshness.ts` —
// `FRESH` · `STALE` · `UNKNOWN` · `NOT_ARMED`. Aucun vocabulaire nouveau : la
// même question (« cette source a-t-elle été observée ? ») doit se lire pareil
// dans le watchdog et dans une réponse d'API.

import type { FreshnessVerdict } from "../watchdog/sourceFreshness";

/**
 * Les sources RÉGLEMENTAIRES attendues pour qu'un « pas de sanction » soit un
 * contrôle. Identique à `INTEL_TIER1_SLUGS` du watchdog — même liste, même
 * raison : ce sont les listes qui déclenchent le floor.
 */
export const EXPECTED_SANCTION_SOURCES = ["ofac", "amf", "fca"] as const;

export type SanctionCoverageState =
  /** Toutes les sources réglementaires attendues ont été observées récemment. */
  | "COMPLETE"
  /** Au moins une source attendue n'a pas été observée : le négatif ne conclut pas. */
  | "PARTIAL";

export interface SanctionCoverage {
  readonly state: SanctionCoverageState;
  /** Les sources réglementaires effectivement observées. */
  readonly consulted: readonly string[];
  /** Celles qui manquent, avec leur état — jamais un simple « absent ». */
  readonly notConsulted: readonly { readonly source: string; readonly state: string }[];
  /**
   * Ce que le booléen `hasSanction: false` autorise à conclure.
   * `true` seulement quand la couverture est complète.
   */
  readonly negativeIsConclusive: boolean;
}

/**
 * La couverture, à partir des verdicts de fraîcheur déjà calculés.
 *
 * Une source compte comme consultée si elle est `FRESH`. `STALE`, `UNKNOWN` et
 * `NOT_ARMED` ne comptent pas — pour trois raisons différentes, et le détail les
 * distingue au lieu de les fondre en « absente ».
 */
export function buildSanctionCoverage(
  verdicts: readonly FreshnessVerdict[],
  expected: readonly string[] = EXPECTED_SANCTION_SOURCES,
): SanctionCoverage {
  const parSlug = new Map(verdicts.map((v) => [v.sourceSlug, v]));
  const consulted: string[] = [];
  const notConsulted: { source: string; state: string }[] = [];

  for (const slug of expected) {
    const v = parSlug.get(slug);
    // Une source attendue dont on n'a AUCUN verdict n'est pas « fraîche par
    // défaut » : elle est non observée, et on le dit avec le même mot que le
    // watchdog emploie pour un collecteur jamais exécuté.
    const state = v?.state ?? "NOT_ARMED";
    if (state === "FRESH") consulted.push(slug);
    else notConsulted.push({ source: slug, state });
  }

  return {
    state: notConsulted.length === 0 ? "COMPLETE" : "PARTIAL",
    consulted,
    notConsulted,
    negativeIsConclusive: notConsulted.length === 0,
  };
}

/**
 * Le champ qui qualifie `hasSanction`, en trois cas exactement.
 *
 *   MATCHED               une sanction a été trouvée
 *   NO_MATCH_COMPLETE     aucune, et toutes les sources attendues ont été vues
 *   NO_MATCH_PARTIAL      aucune, mais la couverture est incomplète
 *
 * Le troisième cas est le seul qui manquait, et c'est celui qui se lisait
 * comme le second.
 */
export type SanctionAssessment = "MATCHED" | "NO_MATCH_COMPLETE" | "NO_MATCH_PARTIAL";

export function assessSanction(
  hasSanction: boolean,
  coverage: SanctionCoverage,
): SanctionAssessment {
  if (hasSanction) return "MATCHED";
  return coverage.negativeIsConclusive ? "NO_MATCH_COMPLETE" : "NO_MATCH_PARTIAL";
}

// ═══ BUILD 12 · S3 — LA COUVERTURE, GÉNÉRALISÉE AU CHEMIN PRÉ-ACHAT ═══════
//
// ██  NEVER_EXECUTED ne projette JAMAIS en NO_MATCH.                       ██
//
// Ce qui précède ferme le motif pour les SANCTIONS, sur deux routes. Mesuré le
// 2026-09-09, il en manquait deux : `/api/v1/score` et `/api/partner/v1/*`
// servent `sources: []` et « No major risk signals detected. » pendant que
// `amf` et `fca` n'ont JAMAIS tourné — 0 lot, 0 observation. Sur le chemin
// pré-achat, « jamais exécutée » est indistinguable de « vérifiée, rien
// trouvé ».
//
// Ce n'est PAS une seconde autorité. `buildSanctionCoverage` prend déjà son
// périmètre en PARAMÈTRE : la généralisation était prévue, elle n'est pas
// réécrite. Ce qui suit ajoute le vocabulaire d'absence TYPÉ et le
// dénominateur, que la forme sanctions n'avait pas besoin de porter.
//
// ─── AU2 — le dénominateur n'inclut pas une source sans run ───────────────
//
// Le périmètre ANNONCÉ est le périmètre RÉELLEMENT vérifié. Une source
// déclarée et jamais exécutée n'entre pas au dénominateur : elle est NOMMÉE
// dans `notVerified`, avec son motif. Gonfler le dénominateur gonflerait aussi
// le périmètre vide — c'est le critère B4/B5 du corpus de T2.

import type { MeasurementState } from "@/lib/publication/absenceVocabulary";

/**
 * Les sources d'intelligence DÉCLARÉES par la politique du scoreur.
 * Déclarées ne veut pas dire exécutées : c'est tout le sujet.
 */
export const DECLARED_INTELLIGENCE_SOURCES = [
  "ofac",
  "amf",
  "fca",
  "scamsniffer",
  "forta",
  "goplus",
] as const;

/**
 * L'état de fraîcheur, traduit dans le vocabulaire d'absence RATIFIÉ.
 * Aucun jeton inventé — critère B2b.
 */
export function freshnessToMeasurementState(state: string): MeasurementState {
  switch (state) {
    case "FRESH":
      return "MEASURED";
    case "STALE":
      return "STALE";
    // Jamais armée : la capacité n'a pas produit une ligne. Ce n'est ni
    // « non applicable » — elle est déclarée — ni « inconnu ».
    case "NOT_ARMED":
      return "NOT_MEASURED";
    default:
      return "UNKNOWN";
  }
}

export interface IntelligenceCoverage {
  readonly state: SanctionCoverageState;
  /** Le périmètre RÉELLEMENT vérifié. Jamais le périmètre déclaré. */
  readonly verifiedScope: readonly string[];
  /** La taille de ce périmètre — le dénominateur honnête. */
  readonly denominator: number;
  /** Les déclarées non vérifiées, avec leur motif TYPÉ. Jamais un simple absent. */
  readonly notVerified: readonly { readonly source: string; readonly reason: MeasurementState }[];
  /** Ce qu'un no-match autorise à conclure. */
  readonly negativeIsConclusive: boolean;
}

/**
 * La couverture d'intelligence, sur le périmètre déclaré passé en argument.
 *
 * Même question que `buildSanctionCoverage` — « cette source a-t-elle été
 * observée ? » — sur un périmètre plus large, et avec le motif typé.
 */
export function buildIntelligenceCoverage(
  verdicts: readonly FreshnessVerdict[],
  declared: readonly string[] = DECLARED_INTELLIGENCE_SOURCES,
): IntelligenceCoverage {
  const parSlug = new Map(verdicts.map((v) => [v.sourceSlug, v]));
  const verifiedScope: string[] = [];
  const notVerified: { source: string; reason: MeasurementState }[] = [];

  for (const slug of declared) {
    // Une source dont on n'a AUCUN verdict n'est pas fraîche par défaut.
    const etat = parSlug.get(slug)?.state ?? "NOT_ARMED";
    if (etat === "FRESH") verifiedScope.push(slug);
    else notVerified.push({ source: slug, reason: freshnessToMeasurementState(etat) });
  }

  return {
    state: notVerified.length === 0 ? "COMPLETE" : "PARTIAL",
    verifiedScope,
    // AU2 — le dénominateur EST le périmètre vérifié, pas le déclaré.
    denominator: verifiedScope.length,
    notVerified,
    negativeIsConclusive: notVerified.length === 0,
  };
}

// ─── Le lecteur — une requête, sur le journal d'exécution ─────────────────
//
// Même source de vérité que la sonde du watchdog : `intel_ingestion_batches`,
// journal en append écrit par le collecteur lui-même. Pas les horodatages
// d'observation, qui datent le dernier CHANGEMENT et non la dernière
// observation (voir sourceFreshness.ts).

import { prisma } from "../prisma";
import { assessSourceFreshness } from "../watchdog/sourceFreshness";

/** Seuils réglementaires, alignés sur ceux du watchdog. */
const LIMITS: Record<string, number> = { ofac: 7, amf: 14, fca: 14 };
const DEFAULT_LIMIT_DAYS = 30;

interface BatchRow {
  sourceSlug: string;
  last_started_at: Date | null;
  last_success_at: Date | null;
}

/**
 * La couverture courante. Une seule requête agrégée sur une table de quelques
 * dizaines de lignes.
 *
 * En cas d'échec de lecture, on ne rend PAS une couverture complète par défaut :
 * une panne ne prouve pas qu'on a regardé. Toutes les sources attendues
 * ressortent alors `UNKNOWN`, et le négatif cesse d'être concluant.
 */
export async function readSanctionCoverage(): Promise<SanctionCoverage> {
  try {
    const rows = await prisma.$queryRawUnsafe<BatchRow[]>(
      `SELECT "sourceSlug",
              max("startedAt")                                      AS last_started_at,
              max("completedAt") FILTER (WHERE status = 'success')   AS last_success_at
         FROM intel_ingestion_batches
        GROUP BY "sourceSlug"`,
    );
    const verdicts = assessSourceFreshness(
      rows.map((r) => ({
        sourceSlug: r.sourceSlug,
        lastStartedAt: r.last_started_at ? new Date(r.last_started_at) : null,
        lastSuccessAt: r.last_success_at ? new Date(r.last_success_at) : null,
      })),
      [...EXPECTED_SANCTION_SOURCES],
      LIMITS,
      DEFAULT_LIMIT_DAYS,
      new Date(),
    );
    return buildSanctionCoverage(verdicts);
  } catch {
    return buildSanctionCoverage([]);
  }
}
