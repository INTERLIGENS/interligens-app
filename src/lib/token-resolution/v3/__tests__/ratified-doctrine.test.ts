// ─── DOCTRINE RATIFIÉE — 2026-08-27 ────────────────────────────────────────
// Chaque test prouve EXACTEMENT le comportement arbitré au checkpoint, pas une
// approximation défendable. Référence : docs/prep/BUILD1_CHECKPOINT_DOCTRINE_2026-08-27.md
//
// Couvre : UR-13 (le plancher de liquidité ne gouverne pas l'identité explicite),
// E7b, R22, S04, B3/C5, I3, frontière A (UR-6 + UR-11 étendus), frontière B.

import { describe, it, expect } from "vitest";

import { identityKey } from "../address";
import { applyTemporal } from "../temporal";
import { decide, detectConflicts, isExplicitPlausible } from "../confidence";
import { DEFAULT_POLICY } from "../policy";
import { emptySignals, type TokenCandidate } from "../types";
import { resolveToken } from "../resolve";
import { ResolutionCache } from "../providers/cache";
import { createFixtureHttpClient, type FixtureRoute } from "../providers/fixtureHttp";
import { createProviderContext } from "../providers";
import { createFakeDb, type FakeDbRoute } from "./helpers";

const DEAD = "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJQ";
const LIVE = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const OTHER = "FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump";
const OVPP_ETH = "0xb4c6fedd984bc983b1a758d0875f1ea34f81a6af";
const OVPP_BASE = "0x8c0d3adcf8ce094e1ae437557ec90a6374dc9bdd";
const OBSERVED = new Date("2024-03-01T00:00:00Z");
const MS_DAY = 86_400_000;

function pair(chainId: string, address: string, symbol: string, liquidityUsd: number | null) {
  return {
    chainId,
    baseToken: { address, symbol, name: symbol },
    liquidity: liquidityUsd == null ? {} : { usd: liquidityUsd },
    volume: { h24: 1_000 },
    pairCreatedAt: null,
  };
}

const NO_MARKET: FixtureRoute[] = [
  { match: "/latest/dex/search", json: { pairs: [] } },
  { match: "/tokens/v1/", json: [] },
  { match: "coingecko", json: { coins: [] } },
];

function run(
  request: Parameters<typeof resolveToken>[0],
  httpRoutes: FixtureRoute[],
  dbRoutes: FakeDbRoute[] = [],
) {
  const providers = createProviderContext({
    http: createFixtureHttpClient(httpRoutes),
    cache: new ResolutionCache(),
    env: { heliusApiKey: null },
  });
  return resolveToken(request, { db: createFakeDb(dbRoutes), providers });
}

function cand(over: Partial<TokenCandidate> = {}): TokenCandidate {
  return {
    chain: "SOL",
    address: DEAD,
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

const curatedRow = (address: string, chain: string, symbol: string, handle = "bkokoski") => ({
  contractAddress: address,
  chain,
  tokenSymbol: symbol,
  kolHandle: handle,
  canonicalMint: null,
  canonicalChain: null,
  visibility: "public",
});

// ═══════════════════════════════════════════════════════════════════════════
describe("UR-13 — le plancher de liquidité ne gouverne PAS l'identité explicite", () => {
  it("un mint mort fourni explicitement se résout quand même", async () => {
    // 12 $ de liquidité, très loin sous le plancher de 1 000 $. L'identité vient
    // de la requête, pas du marché : refuser d'identifier un token rugué parce
    // qu'il est rugué serait renoncer au sujet même du produit.
    const res = await run({ addresses: [DEAD], audience: "public", allowedChains: ["SOL"] }, [
      { match: `/tokens/v1/solana/${DEAD}`, json: [pair("solana", DEAD, "DEADTOK", 12)] },
      ...NO_MARKET,
    ]);
    expect(res.status).toBe("RESOLVED");
    expect(res.selected?.address).toBe(DEAD);
    expect(res.method).toBe("explicit_ca");
    expect(res.confidence).toBe("HIGH");
  });

  it("liquidité strictement nulle : toujours résolu", async () => {
    const res = await run({ addresses: [DEAD], audience: "public", allowedChains: ["SOL"] }, [
      { match: `/tokens/v1/solana/${DEAD}`, json: [pair("solana", DEAD, "ZEROLIQ", 0)] },
      ...NO_MARKET,
    ]);
    expect(res.status).toBe("RESOLVED");
    expect(res.selected?.signals.liquidityUsd).toBe(0);
  });

  it("le plancher continue de mordre sur le chemin ticker → marché", async () => {
    const res = await run({ ticker: "THIN", audience: "public", allowedChains: ["SOL"] }, [
      { match: "/latest/dex/search", json: { pairs: [pair("solana", DEAD, "THIN", 300)] } },
      ...NO_MARKET,
    ]);
    expect(res.status).toBe("AMBIGUOUS");
    expect(res.limitations.join(" ")).toMatch(/sous le plancher/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("E7b — plusieurs contrats collés dans la même requête", () => {
  const bothLive: FixtureRoute[] = [
    { match: `/tokens/v1/solana/${LIVE}`, json: [pair("solana", LIVE, "ALPHA", 90_000)] },
    { match: `/tokens/v1/solana/${OTHER}`, json: [pair("solana", OTHER, "BETA", 70_000)] },
    ...NO_MARKET,
  ];

  it("deux contrats plausibles → AMBIGUOUS, aucun n'est élu", async () => {
    const res = await run(
      { addresses: [LIVE, OTHER], audience: "public", allowedChains: ["SOL"] },
      bothLive,
    );
    expect(res.status).toBe("AMBIGUOUS");
    expect(res.selected).toBeNull();
    expect(res.conflicts.map((c) => c.kind)).toContain("multiple_explicit_addresses");
  });

  it("l'ordre du texte ne décide rien — inverser l'ordre donne le même verdict", async () => {
    const a = await run(
      { addresses: [LIVE, OTHER], audience: "public", allowedChains: ["SOL"] },
      bothLive,
    );
    const b = await run(
      { addresses: [OTHER, LIVE], audience: "public", allowedChains: ["SOL"] },
      bothLive,
    );
    expect(a.status).toBe(b.status);
    expect(a.selected).toBeNull();
    expect(b.selected).toBeNull();
  });

  it("un seul plausible → il tranche", async () => {
    const res = await run(
      { addresses: [DEAD, LIVE], audience: "public", allowedChains: ["SOL"] },
      [
        { match: `/tokens/v1/solana/${LIVE}`, json: [pair("solana", LIVE, "ALPHA", 90_000)] },
        { match: `/tokens/v1/solana/${DEAD}`, json: [] },
        ...NO_MARKET,
      ],
    );
    expect(res.status).toBe("RESOLVED");
    expect(res.selected?.address).toBe(LIVE);
  });

  it("la plausibilité s'appuie sur isExplicitPlausible, pas sur l'ordre", () => {
    const live = cand({ address: LIVE, signals: { ...emptySignals(), liquidityUsd: 90_000 } });
    const dead = cand({ address: DEAD, signals: { ...emptySignals(), liquidityUsd: 12 } });
    const curated = cand({ address: OTHER, sources: ["curated"], signals: { ...emptySignals() } });
    expect(isExplicitPlausible(live, DEFAULT_POLICY)).toBe(true);
    expect(isExplicitPlausible(dead, DEFAULT_POLICY)).toBe(false);
    expect(isExplicitPlausible(curated, DEFAULT_POLICY)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("R22 — un contrat postérieur hors tolérance est ÉCARTÉ, pas déclassé", () => {
  const posterior = (deltaDays: number, source: "dexscreener" | "launch_metric") =>
    cand({
      signals: {
        ...emptySignals(),
        liquidityUsd: 500_000,
        firstSeenAt: OBSERVED.getTime() + deltaDays * MS_DAY,
        firstSeenSource: source,
      },
    });

  it("hors tolérance : EXCLUDE, jamais servi avec une confiance basse", () => {
    const [out] = applyTemporal([posterior(400, "dexscreener")], OBSERVED, DEFAULT_POLICY);
    expect(out.temporal).toBe("impossible");
    expect(out.excluded?.reason).toBe("temporally_impossible");

    const d = decide({
      candidates: [],
      excluded: [out],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts: [],
      observedAtProvided: true,
    });
    expect(d.status).toBe("UNRESOLVED");
    expect(d.selected).toBeNull();
    // Le point de la ratification : il n'est pas rendu en RESOLVED/LOW.
    expect(d.confidence).toBe("LOW");
    expect(d.status).not.toBe("RESOLVED");
  });

  it("dans la tolérance : retenu, avec la confiance plafonnée par le doute temporel", () => {
    const [out] = applyTemporal([posterior(10, "dexscreener")], OBSERVED, DEFAULT_POLICY);
    expect(out.temporal).toBe("compatible");
    expect(out.excluded).toBeUndefined();
  });

  it("une preuve de NAISSANCE conclut sous 24 h, une preuve d'ACTIVITÉ sous 30 j", () => {
    const [birth] = applyTemporal([posterior(10, "launch_metric")], OBSERVED, DEFAULT_POLICY);
    const [activity] = applyTemporal([posterior(10, "dexscreener")], OBSERVED, DEFAULT_POLICY);
    expect(birth.excluded?.reason).toBe("temporally_impossible");
    expect(activity.excluded).toBeUndefined();
  });

  it("le candidat écarté reste visible et motivé, jamais perdu en silence", async () => {
    const res = await run(
      { ticker: "LATE", audience: "public", allowedChains: ["SOL"], observedAt: OBSERVED },
      [
        {
          match: "/latest/dex/search",
          json: {
            pairs: [
              {
                ...pair("solana", LIVE, "LATE", 400_000),
                pairCreatedAt: OBSERVED.getTime() + 400 * MS_DAY,
              },
            ],
          },
        },
        ...NO_MARKET,
      ],
    );
    expect(res.status).not.toBe("RESOLVED");
    expect(res.excluded.map((c) => c.address)).toContain(LIVE);
    expect(res.limitations.join(" ")).toMatch(/APRÈS l'observation/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("S04 — la curation fait autorité DANS SON PÉRIMÈTRE DE CHAÎNE, et là seulement", () => {
  const curatedEth: FakeDbRoute[] = [
    { match: 'FROM "KolTokenLink"', rows: [curatedRow(OVPP_ETH, "ethereum", "OVPP")] },
  ];

  it("périmètre mono-chaîne couvert par la curation : elle tranche, sans appel marché", async () => {
    const http = createFixtureHttpClient(NO_MARKET);
    const providers = createProviderContext({
      http,
      cache: new ResolutionCache(),
      env: { heliusApiKey: null },
    });
    const res = await resolveToken(
      { ticker: "OVPP", audience: "public", allowedChains: ["ETH"] },
      { db: createFakeDb(curatedEth), providers },
    );
    expect(res.status).toBe("RESOLVED");
    expect(res.method).toBe("curated");
    expect(http.calls.filter((u) => u.includes("dexscreener"))).toHaveLength(0);
  });

  it("périmètre débordant la curation : le marché est consulté, l'identité n'est plus tranchée", async () => {
    // La curation ne connaît qu'ETH ; l'appelant sait aussi traiter BASE. Un
    // contrat rival y vit. La curation ne peut pas décider pour une chaîne
    // qu'elle n'a jamais regardée.
    const res = await run(
      { ticker: "OVPP", audience: "public", allowedChains: ["ETH", "BASE"] },
      [
        {
          match: "/latest/dex/search",
          json: { pairs: [pair("base", OVPP_BASE, "OVPP", 250_000)] },
        },
        ...NO_MARKET,
      ],
      curatedEth,
    );
    expect(res.status).not.toBe("RESOLVED");
    expect(res.candidates.map((c) => c.address)).toContain(OVPP_BASE);
  });

  it("hors périmètre : identifié et marqué, jamais rendu introuvable", async () => {
    // Le lien curé vit sur ETH, l'appelant ne sait traiter que Solana. L'asset
    // existe : le déclarer introuvable ferait conclure à tort qu'il n'existe pas.
    // Il est donc identifié, marqué unsupported_by_caller, et sorti du périmètre.
    const res = await run(
      { ticker: "OVPP", audience: "public", allowedChains: ["SOL"] },
      NO_MARKET,
      curatedEth,
    );
    expect(res.callerSupport).toBe("unsupported_by_caller");
    expect(res.selected?.chain).toBe("ETH");
    expect(res.candidates.map((c) => c.address)).not.toContain(OVPP_ETH);
    expect(res.excluded.map((c) => c.address)).toContain(OVPP_ETH);
    expect(res.limitations.join(" ")).toMatch(/hors du périmètre/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("B3 / C5 — la liquidité ne décide JAMAIS une identité", () => {
  const crossChain = [
    cand({ chain: "SOL", address: LIVE, symbol: "LAB", signals: { ...emptySignals(), liquidityUsd: 9_000_000 } }),
    cand({ chain: "ETH", address: OVPP_ETH, symbol: "LAB", signals: { ...emptySignals(), liquidityUsd: 1_000 } }),
  ];

  it("9 000× d'écart de liquidité ne tranche rien", () => {
    const conflicts = detectConflicts({
      candidates: crossChain,
      ticker: "LAB",
      explicitIdentityKeys: new Set(),
    });
    const d = decide({
      candidates: crossChain,
      ticker: "LAB",
      explicitIdentityKeys: new Set(),
      conflicts,
    });
    expect(d.status).toBe("AMBIGUOUS");
    expect(d.selected).toBeNull();
  });

  it("le facteur de domination est inerte dans les deux sens", () => {
    for (const crossChainDominanceRatio of [1, 1000]) {
      const conflicts = detectConflicts({
        candidates: crossChain,
        ticker: "LAB",
        explicitIdentityKeys: new Set(),
        policy: { ...DEFAULT_POLICY, crossChainDominanceRatio },
      });
      const d = decide({
        candidates: crossChain,
        ticker: "LAB",
        explicitIdentityKeys: new Set(),
        conflicts,
        policy: { ...DEFAULT_POLICY, crossChainDominanceRatio },
      });
      expect(d.status, `ratio=${crossChainDominanceRatio}`).toBe("AMBIGUOUS");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Frontière A — jamais RESOLVED par ABSENCE de rival (UR-6 + UR-11 étendus)", () => {
  const OUTAGE: FixtureRoute[] = [
    { match: `/tokens/v1/solana/${LIVE}`, json: [pair("solana", LIVE, "SWIF", 900_000)] },
    { match: "/latest/dex/search", status: 503, json: null },
    { match: "coingecko", json: { coins: [] } },
  ];

  it("T05 — panne de recherche, aucune trace interne → AMBIGUOUS", async () => {
    const res = await run(
      { ticker: "SWIF", addresses: [LIVE], audience: "public", allowedChains: ["SOL"] },
      OUTAGE,
    );
    expect(res.status).toBe("AMBIGUOUS");
    expect(res.selected).toBeNull();
    expect(res.confidence).not.toBe("HIGH");
    expect(res.conflicts.map((c) => c.kind)).toContain("rival_search_degraded");
  });

  it("l'échec provider est COMPTÉ, distinct d'un résultat vide", async () => {
    const res = await run(
      { ticker: "SWIF", addresses: [LIVE], audience: "public", allowedChains: ["SOL"] },
      OUTAGE,
    );
    expect(res.telemetry.providerFailures.dexScreener).toBeGreaterThan(0);
    expect(res.limitations.join(" ")).toMatch(/recherche de contrats rivaux a échoué/);
  });

  it("une recherche VIDE mais réussie n'est pas une dégradation", async () => {
    const res = await run(
      { ticker: "SWIF", addresses: [LIVE], audience: "public", allowedChains: ["SOL"] },
      [
        { match: `/tokens/v1/solana/${LIVE}`, json: [pair("solana", LIVE, "SWIF", 900_000)] },
        ...NO_MARKET,
      ],
    );
    expect(res.telemetry.providerFailures.dexScreener).toBe(0);
    expect(res.status).toBe("RESOLVED");
  });

  it("T04 — même panne, mais une source interne corrobore : la porte tient", async () => {
    // Le marché est muet ; la base, elle, documente un AUTRE contrat sous ce
    // ticker. La contradiction reste visible, donc le verdict reste un refus.
    const res = await run(
      { ticker: "SWIF", addresses: [LIVE], audience: "public", allowedChains: ["SOL"] },
      OUTAGE,
      [{ match: 'FROM "KolTokenLink"', rows: [curatedRow(DEAD, "solana", "SWIF")] }],
    );
    expect(res.status).not.toBe("RESOLVED");
    expect(res.selected).toBeNull();
  });

  it("un budget épuisé dégrade au même titre qu'une panne", async () => {
    const providers = createProviderContext({
      http: createFixtureHttpClient([
        { match: "/tokens/v1/", json: [pair("solana", LIVE, "SWIF", 900_000)] },
        { match: "/latest/dex/search", json: { pairs: [] } },
        ...NO_MARKET,
      ]),
      cache: new ResolutionCache(),
      env: { heliusApiKey: null },
    });
    const res = await resolveToken(
      { ticker: "SWIF", addresses: [LIVE], audience: "public", allowedChains: ["SOL"] },
      { db: createFakeDb([]), providers, policy: { ...DEFAULT_POLICY, maxProviderCallsPerRun: 1 } },
    );
    expect(res.telemetry.budgetRefusals).toBeGreaterThan(0);
    expect(res.status).not.toBe("RESOLVED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Frontière B — la requête qui se contredit elle-même rend CONFLICT", () => {
  const selfContradictory: FixtureRoute[] = [
    { match: `/tokens/v1/solana/${LIVE}`, json: [pair("solana", LIVE, "SWIF", 900_000)] },
    {
      match: "/latest/dex/search",
      json: { pairs: [pair("solana", DEAD, "SWIF", 40_000)] },
    },
    ...NO_MARKET,
  ];

  it("CA A + ticker que le contrat B porte → CONFLICT / contract_identity", async () => {
    const res = await run(
      { ticker: "SWIF", addresses: [LIVE], audience: "public", allowedChains: ["SOL"] },
      selfContradictory,
    );
    expect(res.status).toBe("CONFLICT");
    expect(res.conflicts.map((c) => c.kind)).toContain("contract_identity");
    expect(res.limitations.join(" ")).toMatch(/la requête se contredit elle-même/);
  });

  it("la contradiction nomme les deux contrats", async () => {
    const res = await run(
      { ticker: "SWIF", addresses: [LIVE], audience: "public", allowedChains: ["SOL"] },
      selfContradictory,
    );
    const named = new Set(res.conflicts.flatMap((c) => c.between));
    expect(named.has(identityKey("SOL", LIVE))).toBe(true);
    expect(named.has(identityKey("SOL", DEAD))).toBe(true);
  });

  it("sans contrat fourni, la même collision reste AMBIGUOUS — l'utilisateur choisit", () => {
    const rivals = [
      cand({ address: LIVE, symbol: "SWIF" }),
      cand({ address: DEAD, symbol: "SWIF" }),
    ];
    const conflicts = detectConflicts({
      candidates: rivals,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
    });
    const d = decide({
      candidates: rivals,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts,
    });
    expect(d.status).toBe("AMBIGUOUS");
  });

  it("deux sources INTERNES qui se contredisent restent CONFLICT", () => {
    const contested = [
      cand({ address: LIVE, sources: ["curated"] }),
      cand({ address: DEAD, sources: ["casefile"] }),
    ];
    const conflicts = detectConflicts({
      candidates: contested,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
    });
    const d = decide({
      candidates: contested,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts,
    });
    expect(d.status).toBe("CONFLICT");
  });
});
