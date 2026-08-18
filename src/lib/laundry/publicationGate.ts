// src/lib/laundry/publicationGate.ts
//
// LE POINT DE FILTRAGE UNIQUE DE `LaundryTrail`.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// `LaundryTrail` est le seul objet nominatif publié du dépôt sans état de
// publication ni journal. `KolProfile` a 10 colonnes de statut et un journal,
// `KolTokenLink` en a 7 et un journal, `LaundryTrail` n'avait rien — donc
// retirer une de ses phrases exigeait un `DELETE` SQL à la main. Une
// destruction, là où la doctrine du containment exige un interrupteur tracé.
//
// Ce que ces phrases contiennent : chacune des cinq lignes existantes porte un
// montant chiffré ET une affirmation de mouvement de fonds, en anglais et en
// français, sur un profil publié. Mesures :
// docs/prep/RAPPORT_A11_EXPOSITION_LAUNDRYTRAIL.md.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE CONTRASTE QUI A SERVI DE POINT DE DÉPART
// ═══════════════════════════════════════════════════════════════════════════
//
// Dans `src/lib/ask/groundingContext.ts`, avant ce chantier :
//
//     proceedsPublication: true,          // ← « P0 containment », commenté
//     …
//     laundryTrails: { select: { laundryRisk: true }, take: 1 },   // ← rien
//
// Sept lignes d'écart. Dans la même requête, le montant était soumis au
// containment et le trail de blanchiment ne l'était pas — alors que c'est la
// surface la plus difficile à rattraper, puisqu'elle alimente un modèle de
// langage qui reformule librement en prose.
//
// ═══════════════════════════════════════════════════════════════════════════
// FAIL-CLOSED — LES QUATRE FAÇONS DE NE PAS PUBLIER
// ═══════════════════════════════════════════════════════════════════════════
//
// Un état illisible ou absent NE PUBLIE PAS. Quatre cas, tous refusés :
//
//   1. `publication = 'withdrawn'`      décision explicite ;
//   2. `publication` vaut autre chose   valeur inattendue → refus ;
//   3. `publication` absent du `select` `undefined` → refus. Un appelant qui
//      oublie de demander la colonne n'obtient pas une publication par défaut ;
//   4. la LECTURE ÉCHOUE                colonne pas encore créée, base
//      injoignable, client Prisma non régénéré → refus, sans propager
//      l'exception. C'est le cas le plus important : entre la mise en
//      production du code et l'exécution de la migration, la lecture lève —
//      et le comportement voulu est « aucun trail », pas « une erreur 500 »,
//      et surtout pas « tout est publié ».
//
// Aucune de ces portes ne s'ouvre par variable d'environnement. Il n'y a pas
// de `SKIP_`, pas de `FORCE_`, pas de mode « développement ».
//
// ═══════════════════════════════════════════════════════════════════════════
// PRÉREQUIS
// ═══════════════════════════════════════════════════════════════════════════
//
// La colonne `LaundryTrail.publication` est posée par
// `MIGRATION_laundry_publication_v1.sql` (voir docs/prep/patches/), NON
// APPLIQUÉE à ce jour. Tant qu'elle n'existe pas, `readPublishedLaundryTrail`
// rend `null` par le cas 4 — le produit se comporte comme si aucun trail
// n'était publié. C'est volontairement plus strict que l'état actuel.

/** Les deux seuls états. Aligné sur le CHECK de la migration. */
// Types du CLIENT GÉNÉRÉ, à dessein : un `Record<string, string>` acceptait
// n'importe quelle clé, et c'est ce qui rendait le typecheck vert alors que
// la colonne n'existait dans aucun schéma. Ici, une clé fausse ne compile pas.
import type { Prisma } from "@prisma/client";

export const LAUNDRY_PUBLICATION_STATES = ["published", "withdrawn"] as const;
export type LaundryPublicationState = (typeof LAUNDRY_PUBLICATION_STATES)[number];

/**
 * Motifs de décision. Liste FERMÉE, alignée mot pour mot sur
 * `KolProceedsPublicationLog_reasonCode_allowed` : deux registres qui parlent
 * de publication nominative doivent s'agréger ensemble.
 */
export const LAUNDRY_DECISION_CODES = [
  "approved",
  "rejected",
  "contested",
  "erratum",
  "evidence_withdrawn",
  "legal",
  "duplicate",
  "other",
] as const;
export type LaundryDecisionCode = (typeof LAUNDRY_DECISION_CODES)[number];

/** Portées d'une décision. Aligné sur le CHECK `..._scope_allowed`. */
export const LAUNDRY_DECISION_SCOPES = ["trail_full", "trail_narrative", "trail_risk"] as const;
export type LaundryDecisionScope = (typeof LAUNDRY_DECISION_SCOPES)[number];

/** Tout objet susceptible de porter l'état — y compris mal formé. */
export type LaundryPublicationCarrier = { publication?: unknown } | null | undefined;

/**
 * À étaler dans tout `select` Prisma qui lira un trail.
 *
 * Typé `Record<string, true>` et non littéralement : la colonne n'existe pas
 * encore dans le client Prisma généré (`prisma/schema.prod.prisma` est un
 * chemin gelé par le guard, et aucune migration n'a été exécutée). Le jour où
 * `pnpm prisma:generate` tourne après la migration, ce type se resserre sans
 * changer une ligne d'appelant.
 */
export const LAUNDRY_PUBLICATION_SELECT = { publication: true } satisfies Prisma.LaundryTrailSelect;

/** À étaler dans tout `where` Prisma qui lira un trail destiné à être servi. */
export const PUBLISHED_LAUNDRY_FILTER = { publication: "published" } satisfies Prisma.LaundryTrailWhereInput;

/**
 * L'unique prédicat. Fail-closed par construction : seule la chaîne exacte
 * `"published"` publie.
 *
 * `undefined` (colonne non sélectionnée), `null`, `""`, `"PUBLISHED"`,
 * `"withdrawn"`, un nombre, un objet : tout le reste rend `false`.
 */
export function isLaundryTrailPublished(trail: LaundryPublicationCarrier): boolean {
  return trail?.publication === "published";
}

/**
 * Rend le trail, ou `null` si sa publication est retirée.
 *
 * `null` et jamais un objet vidé de ses champs : un appelant qui teste
 * `if (trail)` se comporte correctement sans modification — le bloc disparaît
 * au lieu d'afficher une carte vide portant encore le nom de la personne.
 */
export function redactLaundryTrail<T extends LaundryPublicationCarrier>(trail: T): T | null {
  return isLaundryTrailPublished(trail) ? trail : null;
}

/** Ne garde que les trails encore publiés. Utile sur les lectures en liste. */
export function filterPublishedLaundryTrails<T extends LaundryPublicationCarrier>(
  trails: readonly T[] | null | undefined,
): T[] {
  if (!Array.isArray(trails)) return [];
  return trails.filter((t): t is T => isLaundryTrailPublished(t));
}

/**
 * Forme minimale d'un client Prisma, pour rester testable sans base.
 *
 * `findFirst` est déclarée en SYNTAXE DE MÉTHODE, pas en propriété-flèche : sous
 * `strictFunctionTypes`, seule la syntaxe de méthode est bivariante sur ses
 * paramètres, et c'est ce qui permet d'accepter la signature générique du
 * délégué Prisma sans recourir à `any`.
 */
type LaundryTrailReader = {
  laundryTrail: {
    findFirst(args?: {
      where?: unknown;
      select?: unknown;
      orderBy?: unknown;
    }): Promise<unknown>;
  };
};

export type PublishedLaundryTrail = {
  id?: string;
  laundryRisk?: string | null;
  narrativeText?: string | null;
  narrativeTextFr?: string | null;
  [key: string]: unknown;
};

/**
 * LA lecture. Toutes les surfaces doivent passer par ici — c'est ce qui fait du
 * filtre un point UNIQUE plutôt que six copies d'une même condition, dont l'une
 * finira par diverger.
 *
 * Le filtre est posé dans le `where` (la base ne renvoie pas la ligne retirée)
 * ET revérifié sur l'objet rendu (défense en profondeur, si un appelant fournit
 * un `where` à lui). Les deux coûtent une comparaison de chaîne.
 *
 * **N'échoue jamais bruyamment.** Toute exception — colonne absente, base
 * injoignable, client non régénéré — est absorbée et rend `null`. Ce choix est
 * l'inverse de celui du garde d'endpoint (A9), qui doit sortir en code 1 : ici
 * l'échec doit produire MOINS de publication, pas une panne. Propager
 * l'exception ferait tomber `/api/scan/ask` entier, et quelqu'un finirait par
 * retirer le filtre pour rétablir la route.
 */
export async function readPublishedLaundryTrail(
  db: LaundryTrailReader,
  handle: string,
  select?: Record<string, true>,
): Promise<PublishedLaundryTrail | null> {
  if (!handle) return null;
  try {
    const row = await db.laundryTrail.findFirst({
      where: { kolHandle: handle, ...PUBLISHED_LAUNDRY_FILTER },
      ...(select ? { select: { ...select, ...LAUNDRY_PUBLICATION_SELECT } } : {}),
      orderBy: { createdAt: "desc" },
    });
    return redactLaundryTrail(row as LaundryPublicationCarrier) as PublishedLaundryTrail | null;
  } catch {
    // Cas 4 du fail-closed. Voir l'exposé en tête de fichier.
    return null;
  }
}
