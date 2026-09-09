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
import type { MeasurementState, PublicationState } from "@/lib/publication/absenceVocabulary";

/**
 * Les sources RÉGLEMENTAIRES DÉCLARÉES. Identique à `INTEL_TIER1_SLUGS` du
 * watchdog — même liste, même raison : ce sont les listes qui déclenchent le
 * floor.
 *
 * ─── S3.1 — ce nom a changé, et le changement EST la correction ───────────
 *
 * Elle s'appelait `EXPECTED_SANCTION_SOURCES`. Le nom énonçait le défaut :
 * une liste FIGÉE servait de périmètre ATTENDU. Avec les données réelles —
 * `ofac` FRESH, `amf` et `fca` jamais exécutées — la couverture sortait
 * `PARTIAL` / `negativeIsConclusive: false` sur TOUT scan, en permanence.
 *
 * Mesuré en production le 2026-09-09, sur `/api/scan/intelligence`, la MÊME
 * adresse que `/api/v1/score` servait déjà `COMPLETE` :
 *
 *   scan/intelligence   PARTIAL   negativeIsConclusive false   consulted [ofac]
 *   v1/score            COMPLETE  negativeConclusive   true    expected [ofac, scamsniffer]
 *
 * Deux surfaces servies, une seule adresse, deux affirmations épistémiques
 * contradictoires. DÉCLARÉ n'est pas ATTENDU : le nom le dit désormais, et
 * `expected` se DÉRIVE.
 */
export const DECLARED_SANCTION_SOURCES = ["ofac", "amf", "fca"] as const;

export type SanctionCoverageState =
  /** Toutes les sources réglementaires attendues ont été observées récemment. */
  | "COMPLETE"
  /** Au moins une source attendue n'a pas été observée : le négatif ne conclut pas. */
  | "PARTIAL";

export interface SanctionCoverage {
  readonly state: SanctionCoverageState;
  /**
   * EXPECTED — les régulatrices réellement ARMÉES. DÉRIVÉ, jamais choisi.
   * Ajouté en S3.1 : c'est le champ dont l'absence rendait la dégradation
   * permanente invisible.
   */
  readonly expected: readonly string[];
  /** Les sources réglementaires effectivement observées. */
  readonly consulted: readonly string[];
  /** Celles qui manquent, avec leur état — jamais un simple « absent ». */
  readonly notConsulted: readonly { readonly source: string; readonly state: string }[];
  /**
   * Déclarées mais JAMAIS armées. Contexte, pas dénominateur — elles restent
   * NOMMÉES au lieu de disparaître. Symétrique du champ homonyme de
   * `IntelligenceCoverage` : c'est la MÊME dérivation qui les produit.
   */
  readonly declaredNotArmed: readonly {
    readonly source: string;
    readonly reason: MeasurementState;
  }[];
  /**
   * Ce que le booléen `hasSanction: false` autorise à conclure.
   * `true` seulement quand la couverture est complète ET non vide.
   */
  readonly negativeIsConclusive: boolean;
}

// ─── S3.1 · LA DÉRIVATION DE L'ARMEMENT — UNE SEULE, POUR LES DEUX FORMES ──
//
// ██  Si les deux formes dérivaient EXPECTED chacune de son côté, le défaut ██
// ██  reviendrait sous une autre forme. Elles consomment la même.          ██
//
// C'est la même exigence qu'en S3 : on étend, on ne recopie pas. La règle est
// celle du ruling : « Expected coverage comes from actually ARMED / GOVERNED
// capability » — jamais de la liste des déclarées, et sans aucun quorum. Le
// périmètre suit la capacité armée UN POUR UN : un seuil choisi serait un
// nombre inventé, et le ruling l'interdit aussi.
//
// ─── Ce qui sert de preuve d'armement, et sa limite ───────────────────────
//
// `NOT_ARMED` de `sourceFreshness.ts` signifie exactement « déclarée au
// registre, AUCUNE ligne de run ». C'est un fait d'EXÉCUTION lu sur le journal
// `intel_ingestion_batches`, pas une déclaration d'intention.
//
// La limite, et je la déclare : une capacité pourrait être gouvernée — cron
// armé, entrée au registre — et n'avoir pas encore produit son premier lot.
// Elle serait ici « non armée ». C'est le sens CONSERVATEUR de l'erreur : on
// ne compte comme attendue que ce qui a effectivement tourné au moins une
// fois. L'inverse — croire une capacité armée sur sa seule déclaration — est
// précisément le défaut fermé ici.

export interface ArmedCapabilities {
  /** Les capacités qui ont réellement produit au moins un lot. */
  readonly armed: readonly string[];
  /** Les déclarées qui n'ont jamais tourné, NOMMÉES avec leur motif typé. */
  readonly notArmed: readonly {
    readonly source: string;
    readonly reason: MeasurementState;
  }[];
  /** Le verdict de fraîcheur par slug armé, pour éviter une seconde lecture. */
  readonly freshnessBySlug: ReadonlyMap<string, string>;
}

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

/**
 * LA dérivation. Les deux formes de couverture la consomment avec LEUR
 * périmètre déclaré — c'est le périmètre qui diffère, jamais la règle.
 */
export function deriveArmedCapabilities(
  verdicts: readonly FreshnessVerdict[],
  declared: readonly string[],
): ArmedCapabilities {
  const parSlug = new Map(verdicts.map((v) => [v.sourceSlug, v]));
  const armed: string[] = [];
  const notArmed: { source: string; reason: MeasurementState }[] = [];
  const freshnessBySlug = new Map<string, string>();

  for (const slug of declared) {
    // Sans verdict, la source n'a jamais été observée : NOT_ARMED, pas
    // « fraîche par défaut ».
    const etat = parSlug.get(slug)?.state ?? "NOT_ARMED";
    if (etat === "NOT_ARMED") {
      notArmed.push({ source: slug, reason: freshnessToMeasurementState(etat) });
      continue;
    }
    armed.push(slug);
    freshnessBySlug.set(slug, etat);
  }
  return { armed, notArmed, freshnessBySlug };
}

/**
 * La couverture SANCTIONS, à partir des verdicts de fraîcheur déjà calculés.
 *
 * Une source compte comme consultée si elle est `FRESH`. `STALE` et `UNKNOWN`
 * ne comptent pas — elles sont ARMÉES et manquantes, donc elles dégradent.
 * `NOT_ARMED` ne dégrade pas : elle n'est pas attendue, elle est nommée.
 *
 * Le second paramètre est le périmètre DÉCLARÉ, pas l'attendu. Le renommer
 * n'est pas cosmétique : c'est ce que la fonction reçoit, et l'appeler
 * `expected` était l'origine de la confusion.
 */
export function buildSanctionCoverage(
  verdicts: readonly FreshnessVerdict[],
  declared: readonly string[] = DECLARED_SANCTION_SOURCES,
): SanctionCoverage {
  const { armed, notArmed, freshnessBySlug } = deriveArmedCapabilities(verdicts, declared);
  const consulted: string[] = [];
  const notConsulted: { source: string; state: string }[] = [];

  for (const slug of armed) {
    const state = freshnessBySlug.get(slug) ?? "UNKNOWN";
    if (state === "FRESH") consulted.push(slug);
    else notConsulted.push({ source: slug, state });
  }

  // ██ LES DEUX BORNES, ET AUCUNE NE SUFFIT SEULE.
  //
  // `notConsulted.length === 0` seul rendrait « complet » vrai d'un périmètre
  // VIDE — la sur-correction par le vide, où personne n'a regardé et où le
  // contrat conclut quand même. `armed.length > 0` la ferme.
  const conclusif = notConsulted.length === 0 && armed.length > 0;

  return {
    state: conclusif ? "COMPLETE" : "PARTIAL",
    expected: armed,
    consulted,
    notConsulted,
    declaredNotArmed: notArmed,
    negativeIsConclusive: conclusif,
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

/**
 * ─── S3.2 · UN RÉSULTAT SUPPRIMÉ NE PRODUIT JAMAIS UN NÉGATIF CONCLUANT ───
 *
 * ██  Deux axes, deux raisons de ne pas conclure, et ils ne se collapsent  ██
 * ██  PAS.                                                                ██
 *
 *   couverture incomplète    on n'a pas tout REGARDÉ    (MEASUREMENT)
 *   publication retirée      on a trouvé, et retiré     (PUBLICATION)
 *
 * Le second manquait. Mesuré en production le 2026-09-09 sur 0xa5b0edf6…,
 * adresse RÉELLEMENT sanctionnée OFAC : `NO_MATCH_COMPLETE` avec
 * `negativeIsConclusive: true` — une affirmation concluante de propreté.
 *
 * Le paramètre a un DÉFAUT `PUBLISHED`, et c'est délibéré : le défaut
 * inverse — traiter toute absence d'information comme un retrait — rendrait
 * chaque scan non concluant, et l'alerte redeviendrait le fond. Un appelant
 * qui SAIT qu'un retrait a eu lieu le dit ; c'est le matcher, et il le sait.
 *
 * On ne révèle RIEN du retrait : ni source, ni classe, ni compte. On cesse
 * seulement d'affirmer.
 */
export function assessSanction(
  hasSanction: boolean,
  coverage: SanctionCoverage,
  publicationState: PublicationState = "PUBLISHED",
): SanctionAssessment {
  // Trouver prime sur avoir tout regardé — un match réel sort TOUJOURS, et un
  // retrait ne peut pas l'effacer.
  if (hasSanction) return "MATCHED";
  // Un résultat retiré pour cette audience ne conclut rien, quelle que soit la
  // qualité de la couverture. Les deux conditions sont indépendantes : exiger
  // les deux est ce qui empêche l'une de racheter l'autre.
  if (publicationState !== "PUBLISHED") return "NO_MATCH_PARTIAL";
  return coverage.negativeIsConclusive ? "NO_MATCH_COMPLETE" : "NO_MATCH_PARTIAL";
}

/**
 * Ce qu'un négatif autorise à conclure, les DEUX axes composés.
 *
 * `negativeIsConclusive` seul ne suffit plus : il ne parle que des
 * collecteurs. Cette fonction est la seule place où les deux se rencontrent,
 * pour qu'aucune surface n'en compose sa propre version.
 */
export function negativeIsConclusiveForAudience(
  coverage: SanctionCoverage,
  publicationState: PublicationState = "PUBLISHED",
): boolean {
  return coverage.negativeIsConclusive && publicationState === "PUBLISHED";
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
 * Les quatre états que le CONTRAT doit distinguer, ratifiés :
 *
 *   EXPECTED            les capacités réellement ARMÉES et gouvernées
 *   CONSULTED-MEASURED  celles des attendues effectivement observées
 *   NOT_CONSULTED       attendues, non observées, AVEC leur motif typé
 *   NEGATIVE_CONCLUSIVE ce qu'un no-match autorise à conclure
 *
 * ─── EXPECTED ≠ DECLARED, et c'est le cœur ───────────────────────────────
 *
 * Une source DÉCLARÉE et jamais exécutée n'entre PAS au dénominateur attendu.
 * Sinon `amf` et `fca` — non opérationnelles en permanence — feraient sortir
 * CHAQUE scan en dégradé, et l'alerte deviendrait le fond.
 *
 * C'est exactement le piège de `holders` fermé en phase 2 : le compter aux
 * attendus aurait mis `degraded: true` sur toute réponse SOL. Présent à
 * l'inventaire, absent du dénominateur.
 *
 * Elles ne disparaissent pas pour autant : elles sortent dans
 * `declaredNotArmed`, nommées, avec leur motif. Le lecteur voit qu'elles
 * existent et qu'elles n'ont jamais tourné — il ne le devine pas.
 *
 * ─── Ce qui dégrade, en revanche ──────────────────────────────────────────
 *
 * Une source ARMÉE dont l'observation est PÉRIMÉE (`STALE`) est attendue et
 * manquante : elle dégrade. On compte `FRESH`, jamais `!== NOT_ARMED` — une
 * copie écrite ainsi compterait une source périmée comme consultée.
 */
export interface IntelligenceCoverage {
  /** EXPECTED — les capacités réellement armées. Le dénominateur honnête. */
  readonly expected: readonly string[];
  /** CONSULTED-MEASURED — les attendues effectivement observées. */
  readonly consultedMeasured: readonly string[];
  /** NOT_CONSULTED — attendues, non observées, avec motif TYPÉ. */
  readonly notConsulted: readonly { readonly source: string; readonly reason: MeasurementState }[];
  /**
   * Déclarées mais JAMAIS armées. Contexte, pas dénominateur : elles ne
   * dégradent rien, et elles restent visibles.
   */
  readonly declaredNotArmed: readonly { readonly source: string; readonly reason: MeasurementState }[];
  /** = `expected.length`. Jamais la taille du périmètre déclaré. */
  readonly denominator: number;
  readonly state: SanctionCoverageState;
  /** NEGATIVE_CONCLUSIVE. Faux si rien n'est attendu — un périmètre vide ne conclut pas. */
  readonly negativeConclusive: boolean;
}

export function buildIntelligenceCoverage(
  verdicts: readonly FreshnessVerdict[],
  declared: readonly string[] = DECLARED_INTELLIGENCE_SOURCES,
): IntelligenceCoverage {
  // ██ LA MÊME DÉRIVATION QUE LA FORME SANCTIONS. Pas une copie : l'appel.
  //
  // S3.1 : deux dérivations parallèles auraient recréé le défaut sous une
  // autre forme en six semaines. C'est le périmètre déclaré qui distingue les
  // deux formes, jamais la règle d'armement.
  const { armed, notArmed, freshnessBySlug } = deriveArmedCapabilities(verdicts, declared);
  const expected: readonly string[] = armed;
  const consultedMeasured: string[] = [];
  const notConsulted: { source: string; reason: MeasurementState }[] = [];
  const declaredNotArmed: { source: string; reason: MeasurementState }[] = [...notArmed];

  for (const slug of armed) {
    const etat = freshnessBySlug.get(slug) ?? "UNKNOWN";
    // `FRESH`, et rien d'autre. `STALE` est armée mais périmée : elle manque.
    if (etat === "FRESH") consultedMeasured.push(slug);
    else notConsulted.push({ source: slug, reason: freshnessToMeasurementState(etat) });
  }

  return {
    expected,
    consultedMeasured,
    notConsulted,
    declaredNotArmed,
    denominator: expected.length,
    state: notConsulted.length === 0 && expected.length > 0 ? "COMPLETE" : "PARTIAL",
    // Un périmètre attendu VIDE ne conclut rien : personne n'a regardé.
    negativeConclusive: notConsulted.length === 0 && expected.length > 0,
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
      [...DECLARED_SANCTION_SOURCES],
      LIMITS,
      DEFAULT_LIMIT_DAYS,
      new Date(),
    );
    return buildSanctionCoverage(verdicts);
  } catch {
    return buildSanctionCoverage([]);
  }
}

/**
 * La couverture d'INTELLIGENCE courante, sur le périmètre déclaré complet.
 *
 * Même journal d'exécution que `readSanctionCoverage` — `intel_ingestion_batches`,
 * écrit par le collecteur lui-même. Une seule requête agrégée.
 *
 * Fail-closed identique : une panne de lecture ne rend PAS une couverture
 * complète. Toutes les sources ressortent sans verdict, donc jamais armées, et
 * le périmètre attendu est vide — ce qui ne conclut rien.
 */
export async function readIntelligenceCoverage(): Promise<IntelligenceCoverage> {
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
      [...DECLARED_INTELLIGENCE_SOURCES],
      LIMITS,
      DEFAULT_LIMIT_DAYS,
      new Date(),
    );
    return buildIntelligenceCoverage(verdicts);
  } catch {
    return buildIntelligenceCoverage([]);
  }
}
