// ─── BUILD 9 — « X / 100 » EST RÉSERVÉ AUX MÉTRIQUES GOUVERNÉES ────────────
//
// ██  Un score éditorial qui ressemble à un score système EN EST un,        ██
// ██  du point de vue du lecteur. Et c'est le seul point de vue qui compte. ██
//
// ─── Le cas qui fonde la règle ────────────────────────────────────────────
//
// Le claim canonique VINE C11 porte, dans sa description :
//
//     « The full INTERLIGENS coordination score is 100/100 based on: (a)… »
//
// VINE porte `tigerScore = NULL`. Une surface publique aurait donc pu montrer
// simultanément :
//
//     TigerScore   —            (non établi, métrique GOUVERNÉE)
//     …score…      100/100      (éditorial, dans un texte de claim)
//
// Un lecteur ne distingue pas les deux. Il retient « 100/100 ». L'ambiguïté ne
// vient pas du chiffre : elle vient de la NOTATION, qui est celle du score
// gouverné du produit.
//
// ─── Ce que la règle fait, et ce qu'elle ne fait pas ──────────────────────
//
//   fait          refuse la PUBLICATION d'un claim dont un texte publié
//                 porte une notation /100 non gouvernée, et le SIGNALE
//   ne fait pas   corriger le texte, retirer le chiffre, recalculer quoi que
//                 ce soit, ou réinterpréter l'affirmation pour la sauver
//
// Le retrait est réversible par la seule voie légitime : reformuler
// l'assertion en constat qualitatif, ce qui — étape 6 — crée une NOUVELLE
// VERSION du claim, et ne réécrit pas l'ancienne.
//
// ─── Pourquoi le gate est ici et pas dans le renderer ─────────────────────
//
// Le renderer ne décide pas ce qui est publiable. S'il portait ce filtre,
// chaque nouvelle surface devrait le réimplémenter, et la première qui
// l'oublierait publierait le chiffre. Le régime de publication est unique :
// le gate vit avec lui.

/**
 * Les métriques autorisées à s'écrire « X / 100 » sur une surface CaseFile
 * publique. Liste FERMÉE, et volontairement courte.
 *
 * Une métrique n'y entre que si elle est gouvernée : produite par un moteur
 * identifié, avec une méthodologie, et rendue par le renderer depuis son
 * propre champ — jamais depuis un texte libre.
 */
export const GOVERNED_HUNDRED_SCALE_METRICS = ["tigerScore"] as const;
export type GovernedMetric = (typeof GOVERNED_HUNDRED_SCALE_METRICS)[number];

/**
 * Une notation sur cent, sous ses formes usuelles : `100/100`, `100 / 100`,
 * `72 sur 100`. On ne cherche PAS un mot-clef — « coordination score » aurait
 * manqué la variante française, et la suivante, et celle d'après.
 *
 * C'est la NOTATION qui crée la confusion, pas le vocabulaire qui l'entoure.
 */
const NOTATION_SUR_CENT = /\b\d{1,3}\s*(?:\/|sur)\s*100\b/i;

/** `true` si ce texte porte une notation sur cent. */
export function carriesHundredScaleNotation(texte: string | null | undefined): boolean {
  return !!texte && NOTATION_SUR_CENT.test(texte);
}

/**
 * Les champs de claim dont le contenu peut atteindre une surface publique.
 *
 * `category`, `severity` et `status` sont des vocabulaires fermés : ils ne
 * peuvent pas porter de prose, donc pas de notation. Les inclure donnerait
 * l'illusion d'une couverture plus large sans rien ajouter.
 */
export const PUBLISHED_TEXT_FIELDS = [
  "title", "titleFr", "description", "descriptionFr",
] as const;

/**
 * Le premier champ publié qui porte une notation sur cent, ou `null`.
 *
 * Rend le NOM du champ — jamais son contenu. Un avis de retrait qui citerait
 * la phrase fautive republierait exactement ce qu'il retire.
 */
export function ungovernedScoreField(
  claim: Readonly<Record<string, unknown>>,
): string | null {
  for (const f of PUBLISHED_TEXT_FIELDS) {
    const v = claim[f];
    if (typeof v === "string" && carriesHundredScaleNotation(v)) return f;
  }
  return null;
}
