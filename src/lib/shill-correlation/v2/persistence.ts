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
// lignes, colonne ou pas. La colonne `rowNature` est la piste d'audit, pas la
// source.
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
import type { InferenceEnvelope } from "./types";
import type { InferenceBasis } from "@/lib/data-nature/inferenceEnvelope";

export const CANDIDATE_TABLE = "ShillCorrelationCandidate";

/**
 * ─── LE CONTRAT TS ↔ POSTGRES ────────────────────────────────────────────
 *
 * `rowNature` est une colonne de type ENUM `"DataNature"`, pas TEXT. C'est ce
 * qui fait refuser une valeur hors domaine par la BASE — mais cela déplace aussi
 * une classe d'erreur : sous TEXT, une nature ajoutée côté TS s'écrivait sans
 * bruit ; sous enum, elle fait ÉCHOUER l'écriture (22P02, invalid_text_
 * representation) au premier run, en production.
 *
 * Labels du type, MESURÉS sur ep-square-band le 2026-08-30 (pg_enum, lecture
 * seule). Toute divergence avec `ALL_NATURE_VALUES` côté TS est une panne
 * d'écriture qui attend son heure — d'où le test de dérive qui compare les deux.
 */
export const PG_DATA_NATURE_LABELS = [
  "PRIMARY_OBSERVATION",
  "THIRD_PARTY_DATA",
  "INFERENCE",
  "ESTIMATE",
  "EDITORIAL_ASSERTION",
  "UNCLASSIFIED",
] as const;

/** Fragment additif à fusionner dans le `create`/`update` de l'upsert. */
export interface CandidateNatureWrite {
  /** Colonne `rowNature` — convention du produit, 7 tables sur 7. */
  rowNature: DataNature;
  /** jsonb — l'enveloppe, pas seulement le tableau de natures. */
  /**
   * jsonb — l'enveloppe canonique (B4.2) plus les compteurs propres au moteur.
   * `inputNatures` ne porte QUE des natures de sources : l'inference n'est
   * jamais une de ses propres entrees.
   */
  natureBasis: InferenceBasis & {
    occasionIds: string[];
    observationCount: number;
    baselineBuyCount: number;
  };
  naturePolicyVersion: string;
}

/**
 * CE QUE LA FONCTION A BESOIN DE SAVOIR, et rien de plus.
 *
 * Volontairement plus étroit que `CandidateInference` — que ce type couvre
 * structurellement. Le fragment de nature ne dépend ni des features ni des
 * scores : l'exiger obligerait v1 (`aggregate.ts`, qui n'a ni `CorrelationFeatures`
 * ni le moteur v2) à fabriquer un faux candidat pour écrire une vraie nature.
 * L'identité sert au `ref` du message d'erreur, l'enveloppe porte le reste.
 */
export interface CandidateNatureSource {
  kolHandle: string;
  wallet: string;
  chain: string;
  _nature: InferenceEnvelope;
}

/**
 * L'état de nature d'une ligne DÉJÀ en base, tel qu'on le relit avant d'écrire.
 * `null` = colonne absente ou ligne legacy — le cas normal aujourd'hui.
 */
export interface ExistingCandidateNature {
  id?: string | null;
  rowNature?: NatureValue | null;
}

/**
 * Construit le fragment et le fait valider par le chokepoint S6.
 *
 * `existing` est la ligne telle qu'elle est en base AVANT l'upsert. La passer
 * n'est pas décoratif : c'est ce qui arme I1. L'omettre revient à écrire sans
 * savoir ce qu'on écrase, et le garde ne peut alors rien tenir.
 */
export function buildCandidateNatureWrite(
  candidate: CandidateNatureSource,
  existing: ExistingCandidateNature = {},
  where = "shill-v2/persistence.buildCandidateNatureWrite",
): CandidateNatureWrite {
  const env = candidate._nature;

  const target: NatureWriteTarget = {
    id: existing.id ?? null,
    // Une ligne candidate n'a pas de sha256 : elle n'est pas une pièce.
    sha256: null,
    ref: `${CANDIDATE_TABLE}(${candidate.kolHandle}, ${candidate.wallet}, ${candidate.chain})`,
    currentNature: existing.rowNature ?? null,
  };

  // B4.2 - LE BASIS STRUCTURE. `natureBasis` (la colonne jsonb) porte
  // desormais l'enveloppe canonique : les entrees y sont DECRITES, et
  // `inputNatures` ne contient que des natures de SOURCES. L'inference n'y
  // figure plus comme sa propre preuve.
  const natureBasis: CandidateNatureWrite["natureBasis"] = {
    ...env.basis,
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

  // Le contrat enum, tenu à l'écriture : ce que l'on s'apprête à envoyer doit
  // être un label du type Postgres. Échouer ici coûte un test ; échouer en base
  // coûte un run de production interrompu au premier upsert.
  if (!(PG_DATA_NATURE_LABELS as readonly string[]).includes(validated)) {
    throw new Error(
      `[shill-v2] nature « ${validated} » absente du type Postgres "DataNature" ` +
        `(${PG_DATA_NATURE_LABELS.join(", ")}). L'écriture serait refusée en base ` +
        "(22P02) : le type TS et le type SQL ont divergé.",
    );
  }

  return {
    rowNature: validated as DataNature,
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
 * `UPDATE "ShillCorrelationCandidate" SET "rowNature" = ...` sans clause
 * portant sur une ligne que le moteur vient de recalculer viole la règle de C.
 */
export const BACKFILL_IS_FORBIDDEN = true as const;
