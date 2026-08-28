// Tests des deux correctifs de correctness (prep 2026-08-28).
import { describe, it, expect } from "vitest";
import { buildOccasions, observationDedupKey, OCCASION_GAP_SECONDS } from "../occasions";
import { computeCandidateScores, SCORING } from "../scoring";

const ev = (id: string, kol: string, mint: string | null, iso: string) => ({
  id, kolHandle: kol, tokenMint: mint, tweetTimestamp: new Date(iso),
});

describe("CORRECTNESS #1 - occasions", () => {
  it("replie deux tweets du meme mint a 1 min d'intervalle en UNE occasion", () => {
    // Le cas reel : empire_sol1, mint 3ghKZfLZJawW, 18:57 et 18:58.
    const m = buildOccasions([
      ev("e1", "empire_sol1", "3ghKZfLZJawW", "2026-06-03T18:57:00Z"),
      ev("e2", "empire_sol1", "3ghKZfLZJawW", "2026-06-03T18:58:00Z"),
    ]);
    expect(m.eventsByOccasion.size).toBe(1);
    expect(m.occasionByEvent.get("e1")).toBe(m.occasionByEvent.get("e2"));
    expect(m.collapsed).toBe(1);
  });

  it("ne replie PAS deux tweets du meme mint au-dela de la fenetre", () => {
    const m = buildOccasions([
      ev("e1", "k", "M", "2026-06-03T18:00:00Z"),
      ev("e2", "k", "M", "2026-06-03T18:30:00Z"), // 1800s > 1500s
    ]);
    expect(m.eventsByOccasion.size).toBe(2);
    expect(m.collapsed).toBe(0);
  });

  it("ne replie JAMAIS deux mints differents, meme simultanes", () => {
    const m = buildOccasions([
      ev("e1", "k", "MINT_A", "2026-06-03T18:57:00Z"),
      ev("e2", "k", "MINT_B", "2026-06-03T18:57:00Z"),
    ]);
    expect(m.eventsByOccasion.size).toBe(2);
  });

  it("ne replie jamais deux KOL differents sur le meme mint", () => {
    const m = buildOccasions([
      ev("e1", "kol_a", "M", "2026-06-03T18:57:00Z"),
      ev("e2", "kol_b", "M", "2026-06-03T18:57:30Z"),
    ]);
    expect(m.eventsByOccasion.size).toBe(2);
  });

  it("chaine transitivement : 3 tweets espaces restent UNE occasion", () => {
    const m = buildOccasions([
      ev("e1", "k", "M", "2026-06-03T18:00:00Z"),
      ev("e2", "k", "M", "2026-06-03T18:20:00Z"), // +1200s du precedent
      ev("e3", "k", "M", "2026-06-03T18:40:00Z"), // +1200s du precedent
    ]);
    expect(m.eventsByOccasion.size).toBe(1);
    expect(m.collapsed).toBe(2);
  });

  it("un evenement sans mint reste isole - on ne fusionne pas a l'aveugle", () => {
    // Les 29 evenements `unresolved_ticker` de production tombent ici.
    const m = buildOccasions([
      ev("e1", "k", null, "2026-06-03T18:57:00Z"),
      ev("e2", "k", null, "2026-06-03T18:57:30Z"),
    ]);
    expect(m.eventsByOccasion.size).toBe(2);
  });

  it("la borne de recouvrement vaut pre + post", () => {
    expect(OCCASION_GAP_SECONDS).toBe(1500);
  });

  it("deduplique sur la signature de transaction quand elle existe", () => {
    const a = observationDedupKey({ wallet: "W", chain: "solana", firstBuyTxSignature: "SIG" });
    const b = observationDedupKey({ wallet: "W2", chain: "solana", firstBuyTxSignature: "SIG" });
    expect(a).toBe(b); // meme transaction = meme achat
  });

  it("retombe sur (wallet, chain) sans signature", () => {
    const a = observationDedupKey({ wallet: "W", chain: "solana", firstBuyTxSignature: null });
    const b = observationDedupKey({ wallet: "W", chain: "solana", firstBuyTxSignature: null });
    const c = observationDedupKey({ wallet: "X", chain: "solana", firstBuyTxSignature: null });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("CORRECTNESS #2 - plancher de n", () => {
  const base = { nearTweetCount: 0, postTweetCount: 0, exitCount: 0, distinctKolCount: 1 };

  it("un ratio de 1,00 sur UNE observation ne vaut pas recurrence", () => {
    // Le cas reel : deepnets_agent, obs=1 / ana=1 / ratio=1,00 -> 77,00 avant.
    const s = computeCandidateScores({
      ...base, observedShillCount: 1, analyzableShillCount: 1, preTweetCount: 1,
    });
    expect(s.ratioObserved).toBe(1); // le FAIT est conserve
    expect(s.correlationScore).toBeLessThan(77); // le CREDIT ne l'est pas
    expect(s.shortlistEligible).toBe(false);
    expect(s.classification).toBe("watch");
  });

  it("au plancher, le ratio recommence a compter", () => {
    const sous = computeCandidateScores({
      ...base, observedShillCount: SCORING.minObservationsForRatio - 1,
      analyzableShillCount: SCORING.minObservationsForRatio - 1, preTweetCount: 2,
    });
    const au = computeCandidateScores({
      ...base, observedShillCount: SCORING.minObservationsForRatio,
      analyzableShillCount: SCORING.minObservationsForRatio, preTweetCount: 3,
    });
    expect(au.correlationScore).toBeGreaterThan(sous.correlationScore);
  });

  it("le plancher ne touche pas les candidats au-dessus", () => {
    const s = computeCandidateScores({
      ...base, observedShillCount: 5, analyzableShillCount: 6, preTweetCount: 5,
    });
    expect(s.shortlistEligible).toBe(true);
    expect(s.correlationScore).toBeGreaterThan(70);
  });

  it("le plancher est une valeur nommee, a ratifier", () => {
    expect(SCORING.minObservationsForRatio).toBe(3);
  });
});
