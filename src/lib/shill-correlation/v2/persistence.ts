// --- C - LA NATURE NATIVE DE ShillCorrelationCandidate --------------------
//
// ██  ÉTAT : PRÊT, NON ARMÉ. LE DDL N'EST PAS APPLIQUÉ.  ██
//
// Ce module construit et VALIDE le fragment de nature d'une ligne candidate.
// Il n'écrit rien : aucun import de prisma, aucune requête. Tant que les trois
// colonnes n'existent pas en base (voir docs/prep/PACK_C_SHILL_NATURE_DDL),
// `buildCandidateNatureWrite` est appelable et testable, mais son résultat
// n'est passé à aucun upsert.
//
// ─── LA RÈGLE, EXACTEMENT ────────────────────────────────────────────────
//
// Les colonnes sont écrites UNIQUEMENT sur les lignes que le moteur (RE)PRODUIT.
// Il n'y a AUCUN backfill, et il ne doit pas y en avoir :
//
//   • un UPDATE global écrirait « INFERENCE, basis=[PRIMARY_OBSERVATION],
//     policyVersion=<version du jour> » sur 1 532 lignes calculées entre le
//     2026-06-10 et le 2026-08-28 sous des seuils qui ne sont pas ceux-là.
//     La nature serait juste ; la VERSION serait fausse, et une version fausse
//     est pire qu'absente : elle rend deux lignes incomparables comparables ;
//   • natureBasis est une propriété de LA LIGNE (le résolveur a-t-il tranché
//     pour CE token ?), pas de la table. Le déduire en masse serait l'inventer.
//
// Une ligne legacy reste donc NULL jusqu'à son propre recalcul. NULL veut dire
// ici « produite avant que la nature ne soit tracée », pas « sans nature » :
// la nature de la table est DÉCLARÉE au registre (S1) et vaut pour les 1 532
// lignes, colonne ou pas. La colonne est la piste d'audit, pas la source.
//
// ─── S6 ───────────────────────────────────────────────────────────────────
// Toute écriture passe par `assertNatureWritable`. Il refuse une nature
// absente ou invalide, une ESTIMATE non auditable, un artefact du corpus mixte,
// et toute remontée d'échelle (I1). Ici il tient surtout I1 : une ligne déjà
// classée INFERENCE ne peut pas être réécrite en PRIMARY_OBSERVATION par un
// consommateur pressé.

import {
  assertNatureWritable,
  type NatureWriteTarget,
} from "@/lib/data-nature/writeGuard";
import { natureForTable } from "@/lib/data-nature/registry";
import type { DataNature, NatureValue } from "@/lib/data-nature/nature";
import type { CandidateInference } from "./types";

export const CANDIDATE_TABLE = "ShillCorrelationCandidate";

/** Fragment additif à fusionner dans le `create`/`update` de l'upsert. */
export interface CandidateNatureWrite {
  nature: DataNature;
  /** jsonb — l'enveloppe, pas seulement le tableau de natures. */
  natureBasis: {
    natures: DataNature[];
    occasionIds: string[];
    observationCount: number;
    baselineBuyCount: number;
  };
  naturePolicyVersion: string;
}

/**
 * L'état de nature d'une ligne DÉJÀ en base, tel qu'on le relit avant d'écrire.
 * `null` = colonne absente ou ligne legacy — le cas normal aujourd'hui.
 */
export interface ExistingCandidateNature {
  id?: string | null;
  nature?: NatureValue | null;
}

/**
 * Construit le fragment et le fait valider par le chokepoint S6.
 *
 * `existing` est la ligne telle qu'elle est en base AVANT l'upsert. La passer
 * n'est pas décoratif : c'est ce qui arme I1. L'omettre revient à écrire sans
 * savoir ce qu'on écrase, et le garde ne peut alors rien tenir.
 */
export function buildCandidateNatureWrite(
  candidate: CandidateInference,
  existing: ExistingCandidateNature = {},
  where = "shill-v2/persistence.buildCandidateNatureWrite",
): CandidateNatureWrite {
  const env = candidate._nature;

  const target: NatureWriteTarget = {
    id: existing.id ?? null,
    // Une ligne candidate n'a pas de sha256 : elle n'est pas une pièce.
    sha256: null,
    ref: `${CANDIDATE_TABLE}(${candidate.kolHandle}, ${candidate.wallet}, ${candidate.chain})`,
    currentNature: existing.nature ?? null,
  };

  const natureBasis: CandidateNatureWrite["natureBasis"] = {
    natures: env.natureBasis,
    occasionIds: env.basisRefs.occasionIds,
    observationCount: env.basisRefs.observationCount,
    baselineBuyCount: env.basisRefs.baselineBuyCount,
  };

  const validated = assertNatureWritable(
    target,
    { nature: env.nature, natureBasis, scope: "row" },
    where,
  );

  // Défense en profondeur : le registre déclare la table mono-nature INFERENCE.
  // Si un jour les deux divergent, on s'arrête — on ne choisit pas en silence.
  const declared = natureForTable(CANDIDATE_TABLE);
  if (validated !== declared) {
    throw new Error(
      `[shill-v2] nature ${validated} incompatible avec la nature DÉCLARÉE de ` +
        `${CANDIDATE_TABLE} (${declared}). Le registre et le moteur doivent dire la même ` +
        "chose ; l'un des deux a changé sans l'autre.",
    );
  }

  return {
    nature: validated as DataNature,
    natureBasis,
    naturePolicyVersion: env.policyVersion,
  };
}

/**
 * ██ VERROU ANTI-BACKFILL ██
 *
 * Il n'existe volontairement AUCUNE fonction de backfill dans ce module, et
 * ce commentaire tient lieu de refus explicite : le jour où quelqu'un en
 * voudra une, ce sera la décision à discuter, pas le contournement à coder.
 *
 * Le seul chemin d'écriture légitime des trois colonnes est l'upsert du moteur,
 * ligne par ligne, avec le fragment ci-dessus. Toute requête de la forme
 * `UPDATE "ShillCorrelationCandidate" SET nature = ...` sans clause portant sur
 * une ligne que le moteur vient de recalculer viole la règle de C.
 */
export const BACKFILL_IS_FORBIDDEN = true as const;
