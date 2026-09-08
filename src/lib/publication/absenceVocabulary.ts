// ─── BUILD 10 — LES TROIS MANIÈRES DONT UN CHIFFRE PEUT MANQUER ───────────
//
// ██  NULL · absent · non mesuré  ≠  0                                     ██
//
// Sur un champ monétaire ou de préjudice, l'absence ne devient jamais une
// valeur favorable. `totalScammed ?? 0` ne dit pas « nous n'avons pas mesuré » :
// il dit « zéro victime », et c'est une affirmation — fausse, et rassurante.
//
// ─── Pourquoi trois mots, et pas un ───────────────────────────────────────
//
// Une cellule vide, un « — » ou un `null` confondent trois situations qui
// n'engagent pas du tout la même chose :
//
//   NOT_APPLICABLE  la ligne ne porte pas ce chiffre PAR NATURE — rien n'a été
//                   retiré, rien ne manque, la question ne se pose pas
//   NOT_MEASURED    le chiffre était attendu et n'existe pas dans l'autorité —
//                   c'est une lacune, et elle est à nous
//   WITHHELD        le chiffre EXISTE et sa publication a été retirée par
//                   décision — la donnée est conservée, seul son statut change
//
// Les distinguer coûte trois mots. Les confondre coûte une affirmation qu'on ne
// peut pas défendre.
//
// ─── Ce module est la SOURCE, pas une copie ───────────────────────────────
//
// Ce vocabulaire a d'abord été posé dans l'export CSV (BUILD 10, #296). Il est
// extrait ici parce qu'une deuxième surface en a eu besoin — le graphe admin —
// et qu'un vocabulaire recopié cesse d'être un vocabulaire.
//
// `botifySpreadsheet.ts` COMPOSE ses libellés à partir de ces jetons ; il ne
// les réécrit pas. Toute surface qui doit rendre une absence monétaire lisible
// part d'ici.

/** Les trois états d'absence. Jamais `0`, jamais la chaîne vide, jamais `null` nu. */
export const MONETARY_ABSENCE = {
  NOT_APPLICABLE: "NOT_APPLICABLE",
  NOT_MEASURED: "NOT_MEASURED",
  WITHHELD: "WITHHELD",
} as const;

/** L'état d'un chiffre : publié, ou l'une des trois absences. */
export const MONETARY_STATES = [
  "PUBLISHED",
  MONETARY_ABSENCE.NOT_APPLICABLE,
  MONETARY_ABSENCE.NOT_MEASURED,
  MONETARY_ABSENCE.WITHHELD,
] as const;

export type MonetaryState = (typeof MONETARY_STATES)[number];

/**
 * L'état d'un chiffre nominatif, décidé par la gate ET par la présence.
 *
 * L'ordre des questions n'est pas indifférent : on demande d'ABORD si la
 * publication est autorisée. Un chiffre retiré dont la valeur serait aussi
 * absente doit sortir en `WITHHELD`, pas en `NOT_MEASURED` — sinon le retrait
 * disparaîtrait derrière une lacune, et la décision prise ne se lirait plus
 * nulle part.
 *
 * `publiable` vient de la gate canonique de l'appelant (`isMonetaryClaimPublished`,
 * `isProceedsPublished`) : ce module ne décide rien, il NOMME.
 */
export function monetaryState(publiable: boolean, valeur: number | null | undefined): MonetaryState {
  if (!publiable) return MONETARY_ABSENCE.WITHHELD;
  if (valeur == null) return MONETARY_ABSENCE.NOT_MEASURED;
  return "PUBLISHED";
}

/**
 * La valeur qui accompagne cet état — `null` sur toute absence.
 *
 * La dégradation voyage À CÔTÉ de la valeur, jamais dedans : l'appelant sert
 * `{ valeur, état }`, et non un nombre qui voudrait dire autre chose que lui-même.
 */
export function monetaryValue(state: MonetaryState, valeur: number | null | undefined): number | null {
  return state === "PUBLISHED" ? (valeur ?? null) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEUX AXES, ET ILS NE SE CONFONDENT PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  « Nous n'avons pas mesuré » et « nous ne publions pas »              ██
// ██  sont deux phrases différentes. Une seule autorité lexicale, deux     ██
// ██  axes TYPÉS — pour qu'aucun code ne puisse rendre l'une pour l'autre. ██
//
// Le module portait jusqu'ici un seul vocabulaire, monétaire, où les deux se
// mélangeaient : `WITHHELD` (une décision de publication) y voisinait avec
// `NOT_MEASURED` (une lacune de mesure) dans la même union. Tant qu'un seul
// consommateur existait, la confusion ne coûtait rien.
//
// REFLEX en est un second, et il a besoin de dire des choses que l'axe de
// publication ne sait pas dire : un provider tombé, un moteur jamais
// sollicité, une propriété qu'on ne peut pas interpréter avec le contexte
// disponible. Aucune de ces trois-là n'est un retrait de publication.
//
// ─── Ce que ce bloc NE fait PAS ───────────────────────────────────────────
//
// Il ne touche pas à `MONETARY_ABSENCE`, `MONETARY_STATES`, `monetaryState`
// ni `monetaryValue`. Leur projection d'affichage — où `WITHHELD` l'emporte
// sur `NOT_MEASURED` — est du comportement de présentation legacy, déployé et
// mesuré. Le corriger appartient à un autre chantier ; le confondre avec le
// modèle canonique en serait un troisième. Ici on TYPE, on ne rétrofit pas.

/**
 * L'axe de MESURE. Ce que l'on sait, ou pas, du fait d'avoir observé.
 *
 * `MEASURED` est l'état positif : l'observation a eu lieu et son résultat est
 * exploitable. Les six autres disent chacun une façon différente de ne pas
 * savoir, et elles ne sont pas interchangeables — c'est tout l'intérêt de les
 * nommer séparément.
 */
export const MEASUREMENT_STATES = [
  /** L'observation a eu lieu et son résultat tient. */
  "MEASURED",
  /** Mesurable, mais pas mesuré — personne n'a demandé, ou pas encore. */
  "NOT_MEASURED",
  /** Ne peut PAS être mesuré ni interprété avec le contexte disponible. */
  "NOT_MEASURABLE",
  /** Tenté, et échoué. Il y a une cause, et elle doit voyager avec l'état. */
  "FAILURE",
  /** Mesuré, mais hors politique de fraîcheur. À n'affirmer QUE si démontrable. */
  "STALE",
  /**
   * Le contrat de la requête ne DEMANDE pas cette mesure.
   *
   * Distinct de NOT_APPLICABLE : la propriété pourrait exister, mais ce
   * chemin-là ne la sollicite pas. L'écraser en UNKNOWN ferait passer une
   * limite de contrat, parfaitement connue, pour une ignorance.
   */
  "NOT_REQUESTED_BY_CONTRACT",
  /** Ne peut pas être classé plus précisément. Le dernier recours, pas le premier. */
  "UNKNOWN",
  /** La propriété ne s'applique pas à ce sujet. Rien ne manque. */
  "NOT_APPLICABLE",
] as const;

export type MeasurementState = (typeof MEASUREMENT_STATES)[number];

/** Les six façons de ne pas savoir. `MEASURED` n'en est pas. */
export const MEASUREMENT_ABSENCE_STATES = MEASUREMENT_STATES.filter(
  (s) => s !== "MEASURED",
) as readonly Exclude<MeasurementState, "MEASURED">[];

/**
 * L'axe de PUBLICATION. Ce que l'on a DÉCIDÉ de servir, ou de retirer.
 *
 * Il ne dit rien de ce qui a été observé : un chiffre parfaitement mesuré peut
 * être retiré, et un chiffre jamais mesuré n'a pas de décision de publication
 * à porter. Les deux axes se composent, ils ne se remplacent pas.
 */
export const PUBLICATION_STATES = [
  /** Servi. */
  "PUBLISHED",
  /** Existe, et sa publication a été RETIRÉE par décision. */
  "WITHHELD",
  /** Non servi sur cette surface, sans décision de retrait attachée. */
  "NOT_PUBLISHED",
] as const;

export type PublicationState = (typeof PUBLICATION_STATES)[number];

/** Un état de mesure n'est jamais un état de publication, et réciproquement. */
export function isMeasurementState(v: unknown): v is MeasurementState {
  return typeof v === "string" && (MEASUREMENT_STATES as readonly string[]).includes(v);
}

export function isPublicationState(v: unknown): v is PublicationState {
  return typeof v === "string" && (PUBLICATION_STATES as readonly string[]).includes(v);
}
