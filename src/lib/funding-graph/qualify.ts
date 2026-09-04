// --- BUILD 5 — QUALIFICATION D'UNE RELATION DE FINANCEMENT ----------------
//
// PURE. Aucun réseau, aucune base.
//
// ██ TROIS COUCHES, ET ELLES NE SE TOUCHENT PAS ██
//
//   OBSERVATION    l'arête — PRIMARY_OBSERVATION, un transfert constaté
//   QUALIFICATION  ce module — une INFERENCE, une règle appliquée
//   INTERPRÉTATION « coordination », « insider » — HORS DE CE BUILD
//
// « Même bailleur » n'est pas un fait homogène. Un hot wallet d'exchange
// finance des milliers d'inconnus chaque jour ; une adresse privée qui finance
// deux wallets quelques minutes avant un lancement est un fait d'une autre
// nature. Les confondre rendrait le cas fort indiscernable du cas banal — et
// c'est le cas banal qui domine numériquement.
//
// La règle gelée : content/methodologies/funding-relationship/v1.md.

import {
  buildInferenceEnvelope,
  type InferenceEnvelopeV2,
} from "@/lib/data-nature/inferenceEnvelope";
import type { FundingEdge } from "./types";

export const FUNDING_RELATIONSHIP_METHOD_REF = "funding-relationship/qualify@v1";
export const FUNDING_RELATIONSHIP_POLICY_VERSION = "funding-relationship@v1";

// ═══ LE PLANCHER D'OPÉRATION — DÉRIVÉ, JAMAIS CHOISI ══════════════════════
//
// Ce ne sont pas des réglages : ce sont des paramètres du protocole Solana.
// Un seuil rond — 0,001 SOL, 0,01 SOL — aurait été un choix, donc discutable
// sans fin. Celui-ci se recalcule.

/** Surcharge de stockage d'un compte, en octets. */
export const ACCOUNT_STORAGE_OVERHEAD_BYTES = 128;
/** Lamports par octet et par an. */
export const LAMPORTS_PER_BYTE_YEAR = 3_480;
/** Années couvertes par l'exemption de loyer. */
export const RENT_EXEMPTION_THRESHOLD_YEARS = 2;
/** Frais d'une signature de transaction. */
export const LAMPORTS_PER_SIGNATURE = 5_000;

/** Loyer d'exemption d'un compte système sans données : 890 880 lamports. */
export const RENT_EXEMPT_MINIMUM_LAMPORTS =
  ACCOUNT_STORAGE_OVERHEAD_BYTES * LAMPORTS_PER_BYTE_YEAR * RENT_EXEMPTION_THRESHOLD_YEARS;

/**
 * ██ LE PLANCHER : 895 880 lamports. ██
 *
 * Ce qu'il faut pour qu'un wallet EXISTE et agisse UNE FOIS. En dessous, le
 * destinataire ne peut ni ouvrir son compte ni signer : le transfert
 * n'établit mécaniquement aucune capacité d'action.
 *
 * C'est délibérément le plancher le PLUS FAIBLE défendable. Il n'affirme rien
 * sur ce qui serait économiquement significatif — cette question demanderait
 * une définition que ce build n'a pas mandat de poser.
 */
export const DUST_FLOOR_LAMPORTS = RENT_EXEMPT_MINIMUM_LAMPORTS + LAMPORTS_PER_SIGNATURE;

export type FundingRelationshipCategory =
  | "DUST"
  | "SELF_OR_KNOWN_ACTOR"
  | "KNOWN_EXCHANGE"
  | "PRIVATE_SHARED_FUNDER"
  | "UNKNOWN";

/**
 * Une étiquette d'adresse, AVEC sa provenance.
 *
 * `auditable` n'est pas un confort : une étiquette non sourçable laisserait
 * l'annotation d'un tiers décider comment INTERLIGENS lit ses propres preuves.
 * Non auditable ⇒ traitée comme absente.
 */
export interface AddressLabelInput {
  address: string;
  label: string;
  isExchange: boolean;
  auditable: boolean;
  /** D'où vient l'étiquette. Requis pour qu'elle compte. */
  provenance?: string;
}

/** L'état de la collecte qui a produit les arêtes. */
export interface CoverageInput {
  /** `false` dès qu'une borne a coupé : plafond de pages, budget, refus. */
  complete: boolean;
  /** Ce qui a coupé, quand quelque chose a coupé. */
  censoredBy?: string;
  subjectsAttempted?: number;
  subjectsCovered?: number;
}

export interface QualifyFundingRelationshipInput {
  funder: string;
  /** Les sujets que ce bailleur a atteints. Dédupliqués par l'appelant ou ici. */
  subjectsReached: readonly string[];
  /** Les arêtes qui le prouvent. Toutes PRIMARY_OBSERVATION. */
  edges: readonly FundingEdge[];
  addressLabel?: AddressLabelInput | null;
  /** Acteurs déjà identifiés dans l'affaire (sujets, KolWallet, deployer…). */
  knownActors?: readonly string[];
  coverage: CoverageInput;
}

export interface QualifiedFundingRelationship {
  funder: string;
  category: FundingRelationshipCategory;
  /** Pourquoi CETTE catégorie, en clair. Une catégorie sans motif est opaque. */
  reason: string;
  evidence: {
    subjectsReached: string[];
    edgeCount: number;
    totalLamports: number;
    /** Signatures : la preuve opposable, jamais agrégée. */
    txSignatures: string[];
    earliestBlockTimeSeconds: number | null;
    latestBlockTimeSeconds: number | null;
  };
  coverage: CoverageInput & {
    /**
     * ██ Sous couverture censurée, le résultat est un PLANCHER. ██
     * Jamais « pas de relation » : une absence sous collecte bornée
     * n'établit rien, et la rendre comme négatif convertirait une limite de
     * budget en fait sur le monde.
     */
    resultIsFloor: boolean;
  };
  natureBasis: InferenceEnvelopeV2;
}

/**
 * Qualifie UN bailleur. Ordre d'évaluation fixe — voir l'artefact gelé.
 *
 * L'ordre place DUST puis SELF avant KNOWN_EXCHANGE, et KNOWN_EXCHANGE avant
 * PRIVATE_SHARED_FUNDER : à chaque embranchement, c'est la lecture la plus
 * FAIBLE qui l'emporte. Un classement qui pencherait dans l'autre sens
 * produirait des signaux forts par construction.
 */
export function qualifyFundingRelationship(
  input: QualifyFundingRelationshipInput,
): QualifiedFundingRelationship {
  const subjects = [...new Set(input.subjectsReached)];
  const edges = input.edges;
  const totalLamports = edges.reduce((s, e) => s + e.amountLamports, 0);
  const times = edges.map((e) => e.blockTimeSeconds);
  const known = new Set(input.knownActors ?? []);
  const label = input.addressLabel ?? null;

  // Une étiquette non auditable est ABSENTE. Pas « à moitié valable ».
  const usableLabel =
    label && label.auditable && label.provenance
      ? { ...label, provenance: label.provenance }
      : null;
  const labelWasDiscarded = !!label && !usableLabel;

  let category: FundingRelationshipCategory;
  let reason: string;

  if (edges.length === 0) {
    category = "UNKNOWN";
    reason = "aucune arête fournie — rien à qualifier";
  } else if (totalLamports < DUST_FLOOR_LAMPORTS) {
    category = "DUST";
    reason =
      `total ${totalLamports} lamports sous le plancher d'opération ` +
      `${DUST_FLOOR_LAMPORTS} (rent-exemption ${RENT_EXEMPT_MINIMUM_LAMPORTS} + ` +
      `une signature ${LAMPORTS_PER_SIGNATURE})`;
  } else if (subjects.includes(input.funder) || known.has(input.funder)) {
    category = "SELF_OR_KNOWN_ACTOR";
    reason = subjects.includes(input.funder)
      ? "le bailleur est lui-même un sujet — fait sur la population, pas une source externe"
      : "le bailleur est un acteur déjà identifié dans l'affaire";
  } else if (usableLabel?.isExchange) {
    category = "KNOWN_EXCHANGE";
    reason =
      `étiquette exchange « ${usableLabel.label} » à provenance auditable ` +
      `(${usableLabel.provenance}) — observation valide, valeur probante faible`;
  } else if (subjects.length >= 2) {
    category = "PRIVATE_SHARED_FUNDER";
    reason = labelWasDiscarded
      ? `${subjects.length} sujets atteints ; l'étiquette présente n'est pas auditable, donc écartée`
      : `${subjects.length} sujets atteints, ni poussière, ni sujet, ni exchange étiqueté`;
  } else {
    category = "UNKNOWN";
    reason = labelWasDiscarded
      ? "un seul sujet atteint, et l'étiquette présente n'est pas auditable"
      : "un seul sujet atteint — insuffisant pour une relation partagée";
  }

  const natureBasis = buildInferenceEnvelope(
    {
      primaryObservations: [
        {
          kind: "funding_edge",
          count: edges.length,
          refs: {
            funder: input.funder,
            subjectsReached: subjects,
            txSignatures: edges.map((e) => e.txSignature),
            totalLamports,
          },
        },
      ],
      methodology: {
        methodRef: FUNDING_RELATIONSHIP_METHOD_REF,
        outcome: { category, reason },
      },
      // L'étiquette n'entre au basis que si elle a COMPTÉ. L'y mettre quand
      // elle a été écartée laisserait croire qu'elle a porté la décision.
      additionalInputs: usableLabel
        ? [
            {
              // THIRD_PARTY_DATA, pas PRIMARY_OBSERVATION : une étiquette
              // d'adresse est l'affirmation d'un tiers. La ranger parmi nos
              // observations lui donnerait une autorité qu'elle n'a pas.
              nature: "THIRD_PARTY_DATA" as const,
              kind: "address_label",
              refs: {
                address: usableLabel.address,
                label: usableLabel.label,
                provenance: usableLabel.provenance,
              },
            },
          ]
        : [],
      reservations: [
        "QUALIFICATION IS NOT INTERPRETATION — no coordination, insider or fraud finding is produced.",
        ...(input.coverage.complete
          ? []
          : [
              `COVERAGE CENSORED (${input.coverage.censoredBy ?? "unspecified"}) — result is a FLOOR, never an absence of relationship.`,
            ]),
        ...(labelWasDiscarded
          ? ["ADDRESS LABEL DISCARDED — present but not auditable, treated as absent."]
          : []),
      ],
      policyVersion: FUNDING_RELATIONSHIP_POLICY_VERSION,
    },
    "qualifyFundingRelationship",
  );

  return {
    funder: input.funder,
    category,
    reason,
    evidence: {
      subjectsReached: subjects,
      edgeCount: edges.length,
      totalLamports,
      txSignatures: edges.map((e) => e.txSignature),
      earliestBlockTimeSeconds: times.length ? Math.min(...times) : null,
      latestBlockTimeSeconds: times.length ? Math.max(...times) : null,
    },
    coverage: { ...input.coverage, resultIsFloor: !input.coverage.complete },
    natureBasis,
  };
}
