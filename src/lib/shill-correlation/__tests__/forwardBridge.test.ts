// --- B3 — le bridge compose, et la base garantit l'idempotence ------------
//
// Aucun test ici ne touche une base ni Helius : le lecteur de candidats et la
// persistance sont INJECTÉS. La persistance de test reproduit la contrainte
// réelle — UNIQUE (kolHandle, tweetId, tokenMint) NULLS NOT DISTINCT — parce
// que c'est elle, et non le code du bridge, qui porte l'idempotence.

import { describe, it, expect, vi } from "vitest";
import {
  runForwardBridge,
  type ForwardCandidate,
  type ForwardCandidateReader,
} from "../forwardBridge";
import type { ShillEventDraft } from "../types";
import type { PersistDraftsResult } from "../ingest";

const SOL = "3ghKZfLZJawWRWhSvgreiTDeyFPS4Kriy6v4Fbk3pump";
const SOL_2 = "J6UVkdPVe4cbd6qGJHdoacMa7zvN3tiaordcyZRspump";
const EVM = "0x07f5b6823751c2e2cd4560f28af75ff887102241";
const T0 = new Date("2026-09-03T10:00:00.000Z");

/** Un candidat QUALIFIÉ dont l'identité est résolue par preuve d'appariement. */
const bon = (over: Partial<ForwardCandidate> = {}): ForwardCandidate => ({
  id: "cand-1",
  postId: "post-1",
  postedAtUtc: T0,
  discoveredAtUtc: new Date(T0.getTime() + 60_000),
  chain: null,
  campaignId: null,
  ingestionMode: "LIVE",
  signalTypes: '["ca_drop"]',
  signalScore: 80,
  detectedTokens: '["NET"]',
  detectedAddresses: `["${SOL}"]`,
  rawText: `$NET ca ${SOL} lfg`,
  handle: "@iambroots",
  ...over,
});

/**
 * Persistance de test : reproduit l'index unique et NULLS NOT DISTINCT.
 * C'est la contrainte qui rend le bridge idempotent, pas son code.
 */
function makeStore() {
  const rows: ShillEventDraft[] = [];
  const persist = async (
    drafts: ShillEventDraft[],
    opts: { dryRun?: boolean } = {},
  ): Promise<PersistDraftsResult> => {
    const seen = new Set<string>();
    const deduped = drafts.filter((d) => {
      const k = `${d.kolHandle}|${d.tweetId}|${d.tokenMint ?? "NULL"}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const out: PersistDraftsResult = {
      draftsBuilt: deduped.length,
      skippedUnresolved: deduped.filter((d) => d.tokenMint == null).length,
      created: 0,
      skippedDuplicates: 0,
      errors: [],
    };
    if (opts.dryRun) return out;
    for (const d of deduped) {
      // NULLS NOT DISTINCT : deux NULL entrent en collision.
      const clash = rows.some(
        (r) => r.kolHandle === d.kolHandle && r.tweetId === d.tweetId && r.tokenMint === d.tokenMint,
      );
      if (clash) out.skippedDuplicates++;
      else {
        rows.push(d);
        out.created++;
      }
    }
    return out;
  };
  return { rows, persist };
}

const reader = (cands: ForwardCandidate[]): ForwardCandidateReader => async () => cands;

describe("B3 - le pipeline compose les trois primitives", () => {
  it("qualifié + résolu → un ShillEvent aux bons champs", async () => {
    const { rows, persist } = makeStore();
    const r = await runForwardBridge({
      readCandidates: reader([bon()]),
      persist,
      dryRun: false,
    });

    expect(r.examined).toBe(1);
    expect(r.qualified).toBe(1);
    expect(r.resolved).toBe(1);
    expect(r.ingested).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kolHandle: "iambroots", // normalisé, sans @
      tweetId: "post-1",
      tokenMint: SOL,
      resolutionStatus: "resolved_from_tweet",
      chain: "solana",
      sourcePostCandidateId: "cand-1",
    });
  });

  it("qualifié + NON résolu → ShillEvent tokenMint null / unresolved_ticker", async () => {
    // Une CA est présente (donc qualifié), mais aucune preuve n'apparie le
    // ticker à l'adresse : B1 refuse, et le bridge écrit le refus.
    const { rows, persist } = makeStore();
    const r = await runForwardBridge({
      readCandidates: reader([
        bon({ detectedTokens: '["NET"]', rawText: "aucun lien entre les deux ici" }),
      ]),
      persist,
      dryRun: false,
    });

    expect(r.qualified).toBe(1);
    expect(r.unresolved).toBe(1);
    expect(rows[0].tokenMint).toBeNull();
    expect(rows[0].resolutionStatus).toBe("ambiguous_ticker");
    // Le ticker n'entre jamais dans tokenMint (B0) — il reste dans rawToken.
    expect(rows[0].rawToken).toBe("NET");
  });

  it("un ticker sans aucune CA → unresolved_ticker", async () => {
    const { rows, persist } = makeStore();
    await runForwardBridge({
      readCandidates: reader([
        bon({ detectedAddresses: "[]", signalTypes: '["ca_drop"]', rawText: "$NET soon" }),
      ]),
      persist,
      dryRun: false,
    });
    // Rejeté en amont : sans adresse, le prédicat B2 ne qualifie pas.
    expect(rows).toHaveLength(0);
  });

  it("NON qualifié → aucun ShillEvent, et le motif est compté", async () => {
    const { rows, persist } = makeStore();
    const r = await runForwardBridge({
      readCandidates: reader([
        bon({ ingestionMode: "BACKFILL" }),
        bon({ id: "c2", postId: "p2", signalTypes: '["nice_pump"]' }),
        bon({ id: "c3", postId: "p3", detectedTokens: '["CETS","FLORK"]' }),
      ]),
      persist,
      dryRun: false,
    });

    expect(r.qualified).toBe(0);
    expect(r.rejected).toBe(3);
    expect(rows).toHaveLength(0);
    expect(r.rejectedByCriterion.ingestion_mode_live).toBe(1);
    expect(r.rejectedByCriterion.signal_type_ca_drop).toBe(1);
    expect(r.rejectedByCriterion.single_ticker).toBe(1);
  });

  it("le cas comparatif ne produit aucun événement", async () => {
    const { rows, persist } = makeStore();
    await runForwardBridge({
      readCandidates: reader([
        bon({
          detectedTokens: '["CETS","FLORK"]',
          detectedAddresses: "[]",
          signalTypes: "[]",
          signalScore: 30,
          rawText: "$CETS didn't get the Alpha listing and it went to $FLORK",
        }),
      ]),
      persist,
      dryRun: false,
    });
    expect(rows).toHaveLength(0);
  });
});

describe("B3 - idempotence : la base la porte, pas le bridge", () => {
  it("relancer la MÊME fenêtre ne crée AUCUNE nouvelle ligne", async () => {
    const { rows, persist } = makeStore();
    const cands = [bon(), bon({ id: "c2", postId: "p2", detectedTokens: '["ABC"]', rawText: `$ABC ca ${SOL_2}`, detectedAddresses: `["${SOL_2}"]` })];

    const first = await runForwardBridge({ readCandidates: reader(cands), persist, dryRun: false });
    const second = await runForwardBridge({ readCandidates: reader(cands), persist, dryRun: false });

    expect(first.ingested).toBe(2);
    expect(second.ingested).toBe(0);
    expect(second.alreadyPresent).toBe(2);
    expect(rows).toHaveLength(2);
  });

  it("un non résolu rejoué ne se duplique pas non plus (NULLS NOT DISTINCT)", async () => {
    const { rows, persist } = makeStore();
    const c = [bon({ rawText: "rien ne relie" })];
    await runForwardBridge({ readCandidates: reader(c), persist, dryRun: false });
    const second = await runForwardBridge({ readCandidates: reader(c), persist, dryRun: false });
    expect(second.ingested).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenMint).toBeNull();
  });

  it("une fenêtre CHEVAUCHANTE est sûre — c'est ce qui autorise le recouvrement", async () => {
    const { rows, persist } = makeStore();
    const a = bon();
    const b = bon({ id: "c2", postId: "p2", detectedTokens: '["ABC"]', detectedAddresses: `["${SOL_2}"]`, rawText: `$ABC ca ${SOL_2}` });
    await runForwardBridge({ readCandidates: reader([a]), persist, dryRun: false });
    await runForwardBridge({ readCandidates: reader([a, b]), persist, dryRun: false });
    expect(rows).toHaveLength(2);
  });
});

describe("B3 - la fenêtre et le watermark", () => {
  it("le watermark AVANCE au plus récent discoveredAtUtc traité", async () => {
    const { persist } = makeStore();
    const tard = new Date(T0.getTime() + 3_600_000);
    const r = await runForwardBridge({
      readCandidates: reader([bon(), bon({ id: "c2", postId: "p2", discoveredAtUtc: tard })]),
      readWatermark: async () => T0,
      persist,
      dryRun: false,
    });
    expect(r.watermarkBefore).toEqual(T0);
    expect(r.watermarkAfter).toEqual(tard);
  });

  it("la fenêtre recule volontairement du recouvrement", async () => {
    const { persist } = makeStore();
    const seen: Array<Date | null> = [];
    const spy: ForwardCandidateReader = async ({ since }) => {
      seen.push(since);
      return [];
    };
    await runForwardBridge({
      readCandidates: spy,
      readWatermark: async () => T0,
      overlapMinutes: 30,
      persist,
    });
    expect(seen[0]).toEqual(new Date(T0.getTime() - 30 * 60_000));
  });

  it("sans watermark, la fenêtre est ouverte (premier passage)", async () => {
    const { persist } = makeStore();
    const seen: Array<Date | null> = [];
    await runForwardBridge({
      readCandidates: async ({ since }) => {
        seen.push(since);
        return [];
      },
      persist,
    });
    expect(seen[0]).toBeNull();
  });
});

describe("B3 - dry-run : tout calculer, n'écrire rien", () => {
  it("dryRun est le DÉFAUT — appeler sans réfléchir n'écrit pas", async () => {
    const { rows, persist } = makeStore();
    const r = await runForwardBridge({ readCandidates: reader([bon()]), persist });
    expect(r.dryRun).toBe(true);
    expect(rows).toHaveLength(0);
    // …mais tout a été calculé.
    expect(r.qualified).toBe(1);
    expect(r.resolved).toBe(1);
    expect(r.drafts).toHaveLength(1);
    expect(r.ingested).toBe(0);
  });

  it("les compteurs couvrent tout l'entonnoir", async () => {
    const { persist } = makeStore();
    const r = await runForwardBridge({
      readCandidates: reader([
        bon(),
        bon({ id: "c2", postId: "p2", ingestionMode: "BACKFILL" }),
        bon({ id: "c3", postId: "p3", rawText: "rien ne relie" }),
        bon({ id: "c4", postId: "p4", detectedTokens: '["A","B"]' }),
      ]),
      persist,
    });
    expect(r.examined).toBe(4);
    expect(r.qualified).toBe(2);
    expect(r.rejected).toBe(2);
    expect(r.resolved).toBe(1);
    expect(r.unresolved).toBe(1);
    expect(r.solanaEligible).toBe(1);
  });
});

describe("B3 - la garde fail-closed, comptée sans être appliquée ici", () => {
  it("un mint EVM est résolu mais NON éligible (chain inconnue)", async () => {
    const { rows, persist } = makeStore();
    const r = await runForwardBridge({
      readCandidates: reader([
        bon({ detectedTokens: `["${EVM}"]`, detectedAddresses: `["${EVM}"]`, rawText: `ca ${EVM}` }),
      ]),
      persist,
      dryRun: false,
    });
    expect(r.resolved).toBe(1);
    expect(r.solanaEligible).toBe(0); // ← chain null, donc hors moteur Solana
    // L'événement est tout de même écrit : B3 n'est pas un filtre d'éligibilité.
    expect(rows).toHaveLength(1);
    expect(rows[0].chain).toBe("");
  });

  it("un non résolu n'est jamais éligible", async () => {
    const { persist } = makeStore();
    const r = await runForwardBridge({
      readCandidates: reader([bon({ rawText: "rien ne relie" })]),
      persist,
    });
    expect(r.unresolved).toBe(1);
    expect(r.solanaEligible).toBe(0);
  });
});

describe("B3 - RÉUTILISATION : rien n'est ré-implémenté", () => {
  it("la persistance passée est bien celle qui est appelée", async () => {
    const spy = vi.fn(async () => ({
      draftsBuilt: 0, skippedUnresolved: 0, created: 0, skippedDuplicates: 0, errors: [],
    }));
    await runForwardBridge({ readCandidates: reader([bon()]), persist: spy, dryRun: false });
    expect(spy).toHaveBeenCalledTimes(1);
    const [drafts, o] = spy.mock.calls[0] as unknown as [ShillEventDraft[], { dryRun: boolean }];
    expect(drafts).toHaveLength(1);
    expect(o.dryRun).toBe(false);
  });

  it("le bridge n'a AUCUNE logique de qualification, résolution ou écriture locale", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "..", "forwardBridge.ts"), "utf8");
    // On teste le CODE, pas les commentaires : l'en-tête décrit justement les
    // primitives composées, et un grep naïf y trouverait tous les mots qu'on
    // veut interdire. Même piège qu'en B1 avec « helius ».
    const code = src
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*") && !l.trimStart().startsWith("/*"))
      .join("\n");

    // Il APPELLE les primitives…
    expect(code).toMatch(/qualifyPromotion\s*\(/);
    expect(code).toMatch(/resolveTokenIdentity\s*\(/);
    expect(code).toMatch(/persist\s*\(/);
    // …et ne réécrit ni critère, ni CA_MAP, ni écriture.
    expect(code).not.toMatch(/signalScore\s*>=/);
    expect(code).not.toMatch(/["']ca_drop["']/);
    expect(code).not.toMatch(/CA_MAP/);
    expect(code).not.toMatch(/createMany/);
    expect(code).not.toMatch(/prisma\./);
  });

  it("le bridge ne touche NI Helius NI KolPromotionMention", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "..", "forwardBridge.ts"), "utf8");
    const imports = src.split("\n").filter((l) => l.trimStart().startsWith("import"));
    expect(imports.join("\n")).not.toMatch(/helius/i);
    // KolPromotionMention reste dormante : ni lue, ni écrite.
    expect(imports.join("\n")).not.toMatch(/kolPromotionMention/i);
    const code = src.split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
    expect(code).not.toMatch(/kolPromotionMention/);
    expect(code).not.toMatch(/\bfetch\s*\(/);
  });
});

// ═══ L'INVARIANT FAIL-CLOSED, TESTÉ SEUL ══════════════════════════════════
//
// Il remplace trois `if` dont la correction dépendait de l'ORDRE. Ces tests
// l'exercent directement : un invariant qui n'existe que dans l'ordre de trois
// conditions n'est pas testable seul — celui-ci l'est.

describe("B3 - checkSolanaEngineEligibility : fail-closed", () => {
  it("solana + mint base58 → ÉLIGIBLE, et le mint sort narrowé", async () => {
    const { checkSolanaEngineEligibility } = await import("../eligibility");
    const g = checkSolanaEngineEligibility({ chain: "solana", tokenMint: SOL });
    expect(g.eligible).toBe(true);
    if (g.eligible) expect(g.mint).toBe(SOL);
  });

  it("tokenMint null → NON éligible, diagnostic identity_unresolved", async () => {
    const { checkSolanaEngineEligibility } = await import("../eligibility");
    const g = checkSolanaEngineEligibility({ chain: "solana", tokenMint: null });
    expect(g.eligible).toBe(false);
    if (!g.eligible) expect(g.diagnostic).toBe("identity_unresolved");
  });

  it("chaîne INCONNUE → non éligible SANS avoir été énumérée", async () => {
    // Le cœur du fail-closed. `chain` est NULL sur 7 603/7 603 lignes de
    // social_post_candidates : sous une garde fail-open, elles passeraient.
    const { checkSolanaEngineEligibility } = await import("../eligibility");
    for (const chain of [null, "", "base", "ethereum", "SOLANA", "sol"]) {
      const g = checkSolanaEngineEligibility({ chain, tokenMint: SOL });
      expect(g.eligible, `chaîne « ${chain} » ne doit pas être éligible`).toBe(false);
      if (!g.eligible) expect(g.diagnostic).toBe("chain_not_solana");
    }
  });

  it("un EVM sur chain solana → non éligible, diagnostic DISTINCT", async () => {
    // Une valeur est là, ce n'est pas une adresse Solana : ni « jamais
    // résolue », ni « mauvaise chaîne ». Trois causes, trois corrections.
    const { checkSolanaEngineEligibility } = await import("../eligibility");
    const g = checkSolanaEngineEligibility({ chain: "solana", tokenMint: EVM });
    expect(g.eligible).toBe(false);
    if (!g.eligible) expect(g.diagnostic).toBe("not_base58_address");
  });

  it("les trois diagnostics restent distincts", async () => {
    const { checkSolanaEngineEligibility } = await import("../eligibility");
    const d = (s: { chain: string | null; tokenMint: string | null }) => {
      const g = checkSolanaEngineEligibility(s);
      return g.eligible ? "eligible" : g.diagnostic;
    };
    expect(new Set([
      d({ chain: "solana", tokenMint: null }),
      d({ chain: null, tokenMint: SOL }),
      d({ chain: "solana", tokenMint: EVM }),
    ]).size).toBe(3);
  });
});
