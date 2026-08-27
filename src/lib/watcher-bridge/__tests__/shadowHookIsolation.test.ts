// ─── L'ombre n'altère RIEN du chemin V1 ────────────────────────────────────
//
// C'est l'invariant qui autorise le hook à exister. V1 reste canonique : même
// verdict, même action, même écriture, que l'ombre tourne, soit éteinte, ou
// explose en vol. Ce fichier le prouve en rejouant le MÊME candidat dans les
// trois régimes et en comparant les résultats champ pour champ.
//
// Les mocks sont hissés au fichier : V1 et V3 sont tous deux remplacés ici, donc
// aucun appel réseau ne part et le seul écart possible entre les trois runs est
// le hook lui-même.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const v1Spy = vi.fn();
const v3Spy = vi.fn();

vi.mock("@/lib/token-resolution/resolveCanonicalToken", () => ({
  resolveCanonicalToken: (...args: unknown[]) => v1Spy(...args),
}));

vi.mock("@/lib/token-resolution/v3/resolve", () => ({
  resolveToken: (...args: unknown[]) => v3Spy(...args),
}));

import { promoteCandidate } from "@/lib/watcher-bridge/promoteWatcherSignalsToDraft";
import { SHADOW_LOG_TAG } from "../shadowResolveV3";
import { emptySignals, emptyTelemetry } from "@/lib/token-resolution/v3/types";

const MINT_V1 = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const MINT_V3 = "FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump";

/** Verdict V1 figé : c'est LUI qui doit gouverner, dans les trois régimes. */
const V1_RESULT = {
  status: "RESOLVED",
  confidence: "HIGH",
  method: "explicit_ca",
  canonicalMint: MINT_V1,
  chain: "SOL",
  symbol: "ALPHA",
  candidates: [{ liquidityUsd: 250_000 }],
  limitations: [],
};

/** Verdict V3 DIVERGENT : s'il fuitait, le résultat changerait visiblement. */
const V3_RESULT = {
  status: "RESOLVED",
  confidence: "MODERATE",
  method: "curated",
  callerSupport: "supported",
  selected: {
    chain: "SOL", address: MINT_V3, symbol: "BETA", name: "Beta",
    matchType: "exact", sources: ["curated"], signals: emptySignals(),
    chainInferred: false, temporal: "compatible",
  },
  candidates: [],
  excluded: [],
  conflicts: [],
  limitations: [],
  telemetry: emptyTelemetry(),
  audience: "internal",
};

function makeDb() {
  const queries: string[] = [];
  const db = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $queryRawUnsafe: vi.fn(async (q: string, ..._v: unknown[]): Promise<any> => {
      queries.push(q);
      if (q.includes('FROM "social_post_candidates" c')) {
        return [{
          id: "cand-1", handle: "bkokoski", postUrl: "https://x.com/p/1", postId: "1",
          status: "new", signalScore: 90, rawText: "$ALPHA is pumping",
          campaignId: null, toks: '["ALPHA"]', addrs: [MINT_V1],
          postedAtUtc: new Date("2024-03-01T00:00:00Z"),
          camp_priority: "HIGH", camp_kolcount: 1,
        }];
      }
      if (q.includes("RETURNING id")) return [{ id: "new-id" }];
      return [];
    }),
  };
  return { db, queries };
}

let logs: string[] = [];
let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logs = [];
  v1Spy.mockReset().mockResolvedValue(V1_RESULT);
  v3Spy.mockReset().mockResolvedValue(V3_RESULT);
  infoSpy = vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => {
    logs.push(a.map(String).join(" "));
  });
});
afterEach(() => {
  infoSpy.mockRestore();
  delete process.env.TOKEN_RESOLUTION_V3_SHADOW;
});

async function runOnce() {
  const { db } = makeDb();
  const res = await promoteCandidate(db, "cand-1", { dryRun: true });
  return res;
}

// ═══════════════════════════════════════════════════════════════════════════
describe("hook shadow — le chemin V1 est intact", () => {
  it("ombre allumée ou éteinte : résultat identique champ pour champ", async () => {
    process.env.TOKEN_RESOLUTION_V3_SHADOW = "0";
    const off = await runOnce();
    process.env.TOKEN_RESOLUTION_V3_SHADOW = "1";
    const on = await runOnce();
    expect(on).toEqual(off);
  });

  it("une ombre qui EXPLOSE ne change toujours rien", async () => {
    process.env.TOKEN_RESOLUTION_V3_SHADOW = "0";
    const off = await runOnce();
    process.env.TOKEN_RESOLUTION_V3_SHADOW = "1";
    v3Spy.mockRejectedValue(new Error("V3 a explosé en vol"));
    const boom = await runOnce();
    expect(boom).toEqual(off);
  });

  it("le mint servi reste celui de V1, jamais celui de V3", async () => {
    process.env.TOKEN_RESOLUTION_V3_SHADOW = "1";
    const res = await runOnce();
    const serialized = JSON.stringify(res);
    expect(serialized).toContain(MINT_V1);
    expect(serialized, "le contrat V3 a fuité dans le résultat V1").not.toContain(MINT_V3);
  });

  it("V1 est appelé exactement une fois, avec ses arguments d'origine", async () => {
    process.env.TOKEN_RESOLUTION_V3_SHADOW = "1";
    await runOnce();
    expect(v1Spy).toHaveBeenCalledTimes(1);
    expect(v1Spy.mock.calls[0][0]).toMatchObject({
      rawText: "$ALPHA is pumping",
      extractedCashtags: ["ALPHA"],
      chainHint: "solana",
      kolHandle: "bkokoski",
    });
  });

  it("l'ombre éteinte n'appelle pas V3 du tout", async () => {
    process.env.TOKEN_RESOLUTION_V3_SHADOW = "0";
    await runOnce();
    expect(v3Spy).not.toHaveBeenCalled();
    expect(logs.filter((l) => l.includes(SHADOW_LOG_TAG))).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("hook shadow — la comparaison sort, et elle est exploitable", () => {
  beforeEach(() => {
    process.env.TOKEN_RESOLUTION_V3_SHADOW = "1";
  });

  it("une ligne est journalisée, marquée, et porte le désaccord", async () => {
    await runOnce();
    const line = logs.find((l) => l.includes(SHADOW_LOG_TAG));
    expect(line, "aucune ligne de comparaison émise").toBeDefined();
    const cmp = JSON.parse(line!.slice(SHADOW_LOG_TAG.length).trim());
    expect(cmp.agreement).toBe("different_mint");
    expect(cmp.v1.mint).toBe(MINT_V1);
    expect(cmp.v3.mint).toBe(MINT_V3);
    expect(cmp.reason).toBeTruthy();
    expect(cmp.policyVersion).toMatch(/^v3-/);
    expect(cmp).toHaveProperty("providerUsage");
    expect(typeof cmp.latencyMs).toBe("number");
  });

  it("V3 est interrogé sur SOL seul — le surcoût de sondage est neutralisé", async () => {
    await runOnce();
    expect(v3Spy).toHaveBeenCalledTimes(1);
    expect(v3Spy.mock.calls[0][0]).toMatchObject({ allowedChains: ["SOL"] });
  });

  it("aucune donnée nominative dans la ligne, alors que l'entrée en contient", async () => {
    await runOnce();
    const line = logs.find((l) => l.includes(SHADOW_LOG_TAG))!;
    expect(line).not.toContain("bkokoski");
    expect(line).not.toContain("is pumping");
    expect(line).not.toContain("x.com");
    expect(line).not.toContain("cand-1");
  });

  it("une ombre en échec est journalisée comme telle, pas passée sous silence", async () => {
    v3Spy.mockRejectedValue(new Error("V3 a explosé en vol"));
    await runOnce();
    const line = logs.find((l) => l.includes(SHADOW_LOG_TAG));
    expect(line).toBeDefined();
    const cmp = JSON.parse(line!.slice(SHADOW_LOG_TAG.length).trim());
    expect(cmp.agreement).toBe("v3_error");
    expect(cmp.error).toContain("explosé");
  });
});
