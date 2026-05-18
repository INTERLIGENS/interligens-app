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
