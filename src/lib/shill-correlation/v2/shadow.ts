// --- RUNNER SHADOW — même code de décision, sink différent ----------------
//
// ██ DOCTRINE : shadow = code de décision de PRODUCTION, sink différent. ██
//
// Ce module n'implémente NI traversée NI classification. Il appelle les
// fonctions canoniques et redirige leurs écritures vers un sink injecté :
//
//   buildOccasions            (via aggregateCandidates) — repliement
//   aggregateCandidates       en dryRun — agrégation + scoring v1, ZÉRO write
//   buildCandidateNatureWrite — le fragment exact qui aurait été upserté
//   collectBaselineWindow     — collecte M1
//   runEngine                 — features, lift, classification v2
//
// AUCUN fichier de production n'est modifié. `aggregateCandidates({dryRun:true})`
// calcule tout et retourne AVANT sa boucle d'upsert : la redirection ne demande
// aucun refactor de signature, donc aucun chemin gelé (^src/app/api/,
// ^src/components/, ^prisma/) n'est touché.
//
// ─── CE QUE LE HARNAIS JUMEAU AVAIT CASSÉ, ET QUI EST RÉPARÉ ICI ──────────
//
// Le run du 2026-09-03 a produit trois défauts, TOUS dans le harnais, aucun
// dans les modules. Ils viennent de la même cause : un runner qui réimplémente
// la frontière finit par mentir au module qu'il appelle.
//
//   1. Un `collected_empty` FAUX. Le cache de pages, épuisé par la troncature
//      du budget, rendait `[]` — et le collecteur lisait légitimement « fin
//      d'historique ». Un témoin vide fabriqué depuis un budget épuisé, soit le
//      dénominateur le plus favorable qui soit.
//      RÉPARÉ : quand la traversée est tronquée, le budget passé au collecteur
//      vaut EXACTEMENT le nombre de pages disponibles. Il s'épuise donc AVANT
//      le cache, et le collecteur rend `budget_exhausted` — son mécanisme
//      normal, utilisé correctement.
//
//   2. Une fenêtre observée jamais atteinte étiquetée `fetched_empty`.
//      RÉPARÉ : une fenêtre non atteinte rend `fetch_error` + `truncatedBy`,
//      état HORS de OBSERVED_ANALYZABLE_STATES — donc jamais lu comme mesure.
//
//   3. Deux événements du même KOL+mint à 56 s traités comme deux occasions,
//      pour 55 % des crédits du run.
//      RÉPARÉ : le repliement vient de `buildOccasions`, par le chemin
//      canonique, jamais d'une logique locale.

import { buildOccasions } from "../occasions";
import {
  aggregateCandidates,
  type AggregateReport,
  type CandidateRow,
} from "../aggregate";
import {
  BUDGET_TRUNCATION_REASON,
  collectBaselineWindow,
  createCallBudget,
  type BaselineTx,
} from "./baseline";
import { buildCandidateNatureWrite } from "./persistence";
import { runEngine, type EngineResult } from "./engine";
import { onChainAnchorFromUtc, type OnChainInstant } from "./anchor";
import { resolvePostAnchor } from "../timeAnchor";
import { baselineWindow, observedWindow, zoneForDelta } from "./windows";
import { DEFAULT_ENGINE_POLICY, type EnginePolicy } from "./policy";
import type { ObservedState, OccasionRecord } from "./types";

// ═══ LE SINK ══════════════════════════════════════════════════════════════

export type ShadowRecordKind =
  | "run_header"
  | "occasion"
  | "candidate_row"
  | "engine_candidate"
  | "run_footer";

export interface ShadowRecord {
  kind: ShadowRecordKind;
  [k: string]: unknown;
}

/**
 * LA SEULE SORTIE DU RUNNER. Aucun chemin de ce module n'écrit ailleurs :
 * ni prisma, ni fichier, ni réseau. Le sink est fourni par l'appelant, qui
 * décide seul où atterrissent les lignes.
 */
export interface ShadowSink {
  write(record: ShadowRecord): void;
}

/** Sink mémoire — les tests s'en servent, la lane fichier est côté appelant. */
export function createMemorySink(): ShadowSink & { records: ShadowRecord[] } {
  const records: ShadowRecord[] = [];
  return { records, write: (r) => void records.push(r) };
}

// ═══ LA SOURCE DE PAGES ═══════════════════════════════════════════════════

/**
 * Résultat d'une traversée arrière. `truncated` est le fait qui compte : il
 * distingue « l'historique s'arrête là » de « on a arrêté de regarder », et
 * c'est exactement la distinction que le harnais jumeau avait perdue.
 */
export interface WalkResult {
  pages: BaselineTx[][];
  /** L'historique du token a été épuisé — la fenêtre est intégralement vue. */
  historyExhausted: boolean;
  /** La traversée a été bornée AVANT d'atteindre la cible. */
  truncated: boolean;
  truncatedBy: string | null;
  callsSpent: number;
}

/** Traversée injectée. Le runner n'ouvre aucune connexion réseau lui-même. */
export type MintWalker = (args: {
  mint: string;
  /** Instant le plus ancien à atteindre, en secondes unix. */
  downToSeconds: number;
  maxPages: number;
}) => Promise<WalkResult>;

export interface ShadowEventInput {
  id: string;
  kolHandle: string;
  /** ID du post — porte l'ancre canonique via son snowflake. */
  tweetId?: string | null;
  /** Adresse base58 résolue, ou null. */
  tokenMint: string | null;
  /** Timestamp du CORPUS — converti en ancre on-chain par le runner. */
  tweetTimestamp: Date;
}

export interface ShadowRunDeps {
  sink: ShadowSink;
  walk: MintWalker;
  /** Injecté pour les tests ; en production c'est `aggregateCandidates`. */
  aggregate?: (opts: { dryRun: boolean }) => Promise<AggregateReport>;
  policy?: EnginePolicy;
  /** Étiquette du lot, pour retrouver le run dans la lane. */
  runLabel?: string;
}

export interface ShadowRunResult {
  occasionsPlanned: number;
  eventsIn: number;
  records: OccasionRecord[];
  engine: EngineResult;
  aggregate: AggregateReport | null;
  callsSpent: number;
}

// ═══ LE RUNNER ════════════════════════════════════════════════════════════

/**
 * FORWARD-FIRST. `events` est une liste d'événements à traiter — fraîchement
 * arrivés en usage normal, anciens seulement pour les tests de régression et
 * de reproductibilité. Le runner ne connaît pas la différence : c'est
 * l'appelant qui choisit le lot, et c'est un geste séparé.
 *
 * Rien ici n'est un cron, ne boucle, ni ne s'auto-relance.
 */
export async function runShadow(
  events: readonly ShadowEventInput[],
  deps: ShadowRunDeps,
): Promise<ShadowRunResult> {
  const policy = deps.policy ?? DEFAULT_ENGINE_POLICY;
  const { sink } = deps;

  sink.write({
    kind: "run_header",
    runLabel: deps.runLabel ?? null,
    eventsIn: events.length,
    baselineOffsetSeconds: policy.baselineOffsetSeconds,
    baselineMaxPagesPerOccasion: policy.baselineMaxPagesPerOccasion,
    sinkOnly: true,
    prodWritesDisabled: true,
  });

  // ── 1. REPLIEMENT CANONIQUE ────────────────────────────────────────────
  // `buildOccasions` et lui seul. Deux tweets du même KOL sur le même mint à
  // 56 s ne sont PAS deux occasions : leurs fenêtres se recouvrent et
  // collectent les mêmes achats. Le harnais jumeau les payait deux fois.
  const mapping = buildOccasions(
    events.map((e) => ({
      id: e.id,
      kolHandle: e.kolHandle,
      tokenMint: e.tokenMint,
      tweetTimestamp: e.tweetTimestamp,
    })),
  );

  const byOccasion = new Map<string, ShadowEventInput[]>();
  for (const e of events) {
    const oid = mapping.occasionByEvent.get(e.id) ?? e.id;
    if (!byOccasion.has(oid)) byOccasion.set(oid, []);
    byOccasion.get(oid)!.push(e);
  }

  // ── 2. COLLECTE PAR OCCASION ───────────────────────────────────────────
  const records: OccasionRecord[] = [];
  let callsSpent = 0;

  for (const [occasionId, group] of byOccasion) {
    // L'occasion est ancrée sur son PREMIER tweet (invariant v2).
    group.sort((a, b) => a.tweetTimestamp.getTime() - b.tweetTimestamp.getTime());
    const head = group[0];
    // T3 — L'ANCRE VIENT DU SNOWFLAKE, plus d'une compensation de fuseau.
    // L'ID du post encode son instant de publication : il ne dépend d'aucun
    // fuseau, d'aucun driver, d'aucune convention de stockage. Le timestamp
    // source ne sert que lorsqu'aucun snowflake n'est exploitable.
    const resolved = resolvePostAnchor({
      tweetId: head.tweetId,
      sourceTimestamp: head.tweetTimestamp,
    });
    if (!resolved) {
      sink.write({
        kind: "occasion", occasionId, kolHandle: head.kolHandle, mint: head.tokenMint,
        foldedEvents: group.map((g) => g.id), skipped: "aucune ancre temporelle",
      });
      continue;
    }
    const anchor: OnChainInstant = onChainAnchorFromUtc(resolved.at);
    const ow = observedWindow(anchor);
    const bw = baselineWindow(anchor, policy);
    const downTo = Math.floor(bw.startMs / 1000);

    if (!head.tokenMint) {
      records.push(
        emptyRecord(occasionId, group, anchor, "not_fetched", null, "mint non résolu"),
      );
      sink.write({
        kind: "occasion", occasionId, kolHandle: head.kolHandle, mint: null,
        foldedEvents: group.map((g) => g.id), skipped: "mint_non_resolu",
      });
      continue;
    }

    // UN SEUL parcours : il traverse la fenêtre observée ET le témoin.
    const walk = await deps.walk({
      mint: head.tokenMint,
      downToSeconds: downTo,
      maxPages: policy.baselineMaxPagesPerOccasion,
    });
    callsSpent += walk.callsSpent;
    const flat = walk.pages.flat();

    // ── LA FRONTIÈRE, ET LE DÉFAUT QU'ELLE FERME ─────────────────────────
    // Quand la traversée est TRONQUÉE, le budget donné au collecteur vaut
    // exactement le nombre de pages disponibles : il s'épuise AVANT le cache,
    // donc le collecteur rend `budget_exhausted` par son mécanisme normal.
    // Sans ça, le cache rendrait `[]` et le collecteur lirait « fin
    // d'historique » — un `collected_empty` fabriqué depuis un budget épuisé.
    const budget = walk.truncated
      ? createCallBudget(walk.pages.length)
      : createCallBudget(policy.baselineMaxPagesPerOccasion);

    let cursor = 0;
    const servePage = async () => {
      const page = walk.pages[cursor] ?? [];
      cursor++;
      return page;
    };

    const bl = await collectBaselineWindow(
      { occasionId, kolHandle: head.kolHandle, mint: head.tokenMint, chain: "solana", observedAt: anchor },
      policy,
      { fetchPage: servePage as never, budget },
    );

    // ── FENÊTRE OBSERVÉE — jamais « vide » si elle n'a pas été atteinte ───
    const oStart = Math.floor(ow.startMs / 1000);
    const oEnd = Math.floor(ow.endMs / 1000);
    const reachedObserved = walk.historyExhausted || flat.some((t) => t.timestamp < oStart);

    const observations = extractObserved(flat, head.tokenMint, oStart, oEnd, anchor);
    const observedState: ObservedState = !reachedObserved
      ? "fetch_error" // hors OBSERVED_ANALYZABLE_STATES : jamais lu comme mesure
      : observations.length > 0
        ? "fetched_with_buyers"
        : "fetched_empty";

    const rec = {
      occasion: {
        occasionId,
        kolHandle: head.kolHandle,
        eventIds: group.map((g) => g.id),
        tokenMint: head.tokenMint,
        observedAt: anchor,
      },
      resolved: null,
      observedState,
      observations,
      observedStateDetail: reachedObserved
        ? null
        : `fenêtre observée JAMAIS atteinte (${walk.pages.length} page(s), tronqué par ${walk.truncatedBy ?? "?"})`,
      observedTruncatedBy: reachedObserved ? null : (walk.truncatedBy ?? BUDGET_TRUNCATION_REASON),
      baselineState: bl.baselineState,
      baselineBuys: bl.baselineBuys,
      baselineStateDetail: bl.baselineStateDetail,
      baselineTruncatedBy: bl.baselineTruncatedBy,
      baselinePrecedesTokenExistence: bl.baselinePrecedesTokenExistence,
    } as unknown as OccasionRecord;
    records.push(rec);

    sink.write({
      kind: "occasion",
      occasionId,
      kolHandle: head.kolHandle,
      mint: head.tokenMint,
      foldedEvents: group.map((g) => g.id),
      foldedCount: group.length,
      anchorOnChain: anchor.toISOString(),
      anchorProvenance: resolved.provenance,
      anchorDriftSeconds: resolved.driftSeconds,
      pagesWalked: walk.pages.length,
      walkTruncated: walk.truncated,
      historyExhausted: walk.historyExhausted,
      reachedObservedWindow: reachedObserved,
      observedState,
      observedBuyers: observations.length,
      baselineState: bl.baselineState,
      baselineBuys: bl.baselineBuys.length,
      baselineTruncatedBy: bl.baselineTruncatedBy,
      precedesTokenExistence: bl.baselinePrecedesTokenExistence ?? null,
      callsSpent: walk.callsSpent,
    });
  }

  // ── 3. MOTEUR CANONIQUE — features, lift M1, classification ────────────
  // M1 n'est calculé QUE là, au niveau (KOL, wallet) sur occasions. Aucun
  // ratio d'événement n'est produit ni présenté comme un lift.
  const engine = runEngine(records, policy);
  for (const c of engine.candidates) {
    sink.write({
      kind: "engine_candidate",
      kolHandle: c.kolHandle,
      wallet: c.wallet,
      chain: c.chain,
      observedOccasions: c.features.observedOccasions,
      baselineMeasuredOccasions: c.features.baselineMeasuredOccasions,
      baselineOccurrences: c.features.baselineOccurrences,
      lift: Number.isFinite(c.features.lift.value) ? c.features.lift.value : null,
      liftCensored: c.features.lift.censored,
      liftUnmeasurableReason: c.features.liftUnmeasurableReason,
      correlationScore: c.scores.correlationScore,
      classification: c.scores.classification,
      confidence: c.scores.confidence,
      liftCounted: c.scores.liftCounted,
      compositeRenormalized: c.scores.compositeRenormalized,
      limitations: c.scores.limitations,
      reviewStatus: c.reviewStatus,
      nature: c._nature,
    });
  }

  // ── 4. AGRÉGATION v1 — dryRun, donc AUCUN upsert ───────────────────────
  // Les lignes qui AURAIENT été écrites sont reconstruites par la fonction
  // canonique `buildCandidateNatureWrite` et envoyées au sink. C'est le sens
  // exact de « écritures redirigées » : même payload, autre destination.
  let aggReport: AggregateReport | null = null;
  const agg = deps.aggregate ?? ((o: { dryRun: boolean }) => aggregateCandidates(o));
  try {
    aggReport = await agg({ dryRun: true });
    for (const row of aggReport.candidates) {
      sink.write({ kind: "candidate_row", ...shadowRowFor(row) });
    }
  } catch (e) {
    sink.write({
      kind: "candidate_row",
      aggregateUnavailable: e instanceof Error ? e.message : String(e),
    });
  }

  sink.write({
    kind: "run_footer",
    occasions: byOccasion.size,
    eventsIn: events.length,
    engineCandidates: engine.candidates.length,
    aggregateCandidates: aggReport?.candidates.length ?? null,
    aggregateWritten: aggReport?.written ?? null, // doit rester undefined/null
    callsSpent,
    telemetry: engine.telemetry,
  });

  return {
    occasionsPlanned: byOccasion.size,
    eventsIn: events.length,
    records,
    engine,
    aggregate: aggReport,
    callsSpent,
  };
}

/**
 * La ligne EXACTE que l'upsert aurait posée, fragment de nature compris.
 * `buildCandidateNatureWrite` est la fonction canonique : le fragment n'est
 * pas reconstruit à la main, il est produit par le chokepoint S6 lui-même.
 */
function shadowRowFor(row: CandidateRow): Record<string, unknown> {
  const nature = buildCandidateNatureWrite(
    { kolHandle: row.kolHandle, wallet: row.wallet, chain: row.chain, _nature: row.nature },
    {},
    "shill/shadow.runShadow",
  );
  return {
    kolHandle: row.kolHandle,
    wallet: row.wallet,
    chain: row.chain,
    observedShillCount: row.observedShillCount,
    analyzableShillCount: row.analyzableShillCount,
    classification: row.scores.classification,
    confidence: row.scores.confidence,
    correlationScore: row.scores.correlationScore,
    excludedReason: row.excludedReason,
    ...nature,
  };
}

function extractObserved(
  txs: readonly BaselineTx[],
  mint: string,
  startSec: number,
  endSec: number,
  anchor: OnChainInstant,
) {
  const anchorSec = Math.floor(anchor.getTime() / 1000);
  const first = new Map<string, { ts: number; sig: string }>();
  for (const t of txs) {
    if (t.timestamp < startSec || t.timestamp > endSec) continue;
    for (const tt of t.tokenTransfers ?? []) {
      if (tt.mint !== mint || !tt.toUserAccount || !(tt.tokenAmount > 0)) continue;
      const prev = first.get(tt.toUserAccount);
      if (!prev || t.timestamp < prev.ts) {
        first.set(tt.toUserAccount, { ts: t.timestamp, sig: t.signature });
      }
    }
  }
  const out = [];
  for (const [wallet, a] of first) {
    const delta = a.ts - anchorSec;
    const z = zoneForDelta(delta);
    if (!z) continue;
    out.push({
      wallet,
      chain: "solana",
      behaviorType: z.type,
      deltaSecondsFromTweet: delta,
      // `firstBuyTxSignature`, PAS `txSignature`. Le harnais jumeau utilisait
      // le mauvais nom : `observationDedupKey` retombait alors sur
      // `wc|wallet|chain` et dédupliquait par WALLET au lieu de par
      // TRANSACTION. Le type l'attrape ici ; il ne l'attrapait pas là-bas,
      // parce que le harnais construisait ses objets en `as unknown`.
      firstBuyTxSignature: a.sig,
      entryAmountUsd: null,
      exitDeltaSeconds: null,
    });
  }
  return out as OccasionRecord["observations"];
}

function emptyRecord(
  occasionId: string,
  group: readonly ShadowEventInput[],
  anchor: OnChainInstant,
  observedState: ObservedState,
  truncatedBy: string | null,
  detail: string,
): OccasionRecord {
  return {
    occasion: {
      occasionId,
      kolHandle: group[0].kolHandle,
      eventIds: group.map((g) => g.id),
      tokenMint: group[0].tokenMint,
      observedAt: anchor,
    },
    resolved: null,
    observedState,
    observations: [],
    observedStateDetail: detail,
    observedTruncatedBy: truncatedBy,
    baselineState: "not_collected",
    baselineBuys: [],
    baselineStateDetail: detail,
    baselineTruncatedBy: null,
  } as unknown as OccasionRecord;
}
