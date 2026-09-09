import type { PublicationState } from "@/lib/publication/absenceVocabulary";
// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Shared Types
// Independent of Prisma. All enums are string unions.
// ─────────────────────────────────────────────────────────────────────────────

export type IntelEntityType =
  | "ADDRESS"
  | "CONTRACT"
  | "TOKEN_CA"
  | "DOMAIN"
  | "PROJECT"
  | "PERSON";

export type IntelRiskClass =
  | "SANCTION"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "UNKNOWN";

export type MatchBasis =
  | "EXACT_ADDRESS"
  | "EXACT_CONTRACT"
  | "EXACT_DOMAIN"
  | "EXACT_TOKEN_CA"
  | "INFERRED_LINKAGE"
  | "FUZZY_ALIAS";

export type IntelDisplaySafety =
  | "INTERNAL_ONLY"
  | "ANALYST_REVIEWED"
  | "RETAIL_SAFE";

export interface SourceObservationMinimal {
  id: string;
  sourceSlug: string;
  sourceTier: number;
  riskClass: IntelRiskClass;
  matchBasis: MatchBasis;
  listIsActive: boolean;
  externalUrl: string | null;
  observedAt: Date | null;
  ingestedAt: Date;
}

export interface MatchTarget {
  type: IntelEntityType;
  value: string;
  chain?: string;
}

export interface IntelSignal {
  ims: number;
  ics: number;
  matchCount: number;
  hasSanction: boolean;
  topRiskClass: IntelRiskClass | null;
  matchBasis: MatchBasis | null;
  sourceSlug: string | null;
  externalUrl: string | null;
  winner: SourceObservationMinimal | null;
  /**
   * ─── S3.2 · UN RÉSULTAT SUPPRIMÉ N'EST PAS UN RÉSULTAT ABSENT ──────────
   *
   * ██  `WITHHELD` ne révèle RIEN de ce qui est retiré. Il dit seulement    ██
   * ██  que le négatif ne conclut pas.                                     ██
   *
   * Mesuré en production le 2026-09-09, trois signaux BYTE-IDENTIQUES :
   *
   *   0xa5b0edf6…  sanctionnée OFAC, retirée au retail  matchCount 0
   *   0x…dEaD      inconnue de la base                  matchCount 0
   *   USDC         inconnue de l'intelligence           matchCount 0
   *
   * La première produisait `NO_MATCH_COMPLETE` avec `negativeIsConclusive:
   * true` — une AFFIRMATION CONCLUANTE DE PROPRETÉ sur une adresse
   * sanctionnée. C'est l'axe qui manquait, et il existait déjà : celui de
   * PUBLICATION, ratifié dans `absenceVocabulary.ts`.
   *
   * Il ne se confond avec AUCUN des deux autres :
   *   WITHHELD      trouvé, et retiré pour cette audience   (PUBLICATION)
   *   NOT_MEASURED  jamais mesuré                           (MEASUREMENT)
   *   négatif réel  mesuré, rien trouvé
   *
   * `PUBLISHED` est le cas normal, y compris pour une absence VRAIE : rien
   * n'a été retiré, donc il n'y a pas de décision de publication à porter.
   */
  publicationState: PublicationState;
}
