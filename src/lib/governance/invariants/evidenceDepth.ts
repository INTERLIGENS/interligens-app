// ─── INVARIANT GOUVERNÉ · EVIDENCE_DEPTH_DOMAIN ──────────────────────────
//
// ██  Prisma représente éventuellement le stockage.                        ██
// ██  Il n'invente pas la sémantique.                                      ██
//
// ─── CE QUE CET INVARIANT FERME, MESURÉ ─────────────────────────────────
//
// `prisma/schema.prod.prisma:439` déclare `evidenceDepth String @default("none")`
// — pas de `CHECK`, pas d'énumération, aucune union TypeScript nulle part dans
// `src/`. La sémantique n'existait donc qu'en deux exemplaires dispersés :
//
//   src/lib/explorer/explorerItems.ts:53   DEPTH_ORDER[d] ?? 0
//   src/lib/case/snapshotSelectors.ts:57   DEPTH_RANK[d.evidenceDepth] ?? 0
//
// Les deux `?? 0` sont le défaut. Distribution mesurée en base :
// `none` 396, `weak` 7, `strong` 4, `moderate` 3, `comprehensive` 1, **`deep` 1**.
//
// Cette unique ligne `deep` porte le dossier le mieux documenté du corpus —
// RAVE-DUMP-APR2026, enquête ZachXBT, 17,8 M$ de pertes retail. Le `?? 0` la
// fait retomber sur `none`, donc son verdict public affiché est
// « SIGNAL — Early signal, partial evidence ».
//
// UNE VALEUR HORS DOMAINE N'EST PAS UNE VALEUR BASSE. C'est une valeur qu'on
// ne sait pas lire, et la seule réponse honnête est de le DIRE. Un repli
// silencieux transforme une ignorance en affirmation, et l'affirmation est
// publiée.

/** LE DOMAINE — fermé, ordonné, et c'est ici qu'il vit. Nulle part ailleurs. */
export const PROFONDEURS_DE_PREUVE = [
  "none",
  "weak",
  "moderate",
  "strong",
  "comprehensive",
] as const;

export type ProfondeurDePreuve = (typeof PROFONDEURS_DE_PREUVE)[number];

export function estProfondeurConnue(v: string): v is ProfondeurDePreuve {
  return (PROFONDEURS_DE_PREUVE as readonly string[]).includes(v);
}

/**
 * LE RANG SÉMANTIQUE — et il rend `null` hors domaine, jamais 0.
 *
 * `0` est une profondeur légitime (`none`). Rendre `0` pour l'inconnu, c'est
 * rendre l'ignorance indistinguable de la mesure. C'est exactement le bug.
 */
export function rangDeProfondeur(v: string): number | null {
  const i = (PROFONDEURS_DE_PREUVE as readonly string[]).indexOf(v);
  return i === -1 ? null : i;
}

/** Le résultat d'une agrégation : réussie, ou fermée sur ce qui l'a bloquée. */
export type ProfondeurAgregee =
  | { readonly ok: true; readonly valeur: ProfondeurDePreuve }
  | { readonly ok: false; readonly horsDomaine: readonly string[] };

/**
 * LA PLUS FORTE — FAIL-CLOSED, pas fallback.
 *
 * Une seule valeur hors domaine ferme l'agrégation entière. C'est délibéré :
 * si une valeur inconnue pouvait être ignorée pendant que les autres
 * décident, le dossier RAVE continuerait d'afficher un verdict calculé sans
 * la seule preuve qui compte, et rien ne le signalerait.
 *
 * L'appelant reçoit la LISTE des valeurs qu'il ne sait pas lire. Il ne peut
 * ni les deviner, ni les arrondir : il peut seulement refuser d'émettre un
 * verdict, ou aller faire trancher le domaine.
 */
export function profondeurLaPlusForte(valeurs: readonly string[]): ProfondeurAgregee {
  const horsDomaine = valeurs.filter((v) => rangDeProfondeur(v) === null);
  if (horsDomaine.length > 0) return { ok: false, horsDomaine };
  let meilleur = 0;
  for (const v of valeurs) meilleur = Math.max(meilleur, rangDeProfondeur(v) as number);
  return { ok: true, valeur: PROFONDEURS_DE_PREUVE[meilleur] };
}

/**
 * LE MARQUEUR D'INDÉCIDABILITÉ — et il est HORS DOMAINE, délibérément.
 *
 * Quand une agrégation ferme, il faut bien que quelque chose voyage jusqu'aux
 * surfaces. Ce marqueur est choisi pour que `rangDeProfondeur` lui rende
 * `null` comme à toute autre valeur inconnue : le fail-closed se PROPAGE au
 * lieu de s'arrêter au premier appelant qui aurait oublié de le regarder.
 *
 * Un marqueur qui aurait un rang — même 0 — aurait reconstitué le `?? 0` sous
 * un autre nom, et le bug serait revenu par la porte de la correction.
 */
export const PROFONDEUR_INDECIDABLE = "indecidable" as const;
