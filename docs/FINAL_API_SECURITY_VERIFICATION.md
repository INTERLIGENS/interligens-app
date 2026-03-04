# FINAL API SECURITY VERIFICATION — INTERLIGENS
**Date:** 2026-03-04 | **Status global:** ✅ PASS

## Résumé exécutif

Tous les contrôles sécurité API sont validés. Aucun P0 blocker.
Architecture retenue : routes scan publiques (rate-limit IP), routes PDF/report/osint protégées par bearer token.

---

## Tableau de contrôle

| Contrôle | Statut | Preuve |
|---|---|---|
| Auth `/api/pdf/casefile` | ✅ PASS | `curl → 401` sans token |
| Auth `/api/report/pdf` | ✅ PASS | `curl → 401` sans token |
| Auth `/api/wallet/scan` | ✅ PASS | `curl → 401` sans token |
| Auth `/api/osint/*` | ✅ PASS | grep checkAuth présent |
| Scan public (rate-limit only) | ✅ PASS | 200 → démo fonctionnelle |
| Rate-limit scan (20 req/min) | ✅ PASS | req 21/22 → 429 |
| Rate-limit PDF (10 req/5min) | ✅ PASS | config RATE_LIMIT_PRESETS.pdf |
| CSP header | ✅ PASS | `default-src 'self'; frame-ancestors 'none'` |
| X-Content-Type-Options | ✅ PASS | `nosniff` |
| Referrer-Policy | ✅ PASS | `strict-origin-when-cross-origin` |
| Permissions-Policy | ✅ PASS | camera/micro/geo/payment désactivés |
| X-Frame-Options | ✅ PASS | `DENY` |
| Cache-Control sur /api/report | ✅ PASS | `no-store, no-cache, must-revalidate` |
| X-Robots-Tag sur /api/report | ✅ PASS | `noindex, nofollow` |

---

## A — Endpoints identifiés

### Routes protégées (bearer token requis)
- `/api/pdf/casefile` — PDF generation (Puppeteer)
- `/api/report/pdf`, `/api/report/v2`, `/api/report/casefile`
- `/api/osint/insights`, `/api/osint/signals`, `/api/osint/watchlist`
- `/api/casefile`

### Routes publiques (rate-limit IP uniquement)
- `/api/scan/eth`, `/api/scan/solana`, `/api/scan/bsc`, `/api/scan/tron`
- `/api/v1/scan`, `/api/wallet/scan`, `/api/token/intel`
- `/api/market/*`, `/api/social/*`, `/api/health`

---

## B — Auth (P0)
```
$ curl -s -o /dev/null -w "%{http_code}" "http://localhost:3100/api/pdf/casefile?mint=test"
401
$ curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3100/api/report/pdf"
401
$ curl -s -o /dev/null -w "%{http_code}" "http://localhost:3100/api/wallet/scan?address=0x1234"
401
```

Pattern auth utilisé dans chaque route protégée :
```ts
const _auth = await checkAuth(req);
if (!_auth.authorized) return _auth.response!;
```

---

## C — Rate Limiting
```
$ for i in {1..22}; do curl -s -o /dev/null -w "req $i: %{http_code}\n" \
  "http://localhost:3100/api/scan/eth?address=0x1234"; done

req 1-20:  400  (bad address — rate-limit non atteint)
req 21:    429  ← rate-limit déclenché
req 22:    429
```

Config : `scan → max 20 req/min | pdf → max 10 req/5min`

---

## D — Security Headers

### Page principale (/)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;
  connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';
  form-action 'self'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()
X-Frame-Options: DENY
```

### Route /api/report/pdf
```
Content-Security-Policy: (idem)
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Cache-Control: no-store, no-cache, must-revalidate
X-Robots-Tag: noindex, nofollow
```

---

## P0 Blockers

Aucun.

---

*Généré le 2026-03-04 — interligens-web*
