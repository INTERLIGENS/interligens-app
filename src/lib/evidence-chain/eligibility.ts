// ─── S6-3 — qui participe à la chaîne probatoire ACTIVE ────────────────────
//
// S4 a prononcé l'exclusion de 7 artefacts (5 conteneurs ZIP, 2 .DS_Store) et
// posé evidentiaryStatus pour la porter. La colonne n'était lue NULLE PART :
// l'exclusion était une déclaration sans effet, et le manifeste de chaîne de
// conservation continuait d'inventorier un .DS_Store comme pièce.
//
// FAIL-CLOSED. La fonction est une LISTE BLANCHE d'états connus : tout statut
// inconnu — parce qu'un futur état aura été ajouté sans passer par ici —
// rend `false`. Un `<> 'EXCLUDED'` aurait laissé passer ce futur état par
// défaut ; c'est le mécanisme même des sept sites de mélange.

/** Les seuls états qui participent à la chaîne active. */
const ELIGIBLE_STATUSES: ReadonlySet<string | null> = new Set([
  // NULL = aucune décision d'exclusion prononcée. Ce n'est PAS « active » au
  // sens d'un statut positif — c'est l'absence de décision, et S4 a établi
  // qu'on n'écrit pas 'INCLUDED' sur 1 097 lignes pour faire joli.
  null,
]);

export const EXCLUDED_STATUS = "EXCLUDED" as const;

export interface EvidenceEligibilityInput {
  readonly evidentiaryStatus?: string | null;
}

/**
 * Une pièce participe-t-elle à la chaîne probatoire active ?
 *
 * NULL → éligible · EXCLUDED → non · tout autre statut → non (fail-closed).
 */
export function eligibleForEvidenceChain(item: EvidenceEligibilityInput): boolean {
  const s = item.evidentiaryStatus ?? null;
  return ELIGIBLE_STATUSES.has(s);
}

/** Vrai seulement pour une exclusion explicitement prononcée. */
export function isExplicitlyExcluded(item: EvidenceEligibilityInput): boolean {
  return (item.evidentiaryStatus ?? null) === EXCLUDED_STATUS;
}

/**
 * Un statut ni connu-éligible ni EXCLUDED : la pièce est écartée, mais pour une
 * raison différente — personne n'a décidé ce que ce statut voulait dire.
 * Distinguer les deux évite de compter une inconnue comme une exclusion motivée.
 */
export function isUnknownStatus(item: EvidenceEligibilityInput): boolean {
  return !eligibleForEvidenceChain(item) && !isExplicitlyExcluded(item);
}
