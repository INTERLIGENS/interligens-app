# Admin page access control — RESOLVED (was a false alarm)

**Original claim (Sprint 6):** "admin pages are not gated server-side — broken
access control". **That claim was WRONG.** Corrected in Sprint 8.

## Real situation
Admin pages **are** gated in production by **`src/proxy.ts`** — the request
chokepoint that Next.js 16 uses (the `middleware` convention was renamed to
`proxy` in Next 16; there is no `middleware.ts`). The Sprint-6 audit looked for
`middleware.ts` and per-page guards and **missed `src/proxy.ts`**.

`src/proxy.ts` enforces, on every matched request:
- `/admin/:path*` **and** `/[locale]/admin/...` pages → `verifyAdminSession(req)`
  (admin_session HMAC cookie); redirect to `/admin/login` if absent/invalid.
- `/api/admin/:path*` → `verifyAdminSession(req) || checkBasicAuth(req)`
  (route handlers also layer `requireAdminApi`).
- Carve-out: `/admin/login` + `/api/admin/auth/login|logout` stay reachable.

Deployed since `857c863` (pre-existing). So in production **no admin page or API
is reachable without a valid admin session** — there is no broken-access-control.

## The one nuance (fixed in Sprint 8)
The admin gate used to be wrapped in `if (isProd && …)`, so it was **inactive in
local dev** (`NODE_ENV !== 'production'`). Not a prod vulnerability (Vercel forces
`NODE_ENV=production`), but a trap: local testing or a mis-configured preview
deploy could read as "admin is open". **Sprint 8 removed the `isProd` condition**
— the admin gate is now always active (dev included); the `/admin/login`
carve-out is preserved.

## Status
- Admin access control: **OK in prod (always was), now also enforced in dev.**
- Defence-in-depth per-page guards: NOT needed (the proxy is the single
  chokepoint). The Sprint-6 `/admin/watcher-drafts` page keeps its own
  `isAdminSessionFromCookies()` gate — harmless, no longer load-bearing.
- No further action required. This file is retained as a record of the
  false alarm and its correction.
