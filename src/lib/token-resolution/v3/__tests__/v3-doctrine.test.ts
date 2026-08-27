// ─── V3 — les règles que la V2 n'avait pas ─────────────────────────────────
// E5 identité de contrat · D2 résolution temporelle · V3-3 tier curated soumis
// aux règles · V3-4 correctifs J3 / I3 · multi-chaînes déclaré.
//
// Aucun réseau, aucune base, aucune horloge implicite.

import { describe, it, expect } from "vitest";

import { identityKey } from "../address";
import { buildCandidateSet, rankCandidates, bindChains } from "../candidates";
import { decide, detectConflicts, isMarketlessOnly } from "../confidence";
import {
  assertContractIdentity,
  detectContractIdentityConflicts,
} from "../identity";
import { applyTemporal, assessTemporal } from "../temporal";
import { DEFAULT_POLICY } from "../policy";
import { emptySignals, type RawCandidate, type TokenCandidate } from "../types";
import { ResolutionCache } from "../providers/cache";
import { createFixtureHttpClient } from "../providers/fixtureHttp";
import { createProviderContext } from "../providers";
import { resolveToken } from "../resolve";
import { createFakeDb } from "./helpers";
import { decideBySymbolOnly } from "./mutants/symbolOnlyIdentity";

const ORIGINAL = "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJQ";
const IMITATOR = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const HISTORIC = "FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump";
const EVM = "0x7ec43cf65f1663f820427c62a5780b8f2e25593a";

const MS_DAY = 86_400_000;
const OBSERVED = new Date("2024-03-01T00:00:00Z");

function cand(over: Partial<TokenCandidate> = {}): TokenCandidate {
  return {
    chain: "SOL",
    address: ORIGINAL,
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

function ctx(routes: Parameters<typeof createFixtureHttpClient>[0] = []) {
  return createProviderContext({
    http: createFixtureHttpClient(routes),
    cache: new ResolutionCache(),
    env: { heliusApiKey: null },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
describe("V3-1 / E5 — l'égalité de symbole n'est jamais une preuve d'identité", () => {
  const twoContracts = [
    cand({ address: ORIGINAL, signals: { ...emptySignals(), liquidityUsd: 900_000 } }),
    cand({ address: IMITATOR, signals: { ...emptySignals(), liquidityUsd: 4_000 } }),
  ];

  it("deux contrats sous un même symbole produisent un conflit d'identité", () => {
    const c = detectContractIdentityConflicts(twoContracts, new Set());
    expect(c).toHaveLength(1);
    expect(c[0].kind).toBe("contract_identity");
    expect(c[0].between).toHaveLength(2);
  });

  it("aucune quantité de liquidité ne tranche une question d'identité", () => {
    // L'original écrase l'imitateur 225 fois en liquidité. Ça ne prouve rien
    // sur l'identité : c'est exactement ce qu'un imitateur exploite.
    const conflicts = detectConflicts({
      candidates: twoContracts,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
    });
    const d = decide({
      candidates: twoContracts,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts,
    });
    expect(d.status).not.toBe("RESOLVED");
    expect(d.confidence).not.toBe("HIGH");
    expect(d.selected).toBeNull();
  });

  it("deux sources INTERNES qui se contredisent → CONFLICT, pas AMBIGUOUS", () => {
    // Nos propres données se contredisent : ce n'est pas à l'utilisateur de
    // choisir, c'est une revue humaine qui doit trancher.
    const contested = [
      cand({ address: ORIGINAL, sources: ["curated"] }),
      cand({ address: IMITATOR, sources: ["casefile"] }),
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

  it("une seule source interne face au marché → AMBIGUOUS, l'utilisateur choisit", () => {
    const mixed = [
      cand({ address: ORIGINAL, sources: ["curated"] }),
      cand({ address: IMITATOR, sources: ["dexscreener"] }),
    ];
    const conflicts = detectConflicts({
      candidates: mixed,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
    });
    const d = decide({
      candidates: mixed,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts,
    });
    expect(d.status).toBe("AMBIGUOUS");
  });

  it("un contrat fourni dit CE QU'ON A COLLÉ, pas que c'est le token nommé", () => {
    // ─── Correction de cadrage ─────────────────────────────────────────────
    // Ce test affirmait que fournir un contrat faisait disparaître la question
    // des homonymes. Faux : coller une adresse tranche QUELLE adresse on parle,
    // pas si cette adresse est bien le token appelé $SWIF. Tant que d'autres
    // contrats répondent à ce ticker, la certitude n'est pas due.
    const keys = new Set([identityKey("SOL", ORIGINAL)]);
    const withExplicit = [
      {
        ...twoContracts[0],
        matchType: "explicit_ca" as const,
        sources: ["explicit_ca" as const, "dexscreener" as const],
      },
      twoContracts[1],
    ];
    const conflicts = detectConflicts({
      candidates: withExplicit,
      ticker: "SWIF",
      explicitIdentityKeys: keys,
    });
    expect(conflicts.map((c) => c.kind)).toContain("contract_identity");
    const d = decide({
      candidates: withExplicit,
      ticker: "SWIF",
      explicitIdentityKeys: keys,
      conflicts,
    });
    expect(d.status).not.toBe("RESOLVED");
  });

  it("sans rival, le contrat fourni résout normalement", () => {
    const keys = new Set([identityKey("SOL", ORIGINAL)]);
    const alone = [
      {
        ...twoContracts[0],
        matchType: "explicit_ca" as const,
        sources: ["explicit_ca" as const, "dexscreener" as const],
      },
    ];
    const conflicts = detectConflicts({
      candidates: alone,
      ticker: "SWIF",
      explicitIdentityKeys: keys,
    });
    const d = decide({ candidates: alone, ticker: "SWIF", explicitIdentityKeys: keys, conflicts });
    expect(d.status).toBe("RESOLVED");
    expect(d.method).toBe("explicit_ca");
  });

  it("la fusion se fait par CONTRAT, jamais par symbole", () => {
    const raws: RawCandidate[] = [
      { chain: "SOL", address: ORIGINAL, symbol: "SWIF", source: "curated" },
      { chain: "SOL", address: IMITATOR, symbol: "SWIF", source: "dexscreener" },
    ];
    const set = buildCandidateSet(raws, {
      ticker: "SWIF",
      audience: "public",
      policy: DEFAULT_POLICY,
    });
    expect(set.candidates).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("V3-1 / MUTATION TEST — le canari du gate symbol-only", () => {
  const twoContracts = [
    cand({ address: ORIGINAL, signals: { ...emptySignals(), liquidityUsd: 900_000 } }),
    cand({ address: IMITATOR, signals: { ...emptySignals(), liquidityUsd: 4_000 } }),
  ];

  it("le mutant identité-par-symbole VIOLE l'invariant E5", () => {
    // Si ce test devient vert-sans-lever un jour, ce n'est pas le mutant qui a
    // changé : c'est que la règle réelle a été affaiblie jusqu'à accepter ce
    // que le mutant fait.
    const mutant = decideBySymbolOnly(twoContracts);
    expect(mutant.status).toBe("RESOLVED");
    expect(mutant.confidence).toBe("HIGH");
    expect(() => assertContractIdentity(mutant)).toThrow(/VIOLATION E5/);
  });

  it("le résolveur réel ne viole jamais l'invariant sur la même entrée", () => {
    const conflicts = detectConflicts({
      candidates: twoContracts,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
    });
    const real = decide({
      candidates: twoContracts,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts,
    });
    expect(() =>
      assertContractIdentity({ ...real, candidates: twoContracts, conflicts }),
    ).not.toThrow();
  });

  it("l'invariant ne se déclenche PAS quand un seul contrat porte le symbole", () => {
    const single = [cand({ address: ORIGINAL })];
    expect(() =>
      assertContractIdentity({
        status: "RESOLVED",
        confidence: "HIGH",
        selected: single[0],
        candidates: single,
        conflicts: [],
      }),
    ).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("V3-2 / D2 — le temps est une contrainte d'identité", () => {
  it("un contrat né après l'observation est ÉCARTÉ, pas juste dévalué", () => {
    const future = cand({
      signals: {
        ...emptySignals(),
        liquidityUsd: 900_000,
        firstSeenAt: new Date("2026-01-01T00:00:00Z").getTime(),
        firstSeenSource: "launch_metric",
      },
    });
    const [out] = applyTemporal([future], OBSERVED, DEFAULT_POLICY);
    expect(out.temporal).toBe("impossible");
    expect(out.excluded?.reason).toBe("temporally_impossible");
  });

  it("tweet 2024 / mint 2026 : ce mint n'est JAMAIS servi, de bout en bout", async () => {
    // Deux contrats sous le même symbole : l'historique (2023) et un homonyme
    // créé en 2026. Sans D2, le récent gagnerait — il est bien plus liquide.
    const search = {
      pairs: [
        {
          chainId: "solana",
          baseToken: { address: HISTORIC, symbol: "TOES", name: "Toes historique" },
          liquidity: { usd: 12_000 },
          volume: { h24: 5_000 },
          pairCreatedAt: new Date("2023-06-01T00:00:00Z").getTime(),
        },
        {
          chainId: "solana",
          baseToken: { address: IMITATOR, symbol: "TOES", name: "Toes 2026" },
          liquidity: { usd: 4_000_000 },
          volume: { h24: 900_000 },
          pairCreatedAt: new Date("2026-02-01T00:00:00Z").getTime(),
        },
      ],
    };
    const res = await resolveToken(
      { ticker: "TOES", audience: "public", allowedChains: ["SOL"], observedAt: OBSERVED },
      { db: createFakeDb([]), providers: ctx([{ match: "/latest/dex/search", json: search }]) },
    );
    expect(res.candidates.map((c) => c.address)).not.toContain(IMITATOR);
    expect(res.excluded.map((c) => c.address)).toContain(IMITATOR);
    expect(res.status).toBe("RESOLVED");
    expect(res.selected?.address).toBe(HISTORIC);
  });

  it("la famille HISTORIQUE remonte devant un contrat au passé inconnu", () => {
    const historic = cand({
      address: HISTORIC,
      signals: {
        ...emptySignals(),
        liquidityUsd: 5_000,
        firstSeenAt: new Date("2022-01-01T00:00:00Z").getTime(),
        firstSeenSource: "launch_metric",
      },
      temporal: "compatible",
    });
    const undated = cand({
      address: IMITATOR,
      signals: { ...emptySignals(), liquidityUsd: 5_000_000 },
      temporal: "unknown",
    });
    expect(rankCandidates([undated, historic])[0].address).toBe(HISTORIC);
  });

  it("pairCreatedAt ne borne PAS la naissance du mint — tolérance élargie", () => {
    // Un token peut exister, être poussé, et n'obtenir sa paire que plus tard.
    // Traiter la paire comme la naissance ferait disparaître des tokens réels.
    const pairLater = cand({
      signals: {
        ...emptySignals(),
        firstSeenAt: OBSERVED.getTime() + 10 * MS_DAY,
        firstSeenSource: "dexscreener",
      },
    });
    expect(assessTemporal(pairLater, OBSERVED, DEFAULT_POLICY).verdict).toBe("compatible");

    const pairMuchLater = cand({
      signals: {
        ...emptySignals(),
        firstSeenAt: OBSERVED.getTime() + 400 * MS_DAY,
        firstSeenSource: "dexscreener",
      },
    });
    expect(assessTemporal(pairMuchLater, OBSERVED, DEFAULT_POLICY).verdict).toBe("impossible");
  });

  it("une preuve DIRECTE conclut plus vite qu'une preuve indirecte", () => {
    const at = OBSERVED.getTime() + 10 * MS_DAY;
    const strong = cand({
      signals: { ...emptySignals(), firstSeenAt: at, firstSeenSource: "launch_metric" },
    });
    const weak = cand({
      signals: { ...emptySignals(), firstSeenAt: at, firstSeenSource: "dexscreener" },
    });
    expect(assessTemporal(strong, OBSERVED, DEFAULT_POLICY).verdict).toBe("impossible");
    expect(assessTemporal(weak, OBSERVED, DEFAULT_POLICY).verdict).toBe("compatible");
  });

  it("sans date d'observation, le module ne fabrique aucune contrainte", () => {
    const c = cand({
      signals: { ...emptySignals(), firstSeenAt: Date.parse("2030-01-01"), firstSeenSource: "launch_metric" },
    });
    expect(assessTemporal(c, null, DEFAULT_POLICY).verdict).toBe("unknown");
    expect(applyTemporal([c], null, DEFAULT_POLICY)[0].excluded).toBeUndefined();
  });

  it("date d'observation fournie mais contrat non datable → confiance plafonnée", () => {
    const undated = cand({ sources: ["curated"], temporal: "unknown" });
    const d = decide({
      candidates: [undated],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts: [],
      observedAtProvided: true,
    });
    expect(d.status).toBe("RESOLVED");
    expect(d.confidence).toBe("MODERATE");
  });

  it("tout écarté par le temps → on dit pourquoi, jamais « introuvable » sec", () => {
    const killed = applyTemporal(
      [
        cand({
          signals: {
            ...emptySignals(),
            firstSeenAt: Date.parse("2026-01-01"),
            firstSeenSource: "launch_metric",
          },
        }),
      ],
      OBSERVED,
      DEFAULT_POLICY,
    );
    const d = decide({
      candidates: [],
      excluded: killed,
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts: [],
      observedAtProvided: true,
    });
    expect(d.status).toBe("UNRESOLVED");
    expect(d.limitations.join(" ")).toMatch(/postérieur/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("V3-3 — le tier CURATED est intégré, pas exempté", () => {
  it("un lien curé hors périmètre de l'appelant ne résout pas ici", () => {
    const curatedEvm = cand({ chain: "BSC", address: EVM, symbol: "LAB", sources: ["curated"] });
    const [bound] = bindChains([curatedEvm], ["SOL"]);
    expect(bound.excluded?.reason).toBe("chain_not_allowed");
  });

  it("un lien curé temporellement impossible est écarté comme les autres", () => {
    const curatedLate = cand({
      sources: ["curated"],
      signals: {
        ...emptySignals(),
        firstSeenAt: Date.parse("2026-06-01"),
        firstSeenSource: "launch_metric",
      },
    });
    const [out] = applyTemporal([curatedLate], OBSERVED, DEFAULT_POLICY);
    expect(out.excluded?.reason).toBe("temporally_impossible");
  });

  it("un lien curé dans le périmètre et compatible garde son autorité", () => {
    const ok = cand({ sources: ["curated"], temporal: "compatible", matchType: "exact" });
    const d = decide({
      candidates: [ok],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts: [],
      observedAtProvided: true,
    });
    expect(d.status).toBe("RESOLVED");
    expect(d.confidence).toBe("HIGH");
    expect(d.method).toBe("curated");
  });

  it("le tier curated passe toujours avant le marché", () => {
    const curated = cand({ address: ORIGINAL, sources: ["curated"], matchType: "exact" });
    const market = cand({
      address: ORIGINAL,
      sources: ["dexscreener"],
      matchType: "exact",
      signals: { ...emptySignals(), liquidityUsd: 10_000_000 },
    });
    const set = buildCandidateSet(
      [
        { chain: "SOL", address: ORIGINAL, symbol: "SWIF", source: "dexscreener", signals: market.signals },
        { chain: "SOL", address: ORIGINAL, symbol: "SWIF", source: "curated" },
      ],
      { ticker: "SWIF", audience: "public", policy: DEFAULT_POLICY },
    );
    expect(set.candidates[0].sources[0]).toBe("curated");
    expect(curated.sources[0]).toBe("curated");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("V3-4 / J3 — le ticker générique est bloqué sur TOUS les chemins", () => {
  it("bloqué même quand la requête portait une adresse non localisable", () => {
    // Le trou de la V2 : le contrôle générique était conditionné à l'absence
    // d'adresse dans la requête. Une adresse présente mais non localisée
    // laissait passer un ticker de la liste noire.
    const c = cand({ symbol: "PEPE", signals: { ...emptySignals(), liquidityUsd: 9_000_000 } });
    const d = decide({
      candidates: [c],
      ticker: "PEPE",
      // clé explicite renseignée mais ne correspondant à AUCUN candidat retenu
      explicitIdentityKeys: new Set(["SOL:introuvable"]),
      conflicts: [],
    });
    expect(d.status).toBe("AMBIGUOUS");
  });

  it("bloqué même avec un lien curé derrière", () => {
    const c = cand({ symbol: "BTC", sources: ["curated"] });
    const d = decide({
      candidates: [c],
      ticker: "BTC",
      explicitIdentityKeys: new Set(),
      conflicts: [],
    });
    expect(d.status).toBe("AMBIGUOUS");
  });

  it("le blocage est débrayable par la politique, jamais en dur", () => {
    const c = cand({ symbol: "PEPE", matchType: "exact" });
    const d = decide({
      candidates: [c],
      ticker: "PEPE",
      explicitIdentityKeys: new Set(),
      conflicts: [],
      policy: { ...DEFAULT_POLICY, genericTickerNeverAutoResolves: false },
    });
    expect(d.status).toBe("RESOLVED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("V3-4 / I3 — ratifié : identifier sans marché, jamais certifier", () => {
  it("un catalogue seul RÉSOUT, mais jamais au-delà de MODERATE", () => {
    // Doctrine ratifiée : contrat unique + périmètre + aucun rival → RESOLVED,
    // plafonné MODERATE. Ce que la V1 faisait de faux, ce n'était pas de
    // résoudre : c'était de fabriquer matchType:'exact' + lowLiquidity:false en
    // dur et d'annoncer HIGH.
    const cg = cand({ sources: ["coingecko"], signals: { ...emptySignals() } });
    expect(isMarketlessOnly(cg)).toBe(true);
    const d = decide({
      candidates: [cg],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts: [],
    });
    expect(d.status).toBe("RESOLVED");
    expect(d.confidence).toBe("MODERATE");
    expect(d.limitations.join(" ")).toMatch(/aucune donnée de marché/);
  });

  it("jamais HIGH sans marché, même avec un dossier publié derrière", () => {
    const preset = cand({
      sources: ["casefile_preset"],
      signals: { ...emptySignals(), hasPublishedCasefile: true },
    });
    const d = decide({
      candidates: [preset],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts: [],
    });
    expect(d.status).toBe("RESOLVED");
    expect(d.confidence).not.toBe("HIGH");
  });

  it("un rival sans marché fait obstacle comme un autre — l'identité prime", () => {
    // Une entrée de catalogue revendique une identité pour ce ticker ; puisqu'elle
    // peut résoudre, elle peut aussi bloquer.
    const real = cand({ address: ORIGINAL, signals: { ...emptySignals(), liquidityUsd: 80_000 } });
    const cg = cand({ address: IMITATOR, sources: ["coingecko"], signals: { ...emptySignals() } });
    const conflicts = detectConflicts({
      candidates: [real, cg],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
    });
    const d = decide({
      candidates: [real, cg],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts,
    });
    expect(d.status).not.toBe("RESOLVED");
  });

  it("symbole non comparable au ticker : rien ne relie le contrat à la requête", () => {
    const cg = cand({ sources: ["coingecko"], matchType: "unknown", symbol: null });
    const d = decide({
      candidates: [cg],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts: [],
    });
    expect(d.status).toBe("AMBIGUOUS");
  });

  it("le régime strict d'avant ratification reste disponible pour le backtest", () => {
    const cg = cand({ sources: ["coingecko"], signals: { ...emptySignals() } });
    const d = decide({
      candidates: [cg],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
      conflicts: [],
      policy: { ...DEFAULT_POLICY, marketlessSourcesCanAutoResolve: false },
    });
    expect(d.status).toBe("AMBIGUOUS");
  });

  it("index de dossiers et presets relèvent de la même règle", () => {
    expect(isMarketlessOnly(cand({ sources: ["ca_map"] }))).toBe(true);
    expect(isMarketlessOnly(cand({ sources: ["casefile_preset"] }))).toBe(true);
    expect(isMarketlessOnly(cand({ sources: ["ca_map", "dexscreener"] }))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("multi-chaînes — périmètre déclaré, aucune préférence cachée", () => {
  it("aucune préférence Solana ne subsiste dans le classement", () => {
    const sol = cand({ chain: "SOL", address: ORIGINAL, symbol: "AAA" });
    const bsc = cand({ chain: "BSC", address: EVM, symbol: "BBB" });
    // Preuves strictement égales : seule la clé d'identité doit départager,
    // et "BSC:0x…" précède "SOL:9h…" par ordre alphabétique.
    const ranked = rankCandidates([sol, bsc]);
    expect(ranked[0].chain).toBe("BSC");
  });

  it("un asset hors périmètre est RÉSOLU et marqué, jamais rendu introuvable", () => {
    const outOfScope = bindChains(
      [cand({ chain: "BSC", address: EVM, symbol: "LAB", sources: ["casefile"] })],
      ["SOL"],
    );
    const d = decide({
      candidates: [],
      excluded: outOfScope,
      ticker: "LAB",
      explicitIdentityKeys: new Set(),
      conflicts: [],
    });
    expect(d.status).toBe("RESOLVED");
    expect(d.callerSupport).toBe("unsupported_by_caller");
    expect(d.selected?.chain).toBe("BSC");
    expect(d.limitations.join(" ")).toMatch(/hors du périmètre/);
  });

  it("plusieurs assets hors périmètre → AMBIGUOUS, toujours pas introuvable", () => {
    const outOfScope = bindChains(
      [
        cand({ chain: "BSC", address: EVM, symbol: "LAB", sources: ["casefile"] }),
        cand({ chain: "ETH", address: EVM, symbol: "LAB", sources: ["casefile"] }),
      ],
      ["SOL"],
    );
    const d = decide({
      candidates: [],
      excluded: outOfScope,
      ticker: "LAB",
      explicitIdentityKeys: new Set(),
      conflicts: [],
    });
    expect(d.status).toBe("AMBIGUOUS");
    expect(d.callerSupport).toBe("unsupported_by_caller");
  });

  it("même ticker sur plusieurs chaînes dans le périmètre → AMBIGUOUS", () => {
    const multi = [
      cand({ chain: "SOL", address: ORIGINAL, symbol: "LAB", signals: { ...emptySignals(), liquidityUsd: 9_000_000 } }),
      cand({ chain: "BSC", address: EVM, symbol: "LAB", signals: { ...emptySignals(), liquidityUsd: 1_000 } }),
    ];
    const conflicts = detectConflicts({
      candidates: multi,
      ticker: "LAB",
      explicitIdentityKeys: new Set(),
    });
    expect(conflicts.map((c) => c.kind)).toContain("cross_chain");
    const d = decide({
      candidates: multi,
      ticker: "LAB",
      explicitIdentityKeys: new Set(),
      conflicts,
    });
    expect(d.status).not.toBe("RESOLVED");
  });

  it("un périmètre vide n'exclut rien — mais il doit être déclaré", () => {
    const all = bindChains([cand({ chain: "TRON", address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE" })], []);
    expect(all[0].excluded).toBeUndefined();
  });

  it("le sondage EVM ne dépense rien hors du périmètre déclaré", async () => {
    const http = createFixtureHttpClient([{ match: "/tokens/v1/", json: [] }]);
    const providers = createProviderContext({
      http,
      cache: new ResolutionCache(),
      env: { heliusApiKey: null },
    });
    await resolveToken(
      { addresses: [EVM], audience: "internal", allowedChains: ["BSC"] },
      { db: null, providers },
    );
    const probes = http.calls.filter((u) => u.includes("/tokens/v1/"));
    expect(probes).toHaveLength(1);
    expect(probes[0]).toContain("/bsc/");
  });
});
