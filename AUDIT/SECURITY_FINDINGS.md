# INTERLIGENS — Security Findings (Phase 2)

Date: 2026-04-14
Scope: pre-beta hardening audit
Method: 4 parallel discovery agents + direct file verification on every P0/P1 claim. Agent claims that could not be reproduced via `Read` / `Grep` on the actual repo are marked **REFUTED**.

## Severity grid

- **P0** — bloquant avant ouverture bêta
- **P1** — critique post-ouverture immédiate
- **P2** — important, à traiter semaine +1
- **P3** — hygiène

---

## P0 — Blockers

### SEC-001 · `/api/report/casefile` auth bypass via `?mock=1`

- **Surface**: `src/app/api/report/casefile/route.ts:18-23`
- **Evidence**:
  ```ts
  const _isDev  = process.env.NODE_ENV === "development";
  const _isMock = new URL(req.url).searchParams.get("mock") === "1";
  if (!_isDev && !_isMock) {
    const _auth = await checkAuth(req);
    if (!_auth.authorized) return _auth.response!;
  }
  ```
- **Impact**: any request to `/api/report/casefile?mint=…&mock=1` SKIPS auth entirely in production, then triggers a Puppeteer chain and calls `/api/scan/solana` internally. Cost + data exposure.
- **Exploitability**: trivial. One GET with `&mock=1`.
- **Fix**: drop the `_isMock` bypass; `mock` has no place in a prod route. If a fixture is needed for E2E, guard on a server-only header (e.g. `x-test-runner`) AND `NODE_ENV !== "production"`.
- **Status**: **FIX APPLIED (see HARDENING_CHANGES.md)**.

### SEC-002 · Anthropic API key embedded in a filename on disk

- **Surface**: `/Users/dood/dev/interligens-web/.env.localANTHROPIC_API_KEY=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`
- **Evidence**: `ls -la .env*` shows the file (4 301 bytes, mtime 31 mars 15:00). Same byte count as the twin `.env.localanthropic` → almost certainly created by a botched `echo ANTHROPIC_API_KEY=... >> .env.local` that redirected to a literal filename.
- **Impact**: every `ls`, shell history entry, `tar`, `rsync`, or Time Machine backup leaks what looks like a valid live Anthropic key (`sk-ant-api03-…`).
- **Exploitability**: local-only right now, but any future backup snapshot or paste in chat propagates it.
- **Fix required BY USER (not safe to automate without rotation)**:
  1. Rotate the Anthropic key in the Anthropic console.
  2. `rm` the two files: `.env.localANTHROPIC_API_KEY=…` and its twin `.env.localanthropic`.
  3. Re-create the key in `.env.local` under a proper variable.
- **Safe partial fix applied**: the filename has been renamed to `.env.local.ROTATE-ME.txt` so it no longer leaks the key through `ls`. File contents left untouched. See HARDENING_CHANGES.md.
- **Status**: **partially mitigated, key rotation still pending**.

### SEC-003 · `/[locale]/admin/graph` escapes admin Basic Auth

- **Surface**: `src/app/[locale]/admin/graph/page.tsx`, middleware matcher `/admin/:path*`
- **Evidence**: the real URL is `/en/admin/graph` (or `/fr/admin/graph`). The middleware `isAdminRoute` check on line 50 compares `pathname.startsWith("/admin")` — `/en/admin/…` does NOT start with `/admin`. Basic Auth therefore never fires. The beta gate (session cookie) still fires, so the page is not fully open, but admin-grade protection is absent.
- **Impact**: anyone with a beta session reaches an admin visualisation page that the operator believes is Basic-Auth-gated.
- **Fix applied**: add `/[locale]/admin/:path*` to the admin branch of middleware AND to the matcher. See HARDENING_CHANGES.md.
- **Status**: **FIX APPLIED**.

### SEC-004 · In-memory rate limiter on Anthropic-backed endpoints

- **Surface**: `src/app/api/scan/ask/route.ts:14-28`, `src/app/api/mobile/v1/ask/route.ts:20-34`
- **Evidence**: both files declare `const rateLimitMap = new Map<…>()` as module state and use a local `checkRateLimit`/`checkRL` helper. In Vercel serverless, each lambda cold start wipes the map; the practical ceiling becomes "30 requests per cold lambda", not "30 per minute per IP".
- **Impact**: uncapped abuse of Anthropic Claude from the public `/api/scan/ask` endpoint and from the mobile `/ask` endpoint. Anthropic Sonnet cost is ~$3 per 1 M input / $15 per 1 M output. An abuser with 100 parallel requests can rack up meaningful spend before the in-memory counter even exists in their lambda.
- **Exploitability**: trivial (public endpoint).
- **Fix applied**: swap both routes to the shared `checkRateLimit(ip, RATE_LIMIT_PRESETS.osint)` from `@/lib/security/rateLimit`, which is already Upstash-backed in prod. See HARDENING_CHANGES.md.
- **Status**: **FIX APPLIED**.

---

## P1 — Critique immédiat

### SEC-005 · Admin routes with direct bearer/Basic compare (inconsistency)

- **Surface**: `src/app/api/admin/kol/network/route.ts`, `src/app/api/admin/kol/publishability/route.ts`, `src/app/api/admin/kol/[handle]/proceeds/route.ts`, plus a handful more reported by the discovery agent.
- **Evidence**: discovery agent scan; not every offender individually verified in this phase.
- **Impact**: these routes duplicate admin-auth logic instead of using `requireAdminApi` (timing-safe, cookie-aware, env-check aware). Basic Auth in middleware still covers them, so exploitability is currently low — but each home-rolled compare is a future timing or misconfig trap.
- **Fix recommandé**: migrate every `/api/admin/**` handler to `requireAdminApi(req)`. Small, mechanical PR — **NOT applied in this pass** because the scope is wide and regression risk is non-trivial (ensure response shape stays compatible).
- **Status**: **documented, not fixed** — scheduled post-beta P1.

### SEC-006 · Direct `!==` token compare on sensitive paths

- **Surfaces**:
  - `src/app/api/admin/auth/login/route.ts:30` — `if (token !== expected)`
  - `src/app/api/mobile/v1/ask/route.ts:118` — `if (!mobileToken || mobileToken !== process.env.MOBILE_API_TOKEN)`
  - `src/app/api/mobile/v1/scan/route.ts:48` — identical pattern
- **Impact**: theoretically a timing oracle on the token. In practice, network jitter and Vercel's edge noise dwarf the leak; but the fix is trivial and it's a standard lint.
- **Fix applied**: all three replaced with `timingSafeEqual` via the existing `safeCompare` helper from `adminAuth.ts` (admin login) or a local helper for the mobile routes. See HARDENING_CHANGES.md.
- **Status**: **FIX APPLIED**.

### SEC-007 · `NEXT_PUBLIC_ADMIN_TOKEN` read by a client component

- **Surface**: `src/app/admin/intake/page.tsx:5`
  ```tsx
  "use client";
  const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "";
  ```
- **Evidence**: grep for `NEXT_PUBLIC_ADMIN_TOKEN` in every `.env*` file on disk: **not set anywhere**. So no real key is in the bundle today. But the pattern is a booby trap: the first operator who copies `ADMIN_TOKEN` into Vercel under the wrong name ships the admin secret into every browser that loads the page.
- **Impact today**: zero. **Impact on first mistake**: total admin compromise.
- **Fix applied**: the client component now accepts an operator-provided token via an input field in local state, never reads from `process.env.NEXT_PUBLIC_*`. See HARDENING_CHANGES.md.
- **Status**: **FIX APPLIED**.

### SEC-008 · No `robots.txt`, no `robots.ts`, no `sitemap.ts`

- **Evidence**: `ls public/robots*` and `ls src/app/{robots,sitemap}*` both return `no matches found`.
- **Impact**: crawlers have no instructions. Combined with SEC-009, the middleware gate is the ONLY thing preventing indexing of `/investigators/box/*` or `/admin/*`. Any operator bookmark or social share of a private URL could be picked up.
- **Fix applied**: created `src/app/robots.ts` (App-Router style) with explicit `Disallow` for `/api/`, `/admin/`, `/investigators/`, `/access/`, `/box/`, `/_next/`, `/health`, and a sitemap pointer. Also created `public/robots.txt` as a belt-and-suspenders static fallback (some crawlers prefer the static file). See HARDENING_CHANGES.md.
- **Sitemap**: deferred — requires product input on which locale/KOL/casefile pages to whitelist. Documented as post-beta P2.
- **Status**: **robots FIX APPLIED**, sitemap deferred.

### SEC-009 · `X-Robots-Tag` missing on private API paths

- **Surface**: `next.config.ts:10-26` only adds `X-Robots-Tag` on `/api/report/(.*)` and `/api/pdf/(.*)`. Missing on `/admin/(.*)`, `/api/admin/(.*)`, `/investigators/(.*)`, `/api/investigator/(.*)`, `/api/investigators/(.*)`, `/access/(.*)`.
- **Impact**: if a private URL is ever linked from a public page or a shared screenshot, crawlers see the response and can index the HTML/JSON.
- **Fix applied**: extended `next.config.ts` headers to add `X-Robots-Tag: noindex, nofollow` on every private path listed above, plus `Cache-Control: no-store` on the same set. See HARDENING_CHANGES.md.
- **Status**: **FIX APPLIED**.

### SEC-010 · Crons missing `export const maxDuration`

- **Surface**: 8 of 10 cron routes have no `maxDuration` export (only `watcher-v2` and `watch-rescan` set it to 300 s).
- **Impact**: not a confidentiality risk, but a budget risk — a runaway cron can burn a 900-second Vercel function slot and multiply the bill. Vercel's free/pro limit is 300 s (pro) / 60 s (free) by default; without `maxDuration`, the function inherits the platform cap silently.
- **Fix applied**: `export const maxDuration = 300;` added to all 8 cron routes. See HARDENING_CHANGES.md.
- **Status**: **FIX APPLIED**.

### SEC-011 · ~~`/api/watch` POST unauthenticated~~ **REFUTED**

- **Agent claim**: public `POST /api/watch` allows anyone to create watched addresses.
- **Reality**: `src/app/api/watch/route.ts:28-52` defines `requireAccessId(req)` which reads `getSessionTokenFromReq` and calls `validateSession` against the DB. `GET` and `POST` both call it first. The route is authenticated.
- **Status**: **no fix needed**.

### SEC-012 · ~~`/api/kol/[handle]/pdf-legal` public Puppeteer~~ **PARTIALLY REFUTED**

- **Reality**: the route uses `LEGAL_PDF_TOKEN` + `ADMIN_TOKEN` gating via `crypto.timingSafeEqual`. It is authenticated.
- **Remaining gap**: no explicit `checkRateLimit` call — if a legitimate holder of `LEGAL_PDF_TOKEN` floods the endpoint, Puppeteer runs unbounded.
- **Fix recommended (not applied)**: add `RATE_LIMIT_PRESETS.pdf` to the GET handler. Low priority because the surface is already token-gated.
- **Status**: **documented, not fixed** — post-beta P2.

### SEC-017 · Cron routes outside `vercel.json` schedule

- **Surface**: `/api/cron/intake-watch`, `/api/cron/corroboration` exist in source but are **not** listed in `vercel.json` → they never run as scheduled crons. They're still reachable on the public URL, authenticated by `CRON_SECRET`, which is fine — but they're dead weight.
- **Fix recommended**: either re-add them to `vercel.json` or delete the routes.
- **Status**: **documented, not fixed** — housekeeping.

---

## P2 — Important

### SEC-013 · Debug key-name dump in assistant route

- **Surface**: `src/app/api/investigators/cases/[caseId]/assistant/route.ts:99-132`
- **Evidence**:
  ```ts
  if (process.env.NODE_ENV !== "production") {
    const packKeys = Object.keys(pack as unknown as Record<string, unknown>);
    const entityKeys = pack.entities.length > 0 ? Object.keys(pack.entities[0]) : [];
    const forbidden = ["contentEnc", "contentIv", "r2Key", ...];
    const violations = [...packKeys, ...entityKeys].filter((k) => forbidden.includes(k) || k.endsWith("Enc") || k.endsWith("Iv"));
    console.log("[assistant][privacy-audit] pack keys:", packKeys);
    console.log("[assistant][privacy-audit] entity keys:", entityKeys);
    console.log("[assistant][privacy-audit] entity count:", pack.entities.length);
    if (violations.length > 0) {
      console.error("[assistant][privacy-audit] FORBIDDEN KEYS LEAKED:", violations);
    }
  }
  ```
- **Impact**: the gate is `NODE_ENV !== "production"`. If a preview build or a misconfigured deploy runs with `NODE_ENV=development`, the debug logs dump (key names only, not values) on every assistant call. Key names themselves are not secret, but this is noise at best and a lint violation at worst.
- **Fix applied**: deleted the block; schema privacy is enforced by the builder pipeline, not by log-based QA. See HARDENING_CHANGES.md.
- **Status**: **FIX APPLIED**.

### SEC-014 · CSP `'unsafe-inline'` + `'unsafe-eval'`

- **Surface**: `src/lib/security/headers.ts:32-33`
- **Evidence**: the file itself documents the TODO.
- **Impact**: the main XSS containment of CSP is neutralised. HSTS, frame-ancestors, X-Content-Type-Options remain.
- **Fix**: requires a nonce middleware — out of scope for this pass (Phase 2 per `headers.ts` comment).
- **Status**: **accepted risk, documented**.

### SEC-018 · `console.log` in `/api/report/casefile`

- **Surface**: `src/app/api/report/casefile/route.ts:33, 40` — `console.log("[REPORT]", {...})`, `console.log("[REPORT_OFFCHAIN]", ...)`.
- **Impact**: prints the mint + claim counts to Vercel function logs on every call. Not sensitive per se, but noisy and may leak user search patterns.
- **Fix**: deferred, log level tuning post-beta.
- **Status**: **documented, not fixed**.

---

## P3 — Hygiène

### SEC-015 · CORS `Access-Control-Allow-Origin: *` on `/api/v1/score`

- **Surface**: `src/app/api/v1/score/route.ts:24-42` (both GET and OPTIONS).
- **Impact**: intentional — this is the public scoring API. Response is mint-only data. No sensitive fields.
- **Fix**: add a comment documenting the intent. Not a defect.
- **Status**: **documented, accepted**.

### SEC-016 · Vault presigned URL TTL 15 min, no IP binding

- **Surface**: `src/app/api/investigators/cases/[caseId]/files/[fileId]/url/route.ts:19-20`
- **Impact**: a logged-in investigator who forwards the presigned URL to another party lets that party download the file for up to 15 minutes.
- **Fix**: IP-bound tokens or single-use tokens require R2-side work. Out of scope for beta.
- **Status**: **accepted for beta**, flagged for post-launch review.

### SEC-019 · `.env.prod`, `.env.vercel`, `.env.vercel.local` untracked files sprawl

- **Surface**: local filesystem only (all gitignored).
- **Impact**: config drift, audit pain. Not an attacker-exploitable flaw.
- **Fix**: housekeeping.
- **Status**: **documented**.

---

## Refuted or non-issues

| Claim (agent) | Reality |
|---|---|
| `.env` committed to git history on `v2.0-investigators` | `git log --all -- .env .env.local .env.production` returns empty. **Refuted.** |
| 4 cron routes lack auth (`social/discover`, `social/capture`, `signals/run`, `watcher-v2`) | All 10 crons have `verifyCronSecret` / Bearer-CRON_SECRET. **Refuted.** |
| `/api/watch` POST unauthenticated | Uses `requireAccessId` → `validateSession`. **Refuted.** |
| `/api/kol/[handle]/pdf-legal` unauthenticated | Gated by `LEGAL_PDF_TOKEN` + `ADMIN_TOKEN` with `timingSafeEqual`. **Partially refuted** (RL still missing, see SEC-012). |
| CSP headers bypassed on API routes | `next.config.ts` applies `buildSecurityHeaders` to `/(.*)` which includes `/api/*`. **Refuted.** |

---

## Findings count

| Severity | Count | Applied | Documented-only |
|---|---|---|---|
| P0 | 4 | 3 | 1 (key rotation pending user action) |
| P1 | 6 | 5 | 1 (SEC-005 admin route migration — post-beta) |
| P2 | 3 | 1 | 2 |
| P3 | 3 | 0 | 3 |
| **Total** | **16** | **9** | **7** |

Also: **5 agent claims refuted** after direct verification.
