# AUDIT REPORT — Module 7/7: Off-Chain Credibility Score
Date: 2026-04-23

## Status: ✅ PASS

## Checks
| Check | Result |
|-------|--------|
| `pnpm tsc --noEmit` | ✅ Exit 0 |
| `pnpm test` | ✅ 1141/1141 pass (1133 pre-existing + 8 new) |
| `pnpm build` | ✅ 240 pages, 0 errors |

## Files Created
- `src/lib/off-chain-credibility/engine.ts` — 8-signal credibility engine, in-memory cache TTL 24h
- `src/components/scan/OffChainCredibilityBlock.tsx` — signal display component (EN/FR)
- `src/app/api/v1/off-chain/route.ts` — POST endpoint, rate-limited
- `tests/lib/off-chain-credibility/engine.test.ts` — 8 tests

## Files Modified
- `src/app/en/demo/page.tsx` — off-chain fetch + render integrated
- `src/app/fr/demo/page.tsx` — off-chain fetch + render integrated

## Signals (max 100 pts)
| # | Signal | Max | Status Logic |
|---|--------|-----|--------------|
| 1 | Website completeness | 20 | SITE_TERMS keyword count |
| 2 | GitHub reality | 18 | Repo API: active/pushed/stars |
| 3 | Audit public | 16 | AUDIT_FIRMS static list (CertiK, Halborn, …) |
| 4 | Domain age | 14 | RDAP IANA registration date |
| 5 | Twitter/X age | 10 | Wayback Machine oldest snapshot |
| 6 | Whitepaper | 8 | URL HEAD request |
| 7 | Telegram | 8 | t.me page "members" heuristic |
| 8 | SSL | 6 | HTTPS + HSTS header |

## Bugs Fixed
1. `.catch(() => null)` called on already-awaited `number | null` (TypeError at runtime) — removed, type-annotated as `number | null`
2. `scoreGithub` returned `2` for absent/404 GitHub → `statusFromRatio(2,18)` returned AMBER instead of RED — changed to return `0`

## Tiger Modifier
| Score range | Modifier |
|-------------|----------|
| ≤ 20 | +8 |
| ≤ 40 | +4 |
| ≤ 60 | 0 |
| ≤ 80 | -3 |
| > 80 | -5 |

## Design Compliance
- Colors: `#FF3B5C` (RED), `#FFB800` (AMBER), `#34d399` (GREEN), `#6b7280` (NEUTRAL)
- No `#00E5FF` used
- Monospace font, 10-11px labels matching existing scan block style
