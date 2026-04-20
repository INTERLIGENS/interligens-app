# Security Center — architecture

## Contexte

Module admin INTERLIGENS qui centralise : veille vendor, registre d'incidents,
qualification d'exposition, digest email hebdomadaire, et brouillons de
communication. Admin-only. Aucune exposition retail.

---

## Data model

```
SecurityVendor ── (*)SecuritySource
       │
       └── (*)SecurityIncident ── (*)SecurityExposureAssessment
                      │             └── affectedSurface (Json)
                      │             └── actionChecklist   (Json)
                      ├── (*)SecurityActionItem
                      └── (*)SecurityCommsDraft

SecurityAsset ── (*)SecurityVendorExposureLink ── (*)SecurityVendor
SecurityWeeklyDigest     (standalone)
SecurityThreatCatalog    (standalone)
SecurityAuditLog         (standalone, append-only)
```

Tous les modèles sont additifs (cf `prisma/schema.prod.prisma` + migration SQL
`prisma/migrations/manual_security_center/migration.sql`). Aucune colonne
existante modifiée, aucune donnée touchée.

---

## Flux principaux

### Incident → assessment → comms

```
 event ingested (statuspage poll OR manual form OR webhook)
   │
   ▼
 SecurityIncident.create(vendorId, severity, type, …)
   │
   ▼  (automatic on POST with runAssessment=true)
 assessExposure(incident, vendor)  [lib/security/assessment/rules.ts]
   │
   ▼
 SecurityExposureAssessment.create(exposureLevel, affectedSurface, flags, checklist)
   │
   ▼  (admin click "Generate comms" in UI)
 buildDraftSet(incident, exposure)  [lib/security/comms/drafts.ts]
   │
   ▼
 SecurityCommsDraft × 3  (x | public_status | internal)
```

### Weekly digest

```
 Vercel cron "0 8 * * 1"  →  GET /api/cron/security-weekly-digest  (CRON_SECRET)
   │
   ▼
 buildDigestInputForPeriod(now-7d, now)  [lib/security/queries.ts]
   │
   ▼
 buildDigest(input)  [lib/security/email/digest.ts]
   │
   ▼
 SecurityWeeklyDigest.create(status=pending)
   │
   ▼
 sendDigest(resp) via Resend
   │
   ▼
 SecurityWeeklyDigest.update(status=sent|failed, deliveryMeta)
```

---

## Layers

### `src/lib/security/`

| Module | Responsibility |
|---|---|
| `vendors/registry.ts` | Static list of vendors (source of truth for seed). 14 entries V1. |
| `threats/catalog.ts` | Static threat catalog (17 entries). |
| `assessment/rules.ts` | Pure function `assessExposure()` — deterministic on (incident, vendor). Tested. |
| `comms/drafts.ts` | Pure function `buildDraftSet()` + 3 single-channel builders. No LLM — deterministic. |
| `email/digest.ts` | `buildDigest()` (pure) + `sendDigest()` (Resend wrapper, fail-soft). |
| `queries.ts` | Read-side helpers for server components + API routes. |
| `ingestion/` | V2 — status-page / RSS parsers (stub in V1). |

### Admin UI

| Route | Role |
|---|---|
| `/admin/security` | Overview dashboard (hero, metrics, incidents, vendors, actions, digest, threats). |
| `/admin/security/incidents` | Flat list. |
| `/admin/security/incidents/[id]` | Detail + assessment + actions + comms drafts. |

### Admin API

Toutes gatées par `requireAdminApi()` (cookie `admin_session` OR `x-admin-token`).

| Route | Method | Role |
|---|---|---|
| `/api/admin/security/overview` | GET | Agrégat hero |
| `/api/admin/security/incidents` | GET / POST | Liste / création |
| `/api/admin/security/incidents/:id/reassess` | POST | Refait l'évaluation |
| `/api/admin/security/incidents/:id/generate-comms` | POST | Crée 3 brouillons |
| `/api/admin/security/vendors` | GET | Watchlist |
| `/api/admin/security/threats` | GET | Catalogue |
| `/api/admin/security/digests/generate` | POST | Compose + persist digest |
| `/api/admin/security/digests/send` | POST | Envoi via Resend |

### Cron

| Route | Schedule | Gate |
|---|---|---|
| `/api/cron/security-weekly-digest` | `0 8 * * 1` (lundi 08:00 UTC) | `CRON_SECRET` bearer ou `x-cron-secret` |

### Ingestion V1

V1 : uniquement l'adapter **statuspage générique** (`ingestion/statusPage.ts`
— stubbed, prêt pour V2). Les incidents se créent sur action admin
(`POST /api/admin/security/incidents`) ou par le seed script. Aucune
tentative de polling automatique avant V2.

---

## Sécurité du module

- **RBAC** — toutes les pages sous `/admin/security/**` passent par le
  middleware `/admin/*` qui exige `admin_session`. Toutes les API passent
  par `requireAdminApi`. Aucun chemin public.
- **Pas de secrets en DB** — `SecurityExposureAssessment.affectedSurface`
  peut contenir une liste de NOMS de variables (ex. `RESEND_API_KEY`) mais
  jamais de valeurs. Le seed script respecte ce contrat.
- **Audit** — `SecurityAuditLog` est en place mais V1 n'écrit pas
  systématiquement (pas de bloquant : `IntelAuditLog` / `InvestigatorAuditLog`
  couvrent la surface admin générique). V2 : écrire sur chaque
  mutation Security Center.
- **Fail-soft** — `sendDigest` et toutes les API `/api/admin/security/*`
  catchent + loggent sans propager. La page admin affiche la bannière
  "migration pending" si le schema n'est pas encore appliqué.

---

## Choix techniques documentés

### Rule engine pure
`assessExposure()` ne fait aucune I/O. Toutes les données vendor vivent dans
le registre TS. Tests déterministes. Réutilisable côté cron, côté API, côté
seed.

### Drafts sans LLM
V1 : templates factuels. Prévisible, testable, sans risque d'hallucination
sur un message publiable. V2 : opt-in LLM via flag `useLLM=true` sur le
endpoint `generate-comms`.

### Email via Resend
Réutilise le même provider que `weeklyDigest.ts` et `kolAlert.ts`. Fail-soft
si `RESEND_API_KEY` absente.

### Cron en UTC
Vercel ne supporte pas les timezones nommés. `0 8 * * 1` = lundi 08:00 UTC =
10:00 CEST (été) / 09:00 CET (hiver). Drift 1h documenté. V2 : double-cron
`0 8 * * 1` + `0 9 * * 1` avec filtre horaire côté handler pour locker
précisément sur 10:00 Paris.

### Migration manuelle
Le projet a une règle stable : "migrations via Neon SQL Editor". On produit
un SQL idempotent avec BEGIN/COMMIT + IF NOT EXISTS que Dood colle après un
snapshot Neon. Aucun `prisma db push`. Aucun `prisma migrate dev` contre
prod (pgbouncer refuse le shadow DB de toute façon).
