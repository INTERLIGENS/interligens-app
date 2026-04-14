# INTERLIGENS — Routes & Surfaces Inventory

Date: 2026-04-13
Branch: `main`
Scope: pre-beta security audit — every addressable route, surface, and gatekeeper.

**Legend**
- **Cat**: `pub` (public) · `loc` (localized public) · `inv` (investigator, session-gated) · `adm` (admin, basic-auth-gated) · `mob` (mobile, token-gated) · `cron` (Vercel cron, secret-gated) · `vault` (admin sub-domain)
- **Protection attendue / observée**: MW=middleware, BASIC=HTTP Basic auth, COOKIE=session cookie, TOKEN=bearer/header token, RL=rate limit, OWN=ownership check, NONE=none observed
- **Status**: ✅ OK · ⚠ gap · ❌ critical gap

---

## 1. MIDDLEWARE + GLOBAL GATES (`src/middleware.ts`)

| Target | Enforcement | Observed | Status |
|---|---|---|---|
| `/admin/*`, `/api/admin/*` | Basic auth in prod only | `checkBasicAuth(ADMIN_BASIC_USER/PASS)`; `basicAuthFail` on miss | ✅ |
| `/en/investigator/*` (not `/login`), `/api/investigator/*` (not `/auth`) | Session cookie `investigator_session` presence | Redirects to `/access` (page) or 401 JSON (API) | ⚠ UX gate only — DB validation deferred to per-route |
| All public pages (`/`, `/en/*`, `/fr/*`, `/((?!_next\|favicon\|access\|api\|admin\|health).*)`) | Beta gating: `investigator_session` cookie presence | Fail-closed redirect to `/access` | ✅ |
| `/access`, `/api/*`, `/_next/*`, `/favicon`, `/health` | Exempt | Exempt via `isBetaExempt()` | ✅ |

**Gaps identified at middleware level:**
- No security headers set by middleware; headers come only from `next.config.ts` `headers()` block.
- `/fr/investigator/*` not covered by the investigator branch (only `/en/investigator` is checked). Does not exist in the routes inventory, so effectively moot — but the implicit English-only assumption is worth noting.
- No `X-Robots-Tag` injection for private paths.

---

## 2. PUBLIC PAGES (non-localized)

| URL | File | Cat | Protection attendue | Observée | Status |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | pub | beta gate → /access | MW beta gate | ✅ |
| `/home`, `/scan`, `/guard`, `/guard/install`, `/history` | respective `page.tsx` | pub | beta gate | MW beta gate | ✅ |
| `/investigators`, `/investigators/apply` | respective `page.tsx` | pub | none (public landing) | MW beta gate catches | ⚠ Landing covered by gate may block prospects. Verify intent. |
| `/access`, `/access/nda` | respective `page.tsx` | pub | unauthenticated entry | exempt | ✅ |
| `/shared/case/[token]` | `src/app/shared/case/[token]/page.tsx` | pub | token-scoped | token in URL | ⚠ See SEC-012 |

## 3. LOCALIZED PUBLIC PAGES (`/en/*`, `/fr/*`, `/[locale]/*`)

46 pages covering: `demo`, `demo/why`, `charter`, `correction`, `dataroom/score`, `explorer`, `explorer/[caseId]`, `investors`, `kol`, `kol/[handle]`, `kol/[handle]/class-action`, `legal/{disclaimer,privacy,terms,mentions-legales}`, `methodology`, `transparency`, `victim`, `victim/report`, `watchlist`, `watchlist/signals/[id]`, `scan`, `scan/[address]/timeline`. EN and FR mirrors exist for most.

- **Protection attendue**: beta gate for all → `/access`.
- **Observed**: all covered by middleware matcher `/((?!...).*)` with `investigator_session` cookie check.
- **Status**: ✅ OK.

## 4. PRIVATE / GATED PAGES

### Admin (`/admin/*`)

| URL | File | Protection attendue | Observée | Status |
|---|---|---|---|---|
| `/admin`, `/admin/login`, `/admin/alerts`, `/admin/ask-logs`, `/admin/ask-qa`, `/admin/cases`, `/admin/corroboration`, `/admin/export`, `/admin/intake`, `/admin/intake/new`, `/admin/intake/[id]`, `/admin/intel-vault/*`, `/admin/intelligence`, `/admin/kol`, `/admin/kol/network`, `/admin/labels`, `/admin/watch-sources` | respective `page.tsx` | Basic auth (prod) | MW `checkBasicAuth` in prod | ✅ |
| `/[locale]/admin/graph` | `src/app/[locale]/admin/graph/page.tsx` | Basic auth | ⚠ path prefix is `/en/admin/graph` or `/fr/admin/graph` — **not matched by `/admin/:path*`** | ❌ SEC-003 |

### Investigator Vault (`/investigators/box/*`)

| URL | File | Protection | Status |
|---|---|---|---|
| `/investigators/box`, `/investigators/box/cases/[caseId]`, `/investigators/box/cases/[caseId]/print`, `/investigators/box/onboarding`, `/investigators/box/redact`, `/investigators/box/trust` | respective `page.tsx` | Beta gate (cookie presence) via global matcher, then per-page client auth via `<VaultGate>` | ⚠ MW only checks cookie presence; DB validation lives in page/component code. Acceptable if pages are CSR-only. |

## 5. API ROUTES — PUBLIC (no auth, possibly rate-limited)

~60 routes. Grouped by coverage.

### 5.1 Scan / Chain

| Path | Method | Rate limited? | Notes |
|---|---|---|---|
| `/api/scan/eth`, `/api/scan/bsc`, `/api/scan/arbitrum`, `/api/scan/base`, `/api/scan/tron`, `/api/scan/solana`, `/api/scan/evm`, `/api/scan/hyper` | GET | ✅ `RATE_LIMIT_PRESETS.scan` (20/min) | OK |
| `/api/scan/cluster`, `/api/scan/corroboration`, `/api/scan/explain`, `/api/scan/grounding`, `/api/scan/intelligence`, `/api/scan/label`, `/api/scan/resolve` | GET/POST | ✅ mostly `scan` preset | OK |
| `/api/scan/timeline/[address]`, `/api/scan/timeline/auto` | GET | mixed | verify |
| `/api/scan/solana/graph`, `/api/scan/solana/graph/jobs`, `/api/scan/solana/graph/jobs/[id]` | GET/POST | ⚠ not confirmed | verify |
| **`/api/scan/ask`** | POST | ❌ **in-memory Map** (`rateLimitMap`) — resets every lambda cold start | SEC-004 |
| `/api/resolve/hyper-token` | GET | verify | |

### 5.2 KOL / Cluster

| Path | Method | Auth | Rate | Status |
|---|---|---|---|---|
| `/api/kol`, `/api/kol/leaderboard` | GET | public | verify | ⚠ |
| `/api/kol/[handle]`, `/api/kol/[handle]/proceeds`, `/api/kol/[handle]/wallet-history`, `/api/kol/[handle]/cashout`, `/api/kol/[handle]/class-action` | GET | public | verify | ⚠ |
| **`/api/kol/[handle]/pdf-legal`** | GET/POST | public | ⚠ not confirmed | ⚠ SEC-009 (PDF, expensive, public) |
| `/api/cluster/[handle]`, `/api/coordination/[handle]`, `/api/laundry/[handle]`, `/api/laundry/analyze` | GET/POST | public | verify | ⚠ |

### 5.3 Market / OSINT / Evidence / Token

| Path | Notes |
|---|---|
| `/api/market/*` (5 routes), `/api/osint/insights`, `/api/osint/signals`, `/api/osint/watchlist`, `/api/token/intel`, `/api/token/[chain]/[address]/kol-alert`, `/api/evidence/snapshots`, `/api/social/discord`, `/api/social/heat`, `/api/solana/holders` | All public, minimal risk but **should verify per-route RL** |

### 5.4 Community / Transparency / Watch

| Path | Method | Notes |
|---|---|---|
| `/api/community/submit` | POST | verify: RL + input validation |
| `/api/transparency/submit` | POST | verify: RL + size limit |
| `/api/transparency/wallets` | GET | read-only |
| **`/api/watch`** | GET/POST | ⚠ **no observable auth** on POST — any caller can create watched addresses; `ownerAccessId` may be forgeable → SEC-010 |
| `/api/watch/[id]` | DELETE | verify ownership |
| `/api/watchlist`, `/api/watchlist/signals`, `/api/watchlist/signals/[id]` | GET | read-only |
| `/api/wallet/scan` | GET | verify |

### 5.5 V1 Public API

| Path | Method | Rate | Auth |
|---|---|---|---|
| `/api/v1/scan` | POST | ✅ `scan` preset | public |
| `/api/v1/score` | GET, OPTIONS | ✅ custom 60/min | public + **CORS `*`** |
| `/api/v1/kol`, `/api/v1/kol/[handle]` | GET | verify | public |

### 5.6 Mock / Health / Misc

| Path | Notes |
|---|---|
| `/api/health` | GET, exempt, returns JSON status |
| `/api/mock/scan` | GET, demo fixture |
| `/api/explorer` | GET, public |
| `/api/labels` | GET, public taxonomy |
| `/api/casefile` | GET, public — calls KOL database |
| `/api/intelligence/match` | POST, ✅ `scan` preset |

## 6. API ROUTES — PDF / REPORT GENERATION

| Path | Auth | RL | Expensive? | Status |
|---|---|---|---|---|
| `/api/pdf/casefile` | `checkAuth` (lib/security/auth) | ✅ `pdf` preset | Puppeteer | ⚠ SEC-007 verify checkAuth |
| `/api/pdf/kol` | verify | verify | Puppeteer | ⚠ |
| **`/api/report/casefile`** | ❌ **`?mock=1` bypasses auth** + no RL despite import | ❌ SEC-001 P0 | Puppeteer | ❌ |
| `/api/report/pdf` | verify | ✅ line 298 | Puppeteer | ⚠ verify RL is BEFORE Puppeteer |
| `/api/report/v2` | verify | verify | — | ⚠ |

## 7. API ROUTES — MOBILE

| Path | Auth | RL | Status |
|---|---|---|---|
| `/api/mobile/v1/scan` | `X-Mobile-Api-Token` via direct `!==` compare | ✅ `checkRateLimit(scan)` | ⚠ SEC-006 timing |
| **`/api/mobile/v1/ask`** | `X-Mobile-Api-Token` via direct `!==` compare | ❌ **in-memory Map** | ⚠ SEC-004 + SEC-006 |

## 8. API ROUTES — INVESTIGATOR (session-gated)

~40 routes under `/api/investigators/*` and `/api/investigator/*`. Common pattern (verified on sample):

- **Session validation**: `getVaultWorkspace(req)` → returns `null`/`401` on miss.
- **Ownership**: `assertCaseOwnership(workspaceId, caseId)` → `403`/`404` on miss.
- **File ownership**: `assertFileOwnership(workspaceId, caseId, fileId)`.
- **Audit**: `logAudit({...})` on sensitive actions.

Verified routes (sample):
- `/api/investigators/cases/[caseId]` ✅
- `/api/investigators/cases/[caseId]/files/[fileId]/url` ✅ — ownership + audit + `r2Key` never in response + 900 s presigned URL
- `/api/investigators/cases/[caseId]/assistant` ✅ — ownership + token quota + audit
- `/api/investigators/cases/[caseId]/ai-summary` ✅
- `/api/investigators/cases/[caseId]/notes/[noteId]` ✅
- `/api/investigators/cases/[caseId]/hypotheses/[hypothesisId]` ✅

**Not verified (need spot-check):**
- `/api/investigators/cases/[caseId]/files/[fileId]/presign` — upload path
- `/api/investigators/cases/[caseId]/share`, `/shares`, `/share/[shareId]`
- `/api/investigators/cases/[caseId]/publish-candidate`
- `/api/investigators/entities/collisions`, `/api/investigators/entities/search`
- `/api/investigators/directory` — public-by-design (verified; `contactEmail` only surfaces on `PUBLIC` visibility)
- `/api/investigator/alerts`, `/cases`, `/kols`, `/metrics`, `/pdfs`, `/pdfs/download`, `/proceeds` (legacy singular)

## 9. API ROUTES — ADMIN (`/api/admin/*`)

~80+ routes. Two auth patterns:

- **Preferred**: `requireAdminApi(req)` in `adminAuth.ts` — timing-safe, covers header + httpOnly cookie.
- **Legacy**: several routes still use direct Bearer or Basic Auth comparison. Inventoried in agent report; full audit pending (see SEC-005).

Middleware applies Basic Auth globally to `/api/admin/*`, so all admin routes are gated AT MINIMUM by basic auth in prod. Per-route `ADMIN_TOKEN` adds defense-in-depth.

## 10. API ROUTES — CRON (`/api/cron/*`)

All 10 crons verified authenticated with `CRON_SECRET` (direct-compare or `verifyCronSecret` with `timingSafeEqual`):

| Path | Auth | `maxDuration` | vercel.json schedule |
|---|---|---|---|
| `/api/cron/onchain/sync` | `verifyCronSecret` | ❌ not set | `0 0 * * *` |
| `/api/cron/social/discover` | `verifyCronSecret` | ❌ not set | `0 6 * * *` |
| `/api/cron/social/capture` | `verifyCronSecret` | ❌ not set | `0 7 * * *` |
| `/api/cron/signals/run` | `verifyCronSecret` | ❌ not set | `0 8 * * *` |
| `/api/cron/alerts/deliver` | `verifyCronSecret` | ❌ not set | `0 9 * * *` |
| `/api/cron/watcher-v2` | `CRON_SECRET` inline, fail-closed | ✅ 300 s | `0 6 */3 * *` |
| `/api/cron/daily-flow` | Bearer `CRON_SECRET` | ❌ not set | `0 2 * * *` |
| `/api/cron/watch-rescan` | `CRON_SECRET` | ✅ 300 s | `0 8 * * *` |
| `/api/cron/intake-watch` | Bearer `CRON_SECRET` | ❌ not set | not scheduled (orphan?) |
| `/api/cron/corroboration` | Bearer `CRON_SECRET` | ❌ not set | not scheduled (orphan?) |

**Earlier agent report claimed 4 crons unauthenticated. REFUTED — all 10 have secret checks.** Agent likely matched only on the first 5 lines of each file and missed the deeper `verifyCronSecret` guard.

## 11. NEXT.CONFIG / VERCEL.JSON HEADERS

- `next.config.ts` calls `buildSecurityHeaders({ isProd })` on `/(.*)`: CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options, HSTS (prod only).
- `buildApiHeaders()` adds `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` on `/api/report/(.*)` and `/api/pdf/(.*)`.
- **Missing**: `X-Robots-Tag` on `/admin/(.*)`, `/investigators/(.*)`, `/api/admin/(.*)`, `/api/investigators/(.*)`, `/api/investigator/(.*)`, `/access/(.*)`.
- **Missing**: `Cache-Control: no-store` on authenticated JSON responses outside `/api/report` and `/api/pdf`.

## 12. ROBOTS / SITEMAP

- `public/robots.txt` → **absent**
- `src/app/robots.ts` → **absent**
- `src/app/sitemap.ts` → **absent**

**Consequence:** crawlers fall through to default (crawl everything they find). Combined with the missing `X-Robots-Tag` on admin/investigator paths, private surfaces **could** be indexed if ever linked.

## 13. R2 / STORAGE SURFACES

- `src/lib/storage/pdfStorage.ts` — signed URLs, TTL capped at 3600 s via `PDF_SIGNED_URL_TTL_SECONDS`, non-guessable keys (env + date + hash8).
- `src/lib/vault/r2-vault.ts` — `generatePresignedGetUrl(r2Key)`, 900 s TTL.
- `/api/investigators/cases/[caseId]/files/[fileId]/url` — ownership enforced, audit logged, `r2Key` never returned.
- **R2 bucket**: `interligens-reports` (lifecycle 30 d on `reports/`). Public-read disposition **not verified in this audit** — must be confirmed in Cloudflare dashboard.

---

## 14. CRITICAL GAPS SUMMARY (P0/P1 flagged at inventory stage)

| ID | Surface | Gap | Severity |
|---|---|---|---|
| SEC-001 | `/api/report/casefile` | `?mock=1` query bypasses auth, no RL | **P0** |
| SEC-002 | `.env.localANTHROPIC_API_KEY=sk-ant-api03-…` | Anthropic API key in filename on disk | **P0** |
| SEC-003 | `/[locale]/admin/graph` | Admin sub-page not matched by `/admin/:path*` middleware; beta gate applies but no Basic Auth | **P0** |
| SEC-004 | `/api/scan/ask`, `/api/mobile/v1/ask` | In-memory rate limiter resets on every Vercel lambda cold start → effectively no RL on Anthropic-backed endpoints | **P0** (cost) |
| SEC-005 | Admin routes (~6) | Direct Bearer/Basic compare instead of `requireAdminApi` | P1 |
| SEC-006 | `/api/admin/auth/login`, `/api/mobile/v1/{ask,scan}` | Direct `!==` token compare (not timing-safe) | P1 |
| SEC-007 | `NEXT_PUBLIC_ADMIN_TOKEN` in `admin/intake/page.tsx` | Client-component reads NEXT_PUBLIC var intended to carry admin secret. Var is currently unset so no leak — but the pattern is a P1 booby trap. | P1 |
| SEC-008 | Missing `robots.txt` / `robots.ts` / `sitemap.ts` | Crawlers unconstrained | P1 |
| SEC-009 | Missing `X-Robots-Tag: noindex` on `/admin/*`, `/investigators/*`, `/api/admin/*`, `/api/investigator*` | Indexing possible if linked | P1 |
| SEC-010 | Missing `export const maxDuration` on 8 of 10 cron routes | Runaway cost risk | P1 |
| SEC-011 | `/api/watch` POST public without `ownerAccessId` verification | Anyone can create watched addresses | P1 |
| SEC-012 | `/api/kol/[handle]/pdf-legal` public + Puppeteer | Expensive endpoint possibly without RL | P1 |
| SEC-013 | `/api/investigators/cases/[caseId]/assistant` line 99-132 | NODE_ENV !== "production" debug log that dumps encryption key names | P2 |
| SEC-014 | CSP `'unsafe-inline'` + `'unsafe-eval'` in script-src | Documented TODO; P2 | P2 |
| SEC-015 | CORS `Access-Control-Allow-Origin: *` on `/api/v1/score` | Intentional public API — document explicitly | P3 |
| SEC-016 | Vault presigned URLs TTL 15 min, no IP binding | Sharable window | P3 |

Full finding details in `AUDIT/SECURITY_FINDINGS.md`.
