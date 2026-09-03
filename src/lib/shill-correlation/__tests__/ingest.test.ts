import { describe, it, expect } from "vitest";
import {
  canonicalizeChain,
  classifyTokenIdentity,
  dedupeDrafts,
  inferChain,
  normalizeHandle,
  parseDetectedTokens,
  postCandidateToDrafts,
  promotionMentionToDraft,
} from "../ingest";
import type { ShillEventDraft } from "../types";

const T0 = new Date("2026-01-01T10:00:00Z");
const SOL_MINT = "So11111111111111111111111111111111111111112";
const EVM_MINT = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

describe("normalizeHandle", () => {
  it("strips @, trims, lowercases", () => {
    expect(normalizeHandle("  @BkOkOski ")).toBe("bkokoski");
    expect(normalizeHandle("@@planted")).toBe("planted");
  });
  it("returns empty string for nullish/blank", () => {
    expect(normalizeHandle(null)).toBe("");
    expect(normalizeHandle(undefined)).toBe("");
    expect(normalizeHandle("   ")).toBe("");
  });
});

describe("inferChain", () => {
  it("treats 0x-prefixed mints as ethereum, others as solana", () => {
    expect(inferChain(EVM_MINT)).toBe("ethereum");
    expect(inferChain(SOL_MINT)).toBe("solana");
  });
});

describe("canonicalizeChain", () => {
  it("folds aliases onto one identifier", () => {
    expect(canonicalizeChain("sol")).toBe("solana");
    expect(canonicalizeChain("SOLANA")).toBe("solana");
    expect(canonicalizeChain(" eth ")).toBe("ethereum");
    expect(canonicalizeChain("evm")).toBe("ethereum");
    expect(canonicalizeChain("matic")).toBe("polygon");
  });
  it("passes unknown values through lowercased, empty stays empty", () => {
    expect(canonicalizeChain("arbitrum")).toBe("arbitrum");
    expect(canonicalizeChain(null)).toBe("");
    expect(canonicalizeChain("  ")).toBe("");
  });
});

describe("parseDetectedTokens", () => {
  it("parses a JSON string array of bare mints", () => {
    expect(parseDetectedTokens(`["${SOL_MINT}", "${EVM_MINT}"]`)).toEqual([
      SOL_MINT,
      EVM_MINT,
    ]);
  });
  it("accepts an already-parsed array (jsonb coercion path)", () => {
    expect(parseDetectedTokens([SOL_MINT])).toEqual([SOL_MINT]);
  });
  it("extracts mint/address from object entries and trims", () => {
    expect(
      parseDetectedTokens([{ mint: ` ${SOL_MINT} ` }, { address: EVM_MINT }]),
    ).toEqual([SOL_MINT, EVM_MINT]);
  });
  it("returns [] for null, blank, non-array, or malformed JSON", () => {
    expect(parseDetectedTokens(null)).toEqual([]);
    expect(parseDetectedTokens("")).toEqual([]);
    expect(parseDetectedTokens("[]")).toEqual([]);
    expect(parseDetectedTokens("{not json")).toEqual([]);
    expect(parseDetectedTokens(`{"a":1}`)).toEqual([]);
  });
  it("drops empty entries", () => {
    expect(parseDetectedTokens(`["${SOL_MINT}", "", "  "]`)).toEqual([SOL_MINT]);
  });
});

describe("promotionMentionToDraft", () => {
  const base = {
    kolHandle: "@Planted",
    sourcePostId: "tweet-1",
    postedAt: T0,
    tokenMint: SOL_MINT,
    chain: "solana",
  };

  it("maps a clean mention 1:1 with normalized handle", () => {
    expect(promotionMentionToDraft(base)).toEqual<ShillEventDraft>({
      kolHandle: "planted",
      tweetId: "tweet-1",
      tweetTimestamp: T0,
      tokenMint: SOL_MINT,
      rawToken: SOL_MINT,
      resolutionStatus: "resolved_direct",
      chain: "solana",
      sourcePostCandidateId: null,
      campaignId: null,
    });
  });

  it("canonicalizes the source chain alias", () => {
    expect(promotionMentionToDraft({ ...base, chain: "sol" })?.chain).toBe(
      "solana",
    );
  });

  it("infers chain when the source chain is blank", () => {
    expect(promotionMentionToDraft({ ...base, chain: "" })?.chain).toBe(
      "solana",
    );
    expect(
      promotionMentionToDraft({ ...base, chain: "", tokenMint: EVM_MINT })
        ?.chain,
    ).toBe("ethereum");
  });

  it("returns null when a required field is missing", () => {
    expect(promotionMentionToDraft({ ...base, kolHandle: "" })).toBeNull();
    expect(promotionMentionToDraft({ ...base, sourcePostId: "  " })).toBeNull();
    expect(promotionMentionToDraft({ ...base, tokenMint: "" })).toBeNull();
  });
});

describe("postCandidateToDrafts", () => {
  const base = {
    id: "cand-1",
    postId: "post-1",
    postedAtUtc: T0,
    chain: "solana",
    campaignId: "camp-1",
    detectedTokens: `["${SOL_MINT}", "${EVM_MINT}"]`,
  };

  it("produces one draft per distinct mint, carrying source + campaign refs", () => {
    const drafts = postCandidateToDrafts(base, "@GordonGekko");
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toEqual<ShillEventDraft>({
      kolHandle: "gordongekko",
      tweetId: "post-1",
      tweetTimestamp: T0,
      tokenMint: SOL_MINT,
      rawToken: SOL_MINT,
      resolutionStatus: "resolved_direct",
      chain: "solana",
      sourcePostCandidateId: "cand-1",
      campaignId: "camp-1",
    });
    // EVM mint keeps the candidate's declared chain, not the inferred one.
    expect(drafts[1].tokenMint).toBe(EVM_MINT);
    expect(drafts[1].chain).toBe("solana");
  });

  it("infers per-mint chain when the candidate chain is null", () => {
    const drafts = postCandidateToDrafts(
      { ...base, chain: null, detectedTokens: `["${EVM_MINT}", "${SOL_MINT}"]` },
      "kol",
    );
    expect(drafts.map((d) => d.chain)).toEqual(["ethereum", "solana"]);
  });

  it("dedupes repeated mints within one candidate", () => {
    const drafts = postCandidateToDrafts(
      { ...base, detectedTokens: `["${SOL_MINT}", "${SOL_MINT}"]` },
      "kol",
    );
    expect(drafts).toHaveLength(1);
  });

  it("returns [] when handle, postId, timestamp, or tokens are missing", () => {
    expect(postCandidateToDrafts(base, null)).toEqual([]);
    expect(postCandidateToDrafts({ ...base, postId: "" }, "kol")).toEqual([]);
    expect(postCandidateToDrafts({ ...base, postedAtUtc: null }, "kol")).toEqual(
      [],
    );
    expect(
      postCandidateToDrafts({ ...base, detectedTokens: "[]" }, "kol"),
    ).toEqual([]);
  });
});

describe("dedupeDrafts", () => {
  const mk = (
    kolHandle: string,
    tweetId: string,
    tokenMint: string,
  ): ShillEventDraft => ({
    kolHandle,
    tweetId,
    tokenMint,
    rawToken: tokenMint,
    resolutionStatus: "resolved_direct",
    tweetTimestamp: T0,
    chain: "solana",
    sourcePostCandidateId: null,
    campaignId: null,
  });

  it("collapses collisions on (kolHandle, tweetId, tokenMint), keeping first", () => {
    const a = mk("kol", "t1", SOL_MINT);
    const dupOfA = { ...mk("kol", "t1", SOL_MINT), chain: "ethereum" };
    const b = mk("kol", "t1", EVM_MINT);
    const out = dedupeDrafts([a, dupOfA, b]);
    expect(out).toHaveLength(2);
    expect(out[0].chain).toBe("solana"); // first wins
    expect(out[1].tokenMint).toBe(EVM_MINT);
  });

  it("does not collapse across different handles or tweets", () => {
    const out = dedupeDrafts([
      mk("kolA", "t1", SOL_MINT),
      mk("kolB", "t1", SOL_MINT),
      mk("kolA", "t2", SOL_MINT),
    ]);
    expect(out).toHaveLength(3);
  });
});

// ═══ B0 — UN TICKER N'EST JAMAIS UNE IDENTITÉ DE CONTRAT ═══════════════════
//
// Le défaut fermé ici, mesuré le 2026-09-03 : `ingestShillEvents` écrivait le
// contenu de `detectedTokens` dans `tokenMint` et ne posait JAMAIS
// `resolutionStatus`. Le défaut base `@default("resolved_direct")` s'appliquait
// donc à des lignes portant un ticker — une affirmation fausse posée par
// OMISSION, que rien dans le code ne signalait à la relecture.
//
// Ces tests passent par le VRAI chemin de création (postCandidateToDrafts, la
// frontière réelle de `ingestShillEvents`), jamais par un module isolé.

describe("B0 - aucun chemin de création ne fabrique un mint depuis un ticker", () => {
  const tickerOnly = {
    id: "cand-ticker",
    postId: "post-ticker",
    postedAtUtc: T0,
    chain: null,
    campaignId: null,
    // Le cas réel : 841 entrées sur 841 (30 j) sont de cette forme.
    detectedTokens: '["CETS", "FLORK"]',
  };

  it("un candidat ticker-seul ne produit JAMAIS resolved_direct", () => {
    const drafts = postCandidateToDrafts(tickerOnly, "@herrocrypto");
    expect(drafts).toHaveLength(2);
    for (const d of drafts) {
      expect(d.resolutionStatus).not.toBe("resolved_direct");
      expect(d.resolutionStatus).toBe("unresolved_ticker");
    }
  });

  it("un ticker n'est JAMAIS écrit dans tokenMint", () => {
    const drafts = postCandidateToDrafts(tickerOnly, "@herrocrypto");
    for (const d of drafts) {
      expect(d.tokenMint).toBeNull();
      expect(d.tokenMint).not.toBe("CETS");
      expect(d.tokenMint).not.toBe("FLORK");
    }
    // Le ticker reste lisible, mais sous un nom qui ne ment pas.
    expect(drafts.map((d) => d.rawToken)).toEqual(["CETS", "FLORK"]);
  });

  it("resolutionStatus est TOUJOURS posé - jamais laissé au défaut base", () => {
    // La garde de fond : le type l'impose, ce test le constate sur les deux
    // frontières de création réelles.
    const fromCandidate = postCandidateToDrafts(tickerOnly, "@k");
    const fromMention = promotionMentionToDraft({
      kolHandle: "k", sourcePostId: "t", postedAt: T0, tokenMint: "CETS", chain: "solana",
    });
    for (const d of [...fromCandidate, fromMention!]) {
      expect(d.resolutionStatus).toBeDefined();
      expect(d.resolutionStatus).not.toBe("resolved_direct");
    }
  });

  it("une VRAIE adresse reste resolved_direct - la garde ne sur-refuse pas", () => {
    const withMint = { ...tickerOnly, detectedTokens: `["${SOL_MINT}"]` };
    const [d] = postCandidateToDrafts(withMint, "@k");
    expect(d.resolutionStatus).toBe("resolved_direct");
    expect(d.tokenMint).toBe(SOL_MINT);
  });

  it("une adresse EVM est une identité, pas un ticker", () => {
    // `resolveTokenMint` est Solana-only ; jeter un 0x valide serait la faute
    // symétrique de celle qu'on ferme.
    const evm = { ...tickerOnly, detectedTokens: `["${EVM_MINT}"]` };
    const [d] = postCandidateToDrafts(evm, "@k");
    expect(d.resolutionStatus).toBe("resolved_direct");
    expect(d.tokenMint).toBe(EVM_MINT);
  });

  it("classifyTokenIdentity tranche : adresse = identité, symbole = non", () => {
    expect(classifyTokenIdentity(SOL_MINT).status).toBe("resolved_direct");
    expect(classifyTokenIdentity(EVM_MINT).status).toBe("resolved_direct");
    expect(classifyTokenIdentity("CETS").status).toBe("unresolved_ticker");
    expect(classifyTokenIdentity("CETS").mint).toBeNull();
    // Ni un 0x trop court ni un symbole long ne passent pour une adresse.
    expect(classifyTokenIdentity("0xdead").status).toBe("unresolved_ticker");
  });

  it("deux tickers du même tweet ne fusionnent pas sous une clé « null »", () => {
    // La clé de dédup portait sur tokenMint ; avec deux mints null, les deux
    // drafts auraient collapsé en un seul et un ticker aurait disparu.
    const drafts = postCandidateToDrafts(tickerOnly, "@k");
    expect(dedupeDrafts(drafts)).toHaveLength(2);
  });
});
