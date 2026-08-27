// ─── UR-1 → UR-11 — exigences de la résolution universelle V2 ──────────────
// Onze exigences, une par comportement que le module doit garantir. Chacune est
// écrite pour ÉCHOUER si la garantie disparaît, pas pour décrire l'implémentation.
//
// Aucun appel réseau : le client HTTP est servi par les fixtures capturées le
// 2026-08-26 sur appels réels. Aucune base : DbClient est injecté. Aucune
// horloge réelle : le cache reçoit son temps.

import { describe, it, expect } from "vitest";

import { normalizeChain, isUnknownChainMarker } from "../chain";
import {
  inferAddressShape,
  isPlaceholderAddress,
  normalizeAddress,
  identityKey,
} from "../address";
import {
  buildCandidateSet,
  mergeCandidates,
  gateForAudience,
  rankCandidates,
} from "../candidates";
import { detectConflicts, decide } from "../confidence";
import { DEFAULT_POLICY } from "../policy";
import { emptySignals, type RawCandidate, type TokenCandidate } from "../types";
import { ResolutionCache } from "../providers/cache";
import { createFixtureHttpClient } from "../providers/fixtureHttp";
import { createProviderContext } from "../providers";
import { dexScreenerByAddress, dexScreenerSearchTicker } from "../providers/dexscreener";
import { heliusMintExists } from "../providers/helius";
import { resolveToken } from "../resolve";
import { fixture, createFakeDb, manualClock } from "./helpers";

// Adresses réelles issues de la prod (lecture seule, 2026-08-26).
const SWIF = "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJQ";
const BOTIFY = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const LAB_BSC = "0x7ec43Cf65F1663F820427C62A5780b8f2E25593A";

const searchTOES = fixture("dexscreener.search.TOES.json");
const mintSWIF = fixture("dexscreener.mint.SWIF.json");

function httpWithDex() {
  return createFixtureHttpClient([
    { match: "/latest/dex/search", json: searchTOES },
    { match: `/tokens/v1/solana/${SWIF}`, json: mintSWIF },
    { match: "/tokens/v1/", json: [] },
    { match: "helius-rpc.com", json: { result: { value: null } } },
    { match: "api.coingecko.com", json: { coins: [] } },
  ]);
}

function ctxWith(http = httpWithDex(), clock = manualClock()) {
  return createProviderContext({
    http,
    cache: new ResolutionCache({ now: clock.now }),
    env: { heliusApiKey: "test-key-not-real" },
  });
}

function candidate(over: Partial<TokenCandidate> = {}): TokenCandidate {
  return {
    chain: "SOL",
    address: SWIF,
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

// ───────────────────────────────────────────────────────────────────────────
describe("UR-1 — une seule table de chaînes, toutes les écritures de la prod", () => {
  it("replie les écritures mesurées en base sur la forme canonique", () => {
    // Valeurs relevées sur ep-square-band : KolTokenLink, TokenPriceTracker,
    // KolPromotionMention, clés jsonb de token_casefiles.
    expect(normalizeChain("solana")).toBe("SOL");
    expect(normalizeChain("SOL")).toBe("SOL");
    expect(normalizeChain("ethereum")).toBe("ETH");
    expect(normalizeChain("Ethereum")).toBe("ETH");
    expect(normalizeChain("base")).toBe("BASE");
    expect(normalizeChain("BASE")).toBe("BASE");
  });

  it("reconnaît « BNB Chain », le libellé humain des dossiers publiés", () => {
    // Le résolveur du scan V1 teste l'égalité après upper() : "BNB CHAIN" n'y
    // matche ni "BNB" ni "BSC". La ligne casefile serait muette.
    expect(normalizeChain("BNB Chain")).toBe("BSC");
    expect(normalizeChain("binance-smart-chain")).toBe("BSC");
    expect(normalizeChain("arbitrum-one")).toBe("ARBITRUM");
  });

  it("traite « unknown » comme non renseigné, pas comme une chaîne", () => {
    expect(normalizeChain("unknown")).toBeNull();
    expect(isUnknownChainMarker("unknown")).toBe(true);
    expect(isUnknownChainMarker("solana")).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-2 — une seule validation d'adresse par chaîne", () => {
  it("n'abaisse JAMAIS la casse d'un mint base58", () => {
    const n = normalizeAddress(SWIF, "SOL");
    expect(n.valid).toBe(true);
    expect(n.address).toBe(SWIF); // casse intacte
  });

  it("normalise l'hexadécimal EVM en minuscules pour ne pas dédoubler l'identité", () => {
    const n = normalizeAddress(LAB_BSC, "BSC");
    expect(n.valid).toBe(true);
    expect(n.address).toBe(LAB_BSC.toLowerCase());
    expect(identityKey("BSC", n.address!)).toBe(identityKey("BSC", LAB_BSC.toUpperCase().replace("0X", "0x")));
  });

  it("rejette les marqueurs éditoriaux réellement présents en base", () => {
    // Ligne réelle : KolTokenLink.contractAddress = "PENDING:BREAD".
    expect(isPlaceholderAddress("PENDING:BREAD")).toBe(true);
    expect(normalizeAddress("PENDING:BREAD", "SOL").valid).toBe(false);
    expect(normalizeAddress("PENDING_OSINT_TOES", "SOL").reason).toBe("placeholder");
  });

  it("teste Tron AVANT Solana — un T+33 base58 satisfait les deux formats", () => {
    const tron = "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE";
    expect(inferAddressShape(tron).inferredChain).toBe("TRON");
  });

  it("ne devine pas la chaîne d'un hexadécimal EVM", () => {
    const shape = inferAddressShape(LAB_BSC);
    expect(shape.kind).toBe("evm");
    expect(shape.evmAmbiguous).toBe(true);
    expect(shape.inferredChain).toBeNull();
  });

  it("marque les mints pump.fun", () => {
    expect(inferAddressShape("C2omVhcvt3DDY77S2KZzawFJQeETZofgZ4eNWWkXpump").isPumpFun).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-3 — fusion : une identité, un candidat", () => {
  const base: RawCandidate = { chain: "SOL", address: SWIF, source: "mentions" };

  it("fusionne les doublons de casse de chaîne de la prod en UNE identité", () => {
    // La même adresse existe en base sous chain='solana' ET chain='SOL'.
    const merged = mergeCandidates([
      { ...base, source: "curated", symbol: "SWIF" },
      { ...base, source: "mentions", symbol: "SWIF" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sources).toEqual(["curated", "mentions"]);
  });

  it("ne SOMME jamais kolCount — le même handle vit dans deux tables", () => {
    const merged = mergeCandidates([
      { ...base, source: "curated", signals: { kolCount: 3 } },
      { ...base, source: "mentions", signals: { kolCount: 2 } },
    ]);
    expect(merged[0].signals.kolCount).toBe(3);
  });

  it("retient le symbole de la source la plus autoritaire", () => {
    const merged = mergeCandidates([
      { ...base, source: "dexscreener", symbol: "IMPOSTEUR" },
      { ...base, source: "casefile", symbol: "SWIF" },
    ]);
    expect(merged[0].symbol).toBe("SWIF");
  });

  it("union les références de dossier et propage les booléens", () => {
    const merged = mergeCandidates([
      { ...base, source: "casefile", signals: { hasPublishedCasefile: true, casefileRefs: ["IL-B"] } },
      { ...base, source: "casefile", signals: { hasPublishedCasefile: true, casefileRefs: ["IL-A"] } },
    ]);
    expect(merged[0].signals.casefileRefs).toEqual(["IL-A", "IL-B"]);
    expect(merged[0].signals.hasPublishedCasefile).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-4 — cloisonnement d'audience", () => {
  it("retire un candidat que SEUL un brouillon soutient, en public", () => {
    const cands = mergeCandidates([{ chain: "SOL", address: SWIF, source: "curated_draft" }]);
    const pub = gateForAudience(cands, "public");
    expect(pub.kept).toHaveLength(0);
    expect(pub.dropped).toBe(1);
  });

  it("laisse le candidat mais retire la source interne quand une source publique existe", () => {
    const cands = mergeCandidates([
      { chain: "SOL", address: SWIF, source: "curated_draft" },
      { chain: "SOL", address: SWIF, source: "curated" },
    ]);
    const pub = gateForAudience(cands, "public");
    expect(pub.kept).toHaveLength(1);
    expect(pub.kept[0].sources).toEqual(["curated"]);
  });

  it("l'enquête voit tout", () => {
    const cands = mergeCandidates([{ chain: "SOL", address: SWIF, source: "curated_draft" }]);
    expect(gateForAudience(cands, "internal").kept).toHaveLength(1);
  });

  it("aucun handle KOL ne peut transiter — seul l'agrégat existe", () => {
    const c = candidate({ signals: { ...emptySignals(), kolCount: 4 } });
    expect(Object.keys(c.signals)).not.toContain("kolHandles");
    expect(JSON.stringify(c)).not.toMatch(/handle/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-5 — classement : ordre total et déterministe", () => {
  const a = candidate({ address: SWIF, symbol: "SWIF" });
  const b = candidate({ address: BOTIFY, symbol: "SWIF" });

  it("ne dépend pas de l'ordre d'arrivée", () => {
    const one = rankCandidates([a, b]).map((c) => c.address);
    const two = rankCandidates([b, a]).map((c) => c.address);
    expect(one).toEqual(two);
  });

  it("départage jusqu'au bout — aucun ex æquo résiduel", () => {
    const twins = [a, b].map((c) => ({ ...c, signals: { ...emptySignals() } }));
    const sorted = rankCandidates(twins);
    expect(sorted[0].address).not.toBe(sorted[1].address);
    expect(rankCandidates(twins.slice().reverse())[0].address).toBe(sorted[0].address);
  });

  it("la pertinence prime sur la confiance : un exact passe devant un dossier en préfixe", () => {
    const exact = candidate({ address: SWIF, matchType: "exact", sources: ["dexscreener"] });
    const casefilePrefix = candidate({
      address: BOTIFY,
      matchType: "prefix",
      sources: ["casefile"],
      signals: { ...emptySignals(), hasPublishedCasefile: true },
    });
    expect(rankCandidates([casefilePrefix, exact])[0].address).toBe(SWIF);
  });

  it("à pertinence égale, le dossier publié passe devant", () => {
    const plain = candidate({ address: SWIF });
    const documented = candidate({
      address: BOTIFY,
      signals: { ...emptySignals(), hasPublishedCasefile: true },
    });
    expect(rankCandidates([plain, documented])[0].address).toBe(BOTIFY);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-6 — le cache est obligatoire et se comporte", () => {
  it("deux appels identiques ne produisent qu'UNE sortie réseau", async () => {
    const http = httpWithDex();
    const ctx = ctxWith(http);
    await dexScreenerByAddress(ctx, "SOL", SWIF);
    await dexScreenerByAddress(ctx, "SOL", SWIF);
    expect(http.calls.filter((u) => u.includes("/tokens/v1/"))).toHaveLength(1);
    expect(ctx.telemetry.providerCalls.dexScreener).toBe(1);
  });

  it("dédouble les appels CONCURRENTS sur la même clé", async () => {
    const http = httpWithDex();
    const ctx = ctxWith(http);
    await Promise.all([
      dexScreenerByAddress(ctx, "SOL", SWIF),
      dexScreenerByAddress(ctx, "SOL", SWIF),
      dexScreenerByAddress(ctx, "SOL", SWIF),
    ]);
    expect(ctx.telemetry.providerCalls.dexScreener).toBe(1);
  });

  it("repart en réseau une fois la durée de vie écoulée", async () => {
    const clock = manualClock();
    const http = httpWithDex();
    const ctx = ctxWith(http, clock);
    await dexScreenerByAddress(ctx, "SOL", SWIF);
    clock.advance(5 * 60 * 1000 + 1);
    await dexScreenerByAddress(ctx, "SOL", SWIF);
    expect(ctx.telemetry.providerCalls.dexScreener).toBe(2);
  });

  it("ne fige pas un échec réseau en réponse", async () => {
    const cache = new ResolutionCache();
    let attempts = 0;
    await expect(
      cache.wrap("k", undefined, async () => {
        attempts++;
        throw new Error("timeout");
      }),
    ).rejects.toThrow();
    await cache.wrap("k", undefined, async () => {
      attempts++;
      return "ok";
    });
    expect(attempts).toBe(2);
  });

  it("compte les économies PAR PROVIDER, pas globalement", async () => {
    // « on a économisé 12 appels » n'aide pas si on ignore lesquels. En V3
    // l'instrumentation attribue chaque succès de cache à son provider.
    const http = httpWithDex();
    const ctx = ctxWith(http);
    await dexScreenerByAddress(ctx, "SOL", SWIF);
    await dexScreenerByAddress(ctx, "SOL", SWIF);
    expect(ctx.telemetry.providerCalls.dexScreener).toBe(1);
    expect(ctx.telemetry.providerCacheHits.dexScreener).toBe(1);
    expect(ctx.telemetry.providerCacheHits.helius).toBe(0);
  });

  it("refuse les appels au-delà du plafond d'exécution, et les compte", async () => {
    const http = httpWithDex();
    const ctx = createProviderContext({
      http,
      cache: new ResolutionCache(),
      env: { heliusApiKey: "test-key-not-real" },
      budget: { maxCallsPerProvider: 1 },
    });
    await dexScreenerByAddress(ctx, "SOL", SWIF);
    const second = await dexScreenerByAddress(ctx, "SOL", BOTIFY);
    expect(second).toBeNull();
    expect(ctx.telemetry.providerCalls.dexScreener).toBe(1);
    expect(ctx.telemetry.budgetRefusals).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-7 — adapters lus sur des réponses réelles", () => {
  it("ignore les chainId hors table plutôt que de les deviner", async () => {
    // La recherche réelle $TOES renvoie des paires chainId="robinhood".
    const raw = searchTOES as { pairs: Array<{ chainId: string }> };
    expect(raw.pairs.some((p) => p.chainId === "robinhood")).toBe(true);
    const ctx = ctxWith();
    const markets = await dexScreenerSearchTicker(ctx, "TOES");
    expect(markets.length).toBeGreaterThan(0);
    expect(markets.every((m) => ["SOL", "ETH", "BSC", "BASE", "ARBITRUM"].includes(m.chainRaw))).toBe(true);
  });

  it("garde une seule paire par identité — la plus liquide", async () => {
    const ctx = ctxWith();
    const markets = await dexScreenerSearchTicker(ctx, "TOES");
    const keys = markets.map((m) => `${m.chainRaw}:${m.address}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("lit le marché d'une adresse précise", async () => {
    const ctx = ctxWith();
    const m = await dexScreenerByAddress(ctx, "SOL", SWIF);
    expect(m?.symbol).toBe("SWIF");
    expect(m?.liquidityUsd).toBeGreaterThan(0);
  });

  it("distingue « absent » de « indéterminé » côté chaîne", async () => {
    const absent = await heliusMintExists(ctxWith(), SWIF);
    expect(absent).toBe("absent");
    const noKey = createProviderContext({
      http: httpWithDex(),
      cache: new ResolutionCache(),
      env: { heliusApiKey: null },
    });
    expect(await heliusMintExists(noKey, SWIF)).toBe("unknown");
  });

  it("une URL non prévue ne retombe jamais sur le réseau", async () => {
    const http = createFixtureHttpClient([]);
    const ctx = createProviderContext({ http, cache: new ResolutionCache(), env: {} });
    expect(await dexScreenerByAddress(ctx, "SOL", SWIF)).toBeNull();
    expect(http.unmatched).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-8 — l'interne passe toujours avant le marché", () => {
  const curatedRow = {
    contractAddress: SWIF,
    chain: "solana",
    tokenSymbol: "SWIF",
    kolHandle: "someone",
    canonicalMint: null,
    canonicalChain: null,
    visibility: "public",
    createdAt: null,
  };

  it("n'appelle PAS DexScreener quand une source interne répond", async () => {
    const http = httpWithDex();
    const db = createFakeDb([{ match: 'FROM "KolTokenLink"', rows: [curatedRow] }]);
    const res = await resolveToken(
      { ticker: "SWIF", audience: "public", allowedChains: ["SOL"] },
      { db, providers: ctxWith(http) },
    );
    expect(res.status).toBe("RESOLVED");
    expect(http.calls.filter((u) => u.includes("dexscreener"))).toHaveLength(0);
    expect(res.method).toBe("curated");
  });

  it("descend sur DexScreener quand l'interne est vide", async () => {
    const http = httpWithDex();
    const db = createFakeDb([]);
    await resolveToken({ ticker: "TOES", audience: "public", allowedChains: ["SOL"] }, { db, providers: ctxWith(http) });
    expect(http.calls.some((u) => u.includes("/latest/dex/search"))).toBe(true);
  });

  it("n'atteint CoinGecko que si interne ET DexScreener sont vides", async () => {
    const http = createFixtureHttpClient([
      { match: "/latest/dex/search", json: { pairs: [] } },
      { match: "api.coingecko.com", json: { coins: [] } },
    ]);
    const db = createFakeDb([]);
    await resolveToken({ ticker: "ZZZQQ", audience: "public", allowedChains: ["SOL"] }, { db, providers: ctxWith(http) });
    expect(http.calls.some((u) => u.includes("coingecko"))).toBe(true);
  });

  it("ne consulte jamais CoinGecko quand DexScreener a répondu", async () => {
    const http = httpWithDex();
    const db = createFakeDb([]);
    await resolveToken({ ticker: "TOES", audience: "public", allowedChains: ["SOL"] }, { db, providers: ctxWith(http) });
    expect(http.calls.some((u) => u.includes("coingecko"))).toBe(false);
  });

  it("ne fait AUCUNE écriture : le SQL émis est exclusivement du SELECT", async () => {
    const db = createFakeDb([{ match: 'FROM "KolTokenLink"', rows: [curatedRow] }]);
    await resolveToken({ ticker: "SWIF", audience: "public", allowedChains: ["SOL"] }, { db, providers: ctxWith() });
    expect(db.queries.length).toBeGreaterThan(0);
    for (const q of db.queries) {
      expect(q.sql.trim().toUpperCase().startsWith("SELECT")).toBe(true);
      expect(q.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
    }
  });

  it("toute lecture de KolTokenLink porte une liste blanche énumérée sur visibility", async () => {
    const db = createFakeDb([]);
    await resolveToken({ ticker: "SWIF", audience: "internal", allowedChains: ["SOL"] }, { db, providers: ctxWith() });
    const links = db.queries.filter((q) => q.sql.includes('FROM "KolTokenLink"'));
    expect(links.length).toBeGreaterThan(0);
    for (const q of links) {
      expect(q.sql).toMatch(/"visibility"\s*(=\s*'public'|IN\s*\('public'(,\s*'draft')?\))/);
      expect(q.sql).not.toMatch(/visibility"?\s*(<>|!=)/);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-9 — règle d'or : jamais HIGH tant qu'un rival plausible subsiste", () => {
  const rival = (addr: string) =>
    candidate({ address: addr, matchType: "exact", signals: { ...emptySignals(), liquidityUsd: 50_000 } });

  it("deux exacts liquides → AMBIGUOUS, jamais RESOLVED", () => {
    const cands = rankCandidates([rival(SWIF), rival(BOTIFY)]);
    const conflicts = detectConflicts({ candidates: cands, ticker: "SWIF", explicitIdentityKeys: new Set() });
    const d = decide({ candidates: cands, ticker: "SWIF", explicitIdentityKeys: new Set(), conflicts });
    expect(d.status).toBe("AMBIGUOUS");
    expect(d.selected).toBeNull();
    expect(d.confidence).not.toBe("HIGH");
  });

  it("un ticker générique n'est jamais auto-résolu, même très liquide", () => {
    const cands = rankCandidates([
      candidate({ symbol: "PEPE", matchType: "exact", signals: { ...emptySignals(), liquidityUsd: 9_000_000 } }),
    ]);
    const d = decide({ candidates: cands, ticker: "PEPE", explicitIdentityKeys: new Set(), conflicts: [] });
    expect(d.status).toBe("AMBIGUOUS");
  });

  it("marché seul sous le plancher de liquidité → jamais résolu", () => {
    const thin = candidate({ signals: { ...emptySignals(), liquidityUsd: 300 } });
    const d = decide({ candidates: [thin], ticker: "SWIF", explicitIdentityKeys: new Set(), conflicts: [] });
    expect(d.status).toBe("AMBIGUOUS");
    expect(d.limitations.join(" ")).toMatch(String(DEFAULT_POLICY.minLiquidityUsdForAutoResolve));
  });

  it("la chaîne ne plafonne PLUS la confiance — la préférence Solana cachée a disparu", () => {
    // V2 plafonnait tout ce qui n'était pas Solana à MODERATE. C'était une
    // préférence déguisée en prudence : un token BSC documenté par un dossier
    // publié valait moins qu'un token SOL trouvé sur un marché.
    const evm = candidate({
      chain: "BSC",
      address: LAB_BSC.toLowerCase(),
      symbol: "LAB",
      sources: ["casefile"],
      signals: { ...emptySignals(), hasPublishedCasefile: true },
    });
    const sol = candidate({ symbol: "LAB", sources: ["casefile"], signals: { ...emptySignals(), hasPublishedCasefile: true } });
    const dEvm = decide({ candidates: [evm], ticker: "LAB", explicitIdentityKeys: new Set(), conflicts: [] });
    const dSol = decide({ candidates: [sol], ticker: "LAB", explicitIdentityKeys: new Set(), conflicts: [] });
    expect(dEvm.status).toBe("RESOLVED");
    expect(dEvm.confidence).toBe("HIGH");
    expect(dEvm.confidence).toBe(dSol.confidence);
  });

  it("un lien curé unique tranche sur un préfixe, mais pas à HIGH", () => {
    const curated = candidate({ symbol: "TOESCOIN", matchType: "prefix", sources: ["curated"] });
    const d = decide({ candidates: [curated], ticker: "TOES", explicitIdentityKeys: new Set(), conflicts: [] });
    expect(d.status).toBe("RESOLVED");
    expect(d.confidence).toBe("MODERATE");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-10 — conflit ticker ↔ adresse", () => {
  const explicitOther = candidate({
    address: BOTIFY,
    symbol: "BOTIFY",
    matchType: "explicit_ca",
    sources: ["explicit_ca", "dexscreener"],
  });
  const tickerOwner = candidate({ address: SWIF, symbol: "SWIF", matchType: "exact" });
  const keys = new Set([identityKey("SOL", BOTIFY)]);

  it("détecte que le CA collé ne porte pas le ticker annoncé", () => {
    const conflicts = detectConflicts({
      candidates: [explicitOther, tickerOwner],
      ticker: "SWIF",
      explicitIdentityKeys: keys,
    });
    expect(conflicts.map((c) => c.kind)).toContain("ticker_vs_address");
  });

  it("ne sert JAMAIS un conflit comme résolu", () => {
    const conflicts = detectConflicts({
      candidates: [explicitOther, tickerOwner],
      ticker: "SWIF",
      explicitIdentityKeys: keys,
    });
    const d = decide({
      candidates: [explicitOther, tickerOwner],
      ticker: "SWIF",
      explicitIdentityKeys: keys,
      conflicts,
    });
    expect(d.status).toBe("CONFLICT");
    expect(d.selected).toBeNull();
  });

  it("crie AU CONTRAIRE au conflit dès qu'un contrat rival porte le ticker", () => {
    // ─── Ce test disait l'inverse, et il avait tort ────────────────────────
    // Il verrouillait la sortie anticipée « le symbole est d'accord, donc pas de
    // conflit ». Or le symbole est la seule variable qu'un imitateur contrôle :
    // recopier le ticker suffisait à désarmer la détection. La porte se décide
    // désormais sur les contrats rivaux, pas sur l'étiquette.
    const rightCa = candidate({
      address: SWIF,
      symbol: "SWIF",
      matchType: "explicit_ca",
      sources: ["explicit_ca", "dexscreener"],
    });
    const homonym = candidate({ address: BOTIFY, symbol: "SWIF", matchType: "exact" });
    const keys = new Set([identityKey("SOL", SWIF)]);
    const conflicts = detectConflicts({
      candidates: [rightCa, homonym],
      ticker: "SWIF",
      explicitIdentityKeys: keys,
    });
    expect(conflicts.map((c) => c.kind)).toContain("contract_identity");
    const d = decide({
      candidates: [rightCa, homonym],
      ticker: "SWIF",
      explicitIdentityKeys: keys,
      conflicts,
    });
    expect(d.status).not.toBe("RESOLVED");
    expect(d.confidence).not.toBe("HIGH");
  });

  it("un contrat fourni SANS rival reste résolu en explicit_ca", () => {
    // Le contrôle n'est pas une paranoïa générale : sans contrat rival portant
    // le ticker, l'adresse collée fait autorité et la résolution passe.
    const rightCa = candidate({
      address: SWIF,
      symbol: "SWIF",
      matchType: "explicit_ca",
      sources: ["explicit_ca", "dexscreener"],
    });
    const keys = new Set([identityKey("SOL", SWIF)]);
    const conflicts = detectConflicts({
      candidates: [rightCa],
      ticker: "SWIF",
      explicitIdentityKeys: keys,
    });
    expect(conflicts).toEqual([]);
    const d = decide({
      candidates: [rightCa],
      ticker: "SWIF",
      explicitIdentityKeys: keys,
      conflicts,
    });
    expect(d.status).toBe("RESOLVED");
    expect(d.method).toBe("explicit_ca");
  });

  it("signale un désaccord entre source curée et marché sans trancher seul", () => {
    const internal = candidate({ address: SWIF, sources: ["curated"], matchType: "exact" });
    const market = candidate({ address: BOTIFY, sources: ["dexscreener"], matchType: "exact" });
    const conflicts = detectConflicts({
      candidates: [internal, market],
      ticker: "SWIF",
      explicitIdentityKeys: new Set(),
    });
    expect(conflicts.map((c) => c.kind)).toContain("internal_vs_market");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("UR-11 — le mint neuf non indexé n'est pas perdu", () => {
  const FRESH = "C2omVhcvt3DDY77S2KZzawFJQeETZofgZ4eNWWkXpump";

  function httpFresh(existsPayload: unknown) {
    return createFixtureHttpClient([
      { match: "/tokens/v1/", json: [] },
      { match: "helius-rpc.com", json: existsPayload },
      { match: "/latest/dex/search", json: { pairs: [] } },
      { match: "coingecko", json: { coins: [] } },
    ]);
  }

  it("résout un mint confirmé on-chain sans marché, avec la limitation dite", async () => {
    const ctx = createProviderContext({
      http: httpFresh({ result: { value: { data: { parsed: { type: "mint" } } } } }),
      cache: new ResolutionCache(),
      env: { heliusApiKey: "test-key-not-real" },
    });
    const res = await resolveToken(
      { addresses: [FRESH], audience: "internal", allowedChains: ["SOL"] },
      { db: null, providers: ctx },
    );
    expect(res.status).toBe("RESOLVED");
    expect(res.confidence).toBe("MODERATE");
    expect(res.method).toBe("onchain");
    expect(res.limitations.join(" ")).toMatch(/aucune paire indexée|on-chain/i);
    expect(res.selected?.signals.isPumpFun).toBe(true);
  });

  it("absence de clé RPC ≠ preuve d'inexistence", async () => {
    const ctx = createProviderContext({
      http: httpFresh({ result: { value: null } }),
      cache: new ResolutionCache(),
      env: { heliusApiKey: null },
    });
    const res = await resolveToken(
      { addresses: [FRESH], audience: "internal", allowedChains: ["SOL"] },
      { db: null, providers: ctx },
    );
    expect(res.status).not.toBe("RESOLVED");
    expect(res.limitations.join(" ")).toMatch(/absence de preuve, pas preuve d'absence/);
  });

  it("extrait une adresse citée dans le corps d'un post", async () => {
    const ctx = createProviderContext({
      http: httpFresh({ result: { value: { data: { parsed: { type: "mint" } } } } }),
      cache: new ResolutionCache(),
      env: { heliusApiKey: "test-key-not-real" },
    });
    const res = await resolveToken(
      { rawText: `nouveau gem, Ca>> ${FRESH} ape maintenant`, audience: "internal", allowedChains: ["SOL"] },
      { db: null, providers: ctx },
    );
    expect(res.selected?.address).toBe(FRESH);
  });

  it("compte les appels sortants pour que le coût soit mesurable", async () => {
    const ctx = createProviderContext({
      http: httpFresh({ result: { value: { data: { parsed: { type: "mint" } } } } }),
      cache: new ResolutionCache(),
      env: { heliusApiKey: "test-key-not-real" },
    });
    const res = await resolveToken(
      { addresses: [FRESH], audience: "internal", allowedChains: ["SOL"] },
      { db: null, providers: ctx },
    );
    expect(res.telemetry.providerCalls.dexScreener).toBe(1);
    expect(res.telemetry.providerCalls.helius).toBe(1);
    expect(res.telemetry.dbQueries).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("garde-fou — le pipeline local reste déterministe de bout en bout", () => {
  it("deux exécutions sur les mêmes entrées produisent le même résultat", () => {
    const raws: RawCandidate[] = [
      { chain: "SOL", address: SWIF, symbol: "SWIF", source: "mentions" },
      { chain: "SOL", address: BOTIFY, symbol: "SWIF", source: "dexscreener" },
      { chain: "SOL", address: SWIF, symbol: "SWIF", source: "curated" },
    ];
    const a = buildCandidateSet(raws, { ticker: "SWIF", audience: "public", allowedChains: ["SOL"], policy: DEFAULT_POLICY });
    const b = buildCandidateSet(raws.slice().reverse(), { ticker: "SWIF", audience: "public", allowedChains: ["SOL"], policy: DEFAULT_POLICY });
    expect(JSON.stringify(a.candidates)).toBe(JSON.stringify(b.candidates));
  });
});
