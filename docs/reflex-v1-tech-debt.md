# REFLEX V1 — Tech debt ledger (γ-3 internal-only helper)

Created in Commit 7b. Lists every piece of duplication we accepted in
order to ship REFLEX V1 in shadow without touching the existing scan
routes, and the post-V1 plan to retire each item.

## Why we have this debt

We extracted `src/lib/scan/buildTigerInput/{solana,evm}.ts` so REFLEX
can build a `TigerInput` for SOL and EVM inputs without round-tripping
through the existing `/api/scan/*` endpoints. That extraction is **a
duplicate** of the composition logic already living inline in those
routes — see the file-level "TEMPORARY DUPLICATION" banners.

We chose γ-3 (internal-only helper) over γ-1 (staged refactor of the
real routes) because:

- REFLEX V1 must enter shadow this week, not in 2–3 days.
- The existing scan routes (especially `/api/v1/score`) are anti-
  regression critical. Modifying them in-flight while also shipping
  REFLEX raises blast-radius.
- Calibration during shadow can flag drift early via the coherence
  test, **before** we commit to the larger refactor.

## What's duplicated

| Helper (REFLEX path) | Mirror of (existing route) | Lines | Coherence test |
|---|---|---:|---|
| `src/lib/scan/buildTigerInput/solana.ts` | `src/app/api/scan/solana/route.ts` (lines 127–265) | ~60 | yes — 5 fixtures |
| `src/lib/scan/buildTigerInput/evm.ts` | `src/app/api/scan/evm/route.ts` (lines 58–117) | ~50 | yes — 5 fixtures |

## What's NOT covered in V1

TRON and Hyper do not produce a `TigerInput` — their routes use custom
scorers (`computeTronWalletScore` / inline Hyperliquid heuristics) that
are not part of the `TigerScore` engine.

For TRON / Hyper REFLEX inputs:

- The orchestrator still runs `knownBad`, `intelligenceOverlay`,
  `casefileMatch`, `coordination`, and `recidivism`.
- The `tigerscore` adapter is skipped (`ran=false`).
- Verdict is built from the DB-backed engines.

This is the "no-chain-skipped" promise: REFLEX accepts the input shape
and produces a verdict. It is **not** a promise of TigerScore parity
on every chain.

Post-V1 task: write `src/lib/scan/buildReflexSignals/{tron,hyper}.ts`
that wraps the existing custom scorers and emits `ReflexEngineOutput`
with `source: "tigerscore"`-shaped signals (USDT_BLACKLISTED →
CRITICAL stopTrigger, FROZEN → STRONG, etc.). Until that ships, the
verdict layer doesn't see those signals.

## Drift risks

The coherence test (`__tests__/reflex/buildTigerInput.coherence.test.ts`)
verifies that for 10 known fixtures (5 SOL + 5 EVM), the TigerScore
obtained via the helper matches the TigerScore the route would return
**given the same upstream data**. If the helper drifts away from the
route, the test fails and CI blocks the merge.

The test mocks the data sources (`rpcCall`, `getMarketSnapshot`,
`loadCaseByMint`, `detectActiveEvmChains`, `isKnownBadEvm`, `lookupValue`)
identically for both code paths. Any difference in composition between
helper and route surfaces as a score mismatch.

**Failure modes the coherence test catches:**

- Route adds a new signal to its `TigerInput` and forgets to update
  the helper.
- Route changes how it aggregates `maxBalanceEth` across chains.
- Route adds a new `evm_*` flag that REFLEX doesn't know about.

**Failure modes the coherence test does NOT catch:**

- Drift in the upstream data sources themselves (e.g. `getMarketSnapshot`
  starts returning a new field that the route uses inline but the
  helper ignores).
- Behavioural drift in `/api/scan/solana/graph` for scam-lineage — the
  V1 helper defaults `scam_lineage="NONE"`. If the graph route starts
  returning "CONFIRMED" for an address, the route's TigerScore moves
  but the helper's stays put. Post-V1 task: replace the HTTP roundtrip
  with a direct DB query so both paths share the data.
- TRON / Hyper drift — no coherence test exists for these because the
  helper doesn't exist either.

## Post-V1 factorisation plan

Three commits, in order, after REFLEX V1 leaves shadow mode:

### Phase 1 — Move composition into shared lib (no behaviour change)

- Move the composition from `/api/scan/solana/route.ts` (lines 127–265)
  into `src/lib/scan/buildSolanaScan.ts`. The route imports and calls
  it. Helper imports and calls it. Single source of truth.
- Same for `/api/scan/evm/route.ts` → `src/lib/scan/buildEvmScan.ts`.
- Coherence test gets stronger: it now verifies the helper IS the
  route's composition, not just byte-equivalent to it.

### Phase 2 — Retire the internal HTTP roundtrip for scam-lineage

- `/api/scan/solana/route.ts` calls `/api/scan/solana/graph` over
  HTTP today. Replace with a direct DB query (`prisma.kolCase` and
  friends) used by both route and helper.

### Phase 3 — TRON / Hyper enrichment

- Write `src/lib/scan/buildReflexSignals/tron.ts` and
  `.../hyper.ts`. They consume the existing scorers and emit
  `ReflexEngineOutput` for `runReflex`'s adapter array.
- Add the missing 5+5 coherence fixtures.

## Inventory of routes NOT covered by REFLEX V1

These routes also build `TigerInput` (or call `computeTigerScore*`)
and are NOT used by REFLEX V1, so the duplication doesn't extend to
them. They remain inline — REFLEX never invokes them.

- `/api/scan/eth/route.ts` (404 lines — superseded by `/api/scan/evm`
  with multi-chain detection; kept for legacy API consumers).
- `/api/scan/{base,arbitrum,bsc}/route.ts` (113–133 lines each — single-
  chain variants of `/api/scan/evm`).
- `/api/v1/score/route.ts` — anti-regression critical. Has its own
  TigerInput composition for both SOL and EVM. REFLEX does NOT call
  it — REFLEX uses `buildSolanaTigerInput` / `buildEvmTigerInput`
  helpers directly.
- `/api/mobile/v1/scan/route.ts` — mobile-public surface.
- `/api/partner/v1/{batch-score,score-lite,transaction-check}/route.ts`
  — partner API.
- `/api/report/v2/route.ts` — PDF report flow.

Each of these would benefit from Phase 1's shared lib too, but they
are out of scope for REFLEX V1. Tracked here for the V1.1+ planning.
