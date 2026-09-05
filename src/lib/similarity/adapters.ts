// --- BUILD 7 / S1 — LES ADAPTATEURS ---------------------------------------
//
// PURS. Aucune base, aucun réseau. Chaque fonction prend la sortie D'UN MOTEUR
// DÉJÀ DÉMONTRÉ — le TYPE qu'il exporte, pas une requête — et rend des
// observations conformes au contrat.
//
// ██ POURQUOI CES ADAPTATEURS EXISTENT DÈS S1 ██
//
// Un contrat qui n'a jamais rencontré une sortie réelle est une intention. En
// écrivant les adaptateurs contre les types exportés par Funding Graph,
// Coordinated Exit, Shill Correlation et PRE-SHILL, on prouve que le contrat
// tient sur ce qui existe — et S3 devient de la plomberie de données, pas une
// seconde conception.
//
// ██ CE QU'ILS NE FONT PAS ██
//
// Ils ne LISENT RIEN. Aucun accès prod, aucun Helius, aucun Prisma. Les
// références de preuve (`EvidenceRef`) qui ne figurent pas dans le type amont
// sont EXIGÉES de l'appelant : les inventer serait la faute exacte que INV-7
// existe pour interdire.
//
// ─── LA RÈGLE QUI GOUVERNE TOUS LES ADAPTATEURS ──────────────────────────
//
// Une sortie amont qui signifie « pas assez pour trancher » devient un ÉTAT,
// jamais une valeur. `SharedFunderObservation.observed === false` devient
// NOT_OBSERVED avec son `reason` ; `materiality.status === "NOT_MEASURABLE"`
// devient NOT_MEASURABLE avec son `reason` ; une catégorie `UNKNOWN` est
// écartée de l'ensemble. Sans cette règle, deux sujets se ressembleraient par
// ce qu'on ignore d'eux.

import {
  FUNDING_RELATIONSHIP_METHOD_REF,
  FUNDING_RELATIONSHIP_POLICY_VERSION,
  SHARED_FUNDER_RULE_VERSION,
  FUNDING_SNAPSHOT_RULE_VERSION,
  type FundingSnapshot,
  type QualifiedFundingRelationship,
} from "@/lib/funding-graph";
import {
  CO_EXIT_RULE_VERSION,
  COORDINATED_EXIT_METHOD_REF,
  COORDINATED_EXIT_POLICY_VERSION,
  type CoExitCharacterisation,
  type CoExitGroup,
  type ExitCoverage,
} from "@/lib/coordinated-exit";
import { SOCIAL_PROMOTION_QUALIFY_V1 } from "@/lib/methodology/registry";
import {
  FRONT_RUN_RULE_VERSION,
  MIN_DISTINCT_KOLS,
  MIN_OCCASIONS,
  type WalletRecurrence,
} from "@/lib/pre-shill/frontRun";
import { ANALYSIS_WINDOW } from "@/lib/shill-correlation/types";
import type { PromotionQualification } from "@/lib/shill-correlation/qualify";
import type { ResolvedAnchor } from "@/lib/shill-correlation/timeAnchor";
import type { TokenIdentityResolution } from "@/lib/shill-correlation/tokenIdentity";
import { buildFeatureObservation, completeCoverage } from "./observation";
import type { EvidenceRef, FeatureCoverage, FeatureObservation } from "./types";

/** La version du bridge qui produit les ShillEvent dérivés. Recopiée plutôt
 *  qu'importée : `eventNature.ts` tire `writeGuard` et le registre de tables,
 *  et un adaptateur pur n'a pas à charger la couche d'écriture. La constante
 *  est vérifiée identique par un test. */
export const SHILL_FORWARD_BRIDGE_POLICY_VERSION = "shill-forward-bridge@v1";

// ═══ COUVERTURE — TRADUIRE SANS APLATIR ═══════════════════════════════════

/**
 * `ExitCoverage` porte TROIS couvertures séparées, et elles répondent à trois
 * questions différentes. On en dérive le booléen dont l'invariant a besoin, et
 * on nomme LAQUELLE a coupé — l'objet d'origine part en `upstream`, intact.
 */
export function coverageFromExit(c: ExitCoverage): FeatureCoverage {
  if (!c.anyIncomplete) return completeCoverage({ exitCoverage: c });
  const causes: string[] = [];
  if (!c.subjects.complete) {
    causes.push(`sujets ${c.subjects.subjectsCovered}/${c.subjects.subjectsAttempted}`);
  }
  if (!c.transactions.historyExhausted) {
    causes.push(`historique de transactions (${c.transactions.censoredBy ?? "non précisé"})`);
  }
  if (!c.primaryEvidence.complete) {
    causes.push(`preuve primaire (${c.primaryEvidence.reason ?? "non précisé"})`);
  }
  return { complete: false, censoredBy: causes.join(" ; "), upstream: { exitCoverage: c } };
}

/** La couverture telle que `qualifyFundingRelationship` la rend. */
export function coverageFromFundingRelationship(
  q: QualifiedFundingRelationship,
): FeatureCoverage {
  if (q.coverage.complete) return completeCoverage({ fundingCoverage: q.coverage });
  return {
    complete: false,
    censoredBy: q.coverage.censoredBy ?? "collecte bornée, cause non précisée",
    upstream: { fundingCoverage: q.coverage },
  };
}

// ═══ FUNDING GRAPH ════════════════════════════════════════════════════════

/**
 * `funding.shared_funder_addresses` + `funding.external_funder_count`.
 *
 * La photo de financement est PARTIELLE PAR CONSTRUCTION (voir l'en-tête de
 * `snapshot.ts` : une collecte cadrée sur un mint ne voit pas le financement
 * réel des wallets). L'appelant DOIT donc fournir la couverture ; il n'existe
 * pas de défaut « complet » ici, parce qu'il serait faux.
 */
export function observationsFromFundingSnapshot(
  snapshot: FundingSnapshot,
  coverage: FeatureCoverage,
): FeatureObservation[] {
  const method = {
    methodRef: null,
    ruleVersion: SHARED_FUNDER_RULE_VERSION,
    parameters: { snapshotRuleVersion: FUNDING_SNAPSHOT_RULE_VERSION },
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
          {
            kind: "tx_signature",
            refs: funders.flatMap((f) => f.links.map((l) => l.txSignature)),
          },
          { kind: "subject_wallet", refs: snapshot.subjects },
        ],
      }),
    );
  } else {
    out.push(
      buildFeatureObservation({
        featureKey: "funding.shared_funder_addresses",
        state: "NOT_OBSERVED",
        // Le motif du moteur, TEL QUEL. « no_funder_reaching_two_subjects »
        // n'est pas « pas de bailleur commun » : c'est « aucun dans cet
        // échantillon », et `edgesConsidered` dit sur quoi ça a porté.
        stateReason:
          `${snapshot.sharedFunder.diagnostic}/${snapshot.sharedFunder.reason} ` +
          `sur ${snapshot.sharedFunder.edgesConsidered} arête(s) considérée(s)`,
        method,
        coverage,
      }),
    );
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
          evidence: [{ kind: "subject_wallet", refs: snapshot.subjects }],
        })
      : buildFeatureObservation({
          featureKey: "funding.external_funder_count",
          state: "NOT_OBSERVED",
          stateReason:
            "aucune structure de bailleurs — un décompte de rien n'est pas zéro",
          method,
          coverage,
        }),
  );

  return out;
}

/**
 * `funding.relationship_categories`.
 *
 * ██ `UNKNOWN` EST ÉCARTÉ. ██ C'est l'aveu du qualificateur qu'il n'a pas de
 * quoi trancher — pas une propriété du sujet. Le garder ferait « MATCH sur
 * {UNKNOWN} » : deux affaires se ressemblant par ce qu'on ignore d'elles.
 * Quand il ne reste rien, l'état le dit et compte les écartés.
 */
export function observationsFromFundingRelationships(
  qualified: readonly QualifiedFundingRelationship[],
): FeatureObservation[] {
  const method = {
    methodRef: FUNDING_RELATIONSHIP_METHOD_REF,
    ruleVersion: FUNDING_RELATIONSHIP_POLICY_VERSION,
    parameters: {},
  };
  // La couverture la PLUS FAIBLE gouverne : une seule relation censurée suffit
  // à faire de l'ensemble un plancher.
  const censored = qualified.find((q) => !q.coverage.complete);
  const coverage = censored
    ? coverageFromFundingRelationship(censored)
    : completeCoverage({ relationships: qualified.length });

  if (qualified.length === 0) {
    return [
      buildFeatureObservation({
        featureKey: "funding.relationship_categories",
        state: "NOT_OBSERVED",
        stateReason: "aucune relation de financement qualifiée pour ce sujet",
        method,
        coverage,
      }),
    ];
  }

  const kept = qualified.filter((q) => q.category !== "UNKNOWN");
  if (kept.length === 0) {
    return [
      buildFeatureObservation({
        featureKey: "funding.relationship_categories",
        state: "NOT_OBSERVED",
        stateReason:
          `${qualified.length} relation(s) qualifiée(s), toutes en UNKNOWN — le ` +
          `qualificateur n'a pas eu de quoi trancher, ce qui ne dit rien du sujet`,
        method,
        coverage,
      }),
    ];
  }

  return [
    buildFeatureObservation({
      featureKey: "funding.relationship_categories",
      state: "OBSERVED",
      value: { kind: "SET", values: kept.map((q) => q.category) },
      method,
      coverage,
      evidence: [
        { kind: "tx_signature", refs: kept.flatMap((q) => q.evidence.txSignatures) },
        { kind: "funder_address", refs: kept.map((q) => q.funder) },
      ],
    }),
  ];
}

// ═══ COORDINATED EXIT ═════════════════════════════════════════════════════

/**
 * Les six caractéristiques que la caractérisation de co-sortie porte.
 *
 * `group` est exigé en plus de la caractérisation — comme le fait déjà
 * `buildCoExitQualificationRow` — parce que c'est lui qui porte les signatures
 * de transaction. Les relire depuis `natureBasis` marcherait aujourd'hui et
 * casserait au premier changement de forme du basis.
 */
export function observationsFromCoExit(
  characterisation: CoExitCharacterisation,
  group: CoExitGroup,
): FeatureObservation[] {
  const d = characterisation.dimensions;
  const method = {
    methodRef: COORDINATED_EXIT_METHOD_REF,
    ruleVersion: COORDINATED_EXIT_POLICY_VERSION,
    // ██ LA FENÊTRE EST DANS LA MÉTHODE, PAS DANS LES VALEURS. ██ C'est ce
    // qui rend INV-9 capable de refuser deux groupes mesurés autrement.
    parameters: {
      windowSeconds: d.canonicalProximity.windowSeconds,
      coExitRuleVersion: CO_EXIT_RULE_VERSION,
    },
  };
  const coverage = coverageFromExit(d.coverage);
  const evidence: EvidenceRef[] = [
    { kind: "tx_signature", refs: group.events.map((e) => e.txSignature) },
    { kind: "subject_wallet", refs: group.subjects },
    { kind: "mint", refs: [characterisation.mint] },
  ];

  const out: FeatureObservation[] = [
    buildFeatureObservation({
      featureKey: "exit.cluster_category",
      state: "OBSERVED",
      value: { kind: "CATEGORICAL", value: characterisation.category },
      method,
      coverage,
      evidence,
    }),
    buildFeatureObservation({
      featureKey: "exit.distinct_subjects",
      state: "OBSERVED",
      value: { kind: "ORDINAL", value: d.distinctSubjects, unit: "subjects" },
      method,
      coverage,
      evidence,
    }),
    buildFeatureObservation({
      featureKey: "exit.composition_profile",
      state: "OBSERVED",
      value: {
        kind: "CATEGORICAL",
        // Dérivé SANS SEUIL : présence ou absence de chaque type, jamais une
        // proportion. Une proportion demanderait où couper.
        value:
          d.composition.sell > 0 && d.composition.outgoingTransfer > 0
            ? "MIXED"
            : d.composition.sell > 0
              ? "SELL_ONLY"
              : "TRANSFER_ONLY",
      },
      method,
      coverage,
      evidence,
    }),
    buildFeatureObservation({
      featureKey: "temporal.exit_cluster_span_seconds",
      state: "OBSERVED",
      value: { kind: "ORDINAL", value: d.spanSeconds, unit: "seconds" },
      method,
      coverage,
      evidence,
    }),
  ];

  // Venue et destination : nommés SEULEMENT si tous les actes nomment le même.
  // `null` n'est pas « pas de venue » — c'est « pas d'unanimité démontrée ».
  out.push(
    d.demonstratedVenue
      ? buildFeatureObservation({
          featureKey: "exit.demonstrated_venue",
          state: "OBSERVED",
          value: { kind: "CATEGORICAL", value: d.demonstratedVenue },
          method,
          coverage,
          evidence,
        })
      : buildFeatureObservation({
          featureKey: "exit.demonstrated_venue",
          state: "NOT_OBSERVED",
          stateReason:
            "aucun venue unanime : au moins un acte du groupe n'en nomme pas, ou " +
            "les actes n'en nomment pas le même",
          method,
          coverage,
        }),
  );
  out.push(
    d.demonstratedDestination
      ? buildFeatureObservation({
          featureKey: "exit.demonstrated_destination",
          state: "OBSERVED",
          value: { kind: "CATEGORICAL", value: d.demonstratedDestination },
          method,
          coverage,
          evidence,
        })
      : buildFeatureObservation({
          featureKey: "exit.demonstrated_destination",
          state: "NOT_OBSERVED",
          stateReason:
            "aucune destination unanime : plusieurs destinataires, ou aucun démontré",
          method,
          coverage,
        }),
  );

  // Le plus petit écart n'existe que s'il y a une paire.
  out.push(
    d.canonicalProximity.minGapSeconds !== null
      ? buildFeatureObservation({
          featureKey: "temporal.exit_cluster_min_gap_seconds",
          state: "OBSERVED",
          value: {
            kind: "ORDINAL",
            value: d.canonicalProximity.minGapSeconds,
            unit: "seconds",
          },
          method,
          coverage,
          evidence,
        })
      : buildFeatureObservation({
          featureKey: "temporal.exit_cluster_min_gap_seconds",
          state: "NOT_OBSERVED",
          stateReason: "aucune paire dans la fenêtre canonique — aucun écart à mesurer",
          method,
          coverage,
        }),
  );

  // ██ LA MATÉRIALITÉ RESTE NON MESURABLE. ██ Sur les 6 groupes du corpus
  // démontré, `status` vaut NOT_MEASURABLE 6 fois sur 6. Et même déclarée
  // MEASURED, la caractérisation ne porte AUCUNE quantité : il n'y a rien à
  // comparer. Dans les deux cas l'état le dit, aucune valeur ne le déguise.
  out.push(
    buildFeatureObservation({
      featureKey: "exit.materiality",
      state: "NOT_MEASURABLE",
      stateReason:
        d.materiality.status === "NOT_MEASURABLE"
          ? (d.materiality.reason ??
            "solde antérieur non démontrable depuis les transactions collectées")
          : "matérialité déclarée MEASURED en amont, mais la caractérisation ne porte " +
            "aucune quantité mesurée — il n'y a rien à comparer",
      method,
      coverage,
    }),
  );

  return out;
}

// ═══ IDENTITÉ / RÉSOLUTION ════════════════════════════════════════════════

export function observationsFromTokenIdentity(
  resolution: TokenIdentityResolution,
  evidence: readonly EvidenceRef[],
): FeatureObservation[] {
  const method = {
    methodRef: SOCIAL_PROMOTION_QUALIFY_V1,
    ruleVersion: SHILL_FORWARD_BRIDGE_POLICY_VERSION,
    parameters: {},
  };
  const coverage = completeCoverage({ resolutionEvidence: resolution.evidence });

  return [
    buildFeatureObservation({
      featureKey: "identity.token_resolution_status",
      state: "OBSERVED",
      value: { kind: "CATEGORICAL", value: resolution.resolutionStatus },
      method,
      coverage,
      evidence,
    }),
    resolution.chain
      ? buildFeatureObservation({
          featureKey: "identity.chain_demonstrated",
          state: "OBSERVED",
          value: { kind: "CATEGORICAL", value: resolution.chain },
          method,
          coverage,
          evidence,
        })
      : buildFeatureObservation({
          featureKey: "identity.chain_demonstrated",
          state: "NOT_OBSERVED",
          // « 0x… » est partagé par toute la famille EVM : la forme ne démontre
          // aucune chaîne. L'absence n'est donc pas « une autre chaîne ».
          stateReason:
            "aucune chaîne démontrable depuis l'espace d'adressage du mint " +
            `(statut de résolution : ${resolution.resolutionStatus})`,
          method,
          coverage,
        }),
  ];
}

export function observationsFromAnchor(
  anchor: ResolvedAnchor | null,
  evidence: readonly EvidenceRef[],
): FeatureObservation[] {
  const method = {
    methodRef: SOCIAL_PROMOTION_QUALIFY_V1,
    ruleVersion: SHILL_FORWARD_BRIDGE_POLICY_VERSION,
    parameters: {},
  };
  const coverage = completeCoverage({ anchorDriftSeconds: anchor?.driftSeconds ?? null });

  return [
    anchor
      ? buildFeatureObservation({
          featureKey: "temporal.anchor_provenance",
          state: "OBSERVED",
          value: { kind: "CATEGORICAL", value: anchor.provenance },
          method,
          coverage,
          evidence,
        })
      : buildFeatureObservation({
          featureKey: "temporal.anchor_provenance",
          state: "NOT_OBSERVED",
          stateReason: "ni snowflake exploitable ni timestamp source — aucune ancre",
          method,
          coverage,
        }),
  ];
}

// ═══ SHILL CORRELATION ════════════════════════════════════════════════════

export function observationsFromPromotionQualification(
  qualification: PromotionQualification,
  evidence: readonly EvidenceRef[],
): FeatureObservation[] {
  return [
    buildFeatureObservation({
      featureKey: "shill.promotion_qualification",
      state: "OBSERVED",
      value: {
        kind: "CATEGORICAL",
        // L'issue du prédicat, avec le critère qui a tranché. « Qualifié » veut
        // dire EXPLOITABLE, jamais « manipulatoire ».
        value: qualification.qualified
          ? "QUALIFIED"
          : `REJECTED:${qualification.failedCriterion ?? "unspecified"}`,
      },
      method: {
        methodRef: SOCIAL_PROMOTION_QUALIFY_V1,
        ruleVersion: qualification.ruleVersion,
        parameters: { conservative: qualification.conservative },
      },
      coverage: completeCoverage({ criteria: qualification.criteria }),
      evidence,
    }),
  ];
}

/**
 * `shill.kol_handles` — NOMINATIF.
 *
 * Un recouvrement dit « les mêmes comptes ont promu dans les deux affaires ».
 * C'est une CO-OCCURRENCE de comptes : ni un réseau, ni une entente, ni une
 * affirmation sur une personne. Le drapeau nominatif voyage jusqu'au résultat
 * et sa réserve avec lui.
 */
export function observationsFromOccasionHandles(
  kolHandles: readonly string[],
  occasionIds: readonly string[],
  coverage: FeatureCoverage,
): FeatureObservation[] {
  const method = {
    methodRef: SOCIAL_PROMOTION_QUALIFY_V1,
    ruleVersion: SHILL_FORWARD_BRIDGE_POLICY_VERSION,
    parameters: {},
  };
  const handles = [...new Set(kolHandles.map((h) => h.trim()).filter(Boolean))];

  return [
    handles.length > 0
      ? buildFeatureObservation({
          featureKey: "shill.kol_handles",
          state: "OBSERVED",
          value: { kind: "SET", values: handles },
          method,
          coverage,
          evidence: [{ kind: "occasion_id", refs: occasionIds }],
        })
      : buildFeatureObservation({
          featureKey: "shill.kol_handles",
          state: "NOT_OBSERVED",
          stateReason:
            "aucune occasion de promotion démontrée pour ce sujet dans le corpus fourni",
          method,
          coverage,
        }),
  ];
}

// ═══ PRE-SHILL — EXPÉRIMENTAL ═════════════════════════════════════════════

/**
 * `preshill.front_run_wallets` — EXPÉRIMENTAL, et ça ne s'efface pas.
 *
 * La fenêtre disponible fait 600 s : c'est un FRONT-RUN, pas une accumulation
 * structurelle. Les seuils entrent en PARAMÈTRES DE MÉTHODE, jamais en
 * paramètres du comparateur : deux corpus évalués sous deux seuils ne se
 * comparent pas, et INV-9 le refusera.
 */
export function observationsFromFrontRun(
  recurrences: readonly WalletRecurrence[],
  occasionIds: readonly string[],
  coverage: FeatureCoverage,
  thresholds: { minOccasions?: number; minDistinctKols?: number } = {},
): FeatureObservation[] {
  const method = {
    methodRef: null,
    ruleVersion: FRONT_RUN_RULE_VERSION,
    parameters: {
      minOccasions: thresholds.minOccasions ?? MIN_OCCASIONS,
      minDistinctKols: thresholds.minDistinctKols ?? MIN_DISTINCT_KOLS,
      preWindowSeconds: ANALYSIS_WINDOW.preSeconds,
    },
  };
  const flagged = recurrences.filter((r) => r.qualifies).map((r) => r.wallet);

  return [
    flagged.length > 0
      ? buildFeatureObservation({
          featureKey: "preshill.front_run_wallets",
          state: "OBSERVED",
          value: { kind: "SET", values: flagged },
          method,
          coverage,
          evidence: [{ kind: "occasion_id", refs: occasionIds }],
        })
      : buildFeatureObservation({
          featureKey: "preshill.front_run_wallets",
          state: "NOT_OBSERVED",
          stateReason:
            `aucun wallet ne franchit la règle de récurrence sur ${recurrences.length} ` +
            `wallet(s) vu(s) — une limite du corpus, jamais un constat d'absence`,
          method,
          coverage,
        }),
  ];
}
