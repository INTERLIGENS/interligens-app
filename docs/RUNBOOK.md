# INTERLIGENS — Runbook Prod

## First Deploy — Bootstrap Intel Vault Sources

Après chaque premier déploiement sur un environnement vierge (DB vide) :
```bash
# Dry-run préalable (vérifie sans écrire)
curl -s -X POST https://interligens-app.vercel.app/api/admin/bootstrap/sources?dryRun=1 \
  -H "x-admin-token: $ADMIN_TOKEN" | jq .

# Seed réel
curl -s -X POST https://interligens-app.vercel.app/api/admin/bootstrap/sources \
  -H "x-admin-token: $ADMIN_TOKEN" | jq .
# Attendu : { "created": 23, "skipped": 0, "failed": 0 }

# Re-seed forcé (si sources corrompues)
curl -s -X POST https://interligens-app.vercel.app/api/admin/bootstrap/sources?force=1 \
  -H "x-admin-token: $ADMIN_TOKEN" | jq .
```

### Comportement attendu

| Situation | Réponse |
|---|---|
| DB vide | `{ created: 23, skipped: 0, failed: 0 }` |
| Sources déjà présentes | `{ skipped: true, reason: "N source(s) already exist..." }` |
| Re-run avec `?force=1` | `{ created: 0, skipped: 23, failed: 0 }` |
| Erreur partielle | HTTP 207, `failed > 0` dans le rapport |

### Sécurité
- Route protégée par `requireAdminApi` (x-admin-token ou cookie httpOnly)
- Sans `?force=1`, refuse si des sources existent déjà
- Idempotent : upsert sur `name` unique, jamais de delete
