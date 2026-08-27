// ─── FRR — taux de faux CRITICAL sur le corpus factuel ─────────────────────
//
// Un « faux CRITICAL » est un cas où le résolveur sert un verdict CERTAIN
// (RESOLVED) alors que des contrats rivaux subsistent sous le même ticker. Le
// lecteur reçoit une réponse, pas un choix — et la réponse peut être celle de
// l'imitateur.
//
// FRR = cas servis comme certains / taille du corpus. Objectif : 0.
//
// Ce fichier MESURE, il ne se contente pas d'assener. Le compte est imprimé,
// pour que la même mesure puisse être rejouée avant/après un changement de
// règle sans avoir à lire le diff.

import { describe, it, expect } from "vitest";

import { identityKey } from "../address";
import { resolveToken } from "../resolve";
import { ResolutionCache } from "../providers/cache";
import { createFixtureHttpClient } from "../providers/fixtureHttp";
import { createProviderContext } from "../providers";
import { createFakeDb } from "./helpers";
import { FALSE_CRITICAL_CORPUS, type CorpusCase } from "./falseCriticalCorpus";
import type { TokenResolution } from "../types";

async function runCase(c: CorpusCase): Promise<TokenResolution> {
  return resolveToken(c.request, {
    db: createFakeDb(c.dbRoutes),
    providers: createProviderContext({
      http: createFixtureHttpClient(c.httpRoutes),
      cache: new ResolutionCache(),
      env: { heliusApiKey: "test-key-not-real" },
    }),
  });
}

/** Un cas est un faux CRITICAL s'il est servi comme certain malgré des rivaux. */
function isFalseCritical(res: TokenResolution): boolean {
  return res.status === "RESOLVED";
}

describe("FRR — corpus factuel des faux CRITICAL", () => {
  it("le corpus porte bien les 5 cas nommés", () => {
    expect(FALSE_CRITICAL_CORPUS.map((c) => c.id)).toEqual(["E4", "E5", "S01", "S05", "K6"]);
  });

  it.each(FALSE_CRITICAL_CORPUS.map((c) => [c.id, c] as const))(
    "%s n'est jamais servi comme certain",
    async (_id, c) => {
      const res = await runCase(c);
      expect(["CONFLICT", "AMBIGUOUS"]).toContain(res.status);
      expect(res.selected).toBeNull();
      expect(res.confidence).not.toBe("HIGH");
    },
  );

  it.each(FALSE_CRITICAL_CORPUS.map((c) => [c.id, c] as const))(
    "%s nomme les contrats rivaux dans le conflit",
    async (_id, c) => {
      const res = await runCase(c);
      const named = new Set(res.conflicts.flatMap((k) => k.between));
      // Au moins un rival d'identité doit être cité : un conflit qui ne dit pas
      // CONTRE QUOI il porte n'est pas exploitable en revue.
      const rivalKeys = c.rivals.map((r) =>
        [...res.candidates, ...res.excluded]
          .filter((x) => x.address.toLowerCase() === r.toLowerCase())
          .map((x) => identityKey(x.chain, x.address)),
      );
      expect(rivalKeys.flat().some((k) => named.has(k))).toBe(true);
    },
  );

  it("FRR = 0 sur l'ensemble du corpus", async () => {
    const results = await Promise.all(FALSE_CRITICAL_CORPUS.map(runCase));
    const falseCriticals = FALSE_CRITICAL_CORPUS.filter((_, i) =>
      isFalseCritical(results[i]),
    ).map((c) => c.id);
    const frr = falseCriticals.length / FALSE_CRITICAL_CORPUS.length;

    console.log(
      `[FRR] faux CRITICAL = ${falseCriticals.length}/${FALSE_CRITICAL_CORPUS.length} ` +
        `(${(frr * 100).toFixed(0)} %)` +
        (falseCriticals.length ? ` — ${falseCriticals.join(", ")}` : ""),
    );

    expect(falseCriticals).toEqual([]);
    expect(frr).toBe(0);
  });
});
