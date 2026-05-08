# MM_TRACKER MERGE PREP REPORT

**Date**: 2026-05-08
**Author**: CC sprint cleanup (Item 2)
**Status**: 🔴 NOT MERGEABLE — see blockers below

---

## State of the branches

| Branch | Status | Notes |
|---|---|---|
| `feat/mm-tracker-clean` | ✅ already merged into main (`git merge` reports "Already up to date") | Surface was extracted additively in `1880e41` (2026-04-21). Nothing left to do here. |
| `feat/mm-tracker` | 🔴 5 commits ahead, 4 conflicts with main | Diverged from main at `1ffa00e` (2026-04-16). Main has moved ~3 weeks. |

**Commits on `feat/mm-tracker` not in main:**
- `d918dcd` feat(mm): Phase 10 — Guard badge MM_FLAG, PDF forensic report, mobile endpoints
- `28d2518` feat(mm): Phase 9 — fake liquidity detector + cluster discovery + watcher hook + investigator dashboard
- `a396182` feat(mm): Phase 8 — OSINT wallet injection, data layer, live scan endpoints
- `e9e30f3` feat(mm-tracker): complete MM_TRACKER module v1 — phases 1-7
- `9f1abc4` docs: add MM_TRACKER spec v1.2.1 FINAL

**Net diff once merged**: +585 lines across 10 files (after main's 3-week catch-up; the inflated 70k delta vs. the merge-base is noise — those changes are already on main).

---

## Conflicts (4 files)

### 1. `prisma/schema.prod.prisma` — 🔴 BLOCKER
**5 conflict regions:**
- L2195–2636 (~440 lines)
- L2678–2687 (small)
- L2807–2819 (small)
- L2869–2993 (~125 lines)
- L3032–3571 (~540 lines, the big one)

**Resolution strategy**: schema.prod.prisma must stay strictly **additive** (CLAUDE.md rule). Both sides added new MM_TRACKER models — manual merge keeps every model from both sides, picks the latest column definitions when names collide. No fields can be dropped.

### 2. `src/app/api/mobile/v1/scan/route.ts` — 🟡 SMALL
2 conflict regions (L25–30, L140–144). Likely import block + handler signature drift. ~5 minutes.

### 3. `src/app/investigators/box/layout.tsx` — 🟡 MEDIUM
4 conflict regions (L4–8, L56–65, L85–107, L113–121). Layout file has had several updates on main (recent commit `0f514db` redirected `/investigators/box` → `/en/demo`). Main's version may already be the desired state — branch's layout edits may be obsolete.

### 4. `src/lib/mm/reporting/__tests__/templateMm.test.ts` — 🟢 ADD/ADD
Both sides added the same file with different content (1 conflict region L20–26). 190 lines total. Pick whichever matches the current `templateMm` API, or merge expectations.

---

## API keys required by branch code

| Key | In `.env.local`? | Production? | Status |
|---|---|---|---|
| `BIRDEYE_API_KEY` | placeholder only (2 chars, not a real key) | unknown | 🔴 needs real key from Dood |
| `ARKHAM_API_KEY` | ❌ absent | unknown | 🔴 needs key (or stub the integration) |

`src/lib/mm/data/birdeye.ts:43` throws `"BIRDEYE_API_KEY is not set"` when missing — calls will fail loudly, not silently.

---

## Actions required from Dood

1. **Legal D1/D2** — confirm MM_TRACKER scope is cleared for production (per CC briefing; CC cannot validate).
2. **Birdeye API key** — provision real key, add to Vercel Production env (NOT to local).
3. **Arkham API key** — same. Or decide to stub/remove the integration before merge.
4. **Schema review** — a human must eyeball the 5-region schema conflict; CC will not auto-resolve a 540-line block on a prod schema (additive rule).
5. **Decide layout precedence** — main's `investigators/box/layout.tsx` may already be the authoritative version (post `/en/demo` redirect work). Reviewer to confirm.

---

## Estimated merge time once unblocked

- Schema merge (manual, careful): **45–60 min**
- Code conflicts (3 files): **20–30 min**
- Re-run `pnpm tsc --noEmit` + `pnpm test`: **10 min**
- Smoke test MM_TRACKER endpoints in dev: **30 min**
- **Total**: ~2 hours of focused work, plus prod env key wiring before deploy.

---

## DO NOT MERGE until

- [ ] Legal D1/D2 sign-off
- [ ] Real `BIRDEYE_API_KEY` and `ARKHAM_API_KEY` provisioned in Vercel Production
- [ ] Human review of the schema.prod.prisma resolution
