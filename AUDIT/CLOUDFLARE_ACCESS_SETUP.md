# Cloudflare Zero Trust Access — INTERLIGENS Setup

**Goal:** enforce an identity barrier *in front of* the Next.js app so that
admin + investigator routes never reach the origin without a verified human
identity. The existing Next.js middleware (Basic Auth + session cookie)
remains in place as a second layer (defense in depth).

---

## 1. Paths to protect

All paths are rooted at `app.interligens.com`.

### Admin surface (HTTP Basic auth today → Cloudflare Access tomorrow)
- `/admin/*`
- `/api/admin/*`
- `/en/admin/*`
- `/fr/admin/*`
- Any other `/[locale]/admin/*` (dynamic locale route)

### Investigator surface (session cookie today → Cloudflare Access tomorrow)
- `/investigators/*` (onboarding, box, apply, suspended, revoked)
- `/en/investigator/*`
- `/api/investigator/*` — EXCEPT `/api/investigator/auth/*` (login endpoints
  must stay reachable for the login flow itself)

### Intentionally NOT protected by Access
- `/` and public marketing routes (`/en`, `/fr`, `/en/charter`, …)
- `/access/*` (the beta-access login flow)
- `/sitemap.xml`, `/robots.txt`, `/health`
- `/api/scan`, `/api/ask`, `/api/v1/score`, `/api/mobile/*` — rate-limited via
  Upstash + Cloudflare WAF instead (see `CLOUDFLARE_PRO_SETUP.md`)

---

## 2. Dashboard procedure (Cloudflare Zero Trust)

### 2.1 Prerequisites
1. `app.interligens.com` is proxied through Cloudflare (orange cloud ON).
2. Zero Trust is enabled on the Cloudflare account (free tier is sufficient
   for up to 50 users).
3. An identity provider is configured under **Zero Trust → Settings →
   Authentication → Login methods**. Recommended: **One-time PIN** (email
   OTP, no IdP required) as the baseline, plus **Google Workspace** if the
   team uses one.

### 2.2 Create the Admin application
**Zero Trust → Access → Applications → Add an application → Self-hosted**

1. **Application name:** `INTERLIGENS Admin`
2. **Session duration:** `8 hours`
3. **Application domain — add these rows (one per row):**
   - `app.interligens.com/admin`
   - `app.interligens.com/api/admin`
   - `app.interligens.com/en/admin`
   - `app.interligens.com/fr/admin`
4. **Identity providers:** check **One-time PIN** (and Google Workspace if
   configured).
5. **Next → Add a policy:**
   - Policy name: `Admins only`
   - Action: `Allow`
   - Rules → Include → **Emails:**
     - `[EMAIL_ADMIN_1]`
     - `[EMAIL_ADMIN_2]`
   - Require → **Authentication method:** One-time PIN (or Google)
6. **Next → Settings:**
   - CORS: leave default
   - Cookie settings: `HTTP Only`, `Same Site = Lax`, `Enable binding
     cookie`
   - Enable **Skip identity provider selection** if only one IdP is active
7. **Save.**

### 2.3 Create the Investigator application
Repeat 2.2 with:
1. **Application name:** `INTERLIGENS Investigators`
2. **Session duration:** `24 hours`
3. **Application domain:**
   - `app.interligens.com/investigators`
   - `app.interligens.com/en/investigator`
   - `app.interligens.com/api/investigator`
4. **Bypass rule for login endpoints** — add an **additional application**
   *before* this one with:
   - Domain: `app.interligens.com/api/investigator/auth`
   - Policy action: `Bypass`
   - This ensures the investigator login flow is not itself gated by Access.
5. **Policy:**
   - Policy name: `Trusted investigators`
   - Action: `Allow`
   - Rules → Include → **Emails** (initial whitelist):
     - `[EMAIL_INVESTIGATOR_1]`
     - `[EMAIL_INVESTIGATOR_2]`
   - Later: replace with an **Emails ending in** rule (e.g.
     `@interligens.com`) or a Google Group once the IdP is richer.

### 2.4 Order of applications
Cloudflare evaluates Access apps top-to-bottom. Ensure the **Bypass** app
for `/api/investigator/auth` is listed **above** the `INTERLIGENS
Investigators` app — otherwise the investigator app will gate the login
endpoint and cause a chicken-and-egg problem.

---

## 3. Defense in depth — keep Next.js middleware

The existing `src/middleware.ts` still runs Basic Auth on `/admin/*` and
still validates the `investigator_session` cookie on investigator routes.
**Do not remove it.** Rationale:

- Cloudflare Access failures (misconfiguration, bypassed app, CF outage with
  "I'm under attack" fallback) would otherwise expose admin.
- Local dev (`pnpm dev`) does not go through Cloudflare — middleware is the
  only gate in that environment.
- Preview deployments on `*.vercel.app` are not covered by the Access app
  (which targets `app.interligens.com`). Middleware still protects them.

Cloudflare Access adds identity verification *before* the origin is
reached; Next.js middleware adds session verification *at* the origin. Both
must be breached for a request to hit admin.

---

## 4. Expected behavior after setup

1. Unauthenticated user hits `https://app.interligens.com/admin` →
   Cloudflare Access intercepts → shows the Access login screen (email OTP
   form) → **no request reaches Vercel/Next.js**.
2. User submits email → receives 6-digit code → enters it → Access sets a
   `CF_Authorization` JWT cookie scoped to `app.interligens.com`.
3. Subsequent requests to `/admin/*` carry the JWT. Cloudflare validates it
   and forwards the request to the origin.
4. At the origin, Next.js middleware sees the request and runs its Basic
   Auth check (still required). Admin must authenticate twice on first
   visit, once per session afterward.
5. A user whose email is not in the policy sees "You do not have
   permission" and the origin never sees their request.

---

## 5. Testing checklist

Run these from a clean browser profile (or incognito):

- [ ] **Public routes still work:** `https://app.interligens.com/` and
      `/en/charter` load normally (no Access prompt).
- [ ] **Sitemap & robots reachable:** `curl -I
      https://app.interligens.com/sitemap.xml` returns `200` with no Access
      redirect.
- [ ] **Admin is gated:** visiting `/admin` shows the Cloudflare Access
      login screen (NOT the Basic Auth prompt — Access comes first).
- [ ] **Wrong email blocked:** log in with an email not on the whitelist →
      get "You do not have permission".
- [ ] **Allowed email passes Access, then hits Basic Auth:** log in with a
      whitelisted email → reach the Basic Auth prompt → enter admin creds →
      reach `/admin`.
- [ ] **JWT header present at origin:** add temporary logging of
      `Cf-Access-Authenticated-User-Email` in an admin route; confirm it
      matches the email used to log in.
- [ ] **Investigator login flow not broken:** `POST
      /api/investigator/auth/login` still works without an Access JWT
      (bypass app).
- [ ] **Other investigator routes gated:** `GET /api/investigator/cases`
      without Access JWT → blocked by Access, never reaches origin.
- [ ] **Preview deployments unaffected:** `*.vercel.app` previews still use
      only the Next.js middleware (expected — Access is on the production
      domain only).

---

## 6. Rollback

If Access misconfiguration locks everyone out of admin:

1. **Zero Trust → Access → Applications →** open the offending app → **Edit
   → Policies →** temporarily add a policy `Emergency allow` with action
   `Service Auth` and a Service Token, or
2. **Disable the application** entirely (button at top right of the app
   edit screen). Admin then falls back to Basic Auth only (current state).
3. Investigate via Zero Trust → Logs → Access.

Never delete the application under panic — disable it. Deletion loses
policy history.
