# SECURITY DEBT — admin pages are not gated server-side

**Discovered:** Sprint 6 (Evidence Intake Bridge), while building `/admin/watcher-drafts`.
**Severity:** HIGH — broken access control (anyone who knows an admin page URL can load it).
**Status:** OPEN — to hand to a dedicated security sprint (GPT).

## The gap
There is **no Next.js middleware** in the repo (no tracked `middleware.ts` at root or `src/`).
Several existing admin **pages** (server components) do NOT enforce auth at the page
level and instead rely, per their own comments, on a "`/admin/*` middleware (HTTP Basic +
requireAdmin)" that **does not exist**:

- `src/app/admin/ask-logs/page.tsx` — comment: "Protected by /admin/* middleware".
- `src/app/admin/casefile-nova/page.tsx` — "The page does not redirect on its own
  (matches the existing admin pages in this hub)".
- `src/app/admin/shill-correlation/page.tsx` — "Auth enforced server-side by requireAdminApi"
  (true only for the underlying API route, NOT for the page render).

`src/app/admin/layout.tsx` is a **client** component (chrome only) — it does not gate.

**Consequence:** a public user hitting e.g. `/admin/ask-logs` directly receives the
server-rendered page with its data (the page calls `prisma` directly and renders before
any auth check). The admin **API routes** are gated (`requireAdminApi`/`requireAdminCookie`),
but the **pages that read the DB directly are not**.

## What Sprint 6 did (and did NOT)
- The new `/admin/watcher-drafts` page **is** gated server-side via
  `isAdminSessionFromCookies()` + `redirect('/admin/login')` — the data loader never runs
  for unauthenticated requests (verified: no queue data in the no-cookie response).
- Sprint 6 deliberately **did not touch** the pre-existing admin pages (out of scope).

## Recommended fix (security sprint)
1. Add a real `middleware.ts` matching `/admin/:path*` that calls `verifyAdminSession(req)`
   and redirects unauthenticated requests to `/admin/login` — single chokepoint for all
   admin pages. (`src/lib/security/adminAuth.ts` already exports the primitives.)
2. OR add the `isAdminSessionFromCookies()` gate to every admin server-component page
   (defence in depth), like `/admin/watcher-drafts` does.
3. Add a regression test: unauthenticated GET to each `/admin/*` page must not return DB
   data (assert redirect / no sensitive markers in body).

The `admin_session` cookie is an HMAC of `ADMIN_BASIC_PASS` keyed by `ADMIN_TOKEN`
(`computeAdminSessionToken`), so the middleware check is stateless and cheap.
