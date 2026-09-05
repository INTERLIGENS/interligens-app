// --- BUILD 7 / @v2 — L'EXTRACTION, SUR LE MÊME CORPUS ---------------------
//
// PURE. Elle lit EXACTEMENT le même corpus que le run S3 sous @v1
// (`src/lib/similarity/__fixtures__/s3-corpus.ts`, relevé en lecture seule le
// 2026-09-05). Aucune ligne n'est ajoutée, aucune retirée : c'est la condition
// pour que le delta @v1→@v2 mesure la MÉTHODE et rien d'autre.
//
// ██ CE QUI CHANGE PAR RAPPORT À L'EXTRACTION @v1 ██
//
//   P0  les dimensions de groupe sont AGRÉGÉES selon la règle du registre @v2,
//       au lieu d'être détruites par une unanimité que rien ne ratifiait ;
//   P1  les lignes qui existent sans pouvoir soutenir la feature deviennent
//       INADMISSIBLE avec leur cause, au lieu de NOT_OBSERVED ;
//   P2  `date_only` est transporté comme provenance d'ancre, et la date reste
//       une DATE — l'instant de minuit de la colonne n'entre nulle part ;
//   P3  chaque adresse et chaque nom d'entité porte son attribution.
//
// Les règles P1 et P2 de l'extraction @v1 (nature manquante, nature qui monte)
// ne sont PAS abandonnées : elles sont désormais EXPRIMÉES par l'état
// INADMISSIBLE au lieu d'être noyées dans un motif texte.

import {
  MIN_SHARED_RECIPIENTS,
  buildFundingSnapshot,
  qualifyFundingRelationship,
  type CoverageInput,
  type FundingEdge,
  type QualifiedFundingRelationship,
  type TransferBearingTx,
} from "@/lib/funding-graph";
import { chainForMint } from "@/lib/shill-correlation/tokenIdentity";
import { completeCoverage } from "../../observation";
import { assertCanonicalMint, subjectIdentity } from "../../subject";
import {
  BOTIFY_KOL_TOKEN_LINKS,
  BOTIFY_SHILL_EVENTS,
  S3_CORPUS_SOURCE,
  VINE_COEXIT_GROUPS,
  VINE_EXIT_SUBJECTS,
  VINE_FUNDING_EDGES,
  type CoExitRow,
} from "../../__fixtures__/s3-corpus";
import { aggregateCategorical, aggregateMagnitude, notAggregated } from "../aggregate";
import { UNATTRIBUTED, buildFeatureObservationV2, declaredBySource } from "../observation";
import type {
  AttributionDetail,
  FeatureCoverage,
  FeatureObservationV2,
  SubjectFeatureSetV2,
} from "../types";

export const S3_EXTRACT_V2_RULE_VERSION = "similarity/s3-extract@v2";

const FUNDING_CENSORED_BY =
  "collecte cadrée sur le mint (funding-graph/snapshot@v1) : seuls les transferts SOL " +
  "accompagnant les transactions du token sont visibles ; le financement réel des " +
  "wallets n'y figure pas par construction";

const fundingCoverage = (edges: number, subjects: number): FeatureCoverage => ({
  complete: false,
  censoredBy: FUNDING_CENSORED_BY,
  upstream: { fundingEdges: edges, subjects, source: S3_CORPUS_SOURCE },
});
const fundingCoverageInput = (): CoverageInput => ({
  complete: false,
  censoredBy: FUNDING_CENSORED_BY,
});

const exitCoverage = (rows: readonly CoExitRow[]): FeatureCoverage =>
  rows.some((r) => r.coverageAnyIncomplete)
    ? {
        complete: false,
        censoredBy: "au moins un groupe porte coverageAnyIncomplete = true",
        upstream: { groups: rows.length, source: S3_CORPUS_SOURCE },
      }
    : completeCoverage({ groups: rows.length, source: S3_CORPUS_SOURCE });

const EXIT_METHOD = (windowSeconds: number) => ({
  methodRef: "coordinated-exit/qualify@v1",
  ruleVersion: "coordinated-exit@v1",
  parameters: { windowSeconds },
});

const IDENTITY_METHOD = {
  methodRef: null,
  ruleVersion: S3_EXTRACT_V2_RULE_VERSION,
  parameters: {},
};

function compositionProfile(sell: number, outgoing: number): string {
  if (sell > 0 && outgoing > 0) return "MIXED";
  return sell > 0 ? "SELL_ONLY" : "TRANSFER_ONLY";
}

function fundingTxs(): TransferBearingTx[] {
  return VINE_FUNDING_EDGES.map((e) => ({
    signature: e.txSignature,
    timestamp: e.blockTimeSeconds,
    nativeTransfers: [
      { fromUserAccount: e.fromWallet, toUserAccount: e.toWallet, amount: e.amountLamports },
    ],
  }));
}

function fundingEdgesFor(funder: string, subjects: readonly string[]): FundingEdge[] {
  const set = new Set(subjects);
  return VINE_FUNDING_EDGES.filter((e) => e.fromWallet === funder && set.has(e.toWallet)).map((e) => ({
    fromWallet: e.fromWallet,
    toWallet: e.toWallet,
    asset: "SOL" as const,
    amountLamports: e.amountLamports,
    txSignature: e.txSignature,
    blockTimeSeconds: e.blockTimeSeconds,
    rowNature: "PRIMARY_OBSERVATION" as const,
  }));
}

/**
 * ██ AUCUNE ÉTIQUETTE N'EST INVENTÉE ICI. ██
 *
 * Le produit ne porte aucune étiquette auditable pour les bailleurs de VINE ni
 * pour la destination unanime : ni KNOWN_ROUTERS, ni KNOWN_INFRA ne les
 * connaissent. En poser une « de mémoire » serait exactement la faute que
 * `qualifyFundingRelationship` refuse déjà — une étiquette non sourçable
 * laisserait l'annotation d'un tiers décider comment le produit lit ses preuves.
 */
const ADDRESS_ATTRIBUTION: AttributionDetail = UNATTRIBUTED;

// ═══ FINANCEMENT — niveau sujet, inchangé sauf l'attribution ══════════════

export function fundingObservationsV2(subjects: readonly string[]): FeatureObservationV2[] {
  const snapshot = buildFundingSnapshot({ subjects, txs: fundingTxs() });
  const coverage = fundingCoverage(VINE_FUNDING_EDGES.length, subjects.length);
  const method = {
    methodRef: null,
    ruleVersion: "funding-graph/shared-funder@v1",
    parameters: { minSharedRecipients: MIN_SHARED_RECIPIENTS },
  };
  const qualifyMethod = {
    methodRef: "funding-relationship/qualify@v1",
    ruleVersion: "funding-relationship@v1",
    parameters: {},
  };
  const out: FeatureObservationV2[] = [];

  if (snapshot.sharedFunder.observed) {
    const funders = snapshot.sharedFunder.funders;
    out.push(
      buildFeatureObservationV2({
        featureKey: "funding.shared_funder_addresses",
        state: "OBSERVED",
        value: { kind: "SET", values: funders.map((f) => f.funder) },
        method,
        coverage,
        evidence: [
          { kind: "tx_signature", refs: funders.flatMap((f) => f.links.map((l) => l.txSignature)) },
          { kind: "subject_wallet", refs: [...subjects] },
        ],
        aggregation: notAggregated(),
        attribution: ADDRESS_ATTRIBUTION,
      }),
    );

    const qualified: QualifiedFundingRelationship[] = funders.map((f) =>
      qualifyFundingRelationship({
        funder: f.funder,
        subjectsReached: f.recipients,
        edges: fundingEdgesFor(f.funder, subjects),
        knownActors: [...subjects],
        coverage: fundingCoverageInput(),
      }),
    );
    const kept = qualified.filter((q) => q.category !== "UNKNOWN");
    out.push(
      kept.length > 0
        ? buildFeatureObservationV2({
            featureKey: "funding.relationship_categories",
            state: "OBSERVED",
            value: { kind: "SET", values: kept.map((q) => q.category) },
            method: qualifyMethod,
            coverage,
            evidence: [
              { kind: "tx_signature", refs: kept.flatMap((q) => q.evidence.txSignatures) },
              { kind: "funder_address", refs: kept.map((q) => q.funder) },
            ],
            aggregation: notAggregated(),
          })
        : buildFeatureObservationV2({
            featureKey: "funding.relationship_categories",
            state: "NOT_OBSERVED",
            stateReason: `${qualified.length} relation(s) qualifiée(s), toutes en UNKNOWN`,
            method: qualifyMethod,
            coverage,
            aggregation: notAggregated(),
          }),
    );
  } else {
    out.push(
      buildFeatureObservationV2({
        featureKey: "funding.shared_funder_addresses",
        state: "NOT_OBSERVED",
        stateReason:
          `${snapshot.sharedFunder.diagnostic}/${snapshot.sharedFunder.reason} sur ` +
          `${snapshot.sharedFunder.edgesConsidered} arête(s) considérée(s)`,
        method,
        coverage,
        aggregation: notAggregated(),
        attribution: ADDRESS_ATTRIBUTION,
      }),
      buildFeatureObservationV2({
        featureKey: "funding.relationship_categories",
        state: "NOT_OBSERVED",
        stateReason:
          `${snapshot.sharedFunder.diagnostic}/${snapshot.sharedFunder.reason} sur ` +
          `${snapshot.sharedFunder.edgesConsidered} arête(s) considérée(s)`,
        method: qualifyMethod,
        coverage,
        aggregation: notAggregated(),
      }),
    );
  }

  const structure = snapshot.funderStructure;
  out.push(
    structure
      ? buildFeatureObservationV2({
          featureKey: "funding.external_funder_count",
          state: "OBSERVED",
          value: { kind: "ORDINAL", value: structure.external, unit: "funders" },
          method,
          coverage,
          evidence: [{ kind: "subject_wallet", refs: [...subjects] }],
          aggregation: notAggregated(),
        })
      : buildFeatureObservationV2({
          featureKey: "funding.external_funder_count",
          state: "NOT_OBSERVED",
          stateReason: "aucune structure de bailleurs — un décompte de rien n'est pas zéro",
          method,
          coverage,
          aggregation: notAggregated(),
        }),
  );
  return out;
}

function chainObservationV2(mint: string): FeatureObservationV2 {
  const chain = chainForMint(assertCanonicalMint(mint, "s3-extract-v2/chain"));
  return chain
    ? buildFeatureObservationV2({
        featureKey: "identity.chain_demonstrated",
        state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: chain },
        method: IDENTITY_METHOD,
        coverage: completeCoverage({ mint }),
        evidence: [{ kind: "mint", refs: [mint] }],
        aggregation: notAggregated(),
      })
    : buildFeatureObservationV2({
        featureKey: "identity.chain_demonstrated",
        state: "NOT_OBSERVED",
        stateReason: "aucune chaîne démontrable depuis l'espace d'adressage du mint",
        method: IDENTITY_METHOD,
        coverage: completeCoverage({ mint }),
        aggregation: notAggregated(),
      });
}

// ═══ VINE — NIVEAU SUJET, AVEC AGRÉGATION DÉCLARÉE ════════════════════════

export function vineSubjectV2(): SubjectFeatureSetV2 {
  const id = subjectIdentity("CASE-2025-VINE-001", "s3-extract-v2/vine");
  const rows = VINE_COEXIT_GROUPS;
  const coverage = exitCoverage(rows);
  const method = EXIT_METHOD(rows[0].windowSeconds);
  const evidence = [
    { kind: "group_key", refs: rows.map((r) => r.groupKey) },
    { kind: "tx_signature", refs: rows.map((r) => r.firstTxSignature) },
    { kind: "mint", refs: [id.canonicalMint] },
  ];
  const gref = (r: CoExitRow) => r.groupKey.split("@")[1];

  const categorical = (
    key: string,
    rule: "ALL_OR_NOTHING" | "DEMONSTRATED_BY_ANY",
    pick: (r: CoExitRow) => string | null,
    attribution: (v: string) => AttributionDetail | null = () => null,
  ): FeatureObservationV2 => {
    const agg = aggregateCategorical(
      rule,
      rows.map((r) => ({ groupRef: gref(r), value: pick(r) })),
    );
    return agg.value !== null
      ? buildFeatureObservationV2({
          featureKey: key,
          state: "OBSERVED",
          value: { kind: "CATEGORICAL", value: agg.value },
          method,
          coverage,
          evidence,
          aggregation: agg.detail,
          attribution: attribution(agg.value),
        })
      : buildFeatureObservationV2({
          featureKey: key,
          state: "NOT_OBSERVED",
          stateReason: agg.reason!,
          method,
          coverage,
          aggregation: agg.detail,
          attribution: attribution(""),
        });
  };

  const magnitude = (key: string, pick: (r: CoExitRow) => number | null, what: string) =>
    buildFeatureObservationV2({
      featureKey: key,
      state: "NOT_MEASURABLE",
      stateReason:
        `${what} est défini PAR GROUPE ; les ${rows.length} valeurs sont préservées ` +
        `dans le détail d'agrégation, et les résumer fabriquerait une grandeur que ` +
        `rien n'a mesurée`,
      method,
      coverage,
      aggregation: aggregateMagnitude(rows.map((r) => ({ groupRef: gref(r), value: pick(r) }))),
    });

  return {
    subjectRef: id.subjectRef,
    observations: [
      chainObservationV2(id.canonicalMint),
      categorical("exit.cluster_category", "ALL_OR_NOTHING", (r) => r.category),
      categorical(
        "exit.demonstrated_venue",
        "DEMONSTRATED_BY_ANY",
        (r) => r.demonstratedVenue,
        (v) => (v ? declaredBySource(v) : UNATTRIBUTED),
      ),
      categorical(
        "exit.demonstrated_destination",
        "DEMONSTRATED_BY_ANY",
        (r) => r.demonstratedDestination,
        () => ADDRESS_ATTRIBUTION,
      ),
      categorical("exit.composition_profile", "ALL_OR_NOTHING", (r) =>
        compositionProfile(r.sellCount, r.outgoingCount),
      ),
      magnitude("exit.distinct_subjects", (r) => r.distinctSubjects, "le nombre de sujets distincts"),
      magnitude("temporal.exit_cluster_span_seconds", (r) => r.spanSeconds, "l'étendue du groupe"),
      magnitude("temporal.exit_cluster_min_gap_seconds", (r) => r.minGapSeconds, "le plus petit écart"),
      buildFeatureObservationV2({
        featureKey: "exit.materiality",
        state: "NOT_MEASURABLE",
        stateReason:
          `materialityStatus = NOT_MEASURABLE sur ${rows.length} groupes sur ${rows.length}`,
        method,
        coverage,
        aggregation: aggregateMagnitude(rows.map((r) => ({ groupRef: gref(r), value: null }))),
      }),
      ...fundingObservationsV2(VINE_EXIT_SUBJECTS),
    ],
  };
}

// ═══ BOTIFY — L'INADMISSIBILITÉ, DITE PAR L'ÉTAT ══════════════════════════

export function botifySubjectV2(): SubjectFeatureSetV2 {
  const id = subjectIdentity("CASE-2024-BOTIFY-001", "s3-extract-v2/botify");
  const socialCoverage: FeatureCoverage = {
    complete: false,
    censoredBy:
      `corpus social borné : ${BOTIFY_SHILL_EVENTS.length} ShillEvent et ` +
      `${BOTIFY_KOL_TOKEN_LINKS.length} KolTokenLink, aucune complétude déclarée nulle part`,
    upstream: {
      shillEvents: BOTIFY_SHILL_EVENTS.length,
      kolTokenLinks: BOTIFY_KOL_TOKEN_LINKS.length,
      source: S3_CORPUS_SOURCE,
    },
  };
  const socialMethod = {
    methodRef: "social-promotion/qualify@v1",
    ruleVersion: "shill-forward-bridge@v1",
    parameters: {},
  };
  const unclassified = BOTIFY_SHILL_EVENTS.filter((e) => e.rowNature === null).length;
  const editorial = BOTIFY_KOL_TOKEN_LINKS.filter((l) => l.rowNature === "EDITORIAL_ASSERTION").length;

  return {
    subjectRef: id.subjectRef,
    observations: [
      chainObservationV2(id.canonicalMint),

      // ── P1 · nature ABSENTE sur la ligne source ──────────────────────────
      buildFeatureObservationV2({
        featureKey: "identity.token_resolution_status",
        state: "INADMISSIBLE",
        stateReason:
          `${BOTIFY_SHILL_EVENTS.length} ShillEvent portent resolutionStatus = ` +
          `resolved_direct, et aucune ne porte de nature`,
        inadmissibility: {
          cause: "DATA_NATURE_MISSING",
          found: `${unclassified}/${BOTIFY_SHILL_EVENTS.length} ShillEvent avec rowNature NULL (UNCLASSIFIED) et sourcePostCandidateId NULL`,
          required: "une nature classée sur la ligne source (INFERENCE) et un post rattaché",
          sourceRowCount: BOTIFY_SHILL_EVENTS.length,
        },
        method: socialMethod,
        coverage: socialCoverage,
        aggregation: notAggregated(),
      }),

      // ── P1 + P2 · même refus ; la date, elle, reste une DATE ─────────────
      //
      // ██ L'ORDRE COMPTE. ██ @v2 sait désormais dire `date_only` — c'est P2 —
      // mais ces cinq lignes n'ont PAS de nature, et une ligne sans nature ne
      // soutient AUCUNE feature. L'admissibilité tranche avant la valeur, et
      // c'est pourquoi P2 ne débloque rien ICI : il débloque le cas où la même
      // donnée serait classée.
      buildFeatureObservationV2({
        featureKey: "temporal.anchor_provenance",
        state: "INADMISSIBLE",
        stateReason:
          `les ${BOTIFY_SHILL_EVENTS.length} lignes portent timestampSource = « date_only » ` +
          `— une valeur que @v2 sait désormais transporter — mais aucune ne porte de nature`,
        inadmissibility: {
          cause: "DATA_NATURE_MISSING",
          found: `${unclassified}/${BOTIFY_SHILL_EVENTS.length} ShillEvent avec rowNature NULL ; tweetId construits (ex. « ${BOTIFY_SHILL_EVENTS[0].tweetId} »), horodatages à minuit`,
          required: "une nature classée sur la ligne source (INFERENCE)",
          sourceRowCount: BOTIFY_SHILL_EVENTS.length,
        },
        method: socialMethod,
        coverage: socialCoverage,
        aggregation: notAggregated(),
        // ██ P2 — la DATE, jamais l'instant. `2025-01-11T00:00:00.000Z` de la
        // colonne n'entre pas : minuit est la valeur par défaut d'un type, pas
        // une observation. INV-12 refuserait la forme complète.
        temporal: {
          resolution: "DAY",
          value: BOTIFY_SHILL_EVENTS[0].tweetTimestampIso.slice(0, 10),
          provenance: BOTIFY_SHILL_EVENTS[0].timestampSource,
        },
      }),

      // ── P1 · nature PRÉSENTE mais mauvaise ──────────────────────────────
      buildFeatureObservationV2({
        featureKey: "shill.kol_handles",
        state: "INADMISSIBLE",
        stateReason:
          `${editorial} KolTokenLink portent rowNature = EDITORIAL_ASSERTION, et les ` +
          `${BOTIFY_SHILL_EVENTS.length} ShillEvent n'ont pas de nature`,
        inadmissibility: {
          cause: "DATA_NATURE_MISMATCH",
          found: `${editorial}/${BOTIFY_KOL_TOKEN_LINKS.length} KolTokenLink en EDITORIAL_ASSERTION (sourceType manual_seed, evidenceSnapshotId NULL)`,
          required: "PRIMARY_OBSERVATION, tel que le registre déclare cette feature",
          sourceRowCount: BOTIFY_KOL_TOKEN_LINKS.length + BOTIFY_SHILL_EVENTS.length,
        },
        method: socialMethod,
        coverage: socialCoverage,
        aggregation: notAggregated(),
      }),
    ],
  };
}

// ═══ CONTRÔLE INTRA-VINE — un groupe comme sujet ══════════════════════════

export function vineGroupSubjectV2(groupKeySuffix: string): SubjectFeatureSetV2 {
  const row = VINE_COEXIT_GROUPS.find((r) => r.groupKey.endsWith(groupKeySuffix));
  if (!row) throw new Error(`[s3-extract-v2] groupe inconnu : ${groupKeySuffix}`);
  const coverage = exitCoverage([row]);
  const method = EXIT_METHOD(row.windowSeconds);
  const evidence = [
    { kind: "group_key", refs: [row.groupKey] },
    { kind: "tx_signature", refs: [row.firstTxSignature] },
    { kind: "subject_wallet", refs: [...row.subjects] },
  ];
  const gref = row.groupKey.split("@")[1];

  const categorical = (
    key: string,
    rule: "ALL_OR_NOTHING" | "DEMONSTRATED_BY_ANY",
    value: string | null,
    attribution: AttributionDetail | null,
  ) => {
    const agg = aggregateCategorical(rule, [{ groupRef: gref, value }]);
    return agg.value !== null
      ? buildFeatureObservationV2({
          featureKey: key, state: "OBSERVED",
          value: { kind: "CATEGORICAL", value: agg.value },
          method, coverage, evidence, aggregation: agg.detail, attribution,
        })
      : buildFeatureObservationV2({
          featureKey: key, state: "NOT_OBSERVED", stateReason: agg.reason!,
          method, coverage, aggregation: agg.detail, attribution,
        });
  };

  // ██ LE SUJET EST LE GROUPE. ██ La grandeur y est définie — « du premier au
  // dernier acte DU GROUPE » — donc elle est OBSERVÉE, et transportée comme
  // sous @v1. Elle n'est toujours pas JUGÉE : INV-8 refuse tout verdict sur une
  // grandeur, et le comparateur rend les deux valeurs au lecteur.
  const magnitude = (key: string, value: number, unit: string) =>
    buildFeatureObservationV2({
      featureKey: key,
      state: "OBSERVED",
      value: { kind: "ORDINAL", value, unit },
      method,
      coverage,
      evidence,
      aggregation: aggregateMagnitude([{ groupRef: gref, value }]),
    });

  return {
    subjectRef: row.groupKey,
    observations: [
      categorical("exit.cluster_category", "ALL_OR_NOTHING", row.category, null),
      categorical(
        "exit.demonstrated_venue", "DEMONSTRATED_BY_ANY", row.demonstratedVenue,
        row.demonstratedVenue ? declaredBySource(row.demonstratedVenue) : UNATTRIBUTED,
      ),
      categorical(
        "exit.demonstrated_destination", "DEMONSTRATED_BY_ANY", row.demonstratedDestination,
        ADDRESS_ATTRIBUTION,
      ),
      categorical(
        "exit.composition_profile", "ALL_OR_NOTHING",
        compositionProfile(row.sellCount, row.outgoingCount), null,
      ),
      magnitude("exit.distinct_subjects", row.distinctSubjects, "subjects"),
      magnitude("temporal.exit_cluster_span_seconds", row.spanSeconds, "seconds"),
      magnitude("temporal.exit_cluster_min_gap_seconds", row.minGapSeconds, "seconds"),
      buildFeatureObservationV2({
        featureKey: "exit.materiality",
        state: "NOT_MEASURABLE",
        stateReason: "solde antérieur non démontrable depuis les transactions collectées",
        method,
        coverage,
        aggregation: aggregateMagnitude([{ groupRef: gref, value: null }]),
      }),
      ...fundingObservationsV2(row.subjects),
    ],
  };
}
