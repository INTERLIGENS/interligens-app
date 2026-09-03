// --- B4.2 — L'ENVELOPPE D'INFÉRENCE : le résultat n'est pas son input ------
//
// ██ LE DÉFAUT QUE CE MODULE FERME ██
//
// `buildInferenceEnvelope` écrivait `natureBasis = ["PRIMARY_OBSERVATION",
// "INFERENCE"]` dès que le résolveur de token avait tranché. Le raisonnement
// paraissait juste — « une étape amont était un calcul, donc INFERENCE fait
// partie des entrées ». Il ne l'est pas.
//
// Le basis décrit CE QUI PERMET l'inférence. Y inscrire `INFERENCE` présente
// le résultat comme sa propre preuve : à la relecture, la ligne dit « cette
// inférence est fondée, entre autres, sur une inférence » — laquelle ? la
// sienne ? une autre ? Rien ne le dit, et c'est précisément ce qu'un basis
// existe pour dire.
//
// LA CORRECTION N'EST PAS DE RETIRER LE MOT. Une étape dérivée en amont est un
// fait réel, et le taire appauvrirait le basis. Elle est décrite
// STRUCTURELLEMENT — sous son nom, avec sa méthode et son verdict — au lieu
// d'être aplatie en un jeton de nature :
//
//   inputs.primaryObservations  ce qu'on a observé soi-même
//   inputs.methodology          la règle appliquée, par methodRef résolvable
//   inputs.resolution           l'étape de résolution, son statut, sa preuve
//   inputs.additional           les autres sources, avec LEUR nature
//
// `inputNatures` ne liste donc que les natures de SOURCES. `INFERENCE` y est
// refusé par le code, pas seulement déconseillé par un commentaire.
//
// AUCUN BACKFILL. Les lignes déjà écrites gardent leur ancien format ; seules
// les nouvelles écritures passent par ici. Une enveloppe n'est pas une
// migration.

import { isValidMethodRef } from "./methodRef";
import type { DataNature } from "./nature";

/** Les natures qu'une SOURCE peut porter. `INFERENCE` en est exclue. */
export type SourceNature = Exclude<DataNature, "INFERENCE">;

export interface PrimaryObservationInput {
  /** Ce qu'on a observé : `social_post`, `shill_occasion`, `onchain_buy`… */
  kind: string;
  /** Les références qui permettent d'y retourner. Jamais un résumé. */
  refs: Readonly<Record<string, unknown>>;
  /** Combien d'unités, quand le nombre porte du sens. */
  count?: number;
}

export interface MethodologyInput {
  /**
   * DOIT respecter la grammaire canonique `<methodologie>/<composant>@v<N>`.
   * Un ref mal formé est refusé ici : une règle qu'on ne peut pas retrouver
   * ne documente rien.
   */
  methodRef: string;
  /** Détail du verdict rendu par la règle, s'il éclaire la lecture. */
  outcome?: Readonly<Record<string, unknown>>;
}

export interface ResolutionInput {
  /** Statut canonique de résolution (`resolved_from_tweet`, `unresolved_ticker`…). */
  status: string;
  /** Ce qui a permis — ou empêché — la résolution. */
  evidence?: string;
}

export interface AdditionalInput {
  nature: SourceNature;
  kind: string;
  refs?: Readonly<Record<string, unknown>>;
}

export interface BuildInferenceEnvelopeArgs {
  primaryObservations: readonly PrimaryObservationInput[];
  methodology: MethodologyInput;
  resolution?: ResolutionInput;
  additionalInputs?: readonly AdditionalInput[];
  reservations?: readonly string[];
  policyVersion?: string;
}

export interface InferenceBasis {
  inputs: {
    primaryObservations: readonly PrimaryObservationInput[];
    methodology: MethodologyInput;
    resolution?: ResolutionInput;
    additional?: readonly AdditionalInput[];
  };
  /**
   * Natures des SOURCES uniquement. `INFERENCE` n'y figure jamais — le
   * résultat n'est pas une de ses entrées.
   */
  inputNatures: readonly SourceNature[];
  reservations: readonly string[];
  /** Version du format d'enveloppe, distincte de la version de politique. */
  envelopeVersion: string;
}

export interface InferenceEnvelopeV2 {
  nature: "INFERENCE";
  basis: InferenceBasis;
  policyVersion?: string;
}

export const INFERENCE_ENVELOPE_VERSION = "inference-envelope@v2";

export class InferenceAsOwnBasisError extends Error {
  constructor(where: string) {
    super(
      `[data-nature] ${where} : INFERENCE ne peut pas figurer dans le basis d'une ` +
        "INFERENCE. Le basis décrit ce qui PERMET l'inférence, pas l'inférence " +
        "elle-même. Une étape dérivée en amont se décrit sous `resolution` ou " +
        "`methodology`, avec son methodRef et son verdict — pas en jeton de nature.",
    );
    this.name = "InferenceAsOwnBasisError";
  }
}

export class UnresolvableMethodRefError extends Error {
  constructor(ref: string) {
    super(
      `[data-nature] methodRef « ${ref} » ne respecte pas la grammaire canonique ` +
        "`<methodologie>/<composant>@v<N>`. Une règle qu'on ne peut pas retrouver " +
        "ne documente rien.",
    );
    this.name = "UnresolvableMethodRefError";
  }
}

/**
 * CONSTRUIT L'ENVELOPPE. Une seule forme, pour tous les producteurs
 * d'inférence du produit.
 *
 * Deux refus, et ils sont dans le code parce qu'un commentaire ne se teste pas :
 *   · `INFERENCE` dans les natures de sources ;
 *   · un `methodRef` hors grammaire canonique.
 */
export function buildInferenceEnvelope(
  args: BuildInferenceEnvelopeArgs,
  where = "buildInferenceEnvelope",
): InferenceEnvelopeV2 {
  if (!isValidMethodRef(args.methodology.methodRef)) {
    throw new UnresolvableMethodRefError(args.methodology.methodRef);
  }

  const natures = new Set<SourceNature>();
  if (args.primaryObservations.length > 0) natures.add("PRIMARY_OBSERVATION");
  for (const a of args.additionalInputs ?? []) {
    // Défense en profondeur : le type l'interdit déjà, mais une valeur venue
    // d'un `any` ou d'un cast passerait au travers du compilateur.
    if ((a.nature as string) === "INFERENCE") throw new InferenceAsOwnBasisError(where);
    natures.add(a.nature);
  }

  return {
    nature: "INFERENCE",
    basis: {
      inputs: {
        primaryObservations: args.primaryObservations,
        methodology: args.methodology,
        ...(args.resolution ? { resolution: args.resolution } : {}),
        ...(args.additionalInputs?.length ? { additional: args.additionalInputs } : {}),
      },
      inputNatures: [...natures].sort(),
      reservations: args.reservations ?? [],
      envelopeVersion: INFERENCE_ENVELOPE_VERSION,
    },
    ...(args.policyVersion ? { policyVersion: args.policyVersion } : {}),
  };
}

/** Vrai si un basis présente l'inférence comme sa propre preuve. */
export function basisClaimsInferenceAsInput(basis: unknown): boolean {
  if (!basis || typeof basis !== "object") return false;
  const b = basis as { inputNatures?: unknown; natureBasis?: unknown };
  const lists = [b.inputNatures, b.natureBasis].filter(Array.isArray) as unknown[][];
  return lists.some((l) => l.includes("INFERENCE"));
}
