// ─── Hook shadow V3 — la ligne de comparaison ──────────────────────────────
//
// Ce que ces tests verrouillent :
//   • la ligne porte TOUS les champs demandés — une comparaison amputée oblige
//     à rejouer le cas à la main, donc ne sert à rien ;
//   • aucune donnée nominative n'y entre, même si l'appelant en fournit ;
//   • l'ombre ne lève jamais, quoi que fasse V3.

import { describe, it, expect } from "vitest";

import {
  SHADOW_ALLOWED_CHAINS,
  SHADOW_LOG_TAG,
  shadowEnabled,
  computeAgreement,
  explainReason,
  buildShadowComparison,
  emitShadowComparison,
  startShadow,
  type ShadowInput,
} from "../shadowResolveV3";
import { POLICY_VERSION } from "@/lib/token-resolution/v3/policy";
import { emptySignals, emptyTelemetry } from "@/lib/token-resolution/v3/types";
import type { TokenCandidate, TokenResolution } from "@/lib/token-resolution/v3/types";
import type { CanonicalTokenResolution } from "@/lib/token-resolution/resolveCanonicalToken";

const MINT_A = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const MINT_B = "FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump";

function candidate(address: string): TokenCandidate {
  return {
    chain: "SOL",
    address,
    symbol: "ALPHA",
    name: "Alpha",
    matchType: "exact",
    sources: ["dexscreener"],
    signals: emptySignals(),
    chainInferred: false,
    temporal: "compatible",
  };
}

function v3Result(over: Partial<TokenResolution> = {}): TokenResolution {
  return {
    status: "RESOLVED",
    confidence: "HIGH",
    method: "explicit_ca",
    callerSupport: "supported",
    selected: candidate(MINT_A),
    candidates: [candidate(MINT_A)],
    excluded: [],
    conflicts: [],
    limitations: [],
    telemetry: emptyTelemetry(),
    audience: "internal",
    ...over,
  };
}

function v1Result(over: Partial<CanonicalTokenResolution> = {}): CanonicalTokenResolution {
  return {
    status: "RESOLVED",
    confidence: "HIGH",
    method: "explicit_ca",
    canonicalMint: MINT_A,
    chain: "SOL",
    symbol: "ALPHA",
    candidates: [],
    limitations: [],
    ...over,
  };
}

const INPUT: ShadowInput = {
  ticker: "ALPHA",
  addresses: [MINT_A],
  hasRawText: true,
  observedAt: new Date("2024-03-01T00:00:00Z"),
};

const build = (over: Parameters<typeof buildShadowComparison>[0]) => buildShadowComparison(over);

// ═══════════════════════════════════════════════════════════════════════════
describe("hook shadow — la ligne porte tous les champs", () => {
  const cmp = build({ input: INPUT, v1: v1Result(), v3: v3Result(), error: null, latencyMs: 42 });

  it("aucun champ demandé ne manque", () => {
    for (const k of [
      "policyVersion", "input", "v1", "v3", "agreement", "reason",
      "exclusionReasons", "conflictKinds", "limitations",
      "providerUsage", "latencyMs", "error",
    ]) {
      expect(cmp, `champ absent : ${k}`).toHaveProperty(k);
    }
  });

  it("l'entrée est décrite, et le périmètre est bien SOL seul", () => {
    expect(cmp.input.ticker).toBe("ALPHA");
    expect(cmp.input.addresses).toEqual([MINT_A]);
    expect(cmp.input.addressCount).toBe(1);
    expect(cmp.input.observedAt).toBe("2024-03-01T00:00:00.000Z");
    expect(cmp.input.allowedChains).toEqual([...SHADOW_ALLOWED_CHAINS]);
    expect(cmp.input.allowedChains).toEqual(["SOL"]);
  });

  it("les deux verdicts sont journalisés côte à côte", () => {
    expect(cmp.v1).toMatchObject({ status: "RESOLVED", confidence: "HIGH", mint: MINT_A });
    expect(cmp.v3).toMatchObject({ status: "RESOLVED", confidence: "HIGH", mint: MINT_A });
  });

  it("l'usage des fournisseurs et la latence sont chiffrés", () => {
    expect(cmp.providerUsage.calls).toHaveProperty("dexScreener");
    expect(cmp.providerUsage.calls).toHaveProperty("helius");
    expect(cmp.providerUsage).toHaveProperty("cacheHits");
    expect(cmp.providerUsage).toHaveProperty("failures");
    expect(cmp.providerUsage).toHaveProperty("dbQueries");
    expect(cmp.providerUsage).toHaveProperty("budgetRefusals");
    expect(cmp.latencyMs).toBe(42);
  });

  it("la version de doctrine est estampillée", () => {
    expect(cmp.policyVersion).toBe(POLICY_VERSION);
    expect(cmp.policyVersion).toMatch(/^v3-/);
  });

  it("la raison n'est jamais vide", () => {
    expect(cmp.reason.length).toBeGreaterThan(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("hook shadow — zéro donnée nominative", () => {
  it("ni handle KOL, ni texte du post, ni identifiant de candidat", () => {
    const cmp = build({
      input: { ...INPUT, hasRawText: true },
      v1: v1Result(),
      v3: v3Result(),
      error: null,
      latencyMs: 5,
    });
    const serialized = JSON.stringify(cmp);
    for (const forbidden of ["kolHandle", "rawText", "candidateId", "campaignId", "postUrl"]) {
      expect(serialized, `${forbidden} ne doit jamais sortir`).not.toContain(forbidden);
    }
  });

  it("seule la PRÉSENCE du texte brut est journalisée, jamais son contenu", () => {
    const cmp = build({
      input: { ...INPUT, hasRawText: true },
      v1: v1Result(),
      v3: v3Result(),
      error: null,
      latencyMs: 5,
    });
    expect(cmp.input.hasRawText).toBe(true);
    expect(JSON.stringify(cmp)).not.toContain("bkokoski");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("hook shadow — l'accord, et surtout le désaccord", () => {
  it.each([
    [MINT_A, MINT_A, false, "same_mint"],
    [MINT_A, MINT_B, false, "different_mint"],
    [MINT_A, null, false, "v1_only"],
    [null, MINT_B, false, "v3_only"],
    [null, null, false, "both_none"],
    [MINT_A, MINT_A, true, "v3_error"],
  ] as const)("(%s, %s, err=%s) → %s", (a, b, err, expected) => {
    expect(computeAgreement(a, b, err)).toBe(expected);
  });

  it("la casse d'une adresse ne fabrique pas un faux désaccord", () => {
    expect(computeAgreement(MINT_A, MINT_A.toUpperCase(), false)).toBe("same_mint");
  });

  it("un désaccord dit POURQUOI — le conflit V3 est nommé", () => {
    const v3 = v3Result({
      status: "CONFLICT",
      selected: null,
      conflicts: [{ kind: "contract_identity", between: ["SOL:a", "SOL:b"], detail: "" }],
    } as Partial<TokenResolution>);
    const cmp = build({ input: INPUT, v1: v1Result(), v3, error: null, latencyMs: 1 });
    expect(cmp.agreement).toBe("v1_only");
    expect(cmp.reason).toContain("contract_identity");
    expect(cmp.conflictKinds).toEqual(["contract_identity"]);
  });

  it("les motifs d'exclusion remontent, dédupliqués", () => {
    const dead = { ...candidate(MINT_B), excluded: { reason: "temporally_impossible" } };
    const v3 = v3Result({ excluded: [dead, dead] } as Partial<TokenResolution>);
    const cmp = build({ input: INPUT, v1: v1Result(), v3, error: null, latencyMs: 1 });
    expect(cmp.exclusionReasons).toEqual(["temporally_impossible"]);
    expect(cmp.v3.excludedCount).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("hook shadow — un échec V3 ne se déguise pas en accord", () => {
  it("V3 en erreur → agreement v3_error, jamais both_none", () => {
    const cmp = build({
      input: INPUT,
      v1: v1Result({ canonicalMint: undefined, status: "UNRESOLVED" }),
      v3: null,
      error: "boom",
      latencyMs: 3,
    });
    expect(cmp.agreement).toBe("v3_error");
    expect(cmp.error).toBe("boom");
    expect(cmp.reason).toContain("boom");
  });

  it("startShadow ne lève JAMAIS, même si V3 explose", async () => {
    const out = await startShadow(INPUT, {
      prisma: { $queryRawUnsafe: async () => [] as never },
      resolve: async () => {
        throw new Error("V3 a explosé");
      },
      now: () => 1000,
    });
    expect(out.v3).toBeNull();
    expect(out.error).toContain("V3 a explosé");
  });

  it("startShadow demande bien SOL seul et l'audience interne", async () => {
    let seen: unknown = null;
    await startShadow(INPUT, {
      prisma: { $queryRawUnsafe: async () => [] as never },
      resolve: async (req) => {
        seen = req;
        return v3Result();
      },
    });
    expect(seen).toMatchObject({ allowedChains: ["SOL"], audience: "internal" });
    // Le texte brut ne descend PAS dans V3 : rien à journaliser par accident.
    expect((seen as { rawText?: unknown }).rawText).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("hook shadow — coupe-circuit et émission", () => {
  it("actif par défaut, éteint uniquement sur =0", () => {
    expect(shadowEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(shadowEnabled({ TOKEN_RESOLUTION_V3_SHADOW: "1" } as never)).toBe(true);
    expect(shadowEnabled({ TOKEN_RESOLUTION_V3_SHADOW: "0" } as never)).toBe(false);
  });

  it("la ligne sort sur le journal applicatif, sous une étiquette repérable", () => {
    const seen: string[] = [];
    emitShadowComparison(
      build({ input: INPUT, v1: v1Result(), v3: v3Result(), error: null, latencyMs: 1 }),
      (tag, payload) => seen.push(tag, payload),
    );
    expect(seen[0]).toBe(SHADOW_LOG_TAG);
    expect(JSON.parse(seen[1])).toHaveProperty("agreement", "same_mint");
  });

  it("un journal qui casse ne casse pas l'appelant", () => {
    expect(() =>
      emitShadowComparison(
        build({ input: INPUT, v1: v1Result(), v3: v3Result(), error: null, latencyMs: 1 }),
        () => {
          throw new Error("journal HS");
        },
      ),
    ).not.toThrow();
  });

  it("explainReason couvre chaque cas d'accord", () => {
    for (const a of ["same_mint", "different_mint", "v1_only", "v3_only", "both_none"] as const) {
      expect(explainReason(a, v3Result(), null).length).toBeGreaterThan(3);
    }
  });
});
