# INTERLIGENS — MODULE BETA FOUNDER ACCESS 1 € — BRIEF V3 FINAL

Machine cible : Host-001 (`dood@Host-001`, `~/dev/interligens-web`, port 3100).
Stack : Next.js 16 / TypeScript / Tailwind / Prisma / Neon (ep-square-band, Frankfurt, port 6543 pooled) / Vercel.
Schema Prisma : `prisma/schema.prod.prisma`.
Migrations : Neon SQL Editor uniquement, jamais `prisma db push --accept-data-loss`.
Deploy : `npx vercel --prod` uniquement.
Branche : `feat/billing-beta` (ne JAMAIS merge direct main).

---

## RÈGLE ABSOLUE — VÉRITÉ EN TOUTES CIRCONSTANCES

Claude Code ne doit JAMAIS :
- inventer un résultat de test
- claim ✅ FIXED sans vérification réelle
- prétendre qu'un test a été lancé s'il ne l'a pas été
- prétendre qu'un build passe s'il ne passe pas
- prétendre qu'un webhook fonctionne sans test bout-en-bout réel

Si quelque chose ne marche pas, le dire clairement.
Si un test n'a pas été fait, le dire clairement.
Si un bug persiste, l'admettre.

---

## OBJECTIF BUSINESS

- Campagne externe : "10 000 accès bêta à 1 €".
- Objectif interne réel : filtre d'engagement, qualification utilisateurs, signal communautaire, réduction du bruit gratuit.
- Ne pas présenter 10 000 € comme net : frais Stripe + TVA + refunds + disputes.
- Wording public autorisé : "Votre contribution de 1 € aide à financer les API, l'infrastructure et les outils d'investigation pendant la bêta privée."
- Ne pas transformer ce chantier en refonte globale.
- Priorités absolues : sécurité, conformité, simplicité, anti-fraude, zéro stockage de carte bancaire.

## DÉCISION PRODUIT

- Paiement unique "Beta Founder Access — 1 €".
- PAS d'abonnement récurrent maintenant.
- Le mot "abonnement" est interdit dans l'UI.
- Architecture préparée pour Stripe Billing/subscriptions plus tard via modèle Entitlement générique.
- Paiement uniquement après création compte + login + acceptation NDA/conditions si requises.
- Pas de paiement avant compte.

---

## RÈGLE ABSOLUE PAIEMENT

INTERLIGENS ne doit JAMAIS :
- recevoir un PAN
- stocker un PAN
- manipuler un CVC
- logger des données carte
- créer un formulaire carte maison
- stocker PAN, CVC, expiration, BIN complet, payment_method_details complet

Utiliser uniquement :
- Stripe Checkout hosted
- Apple Pay / Google Pay via Stripe si disponibles
- Carte bancaire via Stripe Checkout uniquement

INTERLIGENS stocke uniquement :
- stripeCustomerId
- stripeCheckoutSessionId
- stripePaymentIntentId
- status
- amountCents
- currency
- email
- userId
- campaign
- entitlementId
- taxAmountCents (optionnel)
- customerCountry (optionnel)

Aucune donnée bancaire sensible dans Prisma, logs applicatifs, audit logs, analytics, error reporting.

---

## STRATÉGIE DE DÉPLOIEMENT — NON NÉGOCIABLE

Le module DOIT être déployé derrière feature flag pour ne pas casser la beta existante.

### Branche
- Travailler sur `feat/billing-beta`.
- Ne JAMAIS merger direct sur main.
- Tous commits doivent être atomiques et nommés clairement.

### Feature flag
- Env var : `BILLING_ENABLED=false` (défaut).
- Lecture côté serveur uniquement.
- Quand `false` :
  - `/access/founder` retourne 404 ou redirect vers /access existant
  - `POST /api/billing/create-checkout-session` retourne 404
  - `/admin/billing` retourne 404
  - Webhook reste accessible (Stripe doit pouvoir ping même en désactivé pour test)
- Quand `true` :
  - Toutes les routes module billing actives.
- Le gating beta existant ne doit JAMAIS dépendre de `BILLING_ENABLED`.

### Grandfathered access (CRITIQUE)
- Les utilisateurs beta actuels NE DOIVENT PAS perdre l'accès au moment où le nouveau gating Entitlement est activé.
- Avant d'activer le nouveau gating Entitlement, créer un script idempotent :
  - `scripts/grandfather-beta-users.ts`
  - Pour chaque user actuellement actif en beta (lecture du modèle beta existant) :
    - Créer un Entitlement type=`beta_founder_access`, status=`active`, source=`grandfathered`, sourceId=null, startsAt=now, endsAt=null.
  - Idempotent : ne pas créer de doublon si déjà présent.
- Ce script doit être lancé AVANT le merge main et AVANT activation du flag.
- Si Claude Code ne peut pas identifier avec certitude le modèle beta existant pendant l'audit, il doit STOPPER et demander confirmation avant de générer le script grandfather.

### Rollback
- Documenter la commande de rollback exacte dans le rapport final :
  - Flag `BILLING_ENABLED=false`
  - Drop tables Neon SQL : `DROP TABLE "BetaFounderAccess", "BillingCustomer", "BillingEvent", "Entitlement", "WaitlistEntry" CASCADE;`
  - Reverse middleware gating vers fallback beta existant.

---

## AUDIT PRÉALABLE OBLIGATOIRE (AVANT TOUT CODE)

Claude Code DOIT d'abord auditer et produire un rapport d'audit court (audit-billing.md) :
1. Auth actuelle : flow, modèle User, sessions/cookies, middleware.
2. NDA flow : route(s), modèle DB, status.
3. /access existant : routes, pages, gating.
4. Middleware gating actuel : fichier, logique exacte de check.
5. Modèle beta access actuel : nom du modèle, champs, comment l'accès est représenté.
6. Audit logs / SecurityEvent existants : modèle, conventions.
7. Admin existant : routes, layout, guards.
8. Intégration Stripe préexistante : recherche full repo `stripe`, `STRIPE_`, `checkout.session`.
9. Variables env existantes : lecture `.env.example` ou équivalent, lister.
10. Conventions Next.js : app router vs pages router, structure exacte.
11. Prisma schema actuel : lister modèles, conflits de noms potentiels avec BetaFounderAccess / Entitlement / BillingCustomer / BillingEvent / WaitlistEntry.

Ne PAS créer de doublons. Adapter aux modèles existants si pertinent.
Si conflit de nom détecté, STOPPER et demander confirmation avant de continuer.

---

## DÉCISIONS À IMPLÉMENTER

### 1. Anti card-testing obligatoire

Le 1 € est un aimant à card-testing.

- **Cloudflare Turnstile** sur le CTA, validation serveur du token dans `/api/billing/create-checkout-session`.
- **Rate limit Upstash** :
  - 3 tentatives / heure / IP
  - 5 tentatives / jour / email
  - 10 tentatives / jour / userId
- Bloquer création session si rate limit dépassé.
- Ne jamais créer une session Stripe avant validation Turnstile + rate limit.
- **Stripe Radar** : à activer côté dashboard (documenter dans rapport final, pas dans code).
- **Détection basique webhook** :
  - Si > 50 paiements en 10 min avec pattern suspect, log security event.

Pas d'usine à gaz. Simple, robuste.

### 2. Idempotence côté CTA (CRITIQUE)

Si user double-clique ou retente :
- Avant de créer une nouvelle Checkout Session, lookup `BetaFounderAccess` du userId où `status=pending` et `reservationExpiresAt > now`.
- Si trouvé : retourner la session existante (réutiliser `session.url` stocké).
- Si pending expiré : passer `status=expired`, créer une nouvelle réservation.
- Passer un header `Idempotency-Key` à Stripe sur create session : hash stable `userId + minute-bucket` (ex: `userId-YYYYMMDDHHMM`).

### 3. Stripe Customer lookup (CRITIQUE)

Stratégie stricte :
1. Lookup `BillingCustomer` par `userId` en DB en premier.
2. Si absent : appeler `stripe.customers.search` par email.
3. Si absent : créer un nouveau Stripe Customer.
4. Toujours upsert `BillingCustomer` après création/récupération.

Ne JAMAIS créer deux Stripe Customers pour le même userId.

### 4. TVA / Stripe Tax / OSS

- Prix public = 1 € TTC.
- Code prêt pour `automatic_tax: { enabled: process.env.STRIPE_TAX_ENABLED === 'true' }`.
- Champs Prisma `taxAmountCents`, `customerCountry`, `stripeTaxCalculationId` peuvent être null en dev (si Stripe Tax désactivé).
- L'admin doit gracefully gérer null.
- Pas de logique fiscale maison.
- Rapport final doit inclure section "Stripe Tax / VAT setup required before public launch" — décision à valider avec expert-comptable Dood, pas Claude Code.

### 5. Cap strict de 10 000 accès

- Env : `BETA_FOUNDER_CAP=10000`.
- Avant création Checkout Session :
  - Transaction Postgres `SELECT count(*) FROM "BetaFounderAccess" WHERE status IN ('paid', 'pending') AND (status='paid' OR "reservationExpiresAt" > now()) FOR UPDATE`.
  - Si count >= cap : refuser, retourner "sold_out".
- Créer réservation pending AVANT envoi vers Stripe :
  - status=`pending`
  - reservationExpiresAt = now + 30 min
  - stripeCheckoutSessionId rempli après création session Stripe
- Feature flag d'urgence : `BETA_CAP_REACHED=true/false` (override manuel possible).

### 6. Waitlist (CRITIQUE — pas page statique)

Si cap atteint, capturer email obligatoirement.
- Modèle Prisma `WaitlistEntry { id, email (unique), createdAt, source }`.
- Page `/access/founder` quand sold_out : affiche formulaire email.
- Route `POST /api/billing/waitlist` : Turnstile + rate limit + insert email.
- Email obligatoire, pas de page statique morte.

### 7. Refund / dispute / revocation

- **Refund volontaire** (`charge.refunded`) : status=refunded, revoke Entitlement, revokedAt=now, revokeReason=`refund`, audit event.
- **Chargeback** (`charge.dispute.created`) : status=disputed, revoke Entitlement, flag user risk si modèle existant, audit/security event.
- **Dispute closed** (`charge.dispute.closed`) : audit event uniquement, AUCUNE ré-activation automatique. L'user doit contacter support.
- **Payment failed** (`payment_intent.payment_failed`) : status=failed, aucun entitlement.
- **Session expired** (`checkout.session.expired`) : status=expired, libère le slot.
- Si user revient après révocation : 403 + page "Access revoked. Please contact support."
- Ne JAMAIS supprimer audit events nécessaires aux obligations comptables (10 ans FR).

### 8. Paiement après compte uniquement

Flow :
1. User crée compte ou se connecte.
2. User accepte NDA/conditions si gating actuel l'exige.
3. User arrive sur `/access/founder`.
4. User clique CTA.
5. Turnstile + rate limit serveur.
6. Idempotence : check session pending existante.
7. Cap check transactionnel.
8. Création Checkout Session Stripe hosted.
9. Paiement Stripe.
10. Retour success page passive.
11. Webhook Stripe accorde l'accès.
12. Entitlement actif.
13. Gating ouvre l'app.

Pas de paiement avant compte. Pas de magic link post-paiement. Pas d'accès accordé depuis success_url.

### 9. Apple Pay / Google Pay / domain verification

- Documenter dans rapport final :
  - Apple Pay domain verification sur `app.interligens.com` requise côté Stripe Dashboard.
  - Fichier `/.well-known/apple-developer-merchantid-domain-association` à servir si Stripe le demande.
  - Google Pay : activation Stripe Dashboard.
- Checklist finale :
  - Apple Pay visible Safari/iOS.
  - Google Pay visible Chrome/Android.
  - Stripe Dashboard payment methods activés.
  - Domain registration validée.

### 10. Email post-paiement

- Si l'app a déjà un système transactionnel (Resend, Postmark, SES) détecté pendant l'audit : l'utiliser depuis le webhook après création Entitlement.
- Sinon : Stripe receipt suffit pour la v1. Documenter dans rapport final comme dette technique optionnelle.
- Ne PAS ajouter un nouveau provider email sans confirmation.

### 11. Privacy / données personnelles

- Update privacy policy : Stripe comme processeur paiement. (À faire par Dood, pas Claude Code — flagger dans rapport.)
- Base légale : exécution du contrat.
- Route ou procédure "Request data deletion" : si existe déjà, l'étendre. Sinon flagger comme dette pour plus tard.
- Suppression user : anonymiser/supprimer données non nécessaires, conserver BillingEvent et données comptables (obligation légale 10 ans).
- Ne pas stocker payload complet Stripe.
- Ne pas envoyer données billing vers analytics.

### 12. Entitlement générique

Le middleware/gating doit lire Entitlement, pas BetaFounderAccess directement.

```prisma
model Entitlement {
  id              String    @id @default(cuid())
  userId          String
  type            String    // beta_founder_access, beta_private_access, future_subscription_pro, etc.
  source          String    // stripe_checkout, grandfathered, manual_admin, etc.
  sourceId        String?
  status          String    // active, revoked, expired, pending
  startsAt        DateTime  @default(now())
  endsAt          DateTime?
  revokedAt       DateTime?
  revokeReason    String?
  metadata        Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId, type, status])
  @@index([source, sourceId])
}
```

Gating check :
```
Est-ce que userId a un Entitlement WHERE
  type IN ('beta_founder_access', 'beta_private_access')
  AND status = 'active'
  AND revokedAt IS NULL
  AND (endsAt IS NULL OR endsAt > now())
?
```

### 13. Admin minimal

Route `/admin/billing` ou intégration admin existant. Afficher :
- total paid
- cap progress : X / 10 000
- pending non expirés
- failed
- refunded
- disputed
- total gross EUR
- tax total si dispo (gracefully null sinon)
- latest 50 events
- fraud/rate-limit alerts récentes
- waitlist count
- AUCUN détail bancaire

---

## IMPLÉMENTATION DÉTAILLÉE

### A. Page d'offre — Route `/access/founder`

UI style INTERLIGENS :
- Background `#000000`
- Accent `#FF6B00` (PAS de cyan)
- Texte `#FFFFFF`
- Premium forensic, uppercase tracking-widest
- Pas d'emojis
- Responsive clean
- Pas de refonte globale

Contenu EN :
- Title: `Beta Founder Access`
- Price: `1 €`
- Cap: `10,000 beta accesses`
- Copy: `Your 1 € contribution helps fund API costs, infrastructure and investigation tooling during the private beta.`
- Trust: `INTERLIGENS never stores your card details. Payments are processed securely by Stripe, Apple Pay or Google Pay.`
- CTA: `Unlock beta access — 1 €`
- Footer: `Evidence-based. Not financial advice.`

Contenu FR (si bilingue détecté à l'audit) :
- Titre: `Accès Bêta Fondateur`
- Prix: `1 €`
- Cap: `10 000 accès bêta`
- Copy: `Votre contribution de 1 € aide à financer les API, l'infrastructure et les outils d'investigation pendant la bêta privée.`
- Trust: `INTERLIGENS ne stocke jamais vos coordonnées bancaires. Le paiement est traité de manière sécurisée par Stripe, Apple Pay ou Google Pay.`
- CTA: `Débloquer l'accès bêta — 1 €`
- Footer: `Basé sur des preuves. Pas un conseil financier.`

Si sold_out : afficher formulaire waitlist (email + CTA "Join waitlist").

### B. Route `POST /api/billing/create-checkout-session`

Comportement :
- Auth requise.
- userId obligatoire, email obligatoire.
- Vérifier NDA/conditions si requis.
- Vérifier Turnstile.
- Appliquer rate limit Upstash.
- Idempotence : check session pending existante (userId + reservationExpiresAt > now).
- Vérifier cap 10 000 en transaction Postgres avec FOR UPDATE.
- Créer/récupérer Stripe Customer (lookup BillingCustomer → search Stripe par email → create).
- Créer réservation pending BetaFounderAccess.
- Créer Checkout Session hosted Stripe :
  - mode: `payment`
  - amount: 100 cents
  - currency: `eur`
  - product_data.name: `INTERLIGENS Beta Founder Access`
  - automatic_tax activable via env
  - metadata: { userId, email, campaign: `beta_founder_1eur`, accessType: `beta_founder`, reservationId }
  - success_url: `/access/success?session_id={CHECKOUT_SESSION_ID}`
  - cancel_url: `/access/founder`
  - Idempotency-Key header
- Update réservation avec stripeCheckoutSessionId.
- Retourner uniquement `{ url: session.url }`.
- Ne jamais accorder l'accès ici.

### C. Webhook `POST /api/stripe/webhook`

Contraintes :
- raw body obligatoire (Next.js app router : utiliser `await req.text()` et désactiver bodyParser dans la route).
- Signature Stripe via STRIPE_WEBHOOK_SECRET.
- Idempotence via stripeEventId unique dans BillingEvent.
- PAS d'auth app classique.
- NE JAMAIS logger payload complet.
- Stocker BillingEvent minimal { stripeEventId, eventType, payloadHash?, processedAt }.

Events à gérer :
- `checkout.session.completed` :
  - vérifier mode=payment, payment_status=paid, amount_total=100, currency=eur, metadata.userId, campaign.
  - retrouver réservation pending par stripeCheckoutSessionId.
  - passer BetaFounderAccess status=paid, grantedAt=now.
  - créer Entitlement type=beta_founder_access, source=stripe_checkout, sourceId=checkoutSessionId, status=active.
  - audit event.
  - email post-paiement si système transactionnel détecté.
- `checkout.session.expired` :
  - status=expired, libère slot.
- `payment_intent.succeeded` :
  - audit, pas d'action additionnelle (déjà géré par session.completed).
- `payment_intent.payment_failed` :
  - status=failed, aucun entitlement.
- `charge.refunded` :
  - status=refunded, revoke Entitlement, audit.
- `charge.dispute.created` :
  - status=disputed, revoke Entitlement, security event, flag user si modèle dispo.
- `charge.dispute.closed` :
  - audit event uniquement, aucune ré-activation.

### D. Success page `/access/success`

Page PASSIVE :
- Lit DB.
- Affiche état selon BetaFounderAccess status :
  - `pending` ou pas trouvé : "Finalizing access…" + polling léger.
  - `paid` + Entitlement active : "Payment received — access unlocked" + CTA "Enter INTERLIGENS".
  - `failed` / `expired` : "Payment was not completed. [Try again]"
  - `refunded` / `disputed` : "Contact support."
- Polling via `GET /api/billing/access-status?session_id=...` (auth requise, session appartient au user).
- Polling : interval 2s, max 30s, stop si statut terminal.
- Ne JAMAIS contacter Stripe directement depuis cette page sauf si DB ne répond pas.

### E. Prisma models (migration ADDITIVE uniquement)

```prisma
model BillingCustomer {
  id                 String   @id @default(cuid())
  userId             String   @unique
  stripeCustomerId   String   @unique
  email              String
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}

model BetaFounderAccess {
  id                       String    @id @default(cuid())
  userId                   String    @unique
  email                    String
  stripeCustomerId         String?
  stripeCheckoutSession    String?   @unique
  stripeCheckoutSessionUrl String?
  stripePaymentIntent      String?   @unique
  amountCents              Int       @default(100)
  currency                 String    @default("eur")
  status                   String    // pending, paid, failed, expired, refunded, disputed
  campaign                 String    @default("beta_founder_1eur")
  reservationExpiresAt     DateTime?
  grantedAt                DateTime?
  revokedAt                DateTime?
  revokeReason             String?
  taxAmountCents           Int?
  customerCountry          String?
  stripeTaxCalculationId   String?
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  @@index([status])
  @@index([campaign])
  @@index([userId, status])
  @@index([reservationExpiresAt])
}

model Entitlement {
  id              String    @id @default(cuid())
  userId          String
  type            String
  source          String
  sourceId        String?
  status          String
  startsAt        DateTime  @default(now())
  endsAt          DateTime?
  revokedAt       DateTime?
  revokeReason    String?
  metadata        Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId, type, status])
  @@index([source, sourceId])
}

model BillingEvent {
  id              String   @id @default(cuid())
  stripeEventId   String   @unique
  eventType       String
  payloadHash     String?
  processedAt     DateTime @default(now())
  createdAt       DateTime @default(now())

  @@index([eventType])
}

model WaitlistEntry {
  id        String   @id @default(cuid())
  email     String   @unique
  source    String   @default("beta_founder_soldout")
  createdAt DateTime @default(now())
}
```

Migration via Neon SQL Editor uniquement. Générer le SQL et le fournir dans le rapport final.

Si AuditLog/SecurityEvent existe déjà : l'utiliser plutôt que créer un doublon.

### F. Gating

Middleware/guard modifié :
- Lit Entitlement, PAS BetaFounderAccess directement.
- Check : userId, type ∈ ('beta_founder_access', 'beta_private_access'), status='active', revokedAt IS NULL, endsAt IS NULL OR endsAt > now().
- NDA/conditions restent séparées si existantes (gardent leur propre check).
- Aucun accès si payment pending.
- Aucun accès si refunded/disputed/revoked.

CRITIQUE : ne PAS modifier le gating actuel sans avoir d'abord lancé le script grandfather. L'ordre est :
1. Migration Prisma (additive).
2. Script grandfather (crée Entitlement pour users beta existants).
3. Code module billing.
4. Modification gating pour lire Entitlement.
5. Tests end-to-end.
6. Feature flag à false.
7. Merge vers main.
8. Activation flag en prod après validation.

### G. Variables d'environnement

À ajouter à `.env.example` et documenter dans rapport final :

```
# Billing
BILLING_ENABLED=false
BETA_FOUNDER_CAP=10000
BETA_CAP_REACHED=false

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_BETA_FOUNDER_PRICE_ID=
STRIPE_TAX_ENABLED=false

# App
NEXT_PUBLIC_APP_URL=

# Anti-fraud
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

NOTE : `STRIPE_WEBHOOK_SECRET` a une valeur différente en dev (Stripe CLI) et en prod (Vercel endpoint). Documenter explicitement.

### H. Tests

Tests Jest/Vitest raisonnables (selon le runner détecté à l'audit) :
- create checkout refuse unauthenticated
- create checkout refuse missing NDA si applicable
- create checkout refuse invalid Turnstile
- create checkout rate limited IP/email/user
- create checkout refuse cap reached
- create checkout idempotent : double-clic ne crée qu'une session
- create checkout creates pending reservation
- Stripe Customer lookup : pas de doublon sur retry
- webhook rejects invalid signature
- webhook idempotent on duplicate event
- checkout.session.completed grants BetaFounderAccess + Entitlement
- wrong amount does not grant access
- wrong currency does not grant access
- success page does not grant access
- access-status route auth required
- refund revokes entitlement
- dispute revokes entitlement + creates security event
- dispute closed does NOT re-activate
- waitlist insert dedupe email
- grandfather script idempotent
- gating lit Entitlement et accorde accès si actif

Aucun test ne doit faire de vrai call Stripe. Mocker Stripe SDK.

### I. Audit sécurité automatique avant rapport final

Lancer `grep -rni` sur le repo pour chercher :
- `cardNumber`
- `cvc`
- `exp_month`
- `exp_year`
- `payment_method_details`
- `card.last4`
- `billing_details`
- `console.log(event)`
- `logger.info(event)`
- `logger.error(event)` avec payload Stripe complet

Vérifier qu'aucun payload Stripe complet n'est persisté/loggé.
Si trouvé : corriger AVANT rapport final.

---

## WORDING

### Autorisé
- Beta Founder Access / Accès Bêta Fondateur
- accès bêta
- contribution de 1 €
- paiement sécurisé via Stripe
- INTERLIGENS ne stocke jamais vos coordonnées bancaires
- evidence-based
- not financial advice
- private beta

### INTERDIT
- abonnement
- recurring
- guaranteed
- safe investment
- certified safe
- approved token
- we protect your money
- risk-free
- no risk
- verified investment

---

## LIVRABLE FINAL — RAPPORT OBLIGATOIRE

Le rapport final (`docs/billing-v1-report.md`) doit inclure :

1. **Audit de l'existant** (résumé du audit-billing.md).
2. **Décisions implémentées** (liste).
3. **Fichiers modifiés/créés** (liste complète avec chemins).
4. **Migration Prisma SQL** (à coller dans Neon SQL Editor).
5. **Script grandfather** (chemin, comment le lancer, idempotent oui/non testé).
6. **Routes créées** (liste).
7. **Variables d'environnement** à configurer dans Vercel (UI, pas CLI).
8. **Configuration Stripe Dashboard requise** :
   - Checkout activé
   - Payment methods activés
   - Apple Pay domain verification
   - Google Pay activé
   - Radar activé + règles custom recommandées
   - Stripe Tax (à valider expert-comptable AVANT prod live)
   - Webhook endpoint `/api/stripe/webhook` configuré
   - Events sélectionnés (liste exacte)
9. **Tests exécutés** (résultats réels, pas inventés).
10. **Commandes pour Dood** :
    - Comment configurer Vercel env vars
    - Comment lancer script grandfather
    - Comment activer le flag en prod
    - Comment rollback
11. **Risques résiduels** (liste honnête).
12. **Statut** : ready / not ready avec justification.

---

## RÈGLE FINALE

Livrer un module one-shot 1 € propre, sécurisé, anti-fraude, fiscalement préparé, branché sur Entitlement générique, derrière feature flag, avec grandfathered access pour beta users existants.

Ne pas coder Stripe Billing/subscription maintenant.
Ne pas créer de formulaire carte maison.
Ne pas stocker de carte.
Ne pas accorder l'accès depuis le front.
Ne pas dépasser le cap 10 000.
Ne pas oublier refund/dispute revocation.
Ne pas ignorer Stripe Tax/TVA dans le rapport final.
Ne pas merger sur main avant validation Dood.
Ne pas activer le flag avant validation end-to-end avec ta vraie carte.

Travailler en autonomie complète. Si une décision archi inattendue émerge (conflit Prisma majeur, modèle beta existant ambigu, conflit de noms), STOPPER et demander confirmation explicite. Sinon, exécuter.

DÉMARRER PAR L'AUDIT. Pas une ligne de code de module avant que l'audit soit produit et l'arborescence existante comprise.
