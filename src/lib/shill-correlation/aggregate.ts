// src/lib/shill-correlation/aggregate.ts
// PHASE 4 + 4.5 + 4.6 — aggregate ShillBuyerObservation rows into
// ShillCorrelationCandidate per (kolHandle, wallet, chain), score, vet, persist.
//
// Unified exclusion model: every (kol,wallet,chain) gets a candidate row; the
// ones that should not surface carry an excludedReason (audit trail kept in-DB):
//   known_router    — static blacklist (PHASE 4.5, known-routers.ts)
//   high_frequency / too_many_tokens / bot_infra — dynamic Helius vetting (4.6)
// SURVIVING candidates = excludedReason IS NULL.
//
// Vetting is injected (opts.vetWallet) so this stays testable and so Helius is
// only hit for "surfacing" candidates (classification != watch / shortlisted).
// Read-only on observations/events. Idempotent upsert on the unique key.

import { prisma } from "@/lib/prisma";
import { computeCandidateScores, type CandidateScores } from "./scoring";
import { isKnownRouter } from "./known-routers";
import { buildOccasions, observationDedupKey } from "./occasions";
import type { VetVerdict } from "./vetting";

export interface CandidateRow {
  kolHandle: string;
  wallet: string;
  chain: string;
  observedShillCount: number;
  analyzableShillCount: number;
  preTweetCount: number;
  nearTweetCount: number;
  postTweetCount: number;
  distinctKolCount: number;
  exitCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  scores: CandidateScores;
  excludedReason: string | null;
  walletTxCount30d: number | null;
  walletTokenAccounts: number | null;
  walletVettedAt: Date | null;
  vetFlags: string[];
}

export interface AggregateReport {
  dryRun: boolean;
  observationsScanned: number;
  analyzableEvents: number;
  /** Unite de comptage reelle du scoring depuis le correctif #1. */
  analyzableOccasions: number;
  analyzableKols: number;
  candidates: CandidateRow[];
  surviving: CandidateRow[];
  byClassification: Record<string, number>;
  byConfidence: Record<string, number>;
  shortlistEligible: number;
  seriousCandidates: number;
  exclusions: {
    total: number;
    byReason: Record<string, number>;
    /** Exclusions HERITEES d'un run precedent, non requalifiees ici. */
    preserved: number;
    /** Exclusions posees ou confirmees par une regle du run courant. */
    applied: number;
  };
  walletsVetted: number;
  written?: number;
}

/**
 * Etat d'exclusion deja persiste pour un (kol, wallet, chain).
 * DOCTRINE RATIFIEE (2026-08-28) : une exclusion persistante ne disparait que
 * par une DECISION EXPLICITE DE LEVEE - jamais par absence de requalification
 * dans un run ulterieur. Elle vaut au-dela de high_frequency.
 */
export interface ExistingExclusion {
  excludedReason: string | null;
  walletTxCount30d: number | null;
  walletTokenAccounts: number | null;
  walletVettedAt: Date | null;
}

export interface AggregateOptions {
  dryRun?: boolean;
  /** Helius-backed vetter; called once per surfacing wallet (cached). */
  vetWallet?: (wallet: string) => Promise<VetVerdict>;
  /** Injected clock for vettedAt (deterministic in tests). */
  now?: Date;
  /**
   * Exclusions deja en base, par cle (kol, wallet, chain). Injectable pour les
   * tests ; par defaut lues sur ShillCorrelationCandidate.
   */
  loadExistingExclusions?: () => Promise<Map<string, ExistingExclusion>>;
}

async function defaultLoadExistingExclusions(): Promise<Map<string, ExistingExclusion>> {
  const rows = await prisma.shillCorrelationCandidate.findMany({
    select: {
      kolHandle: true, wallet: true, chain: true, excludedReason: true,
      walletTxCount30d: true, walletTokenAccounts: true, walletVettedAt: true,
    },
  });
  return new Map(
    rows.map((r) => [
      key(r.kolHandle, r.wallet, r.chain),
      {
        excludedReason: r.excludedReason,
        walletTxCount30d: r.walletTxCount30d,
        walletTokenAccounts: r.walletTokenAccounts,
        walletVettedAt: r.walletVettedAt,
      } as ExistingExclusion,
    ]),
  );
}

interface Agg {
  kolHandle: string;
  wallet: string;
  chain: string;
  occasionIds: Set<string>;
  /** Cles d'observation deja comptees, par occasion - evite le double comptage. */
  countedObs: Set<string>;
  pre: number;
  near: number;
  post: number;
  exitCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

const key = (kol: string, wallet: string, chain: string) =>
  `${kol} ${wallet} ${chain}`;

const tally = (vals: string[]) => {
  const out: Record<string, number> = {};
  for (const v of vals) out[v] = (out[v] ?? 0) + 1;
  return out;
};

export async function aggregateCandidates(
  opts: AggregateOptions = {},
): Promise<AggregateReport> {
  const dryRun = opts.dryRun ?? true;
  const now = opts.now ?? new Date();

  const obs = await prisma.shillBuyerObservation.findMany({
    select: {
      shillEventId: true,
      wallet: true,
      chain: true,
      behaviorType: true,
      exitDeltaSeconds: true,
      firstSeenAt: true,
      firstBuyTxSignature: true,
      shillEvent: {
        select: {
          id: true,
          kolHandle: true,
          tokenMint: true,
          tweetTimestamp: true,
        },
      },
    },
  });

  // CORRECTNESS #1 - replier les evenements en occasions AVANT tout comptage.
  // Deux tweets du meme KOL sur le meme mint a une minute d'intervalle sont une
  // seule occasion : leurs fenetres se recouvrent et collectent les memes achats.
  const eventsSeen = new Map<string, { id: string; kolHandle: string; tokenMint: string | null; tweetTimestamp: Date }>();
  for (const o of obs) eventsSeen.set(o.shillEvent.id, o.shillEvent);
  const occasions = buildOccasions([...eventsSeen.values()]);
  const occasionOf = (eventId: string) => occasions.occasionByEvent.get(eventId) ?? eventId;

  // Exclusions deja persistees - chargees AVANT toute construction, pour que
  // le defaut d'un candidat soit son etat connu, jamais `null`.
  const existing = await (opts.loadExistingExclusions ?? defaultLoadExistingExclusions)();

  const aggs = new Map<string, Agg>();
  const analyzableByKol = new Map<string, Set<string>>();
  const kolsByWallet = new Map<string, Set<string>>();

  for (const o of obs) {
    const kol = o.shillEvent.kolHandle;
    const k = key(kol, o.wallet, o.chain);

    let a = aggs.get(k);
    if (!a) {
      a = {
        kolHandle: kol,
        wallet: o.wallet,
        chain: o.chain,
        occasionIds: new Set(),
        countedObs: new Set(),
        pre: 0,
        near: 0,
        post: 0,
        exitCount: 0,
        firstSeenAt: o.firstSeenAt,
        lastSeenAt: o.firstSeenAt,
      };
      aggs.set(k, a);
    }
    const occ = occasionOf(o.shillEventId);
    a.occasionIds.add(occ);

    // Le meme achat collecte par deux evenements de la MEME occasion ne compte
    // qu'une fois : c'est une seule transaction on-chain, pas deux achats.
    const dedup = `${occ} ${observationDedupKey(o)}`;
    if (a.countedObs.has(dedup)) {
      if (o.firstSeenAt < a.firstSeenAt) a.firstSeenAt = o.firstSeenAt;
      if (o.firstSeenAt > a.lastSeenAt) a.lastSeenAt = o.firstSeenAt;
      continue;
    }
    a.countedObs.add(dedup);

    if (o.behaviorType === "pre_tweet") a.pre++;
    else if (o.behaviorType === "near_tweet") a.near++;
    else if (o.behaviorType === "post_tweet") a.post++;
    if (o.exitDeltaSeconds != null) a.exitCount++;
    if (o.firstSeenAt < a.firstSeenAt) a.firstSeenAt = o.firstSeenAt;
    if (o.firstSeenAt > a.lastSeenAt) a.lastSeenAt = o.firstSeenAt;

    if (!analyzableByKol.has(kol)) analyzableByKol.set(kol, new Set());
    analyzableByKol.get(kol)!.add(occ);

    const wk = `${o.wallet} ${o.chain}`;
    if (!kolsByWallet.has(wk)) kolsByWallet.set(wk, new Set());
    kolsByWallet.get(wk)!.add(kol);
  }

  // Score every aggregate.
  const candidates: CandidateRow[] = [];
  for (const a of aggs.values()) {
    const analyzableShillCount = analyzableByKol.get(a.kolHandle)?.size ?? 0;
    const distinctKolCount =
      kolsByWallet.get(`${a.wallet} ${a.chain}`)?.size ?? 1;
    const prior = existing.get(key(a.kolHandle, a.wallet, a.chain));
    const scores = computeCandidateScores({
      observedShillCount: a.occasionIds.size,
      analyzableShillCount,
      preTweetCount: a.pre,
      nearTweetCount: a.near,
      postTweetCount: a.post,
      exitCount: a.exitCount,
      distinctKolCount,
    });
    candidates.push({
      kolHandle: a.kolHandle,
      wallet: a.wallet,
      chain: a.chain,
      observedShillCount: a.occasionIds.size,
      analyzableShillCount,
      preTweetCount: a.pre,
      nearTweetCount: a.near,
      postTweetCount: a.post,
      distinctKolCount,
      exitCount: a.exitCount,
      firstSeenAt: a.firstSeenAt,
      lastSeenAt: a.lastSeenAt,
      scores,
      // Herite de l'etat connu. Repartir de `null` aurait fait disparaitre une
      // exclusion au seul motif que le candidat ne surface plus - c'est
      // exactement ce que la doctrine du 2026-08-28 interdit.
      excludedReason: prior?.excludedReason ?? null,
      walletTxCount30d: prior?.walletTxCount30d ?? null,
      walletTokenAccounts: prior?.walletTokenAccounts ?? null,
      walletVettedAt: prior?.walletVettedAt ?? null,
      vetFlags: [],
    });
  }

  // Exclusion pass. Static routers first (no Helius). Then dynamic vetting of
  // surfacing candidates only (classification != watch OR shortlist-eligible),
  // cached per wallet to avoid re-vetting a wallet that hits multiple KOLs.
  const vetCache = new Map<string, VetVerdict>();
  let walletsVetted = 0;
  let preservedExclusions = 0;
  let appliedExclusions = 0;
  for (const c of candidates) {
    // Regle statique : inchangee, appliquee a chaque run, sans Helius.
    if (isKnownRouter(c.wallet)) {
      c.excludedReason = "known_router";
      c.vetFlags = ["known_router"];
      appliedExclusions++;
      continue;
    }
    const surfacing =
      c.scores.classification !== "watch" || c.scores.shortlistEligible;
    if (!surfacing || !opts.vetWallet) {
      // Pas de requalification dans ce run : l'etat herite est CONSERVE tel
      // quel. Ne rien faire ici est le comportement voulu - c'est le `null`
      // d'initialisation d'avant qui effacait l'exclusion.
      if (c.excludedReason != null) preservedExclusions++;
      continue;
    }

    let verdict = vetCache.get(c.wallet);
    if (!verdict) {
      verdict = await opts.vetWallet(c.wallet);
      vetCache.set(c.wallet, verdict);
      walletsVetted++;
    }
    // Requalification EXPLICITE par la regle de vetting : son verdict fait
    // foi, y compris quand il leve l'exclusion (verdict.excludedReason null).
    c.excludedReason = verdict.excludedReason;
    c.vetFlags = verdict.flags;
    if (verdict.excludedReason != null) appliedExclusions++;
    c.walletTxCount30d = verdict.txCount30d;
    c.walletTokenAccounts = verdict.distinctTokenAccounts;
    c.walletVettedAt = now;
  }

  candidates.sort(
    (x, y) => y.scores.correlationScore - x.scores.correlationScore,
  );
  const surviving = candidates.filter((c) => c.excludedReason == null);

  const report: AggregateReport = {
    dryRun,
    observationsScanned: obs.length,
    analyzableEvents: new Set(obs.map((o) => o.shillEventId)).size,
    // Depuis le correctif #1, l'unite de comptage du scoring est l'occasion.
    // Le nombre d'evenements reste affiche : il dit ce qui a ete collecte,
    // pas ce qui a ete compte. Les deux sont vrais et ne disent pas la meme chose.
    analyzableOccasions: occasions.eventsByOccasion.size,
    analyzableKols: analyzableByKol.size,
    candidates,
    surviving,
    byClassification: tally(surviving.map((c) => c.scores.classification)),
    byConfidence: tally(surviving.map((c) => c.scores.confidence)),
    shortlistEligible: surviving.filter((c) => c.scores.shortlistEligible).length,
    seriousCandidates: surviving.filter((c) => c.scores.seriousCandidate).length,
    exclusions: {
      total: candidates.filter((c) => c.excludedReason != null).length,
      byReason: tally(
        candidates
          .map((c) => c.excludedReason)
          .filter((r): r is string => r != null),
      ),
      preserved: preservedExclusions,
      applied: appliedExclusions,
    },
    walletsVetted,
  };

  if (dryRun) return report;

  let written = 0;
  for (const c of candidates) {
    const data = {
      kolHandle: c.kolHandle,
      wallet: c.wallet,
      chain: c.chain,
      observedShillCount: c.observedShillCount,
      analyzableShillCount: c.analyzableShillCount,
      ratioObserved: c.scores.ratioObserved,
      preTweetCount: c.preTweetCount,
      nearTweetCount: c.nearTweetCount,
      postTweetCount: c.postTweetCount,
      recurrenceScore: c.scores.recurrenceScore,
      specificityScore: c.scores.specificityScore,
      timingScore: c.scores.timingScore,
      exitScore: c.scores.exitScore,
      genericSniperPenalty: c.scores.genericSniperPenalty,
      correlationScore: c.scores.correlationScore,
      confidence: c.scores.confidence,
      classification: c.scores.classification,
      excludedReason: c.excludedReason,
      walletTxCount30d: c.walletTxCount30d,
      walletTokenAccounts: c.walletTokenAccounts,
      walletVettedAt: c.walletVettedAt,
      firstSeenAt: c.firstSeenAt,
      lastSeenAt: c.lastSeenAt,
    };
    await prisma.shillCorrelationCandidate.upsert({
      where: {
        kolHandle_wallet_chain: {
          kolHandle: c.kolHandle,
          wallet: c.wallet,
          chain: c.chain,
        },
      },
      create: data,
      update: data, // reviewStatus left untouched on re-score
    });
    written++;
  }

  report.written = written;
  return report;
}
