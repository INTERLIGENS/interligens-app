# Cloudflare Pro — INTERLIGENS Setup Guide

**Goal:** put `app.interligens.com` behind a Cloudflare Pro zone with WAF,
Bot Fight Mode, rate limiting, and sensible caching. This runs *alongside*
Cloudflare Zero Trust Access (see `CLOUDFLARE_ACCESS_SETUP.md`) and
Upstash rate limiting (app-level).

---

## 1. DNS — point `app.interligens.com` at Cloudflare

1. **Cloudflare dashboard → Add a site →** enter `interligens.com` →
   select **Pro** plan → **Continue**.
2. Cloudflare will scan existing DNS. Verify that the record for
   `app.interligens.com` is imported. If not, add it manually:
   - Type: `CNAME`
   - Name: `app`
   - Target: `cname.vercel-dns.com`
   - Proxy status: **Proxied (orange cloud ON)** ← critical
   - TTL: Auto
3. **Registrar:** change nameservers to the two Cloudflare nameservers
   shown in the onboarding. Propagation: 5 min – 24 h.
4. **Vercel →** Project → Settings → Domains → confirm
   `app.interligens.com` still shows `Valid Configuration`. Vercel will
   detect the CNAME through Cloudflare proxy; no action needed beyond
   keeping the domain attached.
5. **SSL/TLS → Overview →** set mode to **Full (strict)**. Vercel serves a
   valid cert, so strict works and prevents downgrade attacks.
6. **SSL/TLS → Edge Certificates →**
   - Always Use HTTPS: **On**
   - HSTS: **Enable**, max-age `6 months`, include subdomains, preload
   - Minimum TLS Version: **TLS 1.2**
   - Automatic HTTPS Rewrites: **On**

---

## 2. WAF configuration

### 2.1 Managed Rulesets (**Security → WAF → Managed rules**)
Enable all three and set them to **Block** (not just Log):
- [x] **Cloudflare Managed Ruleset** — action `Block`, sensitivity `High`
- [x] **Cloudflare OWASP Core Ruleset** — action `Block`, paranoia level
  `PL2`, threshold `Medium`
- [x] **Cloudflare Exposed Credentials Check** — action `Block`

### 2.2 Custom WAF rules
**Security → WAF → Custom rules → Create rule**

**Rule 1 — Block admin from non-CF-Access traffic (belt & braces)**
```
(http.request.uri.path contains "/admin" or
 http.request.uri.path contains "/api/admin")
and not cf.access.authenticated
```
Action: `Block`. This enforces that `/admin` cannot be reached without a
valid Cloudflare Access JWT — even if the Access app is misconfigured.

**Rule 2 — Block known-bad user agents on write endpoints**
```
(http.request.method in {"POST" "PUT" "PATCH" "DELETE"}) and
(http.user_agent contains "sqlmap" or
 http.user_agent contains "nikto" or
 http.user_agent contains "masscan" or
 http.user_agent eq "" or
 http.user_agent contains "curl/7.0")
```
Action: `Managed Challenge`.

**Rule 3 — Geo-scope admin (optional)**
```
(http.request.uri.path contains "/admin") and
(ip.geoip.country ne "FR" and ip.geoip.country ne "US" and
 ip.geoip.country ne "GB")
```
Action: `Block`. Only enable if the admin team's travel pattern tolerates
it. Safer to leave off initially and revisit after Access logs give a
baseline.

### 2.3 Super Bot Fight Mode
**Security → Bots → Configure Super Bot Fight Mode** (Pro-tier feature):
- Definitely automated: **Block**
- Likely automated: **Managed Challenge**
- Verified bots (Google, Bing, etc.): **Allow**
- Static resource protection: **On**
- JavaScript detections: **On**
- Optimize for WordPress: **Off**

---

## 3. Rate limiting (Cloudflare) — complement Upstash

App-level Upstash rate limiting already exists on these routes. Cloudflare
rules below are a second, network-level layer that absorbs bursts before
they reach the origin.

**Security → WAF → Rate limiting rules → Create rule**

**RL-1 — `/api/scan`**
- Match: `http.request.uri.path eq "/api/scan"`
- Characteristics: `IP address`
- Requests: `20` per `1 minute`
- Action: `Block`, duration `10 minutes`

**RL-2 — `/api/ask`**
- Match: `http.request.uri.path eq "/api/ask"`
- Characteristics: `IP address`
- Requests: `30` per `1 minute`
- Action: `Block`, duration `10 minutes`

**RL-3 — `/api/v1/score`**
- Match: `http.request.uri.path eq "/api/v1/score"`
- Characteristics: `IP address`
- Requests: `60` per `1 minute`
- Action: `Managed Challenge`

**RL-4 — `/api/mobile/*`**
- Match: `starts_with(http.request.uri.path, "/api/mobile/")`
- Characteristics: `IP address` + `Header: authorization`
- Requests: `120` per `1 minute`
- Action: `Block`, duration `5 minutes`

**RL-5 — Global anti-abuse on `/api/*`**
- Match: `starts_with(http.request.uri.path, "/api/")`
- Characteristics: `IP address`
- Requests: `300` per `1 minute`
- Action: `Managed Challenge`

Keep Upstash limits tighter than Cloudflare's — Cloudflare is the
absorb-the-flood layer, Upstash is the precise per-user budget.

---

## 4. Caching — do NOT cache private or API routes

**Caching → Configuration:**
- Browser Cache TTL: `Respect existing headers`
- Always Online: **Off** (stale pages from a private beta are dangerous)
- Development Mode: Off (enable only during debugging)

**Rules → Cache Rules → Create rule — "Bypass cache for private routes"**
Match:
```
starts_with(http.request.uri.path, "/api/") or
starts_with(http.request.uri.path, "/admin") or
starts_with(http.request.uri.path, "/en/admin") or
starts_with(http.request.uri.path, "/fr/admin") or
starts_with(http.request.uri.path, "/investigators") or
starts_with(http.request.uri.path, "/en/investigator") or
starts_with(http.request.uri.path, "/access") or
starts_with(http.request.uri.path, "/box") or
starts_with(http.request.uri.path, "/shared/case") or
http.request.uri.path eq "/health"
```
Then: **Cache eligibility = Bypass cache**.

**Rules → Cache Rules → Create rule — "Cache static assets aggressively"**
Match: `starts_with(http.request.uri.path, "/_next/static/")`
Then:
- Cache eligibility: `Eligible for cache`
- Edge TTL: `Override — 1 month`
- Browser TTL: `Respect origin`

**Rules → Cache Rules — "Cache public marketing pages briefly"**
Match:
```
http.request.uri.path in {"/" "/en" "/fr" "/en/charter" "/fr/charter"
"/en/methodology" "/fr/methodology" "/en/transparency" "/fr/transparency"
"/en/legal" "/fr/legal" "/en/investors" "/sitemap.xml" "/robots.txt"}
```
Then:
- Cache eligibility: `Eligible for cache`
- Edge TTL: `Override — 5 minutes`
- Cache by device type: `Off`
- Respect strong ETags: `On`

---

## 5. Post-activation validation checklist

Run from a clean browser + a shell with `curl`:

- [ ] `dig app.interligens.com` returns Cloudflare IPs (104.x / 172.x),
      NOT Vercel IPs.
- [ ] `curl -I https://app.interligens.com/` shows `server: cloudflare`
      and `cf-ray: <id>`.
- [ ] HTTPS redirect: `curl -I http://app.interligens.com/` → `301` to
      `https://…`.
- [ ] HSTS header present: `strict-transport-security:
      max-age=15552000; includeSubDomains; preload`.
- [ ] Public marketing page `/` still loads ≤ 1 s from three geographies
      (check with a VPN or `curl --resolve`).
- [ ] `/admin` without Cloudflare Access JWT → blocked by custom WAF
      rule 1 (not by origin middleware).
- [ ] `/sitemap.xml` and `/robots.txt` reachable without any gate.
- [ ] `/api/scan` burst test: `for i in {1..25}; do curl -s -o
      /dev/null -w "%{http_code}\n" https://app.interligens.com/api/scan;
      done` → first ~20 should return app responses, the rest `429`.
- [ ] Static asset `_next/static/...` has `cf-cache-status: HIT` after the
      second request.
- [ ] API route has `cf-cache-status: BYPASS`.
- [ ] Super Bot Fight Mode counters increasing under **Security →
      Overview** after 24 h of traffic.
- [ ] No false positives in **Security → Events** for the first 48 h. If
      any legitimate traffic is blocked, tune WAF sensitivity or add a
      skip rule — do not disable the ruleset.
- [ ] Vercel → Deployments → latest deploy still reachable (sanity check
      the CNAME chain survived the nameserver switch).

---

## 6. Interaction with existing layers

| Layer                     | Scope                                | Purpose                              |
| ------------------------- | ------------------------------------ | ------------------------------------ |
| Cloudflare DNS/Proxy      | Everything on `app.interligens.com`  | Hide origin, TLS termination         |
| Cloudflare WAF + Bot Mode | All requests                         | Block malicious payloads & bots      |
| Cloudflare Rate Limiting  | `/api/*` hot paths                   | Absorb bursts before origin          |
| Cloudflare Access         | `/admin`, `/investigators` surfaces  | Identity barrier pre-origin          |
| Next.js middleware        | Same + beta gate                     | Session + Basic Auth at origin       |
| Upstash rate limit        | Per-route app logic                  | Per-user / per-session budgets       |

Each layer is independent. Removing one should never silently bypass
another — if you disable Cloudflare Access, the Next.js middleware still
enforces Basic Auth; if you disable Cloudflare rate limiting, Upstash
still enforces per-user limits.
