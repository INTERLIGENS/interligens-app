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

/**
 * La liste canonique, exposée. Elle sert au watchdog, qui doit restreindre sa
 * POPULATION SQL aux mêmes artefacts que ceux jugés ici.
 *
 * Sans elle, le watchdog inspectait TOUT `EvidenceItem` — sonde de
 * déploiement comprise — et déclarait « orpheline » une pièce que
 * `eligibleForEvidenceChain` refuse déjà. Un watchdog d'intégrité de preuve
 * n'inspecte que ce qui est RÉELLEMENT éligible à entrer dans la chaîne.
 */
export const ELIGIBLE_EVIDENTIARY_STATUSES: readonly (string | null)[] =
  Object.freeze([...ELIGIBLE_STATUSES]);

/**
 * La MÊME liste, rendue en clause SQL. Le watchdog ne réécrit pas le
 * prédicat : il le DÉRIVE. Ajouter un état éligible ici le propage à la
 * requête sans qu'on y pense — c'est le point.
 *
 * `column` est un identifiant de colonne fourni par l'appelant, jamais une
 * valeur utilisateur : il est cité entre guillemets doubles et validé.
 */
export function eligibleStatusSqlClause(column: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
    throw new Error(`eligibleStatusSqlClause: nom de colonne invalide: ${column}`);
  }
  const col = `"${column}"`;
  const nulOk = ELIGIBLE_EVIDENTIARY_STATUSES.includes(null);
  const valeurs = ELIGIBLE_EVIDENTIARY_STATUSES.filter(
    (v): v is string => typeof v === "string",
  );
  const parts: string[] = [];
  if (nulOk) parts.push(`${col} IS NULL`);
  if (valeurs.length > 0) {
    parts.push(`${col} IN (${valeurs.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")})`);
  }
  // Aucun état éligible : la population est vide, et on le dit explicitement
  // plutôt que de rendre une clause vide qui laisserait tout passer.
  if (parts.length === 0) return "FALSE";
  return parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`;
}

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
