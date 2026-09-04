// --- B4.5 — LA NATURE D'UN ShillEvent DÉRIVÉ, ÉCRITE PAR LE CHOKEPOINT ----
//
// ██ CE QUE LA LIGNE AFFIRME ██
//
// Un ShillEvent produit par le bridge dit : « ce post est une promotion
// exploitable de ce token ». Ce n'est pas une observation — le post, lui, en
// est une. C'est le RÉSULTAT d'un prédicat de qualification appliqué à ce
// post, puis d'une résolution d'identité. Q3 : la nature est celle de la
// DERNIÈRE OPÉRATION, jamais celle des entrées. Donc INFERENCE.
//
// ─── LE FRAGMENT PASSE PAR S6, COMME CELUI DES CANDIDATS ─────────────────
//
// `assertNatureWritable` refuse une nature absente ou invalide, un artefact du
// corpus mixte, et toute remontée d'échelle (I1). Le contrôle de cohérence
// avec le registre suit : si un jour la table cessait d'être déclarée
// INFERENCE, l'écriture s'arrêterait au lieu de choisir en silence.
//
// ─── LES DEUX CHECK DE LA BASE, ET CE QU'ILS EXIGENT ─────────────────────
//
//   shillevent_rownature_declared_chk   rowNature IS NULL OR = 'INFERENCE'
//   shillevent_rownature_auditable_chk  rowNature IS NULL OR (
//                                         naturePolicyVersion non vide
//                                         AND natureBasis objet non vide )
//
// Le second est la raison d'être de `naturePolicyVersion` : une nature sans sa
// piste d'audit est exactement ce que ces colonnes existent pour empêcher. Le
// fragment est donc construit de façon à satisfaire les deux — et un prédicat
// exécutable (`satisfiesShillEventNatureChecks`) le vérifie côté application,
// pour que l'échec se voie en test plutôt qu'au premier INSERT réel.
//
// AUCUNE ÉCRITURE ICI. Ce module construit et valide un fragment ; c'est
// l'appelant qui décide de le persister — et le bridge reste `dryRun` par
// défaut.

import {
  assertNatureWritable,
  type NatureWriteTarget,
} from "@/lib/data-nature/writeGuard";
import { natureForTable } from "@/lib/data-nature/registry";
import {
  buildInferenceEnvelope,
  type InferenceBasis,
} from "@/lib/data-nature/inferenceEnvelope";
import { SOCIAL_PROMOTION_QUALIFY_V1 } from "@/lib/methodology/registry";
import type { DataNature, NatureValue } from "@/lib/data-nature/nature";
import type { PromotionQualification } from "./qualify";
import type { TokenIdentityResolution } from "./tokenIdentity";

export const SHILL_EVENT_TABLE = "ShillEvent";

/**
 * VERSION DE POLITIQUE de l'événement dérivé.
 *
 * Distincte de `ENGINE_POLICY_VERSION` (le moteur de corrélation v2) : ce
 * n'est pas la même décision qui est versionnée. Ici c'est la chaîne
 * qualification + résolution qui produit la ligne ; là c'est le scoring.
 * Les confondre ferait croire qu'un changement de seuil du moteur invalide
 * des événements qu'il n'a pas produits.
 *
 * Non vide, toujours — le CHECK auditable l'exige.
 */
export const SHILL_EVENT_POLICY_VERSION = "shill-forward-bridge@v1";

/** Réserves méthodologiques, portées par CHAQUE inférence jusqu'en base. */
export const SHILL_EVENT_RESERVATIONS = [
  "mention_is_not_promotion",
  "precision_over_recall_v1_conservative",
  "single_ticker_is_a_launch_guard_not_a_universal_truth",
  "no_invented_ticker_to_contract_association",
  "qualification_is_not_proof_of_manipulation",
] as const;

/** Ce que le writer a besoin de savoir du post source. Rien de plus. */
export interface ShillEventNatureSource {
  /** Identité de la ligne `social_post_candidates`. */
  sourcePostCandidateId: string;
  postId: string | null;
  postUrl?: string | null;
  postedAtUtc: Date | null;
  /** Empreintes de capture, SI le candidat est lié à un `social_posts`. */
  screenshotSha256?: string | null;
  htmlSha256?: string | null;
}

export interface ShillEventNatureWrite {
  rowNature: DataNature;
  natureBasis: InferenceBasis;
  naturePolicyVersion: string;
}

/** L'état de nature d'une ligne DÉJÀ en base, relu avant d'écrire (arme I1). */
export interface ExistingShillEventNature {
  id?: string | null;
  rowNature?: NatureValue | null;
}

/**
 * CONSTRUIT LE FRAGMENT, ET LE FAIT VALIDER PAR LE CHOKEPOINT.
 *
 * `existing` n'est pas décoratif : c'est ce qui arme I1. L'omettre revient à
 * écrire sans savoir ce qu'on écrase.
 */
export function buildShillEventNatureWrite(
  input: {
    source: ShillEventNatureSource;
    qualification: PromotionQualification;
    resolution: TokenIdentityResolution;
  },
  existing: ExistingShillEventNature = {},
  where = "shill/eventNature.buildShillEventNatureWrite",
): ShillEventNatureWrite {
  // ── L'ENVELOPPE CANONIQUE (B4.2) ────────────────────────────────────────
  // Le post source est la seule PRIMARY_OBSERVATION. La qualification et la
  // résolution sont des étapes DÉCRITES — jamais aplaties en jeton de nature :
  // l'inférence n'est pas sa propre preuve.
  const refs: Record<string, unknown> = {
    sourcePostCandidateId: input.source.sourcePostCandidateId,
    postId: input.source.postId,
  };
  if (input.source.postUrl) refs.postUrl = input.source.postUrl;
  if (input.source.postedAtUtc) refs.postedAtUtc = input.source.postedAtUtc.toISOString();
  // Les empreintes de capture ne sont jointes que si elles existent : le
  // candidat n'est pas toujours lié à un `social_posts`. Les inventer serait
  // affirmer une chaîne de custody qu'on n'a pas.
  if (input.source.screenshotSha256) refs.screenshotSha256 = input.source.screenshotSha256;
  if (input.source.htmlSha256) refs.htmlSha256 = input.source.htmlSha256;

  const env = buildInferenceEnvelope(
    {
      primaryObservations: [{ kind: "social_post", refs, count: 1 }],
      methodology: {
        methodRef: SOCIAL_PROMOTION_QUALIFY_V1,
        outcome: {
          qualified: input.qualification.qualified,
          reason: input.qualification.reason,
          criteria: input.qualification.criteria,
          conservative: input.qualification.conservative,
        },
      },
      resolution: {
        status: input.resolution.resolutionStatus,
        evidence: input.resolution.evidence,
      },
      reservations: [...SHILL_EVENT_RESERVATIONS],
      policyVersion: SHILL_EVENT_POLICY_VERSION,
    },
    where,
  );

  // ── LE CHOKEPOINT S6 ────────────────────────────────────────────────────
  const target: NatureWriteTarget = {
    id: existing.id ?? null,
    // Un ShillEvent n'est pas une pièce : pas de sha256 d'artefact.
    sha256: null,
    ref: `${SHILL_EVENT_TABLE}(${input.source.sourcePostCandidateId})`,
    currentNature: existing.rowNature ?? null,
  };
  const validated = assertNatureWritable(
    target,
    { nature: env.nature, natureBasis: env.basis, scope: "row" },
    where,
  );

  // Défense en profondeur : le registre déclare la table mono-nature
  // INFERENCE (B4.3). Si les deux divergent un jour, on s'arrête — on ne
  // choisit pas en silence.
  const declared = natureForTable(SHILL_EVENT_TABLE);
  if (validated !== declared) {
    throw new Error(
      `[shill] nature ${validated} incompatible avec la nature DÉCLARÉE de ` +
        `${SHILL_EVENT_TABLE} (${declared}). Le registre et le writer doivent dire la ` +
        "même chose ; l'un des deux a changé sans l'autre.",
    );
  }

  return {
    rowNature: validated as DataNature,
    natureBasis: env.basis,
    naturePolicyVersion: SHILL_EVENT_POLICY_VERSION,
  };
}

/**
 * LES DEUX CHECK DE LA BASE, REJOUÉS CÔTÉ APPLICATION.
 *
 * Non pas pour les remplacer — la base reste l'autorité — mais pour que leur
 * violation se voie en TEST plutôt qu'au premier INSERT réel. Un fragment qui
 * échouerait ici échouerait en base ; l'inverse n'est pas garanti, et c'est
 * assumé : ce prédicat est une alarme précoce, pas une seconde vérité.
 */
export function satisfiesShillEventNatureChecks(fragment: {
  rowNature?: unknown;
  natureBasis?: unknown;
  naturePolicyVersion?: unknown;
}): { declared: boolean; auditable: boolean; ok: boolean } {
  const n = fragment.rowNature;

  // Branche NULL : c'est l'état legacy, explicitement autorisé par les DEUX
  // CHECK. Les 221 lignes existantes passent par là.
  if (n == null) return { declared: true, auditable: true, ok: true };

  const declared = n === "INFERENCE";

  const v = fragment.naturePolicyVersion;
  const b = fragment.natureBasis;
  const auditable =
    typeof v === "string" &&
    v.length > 0 &&
    b != null &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b as object).length > 0;

  return { declared, auditable, ok: declared && auditable };
}
