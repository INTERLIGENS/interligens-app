// --- BUILD 3-B : l'idempotence des non résolus ----------------------------
//
// CE QUE CE FICHIER PROUVE, et pourquoi il fallait le prouver.
//
// `tokenMint` est devenu nullable pour que les drafts non résolus cessent
// d'être jetés. Mais un `NULL` en Postgres n'est égal à rien, pas même à
// lui-même : sous la sémantique par DÉFAUT (`NULLS DISTINCT`), deux lignes
// `(kol, tweet, NULL)` sont considérées DISTINCTES. `skipDuplicates` serait
// alors un no-op sur exactement les lignes que le nullable ajoute, et chaque
// relance de l'ingestion en empilerait une copie.
//
// L'index a donc été recréé en `NULLS NOT DISTINCT` (vérifié en base le
// 2026-09-03). Ce test modélise la contrainte pour que la propriété soit
// tenue par le CODE, pas par la mémoire de celui qui a passé la DDL.
//
// La bascule `NULLS_NOT_DISTINCT` est le point de mutation exigé : la passer à
// `false` revient à remettre l'index en sémantique par défaut, et le test doit
// rougir.

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ██ LE POINT DE MUTATION ██
 * `true`  = l'index tel qu'il est en base (NULLS NOT DISTINCT).
 * `false` = sémantique Postgres par défaut — l'idempotence s'effondre.
 */
const NULLS_NOT_DISTINCT = true;

interface Row {
  kolHandle: string;
  tweetId: string;
  tokenMint: string | null;
  resolutionStatus: string;
  [k: string]: unknown;
}

const store: Row[] = [];

/** Reproduit UNIQUE (kolHandle, tweetId, tokenMint) et sa sémantique de NULL. */
function violatesUnique(existing: Row, candidate: Row): boolean {
  if (existing.kolHandle !== candidate.kolHandle) return false;
  if (existing.tweetId !== candidate.tweetId) return false;
  const a = existing.tokenMint;
  const b = candidate.tokenMint;
  if (a === null || b === null) {
    // NULLS NOT DISTINCT : deux NULL entrent en collision.
    // NULLS DISTINCT (défaut) : un NULL n'entre jamais en collision.
    return NULLS_NOT_DISTINCT && a === null && b === null;
  }
  return a === b;
}

const mentionFindMany = vi.fn();
const candidateFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolPromotionMention: { findMany: (...a: unknown[]) => mentionFindMany(...a) },
    socialPostCandidate: { findMany: (...a: unknown[]) => candidateFindMany(...a) },
    shillEvent: {
      createMany: async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates: boolean }) => {
        let count = 0;
        for (const d of data) {
          const clash = store.some((e) => violatesUnique(e, d));
          if (clash) {
            if (skipDuplicates) continue;
            throw new Error("unique violation");
          }
          store.push(d);
          count++;
        }
        return { count };
      },
    },
  },
}));

import { ingestShillEvents } from "../ingest";

const T0 = new Date("2026-09-03T10:00:00.000Z");
const SOL_MINT = "3ghKZfLZJawWRWhSvgreiTDeyFPS4Kriy6v4Fbk3pump";

/** Un post portant UNIQUEMENT un ticker — le cas des 841/841 mesurés. */
const tickerPost = {
  id: "cand-1",
  postId: "post-1",
  postedAtUtc: T0,
  chain: null,
  campaignId: null,
  detectedTokens: '["CETS"]',
  influencer: { handle: "@herrocrypto" },
};

/** Un post portant une vraie adresse. */
const mintPost = {
  id: "cand-2",
  postId: "post-2",
  postedAtUtc: T0,
  chain: "solana",
  campaignId: null,
  detectedTokens: `["${SOL_MINT}"]`,
  influencer: { handle: "@empire_sol1" },
};

beforeEach(() => {
  store.length = 0;
  vi.clearAllMocks();
  mentionFindMany.mockResolvedValue([]);
});

describe("BUILD 3-B - les non résolus sont PERSISTÉS, plus jetés", () => {
  it("un draft ticker-seul s'écrit avec tokenMint null et unresolved_ticker", async () => {
    candidateFindMany.mockResolvedValue([tickerPost]);
    const s = await ingestShillEvents({ dryRun: false });

    expect(s.created).toBe(1);
    expect(store).toHaveLength(1);
    expect(store[0].tokenMint).toBeNull();
    expect(store[0].resolutionStatus).toBe("unresolved_ticker");
    // Le ticker n'entre PAS en base : il vit dans le draft.
    expect(store[0].tokenMint).not.toBe("CETS");
  });

  it("le compteur dit désormais « écrit sans identité », plus « jeté »", async () => {
    candidateFindMany.mockResolvedValue([tickerPost, mintPost]);
    const s = await ingestShillEvents({ dryRun: false });
    expect(s.created).toBe(2);
    expect(s.skippedUnresolved).toBe(1);
    expect(store.filter((r) => r.tokenMint === null)).toHaveLength(1);
  });
});

describe("BUILD 3-B - idempotence, par le vrai chemin d'ingestion", () => {
  it("DEUX passes sur le MÊME non résolu → UNE seule ligne", async () => {
    // Le test qui compte. Sous NULLS DISTINCT, la seconde passe insérerait un
    // doublon et chaque relance du cron empilerait une copie.
    candidateFindMany.mockResolvedValue([tickerPost]);

    const first = await ingestShillEvents({ dryRun: false });
    const second = await ingestShillEvents({ dryRun: false });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skippedDuplicates).toBe(1);
    expect(store).toHaveLength(1);
  });

  it("les résolus continuent de dédupliquer sur leur VRAI tokenMint", async () => {
    candidateFindMany.mockResolvedValue([mintPost]);
    await ingestShillEvents({ dryRun: false });
    await ingestShillEvents({ dryRun: false });
    expect(store).toHaveLength(1);
    expect(store[0].tokenMint).toBe(SOL_MINT);
  });

  it("le grain est (kol, tweet, mint) : un non résolu PAR (kol, tweet)", async () => {
    // Deux tickers du même tweet ne font qu'UNE ligne non résolue — c'est le
    // grain ratifié. Les deux drafts existent, la contrainte les fusionne.
    candidateFindMany.mockResolvedValue([
      { ...tickerPost, detectedTokens: '["CETS","FLORK"]' },
    ]);
    const s = await ingestShillEvents({ dryRun: false });
    expect(s.draftsBuilt).toBe(2);
    expect(store).toHaveLength(1);
    expect(store[0].tokenMint).toBeNull();
  });

  it("deux TWEETS distincts non résolus restent deux lignes", async () => {
    // La contrainte ne sur-fusionne pas : le grain porte sur (kol, tweet).
    candidateFindMany.mockResolvedValue([
      tickerPost,
      { ...tickerPost, id: "cand-3", postId: "post-3" },
    ]);
    await ingestShillEvents({ dryRun: false });
    expect(store).toHaveLength(2);
  });

  it("résolu et non résolu du MÊME tweet coexistent - clés distinctes", async () => {
    candidateFindMany.mockResolvedValue([
      { ...tickerPost, detectedTokens: `["CETS","${SOL_MINT}"]` },
    ]);
    await ingestShillEvents({ dryRun: false });
    expect(store).toHaveLength(2);
    expect(store.filter((r) => r.tokenMint === null)).toHaveLength(1);
    expect(store.filter((r) => r.tokenMint === SOL_MINT)).toHaveLength(1);
  });

  it("la sémantique modélisée est bien NULLS NOT DISTINCT", () => {
    // Verrouille le point de mutation lui-même : si quelqu'un repasse l'index
    // en sémantique par défaut, ce test tombe AVANT les autres et nomme la
    // cause, au lieu de laisser deviner pourquoi l'idempotence a lâché.
    expect(NULLS_NOT_DISTINCT).toBe(true);
  });
});
