// ─── LE REGISTRE DES INVARIANTS GOUVERNÉS — ENSEMBLE FERMÉ ───────────────
//
// ██  "Closed set ≠ fixed count."                                          ██
//
// ─── CE QUI A CHANGÉ, ET CE QUI N'A PAS CHANGÉ (E-RC · D6) ──────────────
//
// L'en-tête disait « DEUX invariants. PAS une plateforme générale ». La
// clôture était bonne ; le PLAFOND ne l'était pas. Un cardinal n'est pas une
// règle de sécurité : il n'empêche pas un mauvais invariant d'entrer, et il
// empêche un invariant NÉCESSAIRE d'entrer dès qu'il y en a déjà deux.
//
// Ce qui ferme ce registre, c'est l'admission par IDENTIFIANT EXPLICITE :
// l'union `IdentifiantInvariant` est close, la liste est parcourue par un
// test qui affirme l'ensemble EXACT des identifiants, et y toucher exige une
// modification versionnée et revue. Un invariant n'entre pas ici parce que ce
// serait pratique ; il entre s'il est nécessaire à une propriété gouvernée,
// et il entre AVEC SA MESURE.
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

export type IdentifiantInvariant =
  | "EVIDENCE_DEPTH_DOMAIN"
  | "CANONICAL_SUBJECT_HANDLE"
  | "GOVERNED_OBJECT_REGISTRATION"
  | "DERIVED_PUBLICATION_ELIGIBILITY";

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
  {
    id: "GOVERNED_OBJECT_REGISTRATION",
    version: 1,
    definition:
      "Un artefact gouverne doit porter une identite ALLOUEE PAR LE REGISTRE avant que ses " +
      "octets entrent dans le stockage gouverne. La persistance de l'objet et l'enregistrement " +
      "de l'autorite forment UNE seule operation gouvernee : INTENDED, puis PutObject, puis " +
      "REGISTERED. Aucun ecrivain du perimetre ne fabrique sa propre cle, et un upload reussi " +
      "dont l'enregistrement echoue ne devient JAMAIS publiable — il reste INTENDED, donc " +
      "detectable et reconciliable. Ce n'est PAS une transaction : DB et R2 n'en ont aucune " +
      "en commun. C'est l'exigence que tout etat intermediaire soit nomme et non publiable.",
    raison:
      "Mesure : 35 objets sans ligne, dont 8 issus de la signature uploadPdf — orphelins NON " +
      "par panne mais par conception, aucun registre n'existant. Et pdfStorage.ts:120 attrapait " +
      "l'erreur de PutObject, rendait null, la route basculant en flux direct : un PUT a faux " +
      "negatif (aboutir cote R2, rendre une erreur a l'appelant) laissait donc des octets en R2 " +
      "dont PERSONNE ne connaissait la cle, pendant que l'appelant recevait son PDF. L'ordre " +
      "« objet puis ligne » ne peut structurellement pas couvrir ce cas ; l'allocation prealable " +
      "le couvre, parce que la ligne porte deja la cle exacte.",
    primitive: "src/lib/storage/registre/identite.ts",
    testsDApplication: [
      "src/lib/storage/registre/__tests__/identite.test.ts",
      "src/lib/storage/__tests__/pdfStorage.test.ts",
      "__tests__/security/registre-objets-gouvernes.test.ts",
    ],
  },
  {
    id: "DERIVED_PUBLICATION_ELIGIBILITY",
    version: 1,
    definition:
      "L'eligibilite a publication est une AUTORITE DERIVEE, jamais un etat duplique et " +
      "persiste. Elle se calcule par fonction pure a partir des cinq faces d'autorite — nature, " +
      "provenance, etat d'autorite, etat d'invalidation, classe de retention — et par LISTE " +
      "BLANCHE : le seul couple qui publie est REGISTERED + NONE, toute valeur hors domaine " +
      "retient. Aucune colonne « publiable » n'existe, et la conservation d'un artefact " +
      "invalide ne preserve pas son autorite de publication.",
    raison:
      "Mesure : une seconde source de verite pour une propriete qui en a deja une DIVERGE. Le " +
      "depot l'a paye une fois sur evidenceDepth — domaine de six valeurs, deux sites de lecture " +
      "faisant `?? 0`, l'unique ligne `deep` (enquete ZachXBT, 17,8 M$ de pertes retail) " +
      "rabattue sur `none`, verdict public affiche SIGNAL. Et evidentiaryStatus a montre le " +
      "symetrique : une colonne d'exclusion ecrite mais lue NULLE PART est une declaration sans " +
      "effet. Le gate lit donc la derivation, et il la lit avant toute delivrance.",
    primitive: "src/lib/storage/registre/eligibilite.ts",
    testsDApplication: [
      "src/lib/storage/registre/__tests__/eligibilite.test.ts",
      "src/lib/storage/__tests__/pdfStorage.test.ts",
      "__tests__/security/registre-objets-gouvernes.test.ts",
    ],
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
