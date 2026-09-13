// ─── S1 · PHASE A — L'AUTORITÉ DE PUBLICATION D'UN DOSSIER, UNE SEULE ──────
//
// ██  La règle « ce dossier est publiable publiquement » est écrite ICI,    ██
// ██  et nulle part ailleurs. Un appelant ne la reformule pas : il la       ██
// ██  CONSOMME.                                                             ██
//
// ─── Ce qui a rendu ce module nécessaire ──────────────────────────────────
//
// Mesuré le 2026-09-13 : `token_casefiles.publishStatus` était comparé à
// `"published"` en huit endroits distincts (quatre pages, deux index, deux
// requêtes brutes), et n'était consulté NULLE PART par le producteur
// canonique ni par la route publique `/api/casefile/public`. Une surface page
// refusait un dossier `draft` ; la route publique le projetait. Deux
// implémentations indépendantes de la même décision, et l'une d'elles
// manquait.
//
// « Une route publique capable de projeter un dossier draft alors que la
//   surface page le refuse est une violation directe de l'autorité de
//   publication. »
//
// ─── Le contrat ───────────────────────────────────────────────────────────
//
//   · La primitive prend la LIGNE LUE, jamais un identifiant : aucun second
//     accès base, aucune divergence possible entre ce qui est décidé et ce
//     qui est rendu.
//   · Elle rend une DÉCISION fermée et typée. Le dossier n'est accessible
//     qu'à travers la branche `PUBLISHABLE` : un appelant qui ignore la
//     décision n'a pas de dossier à rendre, et ne compile pas.
//   · FAIL-CLOSED. Toute valeur absente, vide, non textuelle, approchante ou
//     inconnue REFUSE. Les valeurs muettes sont ÉNUMÉRÉES ci-dessous — comme
//     pour NON_ASSERTIVE, on nomme ce qu'on refuse, on ne le laisse pas
//     tomber dans un `else`.
//
// ─── Ce que la primitive ne dit PAS ───────────────────────────────────────
//
// Elle décide de la PUBLICATION DU DOSSIER. Elle ne dit rien de ses claims
// (état PUBLIC, `publicProjection.ts`), ni de ses montants, ni de ses pièces
// (`isPublic` des snapshots). Publier un dossier n'est pas publier ce qu'il
// contient — c'est la règle déjà tenue partout ailleurs dans le dépôt.

/** LA valeur qui publie. Le seul littéral de ce genre dans le dépôt. */
export const PUBLISHED_STATUS = "published" as const;

/**
 * Pourquoi un dossier est refusé. Vocabulaire FERMÉ, à usage interne (journal,
 * tests, surfaces admin). Aucune surface publique ne doit rendre cette cause :
 * distinguer « inconnu » de « draft » est un oracle d'existence.
 */
export const REFUSAL_CAUSES = [
  /** Aucune ligne : `null` ou `undefined`. */
  "ABSENT_ROW",
  /** La ligne existe, le champ n'y est pas ou vaut `null`. */
  "ABSENT_STATUS",
  /** Le champ n'est pas une chaîne (nombre, booléen, objet, tableau). */
  "NOT_A_STRING",
  /** Chaîne vide, ou composée uniquement d'espaces. */
  "EMPTY",
  /**
   * Une graphie APPROCHANTE de la valeur qui publie : casse différente,
   * espaces autour, variante. `"PUBLISHED"`, `" published "`, `"Published"`.
   * Nommée à part pour que personne ne « corrige » la primitive en la rendant
   * tolérante : une tolérance de casse est une seconde règle.
   */
  "LOOKALIKE",
  /** Toute autre valeur : `draft`, `restricted`, `archived`, ou inconnue. */
  "NOT_PUBLISHED",
] as const;
export type RefusalCause = (typeof REFUSAL_CAUSES)[number];

/** Une ligne dont la publication a été DÉCIDÉE. Le type porte la décision. */
export type PubliclyPublishable<T> = T & { readonly publishStatus: typeof PUBLISHED_STATUS };

export type PublicationDecision<T> =
  | { readonly decision: "PUBLISHABLE"; readonly dossier: PubliclyPublishable<T> }
  | { readonly decision: "REFUSED"; readonly cause: RefusalCause };

/** La forme minimale d'une ligne de dossier telle que la primitive la lit. */
export interface DossierRowLike {
  readonly publishStatus?: unknown;
}

/**
 * LA décision. Pure, synchrone, sans accès base.
 *
 * L'ordre des refus n'est pas neutre : une valeur approchante est reconnue
 * AVANT le refus générique, pour qu'un journal dise « LOOKALIKE » et non
 * « NOT_PUBLISHED » quand quelqu'un écrit `PUBLISHED` en majuscules en base.
 */
export function decidePublication<T extends DossierRowLike>(
  row: T | null | undefined,
): PublicationDecision<T> {
  if (row === null || row === undefined) return { decision: "REFUSED", cause: "ABSENT_ROW" };
  const v = row.publishStatus;
  if (v === null || v === undefined) return { decision: "REFUSED", cause: "ABSENT_STATUS" };
  if (typeof v !== "string") return { decision: "REFUSED", cause: "NOT_A_STRING" };
  if (v.trim() === "") return { decision: "REFUSED", cause: "EMPTY" };
  if (v === PUBLISHED_STATUS) {
    return { decision: "PUBLISHABLE", dossier: row as PubliclyPublishable<T> };
  }
  if (v.trim().toLowerCase() === PUBLISHED_STATUS) return { decision: "REFUSED", cause: "LOOKALIKE" };
  return { decision: "REFUSED", cause: "NOT_PUBLISHED" };
}

/**
 * Filtre une liste lue en base sur la décision. C'est la forme « liste » de
 * la primitive : un index n'a pas à réécrire la règle pour l'appliquer à
 * chaque ligne, et une ligne refusée est simplement ABSENTE — pas signalée.
 */
export function keepPublishable<T extends DossierRowLike>(rows: readonly T[]): PubliclyPublishable<T>[] {
  const out: PubliclyPublishable<T>[] = [];
  for (const r of rows) {
    const d = decidePublication(r);
    if (d.decision === "PUBLISHABLE") out.push(d.dossier);
  }
  return out;
}

/**
 * Le filtre Prisma DÉRIVÉ de la valeur qui publie, pour ne pas ramener en
 * mémoire ce que la base peut écarter. Il n'est PAS l'autorité : une requête
 * qui l'emploie repasse ses lignes par `keepPublishable`. Deux fois la même
 * règle vaut mieux que deux règles.
 */
export const PUBLISHED_ONLY_WHERE = { publishStatus: PUBLISHED_STATUS } as const;
