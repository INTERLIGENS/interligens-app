# INTERLIGENS — Production Setup (Vercel + Postgres + Redis + R2)

## 1. Vercel Postgres (Neon)
- Vercel Dashboard > Storage > Postgres > Create
- Env auto-injectée: `DATABASE_URL`
- Exécuter les migrations en CI/postinstall:
```bash
  npx prisma migrate deploy
```

## 2. Upstash Redis (Rate Limit persistant)
- Vercel Dashboard > Marketplace > Upstash
- Env requises:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

## 3. Cloudflare R2 (Raw Docs Storage)
- Créer un bucket R2 dans Cloudflare Dashboard
- Env requises:
  - `RAWDOCS_STORAGE=s3`
  - `RAWDOCS_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`
  - `RAWDOCS_S3_BUCKET=<bucket>`
  - `RAWDOCS_S3_ACCESS_KEY=<key>`
  - `RAWDOCS_S3_SECRET_KEY=<secret>`
  - `RAWDOCS_S3_REGION=auto`

## 4. Admin Auth (double verrou)
- `ADMIN_TOKEN=<secret>` → header `x-admin-token`
- `ADMIN_BASIC_USER=<user>` + `ADMIN_BASIC_PASS=<pass>` → Basic Auth sur /admin/* et /api/admin/*

## 5. Vars obligatoires en prod
```
DATABASE_URL
ADMIN_TOKEN
VAULT_AUDIT_SALT
ADMIN_BASIC_USER
ADMIN_BASIC_PASS
```

## 6. Vars recommandées
```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
RAWDOCS_STORAGE=s3
RAWDOCS_S3_ENDPOINT / BUCKET / ACCESS_KEY / SECRET_KEY / REGION
EXPORT_MAX_ROWS=250000
APPROVE_CHUNK_SIZE=5000
SCAN_RATE_LIMIT=60
```

## 7. Ne jamais faire en prod
- `prisma migrate dev` (destructif en dev only)
- Exposer `entityName` sans `ALLOW_ENTITY_EXPORT=true`
