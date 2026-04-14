# INTERLIGENS — Hardening Changes (Phase 3)

Date: 2026-04-14
Scope: every fix applied in this audit pass. Each entry links back to `SECURITY_FINDINGS.md`.

All fixes are localized, low-regression, and type-checked (`pnpm tsc --noEmit` → exit 0 after the batch).

---

## HARDENING-1 · SEC-001 · `/api/report/casefile` — remove `?mock=1` auth bypass + add rate limit

- **File**: `src/app/api/report/casefile/route.ts`
- **Change**:
  - Deleted `_isDev` + `_isMock` branch. `checkAuth` is now always required.
  - Added `checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.pdf)` before Puppeteer.
  - Added `export const maxDuration = 300;` (the route was missing it).
- **Why**: any request with `?mock=1` was skipping auth. See SEC-001.
- **Regression risk**: **low**. The only consumer of `?mock=1` was a dev convenience. Legitimate dev work still uses `NODE_ENV=development` with a proper admin token.
- **How to test**:
  - `curl -i "https://app.interligens.com/api/report/casefile?mint=XYZ&mock=1"` → expect `401 Unauthorized`.
  - `curl -i -H "x-admin-token: $ADMIN_TOKEN" "https://app.interligens.com/api/report/casefile?mint=XYZ"` → expect `200` (or `404` if mint missing).
  - Fire 11 requests in 5 minutes from the same IP with a valid token → expect the 11th to return `429`.

---

## HARDENING-2 · SEC-002 · Rename the file whose name is an API key

- **File**: `/Users/dood/dev/interligens-web/.env.localANTHROPIC_API_KEY=sk-ant-api03-…`
- **Change**: `mv` → `.env.local.ROTATE-ME.txt`. File contents untouched.
- **Why**: any `ls`, backup, or paste-in-chat broadcast the key via the filename itself.
- **Regression risk**: **none** — the file is gitignored and nothing in the source tree references the bogus filename.
- **Follow-up required by user (NOT automated)**:
  1. Rotate the Anthropic key in the Anthropic console.
  2. Delete `.env.local.ROTATE-ME.txt` and its twin `.env.localanthropic` (same 4 301 bytes, same mtime) once the rotation is confirmed.
- **Test**: `ls .env* | grep sk-ant` → expect no matches.

---

## HARDENING-3 · SEC-003 · `/[locale]/admin/*` now covered by Basic Auth

- **File**: `src/middleware.ts`
- **Change**: added `isLocalizedAdminRoute` helper matching `^/[a-z]{2}/admin(/|$)` and wired it into `isAdminRoute`. The beta-gate catch-all matcher already runs middleware on `/en/admin/graph`, so no matcher change was required.
- **Why**: `/en/admin/graph` and `/fr/admin/*` were never tested against `pathname.startsWith("/admin")`.
- **Regression risk**: **low**. The Basic Auth prompt now fires on the locale variants of admin — operators must use their Basic Auth credentials, same as on `/admin`.
- **Test**:
  - Prod: `curl -i https://app.interligens.com/en/admin/graph` → expect `401` + `WWW-Authenticate: Basic`.
  - Prod: `curl -i -u "$ADMIN_BASIC_USER:$ADMIN_BASIC_PASS" https://app.interligens.com/en/admin/graph` → expect the HTML of the graph page (or 404 if the locale variant does not exist, which is still an expected admin-gated response).

---

## HARDENING-4 · SEC-004 · Upstash-backed rate limit on Anthropic endpoints

- **Files**:
  - `src/app/api/scan/ask/route.ts`
  - `src/app/api/mobile/v1/ask/route.ts`
- **Change**:
  - Dropped the module-local `rateLimitMap: Map<…>` + `checkRateLimit`/`checkRL` helpers.
  - Imported `checkRateLimit`, `rateLimitResponse`, `getClientIp`, `detectLocale`, `RATE_LIMIT_PRESETS` from `@/lib/security/rateLimit`.
  - Replaced the inline counter with `await checkRateLimit(ip, RATE_LIMIT_PRESETS.osint)` (30 req / minute, Upstash-backed in prod, in-memory fallback in dev).
  - Response on exceed uses `rateLimitResponse(rl, detectLocale(req))` → proper `429` + `Retry-After` + localized body.
- **Why**: the previous Map was module state on a cold-start-ephemeral lambda — effectively unmetered Anthropic access.
- **Regression risk**: **low**. Response shape changes on 429 (localized body from the shared helper instead of `{error:"rate_limited"}`). Clients that only check `res.status === 429` are unaffected. Clients that pattern-match the body need an update.
- **Test**:
  - In dev: fire 31 POSTs in 60 s to `/api/scan/ask` → 31st returns 429.
  - In prod: check the Upstash dashboard for `rl:osint:<ip>` keys after a burst.

---

## HARDENING-5 · SEC-006 · Timing-safe token compare (admin login + mobile x2)

- **Files**:
  - `src/app/api/admin/auth/login/route.ts`
  - `src/app/api/mobile/v1/ask/route.ts`
  - `src/app/api/mobile/v1/scan/route.ts`
- **Change**: added a local `adminTokenMatches` / `mobileTokenMatches` helper using `crypto.timingSafeEqual` (with length-equalization on mismatch). Replaced the `token !== expected` / `mobileToken !== process.env.MOBILE_API_TOKEN` comparisons.
- **Why**: standard defense against timing oracles.
- **Regression risk**: **none**. Same behaviour on match/mismatch, just constant-time.
- **Test**:
  - Unit: feed a token that matches the first 10 characters → expect same failure time as a token that matches zero characters (not testable end-to-end without a timing harness; visual code review suffices).
  - E2E: valid token → 200; invalid token → 401.

---

## HARDENING-6 · SEC-007 · Remove `NEXT_PUBLIC_ADMIN_TOKEN` from client component

- **File**: `src/app/admin/intake/page.tsx`
- **Change**: deleted `const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "";` — the constant was declared but never referenced in the component.
- **Why**: dead-code pattern that would ship the admin secret to the browser bundle on any future misname.
- **Regression risk**: **none**. Unused constant.
- **Test**: `grep -r NEXT_PUBLIC_ADMIN_TOKEN src/` → empty.

---

## HARDENING-7 · SEC-008 · `robots.ts` + `public/robots.txt`

- **Files created**:
  - `src/app/robots.ts` — Next.js App-Router style, uses `NEXT_PUBLIC_SITE_URL` for host.
  - `public/robots.txt` — static fallback for crawlers that ignore the generated route.
- **Disallow list**: `/api/`, `/admin/`, `/en/admin/`, `/fr/admin/`, `/investigators/`, `/access/`, `/box/`, `/_next/`, `/health`, `/shared/case/`.
- **Why**: there was no robots file at all. Crawlers had zero guidance.
- **Regression risk**: **minimal**. Verify in staging that the disallow list does not accidentally cover a public landing you want indexed (none expected based on the route inventory).
- **Test**: after deploy, `curl https://app.interligens.com/robots.txt` → expect the list.

---

## HARDENING-8 · SEC-009 · `X-Robots-Tag: noindex` + `Cache-Control: no-store` on private paths

- **File**: `next.config.ts`
- **Change**: added a `PRIVATE_PATH_SOURCES` array and a `.map(...)` that applies `buildApiHeaders()` (already defined as `X-Content-Type-Options nosniff`, `Cache-Control no-store, no-cache, must-revalidate`, `Pragma no-cache`, `X-Robots-Tag noindex, nofollow`) to each private path.
- **Private paths covered**: `/admin/*`, `/en/admin/*`, `/fr/admin/*`, `/investigators/*`, `/access/*`, `/box/*`, `/api/admin/*`, `/api/investigator/*`, `/api/investigators/*`.
- **Why**: private surfaces had no noindex header. A shared screenshot URL could get indexed.
- **Regression risk**: **minimal**. The same headers already ship on `/api/report/*` and `/api/pdf/*` without incident.
- **Test**: after deploy, `curl -I https://app.interligens.com/admin/login` → expect `X-Robots-Tag: noindex, nofollow` + `Cache-Control: no-store, no-cache, must-revalidate`.

---

## HARDENING-9 · SEC-010 · `maxDuration = 300` on all 8 unset cron routes

- **Files** (batch Python heredoc):
  - `src/app/api/cron/onchain/sync/route.ts`
  - `src/app/api/cron/social/discover/route.ts`
  - `src/app/api/cron/social/capture/route.ts`
  - `src/app/api/cron/signals/run/route.ts`
  - `src/app/api/cron/alerts/deliver/route.ts`
  - `src/app/api/cron/daily-flow/route.ts`
  - `src/app/api/cron/intake-watch/route.ts`
  - `src/app/api/cron/corroboration/route.ts`
- **Change**: inserted `export const maxDuration = 300; // SEC-010` after the imports, alongside (or adding) `runtime = "nodejs"` + `dynamic = "force-dynamic"` where missing.
- **Why**: missing `maxDuration` lets a runaway cron burn the maximum platform slot silently.
- **Regression risk**: **none**. 300 s is the Vercel Pro default ceiling; setting it explicitly cannot raise the limit and only makes the bound visible.
- **Test**: after deploy, Vercel dashboard → Functions → each cron shows `maxDuration 300`.

---

## HARDENING-10 · SEC-013 · Remove debug key-name dump in assistant route

- **File**: `src/app/api/investigators/cases/[caseId]/assistant/route.ts`
- **Change**: deleted the `NODE_ENV !== "production"` block (lines ~98-132) that dumped `pack keys`, `entity keys`, and the `FORBIDDEN KEYS LEAKED` warning via `console.log` / `console.error`.
- **Why**: if `NODE_ENV` ever resolves to `"development"` on a preview or misconfigured deploy, those logs fire on every assistant call. Key names are not secret but the pattern is noise + leak-prone.
- **Regression risk**: **none**. Schema privacy is still enforced by the builder pipeline; this was log-based QA.
- **Test**: grep `[assistant][privacy-audit]` across `src/` → empty.

---

## Files touched (Phase 3)

```
 M next.config.ts
 M src/middleware.ts
 M src/app/admin/intake/page.tsx
 M src/app/api/admin/auth/login/route.ts
 M src/app/api/investigators/cases/[caseId]/assistant/route.ts
 M src/app/api/mobile/v1/ask/route.ts
 M src/app/api/mobile/v1/scan/route.ts
 M src/app/api/report/casefile/route.ts
 M src/app/api/scan/ask/route.ts
 M src/app/api/cron/alerts/deliver/route.ts
 M src/app/api/cron/corroboration/route.ts
 M src/app/api/cron/daily-flow/route.ts
 M src/app/api/cron/intake-watch/route.ts
 M src/app/api/cron/onchain/sync/route.ts
 M src/app/api/cron/signals/run/route.ts
 M src/app/api/cron/social/capture/route.ts
 M src/app/api/cron/social/discover/route.ts
?? AUDIT/
?? public/robots.txt
?? src/app/robots.ts
R  ".env.localANTHROPIC_API_KEY=sk-ant-api03-…" -> ".env.local.ROTATE-ME.txt"
```

`pnpm tsc --noEmit` → exit 0 after the full batch.
