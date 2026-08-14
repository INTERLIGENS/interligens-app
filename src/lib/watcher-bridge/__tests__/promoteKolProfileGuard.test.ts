/**
 * src/lib/watcher-bridge/__tests__/promoteKolProfileGuard.test.ts
 *
 * Régression de la cause racine des 3 erreurs FK du 2026-06-29
 * (`KolTokenLink_kolHandle_fkey`, code 23503).
 *
 * Le bridge lit le handle depuis `influencers` (watchlist du watcher) alors que
 * KolTokenLink.kolHandle porte une FK vers KolProfile(handle). Les deux
 * populations divergent : au 2026-08-14, 66 des 116 influencers n'ont aucun
 * KolProfile. Sans garde, chacun de ces candidats faisait remonter une 23503
 * depuis l'INSERT — comptée en `errors`, donc un écart de données présenté
 * comme une panne du job.
 *
 * Ce que la garde doit prouver :
 *   1. le candidat sans KolProfile sort en `no_kol_profile`, pas en `error` ;
 *   2. il est écarté AVANT toute résolution de token (aucun appel payant
 *      DexScreener/Helius pour un candidat qui ne peut produire aucun lien) ;
 *   3. le candidat avec KolProfile n'est pas affecté par la garde.
 */

import { describe, it, expect, vi } from "vitest";
import { promoteWatcherSignalsToDraft } from "@/lib/watcher-bridge/promoteWatcherSignalsToDraft";

/** Faux RawDb : répond aux 2 SELECT du pré-filtre, journalise tout le reste. */
function makeDb(opts: {
  candidates: Array<{ id: string; handle: string }>;
  kolProfiles: string[];
}) {
  const queries: string[] = [];
  const db = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $queryRawUnsafe: vi.fn(async (q: string, ..._v: unknown[]): Promise<any> => {
      queries.push(q);
      if (q.includes('JOIN "influencers"')) return opts.candidates;
      if (q.includes('FROM "KolProfile"')) {
        return opts.kolProfiles.map((handle) => ({ handle }));
      }
      // Toute autre requête = le candidat est entré dans promoteCandidate.
      return [];
    }),
  };
  return { db, queries };
}

describe("promoteWatcherSignalsToDraft — garde KolProfile (FK KolTokenLink)", () => {
  it("écarte en no_kol_profile, jamais en error, quand le KolProfile manque", async () => {
    const { db } = makeDb({
      candidates: [{ id: "cand-orphelin", handle: "HandleSansProfil" }],
      kolProfiles: [],
    });

    const s = await promoteWatcherSignalsToDraft(db, { candidateIds: ["cand-orphelin"] });

    expect(s.noKolProfileSkipped).toBe(1);
    expect(s.errors).toBe(0);
    expect(s.actionCounts["no_kol_profile"]).toBe(1);
    expect(s.results[0]).toMatchObject({
      candidateId: "cand-orphelin",
      action: "no_kol_profile",
      kolHandle: "HandleSansProfil",
    });
  });

  it("n'engage aucune résolution de token pour un candidat sans KolProfile", async () => {
    const { db, queries } = makeDb({
      candidates: [{ id: "cand-orphelin", handle: "HandleSansProfil" }],
      kolProfiles: [],
    });

    await promoteWatcherSignalsToDraft(db, { candidateIds: ["cand-orphelin"] });

    // Exactement 2 requêtes : résolution des handles, puis existence KolProfile.
    // Une 3e signifierait que promoteCandidate a démarré — donc qu'un appel
    // DexScreener/Helius a été engagé pour rien.
    expect(queries).toHaveLength(2);
    expect(queries.some((q) => q.includes("social_post_candidates"))).toBe(true);
    expect(queries.some((q) => q.includes('FROM "KolProfile"'))).toBe(true);
  });

  it("laisse passer le candidat dont le KolProfile existe", async () => {
    const { db, queries } = makeDb({
      candidates: [{ id: "cand-ok", handle: "GordonGekko" }],
      kolProfiles: ["GordonGekko"],
    });

    const s = await promoteWatcherSignalsToDraft(db, { candidateIds: ["cand-ok"] });

    expect(s.noKolProfileSkipped).toBe(0);
    expect(s.actionCounts["no_kol_profile"]).toBeUndefined();
    // La garde a laissé le candidat entrer dans promoteCandidate.
    expect(queries.length).toBeGreaterThan(2);
  });

  it("trie un lot mixte sans perdre ni requalifier de candidat", async () => {
    const { db } = makeDb({
      candidates: [
        { id: "c1", handle: "GordonGekko" },
        { id: "c2", handle: "HandleSansProfil" },
        { id: "c3", handle: "AutreSansProfil" },
      ],
      kolProfiles: ["GordonGekko"],
    });

    const s = await promoteWatcherSignalsToDraft(db, { candidateIds: ["c1", "c2", "c3"] });

    expect(s.selected).toBe(3);
    expect(s.noKolProfileSkipped).toBe(2);
    expect(s.errors).toBe(0);
    // Chaque id sélectionné atterrit dans exactement un bucket.
    expect(s.results).toHaveLength(3);
  });
});
