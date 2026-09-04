// src/app/api/cron/shill-shadow/route.ts
//
// --- B7 — CRON SHADOW : daily, Helius BORNÉ, sink seulement --------------
//
// Lit les ShillEvent que le feed a écrits, les passe dans le moteur canonique
// SHILL V2, et écrit le résultat dans un SINK. Jamais dans les tables
// d'analyse.
//
// ██ TROIS BORNES DURES, ET AUCUNE N'EST NÉGOCIABLE PAR CONFIGURATION ██
//
// 1. BUDGET GLOBAL PAR RUN — 100 000 crédits pour TOUT le passage, jamais par
//    événement. Un budget par événement aurait multiplié la dépense par le
//    nombre de sujets sans qu'aucune ligne ne l'annonce : vingt-cinq sujets
//    auraient coûté deux millions et demi de crédits. Au plafond, le reste du
//    lot rend BUDGET_EXHAUSTED — pas de poursuite, pas de retry. Un retry
//    silencieux transforme une borne en suggestion.
//
// 2. SÉLECTION FAIL-CLOSED — uniquement les événements dont l'ancre est
//    VÉRIFIÉE par leur snowflake. Les TEMPORAL_UNVERIFIED (21 divergentes,
//    52 sans snowflake exploitable, mesurés le 2026-09-04) restent en base et
//    sont EXCLUS. Aucun rattrapage, aucune correction massive : les traiter
//    mesurerait des fenêtres décalées, et un résultat faux coûte plus qu'un
//    résultat absent.
//
// 3. SINK SEULEMENT — aucune écriture de ShillCorrelationCandidate,
//    ShillBuyerObservation ou casefile. `runShadow` n'importe pas prisma et
//    appelle l'agrégation en dryRun ; cette route ne rouvre pas ce que le
//    runner ferme.
//
// UN SEUL PASSAGE par déclenchement. Pas de boucle interne, pas d'auto-relance.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { prodWriteGuardResponse } from "@/lib/ops/prodWriteGuard";
import {
  createMemorySink,
  runShadow,
  type MintWalker,
  type ShadowEventInput,
} from "@/lib/shill-correlation/v2/shadow";
import type { BaselineTx } from "@/lib/shill-correlation/v2/baseline";
import { checkSnowflakeConsistency } from "@/lib/shill-correlation/timeAnchor";
import { eligibleForSolanaEngine } from "@/lib/shill-correlation/eligibility";
import { DEFAULT_ENGINE_POLICY } from "@/lib/shill-correlation/v2/policy";
import { isMeasured } from "@/lib/shill-correlation/measurement";
import {
  SHADOW_CREDITS_PER_CALL,
  SHADOW_MAX_CALLS_PER_RUN,
  SHADOW_MAX_CREDITS_PER_RUN,
  SHADOW_MAX_SUBJECTS_PER_RUN,
} from "@/lib/shill-correlation/cronConfig";

export const runtime = "nodejs";
export const maxDuration = 300;

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * WATERMARK DU SHADOW — DISTINCT de celui du feed.
 *
 * Les deux crons avancent à des cadences différentes ; un curseur partagé
 * aurait fait sauter au shadow tout ce que le feed a écrit entre deux
 * passages. Celui-ci est dérivé du plus récent `createdAt` parmi les
 * événements déjà traités, transmis par l'appelant — la route le lit depuis
 * un paramètre pour rester sans état.
 */
async function readShadowWatermark(explicit: string | null): Promise<Date | null> {
  if (explicit) {
    const d = new Date(explicit);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Le shadow n'écrit pas en base, mais il DÉPENSE. La barrière évite qu'un
  // déploiement Preview consomme le budget Helius de la production.
  const blocked = prodWriteGuardResponse("/api/cron/shill-shadow");
  if (blocked) return blocked;

  const sp = req.nextUrl.searchParams;
  const since = await readShadowWatermark(sp.get("since"));
  const policy = DEFAULT_ENGINE_POLICY;

  // ── SÉLECTION FAIL-CLOSED ──────────────────────────────────────────────
  const rows = await prisma.shillEvent.findMany({
    where: {
      ...(since ? { createdAt: { gt: since } } : {}),
      chain: "solana",
      NOT: { tokenMint: null },
    },
    orderBy: { createdAt: "desc" },
    take: SHADOW_MAX_SUBJECTS_PER_RUN * 4, // marge : le filtre ancre coupe ensuite
    select: {
      id: true, kolHandle: true, tweetId: true,
      tweetTimestamp: true, tokenMint: true, chain: true, createdAt: true,
    },
  });

  const eligible: typeof rows = [];
  let temporalUnverified = 0;
  let notSolanaEligible = 0;
  for (const r of rows) {
    if (!eligibleForSolanaEngine(r)) { notSolanaEligible++; continue; }
    // L'ANCRE DOIT ÊTRE VÉRIFIÉE, pas seulement présente. `checked === false`
    // (aucun snowflake exploitable) est un REFUS, pas un laissez-passer : on
    // ne peut pas garantir la fenêtre de ce qu'on ne peut pas dater.
    const k = checkSnowflakeConsistency(r);
    if (!k.checked || !k.ok) { temporalUnverified++; continue; }
    eligible.push(r);
    if (eligible.length >= SHADOW_MAX_SUBJECTS_PER_RUN) break;
  }

  // ── LE BUDGET, PARTAGÉ PAR TOUT LE LOT ────────────────────────────────
  let calls = 0;
  let budgetHit = false;

  const walk: MintWalker = async ({ mint, downToSeconds, maxPages }) => {
    const pages: BaselineTx[][] = [];
    let before: string | undefined;
    let historyExhausted = false;
    let truncated = false;
    let truncatedBy: string | null = null;
    const spent0 = calls;

    while (pages.length < maxPages) {
      if (calls >= SHADOW_MAX_CALLS_PER_RUN) {
        budgetHit = true;
        truncated = true;
        truncatedBy = "helius_run_call_budget";
        break;
      }
      const u = new URL(`https://api.helius.xyz/v0/addresses/${mint}/transactions`);
      u.searchParams.set("api-key", process.env.HELIUS_API_KEY ?? "");
      u.searchParams.set("limit", "100");
      if (before) u.searchParams.set("before", before);

      const res = await fetch(u, { headers: { accept: "application/json" } });
      calls++;
      if (!res.ok) {
        truncated = true;
        truncatedBy = `helius_${res.status}`;
        break;
      }
      const page = (await res.json()) as BaselineTx[];
      pages.push(page);
      if (page.length === 0) { historyExhausted = true; break; }
      const last = page[page.length - 1];
      before = last.signature;
      if (last.timestamp < downToSeconds) break;
    }
    if (!historyExhausted && !truncated && pages.length >= maxPages) {
      truncated = true;
      truncatedBy = "helius_page_budget";
    }
    return { pages, historyExhausted, truncated, truncatedBy, callsSpent: calls - spent0 };
  };

  const sink = createMemorySink();
  const events: ShadowEventInput[] = eligible.map((r) => ({
    id: r.id,
    kolHandle: r.kolHandle,
    tweetId: r.tweetId,
    tokenMint: r.tokenMint,
    tweetTimestamp: r.tweetTimestamp,
  }));

  const started = new Date();
  const result = await runShadow(events, { sink, walk, policy, runLabel: "cron-shill-shadow" });

  const measured = result.engine.candidates.filter(
    (c) => isMeasured(c.features.lift) && !c.features.lift.censored,
  ).length;

  return NextResponse.json({
    ok: true,
    route: "shill-shadow",
    startedAt: started.toISOString(),
    since: since?.toISOString() ?? null,
    // Le watermark à repasser au prochain passage — la route reste sans état.
    watermarkAfter: eligible[0]?.createdAt.toISOString() ?? since?.toISOString() ?? null,
    selection: {
      scanned: rows.length,
      eligible: eligible.length,
      excludedTemporalUnverified: temporalUnverified,
      excludedNotSolanaEligible: notSolanaEligible,
      cap: SHADOW_MAX_SUBJECTS_PER_RUN,
    },
    policy: {
      baselineOffsetSeconds: policy.baselineOffsetSeconds,
      baselineMaxPagesPerOccasion: policy.baselineMaxPagesPerOccasion,
      offsetStatus: "TEMPORARILY_UNVALIDATED",
    },
    helius: {
      calls,
      credits: calls * SHADOW_CREDITS_PER_CALL,
      budget: SHADOW_MAX_CREDITS_PER_RUN,
      budgetExhausted: budgetHit,
    },
    engine: {
      occasions: result.occasionsPlanned,
      candidates: result.engine.candidates.length,
      liftMeasured: measured,
      byBaselineState: result.engine.telemetry.byBaselineState,
      byObservedState: result.engine.telemetry.byObservedState,
      liftUnmeasurable: Object.fromEntries(
        Object.entries(result.engine.telemetry.liftUnmeasurable).filter(([, v]) => v > 0),
      ),
    },
    // ██ LE SINK EST LA SEULE SORTIE ██
    sink: { records: sink.records.length, prodAnalysisWrites: 0 },
  });
}
