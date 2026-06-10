import { describe, it, expect } from "vitest";
import {
  fetchTokenWindowTransactions,
  fetchMintTransactionsInRange,
} from "../helius";
import type { HeliusTx } from "@/lib/mm/data/helius";

const MINT = "So11111111111111111111111111111111111111112";
const TWEET = 1_700_000_000; // window: [TWEET-600, TWEET+900]

function tx(sig: string, ts: number): HeliusTx {
  return {
    signature: sig,
    slot: 0,
    timestamp: ts,
    type: "SWAP",
    source: "RAYDIUM",
    fee: 0,
    feePayer: "x",
  };
}

/** Build a paged, newest-first fake of fetchSolanaTransactions over `all`. */
function pager(all: HeliusTx[]) {
  let calls = 0;
  const fn = async (
    _mint: string,
    options: { limit?: number; before?: string } = {},
  ): Promise<HeliusTx[]> => {
    calls++;
    const limit = options.limit ?? 100;
    let start = 0;
    if (options.before) {
      const idx = all.findIndex((t) => t.signature === options.before);
      start = idx >= 0 ? idx + 1 : all.length;
    }
    return all.slice(start, start + limit);
  };
  return Object.assign(fn, { get calls() { return calls; } });
}

describe("fetchTokenWindowTransactions", () => {
  it("collects only in-window txs and stops once it crosses the window start", async () => {
    // newest-first: some after window, some in, some before
    const all: HeliusTx[] = [
      tx("a", TWEET + 2000), // after end -> discarded
      tx("b", TWEET + 800), // in
      tx("c", TWEET + 30), // in
      tx("d", TWEET - 100), // in
      tx("e", TWEET - 700), // before start -> triggers stop
      tx("f", TWEET - 5000), // never fetched
    ];
    const fetchTxs = pager(all);
    const res = await fetchTokenWindowTransactions(MINT, TWEET, {
      maxPages: 10,
      fetchTxs: fetchTxs as never,
    });
    expect(res.windowCovered).toBe(true);
    expect(res.txs.map((t) => t.signature)).toEqual(["b", "c", "d"]);
  });

  it("reports windowCovered=false when the page budget is hit first", async () => {
    // 250 txs all newer than the window end => never reach the window
    const all = Array.from({ length: 250 }, (_, i) =>
      tx(`n${i}`, TWEET + 100_000 - i),
    );
    const fetchTxs = pager(all);
    const res = await fetchTokenWindowTransactions(MINT, TWEET, {
      maxPages: 2,
      fetchTxs: fetchTxs as never,
    });
    expect(res.pagesFetched).toBe(2);
    expect(res.windowCovered).toBe(false);
    expect(res.txs).toHaveLength(0);
  });

  it("fetchMintTransactionsInRange collects an explicit super-window range", async () => {
    // super-window spanning two events' windows
    const all: HeliusTx[] = [
      tx("a", TWEET + 5000), // after range end
      tx("b", TWEET + 1200), // in range
      tx("c", TWEET - 200), // in range
      tx("d", TWEET - 4000), // before range start -> stop
    ];
    const fetchTxs = pager(all);
    const res = await fetchMintTransactionsInRange(
      MINT,
      TWEET - 3600,
      TWEET + 3600,
      { maxPages: 10, fetchTxs: fetchTxs as never },
    );
    expect(res.windowCovered).toBe(true);
    expect(res.txs.map((t) => t.signature)).toEqual(["b", "c"]);
  });

  it("treats exhausted history as covered", async () => {
    const fetchTxs = pager([tx("a", TWEET + 800)]);
    const res = await fetchTokenWindowTransactions(MINT, TWEET, {
      maxPages: 10,
      fetchTxs: fetchTxs as never,
    });
    expect(res.windowCovered).toBe(true);
    expect(res.txs.map((t) => t.signature)).toEqual(["a"]);
  });
});
