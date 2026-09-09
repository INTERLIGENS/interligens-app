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
//   CYCLE DE VIE ENTITÉ   × CYCLE DE VIE OBSERVATION
//   × ADMISSIBILITÉ PREUVE/SOURCE × AUDIENCE
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

/** Le cycle de vie de l'observation, et la source qui la porte. */
export interface ObservationAdmissibilityFacts {
  sourceSlug: string;
  listIsActive: boolean;
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
 * RETAIL — l'entité doit être vivante, l'observation doit être vivante, et
 * l'autorité de publication doit venir SOIT de l'entité (RETAIL_SAFE) SOIT de
 * la source (le registre la déclare publiable). Les deux voies sont
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
    const sourceAutorisee = policy.get(o.sourceSlug)?.retailAdmissible === true;
    if (entiteAutorisee || sourceAutorisee) {
      retained.push(o);
      continue;
    }
    refused.push({ observation: o, refus: refusDeNiveauEntite(String(entity.displaySafety)) });
  }

  return { retained, refused };
}
