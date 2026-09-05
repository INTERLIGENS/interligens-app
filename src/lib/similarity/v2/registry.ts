// --- BUILD 7 / @v2 — LE CONTRAT DE FEATURE ÉTENDU -------------------------
//
// PUR. Les MÊMES 17 features que @v1 — aucune n'est ajoutée, aucune retirée.
// Ce qui change, c'est ce que chacune DÉCLARE en plus :
//
//   aggregation                comment elle passe du GROUPE au SUJET (P0)
//   requiresAttribution        si elle nomme une adresse ou une entité (P3)
//   requiresTemporalResolution la finesse temporelle qu'elle exige (P2)
//   requiredSourceNature       la nature que ses lignes source doivent porter (P1)
//
// ██ POURQUOI CHAQUE RÈGLE D'AGRÉGATION EST DÉRIVÉE DU TEXTE DU REGISTRE ██
//
// Elle n'est pas choisie « au mieux » : elle se lit dans ce que la feature
// AFFIRME. `exit.distinct_subjects` dit « wallets DIFFÉRENTS dans le groupe » —
// donc la grandeur n'a pas de sens sujet. `exit.demonstrated_venue` dit « nommé
// SEULEMENT si tous les actes du groupe nomment le même » — l'unanimité est
// déjà exigée DANS le groupe, et un groupe qui la satisfait a démontré son
// venue ; l'exiger une seconde fois ENTRE les groupes serait ajouter une règle
// que rien ne soutient. `exit.composition_profile` décrit la composition d'un
// groupe : deux groupes de compositions différentes ne font pas un sujet à
// composition unique.
//
// ██ AUCUN VOTE MAJORITAIRE, NULLE PART. ██ Il n'existe pas de règle « la
// valeur la plus fréquente gagne » : ce serait un seuil déguisé — pourquoi 5/6
// et pas 4/6 ? — et il écraserait le groupe divergent. Voir INV-11.

import type { DataNature } from "@/lib/data-nature/nature";
import {
  SIMILARITY_FEATURE_KEYS,
  specFor as specForV1,
  type FeatureSpec,
} from "../registry";
import type { AggregationRule, TemporalResolution } from "./types";

export interface FeatureSpecV2 extends FeatureSpec {
  /** P0 — comment la feature passe du groupe au sujet. */
  aggregation: AggregationRule;
  /**
   * P3 — la valeur nomme une ADRESSE ou une ENTITÉ : une attribution est
   * exigée. Elle vaut UNATTRIBUTED tant que rien d'auditable ne dit ce que
   * l'identifiant est — et sur ce produit, c'est le cas par défaut.
   */
  requiresAttribution: boolean;
  /** P2 — la finesse temporelle exigée, ou `null` si la feature n'en dépend pas. */
  requiresTemporalResolution: TemporalResolution | null;
  /**
   * P1 — la nature que les LIGNES SOURCE doivent porter pour soutenir la
   * feature. `null` quand la feature ne dérive d'aucune ligne persistée.
   */
  requiredSourceNature: DataNature | null;
  /** Pourquoi CETTE règle d'agrégation, en clair. */
  aggregationRationale: string;
}

interface Delta {
  aggregation: AggregationRule;
  requiresAttribution?: boolean;
  requiresTemporalResolution?: TemporalResolution | null;
  requiredSourceNature?: DataNature | null;
  aggregationRationale: string;
  /** @v2 étend le vocabulaire fermé d'une seule feature — voir P2. */
  allowedValues?: readonly string[];
}

const DELTAS: Readonly<Record<string, Delta>> = {
  "identity.token_resolution_status": {
    aggregation: "SUBJECT_LEVEL",
    requiredSourceNature: "INFERENCE",
    aggregationRationale: "la résolution d'identité est du niveau sujet — il n'y a pas de groupe",
  },
  "identity.chain_demonstrated": {
    aggregation: "SUBJECT_LEVEL",
    aggregationRationale: "démontrée par l'espace d'adressage du mint, sans aucune collecte",
  },
  "temporal.anchor_provenance": {
    aggregation: "SUBJECT_LEVEL",
    requiredSourceNature: "INFERENCE",
    // ██ P2 — `date_only` ENTRE au vocabulaire. ██ Le corpus le porte sur
    // 5 lignes sur 5, et @v1 le refusait — une valeur réelle qu'on ne pouvait
    // pas dire. Elle entre comme PROVENANCE D'ANCRE, ce qu'elle est ; elle
    // n'autorise aucune heure, et `TemporalDetail` l'interdit mécaniquement.
    allowedValues: ["snowflake", "source_timestamp", "date_only"],
    requiresTemporalResolution: null,
    aggregationRationale: "l'ancre d'un post est du niveau sujet",
  },
  "temporal.exit_cluster_span_seconds": {
    aggregation: "PER_GROUP_MAGNITUDE",
    aggregationRationale:
      "« du premier au dernier acte DU GROUPE » — une somme, une moyenne ou un " +
      "maximum sur plusieurs groupes fabriquerait une durée que rien n'a mesurée",
  },
  "temporal.exit_cluster_min_gap_seconds": {
    aggregation: "PER_GROUP_MAGNITUDE",
    aggregationRationale: "le plus petit écart est une propriété du groupe, pas du sujet",
  },
  "funding.shared_funder_addresses": {
    aggregation: "SUBJECT_LEVEL",
    requiresAttribution: true,
    requiredSourceNature: "PRIMARY_OBSERVATION",
    aggregationRationale:
      "les bailleurs se calculent sur l'ensemble des wallets nommés par l'appelant, " +
      "quel qu'en soit le découpage en groupes",
  },
  "funding.relationship_categories": {
    aggregation: "SUBJECT_LEVEL",
    requiredSourceNature: "PRIMARY_OBSERVATION",
    aggregationRationale: "qualification appliquée aux relations du sujet, pas d'un groupe",
  },
  "funding.external_funder_count": {
    aggregation: "SUBJECT_LEVEL",
    requiredSourceNature: "PRIMARY_OBSERVATION",
    aggregationRationale: "décompte défini sur la population de sujets fournie",
  },
  "shill.promotion_qualification": {
    aggregation: "SUBJECT_LEVEL",
    requiredSourceNature: "INFERENCE",
    aggregationRationale: "issue d'un prédicat appliqué à un post, rattaché au sujet",
  },
  "shill.kol_handles": {
    aggregation: "SUBJECT_LEVEL",
    requiredSourceNature: "PRIMARY_OBSERVATION",
    aggregationRationale: "ensemble de comptes rattachés au sujet",
  },
  "exit.cluster_category": {
    aggregation: "ALL_OR_NOTHING",
    aggregationRationale:
      "la catégorie décrit la FORME d'un groupe ; dire qu'un sujet « est » de cette " +
      "catégorie n'a de sens que si tous ses groupes le sont",
  },
  "exit.demonstrated_venue": {
    aggregation: "DEMONSTRATED_BY_ANY",
    // ██ P3 — « RAYDIUM » est un nom DÉCLARÉ PAR LA SOURCE, pas une entité
    // vérifiée. L'attribution le dit (DECLARED_BY_SOURCE) au lieu de laisser le
    // lecteur croire à une identification.
    requiresAttribution: true,
    aggregationRationale:
      "l'unanimité est DÉJÀ exigée à l'intérieur du groupe ; un groupe qui la " +
      "satisfait a démontré son venue, et l'exiger une seconde fois entre les " +
      "groupes ajouterait une règle que rien ne soutient",
  },
  "exit.demonstrated_destination": {
    aggregation: "DEMONSTRATED_BY_ANY",
    requiresAttribution: true,
    aggregationRationale: "même raison que le venue : l'unanimité est déjà interne au groupe",
  },
  "exit.distinct_subjects": {
    aggregation: "PER_GROUP_MAGNITUDE",
    aggregationRationale:
      "« wallets DIFFÉRENTS DANS LE GROUPE » — l'union sur plusieurs groupes est " +
      "une AUTRE grandeur, que le contrat ne déclare pas",
  },
  "exit.composition_profile": {
    aggregation: "ALL_OR_NOTHING",
    aggregationRationale:
      "deux groupes de compositions différentes ne font pas un sujet à composition " +
      "unique ; retenir la plus fréquente serait un vote majoritaire",
  },
  "exit.materiality": {
    aggregation: "PER_GROUP_MAGNITUDE",
    aggregationRationale: "part du solde antérieur, définie par groupe et jamais mesurée",
  },
  "preshill.front_run_wallets": {
    aggregation: "SUBJECT_LEVEL",
    requiresAttribution: true,
    requiredSourceNature: "PRIMARY_OBSERVATION",
    aggregationRationale: "récurrence calculée sur les occasions du sujet",
  },
};

const SPECS_V2: readonly FeatureSpecV2[] = SIMILARITY_FEATURE_KEYS.map((key) => {
  const base = specForV1(key, "registry-v2");
  const d = DELTAS[key];
  if (!d) throw new Error(`[similarity/v2] feature @v1 sans delta @v2 déclaré : ${key}`);
  return {
    ...base,
    ...(d.allowedValues ? { allowedValues: d.allowedValues } : {}),
    aggregation: d.aggregation,
    requiresAttribution: d.requiresAttribution ?? false,
    requiresTemporalResolution: d.requiresTemporalResolution ?? null,
    requiredSourceNature: d.requiredSourceNature ?? null,
    aggregationRationale: d.aggregationRationale,
  };
});

export const SIMILARITY_FEATURE_REGISTRY_V2: Readonly<Record<string, FeatureSpecV2>> =
  Object.freeze(Object.fromEntries(SPECS_V2.map((s) => [s.key, s])));

/** Les mêmes clés que @v1, dans le même ordre. Un test le fixe. */
export const SIMILARITY_FEATURE_KEYS_V2: readonly string[] = SPECS_V2.map((s) => s.key);

export class UnknownFeatureV2Error extends Error {
  constructor(key: string, where: string) {
    super(
      `[similarity/v2] feature inconnue « ${key} » (${where}). Le registre @v2 est ` +
        `FERMÉ et porte exactement les 17 clés de @v1 : @v2 corrige la méthode, ` +
        `il n'élargit pas le contrat.`,
    );
    this.name = "UnknownFeatureV2Error";
  }
}

export function specForV2(key: string, where = "specForV2"): FeatureSpecV2 {
  const s = SIMILARITY_FEATURE_REGISTRY_V2[key];
  if (!s) throw new UnknownFeatureV2Error(key, where);
  return s;
}
