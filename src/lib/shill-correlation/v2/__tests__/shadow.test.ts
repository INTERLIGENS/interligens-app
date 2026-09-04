// --- Runner shadow : les trois défauts du harnais jumeau, verrouillés -----
//
// Ces tests passent par `runShadow`, donc par le CHEMIN RÉEL — buildOccasions,
// collectBaselineWindow, runEngine. Aucun n'appelle un module isolé : c'est la
// leçon des deux défauts précédents (tâche C, puis SHILL-M1 §3), où une garde
// existait et n'était pas sur le chemin.
//
// Le run du 2026-09-03 (N=5) est REJETÉ du corpus de validation. Il reste ici
// comme preuve : ces trois tests rougissent sur le harnais qui l'a produit.

import { describe, it, expect } from "vitest";
import {
  createMemorySink,
  runShadow,
  type MintWalker,
  type ShadowEventInput,
  type WalkResult,
} from "../shadow";
import { BUDGET_TRUNCATION_REASON, type BaselineTx } from "../baseline";
import { DEFAULT_ENGINE_POLICY as P } from "../policy";
import { OBSERVED_ANALYZABLE_STATES } from "../types";
import { onChainAnchorFromUtc } from "../anchor";
import { baselineWindow, observedWindow } from "../windows";

const MINT = "MintAAA";
const KOL = "empire_sol1";
/** Timestamp CORPUS — le runner le convertit lui-même en ancre on-chain. */
const TWEET = new Date("2026-06-03T18:57:31.000Z");

const anchorSec = () => Math.floor(onChainAnchorFromUtc(TWEET).getTime() / 1000);

const ev = (id: string, offsetSeconds = 0): ShadowEventInput => ({
  id,
  kolHandle: KOL,
  tweetId: null, // pas de snowflake : l'ancre retombe sur le timestamp source

  tokenMint: MINT,
  tweetTimestamp: new Date(TWEET.getTime() + offsetSeconds * 1000),
});

function tx(ts: number, wallet: string | null, sig: string): BaselineTx {
  return {
    signature: sig,
    timestamp: ts,
    type: "SWAP",
    tokenTransfers: wallet ? [{ toUserAccount: wallet, mint: MINT, tokenAmount: 5 }] : [],
  };
}

/** Une traversée TRONQUÉE : elle n'atteint jamais la cible. */
const truncatedWalk = (pages: BaselineTx[][]): MintWalker =>
  async (): Promise<WalkResult> => ({
    pages,
    historyExhausted: false,
    truncated: true,
    truncatedBy: "helius_page_budget",
    callsSpent: pages.length,
  });

/** Une traversée COMPLÈTE : l'historique du token est épuisé. */
const exhaustedWalk = (pages: BaselineTx[][]): MintWalker =>
  async (): Promise<WalkResult> => ({
    pages,
    historyExhausted: true,
    truncated: false,
    truncatedBy: null,
    callsSpent: pages.length,
  });

/** `aggregateCandidates` n'est pas sollicité : on injecte un stub inerte. */
const noAggregate = async () => {
  throw new Error("aggregate non sollicité dans ce test");
};

const occasionsOf = (sink: ReturnType<typeof createMemorySink>) =>
  sink.records.filter((r) => r.kind === "occasion");

// ═══ (a) BUDGET ÉPUISÉ AVANT LA FENÊTRE ═══════════════════════════════════

describe("(a) budget épuisé avant la fenêtre → jamais `collected_empty`", () => {
  it("une traversée tronquée rend budget_exhausted, PAS collected_empty", async () => {
    // LE DÉFAUT EXACT du run N=5 : le cache épuisé rendait `[]`, le collecteur
    // lisait « fin d'historique », et posait `collected_empty` — un témoin vide
    // FABRIQUÉ depuis un budget épuisé, soit le dénominateur le plus favorable.
    const sink = createMemorySink();
    const loin = anchorSec() + 50_000; // toujours plus récent que la fenêtre
    const r = await runShadow([ev("e1")], {
      sink,
      walk: truncatedWalk([[tx(loin, null, "s1")], [tx(loin - 10, null, "s2")]]),
      aggregate: noAggregate,
    });

    const rec = r.records[0];
    expect(rec.baselineState).toBe("budget_exhausted");
    expect(rec.baselineState).not.toBe("collected_empty");
    expect(rec.baselineTruncatedBy).toBe(BUDGET_TRUNCATION_REASON);
  });

  it("le lift en sort NON MESURÉ, sous un motif de censure", async () => {
    const sink = createMemorySink();
    const loin = anchorSec() + 50_000;
    const r = await runShadow([ev("e1")], {
      sink,
      walk: truncatedWalk([[tx(loin, null, "s1")]]),
      aggregate: noAggregate,
    });
    // Aucun candidat mesurable ne peut sortir d'un témoin censuré.
    for (const c of r.engine.candidates) {
      expect(Number.isFinite(c.features.lift.value)).toBe(false);
      expect(c.features.liftUnmeasurableReason).toBe("BASELINE_CENSORED");
    }
    expect(r.engine.telemetry.byBaselineState.budget_exhausted).toBe(1);
  });

  it("un vide RÉEL reste une mesure - la garde ne sur-refuse pas", async () => {
    // Historique épuisé pour de bon : `collected_empty` est alors honnête.
    const sink = createMemorySink();
    const r = await runShadow([ev("e1")], {
      sink,
      walk: exhaustedWalk([[tx(anchorSec() - 200_000, null, "vieux")]]),
      aggregate: noAggregate,
    });
    expect(r.records[0].baselineState).toBe("collected_empty");
    expect(r.records[0].baselineTruncatedBy).toBeNull();
  });
});

// ═══ (b) REPLIEMENT DES DOUBLONS VIA buildOccasions ═══════════════════════

describe("(b) doublons repliés par buildOccasions - le chemin canonique", () => {
  it("deux tweets du même KOL+mint à 56 s = UNE occasion, UNE traversée", async () => {
    // Le doublon réel du run N=5 : 55 % des crédits dépensés deux fois sur le
    // même token, parce que le harnais ne repliait pas.
    const sink = createMemorySink();
    let walks = 0;
    const walk: MintWalker = async (a) => {
      walks++;
      return exhaustedWalk([[tx(anchorSec() - 300, "W1", "b1")]])(a);
    };

    const r = await runShadow([ev("e1"), ev("e2", 56)], { sink, walk, aggregate: noAggregate });

    expect(r.eventsIn).toBe(2);
    expect(r.occasionsPlanned).toBe(1);
    expect(walks).toBe(1); // ← la traversée n'est PAS payée deux fois
    expect(r.records).toHaveLength(1);

    const occ = occasionsOf(sink);
    expect(occ).toHaveLength(1);
    expect(occ[0].foldedCount).toBe(2);
    expect(occ[0].foldedEvents).toEqual(["e1", "e2"]);
  });

  it("l'occasion est ancrée sur le PREMIER tweet, quel que soit l'ordre d'entrée", async () => {
    const sink = createMemorySink();
    await runShadow([ev("tard", 56), ev("tot", 0)], {
      sink,
      walk: exhaustedWalk([[]]),
      aggregate: noAggregate,
    });
    const occ = occasionsOf(sink)[0];
    expect(occ.anchorOnChain).toBe(onChainAnchorFromUtc(TWEET).toISOString());
  });

  it("deux mints DIFFÉRENTS restent deux occasions - le repliement ne sur-replie pas", async () => {
    const sink = createMemorySink();
    let walks = 0;
    const walk: MintWalker = async (a) => { walks++; return exhaustedWalk([[]])(a); };
    const r = await runShadow(
      [ev("e1"), { ...ev("e2", 56), tokenMint: "MintBBB" }],
      { sink, walk, aggregate: noAggregate },
    );
    expect(r.occasionsPlanned).toBe(2);
    expect(walks).toBe(2);
  });
});

// ═══ (c) AUCUNE FENÊTRE « VIDE » SI ELLE N'A PAS ÉTÉ ATTEINTE ════════════

describe("(c) une fenêtre non atteinte n'est jamais étiquetée vide", () => {
  it("fenêtre observée jamais atteinte → fetch_error, JAMAIS fetched_empty", async () => {
    // Le second défaut du run N=5 : 300 pages, la fenêtre jamais rejointe, et
    // l'état écrit était `fetched_empty` — « on a regardé, il n'y avait
    // personne ». C'est le défaut T1, réintroduit côté observé.
    const sink = createMemorySink();
    const loin = anchorSec() + 50_000;
    const r = await runShadow([ev("e1")], {
      sink,
      walk: truncatedWalk([[tx(loin, null, "s1")], [tx(loin - 5, null, "s2")]]),
      aggregate: noAggregate,
    });

    expect(r.records[0].observedState).toBe("fetch_error");
    expect(r.records[0].observedState).not.toBe("fetched_empty");
    expect(r.records[0].observedTruncatedBy).toBeTruthy();
    expect(r.records[0].observedStateDetail).toContain("JAMAIS atteinte");
  });

  it("l'état d'une fenêtre non atteinte est HORS des états analysables", async () => {
    // C'est ce qui garantit qu'elle ne compte à aucun dénominateur.
    const sink = createMemorySink();
    const loin = anchorSec() + 50_000;
    const r = await runShadow([ev("e1")], {
      sink,
      walk: truncatedWalk([[tx(loin, null, "s1")]]),
      aggregate: noAggregate,
    });
    expect(OBSERVED_ANALYZABLE_STATES).not.toContain(r.records[0].observedState);
    expect(r.engine.telemetry.byObservedState.fetched_empty).toBe(0);
  });

  it("une fenêtre RÉELLEMENT atteinte et vide reste `fetched_empty`", async () => {
    // La garde distingue les deux cas ; elle ne les confond pas dans l'autre sens.
    const sink = createMemorySink();
    const r = await runShadow([ev("e1")], {
      sink,
      walk: exhaustedWalk([[tx(anchorSec() - 300_000, null, "tresvieux")]]),
      aggregate: noAggregate,
    });
    expect(r.records[0].observedState).toBe("fetched_empty");
    expect(r.records[0].observedTruncatedBy).toBeNull();
  });

  it("une fenêtre atteinte AVEC acheteurs est `fetched_with_buyers`", async () => {
    const sink = createMemorySink();
    const a = anchorSec();
    const ow = observedWindow(onChainAnchorFromUtc(TWEET));
    const dedans = Math.floor(ow.startMs / 1000) + 60;
    const r = await runShadow([ev("e1")], {
      sink,
      walk: exhaustedWalk([[tx(dedans, "W1", "b1"), tx(a - 300_000, null, "vieux")]]),
      aggregate: noAggregate,
    });
    expect(r.records[0].observations).toHaveLength(1);
    expect(r.records[0].observations[0].firstBuyTxSignature).toBe("b1");
  });
});

// ═══ M1 N'EST CALCULÉ QU'AU NIVEAU RÉEL ═══════════════════════════════════

describe("pas de faux M1 : aucun ratio d'événement présenté comme lift", () => {
  it("le sink n'émet AUCUN lift au niveau occasion", async () => {
    const sink = createMemorySink();
    const bw = baselineWindow(onChainAnchorFromUtc(TWEET), P);
    const dansTemoin = Math.floor(bw.startMs / 1000) + 60;
    await runShadow([ev("e1")], {
      sink,
      walk: exhaustedWalk([[tx(dansTemoin, "W9", "t1"), tx(anchorSec() - 300_000, null, "v")]]),
      aggregate: noAggregate,
    });
    for (const occ of occasionsOf(sink)) {
      expect(occ).not.toHaveProperty("lift");
      expect(occ).not.toHaveProperty("liftRatio");
    }
  });

  it("le lift n'existe QUE sur un enregistrement (KOL, wallet)", async () => {
    const sink = createMemorySink();
    const ow = observedWindow(onChainAnchorFromUtc(TWEET));
    const dedans = Math.floor(ow.startMs / 1000) + 60;
    await runShadow([ev("e1")], {
      sink,
      walk: exhaustedWalk([[tx(dedans, "W1", "b1"), tx(anchorSec() - 300_000, null, "v")]]),
      aggregate: noAggregate,
    });
    const cands = sink.records.filter((r) => r.kind === "engine_candidate");
    for (const c of cands) {
      expect(c).toHaveProperty("wallet");
      expect(c).toHaveProperty("lift");
      // Un lift sans motif quand il est absent serait un silence.
      if (c.lift === null) expect(c.liftUnmeasurableReason).toBeTruthy();
    }
  });
});

// ═══ LE SINK EST LA SEULE SORTIE ══════════════════════════════════════════

describe("zéro write prod : le sink est la seule sortie", () => {
  it("le runner n'écrit que dans le sink, et l'en-tête le déclare", async () => {
    const sink = createMemorySink();
    await runShadow([ev("e1")], {
      sink,
      walk: exhaustedWalk([[]]),
      aggregate: noAggregate,
      runLabel: "test",
    });
    const header = sink.records.find((r) => r.kind === "run_header")!;
    expect(header.sinkOnly).toBe(true);
    expect(header.prodWritesDisabled).toBe(true);
    expect(sink.records.length).toBeGreaterThan(1);
  });

  it("aucun module de prisma n'est importé par le runner", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "..", "shadow.ts"), "utf8");
    // Le runner ne doit tenir AUCUNE référence à un client de base.
    expect(src).not.toMatch(/from ["']@\/lib\/prisma["']/);
    expect(src).not.toMatch(/prisma\.\w+\.(create|update|upsert|delete)/);
  });

  it("l'agrégation est appelée en dryRun, donc n'upsert rien", async () => {
    const sink = createMemorySink();
    const vus: { dryRun: boolean }[] = [];
    await runShadow([ev("e1")], {
      sink,
      walk: exhaustedWalk([[]]),
      aggregate: async (o) => {
        vus.push(o);
        return { dryRun: true, candidates: [], written: undefined } as never;
      },
    });
    expect(vus).toEqual([{ dryRun: true }]);
    const footer = sink.records.find((r) => r.kind === "run_footer")!;
    // `written` reste absent : la boucle d'upsert n'a jamais été atteinte.
    expect(footer.aggregateWritten ?? null).toBeNull();
  });
});
