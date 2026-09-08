// ─── BUILD 10 · P0 — L'ABSENCE NE DEVIENT PAS UNE RASSURANCE ───────────────
//
// ██  NULL ≠ 0.  provider failure ≠ 0.  not evaluated ≠ no risk detected.   ██
//
// ─── La règle ratifiée ────────────────────────────────────────────────────
//
// « Aucune donnée absente, erreur provider, timeout, collector périmé ou
//   signal non évalué ne peut produire PAR COERCITION la valeur favorable
//   correspondant à une observation RÉELLEMENT MESURÉE. »
//
// ─── Ce que ce module fait, et surtout ce qu'il NE fait pas ───────────────
//
//   fait          transporte l'état de dégradation à côté de la valeur,
//                 et le rend nommable — un CHAMP, jamais un contenu
//   ne fait pas   changer une valeur passée au scoreur
//                 modifier un poids, un seuil, une méthodologie
//                 inventer une valeur de remplacement
//                 transformer l'absence en facteur DÉFAVORABLE
//
// Le dernier point vaut d'être dit : la tentation symétrique — « si on ne
// sait pas, mettons rouge » — est aussi fausse que la coercition qu'on ferme.
// Une absence n'est pas un risque. Elle est une absence, et elle se DIT.
//
// ─── Pourquoi un canal séparé plutôt qu'une valeur sentinelle ─────────────
//
// Poser -1 ou NaN à la place de 0 déplacerait le problème dans l'arithmétique :
// le premier `Math.max` ou la première comparaison de seuil le retransformerait
// en verdict. La dégradation voyage donc À CÔTÉ du nombre, jamais dedans.
//
// C'est aussi ce que fait déjà `MarketSnapshot.data_unavailable`
// (src/lib/marketProviders.ts) : ce module généralise un motif de la maison,
// il n'en invente pas un second.

/** Pourquoi une entrée n'a pas été mesurée. Vocabulaire FERMÉ. */
export const DEGRADATION_REASONS = [
  /** Le fournisseur a échoué, expiré, ou refusé. On ne sait pas. */
  "PROVIDER_UNAVAILABLE",
  /** Le signal n'a jamais été évalué — collecteur absent ou non déclenché. */
  "NOT_EVALUATED",
  /** La donnée existe en amont mais n'atteint pas cette surface. */
  "PIPE_NOT_CONNECTED",
] as const;
export type DegradationReason = (typeof DEGRADATION_REASONS)[number];

/**
 * Une entrée dégradée. Elle nomme le CHAMP et la RAISON — jamais une valeur.
 *
 * Même règle que les avis d'exclusion du CaseFile : un signalement qui cite ce
 * qu'il n'a pas pu mesurer n'a rien à citer, et un signalement qui cite ce
 * qu'il a mesuré partiellement republierait une donnée non qualifiée.
 */
export interface DegradedInput {
  readonly field: string;
  readonly reason: DegradationReason;
}

/** Un verdict, et ce sur quoi il n'a PAS pu s'appuyer. */
export interface MeasuredVerdict<V> {
  readonly verdict: V;
  /** Vide = toutes les entrées nécessaires ont été mesurées. */
  readonly degraded: readonly DegradedInput[];
}

const IDENTIFIANT = /^[A-Za-z_][A-Za-z0-9_.]*$/;

export class DegradationLeakError extends Error {
  constructor(field: string) {
    super(
      `[risk] signalement de dégradation refusé : « ${field} » n'est pas un nom ` +
        "de champ. Une dégradation nomme le CHAMP qui n'a pas pu être mesuré, " +
        "jamais la valeur partielle qu'on a obtenue à la place.",
    );
    this.name = "DegradationLeakError";
  }
}

/** Fail-closed : refuse tout ce qui n'a pas la forme d'un identifiant. */
export function degraded(field: string, reason: DegradationReason): DegradedInput {
  if (!IDENTIFIANT.test(field)) throw new DegradationLeakError(field);
  return { field, reason };
}

/**
 * `true` si le verdict a été rendu sur des données partielles.
 *
 * C'est ce que la surface doit dire au lecteur. Un verdict rendu sur données
 * partielles qui ne le dit pas est exactement le défaut que P0 ferme.
 */
export function isDegraded<V>(m: MeasuredVerdict<V>): boolean {
  return m.degraded.length > 0;
}

/** Les noms de champs manquants, dédupliqués et triés. Pour l'affichage. */
export function degradedFieldNames<V>(m: MeasuredVerdict<V>): string[] {
  return [...new Set(m.degraded.map((d) => d.field))].sort();
}
