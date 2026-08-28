// ─── Le registre des méthodologies citables ────────────────────────────────
//
// CONVENTION CANONIQUE UNIQUE, et il n'y en aura pas deux :
//
//     <methodology-id>/<component>@<version>
//
// Elle n'a de valeur que parce qu'elle est adossée à un artefact GELÉ : un
// methodRef qui ne résout pas est un mensonge, et resolveMethodRef le dit en
// rendant null plutôt qu'en devinant.
//
// DETTE CONNUE, NON TRAITÉE ICI : KolProceedsSummary.methodologyVersion porte
// 'v1' (27 lignes) et 'v1-seed' (1) — une version SANS slug, qui dit quelle
// version sans jamais dire de quoi. Elle est hors de cette convention et
// devra y être mappée ; elle ne bloque pas S5.

import { FINANCIAL_ESTIMATES_V1, type MethodologyArtifact } from "./artifact";
import { parseMethodRef } from "@/lib/data-nature/methodRef";

export const METHODOLOGIES: readonly MethodologyArtifact[] = [FINANCIAL_ESTIMATES_V1];

export interface ResolvedMethodRef {
  readonly ref: string;
  readonly artifact: MethodologyArtifact;
  readonly componentId: string;
  readonly componentTitle: string;
  readonly componentBody: string;
}

// La forme n'est plus définie ici : elle vient de data-nature/methodRef,
// grammaire canonique unique (S6-0). Deux regex qui redérivent la même règle,
// c'est exactement le défaut que S6-0 corrige.

/**
 * Résout `<methodology>/<component>@<version>`.
 * Rend null si la forme est invalide, la méthodologie inconnue, la version
 * absente ou le composant inexistant. Aucune tolérance : une référence qui
 * ne résout pas ne doit jamais être écrite en base.
 */
export function resolveMethodRef(ref: string): ResolvedMethodRef | null {
  const parsed = parseMethodRef(ref.trim());
  if (!parsed) return null;
  const { methodologyId: id, componentId, version } = parsed;

  const artifact = METHODOLOGIES.find((a) => a.id === id && a.version === version);
  if (!artifact) return null;

  const component = artifact.components.find((c) => c.id === componentId);
  if (!component) return null;

  return {
    ref,
    artifact,
    componentId: component.id,
    componentTitle: component.title,
    componentBody: component.body,
  };
}

/** Vraie seulement si la référence résout sur un artefact gelé. */
export function isKnownMethodRef(ref: string): boolean {
  return resolveMethodRef(ref) !== null;
}

/** La référence citée par les 10 KolCase.paidUsd de S5-B. */
export const EST_PROCEEDS_V1 = "financial-estimates/est-proceeds@v1";

// ─── RÈGLE DE MODÈLE — KolTokenInvolvement.retailLossEstimateUsd ───────────
//
// La colonne existe, sa colonne de nature aussi, et AUCUNE ligne n'est
// renseignée (0 / 15 au 2026-08-28). C'est le seul endroit du plan où la règle
// précède la donnée.
//
//     Si retailLossEstimateUsd est NON NULL et retailLossEstimateUsdNature
//     vaut 'ESTIMATE', alors un methodRef résolvant sur un artefact gelé est
//     REQUIS. Le composant applicable est financial-estimates/est-investor-losses.
//
// AUCUN CHECK n'est posé en base aujourd'hui, délibérément : une contrainte
// écrite avant le premier writer réel se heurterait à un chemin d'écriture qui
// n'existe pas encore, et personne ne saurait la tester. Le CHECK attend ce
// premier writer et ses tests. La règle, elle, est écrite dès maintenant pour
// que le writer naisse en la connaissant.
export const RETAIL_LOSS_ESTIMATE_RULE = {
  table: "KolTokenInvolvement",
  amountColumn: "retailLossEstimateUsd",
  natureColumn: "retailLossEstimateUsdNature",
  requiresMethodRefWhen: "amount IS NOT NULL AND nature = 'ESTIMATE'",
  applicableComponent: "financial-estimates/est-investor-losses",
  dbConstraint: "DEFERRED — attend le premier writer réel et ses tests",
} as const;
