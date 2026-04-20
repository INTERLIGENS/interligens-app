# Security Center — runbook

Guide opérationnel. Lire pour : apprendre à utiliser le module, réagir à
un incident, brancher une nouvelle source, diagnostiquer un digest qui part
en vrille.

---

## 0. Première mise en service (à faire une fois)

1. **Snapshot Neon**
   Console → Branches → `ep-square-band` → `Create snapshot`.
   Label suggéré : `pre-security-center-YYYY-MM-DD`.

2. **Appliquer la migration**
   Ouvre Neon SQL Editor sur la branche principale.
   Colle le contenu de `prisma/migrations/manual_security_center/migration.sql`.
   Exécute. Vérifie les 11 lignes du SELECT final.

3. **Régénérer le client Prisma**
   ```bash
   npx prisma generate --schema=prisma/schema.prod.prisma
   ```

4. **Seed vendors + threats + Vercel breach**
   ```bash
   pnpm security:center:seed
   ```
   Idempotent — safe à relancer.

5. **Vérifier**
   ```bash
   pnpm security:center:check
   ```
   Tous les checks doivent passer.

6. **Redeploy**
   ```bash
   npx vercel --prod
   ```

7. **Ouvrir le Security Center**
   https://app.interligens.com/admin/security

---

## 1. Ajouter un vendor

1. Ouvre `src/lib/security/vendors/registry.ts`.
2. Ajoute une entrée dans `VENDOR_REGISTRY`. Champs clés :
   - `slug` (unique, kebab-case)
   - `name`, `category`
   - `statusPageUrl` → crée automatiquement un `SecuritySource` type=statuspage
   - `affects` → liste des asset-types touchés (sert à l'assessment)
3. Ajoute (si besoin) une entrée dans `VENDOR_SURFACE` dans
   `src/lib/security/assessment/rules.ts` pour que le moteur d'exposition
   sache décrire la surface de ce vendor.
4. Relance `pnpm security:center:seed`.
5. Commit + push + redeploy.

---

## 2. Brancher une nouvelle source (V2)

V1 : seul l'adapter `statuspage` est stubbé. Pour une vraie ingestion :

1. Crée `src/lib/security/ingestion/<sourceType>.ts` exportant
   `async function fetchIncidents(source: SecuritySource):
   Promise<IngestedIncident[]>`.
2. Écris vers `prisma.securityIncident` via `upsert` sur
   `(vendorId, externalId)` pour dédupliquer.
3. Lance depuis `/api/admin/security/vendors/:id/refresh` (à créer en V2)
   ou depuis un nouveau cron `/api/cron/security-pull-<sourceType>`.

---

## 3. Générer et envoyer un digest manuellement

```bash
# 1. Compose + persist
curl -X POST \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{}' \
  https://app.interligens.com/api/admin/security/digests/generate

# réponse : { digest: { id, subject, ... } }

# 2. Envoi via Resend
curl -X POST \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"digestId":"<id renvoyé par generate>"}' \
  https://app.interligens.com/api/admin/security/digests/send
```

Depuis l'admin UI : bouton "Generate" + "Send" sur `/admin/security` (V2).

---

## 4. Interpréter un exposureLevel

| Niveau | Interprétation | Action minimale |
|---|---|---|
| `none` | Aucun impact INTERLIGENS identifié | Aucune |
| `unlikely` | Vendor non-critique ou vendor inactif ; rien à rotater | Surveiller uniquement |
| `possible` | Vendor critique ET incident type secret-leaking → rotation recommandée | Rotation clés + log review |
| `probable` | Vendor critique + severity high+ ; présumé compromis | Rotation complète + access review + log review + brouillon statement |
| `confirmed` | Analyse post-mortem confirme une fuite réelle | Action publique ; post-mortem rédigé ; notification aux parties impactées |

Le moteur baseline `severity → exposure` est dans `src/lib/security/assessment/rules.ts::severityBaseline`. Toute override manuelle passe par
`POST /api/admin/security/incidents/:id/reassess` avec
`{ confirmedExposure: true, analystNote: "..." }`.

---

## 5. Réagir à un incident high / critical

1. **Minute 0** : ouvrir `/admin/security`. L'incident apparaît dans
   "Active incidents" avec `exposureLevel`.
2. **Check exposure** : cliquer l'incident, lire `INTERLIGENS exposure`.
   Si `requiresKeyRotation` → suivre §6 (rotation playbook).
3. **Generate comms** :
   ```
   POST /api/admin/security/incidents/:id/generate-comms
   ```
   → 3 brouillons (x + public_status + internal). Relire + ajuster.
4. **Si probable/confirmed** : cocher les action items au fur et à mesure
   (via DB direct ou UI V2). Le digest hebdo inclura l'incident.
5. **Post-mortem** : ajouter une `SecurityActionItem priority=p2 status=todo`
   avec titre "Write post-mortem for <incident>".

---

## 6. Playbook de rotation secrets (scenario Vercel breach 2026-04-19)

Ordre d'exécution (doit être complet avant redeploy) :

1. **Helius**
   Helius Dashboard → Projects → API Keys → Regenerate.
   Vercel env : `HELIUS_API_KEY` → update → save.
2. **Neon DATABASE_URL**
   Neon Console → Branches → ep-square-band → Reset password.
   Vercel env : `DATABASE_URL` + `DATABASE_URL_UNPOOLED` → update → save.
3. **ADMIN_TOKEN**
   Générer 64 char random (`openssl rand -hex 32`).
   Vercel env : `ADMIN_TOKEN` → update → save.
   Note : toutes les `admin_session` cookies existantes deviennent invalides
   après redeploy — le fondateur doit se reconnecter.
4. **ADMIN_BASIC_PASS**
   Même génération. Vercel env → update → save.
5. **CRON_SECRET**
   Même génération. Vercel env → update → save.
6. **RESEND_API_KEY**
   Resend Dashboard → API Keys → Revoke + Create new.
   Vercel env → update → save.
7. **R2 credentials**
   Cloudflare Dashboard → R2 → API Tokens → Create.
   Vercel env : `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` → update → save.
   Ancien token → Delete.
8. **Beta access codes** (si fuite confirmée)
   Neon SQL Editor :
   ```sql
   UPDATE "InvestigatorAccess"
   SET "accessCodeHash" = encode(digest('<new_code>', 'sha256'), 'hex'),
       "updatedAt" = NOW()
   WHERE label = '<LABEL>';
   ```

Puis :
```bash
npx vercel --prod
```

Enfin : créer / mettre à jour l'incident dans le Security Center avec le log
complet de la rotation dans `analystNote`.

---

## 7. Si le cron digest tombe

- Le handler est fail-soft : le row `SecurityWeeklyDigest` est créé avec
  `deliveryStatus=pending`, puis marqué `sent`/`failed`/`pending` selon le
  résultat Resend.
- **Pas de retry automatique V1.** Pour re-déclencher :
  ```
  POST /api/admin/security/digests/send
  { "digestId": "<id du digest failed>" }
  ```
- Vérifier `RESEND_API_KEY` n'est pas vide (cause n° 1 de
  `skipped: no_api_key`).
- Vérifier `DIGEST_TO_EMAIL` / `ALERT_EMAIL` est un email valide.

---

## 8. Suspicion de compromission réelle (post-breach investigation)

1. **Freeze** — rien à redéployer avant d'avoir snapshot + isolé l'incident.
2. **Snapshot Neon** (Console → Branches → Create snapshot, label
   `incident-<slug>-YYYY-MM-DDTHHMM`).
3. **Export audit log** : pull les 30 derniers jours de
   `IntelAuditLog`, `InvestigatorAuditLog`, `VaultAuditLog`.
4. **Neon access log** : `SELECT * FROM pg_stat_activity` + Neon Console
   → Connections → Last 30 days. Chercher IPs inconnues.
5. **Vercel audit log** : `vercel logs --prod --since 30d` +
   Dashboard → Settings → Audit Log.
6. **Cloudflare audit log** : Account → Audit Log.
7. **GitHub audit log** : Org → Settings → Audit Log (si collaborators +
   pushes suspects).
8. **Rotation complète** (§6) + redeploy.
9. **Post-mortem** : créer un incident Security Center avec severity=critical,
   exposureLevel=confirmed, checklist complète en action items.

---

## 9. Limites connues V1

- Pas d'ingestion auto (statusPage adapter stubbé, parsers vendor-spec en V2).
- Pas de webhook push (GitHub Security Advisories, Vercel webhooks — V2).
- Drift 1h sur le cron en hiver (CET vs CEST).
- UI pages `vendors` / `threats` / `digests` / `comms` détaillées → V2
  (seulement `overview` + `incidents` shippées avec polish V1).
- Pas de dédup auto entre plusieurs sources du même incident. Dédup manuel
  via `externalId` unique par vendor.
- Pas d'approval workflow multi-étape sur comms publiques (draft → legal
  → published). V1 : draft → admin click "approved".
