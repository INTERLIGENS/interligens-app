// ─── BUILD 8 / P2 — LA PROVENANCE D'UN CHIFFRE DE PROCEEDS ─────────────────
//
// ██  Un chiffre servi doit être reproductible depuis sa source déclarée,    ██
// ██  ou se déclarer non reproductible. Jamais affirmer sans permettre de    ██
// ██  vérifier.                                                              ██
//
// ─── Ce qu'il ferme ────────────────────────────────────────────────────────
//
// `src/lib/kol/canonical.ts` pose deux valeurs EN DUR sur chaque snapshot :
//
//     proceedsSource: "KolProceedsEvent"   ← un littéral, jamais lu
//     builtFromEventId: null               ← toujours null
//
// Le snapshot DÉCLARE sa source sans jamais la consulter. Vérifié le
// 2026-09-07 contre la règle exacte de son writer (`sync-proceeds` :
// SUM(amountUsd) WHERE ambiguous=false AND amountUsd>0, arrondi) sur les
// 32 profils publiés :
//
//     reproductibles       30
//     sans chiffre          1
//     NON reproductibles    1   ← 141 594 $ servis que la source ne rend pas
//
// L'affirmation est donc vraie à 30 sur 32. Le défaut n'est pas la divergence
// — c'est que RIEN dans la charge utile ne dit lequel est le 31ᵉ. Un
// consommateur ne peut pas falsifier ce qu'on lui affirme.
//
// ─── Et ce que la table voisine savait déjà ────────────────────────────────
//
// `KolProceedsSummary` porte, sur ses 28 lignes :
//     coverageStatus  = 'partial'   28 / 28
//     pricingQuality  = 'fallback'  24 / 28
//
// La couverture partielle et la qualité de prix dégradée étaient CALCULÉES et
// STOCKÉES. `canonical.ts` ne lit jamais cette table. Le produit savait que son
// chiffre était partiel et l'a servi sans le dire.
//
// ─── Aucun verdict ─────────────────────────────────────────────────────────
//
// Ce module rend des ÉTATS, pas des conclusions. Il ne dit pas qu'un chiffre
// est faux, ni qu'un profil est douteux : il dit si le chiffre servi se
// retrouve dans la source qu'on lui attribue. Aucun score, aucun seuil, aucun
// pourcentage — et aucun n'en sera dérivé.
//
// ─── Non câblé, et pourquoi ────────────────────────────────────────────────
//
// Le seul consommateur est `canonical.ts`, sur chemin gelé (^src/lib/kol/).
// Le contrat est prêt et prouvé ; son branchement demande l'exemption listée
// au rapport.

/** Les états de reproductibilité. Fermés, et sans ordre implicite. */
export const REPRODUCIBILITY_STATES = [
  /** Le chiffre servi est exactement celui que la source rend. */
  "REPRODUCIBLE",
  /** La source existe, mais elle ne rend pas ce chiffre. */
  "NOT_REPRODUCIBLE",
  /** Aucun chiffre n'est publié — il n'y a rien à reproduire. */
  "NO_FIGURE",
  /** La vérification n'a pas pu avoir lieu. Fail-closed : ce n'est PAS un succès. */
  "NOT_VERIFIED",
] as const;
export type Reproducibility = (typeof REPRODUCIBILITY_STATES)[number];

/**
 * La règle du writer, nommée et versionnée.
 *
 * Ce n'est pas un `methodRef` : la grammaire canonique exige un artefact gelé
 * (`<slug>/<composant>@v<N>`) et aucune méthodologie ne décrit cette
 * agrégation. En inventer une référence serait exactement ce que W2 interdit.
 * C'est un identifiant de RÈGLE, et il dit où la lire.
 */
export const WRITER_RULE_V1 = {
  id: "sync-proceeds/sum-unambiguous-positive/v1",
  sql: 'SUM("amountUsd") WHERE "ambiguous" = false AND "amountUsd" > 0, arrondi à l\'entier',
  source: "src/app/api/admin/kol/sync-proceeds/route.ts",
} as const;

export interface ProceedsProvenance {
  /**
   * La table effectivement consultée — `null` quand aucune vérification n'a eu
   * lieu. JAMAIS un littéral posé d'avance : c'est tout l'objet du module.
   */
  source: "KolProceedsEvent" | null;
  reproducibility: Reproducibility;
  /** La règle appliquée pour reproduire, quand elle a été appliquée. */
  rule: string | null;
  /** Ce que la source rend, face à ce qui est servi. Les deux, ou aucun. */
  servedUsd: number | null;
  sourceUsd: number | null;
  eventCount: number | null;
  /** Ce que `KolProceedsSummary` savait déjà, remonté au lieu d'être tu. */
  coverageStatus: string | null;
  pricingQuality: string | null;
  summaryComputedAt: Date | null;
}

export interface ProvenanceInput {
  /** Le chiffre servi — `KolProfile.totalDocumented`, après le gate de publication. */
  readonly servedUsd?: unknown;
  /** Ce que la source rend sous la règle du writer. `undefined` = non vérifié. */
  readonly sourceUsd?: unknown;
  readonly eventCount?: unknown;
  /** Colonnes de KolProceedsSummary, quand la ligne existe. */
  readonly coverageStatus?: unknown;
  readonly pricingQuality?: unknown;
  readonly summaryComputedAt?: unknown;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

/**
 * Décide l'état de reproductibilité. Quatre branches, aucune par défaut.
 *
 * L'ordre compte : « non vérifié » se décide AVANT « pas de chiffre », parce
 * qu'un profil dont on n'a pas consulté la source ne doit pas ressortir comme
 * un profil sans chiffre — ce serait affirmer une absence qu'on n'a pas
 * constatée.
 */
export function deriveReproducibility(input: ProvenanceInput): Reproducibility {
  const source = num(input.sourceUsd);
  const served = num(input.servedUsd);

  // La source n'a pas été consultée : on ne conclut rien.
  if (input.sourceUsd === undefined || source === null) return "NOT_VERIFIED";
  // Aucun chiffre servi : rien à reproduire, et ce n'est pas un défaut.
  if (input.servedUsd === undefined || served === null) return "NO_FIGURE";
  return served === source ? "REPRODUCIBLE" : "NOT_REPRODUCIBLE";
}

/**
 * L'enveloppe complète. `source` n'est renseignée que si la source a
 * réellement été lue — c'est la correction du littéral posé en dur.
 */
export function buildProceedsProvenance(input: ProvenanceInput): ProceedsProvenance {
  const reproducibility = deriveReproducibility(input);
  const verifie = reproducibility !== "NOT_VERIFIED";

  return {
    source: verifie ? "KolProceedsEvent" : null,
    reproducibility,
    rule: verifie ? WRITER_RULE_V1.id : null,
    servedUsd: num(input.servedUsd),
    sourceUsd: num(input.sourceUsd),
    eventCount: num(input.eventCount),
    coverageStatus: str(input.coverageStatus),
    pricingQuality: str(input.pricingQuality),
    summaryComputedAt:
      input.summaryComputedAt instanceof Date ? input.summaryComputedAt : null,
  };
}
