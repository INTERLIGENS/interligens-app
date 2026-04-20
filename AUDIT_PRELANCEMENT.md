# AUDIT PRÉ-LANCEMENT — INTERLIGENS

**Date** : 2026-04-20
**Branche** : `main` (HEAD `f5d1582` — *Merge investigators finalisation sprint pre-audit*)
**Build prod** : `pnpm build` — ✓ exit 0
**Typecheck** : `pnpm tsc --noEmit` — ✓ exit 0 (après purge `.next`)
**Tests** : 645 passed / 4 failed / 649 total — 2 fichiers en échec
**Portée** : audit seulement, aucune correction appliquée.

---

## 🔴 CRITIQUE — à traiter avant lancement

### 1. Tests d'intégration admin — 2 échecs persistants (DB creds non chargés)

```
src/app/api/admin/__tests__/adminRoutes.integration.test.ts
  ✗ GET /api/admin/sources — returns 200 with valid x-admin-token
  ✗ GET /api/admin/submissions — passes auth with valid token
→ Authentication failed against ep-square-band-ag2lxpz8-pooler.c-2.eu-central-1.aws.neon.tech
  provided database credentials for `(not available)` are not valid
```

Reconduit de l'audit du 2026-04-19. L'env de test ne charge pas `DATABASE_URL`.
À décider : test DB séparée, ou mocks, ou skip conditionnel. Non bloquant pour
le build prod Vercel (build passe), **bloquant pour CI local** si on veut un
signal test vert.

### 2. Tests copy Verdict — 2 échecs persistants (assertions désynchronisées)

```
src/lib/copy/verdictCopy.test.ts
  ✗ GREEN FR — subtitle sans alerte + actions safe
  ✗ ORANGE EN — subtitle suspicious + actions cautious
```

Le copywriting a évolué, les tests n'ont pas été resynchronisés. Risque de
régression silencieuse du copy public — les tests n'attrapent plus ce qu'ils
devraient attraper.

---

## 🟠 IMPORTANT — à reprendre rapidement

### 3. Couverture auth des routes API — 40 routes hors du pattern étroit

`find src/app/api -name "route.ts" | xargs grep -L "requireAdmin|validateSession|CRON_SECRET"` → 40 fichiers.

Élargi à `getVaultWorkspace|getVaultAccess|getInvestigatorSessionContext|assertCaseOwnership|enforceInvestigatorAccess|isAdminRequest|checkRateLimit|requireAdminToken|LEGAL_ACCESS_TOKEN` → toujours 40. **Classification manuelle** :

**Publiques légitimes (pas d'auth attendue)** — 32 routes :
- `/api/health`, `/api/mock/scan`
- `/api/v1/kol`, `/api/v1/kol/[handle]`
- `/api/kol/*` (leaderboard, [handle], pedigree, proceeds, cashout, wallet-history, class-action)
- `/api/scan/*` (cluster, grounding, resolve, label, solana/graph)
- `/api/solana/holders`, `/api/explorer`, `/api/labels`, `/api/pdf/kol`
- `/api/token/*`, `/api/cluster/*`, `/api/laundry/*`, `/api/coordination/*`
- `/api/resolve/hyper-token`, `/api/transparency/*`, `/api/evidence/snapshots`
- `/api/investigators/apply`, `/directory`, `/legal/doc`
- `/api/beta/auth/logout`, `/api/admin/auth/logout` (cookie clear)

**Admin avec pattern custom (auth OK mais hors grep)** — 6 routes :
- `/api/admin/kol/network` — bearer `ADMIN_TOKEN`
- `/api/admin/kol/publishability` — bearer `ADMIN_TOKEN`
- `/api/admin/kol/[handle]/proceeds` — Basic `ADMIN_BASIC_*`
- `/api/admin/kol/[handle]/proceeds/status` — Basic `ADMIN_BASIC_*`
- `/api/auth/admin-check` — check dédié
- `/api/casefile` — voir point §4 (V0 hardcoded)

**Routes à revoir** — 2 routes :
- `/api/scan/cluster` — public ? rate limit ?
- `/api/scan/label` — public ? rate limit ?

Action proposée : uniformiser les 6 routes admin vers un `requireAdmin()` unique,
et confirmer (ou ajouter rate limit) sur les 2 routes scan restantes.

### 4. `casefile/route.ts` — `CaseDB hardcoded (V0 — no fs dependency)`

```
src/app/api/casefile/route.ts:7:// ── CaseDB hardcoded (V0 — no fs dependency) ──
```

Reconduit de l'audit précédent. Vérifier si cette route est encore servie en
prod ou dead code. Si servie : planifier migration DB. Si dead : supprimer.

### 5. 10 pages FR manquantes (parité EN vs FR cassée)

```
MANQUANT FR: src/app/fr/victim/report/page.tsx
MANQUANT FR: src/app/fr/victim/page.tsx
MANQUANT FR: src/app/fr/explorer/[caseId]/page.tsx
MANQUANT FR: src/app/fr/kol/[handle]/class-action/page.tsx
MANQUANT FR: src/app/fr/news/page.tsx
MANQUANT FR: src/app/fr/investigator/page.tsx
MANQUANT FR: src/app/fr/investigator/login/page.tsx
MANQUANT FR: src/app/fr/dataroom/score/page.tsx
MANQUANT FR: src/app/fr/watchlist/signals/[id]/page.tsx
MANQUANT FR: src/app/fr/investors/page.tsx
```

Identique à l'audit précédent. Si le lancement est FR+EN, à combler. Sinon,
retirer du sitemap FR pour ne pas promettre des URLs qui 404.

---

## 🟢 MINEUR — à planifier

### 6. TODO fonctionnels restants — 4 lignes réelles

```
src/app/api/investigators/nda/accept/route.ts:118:
  // TODO: send NDA confirmation email via Resend once the template is ready.
src/app/api/admin/investigators/applications/[id]/review/route.ts:76:
  // TODO: send invite email via Resend once the investigator email template is ready.
src/app/api/kol/[handle]/pdf-legal/route.ts:50:
  // TODO Sprint 6 : persister en DB table LegalPdfAccess
src/app/api/kol/[handle]/pdf-legal/route.ts:104:
  reportId: `INTL-MN0LVDFO-KOL`, // TODO : dynamic per handle
```

Impact fonctionnel :
- NDA sign → pas d'email de confirmation (logue seulement).
- Application approved → pas d'email d'invitation (logue seulement).
- PDF legal → pas de trace DB par accès, `reportId` identique pour tous les KOLs.

Aucun ne masque à l'utilisateur qu'il manque quelque chose (les endpoints
retournent `success` sans prétendre avoir envoyé l'email). Déferrable.

### 7. Aucune fuite de secret détectée (reconduit)

`grep "sk-ant|DATABASE_URL|HELIUS" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env"` → 32 lignes.

Toutes sont :
- URLs construites à partir de `process.env.HELIUS_*` via des variables locales (`HELIUS_KEY`, `HELIUS_RPC`, `HELIUS_API_KEY`, `HELIUS_META`, `HELIUS_API`, `HELIUS_BASE`) — la regex `| grep -v process.env` ne capture pas l'indirection.
- Messages d'erreur explicatifs (`"HELIUS_API_KEY not configured"`, `"Missing HELIUS_API_KEY"`, `"Relancez l'analyse avec HELIUS_API_KEY configuré"`).
- `src/lib/vault/complianceEnvKeys.ts` — liste de **noms** de clés d'env (pour audit compliance), pas de valeurs.
- `src/lib/config/env.ts` — `requireInProd("DATABASE_URL")` helper.
- `src/lib/admin/stats.ts` — instruction d'action (`"Check Neon connection (ep-square-band) and DATABASE_URL."`).

Aucun secret hardcodé.

### 8. Warning Prisma en test (non bloquant)

Les 2 tests admin qui échouent (§1) lèvent un warning auth Neon mais n'affectent
pas le build prod Vercel. À surveiller si un runtime prod dépend du même
credential manquant.

---

## Synthèse

| Catégorie          | État | Note |
|--------------------|------|------|
| Build prod         | ✓    | 220/220 pages compilées |
| Typecheck          | ✓    | 0 erreur après purge `.next` |
| Tests              | ⚠    | 645/649 (4 failed, reconduits) |
| IDOR investigators | ✓    | activity / terms / nda/accept corrigés |
| Auth API           | ⚠    | 2 routes `scan/*` à confirmer |
| FR coverage        | ⚠    | -10 pages vs EN |
| Secrets            | ✓    | 0 fuite |
| Dead code          | ⚠    | `/api/casefile` V0 hardcoded |
| TODO réels         | 4    | 2 emails Resend, 2 PDF legal persistence |

### Écart depuis l'audit 2026-04-19

**Résolu** :
- IDOR `/api/investigators/activity` — corrigé (commit `423cb0d`)
- IDOR `/api/investigators/terms/accept` — corrigé (commit `423cb0d`)
- IDOR `/api/investigators/nda/accept` — corrigé (commit `923f27b`)
- 51 erreurs TS cache stale — résolues après purge `.next`
- Admin founder redirect → `/investigators/dashboard` 404 — corrigé (commit `dd15fdd`)

**Reconduit** :
- Tests admin intégration (§1)
- Tests copy verdict (§2)
- 40 routes hors pattern auth étroit, majoritairement public by design (§3)
- Pages FR manquantes x10 (§5)
- Dead code `casefile/route.ts` V0 (§4)
- TODO emails + PDF legal persistence (§6)

### Recommandation

**Acceptable pour lancement** sous réserve de :
1. **§1 + §2 tests** — décision produit : corriger ou marquer comme known-issue.
2. **§3 routes scan** — 5 minutes pour confirmer ou ajouter rate limit.
3. **§5 pages FR** — décision produit : produire les 10 pages ou désactiver le FR.

Le périmètre Investigators est sain (audit dédié dans `INVESTIGATORS_FINALISATION_AUDIT.md`).
Le périmètre public (scan / kol / explorer) fonctionne mais garde des zones à
clarifier sur l'auth.
