// ─── E-RC · L'IDENTITÉ DE STOCKAGE — ALLOUÉE, JAMAIS FABRIQUÉE ───────────
//
// ██  "A governed artifact must have an identity allocated by the registry ██
// ██   before its bytes can enter governed storage."                      ██
//
// ─── POURQUOI L'ALLOCATION EST PRÉALABLE, ET PAS POSTÉRIEURE ─────────────
//
// L'argument n'est pas le crash du processus — c'est le PUT À FAUX NÉGATIF.
// Un PutObject peut aboutir côté R2 et rendre une erreur à l'appelant (délai
// réseau coupé après persistance). Dans l'ordre « objet puis ligne », il ne
// reste alors RIEN : des octets en R2, aucune trace de leur clé, personne
// pour savoir qu'il faut la chercher. Cet ordre-là ne peut structurellement
// pas couvrir ce cas.
//
// L'allocation préalable le couvre entièrement : la ligne INTENDED porte
// DÉJÀ la clé exacte. Un PUT à faux négatif ne produit pas un objet inconnu,
// il produit une ligne en retard — et une ligne en retard se réconcilie.
//
// ─── POURQUOI LA CLÉ ALLOUÉE EST OPAQUE ──────────────────────────────────
//
// Parce que l'identité sémantique appartient au REGISTRE, pas au nom de
// fichier. Les trois formes historiques du dépôt la mettaient dans la clé :
//
//   pdfGenerator.ts:664   casefiles/{case_id}/{case_id}_{ts}.pdf   case_id ×2
//   pdfStorage.ts:74      …/{lot}-{ms}-{slug}-{hash8}.pdf          slug = le MINT
//   engine.ts:474         reports/{handle}/CASE_{handle}_{ts}.pdf  handle ×2
//
// Une clé voyage : elle est le chemin d'une URL signée remise à un tiers.
// Ce qu'elle encode est donc rendu, même si aucune interface ne l'affiche.
//
// ⚠️ L'OPACITÉ N'EST PAS UN SECRET. "Key unguessability is not access
// control. Bucket/access policy is." La clé historique est DÉRIVÉE —
// sha256(octets).slice(0,8), sans sel : quiconque détient les octets la
// recalcule. Rien ici ne doit jamais reposer sur la difficulté de deviner
// une clé : un lien « non listé », un partage « par URL seulement » violent
// cette phrase.
import { randomUUID } from "node:crypto";
import type { StorageEnv } from "../types";

/** Le périmètre gouverné, PHASE 1 — D3. `reports/` et rien d'autre. */
export const PREFIXE_GOUVERNE = "reports/";

/**
 * LES PRÉFIXES PROBATOIRES — D2.
 *
 * Toute politique de cycle de vie destructive posée un jour sur ce
 * compartiment DOIT les exclure nommément. Cette constante existe pour que
 * l'exclusion ait un domicile dans le CODE, revu en PR, plutôt que dans une
 * console qui se re-casse en un clic sans diff et sans test — c'est le
 * raisonnement de `src/lib/ops/prodWriteGuard.ts`, transposé au stockage.
 *
 * `pointers/` n'y est pas, et c'est volontaire : ses objets sont RÉÉCRITS à
 * chaque génération. Un préfixe mutable par conception ne peut pas être
 * conservé « indéfiniment » au sens probatoire — il n'a jamais deux fois le
 * même contenu.
 *
 * ⚠️ Cette liste ne CONSERVE rien par elle-même. Aucun mécanisme n'applique
 * la rétention : 0/1136 objets portent une échéance, aucune règle de cycle de
 * vie n'est en vigueur, ce compartiment n'est pas WORM. Voir
 * DOCTRINE.RETENTION_EST_UN_PROCESSUS.
 */
export const PREFIXES_PROBATOIRES: readonly string[] = Object.freeze([
  "reports/",
  "evidence/",
]);

/**
 * LA BORNE LEGACY — D4.
 *
 * La population « legacy » est définie par une RÈGLE reproductible, pas par
 * une liste de 26 clés recopiées à la main. Mesuré : l'ensemble des objets
 * de seed jamais liés est STRICTEMENT IDENTIQUE à l'ensemble des objets
 * antérieurs au 2026-07-20. La règle rejoue donc la mesure au lieu de la
 * figer.
 *
 * ⚠️ BORNE D'HONNÊTETÉ : franchir cette date ne conclut RIEN sur le passé.
 * Elle ne dit pas que les objets antérieurs auraient été gouvernés, ni
 * qu'ils auraient cessé de l'être. Elle sépare « qualifiable par le registre
 * d'aujourd'hui » de « non enregistré, et qualifié comme tel ».
 */
export const BORNE_LEGACY = new Date("2026-07-20T00:00:00.000Z");

const ENVIRONNEMENTS: readonly StorageEnv[] = ["production", "preview", "development"];

/** La forme ALLOUÉE, et elle seule. Tout le reste est historique ou étranger. */
const FORME_ALLOUEE =
  /^reports\/(production|preview|development)\/(\d{4})\/(\d{2})\/([0-9a-f]{32})\.pdf$/;

/** La forme historique d'`uploadPdf` : lot, horodatage ms, slug du sujet, 8 hex dérivés. */
const FORME_UPLOADPDF =
  /^reports\/(production|preview|development)\/\d{4}\/\d{2}\/(.*?-)(\d{13})-(.*)-([0-9a-f]{8})\.pdf$/;

/** La forme des archives d'`engine.ts` — chemin GELÉ, jamais câblé au registre. */
const FORME_ARCHIVE_ENGINE = /^reports\/([^/]+)\/CASE_\1_(.+)\.pdf$/;

export type FormeDeCle =
  | { forme: "ALLOUEE"; env: StorageEnv; identifiant: string }
  | { forme: "UPLOADPDF_HISTORIQUE"; env: StorageEnv; horodatageMs: number; suffixeDerive: string }
  | { forme: "ARCHIVE_ENGINE"; handle: string }
  | { forme: "INCONNUE" };

/**
 * Le périmètre est un PRÉFIXE, et il le reste. P5 : « une clé hors préfixe
 * gouverné n'est pas gouvernée, et on ne prétend pas le contraire ».
 */
export function estDansPerimetreGouverne(cle: string): boolean {
  return cle.startsWith(PREFIXE_GOUVERNE);
}

/**
 * Lire la FORME d'une clé — sans jamais en déduire le sujet.
 *
 * `slugify` met en minuscules et un mint base58 est sensible à la casse :
 * lire le slug pour en déduire le mint fabriquerait des correspondances
 * fausses. C'est pourquoi `UPLOADPDF_HISTORIQUE` ne rend PAS de sujet. Le
 * sujet exact d'un objet historique vient de sa métadonnée R2 `subject` ;
 * celui d'un objet alloué vient du registre.
 */
export function lireFormeDeCle(cle: string): FormeDeCle {
  const alloue = FORME_ALLOUEE.exec(cle);
  if (alloue) {
    return { forme: "ALLOUEE", env: alloue[1] as StorageEnv, identifiant: alloue[4] };
  }
  const historique = FORME_UPLOADPDF.exec(cle);
  if (historique) {
    return {
      forme: "UPLOADPDF_HISTORIQUE",
      env: historique[1] as StorageEnv,
      horodatageMs: Number(historique[3]),
      suffixeDerive: historique[5],
    };
  }
  const engine = FORME_ARCHIVE_ENGINE.exec(cle);
  if (engine) return { forme: "ARCHIVE_ENGINE", handle: engine[1] };
  return { forme: "INCONNUE" };
}

export function estFormeAllouee(cle: string): boolean {
  return FORME_ALLOUEE.test(cle);
}

export interface IdentiteAllouee {
  /** L'identifiant de registre. Il EST le nom du fichier, et rien d'autre. */
  readonly identifiant: string;
  readonly cle: string;
}

/**
 * Allouer une identité. Aucun écrivain du périmètre n'a le droit d'en
 * fabriquer une (P1) : c'est ce qui empêche une quatrième forme de clé
 * d'apparaître un jour sans passer par une revue.
 *
 * `maintenant` est injecté plutôt que lu de l'horloge : une clé est un fait
 * daté, et un test qui ne peut pas fixer la date ne peut pas affirmer la
 * forme. L'instant d'AUTORITÉ, lui, est celui de la base (`allocated_at
 * DEFAULT now()`) — une seule horloge pour l'ordre des faits.
 */
export function allouerIdentite(env: StorageEnv, maintenant: Date): IdentiteAllouee {
  if (!ENVIRONNEMENTS.includes(env)) {
    throw new Error(`[registre] environnement hors domaine: ${String(env)}`);
  }
  const yyyy = maintenant.getUTCFullYear().toString();
  const mm = String(maintenant.getUTCMonth() + 1).padStart(2, "0");
  const identifiant = randomUUID().replace(/-/g, "");
  return { identifiant, cle: `${PREFIXE_GOUVERNE}${env}/${yyyy}/${mm}/${identifiant}.pdf` };
}

/**
 * La cause PROBABLE d'un objet sans ligne. Ce n'est pas un état d'autorité —
 * c'est ce qui rend le rapport de réconciliation lisible.
 *
 * Sans elle, les archives que `engine.ts` continue de produire (chemin GELÉ,
 * jamais câblé au registre) noieraient le seul objet qui compte : le témoin
 * « avant ». Un rapport où le signal est indiscernable du bruit connu ne se
 * lit pas deux fois.
 */
export type CauseProbable =
  | "PRODUCTEUR_NON_CABLE_ENGINE"
  | "PRODUCTEUR_HISTORIQUE_UPLOADPDF"
  | "ORIGINE_NON_ETABLIE";

export function causeProbable(cle: string): CauseProbable {
  switch (lireFormeDeCle(cle).forme) {
    case "ARCHIVE_ENGINE": return "PRODUCTEUR_NON_CABLE_ENGINE";
    case "UPLOADPDF_HISTORIQUE": return "PRODUCTEUR_HISTORIQUE_UPLOADPDF";
    default: return "ORIGINE_NON_ETABLIE";
  }
}

/** Un objet est-il antérieur à la borne legacy (D4) ? */
export function estAnterieurALaBorneLegacy(derniereModification: Date): boolean {
  return derniereModification.getTime() < BORNE_LEGACY.getTime();
}
