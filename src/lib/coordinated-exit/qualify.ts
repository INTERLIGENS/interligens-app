// --- BUILD 6 / PACK B — CARACTÉRISATION D'UNE CO-SORTIE -------------------
//
// PURE. Aucun réseau, aucune base.
//
// ██ TROIS COUCHES, ET ELLES NE SE TOUCHENT PAS ██
//
//   OBSERVATION       l'ExitEvent — PRIMARY_OBSERVATION, un acte constaté
//   CARACTÉRISATION   ce module — une INFERENCE, des dimensions mesurées
//   INTERPRÉTATION    « coordination », « dump », « intention » — HORS BUILD
//
// Plusieurs wallets qui vendent à quelques secondes d'écart est un FAIT. Ce que
// ce fait signifie est une autre question, et ce module ne la tranche pas. Il
// décrit le groupe selon des dimensions fixes, et s'arrête là.
//
// La règle gelée : content/methodologies/coordinated-exit/v1.md.

import {
  buildInferenceEnvelope,
  type InferenceEnvelopeV2,
} from "@/lib/data-nature/inferenceEnvelope";
import type { CoExitGroup, ExitCoverage } from "./coExit";
import type { ExitEvent } from "./types";

export const COORDINATED_EXIT_METHOD_REF = "coordinated-exit/qualify@v1";
export const COORDINATED_EXIT_POLICY_VERSION = "coordinated-exit@v1";

/**
 * ██ LA PROPRIÉTÉ STRUCTURELLE — EXÉCUTABLE, PAS DOCUMENTAIRE ██
 *
 * Un commentaire ne refuse rien. Cette constante est le texte de l'invariant ;
 * `assertSellProvenanceInvariant` en est l'application.
 */
export const SELL_PROVENANCE_INVARIANT =
  "SELL requires demonstrated transactional counterparty provenance. " +
  "Atomic co-occurrence alone is insufficient. " +
  "Rent recovery is not sale consideration.";

export class SellProvenanceInvariantError extends Error {
  readonly txSignature: string;
  constructor(txSignature: string, basis: string) {
    super(
      `[coordinated-exit] ${SELL_PROVENANCE_INVARIANT}\n` +
        `  tx    ${txSignature}\n` +
        `  basis ${basis}\n` +
        `Un événement typé SELL dont la provenance de contrepartie n'est pas ` +
        `démontrée est REFUSÉ à l'entrée. Le refus LÈVE plutôt qu'il ne dégrade : ` +
        `caractériser une vente non démontrée poserait tout le groupe sur une ` +
        `preuve qui n'existe pas.`,
    );
    this.name = "SellProvenanceInvariantError";
    this.txSignature = txSignature;
  }
}

/** Applique l'invariant R1. LÈVE — ne corrige pas, ne rétrograde pas. */
export function assertSellProvenanceInvariant(events: readonly ExitEvent[]): void {
  for (const e of events) {
    if (e.type !== "SELL") continue;
    const demonstrated =
      e.evidenceProvenance.basis === "swap_counter_asset_same_tx" &&
      e.observedCounterpartyAsset !== null;
    if (!demonstrated) {
      throw new SellProvenanceInvariantError(e.txSignature, e.evidenceProvenance.basis);
    }
  }
}

// ═══ LA CATÉGORIE — UNE SEULE, ET C'EST DÉLIBÉRÉ ══════════════════════════
//
// ██ NARROW_WINDOW_CLUSTER N'EST PAS COORDINATED_EXIT. ██
//
// Aucune proximité temporelle, si serrée soit-elle, ne démontre l'intention, la
// coordination, le dump ou la faute. Des wallets se groupent parce qu'un
// graphique a bougé, qu'un post est tombé, qu'un stop-loss s'est déclenché,
// qu'un opérateur détient plusieurs clés. Ce sont des mondes différents qui
// produisent les mêmes secondes.
//
// V1 ne définit qu'une catégorie, et c'est un choix : une seconde — « serré »
// contre « lâche », « grand » contre « petit » — exigerait un seuil qu'aucune
// mesure n'appuie. Un seuil choisi pour que les groupes tombent d'un côté n'est
// pas un constat sur le monde. Les dimensions sont publiées ; le lecteur peut
// tracer la ligne, à découvert.

export type CoExitCategory = "NARROW_WINDOW_CLUSTER";

export type MaterialityStatus = "MEASURED" | "NOT_MEASURABLE";

export interface CoExitCharacterisation {
  ruleVersion: string;
  category: CoExitCategory;
  /** Le rappel que la catégorie n'est pas un verdict, transporté avec elle. */
  categoryMeaning: string;
  mint: string;
  dimensions: {
    /** 1. Wallets DIFFÉRENTS. Un wallet qui sort deux fois n'est pas un groupe. */
    distinctSubjects: number;
    /** 2. La fenêtre canonique, et ce qu'elle contient. */
    canonicalProximity: {
      windowSeconds: number;
      pairsWithinWindow: number;
      minGapSeconds: number | null;
      medianGapSeconds: number | null;
    };
    /** 3. Du premier au dernier. Distinct de la proximité — le chaînage étire. */
    spanSeconds: number;
    /** 4. Nommés seulement si TOUS les événements nomment le même. */
    demonstratedVenue: string | null;
    demonstratedDestination: string | null;
    /** 5. Un transfert déplace, une vente cède. Jamais interchangeables. */
    composition: { sell: number; outgoingTransfer: number; total: number };
    /** 6. Les trois couvertures, séparées. */
    coverage: ExitCoverage;
    /** 7. NOT_MEASURABLE reste NOT_MEASURABLE. */
    materiality: { status: MaterialityStatus; reason: string | null };
  };
  natureBasis: InferenceEnvelopeV2;
}

export const CATEGORY_MEANING =
  "NARROW_WINDOW_CLUSTER: at least two distinct subjects exiting the same mint within " +
  "the canonical proximity window. Structural restatement of what was observed. " +
  "IT IS NOT COORDINATED_EXIT: no temporal proximity demonstrates intent, coordination, " +
  "dumping or fault.";

export interface QualifyCoExitInput {
  group: CoExitGroup;
  coverage: ExitCoverage;
  /**
   * Statut de matérialité, décidé par l'appelant qui sait si le solde antérieur
   * était démontrable. `NOT_MEASURABLE` par défaut : ne pas savoir n'autorise
   * pas à supposer.
   */
  materiality?: { status: MaterialityStatus; reason: string | null };
}

/** Médiane entière, sans interpolation — les écarts sont des secondes entières. */
function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Nommé seulement si TOUS le nomment, et le même. Sinon null. */
function unanimous(values: readonly (string | null)[]): string | null {
  if (values.length === 0) return null;
  const first = values[0];
  if (first === null) return null;
  return values.every((v) => v === first) ? first : null;
}

/**
 * Caractérise UN groupe de co-sortie.
 *
 * ██ NE LIT JAMAIS `observedCounterpartyAmount`. ██ Ce champ porte UNE
 * contrepartie observée, pas le total encaissé ; l'additionner produirait un
 * chiffre de produit que rien ne soutient. Aucune somme, aucun P&L ne sort
 * d'ici — un test le fixe sur le source, pas ce commentaire.
 */
export function qualifyCoExit(input: QualifyCoExitInput): CoExitCharacterisation {
  const g = input.group;
  // L'invariant D'ABORD : caractériser une vente non démontrée poserait le
  // groupe entier sur une preuve absente.
  assertSellProvenanceInvariant(g.events);

  const gaps = g.pairs.map((p) => p.deltaSeconds);
  const materiality = input.materiality ?? {
    status: "NOT_MEASURABLE" as const,
    reason: "pre-exit balance not demonstrable from collected transactions",
  };

  const natureBasis = buildInferenceEnvelope(
    {
      primaryObservations: [
        {
          kind: "exit_event",
          count: g.events.length,
          refs: {
            mint: g.mint,
            subjects: g.subjects,
            txSignatures: g.events.map((e) => e.txSignature),
            earliestBlockTimeSeconds: g.earliestBlockTimeSeconds,
            latestBlockTimeSeconds: g.latestBlockTimeSeconds,
          },
        },
        {
          // La relation temporelle est DÉRIVÉE DÉTERMINISTEMENT des block times
          // ci-dessus : c'est de la soustraction, pas une inférence.
          kind: "derived_temporal_relation",
          count: g.pairs.length,
          refs: { windowSeconds: g.windowSeconds, gapsSeconds: gaps },
        },
      ],
      methodology: {
        methodRef: COORDINATED_EXIT_METHOD_REF,
        outcome: { category: "NARROW_WINDOW_CLUSTER", distinctSubjects: g.subjects.length },
      },
      reservations: [
        "CHARACTERISATION IS NOT INTERPRETATION — no score, ranking, risk level or verdict is produced.",
        "NARROW_WINDOW_CLUSTER IS NOT COORDINATED_EXIT — proximity alone demonstrates nothing about intent.",
        "observedCounterpartyAmount IS NEVER SUMMED — this methodology yields no proceeds figure and no P&L.",
        ...(input.coverage.anyIncomplete
          ? ["COVERAGE INCOMPLETE — the characterisation is a FLOOR, never an absence."]
          : []),
        ...(materiality.status === "NOT_MEASURABLE"
          ? ["MATERIALITY NOT_MEASURABLE — no material-exit claim is made."]
          : []),
      ],
      policyVersion: COORDINATED_EXIT_POLICY_VERSION,
    },
    "qualifyCoExit",
  );

  return {
    ruleVersion: COORDINATED_EXIT_METHOD_REF,
    category: "NARROW_WINDOW_CLUSTER",
    categoryMeaning: CATEGORY_MEANING,
    mint: g.mint,
    dimensions: {
      distinctSubjects: g.subjects.length,
      canonicalProximity: {
        windowSeconds: g.windowSeconds,
        pairsWithinWindow: g.pairs.length,
        minGapSeconds: gaps.length ? Math.min(...gaps) : null,
        medianGapSeconds: median(gaps),
      },
      spanSeconds: g.spanSeconds,
      demonstratedVenue: unanimous(g.events.map((e) => e.venue)),
      demonstratedDestination: unanimous(g.events.map((e) => e.destination)),
      composition: {
        sell: g.events.filter((e) => e.type === "SELL").length,
        outgoingTransfer: g.events.filter((e) => e.type === "OUTGOING_TRANSFER").length,
        total: g.events.length,
      },
      coverage: input.coverage,
      materiality,
    },
    natureBasis,
  };
}
