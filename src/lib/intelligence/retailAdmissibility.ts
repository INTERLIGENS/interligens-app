// ─── AM · P0 — L'AUTORITÉ D'ADMISSIBILITÉ RETAIL, ET ELLE EST UNIQUE ───────
//
// ██  Une décision retail ne reçoit d'autorité QUE de contributions          ██
// ██  retail-admissibles.                                                    ██
//
// ─── Ce qu'il y avait ─────────────────────────────────────────────────────
//
// `matchEntity` filtrait `observations.listIsActive` — UN axe — et ignorait
// `entity.isActive` et `entity.displaySafety`. Une entité désactivée, ou
// marquée INTERNAL_ONLY (qui est LA VALEUR PAR DÉFAUT du schéma), pouvait donc
// déplacer un score servi au public et aux partenaires.
//
// Un axe gaté, deux qui ne l'étaient pas.
//
// ─── L'autorité est COMPOSÉE, aucun champ unique ne s'y substitue ─────────
//
//   AUTORITÉ DE SOURCE × PROVENANCE D'INGESTION × CYCLE DE VIE OBSERVATION
//   × CYCLE DE VIE ENTITÉ × AUDIENCE
//
// ─── AX — pourquoi l'autorité de source ne suffit PAS ─────────────────────
//
// Mesuré le 2026-09-09 : `forta` est PRÉSENT au registre et déclaré publiable,
// donc le prédicat le laissait passer. Or ses 3 observations n'ont AUCUN lot
// d'ingestion — écriture hors pipeline. Et elles ne sont pas seules : les 8
// observations sans lot ont toutes été écrites dans le MÊME intervalle de
// 333 millisecondes, le 2026-04-08 à 18:58:32 UTC, entrelacées entre `ofac`,
// `forta` et `scamsniffer`. La signature d'un seed, pas d'un run.
//
// Une observation qui fait autorité pour le retail doit avoir une provenance
// d'ingestion GOUVERNÉE ET TRAÇABLE. La source dit qui a le droit de parler ;
// la provenance dit que cette instance-ci vient bien de là.
//
// Les deux premiers axes sont des faits sur la ligne. Le troisième est une
// POLITIQUE, et elle existait déjà : `SourceRegistry` la porte, curée à la
// main — Chainalysis, Elliptic, Nansen, TRM Labs, AML Bot et Crystal y sont
// `internal_only`, les régulateurs y sont `public`. On la LIT, on ne la
// réécrit pas, et on ne code en dur aucun nom de source.
//
// ─── Ce que ce fichier n'est pas ──────────────────────────────────────────
//
// Ce n'est pas une gate de scoring. Il ne touche ni aux poids, ni aux seuils,
// ni au plancher, ni au plafond. Il décide QUELLES observations entrent dans
// le calcul ; le scoreur existant fait le reste, inchangé, sur ce qui reste.
//
// Et ce n'est pas une neutralisation de l'intelligence interne : l'audience
// INTERNAL voit tout ce que le cycle de vie de l'observation laisse vivant.
// C'est l'objet même d'une couche de renseignement interne.
//
// ─── Sur les trois états de displaySafety ─────────────────────────────────
//
//   INTERNAL_ONLY .... pas autorisé retail au niveau ENTITÉ
//   ANALYST_REVIEWED . relu, et EXPLICITEMENT pas encore autorisé au scanner
//   RETAIL_SAFE ...... autorisé retail au niveau ENTITÉ
//
// Les deux premiers refusent tous deux l'autorité de niveau entité, mais ils
// NE DISENT PAS la même chose et on ne les confond pas.

import { prisma } from "@/lib/prisma";

/** Qui consomme. Explicite, jamais déduit d'un chemin d'URL. */
export type IntelAudience = "RETAIL" | "INTERNAL";

/** Les trois états du schéma. `INTERNAL_ONLY` est le DÉFAUT. */
export type EntityDisplaySafety = "INTERNAL_ONLY" | "ANALYST_REVIEWED" | "RETAIL_SAFE";

/** Le cycle de vie de l'entité, et son autorisation de niveau entité. */
export interface EntityAdmissibilityFacts {
  isActive: boolean;
  displaySafety: EntityDisplaySafety | string;
}

/** Le cycle de vie de l'observation, la source qui la porte, sa provenance. */
export interface ObservationAdmissibilityFacts {
  sourceSlug: string;
  listIsActive: boolean;
  /**
   * L'instance se rattache-t-elle à un lot d'ingestion gouverné.
   *
   * `undefined` n'est PAS « oui » : un appelant qui ne sait pas répondre n'a
   * pas prouvé la provenance, et le défaut d'une preuve absente est son
   * absence. Voir `admitObservations`.
   */
  ingestionProvenanceProven?: boolean;
}

/**
 * Pourquoi une contribution a été écartée. Nommé, jamais silencieux — une
 * observation absente du calcul doit pouvoir être expliquée.
 */
export type RefusAdmissibilite =
  | "ENTITY_INACTIVE"
  | "OBSERVATION_INACTIVE"
  /** Entité jamais soumise à revue, et source non publiable. */
  | "ENTITY_INTERNAL_ONLY_AND_SOURCE_NOT_RETAIL_ADMISSIBLE"
  /** Entité RELUE mais explicitement pas encore autorisée au scanner. */
  | "ENTITY_ANALYST_REVIEWED_AND_SOURCE_NOT_RETAIL_ADMISSIBLE"
  /**
   * L'instance d'observation ne se rattache à aucun lot d'ingestion gouverné.
   *
   * Vocabulaire ratifié : DECLARED → SCHEDULED → REGISTERED → EXECUTED →
   * PROVENANCED → ADMISSIBLE. Cette ligne s'arrête avant PROVENANCED.
   * `MEASURED` n'apparaît pas ici : c'est un état de requête, pas une
   * identité de source.
   */
  | "UNPROVEN_INGESTION_PROVENANCE"
  /** Un état d'autorisation que le vocabulaire ne connaît pas. */
  | "ENTITY_CLEARANCE_UNKNOWN_AND_SOURCE_NOT_RETAIL_ADMISSIBLE";

/**
 * Pourquoi l'entité n'autorise pas, quand elle n'autorise pas.
 *
 * `INTERNAL_ONLY` et `ANALYST_REVIEWED` refusent tous deux l'autorité de
 * NIVEAU ENTITÉ — mais ils ne disent pas la même chose. Le premier n'a jamais
 * été soumis à revue ; le second a été relu et explicitement PAS encore
 * autorisé au scanner. Les aplatir en un seul refus perdrait l'information qui
 * dit à un opérateur laquelle des deux actions il lui reste à faire.
 */
function refusDeNiveauEntite(displaySafety: string): RefusAdmissibilite {
  if (displaySafety === "INTERNAL_ONLY") {
    return "ENTITY_INTERNAL_ONLY_AND_SOURCE_NOT_RETAIL_ADMISSIBLE";
  }
  if (displaySafety === "ANALYST_REVIEWED") {
    return "ENTITY_ANALYST_REVIEWED_AND_SOURCE_NOT_RETAIL_ADMISSIBLE";
  }
  return "ENTITY_CLEARANCE_UNKNOWN_AND_SOURCE_NOT_RETAIL_ADMISSIBLE";
}

/**
 * La politique de source, telle qu'elle est ÉCRITE dans `SourceRegistry`.
 *
 * Clé = `SourceRegistry.handle`, qui est ce à quoi `SourceObservation.sourceSlug`
 * correspond réellement — mesuré le 2026-09-09 : la jointure par `name` ne rend
 * rien, celle par `handle` rend les trois slugs observés.
 */
export type SourcePolicy = ReadonlyMap<string, { retailAdmissible: boolean }>;

/**
 * Le prédicat d'admissibilité de SOURCE, dérivé des champs existants.
 *
 * `defaultVisibility` est la déclaration de PUBLICATION du registre : elle dit
 * si ce que produit cette source peut sortir. `status` dit si la source est
 * opérante. Ce sont les deux seuls champs qui parlent de publication.
 *
 * `trusted` n'entre PAS dans le prédicat : il qualifie la FIABILITÉ, pas la
 * publiabilité, et l'y mêler ajouterait un critère que le registre ne fait pas.
 * Trois sources sont `public` + `trusted:false` ; aucune ne produit
 * d'observation aujourd'hui. C'est remonté, pas tranché ici.
 */
export function sourceIsRetailAdmissible(row: {
  status: string;
  defaultVisibility: string;
}): boolean {
  return row.status === "active" && row.defaultVisibility === "public";
}

/**
 * Charge la politique depuis le registre.
 *
 * Une source ABSENTE du registre n'est pas admissible : le registre est
 * l'autorité, et ce qu'il ne connaît pas n'a pas été gouverné. C'est le cas
 * conservateur, et il est VISIBLE — mesuré le 2026-09-09, `amf`, `fca` et
 * `goplus` ne joignent pas (`goplus` côté code contre `goplusec` côté
 * registre), et aucun ne produit d'observation.
 */
export async function loadSourcePolicy(): Promise<SourcePolicy> {
  const rows = await prisma.sourceRegistry.findMany({
    select: { handle: true, status: true, defaultVisibility: true },
  });
  const m = new Map<string, { retailAdmissible: boolean }>();
  for (const r of rows) {
    if (!r.handle) continue;
    m.set(r.handle, { retailAdmissible: sourceIsRetailAdmissible(r) });
  }
  return m;
}

/**
 * Les fenêtres d'exécution des lots d'ingestion, par source.
 *
 * Il n'existe AUCUNE clé étrangère entre une observation et son lot — mesuré :
 * ni colonne, ni `meta.batchId`, ni `externalId`. La provenance se prouve donc
 * par l'appartenance de `ingestedAt` à une fenêtre d'exécution FERMÉE de la
 * même source. C'est déterministe et reproductible depuis les données
 * stockées ; ce n'est pas une heuristique de proximité.
 */
export type IngestionProvenanceIndex = ReadonlyMap<
  string,
  ReadonlyArray<{ from: Date; to: Date }>
>;

export async function loadIngestionProvenance(): Promise<IngestionProvenanceIndex> {
  const rows = await prisma.intelIngestionBatch.findMany({
    select: { sourceSlug: true, startedAt: true, completedAt: true },
  });
  const m = new Map<string, Array<{ from: Date; to: Date }>>();
  for (const r of rows) {
    // Un lot NON TERMINÉ n'a rien prouvé. On ne lui invente pas de durée par
    // défaut : inventer une fenêtre serait inventer une règle.
    if (!r.completedAt) continue;
    const l = m.get(r.sourceSlug) ?? [];
    l.push({ from: r.startedAt, to: r.completedAt });
    m.set(r.sourceSlug, l);
  }
  return m;
}

/**
 * Cette instance d'observation se rattache-t-elle à un lot gouverné ?
 *
 * Bornes INCLUSES : une ligne écrite à l'instant exact où le lot démarre ou
 * s'achève lui appartient.
 */
export function observationIsProvenanced(
  index: IngestionProvenanceIndex,
  sourceSlug: string,
  ingestedAt: Date,
): boolean {
  const t = ingestedAt.getTime();
  for (const w of index.get(sourceSlug) ?? []) {
    if (t >= w.from.getTime() && t <= w.to.getTime()) return true;
  }
  return false;
}

/**
 * L'entité est-elle autorisée retail AU NIVEAU ENTITÉ.
 *
 * `ANALYST_REVIEWED` ne l'est pas : le schéma le dit — « Human-reviewed. Not
 * yet cleared for scanner. » Relu n'est pas autorisé.
 */
export function entityIsRetailCleared(e: EntityAdmissibilityFacts): boolean {
  return e.isActive && e.displaySafety === "RETAIL_SAFE";
}

export interface AdmissionResult<T> {
  /** Les observations qui portent une autorité de décision pour cette audience. */
  retained: T[];
  /** Celles qui n'en portent pas, avec la raison. Jamais fabriquée. */
  refused: Array<{ observation: T; refus: RefusAdmissibilite }>;
}

/**
 * LA fonction d'admissibilité. Elle compose les quatre facteurs, et c'est le
 * seul endroit où ils se rencontrent.
 *
 * INTERNAL — l'audience interne voit ce que le cycle de vie de l'observation
 * laisse vivant. Le cycle de vie de l'entité et son autorisation de niveau
 * entité ne s'appliquent pas : une entité retirée d'une liste OFAC doit rester
 * LISIBLE en interne, c'est même la première chose qu'un analyste veut voir.
 *
 * RETAIL — l'entité doit être vivante, l'observation doit être vivante, sa
 * PROVENANCE D'INGESTION doit être prouvée, et l'autorité de publication doit
 * venir SOIT de l'entité (RETAIL_SAFE) SOIT de la source (le registre la
 * déclare publiable). Les deux dernières voies sont
 * INDÉPENDANTES : c'est ce qui permet à une observation OFAC directe et active
 * de contribuer alors même que l'entité est INTERNAL_ONLY.
 */
export function admitObservations<T extends ObservationAdmissibilityFacts>(args: {
  entity: EntityAdmissibilityFacts;
  observations: readonly T[];
  audience: IntelAudience;
  policy: SourcePolicy;
}): AdmissionResult<T> {
  const { entity, observations, audience, policy } = args;
  const retained: T[] = [];
  const refused: Array<{ observation: T; refus: RefusAdmissibilite }> = [];

  const entiteAutorisee = entityIsRetailCleared(entity);

  for (const o of observations) {
    if (!o.listIsActive) {
      refused.push({ observation: o, refus: "OBSERVATION_INACTIVE" });
      continue;
    }
    if (audience === "INTERNAL") {
      retained.push(o);
      continue;
    }
    if (!entity.isActive) {
      refused.push({ observation: o, refus: "ENTITY_INACTIVE" });
      continue;
    }
    // AX — la PROVENANCE, cinquième facteur, et elle est indépendante des
    // autres. Une source publiable ne rend pas gouvernée une ligne écrite
    // hors pipeline. `undefined` vaut « non prouvée » : le défaut est
    // l'absence de la preuve, pas sa présence supposée.
    if (o.ingestionProvenanceProven !== true) {
      refused.push({ observation: o, refus: "UNPROVEN_INGESTION_PROVENANCE" });
      continue;
    }
    const sourceAutorisee = policy.get(o.sourceSlug)?.retailAdmissible === true;
    if (entiteAutorisee || sourceAutorisee) {
      retained.push(o);
      continue;
    }
    refused.push({ observation: o, refus: refusDeNiveauEntite(String(entity.displaySafety)) });
  }

  return { retained, refused };
}
