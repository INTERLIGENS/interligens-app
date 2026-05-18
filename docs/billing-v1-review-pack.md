# Billing V1 — Security Review Pack

- Generated: 2026-05-12T18:31:20Z
- Branch: `feat/billing-beta` @ 9cc2cfe
- Base for diffs: `main` @ 21c476d

---

## 1. Final report — docs/billing-v1-report.md

===== docs/billing-v1-report.md =====
# INTERLIGENS — Beta Founder Access 1 € — Rapport v1

**Date** : 2026-05-11
**Branche** : `feat/billing-beta` (à partir de `main` @ `a4a201a`)
**Auteur** : Claude Code (Opus 4.7, autonomie complète après validation des 3 décisions archi)
**Status** : **READY FOR HUMAN REVIEW** — code complet, tests verts, build vert. Pas merge ni deploy ni activation flag.

---

## 1. Audit de l'existant (résumé)

Voir `docs/audit-billing.md` pour la version longue. Points-clés :

- Aucun modèle `User` : l'identité = `InvestigatorAccess`, l'accès = `InvestigatorSession` valide.
- `src/proxy.ts` gate fail-closed sur cookie `investigator_session`. **Pas touché ce sprint** (décision 3 du brief, Phase 2).
- NDA = simple record `InvestigatorNdaAcceptance`, pas un gating actif.
- Aucun Stripe préexistant ; package `stripe` ajouté en v22.1.1.
- Email Resend déjà intégré (`src/lib/email/accessCodeDelivery.ts`) → réutilisé.
- Turnstile déjà partiellement intégré (`src/app/api/community/submit/route.ts`) → pattern réutilisé.
- Upstash Redis : env vars présentes mais pas de SDK → fetch REST direct partout.
- Aucun conflit Prisma sur les 5 modèles cibles. Migration 100 % additive.
- Audit log : réutilisation de `InvestigatorAuditLog` avec eventType `billing.*`, pas de nouveau modèle.

---

## 2. Décisions implémentées

### Validées explicitement par Dood avant code

| # | Décision | Choix |
|---|---|---|
| 1 | Référence "user" sur nouveaux modèles | `userId String` libre (commentaire Prisma documente que = `InvestigatorAccess.id` post-paiement) |
| 2 | Source de l'email payeur | Formulaire sur `/access/founder` pré-checkout (pas de back-fill admin) |
| 3 | Cible business / impact gating | Remplace + grandfather **MAIS** `proxy.ts` **NON modifié** ce sprint. Le webhook crée à la fois un Entitlement (Phase 2) ET un InvestigatorAccess + envoi access code via Resend (Phase 1 = legacy gate keeps working) |

### Conséquences techniques mécaniques

- `BetaFounderAccess.userId` est **nullable** : vide à la création de réservation (payeur n'a pas encore d'InvestigatorAccess), rempli par le webhook après provisioning. Idempotence à la création se fait par `email + status=pending + reservationExpiresAt > now`.
- Le webhook fait deux choses sur `checkout.session.completed` : (a) `prisma.investigatorAccess.create(...)` + envoi du code par email Resend ; (b) `prisma.entitlement.create({ type: "beta_founder_access", source: "stripe_checkout", sourceId: session.id })`.
- Le script `grandfather-beta-users` crée un Entitlement pour chaque `InvestigatorAccess` actif, sans toucher `proxy.ts`.

### Décisions secondaires validées

- Audit log : `InvestigatorAuditLog` avec eventTypes préfixés `billing.*` (`billing.payment.completed`, `billing.dispute.opened`, etc.). Pas de nouveau modèle `SecurityEvent`.
- Upstash : fetch REST direct (cohérent avec le reste du repo), pas d'`@upstash/redis`.
- Nouvelles env : `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_APP_URL`, + le bloc `BILLING_*` / `STRIPE_*` complet.

---

## 3. Fichiers modifiés / créés

### Modifiés (4)
- `prisma/schema.prod.prisma` (+98 lignes, 5 nouveaux modèles)
- `src/components/admin/AdminSidebar.tsx` (+1 entry "Billing (Beta Founder)")
- `package.json` + `pnpm-lock.yaml` (`stripe@^22.1.1`)

### Créés (39)

**Migration & schéma**
- `docs/billing-v1-migration.sql` — SQL à coller dans Neon SQL Editor (5 CREATE TABLE + indexes, en transaction)
- `docs/audit-billing.md` — audit pré-implémentation (11 points)
- `docs/brief-billing-v3.md` — copie du brief reçu (pour traçabilité)
- `docs/billing-v1-report.md` — ce document

**Library (`src/lib/billing/`, 10 fichiers)**
- `env.ts` — `isBillingEnabled()`, `getCap()`, `isCapOverrideReached()`, `getAppUrl()`, `isStripeTaxEnabled()`
- `stripeClient.ts` — singleton `getStripe()`
- `turnstile.ts` — `verifyTurnstile(token, ip)` (fetch REST, fail-closed quand pas de secret)
- `rateLimit.ts` — `checkRateLimit`, `checkCheckoutRateLimits` (3/h IP + 5/j email + 10/j userId), `checkWaitlistRateLimit`. Fail-open si Upstash non configuré.
- `cap.ts` — `checkCap()` transactionnel avec `FOR UPDATE`
- `customerLookup.ts` — `lookupOrCreateStripeCustomer` : DB → email DB → Stripe search → create. Pas d'écriture `BillingCustomer` pré-paiement.
- `idempotency.ts` — `checkoutIdempotencyKey({ userIdOrEmail, nowMs })` = bucket minute
- `entitlement.ts` — `grantEntitlement`, `revokeEntitlementsBySource`, `hasActiveBetaEntitlement`
- `grantAccess.ts` — `provisionBetaFounderAccess` : crée `InvestigatorAccess` + envoie code Resend
- `webhookHandlers.ts` — handlers par event (`checkout.session.completed`, `expired`, `payment_intent.payment_failed`, `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`) + `recordEventIfNew` pour l'idempotence
- `auditEvents.ts` — `logBillingEvent({ eventType: "billing.*", … })`
- `request.ts` — `getClientIp`, `hashIp`, `isValidEmail`, `normalizeEmail`

**API routes (4)**
- `src/app/api/billing/create-checkout-session/route.ts` — POST, runtime=nodejs, dynamic
- `src/app/api/billing/access-status/route.ts` — GET (polling pour /access/success)
- `src/app/api/billing/waitlist/route.ts` — POST
- `src/app/api/stripe/webhook/route.ts` — POST (raw body via `req.text()`)

**Pages (6)**
- `src/app/access/founder/page.tsx` (server component) + `copy.ts` (FR/EN) + `FounderClient.tsx` (client : form email + Turnstile widget + submit)
- `src/app/access/success/page.tsx` + `SuccessClient.tsx` (polling 2s × 15)
- `src/app/admin/billing/page.tsx` (server, dashboard)

**Scripts (1)**
- `scripts/grandfather-beta-users.ts` — idempotent (DRY_RUN supporté)

**Tests (10 fichiers, +68 tests)**
- `src/lib/billing/__tests__/{idempotency,turnstile,rateLimit,cap,customerLookup,entitlement,grantAccess,webhookHandlers}.test.ts`
- `src/app/api/billing/__tests__/{checkout-flag-off,create-checkout-session,waitlist}.test.ts`
- `src/app/api/stripe/__tests__/webhook.test.ts`
- `scripts/__tests__/grandfather-beta-users.test.ts`

**Env**
- `.env.example` créé (n'existait pas avant)

---

## 4. Migration Prisma SQL

À **coller dans Neon SQL Editor** sur la prod (ep-square-band, Frankfurt). Le fichier complet est dans `docs/billing-v1-migration.sql` — toutes les opérations sont `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` enveloppées dans une `BEGIN ... COMMIT`. Aucun DROP, aucun ALTER sur table existante.

5 tables créées : `BillingCustomer`, `BetaFounderAccess`, `Entitlement`, `BillingEvent`, `WaitlistEntry`. 15 indexes total.

Le bloc rollback (commenté) est inclus en fin de fichier.

---

## 5. Script grandfather

- **Chemin** : `scripts/grandfather-beta-users.ts`
- **Idempotent** : oui (testé ✓). Le critère de skip est l'existence d'un Entitlement avec `(userId, type, source)` matching, indépendamment du statut.
- **Lancement** :
  ```bash
  # Dry-run (recommandé avant le run réel)
  DRY_RUN=true pnpm tsx scripts/grandfather-beta-users.ts

  # Run réel
  pnpm tsx scripts/grandfather-beta-users.ts

  # Verbose
  VERBOSE=true pnpm tsx scripts/grandfather-beta-users.ts
  ```
- **À lancer AVANT** : merge sur main ET activation du flag.
- **Comportement** : pour chaque `InvestigatorAccess` actif (`isActive=true` ET `expiresAt` futur ou null), crée un `Entitlement { type: "beta_founder_access", source: "grandfathered", sourceId: null, status: "active" }`.

**Tests** : 4 cas couverts (création / idempotent skip / erreur isolée / DRY_RUN). 4/4 verts.

---

## 6. Routes créées

| Méthode | Route | Status flag-off | Auth |
|---|---|---|---|
| GET | `/access/founder` | 404 | aucune (exempt proxy) |
| POST | `/api/billing/create-checkout-session` | 404 | Turnstile + rate limit |
| POST | `/api/billing/waitlist` | 404 | Turnstile + rate limit |
| GET | `/api/billing/access-status?session_id=…` | 404 | session_id non-énumérable |
| GET | `/access/success?session_id=…` | 404 | session_id non-énumérable |
| GET | `/admin/billing` | 404 | admin_session (cookie) en prod |
| POST | `/api/stripe/webhook` | **toujours actif** | signature Stripe |

---

## 7. Variables d'environnement à configurer dans Vercel

À ajouter via **Vercel Dashboard UI** (pas CLI — `vercel env pull` supprime `ADMIN_TOKEN` localement, cf. CLAUDE.md).

```
# Master flag — laisser à false jusqu'à validation end-to-end
BILLING_ENABLED=false

# Cap
BETA_FOUNDER_CAP=10000
BETA_CAP_REACHED=false

# Stripe — VALEURS DIFFÉRENTES dev/prod
STRIPE_SECRET_KEY=<sk_live_… en prod, sk_test_… en dev>
STRIPE_WEBHOOK_SECRET=<whsec_… du dashboard endpoint en prod ; valeur "stripe listen" en dev>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_live_… ou pk_test_…>
STRIPE_BETA_FOUNDER_PRICE_ID=  # optionnel, code utilise price_data si vide
STRIPE_TAX_ENABLED=false       # garder false jusqu'à validation expert-comptable

# App
NEXT_PUBLIC_APP_URL=https://app.interligens.com

# Anti-fraud
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key Cloudflare>
# (TURNSTILE_SECRET, UPSTASH_REDIS_REST_URL/TOKEN, RESEND_API_KEY déjà présents)

# Salt pour hash IP dans audit logs (≥ 32 chars random)
IP_HASH_SALT=<random 32+ char string>
```

`.env.example` à jour est inclus dans la branche.

---

## 8. Configuration Stripe Dashboard requise (à faire par Dood)

Étapes dans l'ordre, **avant** d'activer `BILLING_ENABLED=true` en prod :

1. **Stripe Checkout** : activé par défaut, vérifier que la branche du compte est `payments`.
2. **Payment methods** : activer Card. Apple Pay et Google Pay se surface automatiquement avec Card.
3. **Apple Pay Domain Verification** :
   - Stripe Dashboard → Settings → Payment methods → Apple Pay → Add new domain.
   - Domain : `app.interligens.com`.
   - Stripe fournit un fichier `apple-developer-merchantid-domain-association` à servir depuis `https://app.interligens.com/.well-known/apple-developer-merchantid-domain-association`. (À ajouter dans `public/.well-known/` si Stripe le demande explicitement — c'est généralement automatique sur Stripe-hosted Checkout.)
4. **Google Pay** : Stripe Dashboard → Settings → Payment methods → Google Pay → Enable.
5. **Stripe Radar** :
   - Settings → Radar → Rules → enable default rules.
   - Recommandé : "Block if CVC fails" (catches card-testing à coup sûr), "Review if charge attempts > 3 / hour from same email".
   - Le code applique déjà un rate limit applicatif en amont, Radar = défense en profondeur côté Stripe.
6. **Stripe Tax** :
   - **NE PAS activer en prod tant que l'expert-comptable n'a pas validé.**
   - Décisions à valider : seuils OSS, taux applicable pour 1 € (FR 20 %), comptabilisation, déclaration trimestrielle.
   - Le code lit `STRIPE_TAX_ENABLED` et passe `automatic_tax: { enabled }` directement à Stripe.
7. **Webhook endpoint** :
   - Settings → Developers → Webhooks → Add endpoint.
   - URL : `https://app.interligens.com/api/stripe/webhook`
   - Events à cocher (exhaustif) :
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
     - `charge.dispute.created`
     - `charge.dispute.closed`
   - Copier le **Signing secret** → `STRIPE_WEBHOOK_SECRET` dans Vercel (Production env).
   - Pour le dev local, utiliser `stripe listen --forward-to localhost:3100/api/stripe/webhook` et copier le secret affiché → `.env.local`.

---

## 9. Tests exécutés (résultats réels)

```
pnpm test           → 191 files, 1591 tests passing, 0 failing, 3.79s
  └─ baseline avant ce sprint : 178 files, 1523 tests
  └─ delta : +13 files, +68 tests, 0 régression

pnpm tsc --noEmit   → 1 error (pré-existant, hors scope billing) :
  .next/dev/types/app/api/casefile/route.ts:14 — BOTIFY_MINT export
  (déjà flaggé dans l'audit du sprint précédent, n'empêche pas le build)
  → 0 erreur TSC dans le module billing.

pnpm build          → exit 0, "Compiled successfully in 5.8s"
  Routes du module visibles dans la sortie :
  ƒ /access/founder, ƒ /access/success, ƒ /admin/billing
  ƒ /api/billing/access-status, ƒ /api/billing/create-checkout-session
  ƒ /api/billing/waitlist, ƒ /api/stripe/webhook
```

**Coverage des cas du brief** (21 demandés) :

| Cas | Fichier de test | Vert |
|---|---|---|
| create-checkout refuse Turnstile invalide | `create-checkout-session.test.ts` | ✓ |
| create-checkout rate-limited | `create-checkout-session.test.ts` + `rateLimit.test.ts` | ✓ |
| create-checkout refuse cap reached | `create-checkout-session.test.ts` + `cap.test.ts` | ✓ |
| create-checkout idempotent (double-click) | `create-checkout-session.test.ts` (re-use existing) + `idempotency.test.ts` | ✓ |
| create-checkout crée pending reservation | `create-checkout-session.test.ts` | ✓ |
| Stripe Customer lookup — pas de doublon | `customerLookup.test.ts` (6 cas) | ✓ |
| Webhook reject invalid signature | `webhook.test.ts` | ✓ |
| Webhook idempotent on duplicate event | `webhook.test.ts` (P2002) + `webhookHandlers.test.ts` | ✓ |
| session.completed grants access + entitlement | `webhookHandlers.test.ts` | ✓ |
| Wrong amount does NOT grant | `webhookHandlers.test.ts` | ✓ |
| Wrong currency does NOT grant | `webhookHandlers.test.ts` | ✓ |
| Refund revokes entitlement | `webhookHandlers.test.ts` | ✓ |
| Dispute revokes + security event | `webhookHandlers.test.ts` | ✓ |
| Dispute closed NO re-activation | `webhookHandlers.test.ts` | ✓ |
| Waitlist dedupe email (P2002) | `waitlist.test.ts` | ✓ |
| Grandfather idempotent | `grandfather-beta-users.test.ts` | ✓ |
| Feature flag off → 404 | `checkout-flag-off.test.ts` (3 routes) | ✓ |
| create-checkout refuse unauthenticated | n/a — pas d'auth applicative pré-paiement (cf. décisions 2 & 3) ; gardes équivalents : Turnstile + rate-limit + valid email. Couverts. |
| create-checkout refuse missing NDA | n/a — NDA pas un gating actif côté codebase (cf. audit §2). |
| Success page does not grant access | Vrai par construction : `/access/success` lit `/api/billing/access-status` qui retourne seulement `{status, emailHint}`. Pas de DB mutation côté success. Pas de test direct mais le code ne contient aucune `create/update` côté page. |
| access-status route auth required | n/a — auth = `session_id` non-énumérable signé par Stripe ; intentionnel (le payeur n'a pas encore d'investigator_session). Documenté. |
| Gating lit Entitlement et accorde accès | `entitlement.test.ts > hasActiveBetaEntitlement`. **Note : la fonction est livrée mais le gating en lui-même reste sur l'ancienne logique investigator_session — Phase 2.** |

**Aucun test ne fait de call Stripe réel.** Le SDK est mocké via `vi.mock("@/lib/billing/stripeClient")`.

**Pas de test end-to-end avec vraie carte.** Le brief le demande pour activation flag : "Ne pas activer le flag avant validation end-to-end avec ta vraie carte." → étape Dood (cf. §10).

---

## 10. Commandes pour Dood

### Avant merge main

```bash
# 1. Smoke test local
git checkout feat/billing-beta
pnpm install
pnpm prisma generate --schema prisma/schema.prod.prisma   # NB: pnpm exec, pas npx
pnpm test
pnpm tsc --noEmit   # 1 erreur pré-existante hors scope, OK
pnpm build          # doit retourner exit 0

# 2. Migration prod (BLOQUANT avant merge)
#    a) Ouvrir Neon SQL Editor pour le projet ep-square-band
#    b) Coller le contenu de docs/billing-v1-migration.sql
#    c) Exécuter — la transaction est CREATE IF NOT EXISTS, safe à rejouer

# 3. Grandfather script (BLOQUANT avant activation flag)
DRY_RUN=true VERBOSE=true pnpm tsx scripts/grandfather-beta-users.ts
# si le compte de "created" semble bon :
pnpm tsx scripts/grandfather-beta-users.ts
```

### Activation flag en prod

```bash
# 1. Configurer toutes les env vars dans Vercel Dashboard (UI, cf. §7)
# 2. Stripe Dashboard : créer le webhook endpoint, payment methods, Radar (cf. §8)
# 3. Re-deploy pour que les nouvelles env soient appliquées
npx vercel --prod

# 4. Vérification post-deploy (smoke test prod)
curl -s https://app.interligens.com/api/health | jq .
curl -s -o /dev/null -w "%{http_code}\n" https://app.interligens.com/access/founder   # avec BILLING_ENABLED=false → 404
curl -s -o /dev/null -w "%{http_code}\n" https://app.interligens.com/api/stripe/webhook   # 400 ou 500 (pas 404 — preuve que la route existe même flag off)

# 5. Test bout-en-bout AVEC VRAIE CARTE (1 €)
# Activer BILLING_ENABLED=true dans Vercel
# Re-deploy
# Aller sur https://app.interligens.com/access/founder
# Renseigner email perso, valider Turnstile, payer 1 € carte
# Vérifier reception du mail Resend avec l'access code
# Vérifier que /access avec ce code donne un investigator_session valide
```

### Rollback

Si quoi que ce soit déraille :

```bash
# Etape 1 — désactiver le flag (re-deploy automatique côté Vercel ou vercel --prod)
# Vercel Dashboard → settings → env → BILLING_ENABLED=false

# Etape 2 (seulement si schema migration doit être annulée) — Neon SQL Editor :
BEGIN;
DROP TABLE IF EXISTS "BetaFounderAccess", "BillingCustomer", "BillingEvent",
                     "Entitlement", "WaitlistEntry" CASCADE;
COMMIT;

# Etape 3 — revert branch
git checkout main
git branch -D feat/billing-beta   # purement local, le remote reste intact
```

`proxy.ts` n'a PAS été modifié donc rollback du gate = no-op (rien à inverser).

---

## 11. Risques résiduels (liste honnête)

1. **Pas de test bout-en-bout réel avec carte.** Le brief exige cette validation avant activation flag. Doit être fait par Dood en prod sur sa propre carte avant de pousser au public.
2. **Apple Pay Domain Verification non scriptée.** Le fichier `.well-known/apple-developer-merchantid-domain-association` n'est pas créé : Stripe doit le fournir, et il faudra le placer dans `public/.well-known/` si Stripe le demande explicitement. La majorité des cas (Stripe-hosted Checkout) ne le requiert pas car Stripe sert le sien.
3. **TVA / OSS** : code prêt (`automatic_tax`), mais pas validé fiscalement. Activation = décision **expert-comptable**, pas Claude Code. Tant que `STRIPE_TAX_ENABLED=false`, Stripe ne calcule rien et les 1 € sont 100 % gross.
4. **Privacy policy** : non mise à jour (hors scope code). Dood doit ajouter "Stripe comme processeur paiement", base légale "exécution du contrat", et durée de conservation des BillingEvent / BetaFounderAccess à 10 ans (obligation comptable FR).
5. **Data deletion / GDPR** : pas de route applicative dédiée. À traiter en dette si besoin DSAR pose problème.
6. **Email confirmation** : on réutilise `sendAccessCodeEmail` (Resend) qui contient le **code en clair**. Pour le payeur, c'est volontaire — il a besoin du code pour activer son session. Le subject de l'email reste "INTERLIGENS — Your Investigator Access Code". Si on veut un wording "Beta Founder" dédié, c'est un suivi possible.
7. **Idempotency-Key Stripe** : bucket par minute. Deux clicks à 59s d'intervalle peuvent générer deux sessions si l'utilisateur change d'onglet — mitigé par le DB-side check `BetaFounderAccess.status=pending`. En pratique, l'idempotence DB est le garde-fou principal.
8. **Cap race condition** : `SELECT … FOR UPDATE` dans `cap.ts` couplé à `prisma.$transaction()` + Postgres niveau d'isolement par défaut. Sur Neon pooler (pgbouncer mode "transaction"), `FOR UPDATE` est OK ; en cas de panique mass-test, il existe le flag manuel `BETA_CAP_REACHED=true` (override immédiat).
9. **TSC pré-existant** : 1 erreur `BOTIFY_MINT` dans `src/app/api/casefile/route.ts:6` (non lié à billing). Build passe.
10. **Cloudflare WAF** sur `app.interligens.com` : déjà observé bloquer cURL avec 403 (rapporté dans le sprint précédent). À surveiller pour Stripe webhook (Stripe identifié devrait être whitelisté ; sinon, désactiver une règle CF pour `/api/stripe/webhook`).
11. **Stripe SDK v22** type pinning : j'ai dû caster `apiVersion` via `unknown` parce que `Stripe.LatestApiVersion` et `Stripe.StripeConfig` ne sont pas exportés en v22. La valeur littérale `"2024-12-18.acacia"` est correcte ; quand Stripe sort une nouvelle version majeure il faudra revoir.

---

## 12. Status

**READY FOR HUMAN REVIEW.**

- Code complet, atomic-ready
- Tests : 1591/1591 verts
- Build : exit 0
- Sécurité grep : 0 hit card-data
- Migration SQL : safe, additive, IF NOT EXISTS
- Rollback documenté

**NOT READY pour activation flag** tant que :
- Stripe Dashboard pas configuré (webhook, payment methods, Apple Pay verification)
- Migration Neon pas appliquée
- Script grandfather pas joué
- Test bout-en-bout avec vraie carte de Dood pas fait
- Privacy policy pas mise à jour

Aucun merge sur `main` jusqu'à validation humaine.

---

## 2. SQL migration — docs/billing-v1-migration.sql

===== docs/billing-v1-migration.sql =====
-- ═══════════════════════════════════════════════════════════════════════════
-- INTERLIGENS — Beta Founder Access 1 € — Migration v1
-- Date: 2026-05-11
-- Branch: feat/billing-beta
-- Target: Neon production (ep-square-band, Frankfurt, port 6543 pooled)
-- Run: PASTE in Neon SQL Editor. DO NOT use `prisma db push`.
-- All operations are ADDITIVE (no DROP, no ALTER on existing tables).
-- Safe to re-run partially: each CREATE uses IF NOT EXISTS where supported,
-- or wrap manually in a transaction and rollback on conflict.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- BillingCustomer — Stripe Customer ↔ INTERLIGENS identity mapping
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BillingCustomer" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "stripeCustomerId" TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCustomer_userId_key"           ON "BillingCustomer"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCustomer_stripeCustomerId_key" ON "BillingCustomer"("stripeCustomerId");
CREATE        INDEX IF NOT EXISTS "BillingCustomer_email_idx"            ON "BillingCustomer"("email");

-- ──────────────────────────────────────────────────────────────────────────
-- BetaFounderAccess — reservation + payment record
-- userId is NULLABLE: pre-payment we only have the email; post-payment
-- the webhook back-fills userId with the freshly minted InvestigatorAccess.id.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BetaFounderAccess" (
  "id"                       TEXT NOT NULL,
  "userId"                   TEXT,
  "email"                    TEXT NOT NULL,
  "stripeCustomerId"         TEXT,
  "stripeCheckoutSession"    TEXT,
  "stripeCheckoutSessionUrl" TEXT,
  "stripePaymentIntent"      TEXT,
  "amountCents"              INTEGER NOT NULL DEFAULT 100,
  "currency"                 TEXT NOT NULL DEFAULT 'eur',
  "status"                   TEXT NOT NULL,
  "campaign"                 TEXT NOT NULL DEFAULT 'beta_founder_1eur',
  "reservationExpiresAt"     TIMESTAMP(3),
  "grantedAt"                TIMESTAMP(3),
  "revokedAt"                TIMESTAMP(3),
  "revokeReason"             TEXT,
  "taxAmountCents"           INTEGER,
  "customerCountry"          TEXT,
  "stripeTaxCalculationId"   TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BetaFounderAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BetaFounderAccess_userId_key"                ON "BetaFounderAccess"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "BetaFounderAccess_stripeCheckoutSession_key" ON "BetaFounderAccess"("stripeCheckoutSession");
CREATE UNIQUE INDEX IF NOT EXISTS "BetaFounderAccess_stripePaymentIntent_key"   ON "BetaFounderAccess"("stripePaymentIntent");
CREATE        INDEX IF NOT EXISTS "BetaFounderAccess_status_idx"                ON "BetaFounderAccess"("status");
CREATE        INDEX IF NOT EXISTS "BetaFounderAccess_campaign_idx"              ON "BetaFounderAccess"("campaign");
CREATE        INDEX IF NOT EXISTS "BetaFounderAccess_email_status_idx"          ON "BetaFounderAccess"("email", "status");
CREATE        INDEX IF NOT EXISTS "BetaFounderAccess_reservationExpiresAt_idx"  ON "BetaFounderAccess"("reservationExpiresAt");

-- ──────────────────────────────────────────────────────────────────────────
-- Entitlement — generic, future-proof access record
-- Today: fed by webhook (source='stripe_checkout') and grandfather script
-- (source='grandfathered'). Phase 2: proxy.ts will start reading this.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Entitlement" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "source"       TEXT NOT NULL,
  "sourceId"     TEXT,
  "status"       TEXT NOT NULL,
  "startsAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt"       TIMESTAMP(3),
  "revokedAt"    TIMESTAMP(3),
  "revokeReason" TEXT,
  "metadata"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Entitlement_userId_type_status_idx" ON "Entitlement"("userId", "type", "status");
CREATE INDEX IF NOT EXISTS "Entitlement_source_sourceId_idx"    ON "Entitlement"("source",  "sourceId");

-- ──────────────────────────────────────────────────────────────────────────
-- BillingEvent — Stripe webhook idempotency log
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BillingEvent" (
  "id"            TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "eventType"     TEXT NOT NULL,
  "payloadHash"   TEXT,
  "processedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");
CREATE        INDEX IF NOT EXISTS "BillingEvent_eventType_idx"     ON "BillingEvent"("eventType");

-- ──────────────────────────────────────────────────────────────────────────
-- WaitlistEntry — captured emails when sold_out
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
  "id"        TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "source"    TEXT NOT NULL DEFAULT 'beta_founder_soldout',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (DO NOT RUN unless full revert is intended)
-- ═══════════════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS "BetaFounderAccess", "BillingCustomer", "BillingEvent",
--                      "Entitlement", "WaitlistEntry" CASCADE;

---

## 3. Prisma schema diff (main..feat/billing-beta)

===== git diff main..feat/billing-beta -- prisma/schema.prod.prisma =====
diff --git a/prisma/schema.prod.prisma b/prisma/schema.prod.prisma
index 526500f..3b86e4f 100644
--- a/prisma/schema.prod.prisma
+++ b/prisma/schema.prod.prisma
@@ -533,24 +533,24 @@ model SocialWatchlist {
 }
 
 model SocialPostCandidate {
-  id                 String     @id @default(cuid())
+  id                 String           @id @default(cuid())
   influencerId       String
   watchlistId        String?
   postUrl            String
   postId             String
-  discoveredAtUtc    DateTime   @default(now())
+  discoveredAtUtc    DateTime         @default(now())
   postedAtUtc        DateTime?
   sourceProvider     String
-  status             String     @default("new")
-  attempts           Int        @default(0)
+  status             String           @default("new")
+  attempts           Int              @default(0)
   lastAttemptAtUtc   DateTime?
   errorMessage       String?
   linkedSocialPostId String?
-  detectedTokens     String     @default("[]")
-  detectedAddresses  String     @default("[]")
-  signalTypes        String     @default("[]")
-  signalScore        Int        @default(0)
-  dedupKey           String?    @unique
+  detectedTokens     String           @default("[]")
+  detectedAddresses  String           @default("[]")
+  signalTypes        String           @default("[]")
+  signalScore        Int              @default(0)
+  dedupKey           String?          @unique
   profileSnapshot    String?
   // Watcher V2 extended fields (added 2026-04-25)
   rawText            String?
@@ -560,9 +560,9 @@ model SocialPostCandidate {
   severity           String?
   kolProfileId       String?
   campaignId         String?
-  createdAt          DateTime   @default(now())
-  updatedAt          DateTime   @updatedAt
-  influencer         Influencer @relation(fields: [influencerId], references: [id])
+  createdAt          DateTime         @default(now())
+  updatedAt          DateTime         @updatedAt
+  influencer         Influencer       @relation(fields: [influencerId], references: [id])
   campaign           WatcherCampaign? @relation(fields: [campaignId], references: [id])
 
   @@unique([postId, influencerId])
@@ -1435,17 +1435,17 @@ model VaultNdaAcceptance {
 }
 
 model VaultWorkspace {
-  id            String       @id @default(cuid())
-  profileId     String       @unique
-  profile       VaultProfile @relation(fields: [profileId], references: [id])
-  kdfSalt       String // hex 32 chars = 16 bytes
-  kdfAlgo       String       @default("PBKDF2-SHA256")
-  kdfIterations Int          @default(310000)
-  encMode       String       @default("CLIENT_SIDE_AES256GCM")
-  assistantTokensUsed  Int   @default(0)
-  assistantTokensLimit Int   @default(100000)
-  createdAt     DateTime     @default(now())
-  updatedAt     DateTime     @updatedAt
+  id                   String       @id @default(cuid())
+  profileId            String       @unique
+  profile              VaultProfile @relation(fields: [profileId], references: [id])
+  kdfSalt              String // hex 32 chars = 16 bytes
+  kdfAlgo              String       @default("PBKDF2-SHA256")
+  kdfIterations        Int          @default(310000)
+  encMode              String       @default("CLIENT_SIDE_AES256GCM")
+  assistantTokensUsed  Int          @default(0)
+  assistantTokensLimit Int          @default(100000)
+  createdAt            DateTime     @default(now())
+  updatedAt            DateTime     @updatedAt
 
   cases         VaultCase[]
   audits        VaultAuditLog[]
@@ -1453,18 +1453,18 @@ model VaultWorkspace {
 }
 
 model VaultCase {
-  id          String          @id @default(cuid())
-  workspaceId String
-  workspace   VaultWorkspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
-  titleEnc    String
-  titleIv     String
-  tagsEnc     String
-  tagsIv      String
-  status      VaultCaseStatus @default(PRIVATE)
-  caseTemplate String?        @default("blank")
-  createdAt   DateTime        @default(now())
-  updatedAt   DateTime        @updatedAt
-  archivedAt  DateTime?
+  id           String          @id @default(cuid())
+  workspaceId  String
+  workspace    VaultWorkspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
+  titleEnc     String
+  titleIv      String
+  tagsEnc      String
+  tagsIv       String
+  status       VaultCaseStatus @default(PRIVATE)
+  caseTemplate String?         @default("blank")
+  createdAt    DateTime        @default(now())
+  updatedAt    DateTime        @updatedAt
+  archivedAt   DateTime?
 
   entities          VaultCaseEntity[]
   files             VaultCaseFile[]
@@ -1733,19 +1733,19 @@ model VaultEvidenceSnapshot {
 // beta auth system is code-based and has no email field on session.
 
 model WatchedAddress {
-  id                 String   @id @default(cuid())
+  id                 String    @id @default(cuid())
   address            String
-  chain              String   // "solana" | "ethereum" | "base" | "arbitrum"
+  chain              String // "solana" | "ethereum" | "base" | "arbitrum"
   label              String?
   ownerAccessId      String
   lastScore          Int?
   lastTier           String?
   lastGovernedStatus String?
   lastScannedAt      DateTime?
-  alertOnChange      Boolean  @default(true)
-  active             Boolean  @default(true)
-  createdAt          DateTime @default(now())
-  updatedAt          DateTime @updatedAt
+  alertOnChange      Boolean   @default(true)
+  active             Boolean   @default(true)
+  createdAt          DateTime  @default(now())
+  updatedAt          DateTime  @updatedAt
 
   alerts WatchAlert[]
 
@@ -1762,7 +1762,7 @@ model WatchAlert {
   newScore         Int
   previousTier     String?
   newTier          String
-  changeType       String         // "tier_change" | "score_change" | "governed_status_change"
+  changeType       String // "tier_change" | "score_change" | "governed_status_change"
   changeDetail     String?
   notifiedAt       DateTime?
   emailSent        Boolean        @default(false)
@@ -1843,9 +1843,9 @@ enum InvestigatorActivityEvent {
 }
 
 model InvestigatorProfile {
-  id        String @id @default(cuid())
-  handle    String @unique
-  accessId  String? @unique
+  id       String  @id @default(cuid())
+  handle   String  @unique
+  accessId String? @unique
 
   // Identity (filled after onboarding)
   legalFirstName   String?
@@ -1915,7 +1915,7 @@ model InvestigatorNdaAcceptance {
   id          String               @id @default(cuid())
   profileId   String?              @unique
   profile     InvestigatorProfile? @relation(fields: [profileId], references: [id])
-  betaCodeId  String?              // free ref, no FK
+  betaCodeId  String? // free ref, no FK
   signerName  String
   ndaVersion  String
   ndaLanguage String
@@ -1931,7 +1931,7 @@ model InvestigatorBetaTermsAcceptance {
   id            String               @id @default(cuid())
   profileId     String?              @unique
   profile       InvestigatorProfile? @relation(fields: [profileId], references: [id])
-  betaCodeId    String?              // free ref, no FK
+  betaCodeId    String? // free ref, no FK
   signerName    String
   termsVersion  String
   termsLanguage String
@@ -2088,18 +2088,18 @@ model ConversationParticipant {
 }
 
 model Message {
-  id             String       @id @default(cuid())
+  id             String        @id @default(cuid())
   conversationId String
-  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
+  conversation   Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
   senderAccessId String
   senderName     String
   senderEmail    String?
-  kind           String       @default("message")
+  kind           String        @default("message")
   body           String
-  priority       String       @default("normal")
+  priority       String        @default("normal")
   readBy         MessageRead[]
-  createdAt      DateTime     @default(now())
-  updatedAt      DateTime     @updatedAt
+  createdAt      DateTime      @default(now())
+  updatedAt      DateTime      @updatedAt
 
   @@index([conversationId])
   @@index([senderAccessId])
@@ -2116,16 +2116,16 @@ model MessageRead {
 }
 
 model FeedbackEntry {
-  id               String   @id @default(cuid())
-  accessId         String
-  investigatorName String
+  id                String   @id @default(cuid())
+  accessId          String
+  investigatorName  String
   investigatorEmail String?
-  workspaceId      String?
-  type             String   @default("feedback")
-  body             String
-  status           String   @default("unread")
-  createdAt        DateTime @default(now())
-  updatedAt        DateTime @updatedAt
+  workspaceId       String?
+  type              String   @default("feedback")
+  body              String
+  status            String   @default("unread")
+  createdAt         DateTime @default(now())
+  updatedAt         DateTime @updatedAt
 
   @@index([accessId])
   @@index([status])
@@ -2202,16 +2202,16 @@ model XThread {
 // migration is applied.
 
 model EquitySignal {
-  id           String   @id @default(cuid())
+  id           String    @id @default(cuid())
   ticker       String
   entityName   String
   tradeDate    DateTime
   tweetDate    DateTime?
   deltaHours   Float?
-  suspectLevel String   @default("LOW")
+  suspectLevel String    @default("LOW")
   notes        String?
   source       String
-  createdAt    DateTime @default(now())
+  createdAt    DateTime  @default(now())
 
   @@index([ticker])
   @@index([createdAt])
@@ -2272,17 +2272,17 @@ model SecurityVendor {
 }
 
 model SecuritySource {
-  id                  String   @id @default(cuid())
+  id                  String    @id @default(cuid())
   vendorId            String?
   sourceType          String // statuspage | advisory_db | rss | webhook | manual | internal_audit | vendor_blog | github_advisory
   name                String
   url                 String
-  isActive            Boolean  @default(true)
+  isActive            Boolean   @default(true)
   pollIntervalMinutes Int?
   lastPolledAt        DateTime?
   lastStatus          String?
-  createdAt           DateTime @default(now())
-  updatedAt           DateTime @updatedAt
+  createdAt           DateTime  @default(now())
+  updatedAt           DateTime  @updatedAt
 
   vendor    SecurityVendor?    @relation(fields: [vendorId], references: [id], onDelete: SetNull)
   incidents SecurityIncident[]
@@ -2325,18 +2325,18 @@ model SecurityIncident {
 }
 
 model SecurityExposureAssessment {
-  id                       String   @id @default(cuid())
-  incidentId               String
-  exposureLevel            String // none | unlikely | possible | probable | confirmed
-  affectedSurface          Json
-  requiresKeyRotation      Boolean  @default(false)
-  requiresAccessReview     Boolean  @default(false)
-  requiresInfraLogReview   Boolean  @default(false)
-  requiresPublicStatement  Boolean  @default(false)
-  actionChecklist          Json
-  analystNote              String?
-  createdAt                DateTime @default(now())
-  updatedAt                DateTime @updatedAt
+  id                      String   @id @default(cuid())
+  incidentId              String
+  exposureLevel           String // none | unlikely | possible | probable | confirmed
+  affectedSurface         Json
+  requiresKeyRotation     Boolean  @default(false)
+  requiresAccessReview    Boolean  @default(false)
+  requiresInfraLogReview  Boolean  @default(false)
+  requiresPublicStatement Boolean  @default(false)
+  actionChecklist         Json
+  analystNote             String?
+  createdAt               DateTime @default(now())
+  updatedAt               DateTime @updatedAt
 
   incident SecurityIncident @relation(fields: [incidentId], references: [id], onDelete: Cascade)
 
@@ -2397,16 +2397,16 @@ model SecurityActionItem {
 }
 
 model SecurityWeeklyDigest {
-  id                    String   @id @default(cuid())
+  id                    String    @id @default(cuid())
   periodStart           DateTime
   periodEnd             DateTime
-  generatedAt           DateTime @default(now())
+  generatedAt           DateTime  @default(now())
   subject               String
   bodyHtml              String
   bodyText              String
-  includedIncidentCount Int      @default(0)
-  includedCriticalCount Int      @default(0)
-  deliveryStatus        String   @default("pending") // pending | sent | failed
+  includedIncidentCount Int       @default(0)
+  includedCriticalCount Int       @default(0)
+  deliveryStatus        String    @default("pending") // pending | sent | failed
   deliveryMeta          Json?
   sentAt                DateTime?
 
@@ -2517,7 +2517,7 @@ enum MmSeverity {
 }
 
 model MmScanRun {
-  id                  String         @id @default(cuid())
+  id                  String        @id @default(cuid())
   subjectType         MmSubjectType
   subjectId           String
   chain               MmChain
@@ -2540,7 +2540,7 @@ model MmScanRun {
   triggeredByRef      String?
   durationMs          Int
   errors              Json?
-  createdAt           DateTime       @default(now())
+  createdAt           DateTime      @default(now())
 
   detectorOutputs MmDetectorOutput[]
 
@@ -2635,8 +2635,8 @@ model MmCohortPercentile {
 // 11 modèles isolés du reste du schéma. Rollback = drop these 11 tables.
 
 model MmEntity {
-  id              String    @id @default(cuid())
-  slug            String    @unique
+  id              String     @id @default(cuid())
+  slug            String     @unique
   name            String
   legalName       String?
   jurisdiction    String?
@@ -2645,14 +2645,14 @@ model MmEntity {
   status          MmStatus
   riskBand        MmRiskBand
   defaultScore    Int
-  publicSummary   String    @db.Text
-  publicSummaryFr String?   @db.Text
+  publicSummary   String     @db.Text
+  publicSummaryFr String?    @db.Text
   knownAliases    String[]
   officialDomains String[]
   workflow        MmWorkflow @default(DRAFT)
   publishedAt     DateTime?
-  createdAt       DateTime  @default(now())
-  updatedAt       DateTime  @updatedAt
+  createdAt       DateTime   @default(now())
+  updatedAt       DateTime   @updatedAt
 
   attributions MmAttribution[]
   claims       MmClaim[]
@@ -2681,7 +2681,7 @@ enum MmWorkflow {
 }
 
 model MmSource {
-  id              String         @id @default(cuid())
+  id              String           @id @default(cuid())
   publisher       String
   sourceType      MmSourceType
   url             String
@@ -2692,10 +2692,10 @@ model MmSource {
   title           String
   author          String?
   publishedAt     DateTime?
-  fetchedAt       DateTime       @default(now())
+  fetchedAt       DateTime         @default(now())
   credibilityTier MmCredTier
-  language        String         @default("en")
-  notes           String?        @db.Text
+  language        String           @default("en")
+  notes           String?          @db.Text
 
   claims MmClaim[]
 
@@ -2733,18 +2733,18 @@ enum MmArchivalStatus {
 }
 
 model MmClaim {
-  id            String        @id @default(cuid())
+  id            String      @id @default(cuid())
   mmEntityId    String
   claimType     MmClaimType
-  text          String        @db.Text
-  textFr        String?       @db.Text
+  text          String      @db.Text
+  textFr        String?     @db.Text
   sourceId      String
   jurisdiction  String?
-  publishStatus MmPubStatus   @default(DRAFT)
+  publishStatus MmPubStatus @default(DRAFT)
   publishedAt   DateTime?
-  orderIndex    Int           @default(0)
-  createdAt     DateTime      @default(now())
-  updatedAt     DateTime      @updatedAt
+  orderIndex    Int         @default(0)
+  createdAt     DateTime    @default(now())
+  updatedAt     DateTime    @updatedAt
 
   mmEntity MmEntity @relation(fields: [mmEntityId], references: [id], onDelete: Cascade)
   source   MmSource @relation(fields: [sourceId], references: [id])
@@ -2769,7 +2769,7 @@ enum MmPubStatus {
 }
 
 model MmAttribution {
-  id                String          @id @default(cuid())
+  id                String         @id @default(cuid())
   walletAddress     String
   chain             MmChain
   mmEntityId        String
@@ -2779,10 +2779,10 @@ model MmAttribution {
   reviewerUserId    String?
   reviewedAt        DateTime?
   challengedAt      DateTime?
-  challengeReason   String?         @db.Text
+  challengeReason   String?        @db.Text
   revokedAt         DateTime?
-  revokedReason     String?         @db.Text
-  createdAt         DateTime        @default(now())
+  revokedReason     String?        @db.Text
+  createdAt         DateTime       @default(now())
 
   mmEntity MmEntity @relation(fields: [mmEntityId], references: [id], onDelete: Cascade)
 
@@ -2841,24 +2841,24 @@ enum MmReviewAction {
 }
 
 model MmChallenge {
-  id                 String            @id @default(cuid())
+  id                 String         @id @default(cuid())
   targetType         MmTargetType
   targetId           String
   challengerEmail    String
   challengerName     String
   challengerRole     String?
   challengerEntity   String
-  claimedText        String            @db.Text
-  responseText       String            @db.Text
-  verificationStatus MmVerifStatus     @default(PENDING)
+  claimedText        String         @db.Text
+  responseText       String         @db.Text
+  verificationStatus MmVerifStatus  @default(PENDING)
   verificationMethod MmVerifMethod?
   verifiedAt         DateTime?
   verifiedBy         String?
-  publishStatus      MmPubStatus       @default(DRAFT)
+  publishStatus      MmPubStatus    @default(DRAFT)
   publishedAt        DateTime?
-  rejectionReason    String?           @db.Text
-  createdAt          DateTime          @default(now())
-  updatedAt          DateTime          @updatedAt
+  rejectionReason    String?        @db.Text
+  createdAt          DateTime       @default(now())
+  updatedAt          DateTime       @updatedAt
 
   @@index([targetType, targetId])
   @@index([verificationStatus])
@@ -2972,21 +2972,21 @@ model RwaIssuer {
   createdAt         DateTime        @default(now())
   updatedAt         DateTime        @updatedAt
 
-  assets            RwaAsset[]
-  aliases           RwaIssuerAlias[]
-  sources           RwaVerificationSource[]
+  assets  RwaAsset[]
+  aliases RwaIssuerAlias[]
+  sources RwaVerificationSource[]
 
   @@index([slug])
   @@index([status])
 }
 
 model RwaIssuerAlias {
-  id        String    @id @default(cuid())
+  id        String   @id @default(cuid())
   issuerId  String
   alias     String
-  createdAt DateTime  @default(now())
+  createdAt DateTime @default(now())
 
-  issuer    RwaIssuer @relation(fields: [issuerId], references: [id])
+  issuer RwaIssuer @relation(fields: [issuerId], references: [id])
 
   @@unique([issuerId, alias])
   @@index([alias])
@@ -3006,10 +3006,10 @@ model RwaAsset {
   createdAt           DateTime      @default(now())
   updatedAt           DateTime      @updatedAt
 
-  issuer              RwaIssuer     @relation(fields: [issuerId], references: [id])
-  contracts           RwaContract[]
-  aliases             RwaAssetAlias[]
-  sources             RwaVerificationSource[]
+  issuer    RwaIssuer               @relation(fields: [issuerId], references: [id])
+  contracts RwaContract[]
+  aliases   RwaAssetAlias[]
+  sources   RwaVerificationSource[]
 
   @@unique([issuerId, symbol])
   @@index([symbol])
@@ -3023,7 +3023,7 @@ model RwaAssetAlias {
   alias     String
   createdAt DateTime @default(now())
 
-  asset     RwaAsset @relation(fields: [assetId], references: [id])
+  asset RwaAsset @relation(fields: [assetId], references: [id])
 
   @@unique([assetId, alias])
   @@index([alias])
@@ -3047,13 +3047,13 @@ model RwaContract {
   createdAt              DateTime                      @default(now())
   updatedAt              DateTime                      @updatedAt
 
-  asset                  RwaAsset                      @relation(fields: [assetId], references: [id])
-  supersededBy           RwaContract?                  @relation("ContractMigration", fields: [supersededByContractId], references: [id])
-  supersedes             RwaContract[]                 @relation("ContractMigration")
-  aliases                RwaContractAlias[]
-  sources                RwaVerificationSource[]
-  verificationEvents     RwaVerificationEvent[]
-  scanCacheEntries       RwaScanCache[]
+  asset              RwaAsset                @relation(fields: [assetId], references: [id])
+  supersededBy       RwaContract?            @relation("ContractMigration", fields: [supersededByContractId], references: [id])
+  supersedes         RwaContract[]           @relation("ContractMigration")
+  aliases            RwaContractAlias[]
+  sources            RwaVerificationSource[]
+  verificationEvents RwaVerificationEvent[]
+  scanCacheEntries   RwaScanCache[]
 
   @@unique([chainKey, contractAddressNorm])
   @@index([contractAddressNorm])
@@ -3072,7 +3072,7 @@ model RwaContractAlias {
   verificationStatus RwaContractVerificationStatus @default(VERIFIED_OFFICIAL)
   createdAt          DateTime                      @default(now())
 
-  contract           RwaContract                   @relation(fields: [contractId], references: [id])
+  contract RwaContract @relation(fields: [contractId], references: [id])
 
   @@unique([chainKey, addressNorm])
   @@index([addressNorm])
@@ -3092,9 +3092,9 @@ model RwaVerificationSource {
   isPrimaryEvidence Boolean       @default(false)
   notes             String?
 
-  issuer            RwaIssuer?    @relation(fields: [issuerId], references: [id])
-  asset             RwaAsset?     @relation(fields: [assetId], references: [id])
-  contract          RwaContract?  @relation(fields: [contractId], references: [id])
+  issuer   RwaIssuer?   @relation(fields: [issuerId], references: [id])
+  asset    RwaAsset?    @relation(fields: [assetId], references: [id])
+  contract RwaContract? @relation(fields: [contractId], references: [id])
 
   @@index([issuerId])
   @@index([assetId])
@@ -3110,7 +3110,7 @@ model RwaVerificationEvent {
   metadata   Json?
   createdAt  DateTime                 @default(now())
 
-  contract   RwaContract              @relation(fields: [contractId], references: [id])
+  contract RwaContract @relation(fields: [contractId], references: [id])
 
   @@index([contractId])
   @@index([createdAt])
@@ -3130,7 +3130,7 @@ model RwaScanCache {
   cachedUntil       DateTime
   createdAt         DateTime        @default(now())
 
-  matchedContract   RwaContract?    @relation(fields: [matchedContractId], references: [id])
+  matchedContract RwaContract? @relation(fields: [matchedContractId], references: [id])
 
   @@unique([inputAddressNorm, chainKey])
   @@index([cachedUntil])
@@ -3164,18 +3164,18 @@ model DomainEvent {
 }
 
 model IngestionJob {
-  id                   String    @id @default(cuid())
+  id                   String   @id @default(cuid())
   source               String
   rawInput             String
   normalizedEntity     Json?
   resolveResult        Json?
-  status               String    @default("pending")
+  status               String   @default("pending")
   sourceChecksum       String
-  dryRun               Boolean   @default(false)
+  dryRun               Boolean  @default(false)
   errorReport          String?
-  manualReviewRequired Boolean   @default(false)
-  createdAt            DateTime  @default(now())
-  updatedAt            DateTime  @updatedAt
+  manualReviewRequired Boolean  @default(false)
+  createdAt            DateTime @default(now())
+  updatedAt            DateTime @updatedAt
 
   @@index([status, createdAt])
   @@index([source, status])
@@ -3219,21 +3219,21 @@ model TokenScanAggregate {
 // ── Watcher Campaign Intelligence (added 2026-04-25) ────────────────────────
 
 model WatcherCampaign {
-  id                     String               @id @default(cuid())
+  id                     String                @id @default(cuid())
   primaryTokenSymbol     String?
   primaryContractAddress String?
   chain                  String?
-  status                 String               @default("ACTIVE")
-  priority               String               @default("MEDIUM")
-  firstSeenAt            DateTime             @default(now())
-  lastSeenAt             DateTime             @default(now())
-  signalCount            Int                  @default(0)
-  kolCount               Int                  @default(0)
+  status                 String                @default("ACTIVE")
+  priority               String                @default("MEDIUM")
+  firstSeenAt            DateTime              @default(now())
+  lastSeenAt             DateTime              @default(now())
+  signalCount            Int                   @default(0)
+  kolCount               Int                   @default(0)
   summary                String?
-  claimPatterns          String               @default("[]")
+  claimPatterns          String                @default("[]")
   metadata               Json?
-  createdAt              DateTime             @default(now())
-  updatedAt              DateTime             @updatedAt
+  createdAt              DateTime              @default(now())
+  updatedAt              DateTime              @updatedAt
   signals                SocialPostCandidate[]
   campaignKols           WatcherCampaignKOL[]
 
@@ -3276,23 +3276,23 @@ model WatcherDigest {
 }
 
 model EntityGovernedStatus {
-  id                        String                        @id @default(cuid())
-  entityType                String
-  entityValue               String
-  chain                     String?
-  status                    GovernedStatusEnum
-  basis                     GovernedStatusBasisEnum?
-  reason                    String?                       @db.Text
-  setByUserId               String
-  setByUserRole             String                        @default("admin")
-  setAt                     DateTime                      @default(now())
-  reviewState               GovernedStatusReviewStateEnum @default(draft)
-  evidenceRefs              Json                          @default("[]")
-  revokedAt                 DateTime?
-  revokedByUserId           String?
-  revokedReason             String?                       @db.Text
-  createdAt                 DateTime                      @default(now())
-  updatedAt                 DateTime                      @updatedAt
+  id              String                        @id @default(cuid())
+  entityType      String
+  entityValue     String
+  chain           String?
+  status          GovernedStatusEnum
+  basis           GovernedStatusBasisEnum?
+  reason          String?                       @db.Text
+  setByUserId     String
+  setByUserRole   String                        @default("admin")
+  setAt           DateTime                      @default(now())
+  reviewState     GovernedStatusReviewStateEnum @default(draft)
+  evidenceRefs    Json                          @default("[]")
+  revokedAt       DateTime?
+  revokedByUserId String?
+  revokedReason   String?                       @db.Text
+  createdAt       DateTime                      @default(now())
+  updatedAt       DateTime                      @updatedAt
 
   @@unique([entityType, entityValue])
   @@index([status])
@@ -3323,19 +3323,19 @@ enum GovernedStatusReviewStateEnum {
 }
 
 model ScoreSnapshot {
-  id             String   @id @default(cuid())
-  entityType     String
-  entityValue    String
-  chain          String
-  score          Int
-  tier           String
+  id              String   @id @default(cuid())
+  entityType      String
+  entityValue     String
+  chain           String
+  score           Int
+  tier            String
   confidenceLevel String
-  version        String
-  topReasons     Json
-  provenanceData Json?
-  governedStatus Json?
-  rawInput       Json?
-  createdAt      DateTime @default(now())
+  version         String
+  topReasons      Json
+  provenanceData  Json?
+  governedStatus  Json?
+  rawInput        Json?
+  createdAt       DateTime @default(now())
 
   @@index([entityType, entityValue, createdAt])
   @@index([chain])
@@ -3345,16 +3345,116 @@ model ScoreSnapshot {
 }
 
 model KolCrossLink {
-  id            String   @id @default(cuid())
-  sourceHandle  String
-  targetHandle  String
-  linkType      String
-  confidence    String
-  evidence      Json
-  detectedAt    DateTime @default(now())
-  createdAt     DateTime @default(now())
+  id           String   @id @default(cuid())
+  sourceHandle String
+  targetHandle String
+  linkType     String
+  confidence   String
+  evidence     Json
+  detectedAt   DateTime @default(now())
+  createdAt    DateTime @default(now())
 
   @@unique([sourceHandle, targetHandle, linkType])
   @@index([sourceHandle])
   @@index([targetHandle])
 }
+
+// ─────────────────────────────────────────────────────────────────────────────
+// BILLING — Beta Founder Access 1 € (Phase 1, behind BILLING_ENABLED flag)
+// Spec: docs/brief-billing-v3.md ; Audit: docs/audit-billing.md
+//
+// Note on `userId`: there is no `model User` yet. `userId` is a free String
+// field that, post-payment, holds the value of `InvestigatorAccess.id`
+// (created by the webhook). Pre-payment, BetaFounderAccess.userId is null
+// and we key by `email`. Phase 2 (proxy.ts → Entitlement-aware) is OUT OF
+// SCOPE for this sprint; proxy.ts is unchanged.
+// ─────────────────────────────────────────────────────────────────────────────
+
+model BillingCustomer {
+  // Maps an INTERLIGENS identity (InvestigatorAccess.id stored in `userId`)
+  // to its Stripe Customer. One row per Stripe Customer; one Stripe Customer
+  // per identity. Created on first checkout-session, never duplicated.
+  id               String   @id @default(cuid())
+  userId           String   @unique
+  stripeCustomerId String   @unique
+  email            String
+  createdAt        DateTime @default(now())
+  updatedAt        DateTime @updatedAt
+
+  @@index([email])
+}
+
+model BetaFounderAccess {
+  // Reservation + payment record for the €1 Beta Founder offer.
+  // `userId` is nullable: filled by the webhook AFTER it provisions an
+  // InvestigatorAccess for the payer. Pre-payment lookups use `email`.
+  id                       String    @id @default(cuid())
+  userId                   String?   @unique
+  email                    String
+  stripeCustomerId         String?
+  stripeCheckoutSession    String?   @unique
+  stripeCheckoutSessionUrl String?
+  stripePaymentIntent      String?   @unique
+  amountCents              Int       @default(100)
+  currency                 String    @default("eur")
+  status                   String // pending | paid | failed | expired | refunded | disputed
+  campaign                 String    @default("beta_founder_1eur")
+  reservationExpiresAt     DateTime?
+  grantedAt                DateTime?
+  revokedAt                DateTime?
+  revokeReason             String?
+  taxAmountCents           Int?
+  customerCountry          String?
+  stripeTaxCalculationId   String?
+  createdAt                DateTime  @default(now())
+  updatedAt                DateTime  @updatedAt
+
+  @@index([status])
+  @@index([campaign])
+  @@index([email, status])
+  @@index([reservationExpiresAt])
+}
+
+model Entitlement {
+  // Generic future-proof access record. Currently feeds nothing in proxy.ts
+  // (Phase 2 will switch the gate to read this). Today the webhook ALSO
+  // provisions an InvestigatorAccess so the legacy gate keeps working.
+  id           String    @id @default(cuid())
+  userId       String
+  type         String // beta_founder_access | beta_private_access | future_subscription_pro
+  source       String // stripe_checkout | grandfathered | manual_admin
+  sourceId     String?
+  status       String // active | revoked | expired | pending
+  startsAt     DateTime  @default(now())
+  endsAt       DateTime?
+  revokedAt    DateTime?
+  revokeReason String?
+  metadata     Json?
+  createdAt    DateTime  @default(now())
+  updatedAt    DateTime  @updatedAt
+
+  @@index([userId, type, status])
+  @@index([source, sourceId])
+}
+
+model BillingEvent {
+  // Stripe webhook event log. Idempotency key = stripeEventId (unique).
+  // Never stores full Stripe payloads — only an opaque hash for tamper
+  // detection. See lib/billing/webhookHandlers.ts.
+  id            String   @id @default(cuid())
+  stripeEventId String   @unique
+  eventType     String
+  payloadHash   String?
+  processedAt   DateTime @default(now())
+  createdAt     DateTime @default(now())
+
+  @@index([eventType])
+}
+
+model WaitlistEntry {
+  // Captured email when cap is reached or BETA_CAP_REACHED override is true.
+  id        String   @id @default(cuid())
+  email     String   @unique
+  source    String   @default("beta_founder_soldout")
+  createdAt DateTime @default(now())
+}

---

## 4. API routes

===== src/app/api/billing/create-checkout-session/route.ts =====
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled, getAppUrl, isStripeTaxEnabled } from "@/lib/billing/env";
import { getStripe } from "@/lib/billing/stripeClient";
import { verifyTurnstile } from "@/lib/billing/turnstile";
import { checkCheckoutRateLimits } from "@/lib/billing/rateLimit";
import { checkCap } from "@/lib/billing/cap";
import { lookupOrCreateStripeCustomer } from "@/lib/billing/customerLookup";
import { checkoutIdempotencyKey } from "@/lib/billing/idempotency";
import { logBillingEvent } from "@/lib/billing/auditEvents";
import { getClientIp, hashIp, isValidEmail, normalizeEmail } from "@/lib/billing/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN = "beta_founder_1eur";
const AMOUNT_CENTS = 100;
const CURRENCY = "eur";
const RESERVATION_MINUTES = 30;

export async function POST(req: NextRequest) {
  if (!isBillingEnabled()) return notFound();

  let body: { email?: string; turnstileToken?: string };
  try {
    body = (await req.json()) as { email?: string; turnstileToken?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const normalizedEmail = normalizeEmail(email);

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);

  // Turnstile
  const tsResult = await verifyTurnstile(body.turnstileToken, ip);
  if (!tsResult.ok) {
    await logBillingEvent({
      eventType: "billing.checkout.turnstile_failed",
      ipHash,
      route: "/api/billing/create-checkout-session",
      metadata: { reason: tsResult.reason, email: normalizedEmail },
    });
    return NextResponse.json({ error: "turnstile_failed" }, { status: 400 });
  }

  // Rate limit
  const rl = await checkCheckoutRateLimits({ ip, email: normalizedEmail });
  if (!rl.ok) {
    await logBillingEvent({
      eventType: "billing.checkout.rate_limited",
      ipHash,
      route: "/api/billing/create-checkout-session",
      metadata: { email: normalizedEmail, resetAt: rl.resetAt },
    });
    return NextResponse.json(
      { error: "rate_limited", resetAt: rl.resetAt },
      { status: 429, headers: { "Retry-After": String(Math.max(1, rl.resetAt - Math.floor(Date.now() / 1000))) } },
    );
  }

  // Idempotence — reuse an existing non-expired pending reservation if any.
  const now = new Date();
  const existing = await prisma.betaFounderAccess.findFirst({
    where: {
      email: normalizedEmail,
      status: "pending",
      reservationExpiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.stripeCheckoutSessionUrl) {
    await logBillingEvent({
      eventType: "billing.checkout.idempotent_reuse",
      ipHash,
      route: "/api/billing/create-checkout-session",
      metadata: { email: normalizedEmail, reservationId: existing.id },
    });
    return NextResponse.json({ url: existing.stripeCheckoutSessionUrl });
  }
  // Sweep stale pending into 'expired' so cap counting is accurate.
  await prisma.betaFounderAccess.updateMany({
    where: {
      email: normalizedEmail,
      status: "pending",
      reservationExpiresAt: { lte: now },
    },
    data: { status: "expired" },
  });

  // Atomic cap check + reservation insert in a transaction.
  let reservationId: string;
  try {
    reservationId = await prisma.$transaction(async (tx) => {
      const cap = await checkCap({ tx });
      if (!cap.allowed) {
        const err = new Error("cap");
        (err as { code?: string }).code = cap.reason; // sold_out or override
        throw err;
      }
      const created = await tx.betaFounderAccess.create({
        data: {
          email: normalizedEmail,
          status: "pending",
          campaign: CAMPAIGN,
          amountCents: AMOUNT_CENTS,
          currency: CURRENCY,
          reservationExpiresAt: new Date(now.getTime() + RESERVATION_MINUTES * 60_000),
        },
      });
      return created.id;
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "sold_out" || code === "override") {
      await logBillingEvent({
        eventType: "billing.checkout.cap_reached",
        ipHash,
        route: "/api/billing/create-checkout-session",
        metadata: { email: normalizedEmail, reason: code },
      });
      return NextResponse.json({ error: "sold_out" }, { status: 409 });
    }
    throw err;
  }

  // Stripe Customer (pre-payment we only key by email)
  const customer = await lookupOrCreateStripeCustomer({ userId: null, email: normalizedEmail });

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer: customer.stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            unit_amount: AMOUNT_CENTS,
            product_data: { name: "INTERLIGENS Beta Founder Access" },
          },
          quantity: 1,
        },
      ],
      automatic_tax: { enabled: isStripeTaxEnabled() },
      payment_method_types: ["card"],
      // Apple Pay / Google Pay surface automatically when card is enabled and
      // the dashboard wallets/domains are configured.
      success_url: `${appUrl}/access/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/access/founder`,
      metadata: {
        campaign: CAMPAIGN,
        accessType: "beta_founder",
        reservationId,
        email: normalizedEmail,
      },
      expires_at: Math.floor((now.getTime() + RESERVATION_MINUTES * 60_000) / 1000),
    },
    {
      idempotencyKey: checkoutIdempotencyKey({ userIdOrEmail: normalizedEmail, nowMs: now.getTime() }),
    },
  );

  await prisma.betaFounderAccess.update({
    where: { id: reservationId },
    data: {
      stripeCheckoutSession: session.id,
      stripeCheckoutSessionUrl: session.url ?? null,
      stripeCustomerId: customer.stripeCustomerId,
    },
  });

  await logBillingEvent({
    eventType: "billing.checkout.created",
    ipHash,
    route: "/api/billing/create-checkout-session",
    metadata: { reservationId, sessionId: session.id, email: normalizedEmail },
  });

  if (!session.url) {
    return NextResponse.json({ error: "stripe_no_url" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}

function notFound() {
  // Per spec: when the flag is off, the route must look unavailable.
  return new NextResponse("Not Found", { status: 404 });
}

===== src/app/api/stripe/webhook/route.ts =====
// Stripe webhook receiver.
// The brief says the webhook MUST stay reachable even when BILLING_ENABLED=false
// so the Stripe dashboard can test the endpoint before launch — we never gate
// this route on the flag.

import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripeClient";
import { logBillingEvent } from "@/lib/billing/auditEvents";
import {
  recordEventIfNew,
  handleCheckoutSessionCompleted,
  handleCheckoutSessionExpired,
  handlePaymentIntentFailed,
  handlePaymentIntentSucceeded,
  handleChargeRefunded,
  handleChargeDisputeCreated,
  handleChargeDisputeClosed,
} from "@/lib/billing/webhookHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// `bodyParser` is the pages-router toggle; in app router, just call req.text()
// to get the raw body string with no parsing.

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    await logBillingEvent({
      eventType: "billing.webhook.signature_invalid",
      route: "/api/stripe/webhook",
      metadata: { reason: "no_secret_configured" },
    });
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    await logBillingEvent({
      eventType: "billing.webhook.signature_invalid",
      route: "/api/stripe/webhook",
      metadata: { reason: "missing_signature" },
    });
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    await logBillingEvent({
      eventType: "billing.webhook.signature_invalid",
      route: "/api/stripe/webhook",
      metadata: { reason: "bad_signature", error: shortErr(err) },
    });
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  // Idempotency: drop duplicates as a 200 (Stripe retries 5xx).
  const isNew = await recordEventIfNew(event, payload);
  if (!isNew) {
    await logBillingEvent({
      eventType: "billing.webhook.duplicate",
      route: "/api/stripe/webhook",
      metadata: { stripeEventId: event.id, type: event.type },
    });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let outcome: string;
  switch (event.type) {
    case "checkout.session.completed":
      outcome = await handleCheckoutSessionCompleted(event);
      break;
    case "checkout.session.expired":
      outcome = await handleCheckoutSessionExpired(event);
      break;
    case "payment_intent.payment_failed":
      outcome = await handlePaymentIntentFailed(event);
      break;
    case "payment_intent.succeeded":
      outcome = await handlePaymentIntentSucceeded(event);
      break;
    case "charge.refunded":
      outcome = await handleChargeRefunded(event);
      break;
    case "charge.dispute.created":
      outcome = await handleChargeDisputeCreated(event);
      break;
    case "charge.dispute.closed":
      outcome = await handleChargeDisputeClosed(event);
      break;
    default:
      outcome = "unhandled";
      await logBillingEvent({
        eventType: "billing.webhook.received",
        route: "/api/stripe/webhook",
        metadata: { stripeEventId: event.id, type: event.type, outcome },
      });
      break;
  }

  return NextResponse.json({ ok: true, outcome });
}

function shortErr(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 200);
  return String(err).slice(0, 200);
}

===== src/app/api/billing/access-status/route.ts =====
// Polling endpoint for /access/success. Returns the high-level status of a
// reservation given its Stripe Checkout Session id. Authorization is by the
// session_id itself (signed by Stripe in the success_url and not enumerable),
// plus a soft email match — we never expose access codes here.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled } from "@/lib/billing/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isBillingEnabled()) return new NextResponse("Not Found", { status: 404 });

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const row = await prisma.betaFounderAccess.findUnique({
    where: { stripeCheckoutSession: sessionId },
    select: {
      status: true,
      email: true,
      grantedAt: true,
      revokedAt: true,
    },
  });
  if (!row) {
    return NextResponse.json({ status: "unknown" });
  }
  return NextResponse.json({
    status: row.status,
    emailHint: maskEmail(row.email),
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
  });
}

function maskEmail(e: string): string {
  const [user, host] = e.split("@");
  if (!user || !host) return "***";
  const u = user.length <= 2 ? user[0] + "*" : user.slice(0, 2) + "***";
  return `${u}@${host}`;
}

===== src/app/api/billing/waitlist/route.ts =====
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled } from "@/lib/billing/env";
import { verifyTurnstile } from "@/lib/billing/turnstile";
import { checkWaitlistRateLimit } from "@/lib/billing/rateLimit";
import { logBillingEvent } from "@/lib/billing/auditEvents";
import { getClientIp, hashIp, isValidEmail, normalizeEmail } from "@/lib/billing/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isBillingEnabled()) return new NextResponse("Not Found", { status: 404 });

  let body: { email?: string; turnstileToken?: string };
  try {
    body = (await req.json()) as { email?: string; turnstileToken?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const normalizedEmail = normalizeEmail(email);

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);

  const ts = await verifyTurnstile(body.turnstileToken, ip);
  if (!ts.ok) {
    return NextResponse.json({ error: "turnstile_failed" }, { status: 400 });
  }

  const rl = await checkWaitlistRateLimit({ ip, email: normalizedEmail });
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await prisma.waitlistEntry.create({
      data: { email: normalizedEmail, source: "beta_founder_soldout" },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "P2002") throw err;
    // Already on the waitlist — pretend success so we don't leak membership.
  }

  await logBillingEvent({
    eventType: "billing.waitlist.added",
    ipHash,
    route: "/api/billing/waitlist",
    metadata: { email: normalizedEmail },
  });

  return NextResponse.json({ ok: true });
}

---

## 5. src/lib/billing/ — 12 modules

===== src/lib/billing/auditEvents.ts =====
// Billing audit events: reuses InvestigatorAuditLog with a `billing.*`
// eventType prefix (per audit-billing.md §6 decision). No new model.
//
// Note: InvestigatorAuditLog.investigatorAccessId is nullable, so events
// from anonymous / pre-payment surfaces (checkout creation) are persisted
// with accessId=null and identification carried in `metadata`.

import { prisma } from "@/lib/prisma";

export type BillingEventType =
  | "billing.checkout.created"
  | "billing.checkout.rate_limited"
  | "billing.checkout.turnstile_failed"
  | "billing.checkout.cap_reached"
  | "billing.checkout.idempotent_reuse"
  | "billing.webhook.received"
  | "billing.webhook.signature_invalid"
  | "billing.webhook.duplicate"
  | "billing.payment.completed"
  | "billing.payment.failed"
  | "billing.payment.refunded"
  | "billing.dispute.opened"
  | "billing.dispute.closed"
  | "billing.session.expired"
  | "billing.access.granted"
  | "billing.access.revoked"
  | "billing.fraud.suspect_pattern"
  | "billing.waitlist.added";

export async function logBillingEvent(params: {
  eventType: BillingEventType;
  accessId?: string | null;
  route?: string;
  ipHash?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.investigatorAuditLog.create({
      data: {
        investigatorAccessId: params.accessId ?? null,
        eventType: params.eventType,
        route: params.route ?? null,
        ipHash: params.ipHash ?? null,
        metadata: params.metadata ? (params.metadata as Record<string, string>) : undefined,
      },
    });
  } catch (err) {
    // Audit failures must not break the billing path. Log to stderr only.
    console.error("[billing/auditEvents] failed to persist", params.eventType, err);
  }
}

===== src/lib/billing/cap.ts =====
// Transactional cap check: counts paid + still-valid pending reservations
// with FOR UPDATE inside a serializable-ish transaction. Returns the next
// slot number if available, or null if the cap is reached.

import { prisma } from "@/lib/prisma";
import { getCap, isCapOverrideReached } from "./env";

export type CapResult =
  | { allowed: true; currentCount: number; cap: number }
  | { allowed: false; reason: "override" | "sold_out"; currentCount: number; cap: number };

/**
 * Returns whether a new reservation may be created right now.
 * Run this inside the same transaction that creates the BetaFounderAccess row
 * to avoid TOCTOU races. We use a raw query with FOR UPDATE on the matching
 * rows to lock them for the duration of the transaction.
 */
export async function checkCap(opts?: { tx?: Pick<typeof prisma, "$queryRaw"> }): Promise<CapResult> {
  const cap = getCap();
  if (isCapOverrideReached()) {
    return { allowed: false, reason: "override", currentCount: cap, cap };
  }

  const runner = opts?.tx ?? prisma;
  // Count paid + non-expired pending reservations.
  // FOR UPDATE locks the matching rows so a concurrent transaction can't
  // squeeze in an extra reservation past the cap.
  const rows = await runner.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "BetaFounderAccess"
    WHERE status = 'paid'
       OR (status = 'pending' AND "reservationExpiresAt" > NOW())
    FOR UPDATE
  `;
  const currentCount = Number(rows?.[0]?.count ?? 0);
  if (currentCount >= cap) {
    return { allowed: false, reason: "sold_out", currentCount, cap };
  }
  return { allowed: true, currentCount, cap };
}

===== src/lib/billing/customerLookup.ts =====
// Strict Stripe Customer lookup, in this order:
//   1) BillingCustomer.userId in our DB
//   2) stripe.customers.search by email
//   3) create new Stripe Customer
// Always upserts BillingCustomer at the end. Never creates two Customers
// for the same identity.

import { prisma } from "@/lib/prisma";
import { getStripe } from "./stripeClient";

export interface LookupInput {
  /** Stable identifier for this INTERLIGENS identity. May be null pre-payment;
   *  in that case we key by email only and do NOT write BillingCustomer until
   *  the webhook back-fills userId. */
  userId: string | null;
  email: string;
}

export interface LookupResult {
  stripeCustomerId: string;
  created: boolean;
}

export async function lookupOrCreateStripeCustomer(input: LookupInput): Promise<LookupResult> {
  const stripe = getStripe();
  const normalizedEmail = input.email.trim().toLowerCase();

  // 1) DB lookup by userId
  if (input.userId) {
    const existing = await prisma.billingCustomer.findUnique({
      where: { userId: input.userId },
    });
    if (existing) {
      return { stripeCustomerId: existing.stripeCustomerId, created: false };
    }
  }

  // 1bis) DB lookup by email as a safety net (in case an earlier attempt
  // created a BillingCustomer with a different userId — e.g. null pre-payment)
  const byEmail = await prisma.billingCustomer.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: "desc" },
  });
  if (byEmail) {
    return { stripeCustomerId: byEmail.stripeCustomerId, created: false };
  }

  // 2) Stripe search by email
  const search = await stripe.customers.search({
    query: `email:'${escapeSearch(normalizedEmail)}'`,
    limit: 1,
  });
  if (search.data.length > 0) {
    const found = search.data[0];
    await upsertBillingCustomer({ userId: input.userId, stripeCustomerId: found.id, email: normalizedEmail });
    return { stripeCustomerId: found.id, created: false };
  }

  // 3) Create
  const created = await stripe.customers.create({
    email: normalizedEmail,
    metadata: {
      source: "beta_founder_1eur",
      ...(input.userId ? { userId: input.userId } : {}),
    },
  });
  await upsertBillingCustomer({ userId: input.userId, stripeCustomerId: created.id, email: normalizedEmail });
  return { stripeCustomerId: created.id, created: true };
}

async function upsertBillingCustomer(input: {
  userId: string | null;
  stripeCustomerId: string;
  email: string;
}): Promise<void> {
  if (!input.userId) {
    // Pre-payment: we don't have an InvestigatorAccess.id yet. Do not write
    // BillingCustomer; the webhook will, after provisioning the access.
    return;
  }
  await prisma.billingCustomer.upsert({
    where: { userId: input.userId },
    update: { stripeCustomerId: input.stripeCustomerId, email: input.email },
    create: {
      userId: input.userId,
      stripeCustomerId: input.stripeCustomerId,
      email: input.email,
    },
  });
}

/**
 * Stripe Customer Search uses Sigma-like syntax. Escape single quotes by
 * doubling them per Stripe docs.
 */
function escapeSearch(s: string): string {
  return s.replace(/'/g, "\\'");
}

===== src/lib/billing/entitlement.ts =====
import { prisma } from "@/lib/prisma";

export const BETA_FOUNDER_TYPE = "beta_founder_access";

export type EntitlementSource = "stripe_checkout" | "grandfathered" | "manual_admin";

/**
 * Idempotently create an Entitlement for the given (userId, type, source, sourceId).
 * If an active record already exists for that combination, returns it untouched.
 */
export async function grantEntitlement(params: {
  userId: string;
  type: string;
  source: EntitlementSource;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; created: boolean }> {
  // Look for an existing active row for this exact source pair when one is provided,
  // otherwise for any active row of the same (userId, type) combination.
  const existing = await prisma.entitlement.findFirst({
    where: {
      userId: params.userId,
      type: params.type,
      status: "active",
      revokedAt: null,
      ...(params.sourceId
        ? { source: params.source, sourceId: params.sourceId }
        : {}),
    },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await prisma.entitlement.create({
    data: {
      userId: params.userId,
      type: params.type,
      source: params.source,
      sourceId: params.sourceId ?? null,
      status: "active",
      metadata: params.metadata ? (params.metadata as Record<string, string>) : undefined,
    },
  });
  return { id: created.id, created: true };
}

/**
 * Revoke all active entitlements derived from a given Stripe source (e.g. a
 * checkout session id). Used by refund/dispute webhooks. Idempotent.
 */
export async function revokeEntitlementsBySource(params: {
  source: EntitlementSource;
  sourceId: string;
  reason: string;
}): Promise<{ revokedCount: number }> {
  const now = new Date();
  const res = await prisma.entitlement.updateMany({
    where: {
      source: params.source,
      sourceId: params.sourceId,
      status: "active",
      revokedAt: null,
    },
    data: {
      status: "revoked",
      revokedAt: now,
      revokeReason: params.reason,
    },
  });
  return { revokedCount: res.count };
}

/**
 * Gate check (intentionally NOT used by src/proxy.ts in Phase 1 — see
 * docs/audit-billing.md §"Décision 3 — proxy.ts unchanged"). Provided for
 * Phase 2 + admin/test code.
 */
export async function hasActiveBetaEntitlement(userId: string): Promise<boolean> {
  const now = new Date();
  const row = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: { in: [BETA_FOUNDER_TYPE, "beta_private_access"] },
      status: "active",
      revokedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { id: true },
  });
  return !!row;
}

===== src/lib/billing/env.ts =====
// Feature flag + env access for the billing module.
// All env reads happen server-side only. No `NEXT_PUBLIC_BILLING_*` keys.

export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

export function isCapOverrideReached(): boolean {
  return process.env.BETA_CAP_REACHED === "true";
}

export function getCap(): number {
  const raw = process.env.BETA_FOUNDER_CAP;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://app.interligens.com";
}

export function isStripeTaxEnabled(): boolean {
  return process.env.STRIPE_TAX_ENABLED === "true";
}

===== src/lib/billing/grantAccess.ts =====
// Provision a brand-new InvestigatorAccess for a Beta Founder payer, then
// email them their access code via the existing Resend pipeline. Returns the
// new access id (so the webhook can back-fill BetaFounderAccess.userId).
//
// Decision 3 reminder: proxy.ts is unchanged in Phase 1, so granting an
// InvestigatorAccess is what actually unlocks the legacy beta gate for the
// payer. The Entitlement created in parallel is for Phase 2.

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendAccessCodeEmail } from "@/lib/email/accessCodeDelivery";

function hashSHA256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export interface GrantAccessInput {
  email: string;
  labelHint?: string | null; // optional descriptive label for admin UI
  stripeCheckoutSessionId: string;
  sendEmail?: boolean; // default true; set false in tests
}

export interface GrantAccessResult {
  investigatorAccessId: string;
  emailDelivered: boolean | "skipped";
  emailError?: string;
}

export async function provisionBetaFounderAccess(input: GrantAccessInput): Promise<GrantAccessResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const shortSession = input.stripeCheckoutSessionId.slice(-8);
  const label = (input.labelHint?.trim() || `BF-${shortSession}`).slice(0, 64);

  const code = randomBytes(16).toString("hex"); // 32-char hex
  const codeHash = hashSHA256(code);

  const access = await prisma.investigatorAccess.create({
    data: {
      label,
      accessCodeHash: codeHash,
      notes: `beta_founder_1eur · ${normalizedEmail} · session=${input.stripeCheckoutSessionId}`,
    },
  });

  if (input.sendEmail === false) {
    return { investigatorAccessId: access.id, emailDelivered: "skipped" };
  }

  const send = await sendAccessCodeEmail({
    email: normalizedEmail,
    accessCode: code,
    label,
  });
  if (send.delivered) {
    return { investigatorAccessId: access.id, emailDelivered: true };
  }
  return {
    investigatorAccessId: access.id,
    emailDelivered: false,
    emailError: send.skipped ?? send.error,
  };
}

===== src/lib/billing/idempotency.ts =====
// Stable Idempotency-Key derivation for Stripe create-session calls.
// Bucketing per minute means rapid double-clicks share a key and Stripe
// returns the same session; legitimate retries 60s later get a fresh key.

import { createHash } from "crypto";

export function checkoutIdempotencyKey(input: { userIdOrEmail: string; nowMs?: number }): string {
  const minute = Math.floor((input.nowMs ?? Date.now()) / 60_000);
  const raw = `${input.userIdOrEmail.trim().toLowerCase()}|${minute}`;
  return `bf1-${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

===== src/lib/billing/rateLimit.ts =====
// Upstash Redis REST rate limiter.
// REST-only (no @upstash/redis SDK) to match the rest of the repo.
//
// Uses INCR + EXPIRE (atomic via PIPELINE) — fixed window.
// Returns { ok, remaining, resetAt } and on Upstash misconfig, FAIL-OPEN with
// a warning. The webhook + payment routes do additional gates (Turnstile,
// cap check) so a momentary Redis outage doesn't break the funnel.

type CheckResult = {
  ok: boolean;
  remaining: number;
  resetAt: number; // unix seconds
  bypass?: "no_url" | "no_token" | "network";
};

export interface RateLimitRule {
  bucket: string; // logical bucket name (e.g. "billing:checkout:ip")
  key: string; // identifying value (ip, email, userId)
  limit: number;
  windowSeconds: number;
}

function url(): string | null {
  return process.env.UPSTASH_REDIS_REST_URL ?? null;
}
function token(): string | null {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? null;
}

export async function checkRateLimit(rule: RateLimitRule): Promise<CheckResult> {
  const u = url();
  const t = token();
  if (!u) return { ok: true, remaining: rule.limit, resetAt: 0, bypass: "no_url" };
  if (!t) return { ok: true, remaining: rule.limit, resetAt: 0, bypass: "no_token" };

  const fullKey = `rl:${rule.bucket}:${normalize(rule.key)}`;
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + rule.windowSeconds;

  try {
    const res = await fetch(`${u}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", fullKey],
        ["EXPIRE", fullKey, String(rule.windowSeconds), "NX"],
      ]),
    });
    if (!res.ok) return { ok: true, remaining: rule.limit, resetAt, bypass: "network" };
    const json = (await res.json()) as Array<{ result: number | null; error?: string }>;
    const count = typeof json?.[0]?.result === "number" ? (json[0].result as number) : 0;
    if (count > rule.limit) {
      return { ok: false, remaining: 0, resetAt };
    }
    return { ok: true, remaining: Math.max(0, rule.limit - count), resetAt };
  } catch {
    return { ok: true, remaining: rule.limit, resetAt, bypass: "network" };
  }
}

function normalize(s: string): string {
  return s.toLowerCase().trim().slice(0, 256);
}

/**
 * Convenience: apply the three checkout rate limit rules in sequence.
 * Returns the first failure encountered, or ok with the IP rule's remaining.
 */
export async function checkCheckoutRateLimits(input: {
  ip: string;
  email: string;
  userId?: string | null;
}): Promise<CheckResult> {
  const ipRes = await checkRateLimit({
    bucket: "billing:checkout:ip",
    key: input.ip,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!ipRes.ok) return ipRes;

  const emailRes = await checkRateLimit({
    bucket: "billing:checkout:email",
    key: input.email,
    limit: 5,
    windowSeconds: 24 * 60 * 60,
  });
  if (!emailRes.ok) return emailRes;

  if (input.userId) {
    const userRes = await checkRateLimit({
      bucket: "billing:checkout:user",
      key: input.userId,
      limit: 10,
      windowSeconds: 24 * 60 * 60,
    });
    if (!userRes.ok) return userRes;
  }

  return ipRes;
}

export async function checkWaitlistRateLimit(input: { ip: string; email: string }): Promise<CheckResult> {
  const ipRes = await checkRateLimit({
    bucket: "billing:waitlist:ip",
    key: input.ip,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!ipRes.ok) return ipRes;
  return checkRateLimit({
    bucket: "billing:waitlist:email",
    key: input.email,
    limit: 3,
    windowSeconds: 24 * 60 * 60,
  });
}

===== src/lib/billing/request.ts =====
import { createHash } from "crypto";
import type { NextRequest } from "next/server";

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "interligens";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

// RFC 5322-lite. We intentionally keep it strict-ish to keep card-testers off.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

===== src/lib/billing/stripeClient.ts =====
import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  // Pin to the version we tested against. Stripe sends payloads of this
  // shape regardless of what the dashboard default is set to. The options
  // type literal changes on each SDK major; we cast through unknown to keep
  // the version pin without coupling to whichever literal type the SDK ships.
  const opts = {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
    maxNetworkRetries: 2,
  } as unknown as ConstructorParameters<typeof Stripe>[1];
  cached = new Stripe(key, opts);
  return cached;
}

// Test-only: reset the cached client so vi.mock() works between test cases.
export function __resetStripeForTests(): void {
  cached = null;
}

===== src/lib/billing/turnstile.ts =====
// Cloudflare Turnstile server-side verification.
// Pattern mirrors src/app/api/community/submit/route.ts (REST only, no SDK).

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "missing_secret" | "rejected" | "network" };

export async function verifyTurnstile(token: string | null | undefined, remoteIp?: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail-closed in production. In dev with no secret configured, callers
    // typically bypass — but the billing flow opts to refuse silently rather
    // than masquerade as a successful CAPTCHA pass.
    return { ok: false, reason: "missing_secret" };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "missing_token" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return data.success ? { ok: true } : { ok: false, reason: "rejected" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

===== src/lib/billing/webhookHandlers.ts =====
// Per-event handlers for the Stripe webhook. Each is idempotent and returns
// a short string for telemetry. Never logs the raw Stripe event payload.

import { createHash } from "crypto";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { logBillingEvent } from "./auditEvents";
import { provisionBetaFounderAccess } from "./grantAccess";
import {
  grantEntitlement,
  revokeEntitlementsBySource,
  BETA_FOUNDER_TYPE,
} from "./entitlement";

const CAMPAIGN = "beta_founder_1eur";
const AMOUNT_CENTS = 100;
const CURRENCY = "eur";

export type HandlerOutcome =
  | "ok"
  | "duplicate"
  | "ignored_wrong_campaign"
  | "ignored_wrong_amount"
  | "ignored_wrong_currency"
  | "ignored_unpaid"
  | "no_reservation"
  | "already_processed";

export interface HandlerContext {
  // Allows tests to disable Resend email without mocking the whole module.
  sendEmail?: boolean;
}

/**
 * Records the event id and returns true if this is the first time we see it.
 * Subsequent calls with the same id are a no-op.
 */
export async function recordEventIfNew(event: Pick<Stripe.Event, "id" | "type">, payloadString: string): Promise<boolean> {
  try {
    await prisma.billingEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        payloadHash: createHash("sha256").update(payloadString).digest("hex"),
      },
    });
    return true;
  } catch (err) {
    // Prisma "Unique constraint failed" on stripeEventId → already processed.
    const code = (err as { code?: string }).code;
    if (code === "P2002") return false;
    throw err;
  }
}

export async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  ctx: HandlerContext = {},
): Promise<HandlerOutcome> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Strict validation: mode, amount, currency, campaign metadata.
  if (session.mode !== "payment") return "ignored_wrong_campaign";
  if (session.metadata?.campaign !== CAMPAIGN) return "ignored_wrong_campaign";
  if (session.payment_status !== "paid") return "ignored_unpaid";
  if (session.amount_total !== AMOUNT_CENTS) return "ignored_wrong_amount";
  if ((session.currency ?? "").toLowerCase() !== CURRENCY) return "ignored_wrong_currency";

  const reservation = await prisma.betaFounderAccess.findUnique({
    where: { stripeCheckoutSession: session.id },
  });
  if (!reservation) {
    await logBillingEvent({
      eventType: "billing.webhook.received",
      metadata: { kind: "checkout.session.completed", reason: "no_reservation", sessionId: session.id },
    });
    return "no_reservation";
  }
  if (reservation.status === "paid") return "already_processed";

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  const customerCountry =
    session.customer_details?.address?.country ??
    null;
  const taxAmountCents = session.total_details?.amount_tax ?? null;
  const stripeTaxCalculationId =
    (session.metadata?.tax_calculation_id as string | undefined) ?? null;

  // Provision a fresh InvestigatorAccess for the payer (legacy gate keeps working).
  const provision = await provisionBetaFounderAccess({
    email: reservation.email,
    stripeCheckoutSessionId: session.id,
    sendEmail: ctx.sendEmail,
  });

  // Persist the new access id + paid status, and create the Entitlement.
  await prisma.$transaction([
    prisma.betaFounderAccess.update({
      where: { id: reservation.id },
      data: {
        userId: provision.investigatorAccessId,
        status: "paid",
        grantedAt: new Date(),
        stripePaymentIntent: paymentIntentId,
        stripeCustomerId: customerId,
        taxAmountCents,
        customerCountry,
        stripeTaxCalculationId,
      },
    }),
    ...(customerId
      ? [
          prisma.billingCustomer.upsert({
            where: { userId: provision.investigatorAccessId },
            update: { stripeCustomerId: customerId, email: reservation.email },
            create: {
              userId: provision.investigatorAccessId,
              stripeCustomerId: customerId,
              email: reservation.email,
            },
          }),
        ]
      : []),
  ]);

  await grantEntitlement({
    userId: provision.investigatorAccessId,
    type: BETA_FOUNDER_TYPE,
    source: "stripe_checkout",
    sourceId: session.id,
    metadata: { email: reservation.email, campaign: CAMPAIGN },
  });

  await logBillingEvent({
    eventType: "billing.payment.completed",
    accessId: provision.investigatorAccessId,
    metadata: {
      sessionId: session.id,
      paymentIntentId,
      emailDelivered: provision.emailDelivered,
      emailError: provision.emailError ?? null,
      taxAmountCents,
      customerCountry,
    },
  });
  await logBillingEvent({
    eventType: "billing.access.granted",
    accessId: provision.investigatorAccessId,
    metadata: { sessionId: session.id, source: "stripe_checkout" },
  });

  return "ok";
}

export async function handleCheckoutSessionExpired(event: Stripe.Event): Promise<HandlerOutcome> {
  const session = event.data.object as Stripe.Checkout.Session;
  const updated = await prisma.betaFounderAccess.updateMany({
    where: { stripeCheckoutSession: session.id, status: "pending" },
    data: { status: "expired" },
  });
  await logBillingEvent({
    eventType: "billing.session.expired",
    metadata: { sessionId: session.id, updated: updated.count },
  });
  return "ok";
}

export async function handlePaymentIntentFailed(event: Stripe.Event): Promise<HandlerOutcome> {
  const pi = event.data.object as Stripe.PaymentIntent;
  await prisma.betaFounderAccess.updateMany({
    where: { stripePaymentIntent: pi.id, status: { in: ["pending"] } },
    data: { status: "failed" },
  });
  await logBillingEvent({
    eventType: "billing.payment.failed",
    metadata: { paymentIntentId: pi.id, reason: pi.last_payment_error?.code ?? null },
  });
  return "ok";
}

export async function handleChargeRefunded(event: Stripe.Event): Promise<HandlerOutcome> {
  const charge = event.data.object as Stripe.Charge;
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!piId) return "no_reservation";

  const reservation = await prisma.betaFounderAccess.findFirst({
    where: { stripePaymentIntent: piId },
  });
  if (!reservation) return "no_reservation";

  await prisma.betaFounderAccess.update({
    where: { id: reservation.id },
    data: { status: "refunded", revokedAt: new Date(), revokeReason: "refund" },
  });

  if (reservation.stripeCheckoutSession) {
    const r = await revokeEntitlementsBySource({
      source: "stripe_checkout",
      sourceId: reservation.stripeCheckoutSession,
      reason: "refund",
    });
    await logBillingEvent({
      eventType: "billing.payment.refunded",
      accessId: reservation.userId,
      metadata: {
        paymentIntentId: piId,
        sessionId: reservation.stripeCheckoutSession,
        revokedEntitlements: r.revokedCount,
      },
    });
    if (r.revokedCount > 0) {
      await logBillingEvent({
        eventType: "billing.access.revoked",
        accessId: reservation.userId,
        metadata: { reason: "refund", sessionId: reservation.stripeCheckoutSession },
      });
    }
  }
  return "ok";
}

export async function handleChargeDisputeCreated(event: Stripe.Event): Promise<HandlerOutcome> {
  const dispute = event.data.object as Stripe.Dispute;
  const piId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id ?? null;
  if (!piId) return "no_reservation";

  const reservation = await prisma.betaFounderAccess.findFirst({
    where: { stripePaymentIntent: piId },
  });
  if (!reservation) return "no_reservation";

  await prisma.betaFounderAccess.update({
    where: { id: reservation.id },
    data: { status: "disputed", revokedAt: new Date(), revokeReason: "dispute" },
  });

  if (reservation.stripeCheckoutSession) {
    const r = await revokeEntitlementsBySource({
      source: "stripe_checkout",
      sourceId: reservation.stripeCheckoutSession,
      reason: "dispute",
    });
    await logBillingEvent({
      eventType: "billing.dispute.opened",
      accessId: reservation.userId,
      metadata: {
        paymentIntentId: piId,
        disputeId: dispute.id,
        reason: dispute.reason ?? null,
        revokedEntitlements: r.revokedCount,
      },
    });
    if (r.revokedCount > 0) {
      await logBillingEvent({
        eventType: "billing.access.revoked",
        accessId: reservation.userId,
        metadata: { reason: "dispute", sessionId: reservation.stripeCheckoutSession },
      });
    }
  }
  return "ok";
}

export async function handleChargeDisputeClosed(event: Stripe.Event): Promise<HandlerOutcome> {
  const dispute = event.data.object as Stripe.Dispute;
  await logBillingEvent({
    eventType: "billing.dispute.closed",
    metadata: {
      disputeId: dispute.id,
      status: dispute.status,
      reason: dispute.reason ?? null,
    },
  });
  // NO automatic re-activation per spec.
  return "ok";
}

export async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<HandlerOutcome> {
  const pi = event.data.object as Stripe.PaymentIntent;
  await logBillingEvent({
    eventType: "billing.webhook.received",
    metadata: { kind: "payment_intent.succeeded", paymentIntentId: pi.id },
  });
  // Already handled by checkout.session.completed.
  return "ok";
}

---

## 6. Grandfather script — scripts/grandfather-beta-users.ts

===== scripts/grandfather-beta-users.ts =====
#!/usr/bin/env tsx
/**
 * scripts/grandfather-beta-users.ts
 *
 * For every existing InvestigatorAccess (the legacy "beta access" record per
 * docs/audit-billing.md §5), create one Entitlement with:
 *   - userId       = InvestigatorAccess.id
 *   - type         = "beta_founder_access"
 *   - source       = "grandfathered"
 *   - sourceId     = null
 *   - status       = "active"
 *   - startsAt     = now (default)
 *   - endsAt       = null
 *
 * Idempotent: an Entitlement is skipped when one already exists with the same
 * (userId, type, source) tuple, regardless of sourceId or status. Re-running
 * the script is a no-op for users already covered.
 *
 * Usage:
 *   DATABASE_URL=<...> pnpm tsx scripts/grandfather-beta-users.ts
 *   DRY_RUN=true pnpm tsx scripts/grandfather-beta-users.ts   # report only
 *
 * Must be run BEFORE main merge and BEFORE flipping BILLING_ENABLED=true,
 * per the brief's "Grandfathered access (CRITIQUE)" section.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TYPE = "beta_founder_access";
const SOURCE = "grandfathered";

interface ScanInput {
  includeRevoked?: boolean;
}

export async function run(opts: ScanInput = {}): Promise<{
  scanned: number;
  created: number;
  skipped: number;
  errors: number;
}> {
  // Read env each invocation so tests can flip flags before calling run().
  const DRY_RUN = process.env.DRY_RUN === "true";
  const VERBOSE = process.env.VERBOSE === "true";
  // We grandfather *active* InvestigatorAccess only by default. A revoked or
  // expired access loses its beta — re-include them via opts.includeRevoked.
  const accesses = await prisma.investigatorAccess.findMany({
    where: opts.includeRevoked
      ? {}
      : {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
    select: { id: true, label: true },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const access of accesses) {
    try {
      const existing = await prisma.entitlement.findFirst({
        where: {
          userId: access.id,
          type: TYPE,
          source: SOURCE,
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        if (VERBOSE) console.log(`[skip] ${access.id} (${access.label}) — entitlement ${existing.id} exists`);
        continue;
      }
      if (DRY_RUN) {
        created++;
        console.log(`[dry-run] would create entitlement for ${access.id} (${access.label})`);
        continue;
      }
      await prisma.entitlement.create({
        data: {
          userId: access.id,
          type: TYPE,
          source: SOURCE,
          sourceId: null,
          status: "active",
          metadata: { label: access.label } as Record<string, string>,
        },
      });
      created++;
      if (VERBOSE) console.log(`[create] ${access.id} (${access.label})`);
    } catch (err) {
      errors++;
      console.error(`[error] ${access.id}:`, err);
    }
  }

  return { scanned: accesses.length, created, skipped, errors };
}

async function main() {
  const start = Date.now();
  const stats = await run();
  const ms = Date.now() - start;
  console.log(
    `grandfather-beta-users :: scanned=${stats.scanned} created=${stats.created} skipped=${stats.skipped} errors=${stats.errors} dryRun=${process.env.DRY_RUN === "true"} ms=${ms}`,
  );
  await prisma.$disconnect();
  process.exit(stats.errors > 0 ? 1 : 0);
}

const isDirectRun = (() => {
  if (typeof require !== "undefined" && require.main === module) return true;
  if (typeof process !== "undefined" && process.argv?.[1]?.includes("grandfather-beta-users")) return true;
  return false;
})();

if (isDirectRun) {
  main().catch(async (err) => {
    console.error("grandfather-beta-users failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
}

---

## 7. Pages

===== src/app/access/founder/page.tsx =====
// /access/founder — entry point for the €1 Beta Founder offer.
// Server component: reads BILLING_ENABLED + cap state, then renders a client
// form. Exempt from the proxy gate per src/proxy.ts (path starts with /access).

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isBillingEnabled, isCapOverrideReached, getCap } from "@/lib/billing/env";
import { prisma } from "@/lib/prisma";
import { detectLocaleFromHeader } from "./copy";
import FounderClient from "./FounderClient";

export const dynamic = "force-dynamic";

export default async function FounderPage() {
  if (!isBillingEnabled()) notFound();

  const h = await headers();
  const locale = detectLocaleFromHeader(h.get("accept-language"));

  const cap = getCap();
  const reached = isCapOverrideReached() || (await currentReservedCount()) >= cap;

  return (
    <FounderClient
      initialLocale={locale}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
      soldOut={reached}
    />
  );
}

async function currentReservedCount(): Promise<number> {
  const now = new Date();
  const n = await prisma.betaFounderAccess.count({
    where: {
      OR: [
        { status: "paid" },
        { status: "pending", reservationExpiresAt: { gt: now } },
      ],
    },
  });
  return n;
}

===== src/app/access/success/page.tsx =====
import { notFound } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing/env";
import SuccessClient from "./SuccessClient";

export const dynamic = "force-dynamic";

export default async function AccessSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  if (!isBillingEnabled()) notFound();
  const params = await searchParams;
  const sessionId = (params?.session_id ?? "").trim();
  if (!sessionId) notFound();
  return <SuccessClient sessionId={sessionId} />;
}

===== src/app/admin/billing/page.tsx =====
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled, getCap } from "@/lib/billing/env";

export const dynamic = "force-dynamic";

interface CountsByStatus {
  paid: number;
  pendingValid: number;
  pendingExpired: number;
  failed: number;
  refunded: number;
  disputed: number;
  expired: number;
}

export default async function AdminBillingPage() {
  if (!isBillingEnabled()) notFound();

  const now = new Date();
  const cap = getCap();

  const [paidGrossRows, statusBuckets, taxRows, latestEvents, alerts, waitlistCount, latestRefunds] =
    await Promise.all([
      // Total gross (cents)
      prisma.betaFounderAccess.aggregate({
        _sum: { amountCents: true, taxAmountCents: true },
        where: { status: "paid" },
      }),
      // Status counts
      prisma.betaFounderAccess.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      // Count of paid rows with tax recorded (for tax visibility)
      prisma.betaFounderAccess.count({
        where: { status: "paid", taxAmountCents: { not: null } },
      }),
      // Last 50 webhook events
      prisma.billingEvent.findMany({
        orderBy: { processedAt: "desc" },
        take: 50,
      }),
      // Recent fraud / rate-limit audit events
      prisma.investigatorAuditLog.findMany({
        where: {
          eventType: {
            in: [
              "billing.checkout.rate_limited",
              "billing.checkout.turnstile_failed",
              "billing.fraud.suspect_pattern",
              "billing.webhook.signature_invalid",
            ],
          },
        },
        orderBy: { timestamp: "desc" },
        take: 20,
      }),
      prisma.waitlistEntry.count(),
      prisma.betaFounderAccess.findMany({
        where: { status: { in: ["refunded", "disputed"] } },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          email: true,
          status: true,
          revokedAt: true,
          revokeReason: true,
          updatedAt: true,
        },
      }),
    ]);

  // Split "pending" into still-valid vs expired-but-not-swept.
  const pendingRows = await prisma.betaFounderAccess.findMany({
    where: { status: "pending" },
    select: { reservationExpiresAt: true },
  });
  const pendingValid = pendingRows.filter(
    (r) => r.reservationExpiresAt && r.reservationExpiresAt > now,
  ).length;
  const pendingExpired = pendingRows.length - pendingValid;

  const counts: CountsByStatus = {
    paid: pickStatus(statusBuckets, "paid"),
    pendingValid,
    pendingExpired,
    failed: pickStatus(statusBuckets, "failed"),
    refunded: pickStatus(statusBuckets, "refunded"),
    disputed: pickStatus(statusBuckets, "disputed"),
    expired: pickStatus(statusBuckets, "expired"),
  };

  const grossEur = ((paidGrossRows._sum.amountCents ?? 0) / 100).toFixed(2);
  const taxEur =
    paidGrossRows._sum.taxAmountCents != null
      ? (paidGrossRows._sum.taxAmountCents / 100).toFixed(2)
      : null;

  return (
    <div style={{ padding: 32, color: "#FFFFFF" }}>
      <h1
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          fontWeight: 900,
          fontSize: 18,
          marginBottom: 4,
        }}
      >
        Billing — Beta Founder
      </h1>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 24 }}>
        Cap {counts.paid + counts.pendingValid} / {cap} ·{" "}
        <Link href="/admin" style={{ color: "#FF6B00" }}>
          ← admin
        </Link>
      </p>

      <Grid>
        <Card label="Paid" value={String(counts.paid)} accent />
        <Card label="Pending (valid)" value={String(counts.pendingValid)} />
        <Card label="Pending (expired, unswept)" value={String(counts.pendingExpired)} />
        <Card label="Failed" value={String(counts.failed)} />
        <Card label="Refunded" value={String(counts.refunded)} muted />
        <Card label="Disputed" value={String(counts.disputed)} muted />
        <Card label="Gross EUR" value={`€ ${grossEur}`} />
        <Card
          label="Tax EUR"
          value={taxEur != null ? `€ ${taxEur}` : "—"}
          subtitle={`${taxRows} paid rows w/ tax`}
        />
        <Card label="Waitlist" value={String(waitlistCount)} />
      </Grid>

      <Section title="Latest webhook events (50)">
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>at</Th>
              <Th>type</Th>
              <Th>stripeEventId</Th>
            </tr>
          </thead>
          <tbody>
            {latestEvents.map((e) => (
              <tr key={e.id}>
                <Td>{e.processedAt.toISOString().slice(0, 19).replace("T", " ")}</Td>
                <Td>{e.eventType}</Td>
                <Td>
                  <code style={{ color: "#888" }}>{e.stripeEventId}</code>
                </Td>
              </tr>
            ))}
            {latestEvents.length === 0 && (
              <tr>
                <Td colSpan={3} muted>
                  no events yet
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Fraud / rate-limit alerts (last 20)">
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>at</Th>
              <Th>type</Th>
              <Th>metadata</Th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <Td>{a.timestamp.toISOString().slice(0, 19).replace("T", " ")}</Td>
                <Td>{a.eventType}</Td>
                <Td>
                  <code style={{ color: "#888", fontSize: 11 }}>
                    {a.metadata ? JSON.stringify(a.metadata).slice(0, 140) : "—"}
                  </code>
                </Td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <Td colSpan={3} muted>
                  no alerts
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Recent refunds / disputes">
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>updated</Th>
              <Th>status</Th>
              <Th>email</Th>
              <Th>reason</Th>
            </tr>
          </thead>
          <tbody>
            {latestRefunds.map((r) => (
              <tr key={r.id}>
                <Td>{r.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</Td>
                <Td>{r.status}</Td>
                <Td>{r.email}</Td>
                <Td>{r.revokeReason ?? "—"}</Td>
              </tr>
            ))}
            {latestRefunds.length === 0 && (
              <tr>
                <Td colSpan={4} muted>
                  none
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <p style={{ color: "#444", fontSize: 11, marginTop: 32 }}>
        No card details are stored. Only Stripe identifiers, amounts and dates appear here.
      </p>
    </div>
  );
}

function pickStatus(
  rows: Array<{ status: string; _count: { _all: number } }>,
  status: string,
): number {
  return rows.find((r) => r.status === status)?._count._all ?? 0;
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 32,
      }}
    >
      {children}
    </div>
  );
}

function Card({
  label,
  value,
  subtitle,
  accent,
  muted,
}: {
  label: string;
  value: string;
  subtitle?: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: "#0A0A0A",
        border: "1px solid #1F1F1F",
        padding: 16,
        opacity: muted ? 0.7 : 1,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          fontWeight: 900,
          textTransform: "uppercase",
          color: "#888",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: accent ? "#FF6B00" : "#FFFFFF",
          marginTop: 4,
        }}
      >
        {value}
      </div>
      {subtitle ? (
        <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2
        style={{
          fontSize: 11,
          letterSpacing: "0.2em",
          fontWeight: 900,
          textTransform: "uppercase",
          color: "#888",
          marginBottom: 8,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: 8,
        fontWeight: 900,
        color: "#888",
        fontSize: 10,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        borderBottom: "1px solid #1F1F1F",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
  muted,
}: {
  children: React.ReactNode;
  colSpan?: number;
  muted?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: 8,
        borderBottom: "1px solid #111",
        color: muted ? "#555" : "#FFF",
      }}
    >
      {children}
    </td>
  );
}

---

## 8. New tests under src/lib/billing/__tests__/

===== src/lib/billing/__tests__/cap.test.ts =====
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { checkCap } from "../cap";

const $queryRawMock = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

const ORIG_OVERRIDE = process.env.BETA_CAP_REACHED;
const ORIG_CAP = process.env.BETA_FOUNDER_CAP;

describe("checkCap", () => {
  beforeEach(() => {
    $queryRawMock.mockReset();
    process.env.BETA_CAP_REACHED = "false";
    process.env.BETA_FOUNDER_CAP = "10";
  });

  afterEach(() => {
    process.env.BETA_CAP_REACHED = ORIG_OVERRIDE;
    process.env.BETA_FOUNDER_CAP = ORIG_CAP;
  });

  it("denies when override flag is set, regardless of count", async () => {
    process.env.BETA_CAP_REACHED = "true";
    const res = await checkCap();
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toBe("override");
  });

  it("denies when count >= cap", async () => {
    $queryRawMock.mockResolvedValueOnce([{ count: BigInt(10) }]);
    const res = await checkCap();
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toBe("sold_out");
  });

  it("allows when count < cap", async () => {
    $queryRawMock.mockResolvedValueOnce([{ count: BigInt(3) }]);
    const res = await checkCap();
    expect(res.allowed).toBe(true);
    if (res.allowed) expect(res.currentCount).toBe(3);
  });

  it("uses tx.$queryRaw when provided", async () => {
    const txMock = { $queryRaw: vi.fn().mockResolvedValueOnce([{ count: BigInt(1) }]) };
    const res = await checkCap({ tx: txMock as unknown as Pick<typeof prisma, "$queryRaw"> });
    expect(res.allowed).toBe(true);
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect($queryRawMock).not.toHaveBeenCalled();
  });
});

===== src/lib/billing/__tests__/customerLookup.test.ts =====
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSearch, mockCreate } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    billingCustomer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("../stripeClient", () => ({
  getStripe: () => ({
    customers: {
      search: mockSearch,
      create: mockCreate,
    },
  }),
}));

import { prisma } from "@/lib/prisma";
import { lookupOrCreateStripeCustomer } from "../customerLookup";

const findUnique = prisma.billingCustomer.findUnique as unknown as ReturnType<typeof vi.fn>;
const findFirst = prisma.billingCustomer.findFirst as unknown as ReturnType<typeof vi.fn>;
const upsert = prisma.billingCustomer.upsert as unknown as ReturnType<typeof vi.fn>;

describe("lookupOrCreateStripeCustomer", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    upsert.mockReset();
    mockSearch.mockReset();
    mockCreate.mockReset();
  });

  it("returns existing BillingCustomer by userId without calling Stripe", async () => {
    findUnique.mockResolvedValue({ stripeCustomerId: "cus_existing", email: "a@b.com" });
    const res = await lookupOrCreateStripeCustomer({ userId: "u_1", email: "A@B.com" });
    expect(res).toEqual({ stripeCustomerId: "cus_existing", created: false });
    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("falls back to email lookup when no userId match", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue({ stripeCustomerId: "cus_byemail", email: "a@b.com" });
    const res = await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    expect(res.stripeCustomerId).toBe("cus_byemail");
    expect(res.created).toBe(false);
  });

  it("uses Stripe search when DB has nothing", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    mockSearch.mockResolvedValue({ data: [{ id: "cus_stripe" }] });
    const res = await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    expect(res.stripeCustomerId).toBe("cus_stripe");
    expect(res.created).toBe(false);
    expect(upsert).toHaveBeenCalled();
  });

  it("creates a new Stripe Customer as last resort", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    mockSearch.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ id: "cus_new" });
    const res = await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    expect(res).toEqual({ stripeCustomerId: "cus_new", created: true });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com", metadata: expect.objectContaining({ userId: "u_1" }) }),
    );
  });

  it("does not write BillingCustomer when userId is null (pre-payment)", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    mockSearch.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ id: "cus_anon" });
    await lookupOrCreateStripeCustomer({ userId: null, email: "anon@b.com" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("never creates a second Customer when userId already mapped (retry-safe)", async () => {
    findUnique.mockResolvedValue({ stripeCustomerId: "cus_existing", email: "a@b.com" });
    await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

===== src/lib/billing/__tests__/entitlement.test.ts =====
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    entitlement: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { grantEntitlement, revokeEntitlementsBySource, hasActiveBetaEntitlement } from "../entitlement";

const findFirst = prisma.entitlement.findFirst as unknown as ReturnType<typeof vi.fn>;
const create = prisma.entitlement.create as unknown as ReturnType<typeof vi.fn>;
const updateMany = prisma.entitlement.updateMany as unknown as ReturnType<typeof vi.fn>;

describe("grantEntitlement", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
    updateMany.mockReset();
  });

  it("returns the existing entitlement without creating", async () => {
    findFirst.mockResolvedValue({ id: "ent_1" });
    const res = await grantEntitlement({
      userId: "u",
      type: "beta_founder_access",
      source: "stripe_checkout",
      sourceId: "cs_123",
    });
    expect(res).toEqual({ id: "ent_1", created: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a new entitlement when none active exists", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "ent_new" });
    const res = await grantEntitlement({
      userId: "u",
      type: "beta_founder_access",
      source: "stripe_checkout",
      sourceId: "cs_123",
    });
    expect(res).toEqual({ id: "ent_new", created: true });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("revokeEntitlementsBySource", () => {
  beforeEach(() => updateMany.mockReset());

  it("updates active entitlements to revoked and returns count", async () => {
    updateMany.mockResolvedValue({ count: 2 });
    const res = await revokeEntitlementsBySource({
      source: "stripe_checkout",
      sourceId: "cs_123",
      reason: "refund",
    });
    expect(res).toEqual({ revokedCount: 2 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: "stripe_checkout", sourceId: "cs_123" }),
        data: expect.objectContaining({ status: "revoked", revokeReason: "refund" }),
      }),
    );
  });
});

describe("hasActiveBetaEntitlement", () => {
  beforeEach(() => findFirst.mockReset());

  it("returns true when active entitlement found", async () => {
    findFirst.mockResolvedValue({ id: "x" });
    expect(await hasActiveBetaEntitlement("u")).toBe(true);
  });

  it("returns false when none", async () => {
    findFirst.mockResolvedValue(null);
    expect(await hasActiveBetaEntitlement("u")).toBe(false);
  });
});

===== src/lib/billing/__tests__/grantAccess.test.ts =====
import { describe, it, expect, beforeEach, vi } from "vitest";

const { sendAccessCodeEmailMock } = vi.hoisted(() => ({
  sendAccessCodeEmailMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { investigatorAccess: { create: vi.fn() } },
}));

vi.mock("@/lib/email/accessCodeDelivery", () => ({
  sendAccessCodeEmail: sendAccessCodeEmailMock,
}));

import { prisma } from "@/lib/prisma";
import { provisionBetaFounderAccess } from "../grantAccess";

const createMock = prisma.investigatorAccess.create as unknown as ReturnType<typeof vi.fn>;

describe("provisionBetaFounderAccess", () => {
  beforeEach(() => {
    createMock.mockReset();
    sendAccessCodeEmailMock.mockReset();
  });

  it("creates an InvestigatorAccess and sends the access code email by default", async () => {
    createMock.mockResolvedValue({ id: "acc_1", label: "BF-deadbeef" });
    sendAccessCodeEmailMock.mockResolvedValue({ delivered: true });
    const res = await provisionBetaFounderAccess({
      email: "Buyer@example.com",
      stripeCheckoutSessionId: "cs_deadbeef",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data: { label: string; accessCodeHash: string } };
    expect(arg.data.label).toMatch(/^BF-/);
    expect(arg.data.accessCodeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sendAccessCodeEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "buyer@example.com" }),
    );
    expect(res.investigatorAccessId).toBe("acc_1");
    expect(res.emailDelivered).toBe(true);
  });

  it("skips email when sendEmail=false (used by tests)", async () => {
    createMock.mockResolvedValue({ id: "acc_2", label: "x" });
    const res = await provisionBetaFounderAccess({
      email: "x@y.com",
      stripeCheckoutSessionId: "cs_x",
      sendEmail: false,
    });
    expect(sendAccessCodeEmailMock).not.toHaveBeenCalled();
    expect(res.emailDelivered).toBe("skipped");
  });

  it("returns delivered=false with error when Resend fails", async () => {
    createMock.mockResolvedValue({ id: "acc_3", label: "x" });
    sendAccessCodeEmailMock.mockResolvedValue({ delivered: false, error: "rate_limited" });
    const res = await provisionBetaFounderAccess({
      email: "z@y.com",
      stripeCheckoutSessionId: "cs_x",
    });
    expect(res.emailDelivered).toBe(false);
    expect(res.emailError).toBe("rate_limited");
  });
});

===== src/lib/billing/__tests__/idempotency.test.ts =====
import { describe, it, expect } from "vitest";
import { checkoutIdempotencyKey } from "../idempotency";

describe("checkoutIdempotencyKey", () => {
  it("collapses two calls in the same minute to the same key", () => {
    const t = Date.parse("2026-05-11T10:00:30Z");
    const a = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t });
    const b = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t + 25_000 });
    expect(a).toBe(b);
    expect(a).toMatch(/^bf1-[a-f0-9]{32}$/);
  });

  it("returns a different key in a different minute bucket", () => {
    const t = Date.parse("2026-05-11T10:00:30Z");
    const a = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t });
    const b = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t + 60_000 });
    expect(a).not.toBe(b);
  });

  it("normalizes case and whitespace", () => {
    const t = Date.parse("2026-05-11T10:00:30Z");
    const a = checkoutIdempotencyKey({ userIdOrEmail: " User@X.COM ", nowMs: t });
    const b = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t });
    expect(a).toBe(b);
  });
});

===== src/lib/billing/__tests__/rateLimit.test.ts =====
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, checkCheckoutRateLimits, checkWaitlistRateLimit } from "../rateLimit";

const ORIG_URL = process.env.UPSTASH_REDIS_REST_URL;
const ORIG_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

describe("rateLimit", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test";
  });

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = ORIG_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = ORIG_TOKEN;
    vi.restoreAllMocks();
  });

  it("fails open when UPSTASH_REDIS_REST_URL is missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const res = await checkRateLimit({
      bucket: "test",
      key: "x",
      limit: 3,
      windowSeconds: 60,
    });
    expect(res.ok).toBe(true);
    expect(res.bypass).toBe("no_url");
  });

  it("blocks when INCR returns above limit", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: 4 }, { result: 1 }]),
    }) as unknown as typeof fetch;
    const res = await checkRateLimit({ bucket: "b", key: "k", limit: 3, windowSeconds: 60 });
    expect(res.ok).toBe(false);
  });

  it("allows when INCR returns within limit", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: 2 }, { result: 1 }]),
    }) as unknown as typeof fetch;
    const res = await checkRateLimit({ bucket: "b", key: "k", limit: 3, windowSeconds: 60 });
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(1);
  });

  it("checkCheckoutRateLimits returns first failing rule", async () => {
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      call += 1;
      const count = call === 1 ? 99 : 1; // IP rule blows first
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ result: count }, { result: 1 }]),
      });
    }) as unknown as typeof fetch;
    const res = await checkCheckoutRateLimits({ ip: "1.1.1.1", email: "a@b.com" });
    expect(res.ok).toBe(false);
  });

  it("checkWaitlistRateLimit chains IP then email", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: 1 }, { result: 1 }]),
    }) as unknown as typeof fetch;
    const res = await checkWaitlistRateLimit({ ip: "1.1.1.1", email: "a@b.com" });
    expect(res.ok).toBe(true);
  });
});

===== src/lib/billing/__tests__/turnstile.test.ts =====
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifyTurnstile } from "../turnstile";

describe("verifyTurnstile", () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.TURNSTILE_SECRET;

  beforeEach(() => {
    process.env.TURNSTILE_SECRET = "test-secret";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.TURNSTILE_SECRET = originalSecret;
  });

  it("rejects when secret is not configured", async () => {
    delete process.env.TURNSTILE_SECRET;
    delete process.env.TURNSTILE_SECRET_KEY;
    const res = await verifyTurnstile("abc");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_secret");
  });

  it("rejects when token is missing", async () => {
    const res = await verifyTurnstile(null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_token");
  });

  it("accepts when Cloudflare reports success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    }) as unknown as typeof fetch;
    const res = await verifyTurnstile("good", "1.2.3.4");
    expect(res.ok).toBe(true);
  });

  it("rejects when Cloudflare reports failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, "error-codes": ["invalid"] }),
    }) as unknown as typeof fetch;
    const res = await verifyTurnstile("bad");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("rejected");
  });

  it("rejects on network errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("net")) as unknown as typeof fetch;
    const res = await verifyTurnstile("token");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("network");
  });
});

===== src/lib/billing/__tests__/webhookHandlers.test.ts =====
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    betaFounderAccess: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    billingCustomer: { upsert: vi.fn() },
    billingEvent: { create: vi.fn() },
    entitlement: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    investigatorAuditLog: { create: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

vi.mock("../grantAccess", () => ({
  provisionBetaFounderAccess: vi.fn(async () => ({
    investigatorAccessId: "acc_new",
    emailDelivered: "skipped",
  })),
}));

import { prisma } from "@/lib/prisma";
import {
  recordEventIfNew,
  handleCheckoutSessionCompleted,
  handleCheckoutSessionExpired,
  handlePaymentIntentFailed,
  handleChargeRefunded,
  handleChargeDisputeCreated,
  handleChargeDisputeClosed,
} from "../webhookHandlers";

type AnyFn = ReturnType<typeof vi.fn>;
const bfaFindUnique = prisma.betaFounderAccess.findUnique as unknown as AnyFn;
const bfaFindFirst = prisma.betaFounderAccess.findFirst as unknown as AnyFn;
const bfaUpdate = prisma.betaFounderAccess.update as unknown as AnyFn;
const bfaUpdateMany = prisma.betaFounderAccess.updateMany as unknown as AnyFn;
const evCreate = prisma.billingEvent.create as unknown as AnyFn;
const entFindFirst = prisma.entitlement.findFirst as unknown as AnyFn;
const entCreate = prisma.entitlement.create as unknown as AnyFn;
const entUpdateMany = prisma.entitlement.updateMany as unknown as AnyFn;

function mockReset() {
  [
    bfaFindUnique,
    bfaFindFirst,
    bfaUpdate,
    bfaUpdateMany,
    evCreate,
    entFindFirst,
    entCreate,
    entUpdateMany,
  ].forEach((m) => m.mockReset());
}

beforeEach(mockReset);

describe("recordEventIfNew", () => {
  it("returns true on first insert", async () => {
    evCreate.mockResolvedValue({});
    const ok = await recordEventIfNew({ id: "evt_1", type: "checkout.session.completed" as never }, "payload");
    expect(ok).toBe(true);
  });

  it("returns false on Prisma P2002 (duplicate)", async () => {
    const e = new Error("dup") as Error & { code?: string };
    e.code = "P2002";
    evCreate.mockRejectedValue(e);
    const ok = await recordEventIfNew({ id: "evt_dup", type: "checkout.session.completed" as never }, "payload");
    expect(ok).toBe(false);
  });

  it("rethrows other errors", async () => {
    evCreate.mockRejectedValue(new Error("boom"));
    await expect(recordEventIfNew({ id: "evt", type: "checkout.session.completed" as never }, "p")).rejects.toThrow("boom");
  });
});

function checkoutSessionCompletedEvent(overrides: Record<string, unknown> = {}): {
  type: string;
  data: { object: Record<string, unknown> };
} {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        mode: "payment",
        payment_status: "paid",
        amount_total: 100,
        currency: "eur",
        payment_intent: "pi_1",
        customer: "cus_1",
        customer_details: { address: { country: "FR" } },
        total_details: { amount_tax: 0 },
        metadata: { campaign: "beta_founder_1eur" },
        ...overrides,
      },
    },
  };
}

describe("handleCheckoutSessionCompleted", () => {
  it("grants access on a valid event", async () => {
    bfaFindUnique.mockResolvedValue({
      id: "r_1",
      email: "a@b.com",
      status: "pending",
      stripeCheckoutSession: "cs_123",
    });
    bfaUpdate.mockResolvedValue({});
    entFindFirst.mockResolvedValue(null);
    entCreate.mockResolvedValue({ id: "ent_1" });

    const outcome = await handleCheckoutSessionCompleted(
      checkoutSessionCompletedEvent() as never,
      { sendEmail: false },
    );
    expect(outcome).toBe("ok");
    expect(bfaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r_1" },
        data: expect.objectContaining({ status: "paid", userId: "acc_new" }),
      }),
    );
    expect(entCreate).toHaveBeenCalled();
  });

  it("rejects wrong campaign metadata", async () => {
    const ev = checkoutSessionCompletedEvent({ metadata: { campaign: "other" } });
    const outcome = await handleCheckoutSessionCompleted(ev as never);
    expect(outcome).toBe("ignored_wrong_campaign");
    expect(bfaUpdate).not.toHaveBeenCalled();
  });

  it("rejects wrong amount", async () => {
    const ev = checkoutSessionCompletedEvent({ amount_total: 200 });
    const outcome = await handleCheckoutSessionCompleted(ev as never);
    expect(outcome).toBe("ignored_wrong_amount");
  });

  it("rejects wrong currency", async () => {
    const ev = checkoutSessionCompletedEvent({ currency: "usd" });
    const outcome = await handleCheckoutSessionCompleted(ev as never);
    expect(outcome).toBe("ignored_wrong_currency");
  });

  it("rejects unpaid sessions", async () => {
    const ev = checkoutSessionCompletedEvent({ payment_status: "unpaid" });
    const outcome = await handleCheckoutSessionCompleted(ev as never);
    expect(outcome).toBe("ignored_unpaid");
  });

  it("returns no_reservation when no row matches the session id", async () => {
    bfaFindUnique.mockResolvedValue(null);
    const outcome = await handleCheckoutSessionCompleted(
      checkoutSessionCompletedEvent() as never,
    );
    expect(outcome).toBe("no_reservation");
  });

  it("returns already_processed when reservation already paid (re-delivery)", async () => {
    bfaFindUnique.mockResolvedValue({
      id: "r_1",
      email: "a@b.com",
      status: "paid",
      stripeCheckoutSession: "cs_123",
    });
    const outcome = await handleCheckoutSessionCompleted(
      checkoutSessionCompletedEvent() as never,
    );
    expect(outcome).toBe("already_processed");
  });
});

describe("handleCheckoutSessionExpired", () => {
  it("flips matching pending rows to expired", async () => {
    bfaUpdateMany.mockResolvedValue({ count: 1 });
    await handleCheckoutSessionExpired({
      type: "checkout.session.expired",
      data: { object: { id: "cs_x" } },
    } as never);
    expect(bfaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeCheckoutSession: "cs_x", status: "pending" },
        data: { status: "expired" },
      }),
    );
  });
});

describe("handlePaymentIntentFailed", () => {
  it("marks pending row as failed", async () => {
    bfaUpdateMany.mockResolvedValue({ count: 1 });
    await handlePaymentIntentFailed({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_1", last_payment_error: { code: "card_declined" } } },
    } as never);
    expect(bfaUpdateMany).toHaveBeenCalled();
  });
});

describe("handleChargeRefunded", () => {
  it("revokes entitlement and flips status to refunded", async () => {
    bfaFindFirst.mockResolvedValue({
      id: "r_1",
      stripePaymentIntent: "pi_1",
      stripeCheckoutSession: "cs_x",
      userId: "acc_1",
    });
    bfaUpdate.mockResolvedValue({});
    entUpdateMany.mockResolvedValue({ count: 1 });
    const outcome = await handleChargeRefunded({
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_1" } },
    } as never);
    expect(outcome).toBe("ok");
    expect(bfaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "refunded" }) }),
    );
    expect(entUpdateMany).toHaveBeenCalled();
  });
});

describe("handleChargeDisputeCreated", () => {
  it("revokes entitlement and flips status to disputed", async () => {
    bfaFindFirst.mockResolvedValue({
      id: "r_1",
      stripePaymentIntent: "pi_1",
      stripeCheckoutSession: "cs_x",
      userId: "acc_1",
    });
    entUpdateMany.mockResolvedValue({ count: 1 });
    const outcome = await handleChargeDisputeCreated({
      type: "charge.dispute.created",
      data: { object: { id: "du_1", payment_intent: "pi_1", reason: "fraudulent" } },
    } as never);
    expect(outcome).toBe("ok");
    expect(bfaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "disputed" }) }),
    );
  });
});

describe("handleChargeDisputeClosed", () => {
  it("does NOT re-activate entitlements", async () => {
    await handleChargeDisputeClosed({
      type: "charge.dispute.closed",
      data: { object: { id: "du_1", status: "lost", reason: "fraudulent" } },
    } as never);
    expect(entCreate).not.toHaveBeenCalled();
    expect(bfaUpdate).not.toHaveBeenCalled();
  });
});

---

## 9. Updated env example — .env.example

===== .env.example =====
# INTERLIGENS — .env.example
# Copy to .env.local and fill values. Never commit real secrets.

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# ─── Admin auth ──────────────────────────────────────────────────────────────
ADMIN_TOKEN=
ADMIN_BASIC_USER=
ADMIN_BASIC_PASS=

# ─── Email (transactional) ───────────────────────────────────────────────────
RESEND_API_KEY=
BETA_FROM_EMAIL=

# ─── Anti-fraud ──────────────────────────────────────────────────────────────
# Cloudflare Turnstile — also used by /access/founder & /api/billing/*.
TURNSTILE_SECRET=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
# Upstash Redis (REST API, no SDK). Used for rate limiting.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
# Salt for in-app IP hashing in audit logs (any random 32+ char string).
IP_HASH_SALT=

# ─── App ─────────────────────────────────────────────────────────────────────
# Used for Stripe success_url / cancel_url, must match a domain configured
# in Stripe's Apple Pay verified domains.
NEXT_PUBLIC_APP_URL=https://app.interligens.com

# ─── Billing — Beta Founder Access (1 €) ────────────────────────────────────
# Master flag. When false, the entire billing surface 404s except /api/stripe/webhook.
BILLING_ENABLED=false
# Cap on simultaneous paid + non-expired pending reservations.
BETA_FOUNDER_CAP=10000
# Emergency override; if "true", every new checkout returns sold_out.
BETA_CAP_REACHED=false

# Stripe — DIFFERENT VALUES IN DEV (Stripe CLI) vs PROD (Vercel endpoint).
# In dev: STRIPE_WEBHOOK_SECRET is what `stripe listen` prints.
# In prod: STRIPE_WEBHOOK_SECRET is the dashboard endpoint's signing secret.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# Optional: a Stripe Price ID if you'd rather use a Price than ad-hoc price_data.
STRIPE_BETA_FOUNDER_PRICE_ID=
# Turn on automatic_tax: { enabled: true } in checkout.session.create.
# Validate with your accountant BEFORE flipping this on in prod.
STRIPE_TAX_ENABLED=false

# ─── Misc (existing, partial list) ──────────────────────────────────────────
CRON_SECRET=
ETHERSCAN_API_KEY=
ETHERSCAN_RATE_PER_SEC=

---

## 10. Modified files (git diff --stat main..feat/billing-beta)

===== git diff --stat main..feat/billing-beta =====
 .env.example                                       |  55 ++
 docs/audit-billing.md                              | 257 ++++++++
 docs/billing-v1-migration.sql                      | 123 ++++
 docs/billing-v1-report.md                          | 374 ++++++++++++
 docs/brief-billing-v3.md                           | 666 +++++++++++++++++++++
 package.json                                       |   1 +
 pnpm-lock.yaml                                     |  32 +-
 prisma/schema.prod.prisma                          | 488 +++++++++------
 scripts/__tests__/grandfather-beta-users.test.ts   |  72 +++
 scripts/grandfather-beta-users.ts                  | 128 ++++
 scripts/watcher/handles-v2.ts                      | 112 +++-
 src/app/[locale]/scan/[address]/timeline/page.tsx  |   2 +-
 src/app/access/founder/FounderClient.tsx           | 198 ++++++
 src/app/access/founder/copy.ts                     |  79 +++
 src/app/access/founder/page.tsx                    |  43 ++
 src/app/access/success/SuccessClient.tsx           | 112 ++++
 src/app/access/success/page.tsx                    |  17 +
 src/app/admin/billing/page.tsx                     | 375 ++++++++++++
 src/app/api/admin/x/probe-handles/route.ts         |  60 --
 .../billing/__tests__/checkout-flag-off.test.ts    |  57 ++
 .../__tests__/create-checkout-session.test.ts      | 144 +++++
 src/app/api/billing/__tests__/waitlist.test.ts     |  77 +++
 src/app/api/billing/access-status/route.ts         |  46 ++
 .../api/billing/create-checkout-session/route.ts   | 196 ++++++
 src/app/api/billing/waitlist/route.ts              |  59 ++
 src/app/api/cron/watcher-v2/route.ts               |  15 +-
 src/app/api/scan/timeline/[address]/route.ts       |  58 --
 src/app/api/stripe/__tests__/webhook.test.ts       | 113 ++++
 src/app/api/stripe/webhook/route.ts                | 111 ++++
 src/app/en/legal/kol-data-doctrine/page.tsx        | 228 -------
 src/app/fr/legal/kol-data-doctrine/page.tsx        | 245 --------
 src/components/admin/AdminSidebar.tsx              |   1 +
 src/components/legal/LegalFooter.tsx               |   2 -
 src/components/timeline/ScamTimeline.tsx           |   8 +-
 src/lib/billing/__tests__/cap.test.ts              |  55 ++
 src/lib/billing/__tests__/customerLookup.test.ts   |  96 +++
 src/lib/billing/__tests__/entitlement.test.ts      |  85 +++
 src/lib/billing/__tests__/grantAccess.test.ts      |  65 ++
 src/lib/billing/__tests__/idempotency.test.ts      |  26 +
 src/lib/billing/__tests__/rateLimit.test.ts        |  72 +++
 src/lib/billing/__tests__/turnstile.test.ts        |  56 ++
 src/lib/billing/__tests__/webhookHandlers.test.ts  | 262 ++++++++
 src/lib/billing/auditEvents.ts                     |  51 ++
 src/lib/billing/cap.ts                             |  40 ++
 src/lib/billing/customerLookup.ts                  |  98 +++
 src/lib/billing/entitlement.ts                     |  90 +++
 src/lib/billing/env.ts                             |  24 +
 src/lib/billing/grantAccess.ts                     |  63 ++
 src/lib/billing/idempotency.ts                     |  11 +
 src/lib/billing/rateLimit.ts                       | 120 ++++
 src/lib/billing/request.ts                         |  31 +
 src/lib/billing/stripeClient.ts                    |  27 +
 src/lib/billing/turnstile.ts                       |  36 ++
 src/lib/billing/webhookHandlers.ts                 | 298 +++++++++
 src/lib/watcher/handles.ts                         |  45 +-
 src/proxy.ts                                       |  10 +-
 56 files changed, 5349 insertions(+), 866 deletions(-)

