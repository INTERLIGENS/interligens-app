# Shill Correlation Engine — Technical Notes

Operational notes for the Shill Correlation Engine (`src/lib/shill-correlation/`)
and PRE-BUY GUARD. Additive log of findings so we don't re-discover them.

---

## 2026-06-25 — ShillEvent ticker→mint resolution (S1) + Helius backfill blind-spot (S2)

### Context
Audit of the "ticker instead of mint" data debt flagged as the most critical
issue. Many `ShillEvent.tokenMint` held a cashtag (`$SYMBOL`) instead of a
base58 Solana mint, because `SocialPostCandidate.detectedTokens` stores
cashtags. Unresolved tickers are short-circuited before Helius
(`process.ts` `looksLikeSolanaMint` guard, `backfill.ts` `eligibleForHelius`),
so they produce **zero** `ShillBuyerObservation` and **zero** correlation value.

Starting state (221 ShillEvents, 100% solana): 158 base58 mints,
**63 unresolved tickers (28.5%)**, only **11 events with buyer observations**.

### S1 — Ticker resolution from stored tweet text — ✅ DONE (applied to prod DB)
Re-ran `resolveWithTweetText` (resolve.ts) over the 63 unresolved tickers,
fed from the **stored** `social_post_candidates.rawText` (NOT live X API).

- **34 resolved** (`unresolved_ticker` → `resolved_from_tweet`); each had a
  single base58 CA explicitly labelled `CA:`/`Ca:` in the tweet text.
- 0 ambiguous (no tweet had >1 distinct CA), 0 key collisions, raw cashtag
  preserved in `tokenTicker`.
- 25 had no CA in the tweet (need external symbol→mint resolution), 4 are
  synthetic `DIONE_PENDING_OSINT` placeholders.
- **Ticker debt: 28.5% → 13%** (63 → 29 unresolved).

> ⚠️ Do NOT use `runPhase2Followup` (backfill.ts) for backlog ticker
> resolution: its resolution path reads tweet text via **live X API** on a
> `enrichMaxAgeDays` (7d) window. All ShillEvents are ≥18d old, so it would
> fetch 0 tweets and resolve 0. The stored `rawText` path resolves any age,
> for free (no API). S1 used that.

### S2 — Buyer backfill for the old backlog — ⛔ DEFERRED (wrong tool, proven)

**Blind-spot #1 — Helius Enhanced Transactions API has NO timestamp seek.**
It only cursors by `before` signature, newest-first
(`helius.ts` `fetchMintTransactionsInRange`). To reach an old tweet's window we
page back from *now*, discarding everything newer. Credit cost grows with
`token_age × activity`. The engine deliberately gates buyer-fetch to a recent
window (`recentWindowHours`, default 72h) for this reason.

**Empirical proof (bounded probe, 2026-06-25, hard cap 400 Helius calls):**
3 of the *newest* pending fetchable mints (~22-23 days old, all pump.fun),
window ±10/15 min, 133 pages each (399 calls total):

| mint | age | pages | windowCovered | observations |
|------|-----|-------|---------------|--------------|
| `Fyc2…pump` | 22.5d | 133 | ❌ false | 0 |
| `FeMr…pump` ($DOGEUS) | 22.8d | 133 | ❌ false | 0 |
| `3aSW…pump` ($GRIMACE) | 23.1d | 133 | ❌ false | 0 |

- **133 pages (13,300 tx) did not reach a 22-23d-old window.** Real rate
  ~6.6–9.5 pages/day (these tokens still do ~665–950 tx/day weeks post-launch).
  `$DOGEUS` reached only 06-11 for a 06-02 tweet — **9 days short**.
- **399 Helius calls → 0 observations.** No parasitic writes (uncovered
  windows → nothing persisted; DB state unchanged: 88 buyers_fetched, 2169
  observations, 11 analyzable events).
- **Extrapolation:** full backlog ≈ 23 non-date_only mints (17 are >30d →
  300–600+ pages each). Brute-force ≈ **5,000–15,000 Helius calls**, many
  windows still uncovered. Cost/value is catastrophic.

**Verdict: backfilling the old backlog via Helius pagination is infeasible.**

### Future solution (when we attack the backlog — NOT during Indo OSINT)
The right primitive is a **time-range / timestamp-seek source** (the thing
Helius lacks: filter trades by `blockTime` / date range directly, no
pagination waste). **Test the FREE options FIRST — do not default to paying.**

**Test order:**
1. **Bitquery** (https://bitquery.io) — GraphQL Solana API indexing DEXTrades
   (Raydium / Pump.fun / Jupiter) with **native temporal seek** (filter by
   `Block.Time` + date range). This is exactly the missing primitive. Free tier,
   no credit card, datasets not paywalled. **← TEST FIRST** on the backlog:
   if the free tier covers our 34 (now-resolved) mints, the backfill is FREE.
2. **Vybe API** — Solana trade-history endpoint with `timeEnd` unix + sort by
   `blockTime`. Second free seek-temporal option if Bitquery falls short.
3. **Nansen** (free, browser, Token God Mode) — for **manual on-chain OSINT
   enrichment** of casefiles (no code, no API). Not a programmatic backfill, but
   useful to eyeball a specific token's early buyers by hand.
4. **Birdeye historical trades** — PAID, **last resort only** if the free
   options above don't cover our needs. ("No Birdeye purchase during Indo.")

> ⚠️ Free-tier **rate limits must be verified empirically** before committing to
> one: our targets are pump.fun tokens with ~665-950 tx/day weeks post-launch
> (see probe above), so a tight free-tier query/row cap could throttle a full
> 34-mint backfill. Measure the cap against one active mint first.
>
> Last-resort alt if all seek sources fail: a local parsed-tx indexer (Postgres).

### The engine is healthy going forward
Buyer-fetch runs **at ingestion**, while events are still within the recent
window (<72h). New shill events get observations automatically — the debt does
NOT accumulate forward. **Only the old backlog is blocked**, and it must wait
for a timestamp-seek source. Do not brute-force it with Helius.

### Residual ticker debt (29 unresolved)
- 25 `unresolved_ticker` with no CA in tweet → need external symbol→mint
  (DexScreener/Birdeye search, with confidence + ambiguity handling).
- 4 `DIONE_PENDING_OSINT` synthetic placeholders → manual OSINT.
