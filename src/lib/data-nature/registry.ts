// ─── S1 — Stratégie par table ──────────────────────────────────────────────
//
// La nature est l'attribut d'une AFFIRMATION. La ligne, la colonne et le champ
// ne sont que trois façons de la loger — et le produit utilise les trois. D'où
// quatre régimes, choisis par une règle mécanique (compter les natures qu'une
// table peut porter), jamais au cas par cas.
//
//   DECLARED            1 nature                    → aucune colonne, aucun DDL
//   DECLARED_PREDICATE  ≥2, séparables par une       → aucune colonne, aucun DDL
//                       colonne DÉJÀ présente
//   ROW                 ≥2, non séparables sans      → colonne `nature` + backfill
//                       intervention humaine
//   FIELD               ≥2 dans la MÊME ligne        → colonne `<champ>Nature` par champ
//
// DECLARED_PREDICATE décide de la faisabilité du plan : les quatre plus grosses
// tables du produit (1 552 056 lignes) sont couvertes SANS UNE SEULE ÉCRITURE.
//
// Volumes mesurés sur ep-square-band le 2026-08-27, en lecture seule.

import type { DataNature, NatureValue } from "./nature";
import { UNCLASSIFIED } from "./nature";

export type Regime = "DECLARED" | "DECLARED_PREDICATE" | "ROW" | "FIELD";

export interface TableNatureDecl {
  regime: Regime;
  /** Lignes mesurées le 2026-08-27 — sert à ordonner la migration, pas à décider. */
  rows: number;
  /** DECLARED : la nature unique de la table. */
  nature?: DataNature;
  /** DECLARED : natures des entrées, quand la table est une INFERENCE (Q3). */
  basis?: DataNature[];
  /** DECLARED_PREDICATE : la nature se lit sur des colonnes déjà présentes. */
  predicate?: (row: Record<string, unknown>) => DataNature;
  /** DECLARED_PREDICATE : les colonnes que le prédicat lit. Documentaire et testable. */
  predicateReads?: string[];
  /** FIELD : nature par champ gouverné. */
  fields?: Record<string, DataNature>;
  /** FIELD : nature de la ligne quand aucun champ gouverné n'est visé. */
  rowDefault?: (row: Record<string, unknown>) => DataNature;
  /** Étape du plan où cette table est traitée. */
  stage: "S1" | "S3" | "S4" | "S6";
  why: string;
}

export const NATURE_REGISTRY: Record<string, TableNatureDecl> = {
  // ── Régime DÉCLARÉ — mono-nature, zéro écriture ─────────────────────────
  intel_source_observations: {
    regime: "DECLARED", rows: 352_840, nature: "THIRD_PARTY_DATA", stage: "S1",
    why: "Un flux d'ingestion ne produit qu'une nature : scamsniffer 339 901, ofac 869, forta 3.",
  },
  intel_canonical_entities: {
    regime: "DECLARED", rows: 350_012, nature: "INFERENCE", basis: ["THIRD_PARTY_DATA"], stage: "S1",
    why:
      "riskClass est CALCULÉ à partir des observations tierces. Q3 : la nature est celle de " +
      "la dernière opération, et natureBasis retient que le plancher est un flux de rang 2. " +
      "strongestSource porte déjà l'information — rien à ajouter.",
  },
  EvidenceSnapshot: {
    regime: "DECLARED", rows: 1_159, nature: "PRIMARY_OBSERVATION", stage: "S1",
    why: "Capture horodatée avec artefact récupérable — la définition même de l'observation.",
  },
  ShillBuyerObservation: {
    regime: "DECLARED", rows: 2_169, nature: "PRIMARY_OBSERVATION", stage: "S1",
    why: "Achats lus on-chain par le produit.",
  },
  WalletLabel: {
    regime: "DECLARED", rows: 19, nature: "THIRD_PARTY_DATA", stage: "S1",
    why:
      "19 lignes, toutes source='public_documentation' (mesuré 2026-08-27). Mono-nature : " +
      "le produit relaie une documentation publique, il ne l'a pas constatée.",
  },
  KolPromotionMention: {
    regime: "DECLARED", rows: 73, nature: "PRIMARY_OBSERVATION", stage: "S1",
    why: "Post constaté par le watcher, avec sourceUrl et postedAt.",
  },
  ShillCorrelationCandidate: {
    regime: "DECLARED", rows: 1_532, nature: "INFERENCE",
    basis: ["PRIMARY_OBSERVATION"], stage: "S6",
    why:
      "Sortie d'un moteur de corrélation : mono-nature PAR CONSTRUCTION. Le moteur lit des " +
      "achats on-chain (PRIMARY_OBSERVATION) et une chronologie de publication, puis CALCULE. " +
      "Q3 : la nature est celle de la dernière opération — jamais celle des entrées — donc " +
      "INFERENCE, et aucune ligne de cette table ne peut porter autre chose. C'est le sens de " +
      "DECLARED : il n'existe pas de seconde nature à séparer. " +
      "Mesuré le 2026-08-30 sur ep-square-band : 1 532 lignes, 3 KOL, 0 revue humaine — " +
      "reviewStatus='draft' partout, donc aucune ligne n'a encore été reprise à son compte " +
      "par un humain (ce qui en ferait, ELLE, une EDITORIAL_ASSERTION portée ailleurs). " +
      "POURQUOI DES COLONNES MALGRÉ « DECLARED = aucun DDL » : la nature elle-même n'a pas " +
      "besoin de colonne — le registre la donne, pour les 1 532 lignes legacy comprises. Les " +
      "trois colonnes additives (nature / natureBasis / naturePolicyVersion) ne sont PAS la " +
      "source de vérité de la nature : elles sont la PISTE D'AUDIT de l'écriture. natureBasis " +
      "dit de quelles natures d'entrée CETTE ligne est tirée (le résolveur V3 ajoute une " +
      "INFERENCE quand il a tranché, pas sinon) et naturePolicyVersion dit sous quels seuils " +
      "elle a été produite — deux faits par ligne, que le registre ne peut pas porter. " +
      "AUCUN BACKFILL : une ligne ne reçoit ces colonnes qu'en étant (re)produite par le " +
      "moteur. Les legacy restent NULL jusqu'à leur propre recalcul, jamais par UPDATE global.",
  },

  // ── Régime DÉCLARÉ + PRÉDICAT — ≥2 natures, zéro écriture ───────────────
  AddressLabel: {
    regime: "DECLARED_PREDICATE", rows: 217_813, stage: "S1",
    predicateReads: ["sourceName"],
    predicate: (r) =>
      String(r.sourceName ?? "") === "INTERLIGENS" ? "EDITORIAL_ASSERTION" : "THIRD_PARTY_DATA",
    why:
      "4 étiquettes INTERLIGENS parmi 217 813. sourceName les sépare déjà : une colonne " +
      "coûterait 217 813 écritures pour distinguer 4 lignes.",
  },
  DomainLabel: {
    regime: "DECLARED_PREDICATE", rows: 631_391, stage: "S1",
    predicateReads: ["sourceName"],
    predicate: (r) =>
      String(r.sourceName ?? "") === "INTERLIGENS" ? "EDITORIAL_ASSERTION" : "THIRD_PARTY_DATA",
    why: "Même motif qu'AddressLabel, et la plus grosse table du produit.",
  },

  // ── Régime CHAMP — plusieurs natures dans la MÊME ligne ─────────────────
  KolTokenLink: {
    regime: "FIELD", rows: 292, stage: "S3",
    fields: {
      contractAddress: "PRIMARY_OBSERVATION",
      canonicalMint: "INFERENCE",
      note: "EDITORIAL_ASSERTION",
    },
    rowDefault: (r) =>
      String(r.sourceType ?? "") === "watcher" ? "PRIMARY_OBSERVATION" : "EDITORIAL_ASSERTION",
    why:
      "M5 — quatre natures par ligne. Les 117 lignes à adresse PENDING:* ne portent AUCUNE " +
      "identité : leur contractAddressNature vaut UNCLASSIFIED, ce qui les exclut de toute " +
      "sortie publique. C'est le comportement voulu, pas un effet de bord.",
  },
  TokenPriceTracker: {
    regime: "FIELD", rows: 340, stage: "S3",
    fields: { currentPrice: "THIRD_PARTY_DATA", peakPrice: "INFERENCE", dumpPct: "INFERENCE" },
    rowDefault: () => "THIRD_PARTY_DATA",
    why:
      "M4 — 338 lignes sur 340 portent un peakPrice calculé par le produit, étiqueté du nom " +
      "d'un provider qui ne l'a jamais publié.",
  },
  token_casefiles: {
    regime: "FIELD", rows: 2, stage: "S3",
    fields: { claimedRaiseUsd: "THIRD_PARTY_DATA", estimatedRetailHarmUsd: "ESTIMATE" },
    rowDefault: () => "EDITORIAL_ASSERTION",
    why:
      "M3 — 482 M$ estimés à côté de 1,5 M$ revendiqués, même type numérique. " +
      "estimatedRetailHarmUsd exigera un methodRef (Q5). " +
      "Remesuré le 2026-08-28 : 2 lignes, pas 1 — le comptage du 2026-08-27 était stale.",
  },
  EvidenceItem: {
    regime: "ROW", rows: 1_104, stage: "S3",
    why:
      "M6 — provenanceType renseigné sur 34 lignes / 1 104 (3,1 %). Non séparable par " +
      "prédicat : les 1 070 NULL demandent un classement humain, table par table de sourceType.",
  },
  KolTokenInvolvement: {
    regime: "ROW", rows: 15, stage: "S3",
    why: "retailLossEstimateUsd est une ESTIMATE ; 15 lignes, aucune n'est renseignée à ce jour.",
  },
  KolWallet: {
    regime: "ROW", rows: 482, stage: "S4",
    why:
      "claimType couvre déjà 3 natures — mappage DIRECT pour les 482 lignes. " +
      "S4 fusionne d'abord les 2 paires de synonymes (8 lignes).",
  },
  KolCase: {
    regime: "ROW", rows: 11, stage: "S4",
    why: "Porte déjà methodologyRef : la seule table prête pour la contrainte Q5.",
  },
  MmClaim: {
    regime: "ROW", rows: 10, stage: "S6",
    why:
      "FACT n'est pas mappable sans jointure sur MmSource. Migration PAR TABLE obligatoire — " +
      "un UPDATE global se tromperait sur une partie des lignes.",
  },
};

/** I5 — toute table absente du registre est UNCLASSIFIED, donc non publiable. */
export function natureForTable(table: string): NatureValue {
  const decl = NATURE_REGISTRY[table];
  if (!decl) return UNCLASSIFIED;
  if (decl.regime === "DECLARED") return decl.nature ?? UNCLASSIFIED;
  return UNCLASSIFIED; // les autres régimes exigent la ligne
}

export function natureForRow(table: string, row: Record<string, unknown>): NatureValue {
  const decl = NATURE_REGISTRY[table];
  if (!decl) return UNCLASSIFIED;
  switch (decl.regime) {
    case "DECLARED": return decl.nature ?? UNCLASSIFIED;
    case "DECLARED_PREDICATE": return decl.predicate ? decl.predicate(row) : UNCLASSIFIED;
    case "FIELD": return decl.rowDefault ? decl.rowDefault(row) : UNCLASSIFIED;
    case "ROW": {
      const v = row.nature;
      return typeof v === "string" ? (v as NatureValue) : UNCLASSIFIED;
    }
  }
}

export function natureForField(
  table: string, field: string, row: Record<string, unknown>,
): NatureValue {
  const decl = NATURE_REGISTRY[table];
  if (!decl) return UNCLASSIFIED;
  if (decl.regime === "FIELD" && decl.fields?.[field]) {
    // Un champ gouverné vide ne porte aucune affirmation.
    const value = row[field];
    if (value == null || value === "") return UNCLASSIFIED;
    // Un contrat marqueur (PENDING:*) n'est pas une identité observée.
    if (typeof value === "string" && /^(PENDING|TBD|TODO)/i.test(value)) return UNCLASSIFIED;
    return decl.fields[field];
  }
  return natureForRow(table, row);
}

/** Chiffres du plan — recalculés, jamais recopiés. */
export function registryStats() {
  const e = Object.values(NATURE_REGISTRY);
  const sum = (f: (d: TableNatureDecl) => boolean) =>
    e.filter(f).reduce((s, d) => s + d.rows, 0);
  return {
    tables: e.length,
    rowsTotal: sum(() => true),
    rowsNoWrite: sum((d) => d.regime === "DECLARED" || d.regime === "DECLARED_PREDICATE"),
    rowsToWrite: sum((d) => d.regime === "ROW" || d.regime === "FIELD"),
    byRegime: Object.fromEntries(
      (["DECLARED", "DECLARED_PREDICATE", "ROW", "FIELD"] as Regime[]).map((r) => [
        r, { tables: e.filter((d) => d.regime === r).length, rows: sum((d) => d.regime === r) },
      ]),
    ),
  };
}
