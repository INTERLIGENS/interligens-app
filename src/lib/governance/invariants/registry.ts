// ─── LE REGISTRE DES INVARIANTS GOUVERNÉS — DEUX ENTRÉES ─────────────────
//
// ██  DEUX invariants. PAS une plateforme générale.                        ██
//
// L'exception qui autorise ce registre est précise : ces deux-là sont
// NÉCESSAIRES au P0 — sans eux, deux unités du tableau restent indécidables
// (I1 `evidenceDepth='deep'`, I2 canonicité de `handle`). Un troisième
// invariant n'entre pas ici parce que ce serait pratique ; il entre s'il est
// nécessaire à une propriété gouvernée, et il entre avec sa mesure.
//
// ─── LA FORME, ET POURQUOI ELLE EST DANS CE SENS ────────────────────────
//
//   identifiant → définition / raison / version → test(s) d'application
//
// L'INVARIANT PORTE SA DÉFINITION. LE TEST L'AFFIRME.
//
// Le sens compte. Si la définition vivait dans le test, elle serait une
// citation en prose libre : deux tests pourraient en donner deux versions
// sans que rien ne les oppose, et c'est exactement l'Invariant Propagation
// Failure appliqué à la gouvernance elle-même. Ici la définition a UN
// domicile, et les tests s'y réfèrent par identifiant.

export type IdentifiantInvariant = "EVIDENCE_DEPTH_DOMAIN" | "CANONICAL_SUBJECT_HANDLE";

export interface InvariantGouverne {
  readonly id: IdentifiantInvariant;
  readonly version: number;
  /** CE QUE l'invariant impose. Une phrase, exécutoire, sans échappatoire. */
  readonly definition: string;
  /** POURQUOI — et c'est une MESURE, jamais une préférence d'architecture. */
  readonly raison: string;
  /** Le module qui PORTE la règle. Un seul. */
  readonly primitive: string;
  /** Les tests qui AFFIRMENT l'invariant. Au moins un, sinon il ne vaut rien. */
  readonly testsDApplication: readonly string[];
}

export const INVARIANTS_GOUVERNES: readonly InvariantGouverne[] = [
  {
    id: "EVIDENCE_DEPTH_DOMAIN",
    version: 1,
    definition:
      "Le domaine de evidenceDepth est none < weak < moderate < strong < comprehensive. " +
      "Une valeur hors domaine n'a PAS de rang : toute agrégation qui en rencontre une " +
      "ferme et rend la liste des valeurs illisibles. Aucun repli vers none, partial, " +
      "ni aucune autre valeur, en aucune circonstance.",
    raison:
      "Mesuré en base : none 396, weak 7, strong 4, moderate 3, comprehensive 1, deep 1. " +
      "L'unique ligne deep porte RAVE-DUMP-APR2026 (enquête ZachXBT, 17,8 M$ de pertes " +
      "retail). Les deux sites de lecture du depot faisaient `?? 0`, donc deep retombait " +
      "sur none, donc le verdict public affiche etait SIGNAL. Une valeur hors domaine " +
      "n'est pas une valeur basse : c'est une valeur qu'on ne sait pas lire.",
    primitive: "src/lib/governance/invariants/evidenceDepth.ts",
    testsDApplication: ["__tests__/governance/invariants-gouvernes.test.ts"],
  },
  {
    id: "CANONICAL_SUBJECT_HANDLE",
    version: 1,
    definition:
      "La cle d'identite d'un sujet est deterministe et calculable AVANT tout lookup et " +
      "toute deduplication : NFKC, trim, retrait du @ de tete, repli de casse. Cette cle " +
      "sert la RECHERCHE et ne decide JAMAIS quelle forme est canonique a l'affichage. " +
      "Des que plusieurs lignes se reclament de la meme cle, la resolution FERME — elle " +
      "n'elit jamais.",
    raison:
      "Mesure : 0xsweep et 0xSweep portent des relations DISJOINTES (2 wallets / 0 liens " +
      "contre 1 wallet / 15 liens). Aucune regle de casse ne peut elire sans perte — c'est " +
      "une fusion, pas une election, et fusionner est une ecriture de production. " +
      "Aujourd'hui kolMap.set(handle.toLowerCase()) sur une requete insensitive sans " +
      "orderBy fait dependre la ligne servie du plan de requete PostgreSQL.",
    primitive: "src/lib/governance/invariants/canonicalSubjectHandle.ts",
    testsDApplication: ["__tests__/governance/invariants-gouvernes.test.ts"],
  },
];

export function invariant(id: IdentifiantInvariant): InvariantGouverne {
  const trouve = INVARIANTS_GOUVERNES.find((i) => i.id === id);
  // Fail-closed jusque dans le registre : un identifiant inconnu ne rend pas
  // un invariant vide, il leve. Un invariant absent qui se lirait comme un
  // invariant permissif serait la pire des deux.
  if (!trouve) throw new Error(`invariant gouverne inconnu: ${id}`);
  return trouve;
}
