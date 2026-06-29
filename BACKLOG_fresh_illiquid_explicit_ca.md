# BACKLOG (PRIORITY) — fresh illiquid explicit-CA tokens

**Status:** OPEN — deliberate exclusion from the first write batch, NOT dropped.
**Owner:** Evidence Intake Bridge. Introduced: Sprint 4.5 (threshold hardening).

## What is excluded and why
The Sprint-4.5 liquidity floor (`minLiquidityUsd`, e.g. $25k) is applied to the
resolved token of every would-be draft. A token whose liquidity is **unknown**
falls below the floor and is skipped with `action = "below_liquidity"`,
`reason = "fresh_illiquid_explicit_ca"`.

"Liquidity unknown" happens for exactly one resolver path: **explicit CA in the
post, confirmed on-chain via Helius RPC, with NO DexScreener pair yet** — i.e. a
**freshly launched pump.fun token** that isn't indexed/liquid.

So the first write batch (clean, multi-KOL, liquid) intentionally drops these.

## Why they MATTER (do not lose them)
These are precisely the **launch-stage rugs the anti-scam product must catch
EARLY** — a KOL dropping an explicit CA for a brand-new, illiquid token is the
highest-signal, highest-risk case. Excluding them from the *liquid* batch is a
quality decision for that batch, NOT a judgment that they're unimportant. They
are the opposite: a **separate priority flow**.

## How they stay visible (not silently lost)
`PromoteSummary.freshIlliquidExplicitCa` counts them on **every run** (dry or
live). They also surface as `below_liquidity` results with
`reason = "fresh_illiquid_explicit_ca"`, carrying `kolHandle`, `symbol`,
`canonicalMint`, `resolutionMethod = "explicit_ca"`, `liquidityUsd = null`.

## TODO — dedicated flow (future sprint)
1. A separate promote path for `explicit_ca + liquidity null` that DOES draft
   them (they have an on-chain-confirmed CA + KOL intent), flagged
   `evidenceLevel`/risk as "pre-liquidity / launch-stage".
2. Optional: re-check liquidity after N hours (token may gain a pair) before
   promoting, or promote immediately with a "launch-stage" badge for fast review.
3. Tighter caps + manual review (highest risk, lowest market validation).

Until then: they are queued conceptually via the per-run count, reviewable by
listing `below_liquidity` results with the fresh reason.
