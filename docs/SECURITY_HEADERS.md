# Security Headers — INTERLIGENS-WEB
_Ajouté: 2026-03-04_

## Architecture

Les headers sont appliqués à **deux niveaux** :

**`next.config.ts` → `headers()`**
Appliqué par Next.js à toutes les réponses (pages + API) avant même que le code route s'exécute. C'est l'endroit le plus haut de la stack, donc le plus fiable.

**`src/lib/security/headers.ts`**
Builder isolé et testable. Toute modification de politique passe par ce fichier — next.config.ts l'importe, les tests unitaires le valident directement.

---

## Headers appliqués

### Toutes les routes `/(.*)`

| Header | Valeur | Rôle |
|--------|--------|------|
| `Content-Security-Policy` | voir ci-dessous | Empêche XSS, clickjacking, injections |
| `X-Content-Type-Options` | `nosniff` | Empêche le MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limite la fuite d'URL dans les referers |
| `Permissions-Policy` | camera, micro, geo, payment désactivés | Empêche l'accès aux features browser sensibles |
| `X-Frame-Options` | `DENY` | Fallback anti-clickjacking (vieux navigateurs) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | **Prod uniquement** — Force HTTPS 2 ans |

### Routes API PDF `/api/report/*` et `/api/pdf/*`

| Header | Valeur | Rôle |
|--------|--------|------|
| `Cache-Control` | `no-store, no-cache` | Les PDFs générés ne doivent jamais être mis en cache |
| `X-Robots-Tag` | `noindex, nofollow` | Exclut les routes API des moteurs de recherche |

---

## CSP — Détail et état
```
default-src 'self'
script-src  'self' 'unsafe-inline'    ← TODO phase 2 : nonce middleware
style-src   'self' 'unsafe-inline'    ← TODO phase 2 : nonce (Tailwind)
img-src     'self' data: https:
font-src    'self' data:
connect-src 'self'
frame-ancestors 'none'
object-src  'none'
base-uri    'self'
form-action 'self'
upgrade-insecure-requests
```

### Pourquoi `unsafe-inline` pour l'instant ?

Next.js 16 + React 19 injectent des scripts inline pour l'hydratation.
Tailwind génère des classes qui peuvent produire des styles inline en dev.
Supprimer `unsafe-inline` sans nonce **casserait l'app**.

### Phase 2 (P2 backlog) — nonce dynamique

Ajouter dans `src/middleware.ts` :
```typescript
const nonce = crypto.randomUUID();
// Injecter dans les headers de réponse + dans le CSP via nonce-${nonce}
```
Puis remplacer `'unsafe-inline'` par `'nonce-${nonce}'` dans buildCsp().

---

## Où sont les variables d'environnement liées

| Variable | Rôle | Fichier |
|----------|------|---------|
| `NODE_ENV` | Active HSTS en prod | `next.config.ts` |
| `UPSTASH_REDIS_REST_URL` | Rate limiting Redis | `src/lib/security/rateLimit.ts` |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting Redis | `src/lib/security/rateLimit.ts` |

---

## Vérification manuelle (après déploiement)
```bash
# Vérifier les headers en prod
curl -I https://your-domain.com | grep -E "Content-Security|X-Frame|Strict-Transport|X-Content"

# Ou utiliser l'outil en ligne
# https://securityheaders.com
```

---

_Modifié via `src/lib/security/headers.ts` — ne jamais éditer next.config.ts directement pour les headers._
