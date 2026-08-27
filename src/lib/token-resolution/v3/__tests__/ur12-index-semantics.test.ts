// ─── UR-12 — SÉMANTIQUE D'INDEX ────────────────────────────────────────────
//
// INVARIANT CONTRACTUEL :
//   Une structure indexée par caseId ne peut JAMAIS être consommée comme un
//   mapping ticker/symbole sans transformation explicite.
//
// Le cas réel qui motive cet invariant : CA_MAP (src/lib/kol/proceeds.ts) est un
// index caseId → contrat. Ses clés RESSEMBLENT à des tickers ("BOTIFY",
// "GHOST"), et deux d'entre elles n'en sont pas du tout :
//
//   CA_MAP["SERIAL-12RUGS"] = BYZ9CcZ…   ← le contrat de BOTIFY
//   CA_MAP["DIONE-RUG"]     = De4ULou…   ← le contrat du dossier GHOST
//   CA_MAP["GHOST-RUG"]     = De4ULou…   ← même contrat, autre clé de dossier
//
// « SERIAL-12RUGS » est un identifiant de DOSSIER — « douze rugs en série »,
// un motif de comportement. Ce n'est le ticker d'aucun token. Le lire comme un
// symbole fait résoudre un nom de dossier vers un contrat sans rapport.
//
// Valeurs et lignes vérifiées en lecture seule sur ep-square-band le 2026-08-27 :
//   KolCase.caseId distincts : BOTIFY · GHOST · RAVE-DUMP-APR2026 · SERIAL-12RUGS
//   KolTokenLink public "SERIAL-12RUGS" → contractAddress "PENDING:SERIAL-12RUGS"
//   KolTokenLink public "GHOST"         → BBKPiLM9…GHST (5 KOL)
//   TokenScanAggregate BYZ9CcZ… scanCount 4 · KolTokenInvolvement BYZ9CcZ… 3 KOL

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

import { resolveToken } from "../resolve";
import { ResolutionCache } from "../providers/cache";
import { createFixtureHttpClient } from "../providers/fixtureHttp";
import { createProviderContext } from "../providers";
import { createFakeDb } from "./helpers";

// Contrats réels (prod).
const BOTIFY_CA = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const GHOST_CURATED_CA = "BBKPiLM9KjdJW7oQSKt99RVWcZdhF6sEHRKnwqeBGHST";
const GHOST_CASEMAP_CA = "De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump";

/** Base factice reproduisant les lignes de prod utiles aux deux scénarios. */
function prodLikeDb() {
  return createFakeDb([
    {
      match: 'FROM "KolTokenLink"',
      rows: [
        // La ligne SERIAL-12RUGS existe bel et bien, et son contrat est un
        // marqueur éditorial : elle ne produit donc AUCUN candidat.
        {
          contractAddress: "PENDING:SERIAL-12RUGS",
          chain: "solana",
          tokenSymbol: "SERIAL-12RUGS",
          kolHandle: "bkokoski",
          canonicalMint: null,
          canonicalChain: null,
          visibility: "public",
          createdAt: null,
        },
        ...["bkokoski", "GordonGekko", "planted", "lynk0x", "sxyz500"].map((h) => ({
          contractAddress: GHOST_CURATED_CA,
          chain: "solana",
          tokenSymbol: "GHOST",
          kolHandle: h,
          canonicalMint: null,
          canonicalChain: null,
          visibility: "public",
          createdAt: null,
        })),
      ],
    },
    {
      match: 'FROM "TokenScanAggregate"',
      rows: [
        { mint: BOTIFY_CA, scanCount: 4 },
        { mint: GHOST_CURATED_CA, scanCount: 7 },
        { mint: GHOST_CASEMAP_CA, scanCount: 1 },
      ],
    },
    {
      match: 'FROM "KolTokenInvolvement"',
      rows: [
        { chain: "SOL", tokenMint: BOTIFY_CA, kolHandle: "a" },
        { chain: "SOL", tokenMint: BOTIFY_CA, kolHandle: "b" },
        { chain: "SOL", tokenMint: BOTIFY_CA, kolHandle: "c" },
        { chain: "SOL", tokenMint: GHOST_CURATED_CA, kolHandle: "a" },
      ],
    },
  ]);
}

/** Aucun marché : on isole strictement l'effet des sources internes. */
function offlineProviders() {
  return createProviderContext({
    http: createFixtureHttpClient([
      { match: "/latest/dex/search", json: { pairs: [] } },
      { match: "/tokens/v1/", json: [] },
      { match: "coingecko", json: { coins: [] } },
    ]),
    cache: new ResolutionCache(),
    env: { heliusApiKey: null },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
describe("UR-12 — un identifiant de dossier n'est pas un ticker", () => {
  it("$SERIAL-12RUGS ne résout JAMAIS vers le contrat de BOTIFY", async () => {
    const res = await resolveToken(
      { ticker: "SERIAL-12RUGS", audience: "public", allowedChains: ["SOL"] },
      { db: prodLikeDb(), providers: offlineProviders() },
    );
    expect(res.selected?.address).not.toBe(BOTIFY_CA);
    expect(res.candidates.map((c) => c.address)).not.toContain(BOTIFY_CA);
  });

  it("$SERIAL-12RUGS n'est pas servi comme certain", async () => {
    const res = await resolveToken(
      { ticker: "SERIAL-12RUGS", audience: "public", allowedChains: ["SOL"] },
      { db: prodLikeDb(), providers: offlineProviders() },
    );
    // Le seul lien curé portant ce symbole a un contrat marqueur : il n'y a
    // rien à résoudre. Prétendre le contraire, c'est fabriquer une identité.
    expect(res.status).not.toBe("RESOLVED");
    expect(res.confidence).not.toBe("HIGH");
  });

  it("$DIONE-RUG ne résout pas vers le contrat du dossier GHOST", async () => {
    const res = await resolveToken(
      { ticker: "DIONE-RUG", audience: "public", allowedChains: ["SOL"] },
      { db: prodLikeDb(), providers: offlineProviders() },
    );
    expect(res.selected?.address).not.toBe(GHOST_CASEMAP_CA);
  });

  it("$GHOST résout sur le contrat curé, comme la V1", async () => {
    // L'index de dossiers porte pour la clé GHOST un contrat (De4ULou…) qui
    // n'apparaît dans AUCUNE ligne KolTokenLink. Le lire comme un symbole
    // fabriquait un rival fantôme, et ce rival bloquait la résolution par
    // collision d'identité E5 — alors que la V1 servait le lien curé.
    const res = await resolveToken(
      { ticker: "GHOST", audience: "public", allowedChains: ["SOL"] },
      { db: prodLikeDb(), providers: offlineProviders() },
    );
    expect(res.status).toBe("RESOLVED");
    expect(res.selected?.address).toBe(GHOST_CURATED_CA);
    expect(res.method).toBe("curated");
    expect(res.candidates.map((c) => c.address)).not.toContain(GHOST_CASEMAP_CA);
  });

  it("le contrat fantôme ne se glisse pas non plus dans les écartés", async () => {
    const res = await resolveToken(
      { ticker: "GHOST", audience: "public", allowedChains: ["SOL"] },
      { db: prodLikeDb(), providers: offlineProviders() },
    );
    const all = [...res.candidates, ...res.excluded].map((c) => c.address);
    expect(all).not.toContain(GHOST_CASEMAP_CA);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Invariant STATIQUE : la règle doit survivre à quelqu'un qui rebranche
// l'index par ticker « juste pour dépanner ».
const ROOT = join(__dirname, "..", "..", "..", "..", "..");
const V3 = join(__dirname, "..");

/** Retire commentaires de bloc et de ligne — le code seul est jugé. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__fixtures__") continue;
      walk(full, out);
    } else if (/\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const V3_FILES = walk(V3).map((f) => ({
  path: relative(ROOT, f).split(sep).join("/"),
  source: readFileSync(f, "utf8"),
}));

describe("UR-12 — invariant statique sur la consommation de l'index", () => {
  it("le garde-fou voit bien des fichiers (sinon il est vert pour rien)", () => {
    expect(V3_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it("CA_MAP n'est importée que par le module qui déclare sa sémantique", () => {
    const importers = V3_FILES.filter(
      (f) => /from\s+"@\/lib\/kol\/proceeds"/.test(f.source) && !/__tests__/.test(f.path),
    ).map((f) => f.path);
    expect(importers).toEqual(["src/lib/token-resolution/v3/sources/caseIndex.ts"]);
  });

  it("aucun fichier V3 n'indexe CA_MAP par une valeur issue d'un ticker", () => {
    const offenders: string[] = [];
    for (const f of V3_FILES) {
      if (/__tests__/.test(f.path)) continue;
      // Les commentaires CITENT le défaut pour l'expliquer ; on ne juge que le code.
      for (const m of stripComments(f.source).matchAll(/CA_MAP\s*\[([^\]]*)\]/g)) {
        const key = m[1];
        // Seule une valeur explicitement portée par le type CaseId est admise.
        if (!/caseId/i.test(key)) offenders.push(`${f.path} → CA_MAP[${key}]`);
      }
    }
    expect(
      offenders,
      "Un index caseId lu avec une clé qui n'est pas un caseId :\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("le module de l'index ne connaît ni ticker, ni cashtag, ni symbole", () => {
    const mod = V3_FILES.find((f) => f.path.endsWith("v3/sources/caseIndex.ts"));
    expect(mod, "src/lib/token-resolution/v3/sources/caseIndex.ts est introuvable").toBeTruthy();
    // Les commentaires expliquent POURQUOI le ticker est banni ; on ne regarde
    // donc que le code, commentaires retirés.
    const code = stripComments(mod!.source);
    expect(/\bticker\b/i.test(code)).toBe(false);
    expect(/\bcashtag\b/i.test(code)).toBe(false);
  });

  it("aucun lecteur de source ne fabrique de candidat à partir d'un ticker et de CA_MAP", () => {
    const db = V3_FILES.find((f) => f.path.endsWith("v3/sources/db.ts"));
    expect(db).toBeTruthy();
    expect(/CA_MAP/.test(db!.source)).toBe(false);
    expect(/findCaMapByTicker/.test(db!.source)).toBe(false);
  });
});
