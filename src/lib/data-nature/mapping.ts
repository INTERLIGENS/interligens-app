// ─── S1 — Correspondance des vocabulaires existants → DataNature ────────────
//
// Le dépôt porte HUIT vocabulaires qui disent partiellement la nature. Aucun
// n'est promu : ils sont CONSERVÉS localement (leurs consommateurs ne bougent
// pas) et MAPPÉS vers DataNature. La raison est unique et vaut pour les huit :
// ils écrasent NATURE, MÉTHODE et SOURCE sur un seul axe. `MmAttribMethod`
// range ARKHAM (un tiers), OSINT (une méthode) et INFERRED_CLUSTER (une nature)
// dans la même énumération. Promouvoir l'un d'eux figerait la confusion.
//
// Trois verdicts possibles par valeur, et la distinction est opérationnelle :
//   DIRECT      → mappable seule, un backfill peut la lire
//   NEEDS_JOIN  → NON mappable seule ; il faut une jointure. Tout UPDATE global
//                 qui l'ignorerait se tromperait sur une partie des lignes.
//   OTHER_AXIS  → ne décrit pas la nature (voir ingestionMode ci-dessous)

import type { DataNature } from "./nature";

export type MappingVerdict =
  | { kind: "DIRECT"; nature: DataNature; note?: string }
  | { kind: "NEEDS_JOIN"; join: string; resolve: string; note?: string }
  | { kind: "OTHER_AXIS"; axis: "ingestionMode"; note: string };

export interface VocabularyMapping {
  /** Où vit le vocabulaire. */
  source: string;
  /** enum Postgres typé, ou colonne texte libre. */
  form: "pg_enum" | "text";
  /** Peut-il être retiré une fois DataNature en place ? */
  supersedable: "yes" | "no" | "partial";
  supersedeNote: string;
  values: Record<string, MappingVerdict>;
}

export const VOCABULARY_MAPPINGS: VocabularyMapping[] = [
  {
    source: "KolWallet.claimType",
    form: "text",
    supersedable: "yes",
    supersedeNote:
      "Couvre 3 natures sur 5 et rien d'autre. Une fois nature posée, la colonne " +
      "est redondante — à retirer en S6, pas avant (482 lignes la lisent).",
    values: {
      source_attributed: { kind: "DIRECT", nature: "THIRD_PARTY_DATA", note: "425 lignes" },
      attributed: {
        kind: "DIRECT", nature: "THIRD_PARTY_DATA",
        note: "5 lignes — SYNONYME de source_attributed, à fusionner (S4)",
      },
      verified_onchain: { kind: "DIRECT", nature: "PRIMARY_OBSERVATION", note: "19 lignes" },
      onchain_confirmed: {
        kind: "DIRECT", nature: "PRIMARY_OBSERVATION",
        note: "3 lignes — SYNONYME de verified_onchain, à fusionner (S4)",
      },
      analytical_estimate: {
        kind: "NEEDS_JOIN",
        join: "KolWallet.sourceLabel",
        resolve:
          "sourceLabel non nul (ex. '@dethective — winrate 33.24%') → THIRD_PARTY_DATA : " +
          "l'analyse est celle d'un tiers, nous la RELAYONS (Q3 'relay'), et sa méthode lui " +
          "appartient — aucun methodRef ne nous est dû. " +
          "sourceLabel nul → ESTIMATE, et methodRef devient exigible.",
        note:
          "29 lignes, toutes kolHandle='deployer_pool' et toutes porteuses d'un sourceLabel " +
          "@dethective (mesuré 2026-08-28). Ce ne sont donc PAS nos estimations : c'est de " +
          "l'analytique tierce étiquetée à tort 'analytical_estimate'. Le correctif est un " +
          "RECLASSEMENT, pas une dette de documentation.",
      },
      self_posted: {
        kind: "DIRECT", nature: "THIRD_PARTY_DATA",
        note: "1 ligne — le sujet s'affirme lui-même : c'est un tiers, pas une observation",
      },
    },
  },
  {
    source: "KolCase.claimType",
    form: "text",
    supersedable: "yes",
    supersedeNote: "Même domaine que KolWallet ; porte déjà methodologyRef, ce qui facilite Q5.",
    values: {
      analytical_estimate: { kind: "DIRECT", nature: "ESTIMATE", note: "10 lignes" },
      source_attributed: { kind: "DIRECT", nature: "THIRD_PARTY_DATA", note: "1 ligne" },
    },
  },
  {
    source: "MmClaimType",
    form: "pg_enum",
    supersedable: "partial",
    supersedeNote:
      "Le plus proche de la cible, et pourtant non promouvable : FACT recouvre " +
      "deux natures. Conserver comme vocabulaire local mappé.",
    values: {
      FACT: {
        kind: "NEEDS_JOIN",
        join: 'MmClaim.sourceId → "MmSource"',
        resolve:
          "MmSource présent → THIRD_PARTY_DATA (un tiers l'affirme) ; " +
          "MmSource absent → PRIMARY_OBSERVATION (nous l'avons constaté).",
        note:
          "10 lignes en base, toutes FACT. C'EST LE CAS TYPE qui interdit un UPDATE " +
          "global : la même valeur source mappe vers deux natures selon la jointure.",
      },
      ALLEGATION: { kind: "DIRECT", nature: "THIRD_PARTY_DATA" },
      INFERENCE: { kind: "DIRECT", nature: "INFERENCE" },
      RESPONSE: {
        kind: "DIRECT", nature: "THIRD_PARTY_DATA",
        note: "parole du sujet mise en cause — un tiers, pas une observation",
      },
    },
  },
  {
    source: "EvidenceItem.provenanceType",
    form: "text",
    supersedable: "partial",
    supersedeNote:
      "Une valeur sur deux décrit la nature, l'autre décrit l'ingestion. " +
      "À scinder, pas à retirer.",
    values: {
      FIRST_PARTY_CAPTURE: { kind: "DIRECT", nature: "PRIMARY_OBSERVATION", note: "2 lignes" },
      MIGRATED_BACKFILL: {
        kind: "OTHER_AXIS", axis: "ingestionMode",
        note:
          "32 lignes. Décrit COMMENT LA LIGNE EST ENTRÉE EN BASE, pas d'où vient la " +
          "preuve. Le seul champ du dépôt qui nomme une provenance mélange déjà les " +
          "deux axes — c'est ce qui a rendu la colonne inutilisable (renseignée à 3,1 %).",
      },
    },
  },
  {
    source: "MmAttribMethod",
    form: "pg_enum",
    supersedable: "no",
    supersedeNote:
      "Trois axes dans une énumération : ARKHAM (source), OSINT (méthode), " +
      "INFERRED_CLUSTER (nature). Reste local ; la nature se lit ailleurs.",
    values: {
      ARKHAM: { kind: "DIRECT", nature: "THIRD_PARTY_DATA", note: "23 lignes" },
      COURT_FILING: { kind: "DIRECT", nature: "THIRD_PARTY_DATA", note: "6 lignes" },
      OFFICIAL: { kind: "DIRECT", nature: "THIRD_PARTY_DATA" },
      HACK_LEAK: { kind: "DIRECT", nature: "THIRD_PARTY_DATA", note: "1 ligne" },
      OSINT: {
        kind: "NEEDS_JOIN",
        join: 'MmAttribution → "MmSource"',
        resolve:
          "OSINT est une MÉTHODE, pas une source : si un MmSource externe est cité → " +
          "THIRD_PARTY_DATA ; si la collecte est nôtre → PRIMARY_OBSERVATION.",
        note: "2 lignes",
      },
      INFERRED_CLUSTER: { kind: "DIRECT", nature: "INFERENCE" },
    },
  },
  {
    source: "MmSourceType",
    form: "pg_enum",
    supersedable: "no",
    supersedeNote:
      "Décrit la CRÉDIBILITÉ d'un tiers (DOJ vs MEDIA_TIER3), pas la nature. " +
      "Toutes ses valeurs sont THIRD_PARTY_DATA : il vit sur l'axe confiance.",
    values: Object.fromEntries(
      ["DOJ", "CFTC", "SEC", "COURT", "REGULATOR", "MEDIA_TIER1", "MEDIA_TIER2",
       "MEDIA_TIER3", "OSINT", "OFFICIAL", "HACK_LEAK"].map((v) => [
        v, { kind: "DIRECT", nature: "THIRD_PARTY_DATA" } as MappingVerdict,
      ]),
    ),
  },
  {
    source: "MatchBasis",
    form: "pg_enum",
    supersedable: "no",
    supersedeNote: "Dit comment un rapprochement a été fait — utile, et distinct de la nature.",
    values: {
      EXACT_ADDRESS: { kind: "DIRECT", nature: "PRIMARY_OBSERVATION" },
      EXACT_CONTRACT: { kind: "DIRECT", nature: "PRIMARY_OBSERVATION" },
      EXACT_DOMAIN: { kind: "DIRECT", nature: "PRIMARY_OBSERVATION" },
      EXACT_TOKEN_CA: { kind: "DIRECT", nature: "PRIMARY_OBSERVATION" },
      INFERRED_LINKAGE: { kind: "DIRECT", nature: "INFERENCE" },
      FUZZY_ALIAS: { kind: "DIRECT", nature: "INFERENCE" },
    },
  },
  {
    source: "GovernedStatusBasisEnum",
    form: "pg_enum",
    supersedable: "no",
    supersedeNote: "Base d'un statut gouverné ; recouvre la nature sans la nommer.",
    values: {
      external_authority_source: { kind: "DIRECT", nature: "THIRD_PARTY_DATA" },
      manual_internal_confirmation: { kind: "DIRECT", nature: "EDITORIAL_ASSERTION" },
      multi_source_corroboration: { kind: "DIRECT", nature: "INFERENCE" },
      legacy_case_linkage: { kind: "DIRECT", nature: "INFERENCE" },
    },
  },
];

// ─── L'axe manquant : comment la ligne est entrée en base ───────────────────
// Révélé par MIGRATED_BACKFILL. Ce n'est PAS une nature : une preuve capturée
// en direct et la même preuve réimportée d'un backfill ont la même nature et
// deux modes d'ingestion. Les confondre est ce qui a tué provenanceType.
export const INGESTION_MODES = [
  "LIVE_CAPTURE",     // écrite au moment de l'observation
  "BATCH_INGEST",     // flux tiers, cron d'ingestion
  "MIGRATED_BACKFILL", // reprise d'un état antérieur
  "MANUAL_ENTRY",     // saisie humaine
  "DERIVED_JOB",      // produite par un calcul du produit
] as const;
export type IngestionMode = (typeof INGESTION_MODES)[number];

/** Résolution d'une valeur de vocabulaire. Renvoie null quand une jointure est requise. */
export function mapVocabularyValue(source: string, value: string): DataNature | null {
  const voc = VOCABULARY_MAPPINGS.find((v) => v.source === source);
  const verdict = voc?.values[value];
  if (!verdict || verdict.kind !== "DIRECT") return null;
  return verdict.nature;
}

export function needsJoin(source: string, value: string): boolean {
  const voc = VOCABULARY_MAPPINGS.find((v) => v.source === source);
  return voc?.values[value]?.kind === "NEEDS_JOIN";
}
