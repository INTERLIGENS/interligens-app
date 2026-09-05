// --- BUILD 7 / S1 — LE CONSTRUCTEUR D'OBSERVATION -------------------------
//
// PUR. Le seul chemin par lequel une caractéristique entre dans le
// comparateur.
//
// ██ CE QUE L'APPELANT NE FOURNIT PAS, ET POURQUOI ██
//
//   nature, experimental, nominative  viennent du REGISTRE, jamais de
//   l'adaptateur. Sinon un adaptateur pourrait requalifier une INFERENCE en
//   PRIMARY_OBSERVATION, ou faire tomber le drapeau expérimental d'une sortie
//   PRE-SHILL, en passant simplement une autre valeur — et ce serait
//   indétectable en aval, puisque le résultat serait parfaitement bien formé.
//
// ██ CE QUI EST REFUSÉ ICI, PLUTÔT QUE DÉGRADÉ ██
//
// Toute construction non conforme LÈVE. Aucune valeur de substitution, aucun
// défaut silencieux : c'est un défaut implicite qui a produit les sept sites
// de mélange que Data Nature a dû reprendre. Une observation qu'on ne sait pas
// construire ne doit pas exister à moitié.

import type {
  EvidenceRef,
  FeatureCoverage,
  FeatureMethod,
  FeatureObservation,
  FeatureValue,
  ObservedSideState,
} from "./types";
import { specFor } from "./registry";
import { EmptyObservationError, assertPositiveContent } from "./invariants";

export class MalformedObservationError extends Error {
  constructor(featureKey: string, detail: string, where: string) {
    super(
      `[similarity] observation « ${featureKey} » mal formée (${where}) : ${detail}. ` +
        `Le constructeur REFUSE plutôt qu'il ne dégrade — une observation à moitié ` +
        `construite se compare aussi bien qu'une vraie, et c'est le problème.`,
    );
    this.name = "MalformedObservationError";
  }
}

export interface BuildFeatureObservationInput {
  featureKey: string;
  state: ObservedSideState;
  /** Requis SI ET SEULEMENT SI `state === "OBSERVED"`. */
  value?: FeatureValue | null;
  /** Requis SI ET SEULEMENT SI `state !== "OBSERVED"`. Une limite, pas une conclusion. */
  stateReason?: string | null;
  method: FeatureMethod;
  coverage: FeatureCoverage;
  evidence?: readonly EvidenceRef[];
}

/** Ensemble déterministe : dédupliqué et trié. Deux collectes qui rendent les
 *  mêmes identifiants dans un autre ordre ne doivent pas produire deux
 *  observations différentes. */
function normalizeSet(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim()))].sort();
}

export function buildFeatureObservation(
  input: BuildFeatureObservationInput,
  where = "buildFeatureObservation",
): FeatureObservation {
  const spec = specFor(input.featureKey, where);
  const state = input.state;

  // ── L'état gouverne tout le reste ───────────────────────────────────────
  if (state === "OBSERVED") {
    if (input.stateReason) {
      throw new MalformedObservationError(
        spec.key,
        "un motif d'état accompagne un état OBSERVED — le motif dit pourquoi il n'y a PAS de valeur",
        where,
      );
    }
  } else {
    if (input.value) {
      throw new MalformedObservationError(
        spec.key,
        `état « ${state} » accompagné d'une valeur — un état non observé qui transporte ` +
          `une valeur est la fusion que INV-1 interdit`,
        where,
      );
    }
    if (!input.stateReason || input.stateReason.trim() === "") {
      throw new MalformedObservationError(
        spec.key,
        `état « ${state} » sans motif : l'état seul ne dit pas laquelle des limites a joué`,
        where,
      );
    }
  }

  // ── CENSORED n'est pas une opinion : la couverture doit le porter ───────
  if (state === "CENSORED" && input.coverage.complete) {
    throw new MalformedObservationError(
      spec.key,
      "état CENSORED alors que la couverture se déclare complète — l'un des deux ment",
      where,
    );
  }
  if (!input.coverage.complete && !input.coverage.censoredBy?.trim()) {
    throw new MalformedObservationError(
      spec.key,
      "couverture incomplète sans dire ce qui a coupé (plafond de pages, budget, refus…)",
      where,
    );
  }
  if (input.coverage.complete && input.coverage.censoredBy) {
    throw new MalformedObservationError(
      spec.key,
      "couverture complète ET censurée — `censoredBy` n'est renseigné que si `complete` est faux",
      where,
    );
  }

  // ── La méthode doit être retrouvable, et ses paramètres présents ───────
  if (!input.method.ruleVersion.trim()) {
    throw new MalformedObservationError(spec.key, "ruleVersion vide", where);
  }
  for (const p of spec.requiredParameters) {
    if (!(p in input.method.parameters)) {
      throw new MalformedObservationError(
        spec.key,
        `paramètre de méthode « ${p} » manquant. Le registre l'exige parce que deux ` +
          `mesures rendues sous deux valeurs différentes ne se comparent pas, et que ` +
          `RIEN dans les valeurs ne le signalerait`,
        where,
      );
    }
  }

  // ── La valeur : sorte, contenu positif, vocabulaire ────────────────────
  let value: FeatureValue | null = null;
  if (state === "OBSERVED") {
    const raw = input.value;
    if (!raw) throw new EmptyObservationError(where, `« ${spec.key} » OBSERVED sans valeur`);
    if (raw.kind !== spec.kind) {
      throw new MalformedObservationError(
        spec.key,
        `valeur de sorte « ${raw.kind} » alors que le registre déclare « ${spec.kind} »`,
        where,
      );
    }
    value =
      raw.kind === "SET" ? { kind: "SET", values: normalizeSet(raw.values) } : raw;
    assertPositiveContent(value, `${where}/${spec.key}`);

    if (raw.kind === "ORDINAL" && raw.unit !== spec.unit) {
      throw new MalformedObservationError(
        spec.key,
        `unité « ${raw.unit} » alors que le registre déclare « ${String(spec.unit)} » — ` +
          `un nombre nu se relit faux`,
        where,
      );
    }
    if (spec.allowedValues) {
      const offenders =
        value.kind === "CATEGORICAL"
          ? spec.allowedValues.includes(value.value)
            ? []
            : [value.value]
          : value.kind === "SET"
            ? value.values.filter((v) => !spec.allowedValues!.includes(v))
            : [];
      if (offenders.length > 0) {
        throw new MalformedObservationError(
          spec.key,
          `valeur(s) hors du vocabulaire fermé du registre : ${offenders.join(", ")}`,
          where,
        );
      }
    }
  }

  // ── La preuve : exigée dès qu'on affirme quelque chose ─────────────────
  const evidence = input.evidence ?? [];
  if (state === "OBSERVED") {
    if (evidence.length === 0 || evidence.some((e) => e.refs.length === 0 || !e.kind.trim())) {
      throw new MalformedObservationError(
        spec.key,
        "OBSERVED sans preuve opposable — une caractéristique sans pointeur vers ses " +
          "pièces n'est pas une observation, seulement une affirmation",
        where,
      );
    }
  }

  return {
    featureKey: spec.key,
    family: spec.family,
    kind: spec.kind,
    state,
    value,
    stateReason: state === "OBSERVED" ? null : (input.stateReason ?? null),
    // ██ DU REGISTRE, JAMAIS DE L'APPELANT. ██
    nature: spec.nature,
    experimental: spec.experimental,
    nominative: spec.nominative,
    method: {
      methodRef: input.method.methodRef,
      ruleVersion: input.method.ruleVersion,
      parameters: { ...input.method.parameters },
    },
    coverage: {
      complete: input.coverage.complete,
      censoredBy: input.coverage.censoredBy ?? null,
      upstream: input.coverage.upstream,
    },
    evidence: evidence.map((e) => ({ kind: e.kind, refs: [...e.refs] })),
  };
}

/** Couverture complète, sans censure. Sucre pour les adaptateurs dont le
 *  moteur amont ne rapporte aucune borne. */
export function completeCoverage(upstream: Readonly<Record<string, unknown>>): FeatureCoverage {
  return { complete: true, censoredBy: null, upstream };
}
