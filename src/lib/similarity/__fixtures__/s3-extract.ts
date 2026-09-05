// --- BUILD 7 / S3 — LA POLITIQUE D'EXTRACTION -----------------------------
//
// PURE. Elle transforme le corpus relevé (./s3-corpus) en jeux de features.
//
// ██ CE QUE CE MODULE EST, ET CE QU'IL N'EST PAS ██
//
// Ce n'est PAS une modification de similarity/compare@v1. L'artefact gelé
// gouverne la COMPARAISON ; ce module gouverne ce qu'on lui DONNE. La frontière
// est celle-là, et elle est nette : le comparateur ne sait pas d'où viennent
// ses entrées, et l'extraction ne sait pas ce qu'il en fera.
//
// ██ LES QUATRE RÈGLES D'EXTRACTION, DÉCLARÉES AVANT LE RUN ██
//
//   P1  UNE LIGNE SOURCE NON CLASSÉE N'EST PAS UNE OBSERVATION DÉMONTRÉE.
//       `rowNature` NULL vaut UNCLASSIFIED, et la doctrine Data Nature refuse
//       à une donnée non classée de rien publier (I3). L'admettre ici la
//       laisserait entrer dans une comparaison sous la nature que le REGISTRE
//       déclare — c'est-à-dire sous une nature que la ligne ne porte pas.
//
//   P2  UNE NATURE NE MONTE PAS EN TRAVERSANT L'EXTRACTION.
//       Une ligne EDITORIAL_ASSERTION ne peut alimenter aucune feature déclarée
//       PRIMARY_OBSERVATION ou INFERENCE. C'est I1, appliquée une étape plus
//       tôt : si on attend le comparateur pour s'en apercevoir, il est déjà
//       trop tard — INV-6 ne compare la nature qu'au registre, pas à la source.
//
//   P3  UNE DIMENSION « PAR GROUPE » N'A PAS DE VALEUR « PAR SUJET ».
//       Le registre dit « dans le groupe » pour `exit.distinct_subjects`, « du
//       premier au dernier acte du groupe » pour le span. Une somme, une
//       moyenne ou un maximum sur six groupes fabriquerait une grandeur que
//       rien n'a mesurée. Au niveau sujet, ces features sont NOT_MEASURABLE.
//       Pour les CATÉGORIELLES, la règle amont est reprise telle quelle :
//       UNANIMITÉ (`unanimous` de coordinated-exit/qualify) — nommée seulement
//       si TOUS les groupes nomment la même valeur.
//
//   P4  UN SUJET N'EXISTE QUE SOUS SON MINT CANONIQUE.
//       `assertCanonicalMint` lève sur la clé de route BOTIFY, qui se décode
//       pourtant en 32 octets comme un vrai pubkey.
//
// ██ CE QUE L'EXTRACTION NE FAIT JAMAIS ██ Elle ne remplit pas un trou. Quand
// une feature n'est pas établissable, elle rend un ÉTAT motivé, ou rien du tout
// — et « rien du tout » devient MISSING à la comparaison, ce qui se lit.

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
import { buildFeatureObservation, completeCoverage } from "../observation";
import { assertCanonicalMint, subjectIdentity } from "../subject";
import type { FeatureCoverage, FeatureObservation, SubjectFeatureSet } from "../types";
import {
  BOTIFY_KOL_TOKEN_LINKS,
  BOTIFY_SHILL_EVENTS,
  S3_CORPUS_SOURCE,
  VINE_COEXIT_GROUPS,
  VINE_EXIT_SUBJECTS,
  VINE_FUNDING_EDGES,
  VINE_SOCIAL_STATE,
  type CoExitRow,
} from "./s3-corpus";

/**
 * La version de règle de CETTE extraction. Distincte de `similarity/compare@v1` :
 * ce n'est pas la même décision qui est versionnée, et deux runs extraits
 * autrement ne se comparent pas (INV-9 le refusera tout seul).
 */
export const S3_EXTRACT_RULE_VERSION = "similarity/s3-extract@v1";

/**
 * ██ LA COUVERTURE DU FINANCEMENT EST CENSURÉE PAR CONSTRUCTION. ██
 *
 * `funding-graph/snapshot@v1` le dit dans son en-tête : une collecte cadrée sur
 * un MINT ne voit que les transferts SOL qui accompagnent les transactions de ce
 * token. Le financement RÉEL d'un wallet — un envoi depuis un exchange, des
 * jours plus tôt — n'y figure jamais. Douze arêtes ne sont donc pas « le
 * financement de VINE » : elles en sont un PLANCHER.
 */
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

/** Couverture des groupes de co-sortie, telle que la table la porte. */
const exitCoverage = (rows: readonly CoExitRow[]): FeatureCoverage => {
  const incomplete = rows.some((r) => r.coverageAnyIncomplete);
  return incomplete
    ? {
        complete: false,
        censoredBy: "au moins un groupe porte coverageAnyIncomplete = true",
        upstream: { groups: rows.length, source: S3_CORPUS_SOURCE },
      }
    : completeCoverage({ groups: rows.length, source: S3_CORPUS_SOURCE });
};

const EXIT_METHOD = (windowSeconds: number) => ({
  methodRef: "coordinated-exit/qualify@v1",
  ruleVersion: "coordinated-exit@v1",
  parameters: { windowSeconds },
});

const IDENTITY_METHOD = {
  methodRef: null,
  ruleVersion: S3_EXTRACT_RULE_VERSION,
  parameters: {},
};

/** La règle `unanimous` de coordinated-exit, reprise telle quelle (P3). */
function unanimous<T>(values: readonly (T | null)[]): T | null {
  if (values.length === 0) return null;
  const first = values[0];
  if (first === null) return null;
  return values.every((v) => v === first) ? first : null;
}

function compositionProfile(sell: number, outgoing: number): string {
  if (sell > 0 && outgoing > 0) return "MIXED";
  return sell > 0 ? "SELL_ONLY" : "TRANSFER_ONLY";
}

/** Les arêtes du corpus, sous la forme que `buildFundingSnapshot` attend. */
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
  return VINE_FUNDING_EDGES.filter((e) => e.fromWallet === funder && set.has(e.toWallet)).map(
    (e) => ({
      fromWallet: e.fromWallet,
      toWallet: e.toWallet,
      asset: "SOL" as const,
      amountLamports: e.amountLamports,
      txSignature: e.txSignature,
      blockTimeSeconds: e.blockTimeSeconds,
      rowNature: "PRIMARY_OBSERVATION" as const,
    }),
  );
}

/**
 * Les features de financement pour un ensemble de sujets donné.
 * Utilisé au niveau SUJET (les 15 wallets de VINE) comme au niveau GROUPE
 * (le contrôle intra-VINE) — le module de financement ne connaît que des
 * sujets nommés par l'appelant, exactement comme son en-tête l'exige.
 */
export function fundingObservations(subjects: readonly string[]): FeatureObservation[] {
  const snapshot = buildFundingSnapshot({ subjects, txs: fundingTxs() });
  const coverage = fundingCoverage(VINE_FUNDING_EDGES.length, subjects.length);
  const method = {
    methodRef: null,
    ruleVersion: "funding-graph/shared-funder@v1",
    parameters: { minSharedRecipients: MIN_SHARED_RECIPIENTS },
  };
  const out: FeatureObservation[] = [];

  if (snapshot.sharedFunder.observed) {
    const funders = snapshot.sharedFunder.funders;
    out.push(
      buildFeatureObservation({
        featureKey: "funding.shared_funder_addresses",
        state: "OBSERVED",
        value: { kind: "SET", values: funders.map((f) => f.funder) },
        method,
        coverage,
        evidence: [
          { kind: "tx_signature", refs: funders.flatMap((f) => f.links.map((l) => l.txSignature)) },
          { kind: "subject_wallet", refs: [...subjects] },
        ],
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
    // P1 du contrat @v1 : UNKNOWN est écarté — c'est l'aveu du qualificateur,
    // pas une propriété du sujet.
    const kept = qualified.filter((q) => q.category !== "UNKNOWN");
    out.push(
      kept.length > 0
        ? buildFeatureObservation({
            featureKey: "funding.relationship_categories",
            state: "OBSERVED",
            value: { kind: "SET", values: kept.map((q) => q.category) },
            method: {
              methodRef: "funding-relationship/qualify@v1",
              ruleVersion: "funding-relationship@v1",
              parameters: {},
            },
            coverage,
            evidence: [
              { kind: "tx_signature", refs: kept.flatMap((q) => q.evidence.txSignatures) },
              { kind: "funder_address", refs: kept.map((q) => q.funder) },
            ],
          })
        : buildFeatureObservation({
            featureKey: "funding.relationship_categories",
            state: "NOT_OBSERVED",
            stateReason: `${qualified.length} relation(s) qualifiée(s), toutes en UNKNOWN`,
            method: {
              methodRef: "funding-relationship/qualify@v1",
              ruleVersion: "funding-relationship@v1",
              parameters: {},
            },
            coverage,
          }),
    );
  } else {
    for (const key of ["funding.shared_funder_addresses", "funding.relationship_categories"] as const) {
      out.push(
        buildFeatureObservation({
          featureKey: key,
          state: "NOT_OBSERVED",
          stateReason:
            `${snapshot.sharedFunder.diagnostic}/${snapshot.sharedFunder.reason} sur ` +
            `${snapshot.sharedFunder.edgesConsidered} arête(s) considérée(s)`,
          method:
            key === "funding.relationship_categories"
              ? { methodRef: "funding-relationship/qualify@v1", ruleVersion: "funding-relationship@v1", parameters: {} }
              : method,
          coverage,
        }),
      );
    }
  }

  const structure = snapshot.funderStructure;
  out.push(
    structure
      ? buildFeatureObservation({
          featureKey: "funding.external_funder_count",
          state: "OBSERVED",
          value: { kind: "ORDINAL", value: structure.external, unit: "funders" },
          method,
          coverage,
          evidence: [{ kind: "subject_wallet", refs: [...subjects] }],
        })
      : buildFeatureObservation({
          featureKey: "funding.external_funder_count",
          state: "NOT_OBSERVED",
          stateReason: "aucune structure de bailleurs — un décompte de rien n'est pas zéro",
          method,
          coverage,
        }),
  );
  return out;
}

/** `identity.chain_demonstrated` — démontrée par l'espace d'adressage du mint. */
function chainObservation(mint: string): FeatureObservation {
  const chain = chainForMint(assertCanonicalMint(mint, "s3-extract/chainObservation"));
  return chain
    ? buildFeatureObservation({
        featureKey: "identity.chain_demonstrated",
        state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: chain },
        method: IDENTITY_METHOD,
        coverage: completeCoverage({ mint }),
        evidence: [{ kind: "mint", refs: [mint] }],
      })
    : buildFeatureObservation({
        featureKey: "identity.chain_demonstrated",
        state: "NOT_OBSERVED",
        stateReason: "aucune chaîne démontrable depuis l'espace d'adressage du mint",
        method: IDENTITY_METHOD,
        coverage: completeCoverage({ mint }),
      });
}

// ═══ VINE — NIVEAU SUJET ══════════════════════════════════════════════════

export function vineSubject(): SubjectFeatureSet {
  const id = subjectIdentity("CASE-2025-VINE-001", "s3-extract/vine");
  const rows = VINE_COEXIT_GROUPS;
  const coverage = exitCoverage(rows);
  const method = EXIT_METHOD(unanimous(rows.map((r) => r.windowSeconds)) ?? 60);
  const evidence = [
    { kind: "group_key", refs: rows.map((r) => r.groupKey) },
    { kind: "tx_signature", refs: rows.map((r) => r.firstTxSignature) },
    { kind: "mint", refs: [id.canonicalMint] },
  ];

  // P3 — les CATÉGORIELLES par UNANIMITÉ, les grandeurs NON MESURABLES.
  const cat = unanimous(rows.map((r) => r.category));
  const venue = unanimous(rows.map((r) => r.demonstratedVenue));
  const dest = unanimous(rows.map((r) => r.demonstratedDestination));
  const profile = unanimous(rows.map((r) => compositionProfile(r.sellCount, r.outgoingCount)));

  const categorical = (
    key: string,
    value: string | null,
    absent: string,
  ): FeatureObservation =>
    value
      ? buildFeatureObservation({
          featureKey: key,
          state: "OBSERVED",
          value: { kind: "CATEGORICAL", value },
          method,
          coverage,
          evidence,
        })
      : buildFeatureObservation({
          featureKey: key,
          state: "NOT_OBSERVED",
          stateReason: absent,
          method,
          coverage,
        });

  const perGroupOnly = (key: string, what: string): FeatureObservation =>
    buildFeatureObservation({
      featureKey: key,
      state: "NOT_MEASURABLE",
      stateReason:
        `${what} est défini PAR GROUPE (${rows.length} groupes ici) ; @v1 ne déclare ` +
        `aucune règle d'agrégation au niveau sujet, et une somme, une moyenne ou un ` +
        `maximum fabriquerait une grandeur que rien n'a mesurée`,
      method,
      coverage,
    });

  return {
    subjectRef: id.subjectRef,
    observations: [
      chainObservation(id.canonicalMint),
      categorical("exit.cluster_category", cat, "catégories non unanimes entre les groupes"),
      categorical(
        "exit.demonstrated_venue",
        venue,
        `venue non unanime : ${rows.filter((r) => r.demonstratedVenue).length} groupe(s) sur ` +
          `${rows.length} nomment un venue, les autres n'en démontrent aucun`,
      ),
      categorical(
        "exit.demonstrated_destination",
        dest,
        `destination non unanime : ${rows.filter((r) => r.demonstratedDestination).length} ` +
          `groupe(s) sur ${rows.length} en démontrent une`,
      ),
      categorical(
        "exit.composition_profile",
        profile,
        "profils de composition non unanimes entre les groupes",
      ),
      perGroupOnly("exit.distinct_subjects", "le nombre de sujets distincts"),
      perGroupOnly("temporal.exit_cluster_span_seconds", "l'étendue du groupe"),
      perGroupOnly("temporal.exit_cluster_min_gap_seconds", "le plus petit écart"),
      buildFeatureObservation({
        featureKey: "exit.materiality",
        state: "NOT_MEASURABLE",
        stateReason:
          `materialityStatus = NOT_MEASURABLE sur ${rows.length} groupes sur ${rows.length} : ` +
          `le solde antérieur n'est pas démontrable depuis les transactions collectées`,
        method,
        coverage,
      }),
      ...fundingObservations(VINE_EXIT_SUBJECTS),
    ],
  };
}

// ═══ BOTIFY — NIVEAU SUJET ════════════════════════════════════════════════

export function botifySubject(): SubjectFeatureSet {
  const id = subjectIdentity("CASE-2024-BOTIFY-001", "s3-extract/botify");
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
  const editorial = BOTIFY_KOL_TOKEN_LINKS.filter(
    (l) => l.rowNature === "EDITORIAL_ASSERTION",
  ).length;

  return {
    subjectRef: id.subjectRef,
    observations: [
      chainObservation(id.canonicalMint),

      // ── P1 — les 5 ShillEvent sont UNCLASSIFIED ───────────────────────────
      buildFeatureObservation({
        featureKey: "identity.token_resolution_status",
        state: "NOT_OBSERVED",
        stateReason:
          `${BOTIFY_SHILL_EVENTS.length} ShillEvent portent resolutionStatus = ` +
          `resolved_direct, mais ${unclassified} sur ${BOTIFY_SHILL_EVENTS.length} ont ` +
          `rowNature NULL (UNCLASSIFIED) et sourcePostCandidateId NULL : la règle P1 de ` +
          `l'extraction ne les traite pas comme démontrées`,
        method: socialMethod,
        coverage: socialCoverage,
      }),

      // ── @v1 ne connaît PAS la valeur portée par le corpus ────────────────
      buildFeatureObservation({
        featureKey: "temporal.anchor_provenance",
        state: "NOT_OBSERVED",
        stateReason:
          `les ${BOTIFY_SHILL_EVENTS.length} lignes portent timestampSource = « date_only », ` +
          `valeur ABSENTE du vocabulaire fermé de @v1 (snowflake, source_timestamp) ; les ` +
          `tweetId sont des chaînes construites, pas des snowflakes X, et les horodatages ` +
          `tombent à minuit`,
        method: socialMethod,
        coverage: socialCoverage,
      }),

      // ── P2 — la nature ne monte pas en traversant l'extraction ───────────
      buildFeatureObservation({
        featureKey: "shill.kol_handles",
        state: "NOT_OBSERVED",
        stateReason:
          `${editorial} KolTokenLink sur ${BOTIFY_KOL_TOKEN_LINKS.length} portent ` +
          `rowNature = EDITORIAL_ASSERTION, alors que le registre déclare cette feature ` +
          `PRIMARY_OBSERVATION : les admettre ferait monter la nature d'un cran (P2). Les ` +
          `${BOTIFY_SHILL_EVENTS.length} ShillEvent, eux, sont UNCLASSIFIED (P1)`,
        method: socialMethod,
        coverage: socialCoverage,
      }),
    ],
  };
}

// ═══ CONTRÔLE INTRA-VINE — un groupe comme sujet ══════════════════════════
//
// ██ POURQUOI CE CONTRÔLE EXISTE ██
//
// Le run VINE↔BOTIFY rend presque tout NOT_COMPARABLE, et c'est le résultat
// juste. Mais une suite qui ne produirait QUE des refus ne distinguerait pas un
// comparateur prudent d'un comparateur mort. Ce contrôle compare deux groupes
// de co-sortie RÉELS et persistés, au niveau où les dimensions ont leur sens —
// le GROUPE, exactement ce que dit le registre. Il n'est PAS un résultat
// VINE↔BOTIFY et ne doit jamais être lu comme tel.

export function vineGroupSubject(groupKeySuffix: string): SubjectFeatureSet {
  const row = VINE_COEXIT_GROUPS.find((r) => r.groupKey.endsWith(groupKeySuffix));
  if (!row) throw new Error(`[s3-extract] groupe inconnu : ${groupKeySuffix}`);
  const coverage = exitCoverage([row]);
  const method = EXIT_METHOD(row.windowSeconds);
  const evidence = [
    { kind: "group_key", refs: [row.groupKey] },
    { kind: "tx_signature", refs: [row.firstTxSignature] },
    { kind: "subject_wallet", refs: [...row.subjects] },
  ];

  const categorical = (key: string, value: string | null, absent: string) =>
    value
      ? buildFeatureObservation({
          featureKey: key,
          state: "OBSERVED",
          value: { kind: "CATEGORICAL" as const, value },
          method,
          coverage,
          evidence,
        })
      : buildFeatureObservation({
          featureKey: key,
          state: "NOT_OBSERVED",
          stateReason: absent,
          method,
          coverage,
        });

  const ordinal = (key: string, value: number, unit: string) =>
    buildFeatureObservation({
      featureKey: key,
      state: "OBSERVED",
      value: { kind: "ORDINAL" as const, value, unit },
      method,
      coverage,
      evidence,
    });

  return {
    subjectRef: row.groupKey,
    observations: [
      categorical("exit.cluster_category", row.category, "aucune catégorie"),
      categorical(
        "exit.demonstrated_venue",
        row.demonstratedVenue,
        "aucun venue unanime dans le groupe",
      ),
      categorical(
        "exit.demonstrated_destination",
        row.demonstratedDestination,
        "aucune destination unanime dans le groupe",
      ),
      categorical(
        "exit.composition_profile",
        compositionProfile(row.sellCount, row.outgoingCount),
        "aucun acte",
      ),
      ordinal("exit.distinct_subjects", row.distinctSubjects, "subjects"),
      ordinal("temporal.exit_cluster_span_seconds", row.spanSeconds, "seconds"),
      ordinal("temporal.exit_cluster_min_gap_seconds", row.minGapSeconds, "seconds"),
      buildFeatureObservation({
        featureKey: "exit.materiality",
        state: "NOT_MEASURABLE",
        stateReason: "solde antérieur non démontrable depuis les transactions collectées",
        method,
        coverage,
      }),
      ...fundingObservations(row.subjects),
    ],
  };
}

/** Ce que VINE porte côté social, pour mémoire : un placeholder, pas un mint. */
export const VINE_SOCIAL_NOTE = VINE_SOCIAL_STATE;
