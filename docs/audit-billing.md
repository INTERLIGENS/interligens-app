# Audit pré-billing — INTERLIGENS Beta Founder Access 1 €

**Date** : 2026-05-11
**Branche** : `feat/billing-beta` (à partir de `main` @ `a4a201a`)
**Status** : Audit terminé, **3 décisions archi à valider avec Dood avant code**.

---

## 1. Auth actuelle — flow, modèle User, sessions, middleware

| Élément | Détail |
|---|---|
| Modèle User | **N'EXISTE PAS**. Aucun `model User`, aucun NextAuth, Clerk, Lucia, Supabase auth, iron-session |
| Modèle "identité" | `InvestigatorAccess` (prisma/schema.prod.prisma:702–720) — label, accessCodeHash, isActive, expiresAt, lastUsedAt, notes |
| Modèle session | `InvestigatorSession` (lines 722–737) — investigatorAccessId FK, sessionTokenHash (SHA-256), expiresAt, revokedAt, ipHash, userAgent |
| Cookie | `investigator_session` (httpOnly, Secure prod, SameSite=strict, maxAge=28800s soit 8h) |
| Lib auth | `src/lib/security/investigatorAuth.ts` — exports : loginWithAccessCode, validateSession, revokeSession, requireInvestigatorSession, auditLog, etc. |
| Flow | Admin POST `/api/admin/access` → crée InvestigatorAccess avec accessCodeHash (SHA-256 du code) → email du code via Resend → user POST sur form `/access` → hash & lookup InvestigatorAccess → crée InvestigatorSession → set cookie |

⚠️ **Pas de notion d'"utilisateur" durable distincte de la session**. L'identité = l'access code reçu par email + la session active.

---

## 2. NDA flow

| Élément | Détail |
|---|---|
| Modèle | `InvestigatorNdaAcceptance` (1914–1928) : profileId, betaCodeId, signerName, ndaVersion, ndaDocHash, accepted (bool, default true), signedAt, ipAddress |
| Route accept | POST `src/app/api/investigators/nda/accept/route.ts` |
| Route onboarding | POST `src/app/api/investigators/onboarding/nda/route.ts` |
| Page | `src/app/access/nda/page.tsx` (client form, NDA text inline, signerName + checkbox) |
| ⚠️ Gating | **NDA n'est PAS une condition de gating**. C'est juste un record DB. Le proxy.ts ne check pas NDA. Le check est seulement applicatif au moment d'entrer dans certaines surfaces (`/investigators/*`). |

---

## 3. /access existant

| Path | Rôle |
|---|---|
| `src/app/access/page.tsx` | Landing "Beta Access" — point d'entrée du gate |
| `src/app/access/nda/page.tsx` | Form NDA |
| `src/app/api/admin/access/route.ts` | GET/POST CRUD admin (crée InvestigatorAccess + envoie code) |
| `src/app/api/investigators/auth/login/route.ts` | (à vérifier — utilisé par submit /access) |
| `src/app/api/investigators/auth/logout/route.ts` | logout |
| `src/app/api/investigators/nda/accept/route.ts` | accept NDA |

Cookie posé sur succès login : `investigator_session` via `setSessionCookie()` (`investigatorAuth.ts:46` & `:169`).

---

## 4. Middleware gating actuel

Fichier : `src/proxy.ts` (189 lignes). Pas de `middleware.ts` racine — Next.js 16 utilise ce nom alternatif.

| Règle | Détail |
|---|---|
| Cookie gate | `BETA_COOKIE = "investigator_session"` (l.36) ; check `req.cookies.get(BETA_COOKIE)?.value` (l.143, 157) |
| Échec gate | 307 redirect → `/access` |
| Exemptions | `/access*`, `/simulator*`, `/api/*`, `/admin*`, `/_next*`, `/favicon*`, `/tiger/`, `/icons/`, `/legal/`, `/health`, `/sitemap.xml`, `/robots.txt`, fichiers statiques (regex extensions) |
| Admin pages | `if (isProd && isAdminPageRoute)` → check admin_session cookie OR redirect `/admin/login` |
| Admin API | `if (isProd && isAdminApiRoute)` → admin_session cookie OR Basic Auth |
| Investigator pages | `/en/investigator/*` non-login → exige BETA_COOKIE, sinon 307 `/access` |
| **⚠️ Note prod-only** | Le gating admin est conditionné `isProd` — en dev local, `/admin/*` accessible sans auth |

---

## 5. Modèle beta access actuel — CONFIRMÉ AVEC CERTITUDE

**Question : "L'utilisateur X a-t-il accès à la beta MAINTENANT ?"**

**Réponse SQL exacte :**
```sql
SELECT 1
FROM "InvestigatorSession" s
JOIN "InvestigatorAccess" a ON a.id = s."investigatorAccessId"
WHERE s."sessionTokenHash" = sha256(cookie_value)
  AND s."revokedAt" IS NULL
  AND s."expiresAt" > NOW()
  AND a."isActive" = true
  AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW());
```

**Aucun modèle "BetaAccess" séparé**. L'accès = présence d'une `InvestigatorSession` non révoquée + non expirée, attachée à un `InvestigatorAccess` actif.

⚠️ Implication majeure pour le script grandfather (voir section "Décisions archi à valider" ci-dessous).

---

## 6. Audit logs / SecurityEvent existants

| Modèle | Usage | Écrit par |
|---|---|---|
| `AuditLog` (104–112) | Legacy générique (action, actorId, batchId, meta) | non utilisé activement |
| `InvestigatorAuditLog` (739–751) | Auth events (login_success, login_fail_expired, etc.) | `auditLog()` dans `src/lib/security/investigatorAuth.ts:72-94` |
| `InvestigatorProgramAuditLog` (1946–1958) | Events programmatiques (enum InvestigatorAuditEvent) | logique app |
| `VaultAuditLog` (1654–1675) | Vault data access | logique vault |

**Aucun modèle "SecurityEvent" dédié.** Pour les events fraud/dispute du billing, le brief impose la création d'événements de sécurité — je propose de **réutiliser `InvestigatorAuditLog`** avec un `eventType` dédié (ex: `billing.fraud_pattern_detected`, `billing.dispute_opened`) plutôt que d'ajouter un nouveau modèle.

---

## 7. Admin existant

| Élément | Détail |
|---|---|
| Layout | `src/app/admin/layout.tsx` (sidebar conditionnelle sauf `/admin/login`) |
| Sub-pages | `/admin/{alerts, ask-logs, ask-qa, cases, corroboration, documents, equity, evidence-vault, export, identity, inbox, intake, intel, intel-vault, intelligence, investigators, kol, labels, ops, pdf, plainte-generator, rwa-registry, security, stats, threads, vine-osint, watcher, watch-sources}` |
| Lib | `src/lib/security/adminAuth.ts` (283 lignes) |
| API guard | `requireAdminApi(req)` → renvoie 401/403 NextResponse ou null si ok ; valide `x-admin-token` header OU `admin_token` cookie |
| Page guard | `requireAdminCookie(req)` → redirect `/admin/login?redirect=...` |
| Cookies | `admin_token` (token brut) et `admin_session` (HMAC-SHA256 signed proof) |

**Pour `/admin/billing` → utiliser le pattern existant** : page.tsx sous `src/app/admin/billing/`, layout déjà partagé, API guard via `requireAdminApi`.

---

## 8. Intégration Stripe préexistante

**Aucune intégration.**

- `grep -rin "stripe\|STRIPE_\|checkout\.session" src/ scripts/ prisma/` → 4 hits non-pertinents :
  - `src/lib/security/comms/drafts.ts` — chaîne "billing logs" dans une assess template (OSINT)
  - `src/lib/security/assessment/rules.ts` — idem
  - `src/lib/email/betaWelcome.ts` — commentaire CSS "Stripe style"
- `package.json` deps : aucun `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`
- Aucune route `/api/stripe/*` ni `/api/billing/*`
- Aucun webhook existant

**À installer** : `stripe` (server SDK). Le client peut rester en plain JS car Checkout est hosted (pas besoin de `@stripe/stripe-js` côté front si on redirige juste vers `session.url`).

---

## 9. Variables d'environnement existantes

Pas de `.env.example` versionné. `.env` racine + `.env.local`. Clés pertinentes détectées :

**Présentes :**
- `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (Neon ep-square-band:6543)
- `ADMIN_TOKEN`, `ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS`
- `CRON_SECRET`
- `RESEND_API_KEY` (✅ email transactional déjà en place)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (✅ pour rate limit)
- `TURNSTILE_SECRET` (✅ Cloudflare Turnstile, déjà utilisé dans `src/app/api/community/submit/route.ts`)
- `ETHERSCAN_API_KEY`, `NITTER_BASE_URL`, `X_CT0_1/2`, etc.

**Absentes (à ajouter) :**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_BETA_FOUNDER_PRICE_ID`, `STRIPE_TAX_ENABLED`
- `BILLING_ENABLED`, `BETA_FOUNDER_CAP`, `BETA_CAP_REACHED`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (seul `TURNSTILE_SECRET` côté serveur est présent)
- `NEXT_PUBLIC_APP_URL`

**Aucun zod-validated env.ts**. Pattern actuel : `process.env.X` direct.

---

## 10. Conventions Next.js

- **App router uniquement** (`src/app/`). Pas de `src/pages/`.
- **next.config.ts** : `serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"]`. `async headers()` pose CSP/X-Frame/Referrer/Permissions/X-Content-Type globalement.
- **params async** (Next.js 16) : `params = Promise<{handle:string}>` — convention déjà appliquée dans les routes dynamiques.
- **Route handlers** : `export async function GET/POST` dans `route.ts`. Body parsing via `await req.json()` — pour le webhook Stripe il faudra `await req.text()` + désactiver les optimisations (à confirmer ci-dessous).
- **Runner de tests** : Vitest (1523 tests baseline ✅).

---

## 11. Conflits de noms Prisma

136 modèles dans `prisma/schema.prod.prisma`. Pour les 5 modèles cibles :

| Modèle cible | État | Conflit ? |
|---|---|---|
| `BetaFounderAccess` | NOT FOUND | ✅ aucun |
| `BillingCustomer` | NOT FOUND | ✅ aucun |
| `BillingEvent` | NOT FOUND | ✅ aucun |
| `Entitlement` | NOT FOUND | ✅ aucun |
| `WaitlistEntry` | NOT FOUND | ✅ aucun |

Modèles voisins existants :
- `InvestigatorBetaTermsAcceptance` (1930) — acceptation des termes beta, **pas** un access record. Pas de conflit.
- Aucun modèle commençant par `Billing`, `Stripe`, `Entitle`, `Waitlist`.

**Aucun conflit de nom.** Migration additive 100 % safe.

---

## Bonus — infra anti-fraude & comms

| Brique | Statut |
|---|---|
| **Resend** (email) | ✅ déjà intégré (`src/lib/email/accessCodeDelivery.ts`). On l'utilisera pour l'email post-paiement. |
| **Upstash Redis** | ⚠️ env vars présentes, mais `@upstash/redis` **absent** de package.json — usage REST direct ailleurs. À ajouter (ou faire des fetch REST manuels). |
| **Cloudflare Turnstile** | ✅ secret en env, validation REST existante dans `src/app/api/community/submit/route.ts` (POST vers `challenges.cloudflare.com/turnstile/v0/siteverify`). Réutilisable. |

---

## 🚨 DÉCISIONS ARCHI À VALIDER — STOP AVANT CODE

Le brief assume un modèle "user → entitlement" classique, mais le code actuel ne le supporte pas tel quel. **3 décisions à valider avec Dood avant d'écrire la moindre ligne de code module.**

### Décision 1 — Référence "user" sur les nouveaux modèles

Le brief écrit `Entitlement.userId String` et `BetaFounderAccess.userId String`. Mais **il n'existe pas de table User**. Trois options :

- **(A)** Renommer en `investigatorAccessId String` (FK sur InvestigatorAccess) — strictement aligné code actuel.
- **(B)** Garder `userId String` comme champ libre, qui stocke la valeur de `InvestigatorAccess.id`. Plus proche du futur Stripe Billing/subscriptions (où une vraie table User pourra émerger). Pas de FK Prisma, mais sémantique préservée.
- **(C)** Créer un vrai `model User` maintenant, faire migrer `InvestigatorAccess` à devenir une table `BetaCode` rattachée à User, etc. = **refonte globale** — le brief l'interdit.

**Ma recommandation : (B)** — garde le nom du brief, évite la refonte, prépare le futur. On documente que `userId` = `InvestigatorAccess.id` pour l'instant.

### Décision 2 — Email & flow d'authentification du payeur

Le brief dit : `User crée compte ou se connecte → User accepte NDA → User arrive sur /access/founder → User clique CTA`.

Or aujourd'hui :
- "Créer compte" n'existe pas (admin issue un code par email, l'utilisateur le redeem).
- L'email n'est durablement attaché à rien : `InvestigatorAccess` a `label` (texte libre) et l'admin envoie le code via Resend en saisissant l'email côté admin. Aucune table ne dit "cet investigator_session correspond à email X".

Implications pour le billing :
- On a besoin de l'email pour Stripe Customer + receipt.
- Soit on **ajoute un champ `contactEmail` sur `InvestigatorAccess`** (additive, 1 ligne SQL) et on demande à l'admin de le remplir, soit on **demande l'email à l'utilisateur sur `/access/founder`** (form simple, pré-checkout).

Options :
- **(A)** Ajouter `contactEmail` sur `InvestigatorAccess` + back-fill via admin UI. Plus propre. Plus de boulot.
- **(B)** Form email sur `/access/founder`. Simple. L'email collecté finit dans `BetaFounderAccess.email` + `BillingCustomer.email` directement. Pas de change schéma sur l'existant.

**Ma recommandation : (B)** — additive, minimal-touch sur l'existant.

### Décision 3 — Cible business du paiement 1 €

C'est la question fondamentale. Aujourd'hui un user avec `investigator_session` valide **a déjà** accès à la beta. Donc :

- **(A) Le 1 € est un NOUVEAU TIER au-dessus** : "Beta Founder" = badge premium, perks (ex: rapport mensuel, accès Discord, vote feature). Les beta investigators actuels restent sur leur tier "investigator standard". Le gating Entitlement n'écrase pas le gate session — il ajoute un filtre sur certaines surfaces uniquement.
- **(B) Le 1 € remplace progressivement le système de codes admin-issued** : les nouveaux beta entrent par paiement, les existants sont grandfathered en Entitlement. Le proxy.ts est modifié pour exiger Entitlement à terme.
- **(C) Le 1 € est un public funnel parallèle** : flow indépendant ; on crée une notion d'utilisateur public qui n'a rien à voir avec InvestigatorAccess. Plus complexe.

**Ma recommandation : (B)** — c'est ce que le brief décrit avec "grandfathered access" + nouveau gating Entitlement. Mais ça veut dire que `proxy.ts` doit aussi accepter "session valide ET Entitlement active" (et le script grandfather garantit qu'un user beta actuel a un Entitlement immédiatement).

### Décisions secondaires à confirmer

- **Audit log** : OK pour réutiliser `InvestigatorAuditLog` avec eventType `billing.*` au lieu de créer SecurityEvent ? (recommandé)
- **Upstash SDK** : ajouter `@upstash/redis` à package.json, ou rester sur fetch REST direct comme partout ailleurs dans le repo ? (je préfère REST pour cohérence)
- **Turnstile site key** : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` à ajouter aux env (le secret est déjà là).
- **`NEXT_PUBLIC_APP_URL`** : à ajouter (utilisé pour success_url / cancel_url Stripe).

---

## Synthèse — go/no-go pour la phase code

- ✅ **Aucun conflit Prisma**. Migration 100 % additive.
- ✅ **Aucun Stripe préexistant** à respecter.
- ✅ **Email (Resend) déjà en place** — réutilisable pour confirmation paiement.
- ✅ **Turnstile** déjà partiellement intégré.
- ⚠️ **Pas de model User** — décision 1 requise.
- ⚠️ **Pas de "compte" applicatif** — décision 2 (email) requise.
- ⚠️ **Le €1 redéfinit la sémantique d'accès** — décision 3 (cible business) requise.

**Je m'arrête ici. Pas une ligne de code module avant validation des 3 décisions.**
