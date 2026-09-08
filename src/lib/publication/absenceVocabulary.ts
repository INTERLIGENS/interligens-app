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
