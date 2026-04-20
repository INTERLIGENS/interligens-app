# Security Center — audit pré-implémentation

**Date** : 2026-04-20
**Branche** : `main @ 50d1811`
**Portée** : inventaire de l'existant avant d'implémenter un module Security
Center dans l'admin.

---

## 1. État actuel (réutilisable)

### Auth admin (`src/lib/security/adminAuth.ts`)
- `requireAdminApi(req)` — gate API → 401 JSON si pas valide.
- `requireAdminCookie(req)` — gate page → redirect `/admin/login`.
- `isAdminSessionFromCookies()` — flavour server-component (sans req).
- Cookies : `admin_session` (HMAC-SHA256 signé via `ADMIN_TOKEN`), `admin_token`
  (httpOnly 8h).
- Env : `ADMIN_BASIC_PASS`, `ADMIN_BASIC_USER`, `ADMIN_TOKEN`.
- Middleware gate `/admin/*` + `/api/admin/*` (cf `src/middleware.ts`).

### Design admin (`src/app/admin/**`)
- Layout racine `src/app/admin/layout.tsx` + sidebar
  `src/components/admin/AdminSidebar.tsx`.
- Tokens : bg `#000000`, text `#FFFFFF`, accent `#FF6B00`. Styles inline
  CSS-in-JS (pas de design library).
- Sous-composants stats : `MetricCard`, `ModuleHealthCard`, `AlertRow`,
  `StatusPill` (`src/components/admin/stats/*`) — réutilisables.
- Pages existantes : `/admin/stats`, `/admin/alerts`, `/admin/documents`,
  `/admin/equity`, `/admin/intel-vault`, etc.

### Email — Resend
- Helpers : `src/lib/email/weeklyDigest.ts`, `src/lib/email/betaWelcome.ts`,
  `src/lib/alerts/kolAlert.ts`, `src/lib/surveillance/alerts/deliverAlerts.ts`.
- Env : `RESEND_API_KEY`, `ALERT_EMAIL`, `ALERT_FROM_EMAIL`, `DIGEST_TO_EMAIL`,
  `DIGEST_FROM_EMAIL`.
- Pattern fail-soft : retourne `{delivered:false, skipped:"no_api_key"}` si
  clé manquante, ne throw jamais.

### Cron Vercel
- 14 crons dans `vercel.json` (`crons: [{path, schedule}, ...]`).
- Gate : `CRON_SECRET` via `x-cron-secret` header ou `Authorization: Bearer`,
  timing-safe compare. Pattern dans
  `src/app/api/cron/alerts/deliver/route.ts`.
- Runtime Node.js, `dynamic: "force-dynamic"`, `maxDuration: 60-300s`.
- Le cron existant `/api/cron/weekly-digest` (`0 8 * * 1` = lundi 08:00 UTC)
  est le plus proche du besoin — on s'aligne dessus (voir §3).

### Audit / logs Prisma existants
- `AuditLog` (générique ingestion), `IntelAuditLog` (actor/action/target —
  suffisamment riche pour être réutilisé), `InvestigatorAuditLog`.
- `AlertSubscription` + `AlertDelivery` (déjà en place pour alertes
  watchlist KOL — PAS pour incidents vendor).

### Vendors intégrés
| Vendor | Status | Gate |
|---|---|---|
| Neon Postgres | live | `DATABASE_URL*` |
| Cloudflare R2 | live | `R2_*` |
| Helius | live | `HELIUS_API_KEY` |
| Etherscan / BscScan | live | `*SCAN_API_KEY` |
| Resend | live | `RESEND_API_KEY` |
| Upstash (Redis) | live | `KV_*` |
| Vercel | live (infra) | n/a |
| X/Twitter | live | `X_*` |
| Anthropic | live | `ANTHROPIC_API_KEY` |
| Telegram / Discord | webhooks | bot tokens |
| GitHub | dormant (aucune intégration directe) | — |
| Arkham / Birdeye | dormant (seed scripts only) | — |

### Surfaces de menace identifiées
1. Signed URLs R2 (PDF + RAW docs) — `src/lib/storage/*`
2. Prisma → Neon pool — risk : SQL injection si queries non-param.
3. Webhooks inbound : `/api/telegram/webhook`, Discord, Google Apps Script.
4. Credentials dans env Vercel — surface du breach du 19/04/2026.
5. Admin cookie HMAC — clé = `ADMIN_TOKEN` ; rotation requise à chaque
   fuite suspectée (déjà faite ce soir).
6. Investigator vault — session cookie + métaKey client-side.
7. Cron endpoints — gate `CRON_SECRET` ; secret fuité = faux cron.
8. `/api/scan/*` — public, rate-limité côté Upstash.
9. R2 PDF — accès via signed URL, TTL configurable.
10. Admin `requireAdminApi` reposé sur `ADMIN_TOKEN` — même rotation.

### RBAC
- Granularité binaire : admin OU investigator OU public. Pas de rôles
  internes fins (pas de "security officer" spécifique).
- Fondateur bypass via `admin_session` sur `/investigators/box`.

---

## 2. Gaps pour Security Center

### Modèles Prisma manquants (tous à créer)
- `SecurityVendor` — registre de vendors surveillés
- `SecuritySource` — sources d'ingestion (status pages, RSS, advisory DB)
- `SecurityIncident` — incidents consolidés
- `SecurityExposureAssessment` — qualification INTERLIGENS par incident
- `SecurityAsset` — actifs INTERLIGENS (Vercel project, R2 bucket, …)
- `SecurityVendorExposureLink` — mapping vendor ↔ asset
- `SecurityActionItem` — TODO list opérationnelle
- `SecurityWeeklyDigest` — archive des digests envoyés
- `SecurityThreatCatalog` — catalogue de menaces prérempli INTERLIGENS
- `SecurityCommsDraft` — brouillons communication X / public / interne
- `SecurityAuditLog` — journal module sécurité dédié

### Ingestion manquante
- Aucun parser status-page / advisory DB déployé aujourd'hui.
- Pas de webhook vendor (Vercel / GitHub) branché.
- Pas de planif pour pull périodique status-pages.

### UI manquante
- `/admin/security/**` — inexistant.
- Sidebar ne mentionne pas Security Center (à étendre).

### Email digest
- Template Security Center — inexistant. Pattern à calquer sur
  `src/lib/email/weeklyDigest.ts` (Resend + HTML + fail-soft).
- Cron dédié — absent (on en ajoute un).

---

## 3. Dette critique & risques prioritaires

1. **Breach Vercel 2026-04-19** (ShinyHunters / BreachForums / $2M) — rotation
   secrets faite ce soir (Helius, Neon password reset, ADMIN_TOKEN,
   ADMIN_BASIC_PASS, beta access code `dood-test` → `sha256(TIGRE2026)` via
   Neon SQL Editor, redeploy prod). Upstash ignoré (marketplace inactif).
   Birdeye + Arkham : pas en prod. **Premier incident seedé dans le registre
   comme template de référence.**
2. **Pas de veille automatisée** des status pages — aujourd'hui purement
   ad-hoc (Twitter / RSS perso).
3. **Pas d'inventaire assets vs vendors** — impossible de scorer l'exposition
   rapidement quand un breach tombe.
4. **Pas de digest hebdo** — la visibilité sur le risque n'existe qu'au
   moment de l'incident.
5. **Pas de brouillons de comms** — risque de latence / message incohérent
   en cas d'incident sérieux.

---

## 4. Ce qu'on implémente maintenant (V1)

### A. Data model (11 modèles Prisma)
Ajouts additifs dans `prisma/schema.prod.prisma` + SQL migration
`prisma/migrations/manual_security_center/migration.sql`. **Non exécutée par
le CLI** — pasteable dans Neon SQL Editor après snapshot (règle projet :
migrations via Neon Console, jamais `db push --accept-data-loss`).

### B. Libs (`src/lib/security/`)
- `vendors/registry.ts` — 12 vendors V1 seedés (Vercel / Cloudflare / Neon /
  GitHub / npm / Prisma / Next.js / X / R2 / Resend / Anthropic / Helius /
  Etherscan / Upstash).
- `threats/catalog.ts` — 17 menaces INTERLIGENS prérempli.
- `assessment/rules.ts` — moteur déterministe mapping vendor → surface
  exposée + checklist + flags (rotate keys / access review / log review /
  public statement).
- `ingestion/statusPage.ts` — adapter status-page Statuspage.io (format
  `/api/v2/incidents.json`). Les autres sources (RSS, GitHub Advisory DB)
  sont documentées mais pas parsées en V1.
- `comms/drafts.ts` — générateur de brouillons X / public / interne avec
  ton factuel.
- `email/digest.ts` — compositeur digest hebdo (Resend, sujet INTERLIGENS —
  Security Digest hebdo — {date}).

### C. Routes admin (`src/app/admin/security/**`)
- `/admin/security` — overview complet (hero, vendors, incidents, exposure,
  digest status, threats, comms).
- `/admin/security/incidents` — liste + détail incident.
- Autres routes (`vendors`, `threats`, `digests`, `comms`) : stub minimal
  renvoyant vers les datasets existants (itération V2).

### D. APIs (`src/app/api/admin/security/**`)
Toutes gatées via `requireAdminApi` :
- GET `/overview` — agrégat hero + listes
- GET `/incidents` — liste avec filtres
- POST `/incidents/:id/reassess` — re-scoring exposition
- POST `/incidents/:id/generate-comms` — 3 brouillons
- GET `/vendors`
- POST `/vendors/:id/refresh` — pull status page
- POST `/refresh-all` — pull toutes les status pages
- POST `/digests/generate` — compose digest
- POST `/digests/send` — envoi via Resend
- GET `/threats`

### E. Cron hebdo
- `/api/cron/security-weekly-digest` gatée via `CRON_SECRET`.
- `vercel.json` : schedule `0 8 * * 1`.
  - **Timezone note** : Vercel cron n'expose pas les timezones. 08:00 UTC =
    10:00 Europe/Paris en été (CEST) et 09:00 en hiver (CET). On documente
    le drift. Alternative (non V1) : cron à 08 + 09 UTC avec filtre horaire
    côté handler.

### F. Seed (`scripts/seed/securityCenter.ts`)
- 12 vendors
- Sources officielles mappées aux vendors
- 17 menaces catalogue
- **Incident #1 Vercel 2026-04-19** avec assessment + 7 action items
  (toutes "done" sauf la rédaction du statement public → "todo") + draft X
  généré.

### G. Tests
- `src/lib/security/assessment/rules.test.ts`
- `src/lib/security/email/digest.test.ts`
- `src/lib/security/comms/drafts.test.ts`
- `src/lib/security/vendors/registry.test.ts`

### H. Script de check
- `pnpm security:center:check` — migration OK, vendors seedés, digest
  générable, template email OK, routes sécurisées (smoke).

### I. Docs
- `docs/security-center-audit.md` (ce fichier)
- `docs/security-center-architecture.md`
- `docs/security-center-runbook.md`

---

## 5. Ce qu'on reporte explicitement en V2

1. **Parsers RSS/Atom pour chaque vendor**. V1 : adapter Statuspage.io
   générique seulement. Les feeds type GitHub Advisory (GraphQL),
   blog Vercel, security.nextjs.org → V2.
2. **Webhooks push vendor → INTERLIGENS**. V1 : pull périodique uniquement.
3. **UI complète pour `vendors`, `threats`, `digests`, `comms`** — V1 ship
   des listes minimales, le gros travail UI part en V2.
4. **Role granularity fine** (security officer distinct d'admin générique) —
   V1 reste binaire admin/non-admin.
5. **Deduplication automatique d'incidents** (même CVE sur 3 sources).
   V1 : slug unique par `(vendorId, externalId)` + dédup manuel.
6. **Approval workflow pour comms publiques** (dev → security → legal →
   publish). V1 : brouillons stockés, admin marque "approved" en 1 clic.
7. **Timezone-aware cron** (précisément 10h Europe/Paris toute l'année).
   V1 : 08:00 UTC, drift 1h accepté en hiver.
8. **Retry / backoff** sur envoi email digest. V1 : un shot, log l'échec
   dans `SecurityWeeklyDigest.deliveryStatus=failed` + metadata.

---

## 6. Choix techniques documentés

### Pourquoi SQL manuel via Neon Console (pas `prisma migrate dev`)
- Règle projet (CLAUDE.md + memory) : *"Schema : `prisma/schema.prod.prisma` —
  TOUJOURS additif, jamais destructif"*, *"migrations via Neon SQL Editor"*.
- `prisma migrate dev` + pooler 6543 = instable (shadow DB refusée via
  pgbouncer). Le DB URL pooled est la seule fournie côté dev.
- `prisma migrate deploy` n'accepte pas de créer le fichier — il l'applique
  seulement. On écrit le SQL à la main, pour review + snapshot + paste.
- **Snapshot Neon requis AVANT paste** (Console → Branches → Snapshot).

### Pourquoi Resend
- Déjà câblé (`RESEND_API_KEY`, helpers existants). Pas d'ajout de
  dépendance.

### Pourquoi 08:00 UTC lundi
- Matche le cron `weekly-digest` existant → cohérent opérationnellement.
- Drift CET/CEST documenté — acceptable pour V1.

### Pourquoi pas de webhook vendor en V1
- Coût : chaque vendor = nouveau endpoint + secret + validation signature.
- Valeur marginale vs pull status-page : low pour V1 (incidents arrivent à
  la minute vs à l'heure).

---

**Verdict** : V1 livrable fait confiance à l'existant (auth admin, Resend,
cron, Prisma) et ajoute la data layer + moteur d'évaluation + seeds +
premier incident + UI overview. V2 complétera les parsers, la granularité
UI et les workflows d'approbation.
