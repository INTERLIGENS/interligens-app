# INTERLIGENS — Monitoring Guide

> PR5 — Monitoring minimum viable prod
> Dernière mise à jour : 2026-03-09

---

## 1. Health Check

**Endpoint :** `GET /api/health`
**Auth :** aucune (public, read-only)
**Cache :** `no-store` — jamais mis en cache

### Réponse attendue (200)
```json
{
  "ok": true,
  "db": "ok",
  "redis": "ok | disabled",
  "rawdocs": "ok | disabled",
  "env": "production",
  "version": "617cf35",
  "timestamp": "2026-03-09T13:00:00.000Z",
  "duration_ms": 42
}
```

### Codes de statut
| Code | Signification |
|------|--------------|
| `200` | Tout OK — DB répond |
| `503` | DB inaccessible — alerte critique |

---

## 2. Vercel Analytics

### Activation (5 min)
1. Vercel Dashboard → projet `interligens-web`
2. **Analytics** tab → **Enable**
3. Aucun code à ajouter (Next.js auto-instrumenté)

### Ce qui est tracé automatiquement
- Web Vitals (LCP, FID, CLS) par page
- Taux d'erreur 4xx/5xx
- Latences par route API

### Speed Insights (optionnel)
```bash
pnpm add @vercel/speed-insights
```
Puis dans `src/app/layout.tsx` :
```tsx
import { SpeedInsights } from "@vercel/speed-insights/next"
// Dans le JSX : <SpeedInsights />
```

---

## 3. Better Uptime — Setup

### URLs à monitorer

| Monitor | URL | Méthode | Status attendu | Fréquence |
|---------|-----|---------|---------------|-----------|
| Health | `https://interligens-app.vercel.app/api/health` | GET | 200 | 1 min |
| Scan Solana | `https://interligens-app.vercel.app/api/scan/solana?address=So11111111111111111111111111111111111111112` | GET | 200 | 5 min |
| Demo EN | `https://interligens-app.vercel.app/en/demo` | GET | 200 | 5 min |
| Admin (401 guard) | `https://interligens-app.vercel.app/api/admin/sources` | GET | 401 | 5 min |

> Le monitor **Admin** doit retourner **401** — s'il retourne 200, l'auth est cassée.

### Procédure Better Uptime
1. **betteruptime.com** → New Monitor
2. Type : **HTTP**
3. URL : coller l'URL ci-dessus
4. Expected status : code attendu (200 ou 401)
5. Check frequency : **1 min** pour health, **5 min** pour les autres
6. Alert policy : email + Slack webhook (optionnel)
7. **Save**

### Body check (optionnel, recommandé pour /api/health)
- Better Uptime → Monitor → Advanced → **Expected keyword**
- Valeur : `"ok":true`
- Garantit que la DB répond, pas juste que le serveur est up

---

## 4. Alertes — Stratégie minimale

### Niveaux
| Sévérité | Condition | Action |
|----------|-----------|--------|
| 🔴 CRITICAL | `/api/health` → 503 | Alerte immédiate (email + SMS) |
| 🔴 CRITICAL | `/api/admin/sources` → 200 (auth cassée) | Alerte immédiate |
| 🟡 WARNING | Latence `/api/health` > 3s | Email seulement |
| 🟡 WARNING | `/api/scan/solana` → 5xx | Email seulement |

### Seuil de déclenchement recommandé
- **2 échecs consécutifs** avant alerte (évite les faux positifs Vercel cold start)

---

## 5. Vérification que les alertes fonctionnent

### Test health 503 (simuler une panne)
```bash
# 1. Couper temporairement DATABASE_URL dans Vercel (Preview only, pas prod)
# 2. Déclencher un check manuel Better Uptime
# 3. Vérifier que l'alerte arrive en < 2 min
# 4. Remettre DATABASE_URL → vérifier retour 200
```

### Test auth guard (vérifier le 401)
```bash
# Doit retourner 401
curl -s -o /dev/null -w "%{http_code}" \
  https://interligens-app.vercel.app/api/admin/sources

# Doit retourner 200
curl -s -H "x-admin-token: $ADMIN_TOKEN" \
  https://interligens-app.vercel.app/api/admin/sources | jq .total
```

### Test health complet
```bash
curl -s https://interligens-app.vercel.app/api/health | jq .
# Attendu : ok=true, db="ok", version != "local"
```

### Smoke test post-deploy
```bash
# Vérifier les 4 URLs d'un coup
for url in \
  "https://interligens-app.vercel.app/api/health" \
  "https://interligens-app.vercel.app/en/demo" \
  "https://interligens-app.vercel.app/fr/demo"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  echo "$code  $url"
done
# + vérifier 401 sur /api/admin/sources
```

---

## 6. Checklist post-deploy
```
□ /api/health → 200, ok=true, version = SHA du commit
□ /api/admin/sources sans token → 401
□ /api/scan/solana?address=So1... → 200
□ Better Uptime : tous les monitors verts
□ Vercel Analytics : aucune erreur 5xx dans les 5 min post-deploy
```
