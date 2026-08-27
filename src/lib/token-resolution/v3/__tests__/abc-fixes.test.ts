// ─── Fixes A + B + C — tests des règles ratifiées ──────────────────────────
// A est couvert par frr-corpus.test.ts (les 5 faux CRITICAL).
// Ce fichier couvre B (sources temporelles) et C (les trois curseurs).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import { bindChains, mergeSignals, hasCuratedBacking } from "../candidates";
import { applyTemporal, assessTemporal, isContractRelativeDate } from "../temporal";
import { DEFAULT_POLICY } from "../policy";
import { emptySignals, type TokenCandidate } from "../types";
import { resolveToken } from "../resolve";
import { ResolutionCache } from "../providers/cache";
import { createFixtureHttpClient } from "../providers/fixtureHttp";
import { createProviderContext } from "../providers";
import { createFakeDb } from "./helpers";

const SOL_A = "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJQ";
const EVM_A = "0x7ec43cf65f1663f820427c62a5780b8f2e25593a";
const OBSERVED = new Date("2024-03-01T00:00:00Z");
const MS_DAY = 86_400_000;

function cand(over: Partial<TokenCandidate> = {}): TokenCandidate {
  return {
    chain: "SOL",
    address: SOL_A,
    symbol: "SWIF",
    name: null,
    matchType: "exact",
    sources: ["dexscreener"],
    signals: { ...emptySignals(), liquidityUsd: 50_000 },
    chainInferred: false,
    temporal: "unknown",
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
describe("B — seule une date relative au CONTRAT peut dater un contrat", () => {
  it("une date d'écriture de relation (curated) n'alimente jamais firstSeenAt", () => {
    const merged = mergeSignals(
      emptySignals(),
      { firstSeenAt: Date.parse("2026-01-01"), firstSeenSource: "curated" },
      "curated",
    );
    expect(merged.firstSeenAt).toBeNull();
    expect(merged.firstSeenSource).toBeNull();
  });

  it("une date de post (mentions) n'alimente jamais firstSeenAt", () => {
    // La date du post est une borne HAUTE de l'observation : elle prouve que le
    // contrat existait au plus tard alors, jamais qu'il est né alors.
    const merged = mergeSignals(
      emptySignals(),
      { firstSeenAt: Date.parse("2025-06-01"), firstSeenSource: "mentions" },
      "mentions",
    );
    expect(merged.firstSeenAt).toBeNull();
  });

  it("seules launchAt, tgeDate et pairCreatedAt datent le contrat", () => {
    expect(isContractRelativeDate("launch_metric")).toBe(true);
    expect(isContractRelativeDate("casefile")).toBe(true);
    expect(isContractRelativeDate("dexscreener")).toBe(true);
    expect(isContractRelativeDate("curated")).toBe(false);
    expect(isContractRelativeDate("mentions")).toBe(false);
    expect(isContractRelativeDate("price_tracker")).toBe(false);
    expect(isContractRelativeDate("scan_aggregate")).toBe(false);
    expect(isContractRelativeDate(null)).toBe(false);
  });

  it("un post daté 2025 ne rend pas un contrat impossible face à une observation 2024", () => {
    // C'est le faux négatif que la règle canonique supprime : le contrat était
    // écarté sur la foi d'une date qui ne le concernait pas.
    const fromPost = cand({
      sources: ["mentions"],
      signals: {
        ...emptySignals(),
        firstSeenAt: Date.parse("2025-06-01"),
        firstSeenSource: "mentions",
      },
    });
    // Même en injectant la date de force, le verdict ne peut pas conclure :
    // la source n'est pas contractuelle, donc le moteur l'a déjà neutralisée.
    const merged = mergeSignals(emptySignals(), fromPost.signals, "mentions");
    const neutralised = { ...fromPost, signals: merged };
    expect(assessTemporal(neutralised, OBSERVED, DEFAULT_POLICY).verdict).toBe("unknown");
    expect(applyTemporal([neutralised], OBSERVED, DEFAULT_POLICY)[0].excluded).toBeUndefined();
  });

  it("une preuve de naissance postérieure exclut, une preuve d'activité tolère le décalage", () => {
    const at = OBSERVED.getTime() + 10 * MS_DAY;
    const birth = cand({
      signals: { ...emptySignals(), firstSeenAt: at, firstSeenSource: "launch_metric" },
    });
    const activity = cand({
      signals: { ...emptySignals(), firstSeenAt: at, firstSeenSource: "dexscreener" },
    });
    expect(assessTemporal(birth, OBSERVED, DEFAULT_POLICY).verdict).toBe("impossible");
    expect(assessTemporal(activity, OBSERVED, DEFAULT_POLICY).verdict).toBe("compatible");
  });

  it("le SQL ne lit plus ni createdAt ni postedAt pour dater un contrat", () => {
    const db = readFileSync(join(__dirname, "..", "sources", "db.ts"), "utf8");
    const code = db
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n");
    expect(/"createdAt"/.test(code)).toBe(false);
    expect(/"postedAt"/.test(code)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("C — curatedRequiresChainBinding, les deux régimes", () => {
  const curatedOffChain = cand({
    chain: "BSC",
    address: EVM_A,
    symbol: "LAB",
    sources: ["curated"],
  });

  it("true (défaut) : la curation ne peut pas écraser une contradiction de chaîne", () => {
    const [out] = bindChains([curatedOffChain], ["SOL"], DEFAULT_POLICY);
    expect(out.excluded?.reason).toBe("chain_not_allowed");
    expect(out.chainBindingWaived).toBeUndefined();
  });

  it("false : régime permissif EXPLICITE, et toujours tracé", () => {
    const [out] = bindChains([curatedOffChain], ["SOL"], {
      ...DEFAULT_POLICY,
      curatedRequiresChainBinding: false,
    });
    expect(out.excluded).toBeUndefined();
    expect(out.chainBindingWaived).toBe(true);
  });

  it("le régime permissif ne profite QU'À la curation", () => {
    const marketOffChain = cand({ chain: "BSC", address: EVM_A, sources: ["dexscreener"] });
    expect(hasCuratedBacking(marketOffChain)).toBe(false);
    const [out] = bindChains([marketOffChain], ["SOL"], {
      ...DEFAULT_POLICY,
      curatedRequiresChainBinding: false,
    });
    expect(out.excluded?.reason).toBe("chain_not_allowed");
  });
});

describe("C — curatedRequiresTemporalCompatibility, les deux régimes", () => {
  const curatedImpossible = cand({
    sources: ["curated", "launch_metric"],
    signals: {
      ...emptySignals(),
      firstSeenAt: Date.parse("2026-06-01"),
      firstSeenSource: "launch_metric",
    },
  });

  it("true (défaut) : la curation ne peut pas écraser une impossibilité temporelle", () => {
    const [out] = applyTemporal([curatedImpossible], OBSERVED, DEFAULT_POLICY);
    expect(out.excluded?.reason).toBe("temporally_impossible");
    expect(out.temporalWaived).toBeUndefined();
  });

  it("false : régime permissif EXPLICITE, et toujours tracé", () => {
    const [out] = applyTemporal([curatedImpossible], OBSERVED, {
      ...DEFAULT_POLICY,
      curatedRequiresTemporalCompatibility: false,
    });
    expect(out.excluded).toBeUndefined();
    expect(out.temporal).toBe("impossible");
    expect(out.temporalWaived).toBe(true);
  });

  it("le régime permissif ne profite QU'À la curation", () => {
    const marketImpossible = cand({
      sources: ["dexscreener", "launch_metric"],
      signals: {
        ...emptySignals(),
        firstSeenAt: Date.parse("2026-06-01"),
        firstSeenSource: "launch_metric",
      },
    });
    const [out] = applyTemporal([marketImpossible], OBSERVED, {
      ...DEFAULT_POLICY,
      curatedRequiresTemporalCompatibility: false,
    });
    expect(out.excluded?.reason).toBe("temporally_impossible");
  });
});

describe("C — maxProviderCallsPerRun lit la politique passée à resolveToken", () => {
  // Huit contrats distincts et valides : un sondage DexScreener chacun.
  const MANY = [
    "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJA",
    "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJB",
    "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJC",
    "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJD",
    "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJE",
    "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJF",
    "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJG",
    "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJH",
  ];

  async function runWithCeiling(maxProviderCallsPerRun: number) {
    const providers = createProviderContext({
      http: createFixtureHttpClient([{ match: "/tokens/v1/", json: [] }]),
      cache: new ResolutionCache(),
      env: { heliusApiKey: null },
    });
    const res = await resolveToken(
      { addresses: MANY, audience: "internal", allowedChains: ["SOL"] },
      { db: createFakeDb([]), providers, policy: { ...DEFAULT_POLICY, maxProviderCallsPerRun } },
    );
    return { res, providers };
  }

  it("régler la politique à 5 donne 5 appels, pas 40", async () => {
    const { res } = await runWithCeiling(5);
    expect(res.telemetry.providerCalls.dexScreener).toBe(5);
    expect(res.telemetry.budgetRefusals).toBe(3);
  });

  it("régler à 2 donne 2 — le curseur bouge vraiment", async () => {
    const { res } = await runWithCeiling(2);
    expect(res.telemetry.providerCalls.dexScreener).toBe(2);
    expect(res.telemetry.budgetRefusals).toBe(6);
  });

  it("la troncature est annoncée, jamais muette", async () => {
    const { res } = await runWithCeiling(2);
    expect(res.limitations.join(" ")).toMatch(/appel\(s\) provider refusé\(s\)/);
  });

  it("un plafond large laisse tout passer", async () => {
    const { res } = await runWithCeiling(40);
    expect(res.telemetry.providerCalls.dexScreener).toBe(8);
    expect(res.telemetry.budgetRefusals).toBe(0);
  });
});
