# PRISMA UPGRADE ASSESSMENT — 5.22 → 7.x

**Date**: 2026-05-08
**Author**: CC sprint cleanup (Item 7)
**Recommendation**: 🟡 **Phased upgrade** (5→6 first, then 6→7). Do NOT jump 5→7 directly.

---

## Current state

| | Version |
|---|---|
| `prisma` (CLI) | 5.22.0 |
| `@prisma/client` | 5.22.0 |
| `@prisma/adapter-better-sqlite3` | 7.4.2 (✱ already on v7 — see note below) |
| Node | active (Next 16 → ≥ 18.18) |

**✱ Note**: an adapter package on 7.4.2 is already in `package.json` while core is on 5.22. This is either dead weight (the adapter isn't compatible with the current 5.22 client) or a partially-prepared v7 setup. To resolve before upgrade.

### Schema scale
- `prisma/schema.prod.prisma`: **3360 lines, 136 models, 55 `Json` fields**
- Native types in use: `@db.Decimal`, `@db.Text`, `@db.Timestamp`, `@db.Timestamptz`, `@db.VarChar`
- Preview features: `driverAdapters`
- Provider: `postgresql` (Neon, pgbouncer port 6543)
- Directory: `prisma/migrations/` — **all migrations are manual** (named `manual_*`); no `prisma migrate dev` history

### Code footprint
- 68 files import from `@prisma/client`
- 345 files reference `prisma.*` directly
- **0** uses of `prisma.$queryRaw`, `prisma.$executeRaw`, `prisma.$transaction`, `prisma.$connect`, `prisma.$disconnect` in `src/` ✅ (no raw-SQL surface to migrate)

---

## Prisma 6 — risks (5 → 6)

| Area | Risk | Notes |
|---|---|---|
| Node version | 🟢 LOW | Need Node ≥ 18.18 (Next 16 already enforces this). |
| `driverAdapters` | 🟢 LOW | GA in v6, no syntax changes; just remove from `previewFeatures`. |
| Full-text search | 🟢 LOW | Not used in repo. |
| Buffer / Uint8Array | 🟡 MEDIUM | `Bytes` → `Uint8Array` if any field uses it. **Need audit** — but no `Bytes` columns visible in `@db.*` scan above, low concern. |
| Decimal.js | 🟢 LOW | Now an explicit peer dep; install is automatic. |
| BigInt JSON | 🟢 LOW | No JSON serialization of BigInt observed. |
| Prisma adapter v7 deps | 🔴 HIGH | The pre-installed `@prisma/adapter-better-sqlite3@7.4.2` will likely **break** on a v6 core. Resolve to v6-compatible (≥6.x) or remove if unused. |

**Estimated effort 5 → 6**: ~3–5 hours including a green CI run + smoke tests. Mostly mechanical.

---

## Prisma 7 — risks (6 → 7)

This is the **big** jump. Risks:

| Area | Risk | Notes |
|---|---|---|
| **New `prisma-client` generator** | 🔴 HIGH | The legacy `prisma-client-js` generator is replaced. Schema header changes. New output structure. |
| **Driver adapter required** | 🔴 HIGH | v7 ships **no built-in engine** — every connection must go through a driver adapter. For Postgres+Neon this means `@prisma/adapter-neon` or `@prisma/adapter-pg`. Every `new PrismaClient()` site needs to supply an adapter. |
| **Connection layer rewrite** | 🔴 HIGH | `src/lib/prisma.ts` (singleton) and any `new PrismaClient()` callsite (~5–10 across the repo per typical layout) need new constructor args. The pgbouncer URL on port 6543 may need adjustment for the adapter (Neon's HTTP/serverless adapter has different connection semantics from pooled pg). |
| **ESM-only client** | 🟡 MEDIUM | Project is already on Next 16/ES modules — likely fine, but tests using CJS interop may need adjustment. |
| **API removals** | 🟡 MEDIUM | Several deprecated APIs gone (`rejectOnNotFound`, etc.). Need a full search-and-replace pass. With 345 prisma.* usages, manual review required. |
| **`Buffer` → `Uint8Array`** | 🟢 LOW | Already noted under v6. |
| **Schema migrations** | 🟡 MEDIUM | Repo uses `manual_*` migrations only (Neon SQL Editor flow per `MEMORY.md`). Need to confirm v7's migration tooling does not regress this workflow — additive rule on `schema.prod.prisma` must hold. |

**Estimated effort 6 → 7**: ~2–3 days of focused work. Includes:
- Rewriting connection setup to use driver adapter (+ connection pooling rethink for Neon pgbouncer)
- Schema generator block update
- Auditing all 345 prisma.* call sites for removed APIs
- Full smoke test of investigators flow, watcher v2, MM_TRACKER (once merged), wallet-scan engine
- Vercel deploy parity verification

---

## Recommended path

1. **Phase 1 — Pre-flight (1 hour)**
   - Resolve `@prisma/adapter-better-sqlite3` mismatch: confirm if it's used anywhere; if not, remove. If yes, peg to a 5.x-compatible version.
   - Snapshot current `prisma migrate status` output.
   - Confirm Neon connection pool behavior on prod (ep-square-band, port 6543).

2. **Phase 2 — Upgrade 5.22 → 6.x (half day)**
   - Bump `prisma` and `@prisma/client` together.
   - Remove `driverAdapters` from `previewFeatures`.
   - Run `pnpm tsc --noEmit` and `pnpm test`.
   - Deploy to Vercel preview. Smoke test investigators auth, watcher v2 (once X token is wired), wallet-scan.
   - **Ship to prod, observe for 48h.**

3. **Phase 3 — Upgrade 6 → 7 (separate sprint, 2–3 days)**
   - Adopt `@prisma/adapter-neon` (HTTP) or `@prisma/adapter-pg` for the singleton in `src/lib/prisma.ts`.
   - Switch generator block to `prisma-client`.
   - Audit removed APIs across all 345 callsites.
   - Full E2E test on Vercel preview before prod.

**DO NOT** bump 5 → 7 in a single PR. The driver adapter rewrite alone is large enough to merit its own dedicated sprint.

---

## Out of scope for this assessment
- Reading the full Prisma 6 and 7 changelogs end-to-end (humans should do this on prisma.io/docs/upgrade-guides).
- Inventorying every `Bytes` column or BigInt JSON serialization point (need a code-level pass during Phase 2 PR).
- Benchmarking driver adapter latency vs. current pgbouncer setup on Neon (Phase 3 task).
