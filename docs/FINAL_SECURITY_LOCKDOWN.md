# FINAL SECURITY LOCKDOWN — INTERLIGENS
**Date:** 2026-03-04 | **Status global:** ✅ GO — aucun P0 blocker

---

## Executive Summary

| Contrôle | Statut | Preuve |
|---|---|---|
| Rate-limit PDF fail-closed (Redis down) | ✅ PASS | Test Vitest : `allowed=false` si Upstash 503 |
| Rate-limit scan/osint fail-open (Redis down) | ✅ PASS | Test Vitest : `allowed=true` si Upstash 503 |
| SSRF Guard Puppeteer — loopback | ✅ PASS | `isBlockedUrl("http://127.0.0.1/")` → blocked |
| SSRF Guard Puppeteer — metadata AWS | ✅ PASS | `isBlockedUrl("http://169.254.169.254/")` → blocked |
| SSRF Guard Puppeteer — RFC-1918 | ✅ PASS | 10/8, 172.16/12, 192.168/16 → blocked |
| SSRF Guard Puppeteer — schémas file/ftp | ✅ PASS | `file:///etc/passwd` → blocked |
| SSRF Guard branché routes Puppeteer | ✅ PASS | `setRequestInterception` dans 3 routes PDF |
| Build | ✅ PASS | `pnpm build` exit 0 |
| Tests | ✅ PASS | 211/211 (25 fichiers) |

---

## B — Rate Limit: Redis/Upstash Down Policy

### Code patché — src/lib/security/rateLimit.ts
```ts
cat > docs/FINAL_SECURITY_LOCKDOWN.md << 'EOF'
# FINAL SECURITY LOCKDOWN — INTERLIGENS
**Date:** 2026-03-04 | **Status global:** ✅ GO — aucun P0 blocker

---

## Executive Summary

| Contrôle | Statut | Preuve |
|---|---|---|
| Rate-limit PDF fail-closed (Redis down) | ✅ PASS | Test Vitest : `allowed=false` si Upstash 503 |
| Rate-limit scan/osint fail-open (Redis down) | ✅ PASS | Test Vitest : `allowed=true` si Upstash 503 |
| SSRF Guard Puppeteer — loopback | ✅ PASS | `isBlockedUrl("http://127.0.0.1/")` → blocked |
| SSRF Guard Puppeteer — metadata AWS | ✅ PASS | `isBlockedUrl("http://169.254.169.254/")` → blocked |
| SSRF Guard Puppeteer — RFC-1918 | ✅ PASS | 10/8, 172.16/12, 192.168/16 → blocked |
| SSRF Guard Puppeteer — schémas file/ftp | ✅ PASS | `file:///etc/passwd` → blocked |
| SSRF Guard branché routes Puppeteer | ✅ PASS | `setRequestInterception` dans 3 routes PDF |
| Build | ✅ PASS | `pnpm build` exit 0 |
| Tests | ✅ PASS | 211/211 (25 fichiers) |

---

## B — Rate Limit: Redis/Upstash Down Policy

### Code patché — src/lib/security/rateLimit.ts
```ts
if (!res.ok) {
  // Fail-closed pour PDF (coûteux/Puppeteer) — fail-open pour scan/osint
  if (cfg.keyPrefix === "rl:pdf") {
    const retryAfter = Math.ceil(cfg.windowMs / 1000);
    return { allowed: false, remaining: 0, limit: cfg.max, retryAfter, resetAt: now + cfg.windowMs };
  }
  return { allowed: true, remaining: cfg.max, limit: cfg.max, retryAfter: 0, resetAt: now + cfg.windowMs };
}
```

### Preuve — tests Vitest (src/lib/security/__tests__/rateLimit.redis-down.test.ts)
```
$ pnpm test src/lib/security/__tests__/rateLimit.redis-down.test.ts

stderr: [rateLimit] Upstash error 503  (x3 — attendu)

✓ PDF: fail-CLOSED quand Redis down (retourne allowed=false)
✓ SCAN: fail-OPEN quand Redis down (retourne allowed=true)
✓ OSINT: fail-OPEN quand Redis down (retourne allowed=true)
```

**PDF endpoints protected even when Redis is down: ✅ YES**

---

## C — SSRF Guard Puppeteer

### Fichier créé — src/lib/security/ssrfGuard.ts
Fonction `isBlockedUrl(url)` bloquant :
- `localhost`, `127.0.0.1`, `::1`, `ip6-localhost`
- `169.254.169.254`, `metadata.google.internal` (AWS/GCP metadata)
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC-1918)
- Schémas : `file:`, `ftp:`, `gopher:`, `data:`, `jar:`
- IPv6 privé : `fc00::/7`, `fe80::/10`

### Routes Puppeteer protégées
```ts
await page.setRequestInterception(true);
page.on("request", puppeteerSsrfGuard);
```
- `src/app/api/report/v2/route.ts`
- `src/app/api/report/casefile/route.ts`
- `src/app/api/pdf/casefile/route.ts`

### Preuve — tests Vitest (src/lib/security/__tests__/ssrfGuard.test.ts)
```
$ pnpm test src/lib/security/__tests__/ssrfGuard.test.ts

✓ blocks 127.0.0.1
✓ blocks localhost:3100
✓ blocks IPv6 ::1
✓ blocks 169.254.169.254
✓ blocks metadata.google.internal
✓ blocks 10.0.0.1 / 172.16.0.1 / 192.168.1.1
✓ blocks file:///etc/passwd
✓ blocks ftp:// / gopher:// / data:
✓ allows api.dexscreener.com
✓ allows api.coingecko.com
✓ allows 1.1.1.1 (Cloudflare DNS)
```

---

## Assumptions & Scope

- HSTS non testé en local (normal — header prod-only sur Vercel)
- Rate-limit scan/osint intentionnellement fail-open (endpoints publics, coût faible)
- `unsafe-inline` dans CSP nécessaire pour Next.js inline styles — acceptable
- Tests Vitest couvrent la logique pure ; smoke test Puppeteer non requis (guard branché sur HTTPRequest réel)

---

*Généré le 2026-03-04 — interligens-web*
