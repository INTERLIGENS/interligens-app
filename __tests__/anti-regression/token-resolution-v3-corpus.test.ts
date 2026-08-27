// ─── GEL ANTI-RÉGRESSION — corpus de résolution V3 ─────────────────────────
//
// Ce fichier fige DEUX corpus dont la vérité est établie, pour qu'aucun
// changement futur du résolveur ne les défasse en silence.
//
//   1. CORPUS FACTUEL — les 5 faux CRITICAL (E4, E5, S01, S05, K6). Un contrat
//      servi comme certain alors que des rivaux d'identité subsistent. Sa
//      vérité ne se discute pas : le FRR factuel doit rester à 0.
//
//   2. CORPUS DOCTRINAL — les cas arbitrés au checkpoint du 2026-08-27, I3 et
//      R22 ré-étiquetés selon la doctrine RETENUE (leurs anciennes étiquettes
//      `PENDING_POLICY` désignaient l'option écartée).
//
// ─── DÉTERMINISME ──────────────────────────────────────────────────────────
// Aucun réseau : le client HTTP sur fixtures échoue explicitement sur une URL
// non enregistrée, il ne retombe jamais sur le vrai DexScreener. Aucune base :
// `createFakeDb` applique les mêmes filtres que le SQL réel. Aucune horloge :
// l'instant d'observation est une constante. Un test vérifie qu'un double
// passage rend le MÊME résultat, champ pour champ — sans quoi « le corpus
// passe » ne voudrait rien dire.
//
// ─── PÉRIMÈTRE — ce que ce gel NE couvre PAS ───────────────────────────────
// Le backtest de 91 cas cité dans BUILD1_V3_READY_FOR_SHADOW n'a jamais été
// versionné : il vivait dans la session du harnais T2. Ce qui est gelé ici est
// le corpus PRÉSENT DANS LE DÉPÔT — 5 cas factuels et 6 cas doctrinaux —, pas
// les 91. La distinction compte : ce fichier prouve que les cas connus tiennent,
// il ne prouve pas un taux mesuré sur un corpus qu'il n'a pas.

import { describe, it, expect } from "vitest";

import { resolveToken } from "@/lib/token-resolution/v3/resolve";
import { identityKey } from "@/lib/token-resolution/v3/address";
import { ResolutionCache } from "@/lib/token-resolution/v3/providers/cache";
import { createFixtureHttpClient } from "@/lib/token-resolution/v3/providers/fixtureHttp";
import { createProviderContext } from "@/lib/token-resolution/v3/providers";
import { createFakeDb } from "@/lib/token-resolution/v3/__tests__/helpers";
import {
  FALSE_CRITICAL_CORPUS,
  type CorpusCase,
} from "@/lib/token-resolution/v3/__tests__/falseCriticalCorpus";
import {
  DOCTRINAL_CORPUS,
  confidenceRank,
  type DoctrinalCase,
} from "@/lib/token-resolution/v3/__tests__/doctrinalCorpus";
import type { TokenResolution } from "@/lib/token-resolution/v3/types";

type AnyCase = Pick<CorpusCase | DoctrinalCase, "request" | "dbRoutes" | "httpRoutes">;

async function runCase(c: AnyCase): Promise<TokenResolution> {
  return resolveToken(c.request, {
    db: createFakeDb(c.dbRoutes),
    providers: createProviderContext({
      http: createFixtureHttpClient(c.httpRoutes),
      cache: new ResolutionCache(),
      env: { heliusApiKey: "test-key-not-real" },
    }),
  });
}

/** Empreinte stable d'un verdict : ce qui doit rester identique d'un run à l'autre. */
function fingerprint(r: TokenResolution) {
  return {
    status: r.status,
    confidence: r.confidence,
    method: r.method,
    callerSupport: r.callerSupport,
    selected: r.selected ? identityKey(r.selected.chain, r.selected.address) : null,
    candidates: r.candidates.map((c) => identityKey(c.chain, c.address)),
    excluded: r.excluded.map((c) => identityKey(c.chain, c.address)),
    conflicts: r.conflicts.map((c) => `${c.kind}:${[...c.between].sort().join("|")}`).sort(),
    limitations: [...r.limitations].sort(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
describe("GEL — corpus factuel : le FRR reste à 0", () => {
  it("le corpus gelé porte exactement les 5 cas nommés", () => {
    expect(FALSE_CRITICAL_CORPUS.map((c) => c.id)).toEqual(["E4", "E5", "S01", "S05", "K6"]);
  });

  it.each(FALSE_CRITICAL_CORPUS.map((c) => [c.id, c] as const))(
    "%s n'est jamais servi comme certain",
    async (_id, c) => {
      const res = await runCase(c);
      expect(res.status).not.toBe("RESOLVED");
      expect(res.selected).toBeNull();
      expect(res.confidence).not.toBe("HIGH");
    },
  );

  it("FRR factuel = 0 — aucune exception tolérée", async () => {
    const results = await Promise.all(FALSE_CRITICAL_CORPUS.map(runCase));
    const faux = FALSE_CRITICAL_CORPUS.filter((_, i) => results[i].status === "RESOLVED").map(
      (c) => c.id,
    );
    expect(faux).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("GEL — corpus doctrinal : la doctrine RATIFIÉE, pas l'ancienne étiquette", () => {
  it("le corpus gelé porte exactement les cas arbitrés", () => {
    expect(DOCTRINAL_CORPUS.map((c) => c.id)).toEqual([
      "I3",
      "R22-in",
      "R22-out",
      "E7b",
      "S04-in-scope",
      "S04-out-of-scope",
    ]);
  });

  it.each(DOCTRINAL_CORPUS.map((c) => [c.id, c] as const))(
    "%s rend le verdict ratifié",
    async (_id, c) => {
      const r = await runCase(c);
      const e = c.expect;
      expect(r.status, `${c.id} — ${c.ratified}`).toBe(e.status);
      if (e.confidence) expect(r.confidence).toBe(e.confidence);
      if (e.maxConfidence) {
        expect(confidenceRank(r.confidence)).toBeLessThanOrEqual(confidenceRank(e.maxConfidence));
      }
      if (e.method) expect(r.method).toBe(e.method);
      if (e.selectedIsNull) expect(r.selected).toBeNull();
      if (e.selectedAddress) expect(r.selected?.address).toBe(e.selectedAddress);
      if (e.excludesAddress) {
        expect(r.excluded.map((x) => x.address)).toContain(e.excludesAddress);
      }
      if (e.limitationsMatch) expect(r.limitations.join(" ")).toMatch(e.limitationsMatch);
    },
  );

  // ─── La ré-étiquette elle-même est vérifiée ─────────────────────────────
  it("I3 et R22-in portent bien la trace de l'étiquette abandonnée", () => {
    const relabelled = DOCTRINAL_CORPUS.filter((c) => c.supersededLabel);
    expect(relabelled.map((c) => c.id)).toEqual(["I3", "R22-in"]);
  });

  it("I3 est ratifié RESOLVED, alors que l'étiquette périmée disait AMBIGUOUS", () => {
    const i3 = DOCTRINAL_CORPUS.find((c) => c.id === "I3")!;
    expect(i3.expect.status).toBe("RESOLVED");
    expect(i3.supersededLabel).toMatch(/AMBIGUOUS/);
    // Une ré-étiquette qui garderait le même verdict ne serait pas une
    // ré-étiquette : la fiche mentirait sur son propre historique.
    expect(i3.supersededLabel).not.toMatch(new RegExp(`^${i3.expect.status}`));
  });

  it("I3 résout SANS jamais certifier — MODERATE est un plafond, pas un hasard", async () => {
    const i3 = DOCTRINAL_CORPUS.find((c) => c.id === "I3")!;
    const r = await runCase(i3);
    expect(r.status).toBe("RESOLVED");
    expect(r.confidence).not.toBe("HIGH");
  });

  it("R22 : le même écart de 10 j résout, 400 j écarte — la tolérance sépare", async () => {
    const inside = DOCTRINAL_CORPUS.find((c) => c.id === "R22-in")!;
    const outside = DOCTRINAL_CORPUS.find((c) => c.id === "R22-out")!;
    const [a, b] = await Promise.all([runCase(inside), runCase(outside)]);
    expect(a.status).toBe("RESOLVED");
    expect(b.status).not.toBe("RESOLVED");
    // Le point ratifié : hors tolérance on ÉCARTE, on ne déclasse pas.
    expect(b.selected).toBeNull();
    expect(b.excluded.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("GEL — déterminisme", () => {
  const ALL: AnyCase[] = [...FALSE_CRITICAL_CORPUS, ...DOCTRINAL_CORPUS];

  it("deux passages rendent le même verdict, champ pour champ", async () => {
    const first = await Promise.all(ALL.map(runCase));
    const second = await Promise.all(ALL.map(runCase));
    expect(first.map(fingerprint)).toEqual(second.map(fingerprint));
  });

  it("aucun cas ne sort sur le réseau : toute URL demandée est servie par fixture", async () => {
    for (const c of ALL) {
      const http = createFixtureHttpClient(c.httpRoutes);
      await resolveToken(c.request, {
        db: createFakeDb(c.dbRoutes),
        providers: createProviderContext({
          http,
          cache: new ResolutionCache(),
          env: { heliusApiKey: "test-key-not-real" },
        }),
      });
      expect(http.unmatched, `URL non couverte par une fixture : ${http.unmatched[0]}`).toEqual([]);
    }
  });
});
