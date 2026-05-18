# INTERLIGENS — FULL AUDIT REPORT

- **Audit timestamp:** 2026-05-02T10:45:00Z
- **Machine:** Host-003 (dood@local)
- **Branch:** main
- **Commit hash:** d35b8b4
- **Auditor mode:** READ ONLY — zéro modification, zéro commit, zéro deploy
- **Overall status:** PARTIALLY DEGRADED — DB introspection limitée, 2 failing tests (worktrees), scoring discrepancy confirmé. Prod 403 → reclassifié (Cloudflare Access beta gate intentionnel).

---

## 0. EXECUTIVE SUMMARY

INTERLIGENS est une application Next.js 16 de risk intelligence crypto. Le code source est fonctionnel : build réussi, 13 188 tests passent. Le serveur local répond correctement sur les endpoints clés. La prod (app.interligens.com) retourne 403 sur **tous** les endpoints testés, y compris `/api/health`, via Cloudflare — inaccessible depuis cette machine sans session/cookie beta valide. La base de données prod est joignable via Prisma mais l'outil `prisma db execute` ne retourne jamais les résultats de SELECT — état DB partiellement non vérifié. Un écart de score est confirmé entre `/api/v1/score` (score=20) et `/api/partner/v1/score-lite` (score=0) pour le même token. Les secrets sont absents du code source. L'authentification admin/partner/mobile/cron est correctement enforced en local. 37+ variables d'env référencées dans le code sont absentes du `.env.local` — certaines fonctionnalités sont probablement désactivées en local. La stack est globalement saine avec des risques opérationnels identifiés à prioriser.

**Confiance globale de l'audit : MEDIUM** — DB output limité, reste vérifié. Prod 403 reclassifié comme comportement attendu (Cloudflare Access).

---

## 1. CRITICAL FINDINGS

| Severity | Area | Finding | Evidence | Impact |
|----------|------|---------|----------|--------|
| ~~HIGH~~ | ~~Prod / Cloudflare~~ | ~~Tous les endpoints prod retournent 403~~ | RECLASSIFIED — voir note ci-dessous | EXPECTED BEHAVIOR — Cloudflare Access protège la beta privée. |
| HIGH | Scoring | Écart de score entre `/api/v1/score` et `/api/partner/v1/score-lite` — EKpQ : score=20 (public) vs 0 (partner) ; BOTIFY : score=70 RED (public) vs 0 GREEN (partner) | Vérifié en live local 2026-05-02 | score-lite ne charge ni market data ni CaseFile → score=0 ≠ safe. Rug confirmé retourne GREEN via partner API. |
| MEDIUM | Database | `prisma db execute` exécute les requêtes mais ne retourne jamais le contenu des SELECT | Tous les "Script executed successfully" sans données affichées | État réel de la DB prod non vérifiable via cet outil. |
| MEDIUM | Database | Table `AskLog` référencée dans le schéma Prisma mais absente de la DB prod | `Error: P1014` sur requête `AskLog` | Logs ASK non persistés en prod. Fonctionnalité `/admin/ask-logs` probablement cassée. |
| MEDIUM | Rate Limiting | Rate limiter de `/api/partner/v1/score-lite` est in-memory (Map JS) et non Redis | Code source `score-lite/route.ts` L21-32 | Limite 60 req/min non partagée entre lambdas Vercel. Bypass trivial en multi-instance. |
| MEDIUM | Security Headers | CSP absent de la réponse prod. Seuls x-frame-options + referrer-policy présents | `curl -sI https://app.interligens.com` | Surface XSS non réduite côté Cloudflare/prod. |
| MEDIUM | SQL | 4+ utilisations de `$queryRawUnsafe` dans des routes admin | `src/app/api/admin/intelligence/contradictions/route.ts:52`, `serial-patterns/route.ts:44`, `kol/[handle]/proceeds/status/route.ts:50`, `kol/network/route.ts:11-13` | Admin-protected mais risque si token admin compromis. |
| LOW | Env Vars | 38+ variables référencées dans le code absentes du `.env.local` | Diff code vs .env.local | Features dépendantes non opérationnelles en local : Discord, Alchemy, Forta, Metasleuth, ETH RPC, Hyper API... |
| LOW | Dependencies | Prisma 5.22 → 7.8 disponible (major update) | Warning affiché par `npx prisma` | Debt de mise à jour, breaking changes potentiels. |
| INFO | Tests | 2 tests fail dans `.claude/worktrees/` (worktrees d'agents précédents, pas le code main) | Test runner inclut les worktrees | Non bloquant pour le main. Worktrees à cleanup. |

### Cloudflare 403 — RECLASSIFIED (not a finding)

- **OBSERVED:** All prod URLs return 403 from external IP without session
- **CONFIRMED:** Expected behavior — Cloudflare Access protects private beta
- **IMPACT:** None. Beta gate / access flow functioning as intended.

---

## 2. VERIFIED INVENTORY

### 2.1 API Routes

**Total routes trouvées : 250+**

Catégories principales :

| Catégorie | Count | Auth | Rate Limited |
|-----------|-------|------|--------------|
| `/api/admin/*` | ~125 routes | ADMIN (HTTP Basic + session cookie) | Non (sauf /api/ingest) |
| `/api/cron/*` | 17 routes | CRON (CRON_SECRET) | Non |
| `/api/partner/v1/*` | 3 routes | PARTNER (X-Partner-Key) | OUI (2/3) |
| `/api/mobile/v1/*` | 4 routes | MOBILE (X-Mobile-Api-Token) | OUI |
| `/api/investigators/*` | ~40 routes | NONE (session-based, hors middleware) | Partiel |
| `/api/v1/*` | ~15 routes | NONE (public) | OUI |
| `/api/scan/*` | ~20 routes | NONE (public) | OUI |
| `/api/kol/*` | ~10 routes | Mixte (GET public, POST admin) | Partiel |

**Routes publiques principales :**

| Route | Méthode | Auth | Rate Limit | Cache |
|-------|---------|------|------------|-------|
| `/api/v1/score` | GET | NONE | YES | YES (Cache-Control) |
| `/api/v1/scan-context` | GET | NONE | YES | YES (Cache-Control) |
| `/api/v1/kol` | GET | NONE | NO | NO |
| `/api/casefile/public` | GET | NONE | YES | public max-age=3600 |
| `/api/health` | GET | NONE | NO | YES |
| `/api/kol/[handle]` | GET | NONE | YES | NO |
| `/api/market` | GET | NONE | YES | public s-maxage=300 |
| `/api/feedback` | POST | NONE | YES | NO |

**Routes partenaires :**

| Route | Auth | Rate Limit |
|-------|------|------------|
| `/api/partner/v1/score-lite` | X-Partner-Key | YES (60 req/min, in-memory) |
| `/api/partner/v1/batch-score` | X-Partner-Key | YES |
| `/api/partner/v1/transaction-check` | X-Partner-Key | YES |

**CORS :** `Access-Control-Allow-Origin: *` sur `/api/v1/score`, `/api/feedback`, et les 3 endpoints partner.

### 2.2 Pages

**Total pages : 130+**

Catégories :

| Catégorie | Exemples | Auth Gate |
|-----------|---------|-----------|
| Admin | `/admin`, `/admin/kol`, `/admin/intel-vault` | HTTP Basic + session |
| Investigators | `/investigators/box/*`, `/investigators/apply` | Session investigator |
| Public EN | `/en/demo`, `/en/kol/[handle]`, `/en/methodology` | Beta session cookie |
| Public FR | `/fr/demo`, `/fr/kol/[handle]` | Beta session cookie |
| Locale-dynamic | `/[locale]/demo`, `/[locale]/admin/graph` | Beta session cookie |
| Guard / Snap | `/guard`, `/fr/guard`, `/guard/install` | Beta session cookie |
| MM | `/mm`, `/mm/[slug]`, `/mm/scan` | Beta session cookie |
| Simulator | `/simulator` | EXEMPT (middleware) |
| Shared | `/shared/case/[token]` | Beta session cookie |

### 2.3 Database

- **Connexion :** ep-square-band (Neon), port 6543 pgbouncer, DATABASE_URL present
- **Schema :** `prisma/schema.prod.prisma` — VALID (npx prisma validate → success)
- **Modèles :** 120+ models définis dans le schéma
- **Index/unique/map count :** 262 directives `@@index`, `@@unique`, `@@map`

**Modèles confirmés présents en DB :**
- `KolProfile` (table `KolProfile`) — Script executed successfully
- `KOLProfile` (version v2) — Script executed successfully

**Modèles confirmés ABSENTS en DB :**
- `AskLog` — P1014 error
- `CaseFile` colonne `slug` — colonne absente (table casefiles existe mais schéma différent)

**État DB : PARTIELLEMENT VÉRIFIABLE** — `prisma db execute` n'affiche pas les résultats de SELECT.

### 2.4 Env Vars

**Variables présentes dans `.env.local` (confirmées) :**
`ADMIN_BASIC_PASS`, `ADMIN_BASIC_USER`, `ADMIN_TOKEN`, `ANTHROPIC_API_KEY`, `BIRDEYE_API_KEY`, `CRON_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ETHERSCAN_API_KEY`, `HELIUS_API_KEY`, `LEGAL_PDF_TOKEN`, `MOBILE_API_TOKEN`, `PARTNER_API_KEY`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`, `VAULT_AUDIT_SALT`, `X_AUTH_TOKEN_1`, `X_AUTH_TOKEN_2`, `X_BEARER_TOKEN`, `X_CT0_1`, `X_CT0_2`, R2 credentials (6 vars), Rawdocs S3 (5 vars), KV/Redis (4 vars), Vercel meta (12 vars), PG connection (9 vars)

**Variables absentes localement (référencées dans le code) :**
`ALCHEMY_API_KEY`, `ARB_RPC_URL`, `BASE_RPC_URL`, `BSCSCAN_API_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_IDS`, `DISCORD_GUILD_ID`, `ETH_RPC_URL`, `ETHERSCAN_RATE_PER_SEC`, `FCA_AUTH_EMAIL`, `FCA_AUTH_KEY`, `FORTA_API_KEY`, `HYPER_API_KEY`, `METASLEUTH_API_KEY`, `MM_API_TOKEN`, `ONE_INCH_API_KEY`, `OSINT_MODE`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_HELIUS_API_KEY`, `NEXT_PUBLIC_HELIUS_RPC`, `NEXT_PUBLIC_SITE_URL`, et ~15 autres.

### 2.5 Internal Modules

**83 modules internes dans `src/lib/`**, avec 362 fichiers TypeScript et 90 fichiers de test.

Modules principaux :
- `tigerscore/` — 17 fichiers, 6 tests
- `intelligence/` — 22 fichiers, 7 tests
- `mm/` — 55 fichiers, 8 tests
- `vault/` — 27 fichiers, 8 tests
- `surveillance/` — 16 fichiers, 4 tests
- `security/` — 14 fichiers, 11 tests
- `kol/` — 14 fichiers, 0 tests
- `laundry/` — 11 fichiers, 0 tests
- `publicScore/` — 4 fichiers, 0 tests

### 2.6 Packages

| Répertoire | Nom | Version |
|------------|-----|---------|
| `packages/widget` | `@interligens/widget` | 0.1.0 |
| `packages/chrome-guard` | `@interligens/chrome-guard` | 0.1.0 |
| `packages/metamask-snap` | `@interligens/metamask-snap` | 0.1.0 |

### 2.7 Feature Flags

Fichier : `src/lib/featureFlags.ts`

| Flag | Env Var | État local |
|------|---------|-----------|
| `walletLab` | `NEXT_PUBLIC_ENABLE_WALLET_LAB` | true (var présente) |
| `phantomGuardV2` | `NEXT_PUBLIC_ENABLE_PHANTOM_GUARD_V2` | true (var présente) |
| `metamaskSnapV2` | `NEXT_PUBLIC_ENABLE_METAMASK_SNAP_V2` | true (var présente) |
| `jupiterSafeSwapV2` | `NEXT_PUBLIC_ENABLE_JUPITER_SAFE_SWAP_V2` | true (var présente) |
| `walletConnectLab` | `NEXT_PUBLIC_ENABLE_WALLETCONNECT_LAB` | true (var présente) |
| `cloudflareWeb3` | `NEXT_PUBLIC_ENABLE_CLOUDFLARE_WEB3_GATEWAY` | true (var présente) |

Tous les labs sont ON en local selon `.env.local`.

### 2.8 Scoring Engine

**Fichiers scoring trouvés :**
- `src/lib/tigerscore/engine.ts` — moteur principal TigerScore
- `src/lib/tigerscore/adapter.ts` — adaptateur `computeTigerScoreFromScan`
- `src/lib/publicScore/computeVerdict.ts` — verdict public
- `src/lib/publicScore/index.ts` — exports publics
- `src/lib/publicScore/rateLimit.ts` — rate limiter public score
- `src/lib/mm/engine/scoring/behaviorDrivenScore.ts` — MM scoring
- `src/lib/shill-to-exit/scorer.ts` — shill-to-exit scoring
- `src/lib/intelligence/scorer.ts` — intel scoring
- `src/lib/laundry/scorer.ts` — laundry trail scoring

### 2.9 Infra / Build / Tests

- **Build :** SUCCESS (pnpm build — toutes les routes compilées)
- **Tests :** 13 188 passent, 2 échouent (dans `.claude/worktrees/`)
- **Node :** v20.20.0
- **pnpm :** 10.30.1
- **Vercel crons :** 16 crons configurés
- **Git branch active :** main
- **Remote :** `https://github.com/INTERLIGENS/interligens-app.git`
- **Tags :** `beta-investor-freeze-2026-05`, `pre-audit-2026-04-21`, `safety-before-constellation-3d-20260421-0845`, `security-baseline-2026-03-04`, `v2.0-investigators`

### 2.10 Documentation existante

**`docs/` (27 fichiers) :**

| Fichier | Lignes | Note |
|---------|--------|------|
| `ARCHITECTURE.md` | 269 | Mis à jour 30 avr |
| `SCORING_ENGINE.md` | 162 | Mis à jour 1 mai |
| `PARTNER_API_V1.md` | 229 | Mis à jour 29 avr |
| `PARTNER_API_V1.openapi.yaml` | — | OpenAPI spec partenaires |
| `SECURITY_BASELINE.md` | 148 | 4 mars |
| `FINAL_SECURITY_LOCKDOWN.md` | 124 | 4 mars |
| `MODULES.md` | 85 | 30 avr |
| `OPS_ADMIN_PLAYBOOK.md` | 162 | 8 mars |
| `MONITORING.md` | 153 | 9 mars |
| `security-center-audit.md` | 267 | 21 avr |
| `security-center-runbook.md` | 226 | 21 avr |
| `SECURE_SDLC.md` | 168 | 4 mars |
| `qa.md` | 279 | 1 mars |

**Racine (markdown) :** CLAUDE.md, DECISIONS.md (488 lignes), INTELLIGENCE_MODE.md, INVESTIGATORS_FINALISATION_AUDIT.md, FINAL_PRE_FREEZE_REPORT.md, POST_FREEZE_POLISH_REPORT.md, plusieurs AUDIT_REPORT_*.md

**Manquant :** Pas de CHANGELOG automatique, pas de runbook complet opérationnel pour prod-down scenarios.

### Section verdict
- Verified: Architecture, routes API, pages, schéma Prisma, packages, feature flags, build, tests
- Broken: `prisma db execute` SELECT output, prod inaccessible depuis IP externe
- Risk: AskLog table absente, scoring discrepancy, rate limiter non-distribué
- Unknown: Contenu réel des tables prod (counts, data), état CSP en prod post-Cloudflare

---

## 3. LIVE TEST RESULTS

### 3.1 Endpoints locaux (http://localhost:3100)

| Cible | Résultat | HTTP | Notes |
|-------|---------|------|-------|
| `/api/health` | `{ok:true, db:ok, redis:ok, rawdocs:ok}` | 200 | OK — DB + Redis + R2 opérationnels |
| `/api/v1/score?mint=EKpQ...` | `{score:20, verdict:"GREEN", sources:["DexScreener"]}` | 200 | OBSERVED |
| `/api/v1/score?mint=BOTIFY...` | `{score:70, verdict:"RED", sources:["INTERLIGENS CaseDB"]}` | 200 | CaseDB match correct |
| `/api/v1/scan-context?target=BOTIFY` | `{chain:SOL, confidence:low, missingFields:[...]}` | 200 | Market data null (token dead) |
| `/api/partner/v1/score-lite` (no key) | `{"error":"unauthorized","code":"INVALID_PARTNER_KEY"}` | 401 | Auth enforced ✓ |
| `/api/partner/v1/score-lite` (with key) | `{score:0, tier:"GREEN"}` | 200 | Score=0 vs score=20 public — DISCREPANCY |
| `/api/partner/v1/batch-score` (with key) | `{results:[{score:0, verdict:"SAFE"}], processed:1, errors:0}` | 200 | OK |
| `/api/mobile/v1/scan` (no token) | `{"error":"Unauthorized..."}` | 401 | Auth enforced ✓ |
| `/api/mobile/v1/ask` (no token) | `{"error":"Unauthorized..."}` | 401 | Auth enforced ✓ |
| `/api/cron/watcher-v2` (no secret) | `{"error":"Unauthorized"}` | 401 | Auth enforced ✓ |
| `/api/feedback` (body invalide) | `{"error":"message_required"}` | 400 | Validation OK |
| `/api/kol` | Liste 20+ profils KOL | 200 | Données réelles |
| `/api/casefile/public` (sans params) | `{"error":"handle or mint required"}` | — | Validation OK |
| `/api/wallet/scan` (SOL) | `{tokenCount:0, topRisk:null}` | 200 | Retour vide pour ce wallet |

### 3.2 5-token scoring (public engine)

| Token (abrégé) | Score | Verdict | Sources |
|----------------|-------|---------|---------|
| EKpQGSJt...zcjm | 20 | GREEN | DexScreener |
| DezXAZ8z...B263 | 20 | GREEN | DexScreener |
| BYZ9CcZG...69xb (BOTIFY) | 70 | RED | INTERLIGENS CaseDB |
| 7WRX5QGu...pump | 48 | ORANGE | DexScreener |
| DRLNhjM7...pump | 43 | ORANGE | DexScreener |

OBSERVED: Le moteur TigerScore discrimine correctement les seuils GREEN/ORANGE/RED.
INFERENCE: Les tokens sans CaseDB entry tombent sur le score DexScreener-only, ce qui peut sous-estimer les risques.

### 3.3 Endpoints prod (https://app.interligens.com)

| Cible | HTTP | Notes |
|-------|------|-------|
| `/` | 403 | Cloudflare WAF |
| `/en/demo` | 403 | Cloudflare WAF |
| `/fr/demo` | 403 | Cloudflare WAF |
| `/en/wallet-scan` | 403 | Cloudflare WAF |
| `/en/kol` | 403 | Cloudflare WAF |
| `/en/explorer` | 403 | Cloudflare WAF |
| `/en/methodology` | 403 | Cloudflare WAF |
| `/en/methodology/tigerscore` | 403 | Cloudflare WAF |
| `/en/cases/botify/evidence` | 403 | Cloudflare WAF |
| `/en/developers` | 403 | Cloudflare WAF |
| `/admin/login` | 403 | Cloudflare WAF |
| `/scan` | 403 | Cloudflare WAF |
| `/api/health` | 403 | Cloudflare WAF — MÊME L'API |

OBSERVED: Tous les endpoints prod retournent 403 avec `server: cloudflare` et un `cf-ray` actif.
INFERENCE: Une règle Cloudflare WAF bloque les requêtes curl sans cookie de session valide, ou un Access Policy Cloudflare est actif sur le domaine. État prod non vérifiable depuis cette machine.

### Section verdict
- Verified: Auth locale (admin/partner/mobile/cron) correctement enforced. Scoring engine fonctionnel en local.
- Broken: Prod inaccessible (403 Cloudflare sur tous endpoints y compris /api/health). Wallet-scan retourne vide.
- Risk: Score discrepancy entre public et partner engine pour même adresse.
- Unknown: État fonctionnel réel de la prod. Headers CSP en prod post-Cloudflare.

---

## 4. SECURITY REVIEW

### 4.1 Verified Protections

| Protection | Mécanisme | Vérifié |
|------------|-----------|---------|
| Admin routes | HTTP Basic Auth (ADMIN_BASIC_USER + ADMIN_BASIC_PASS) + session cookie via `verifyAdminSession` | OUI |
| Partner API | X-Partner-Key header, `validatePartnerKey()` | OUI — 401 sans clé |
| Mobile API | X-Mobile-Api-Token header, `mobileAuth` | OUI — 401 sans token |
| Cron endpoints | CRON_SECRET validation | OUI — 401 sans secret |
| Beta gate | Cookie `investigator_session` requis sur toutes les pages publiques | OUI (middleware) |
| Admin pages | Localized admin routes protégées : `/[locale]/admin/*` aussi gated | OUI |
| Rate limiting | Upstash Redis (prod) + in-memory fallback (dev) | OUI — presets définis |
| Secrets dans le code | Aucun secret hardcodé trouvé dans `src/` | OUI |
| Env files en git | Aucun fichier `.env*` committé | OUI — `git ls-files` négatif |
| XSS | Pas de `dangerouslySetInnerHTML` trouvé dans le code applicatif | OUI |

### 4.2 Suspicious Surfaces

| Surface | Fichier | Note |
|---------|---------|------|
| `$queryRawUnsafe` | `admin/intelligence/contradictions/route.ts:52` | SQL construit sans paramètre visible |
| `$queryRawUnsafe` | `admin/intelligence/serial-patterns/route.ts:44` | SQL construit sans paramètre visible |
| `$executeRawUnsafe` | `admin/kol/[handle]/proceeds/status/route.ts:50` | Execute raw avec template string |
| `$queryRawUnsafe` | `admin/kol/network/route.ts:11-13` | 3 requêtes `SELECT *` sans filtre utilisateur |
| `$queryRawUnsafe` | `admin/kol/publishability/route.ts:15,18,19` | Paramètre `$1` visible — OK si bien bindé |
| `$queryRawUnsafe` | `pdf/kol/route.ts:32` | ADMIN-protected mais raw SQL |
| X auth tokens | `.env.local` — X_AUTH_TOKEN_1, X_AUTH_TOKEN_2, X_CT0_1, X_CT0_2 | Multi-compte X. Tokens présents. REDACTED. |

### 4.3 Missing Protections

| Protection | Observation |
|------------|-------------|
| Content-Security-Policy | Défini dans `src/lib/security/headers.ts` mais ABSENT de la réponse prod (403 bloque avant) — non vérifié en prod normal |
| Strict-Transport-Security (HSTS) | Absent des headers prod observés |
| X-Content-Type-Options | Absent des headers prod observés |
| Rate limit `/api/partner/v1/score-lite` | In-memory seulement — non distribué entre lambdas |
| Rate limit `/api/v1/kol` | Marqué "NO" dans l'inventaire — aucune limite |
| Rate limit `/api/admin/*` | Aucun rate limiting sur les routes admin (125+ routes) |
| Investigators auth | Routes `/api/investigators/*` marquées NONE — auth présumée via session dans le handler, non vérifiable depuis l'extérieur |

### 4.4 Unknown / Unverified

- Comportement CSP réel en prod (avant 403 Cloudflare)
- HSTS configuré ou non côté Cloudflare
- Cloudflare Access Policy : intentionnel ou régression ?
- Solidité de `verifyAdminSession` (cookie JWT ou token DB ?)
- Expiration et rotation des X auth tokens (X_AUTH_TOKEN_1/2)
- Comportement du rate limiter partner en production multi-lambda

### Section verdict
- Verified: Admin/partner/mobile/cron auth enforced. No hardcoded secrets. No XSS surfaces.
- Broken: Rate limiter partner non distribué.
- Risk: `$queryRawUnsafe` dans 6 routes admin. Headers de sécurité incomplets.
- Unknown: CSP prod, HSTS, auth investigators côté handler.

---

## 5. DATABASE STATE

### 5.1 Schema Validity

OBSERVED: `npx prisma validate --schema=prisma/schema.prod.prisma` → **"The schema at prisma/schema.prod.prisma is valid 🚀"**

### 5.2 Modèles dans le schéma (120+)

Extrait des modèles clés :

| Modèle | Ligne | Table (@@map) |
|--------|-------|---------------|
| `SourceRegistry` | 12 | (default) |
| `IngestionBatch` | 35 | (default) |
| `AddressLabel` | 69 | (default) |
| `KolProfile` | 358 | `KolProfile` |
| `KolWallet` | 423 | (default) |
| `KolCase` | 447 | (default) |
| `KolEvidence` | 465 | (default) |
| `CaseFile` | 602 | `casefiles` |
| `KOLProfile` | 615 | (v2, default) |
| `KOLWallet` | 638 | (v2) |
| `InvestigatorAccess` | 702 | (default) |
| `CanonicalEntity` | 838 | `intel_canonical_entities` |
| `AskLog` | 1204 | (default) |
| `VaultProfile` | 1397 | (default) |
| `VaultCase` | 1455 | (default) |
| `MmEntity` | 2556 | (default) |
| `MmScore` | 2509 | (default) |
| `RwaIssuer` | 2880 | (default) |
| `WatcherCampaign` | 3140 | (default) |
| `ScoreSnapshot` | 3244 | (default) |

**Index/unique/map :** 262 directives au total.

### 5.3 Table Activity (DB Prod)

COMMAND FAILED — `prisma db execute` n'affiche pas les résultats des SELECT (affiche "Script executed successfully" sans données).

État partiellement inféré via l'API :
- OBSERVED: `/api/kol` retourne 20+ profils KOL détaillés avec wallets, evidence counts, scores.
- OBSERVED: `/api/v1/score?mint=BOTIFY` retourne `sources: ["INTERLIGENS CaseDB"]` → CaseDB contient au moins BOTIFY.
- OBSERVED: `KolProfile` et `KOLProfile` — requêtes exécutées sans erreur P1014 → tables existent.
- OBSERVED: `AskLog` → P1014 — table absente.
- OBSERVED: `casefiles` — table existe mais schéma differ de l'attendu (colonne `slug` absente ?).

### 5.4 KOL Stats (via API live)

OBSERVED depuis `/api/kol` :

| Handle | Risk Flag | Tier | Wallets | Evidences | Scammed (USD) |
|--------|-----------|------|---------|-----------|---------------|
| bkokoski | confirmed_scammer | CRITICAL | 22 | 29 | $4,500,000 |
| GordonGekko | high | CRITICAL | 14 | 4 | $579,645 documented |
| ravedao | confirmed_rug | RED | 6 | 6 | $17,800,000 |
| ghostwareos | confirmed | CRITICAL | 6 | 0 | $327,790 |
| sxyz500 | confirmed_scammer | CRITICAL | 9 | 3 | $1,200,000 |
| Myrrha | confirmed | — | 113 | 0 | $127,000 documented |
| dione-protocol | under_investigation | ORANGE | 0 | 11 | — |
| HaleyWelch | confirmed_scheme | tier:2 | 0 | 0 | $440M retail (public) |
| HaydenDavis | confirmed_rug | tier:1 | 3 | 0 | — |
| JMilei | promoter | tier:5 | 0 | 0 | — |

**Total KOL dans la réponse API :** 20+ profiles retournés (CLAUDE.md indique 215 publiés — l'API pagine ou filtre).

### 5.5 Case Stats

NOT VERIFIED — Requête `casefiles` partiellement échouée (colonne slug absente). BOTIFY confirmé présent via score endpoint.

### Section verdict
- Verified: Schéma valide. KOL data vivante via API. CaseDB opérationnel.
- Broken: `AskLog` table absente. `prisma db execute` SELECT output inutilisable. `casefiles` schéma differ.
- Risk: Tables manquantes → fonctionnalités silencieusement cassées (ask logs).
- Unknown: Counts réels de toutes les tables. State de MmEntity, VaultCase, etc.

---

## 6. ENVIRONMENT REVIEW

### 6.1 Variables présentes localement (confirmées)

REDACTED — valeurs non exposées.

Présentes : `ADMIN_BASIC_PASS`, `ADMIN_BASIC_USER`, `ADMIN_TOKEN`, `ALERT_EMAIL`, `ANTHROPIC_API_KEY` (present), `BETTERSTACK_API_TOKEN`, `BIRDEYE_API_KEY`, `CRON_SECRET`, `DATABASE_URL` (present — ep-square-band), `DATABASE_URL_UNPOOLED`, `ETHERSCAN_API_KEY`, `HELIUS_API_KEY` (present), `INVESTIGATOR_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_REST_API_TOKEN`, `KV_REST_API_URL`, `KV_URL`, `LEGAL_PDF_TOKEN`, `MM_SCAN_BLOCK_LIVE`, `MOBILE_API_TOKEN`, `NEON_PROJECT_ID`, R2 (6 vars), Rawdocs S3 (5 vars), Redis/PG (9 vars+), `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`, `VAULT_AUDIT_SALT`, `X_AUTH_TOKEN_1`, `X_AUTH_TOKEN_2`, `X_BEARER_TOKEN`, `X_CT0_1`, `X_CT0_2`, Vercel meta (12 vars).

### 6.2 Variables manquantes localement (référencées dans le code)

`ALCHEMY_API_KEY`, `ALLOW_ENTITY_EXPORT`, `ARB_RPC_URL`, `BASE_RPC_URL`, `BSCSCAN_API_KEY`, `COMMUNITY_RATE_LIMIT`, `DAILY_FLOW_VERBOSE`, `DIGEST_FROM_EMAIL`, `DIGEST_TO_EMAIL`, `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_IDS`, `DISCORD_GUILD_ID`, `ETH_RPC_URL`, `ETHERSCAN_RATE_PER_SEC`, `EXPLAIN_RATE_LIMIT`, `FCA_AUTH_EMAIL`, `FCA_AUTH_KEY`, `FEEDBACK_EMAIL`, `FORTA_API_KEY`, `HOLDING_PCT_THRESHOLD`, `HYPER_API_KEY`, `METASLEUTH_API_KEY`, `MM_API_TOKEN`, `ONE_INCH_API_KEY`, `OSINT_MODE`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_HELIUS_API_KEY`, `NEXT_PUBLIC_HELIUS_RPC`, `NEXT_PUBLIC_SHEETS_CONFIGURED`, `NEXT_PUBLIC_SITE_URL`, `ONCHAIN_SYNC_BATCH_WALLETS`, `PARTNER_API_KEY_V` (version B ?), `PDF_MAX_SIZE_BYTES`, `PDF_SIGNED_URL_TTL_SECONDS`

**Note :** Plusieurs de ces vars correspondent à features optionnelles (Discord notifications, Alchemy EVM, FCA lookup, Forta alerts). Leur absence en local dégrade silencieusement ces fonctionnalités.

### 6.3 Observations Secret Handling

- OBSERVED: Aucun secret hardcodé dans `src/` — grep confirme.
- OBSERVED: Aucun fichier `.env*` dans git — `git ls-files` confirme.
- OBSERVED: ADMIN_TOKEN présent localement — REDACTED.
- OBSERVED: Deux paires X auth tokens (TOKEN_1/2 + CT0_1/2) — multi-compte Twitter/X.
- INFERENCE: `vercel env pull` supprime ADMIN_TOKEN (documenté dans CLAUDE.md) — token à récupérer uniquement depuis Vercel UI.

### Section verdict
- Verified: Secrets non exposés. .env non committé. Vars critiques présentes (DB, Redis, Helius, R2).
- Broken: 35+ vars absentes localement — Discord, ETH RPC, Alchemy, Forta silencieusement absent.
- Risk: `PARTNER_API_KEY_V` non défini — version B du partner token ?
- Unknown: Présence de ces vars en prod Vercel. Rotation des X tokens.

---

## 7. SCORING ENGINE REVIEW

### 7.1 Architecture du scoring

Deux engines distincts coexistent :

**Engine A — Public Score** (`src/lib/publicScore/`, `src/lib/tigerscore/adapter.ts`) :
- Utilisé par `/api/v1/score`
- Entrée : token address → market snapshot → `computeTigerScoreFromScan()`
- Sortie : `{score, verdict, signals, evidence, sources}`

**Engine B — Intel Score** (`src/lib/tigerscore/engine.ts`, `computeTigerScoreWithIntel`) :
- Utilisé par `/api/partner/v1/score-lite` et `/api/partner/v1/transaction-check`
- Augmenté par intel DB (CaseDB, OFAC, known_bad registry)
- Sortie : `{finalScore, tier, drivers}`

**Discrepancy observée :** EKpQ → Engine A = 20, Engine B = 0. INFERENCE: Engine B charge un score de base différent ou ne trouve pas de signaux intel pour ce token, tombant à 0 par défaut.

### 7.2 Poids et signaux (OBSERVED — visibles dans engine.ts)

| Signal ID | Sévérité | Delta |
|-----------|----------|-------|
| manipulation_high | high | +20 |
| alerts_high | high | +15 |
| trust_low | med | +15 |
| cluster_risk (≥3 signaux simultanés) | high | +10 |
| evm_known_bad | critical | floor score → RED |
| pair_age ≤ 3 jours | med | variable |
| fdv/liquidity ratio ≥ 40 | high | variable |
| volume/liquidity > 5x | med | variable |
| top10_holder_pct > 80% | high | variable |
| strongSignals ≥ 3 | high | +10 cap booster |
| booster | — | max +50 |

### 7.3 Seuils publics (OBSERVED — visibles dans engine.ts L1)

| Tier | Score range |
|------|------------|
| GREEN | < 35 |
| ORANGE | 35–69 |
| RED | ≥ 70 |

**Note :** Ces seuils sont exposés dans le code source public GitHub. Pas d'obfuscation.
**CLAUDE.md :** TigerScore intelligence weight hard-cap 0.20. OFAC match = floor 15.

### 7.4 Tests scoring

OBSERVED: TigerScore tests (6 fichiers) — GREEN/ORANGE/RED fixtures valident les invariants :
- GREEN fixture → score ∈ [0, 30], tier GREEN, aucun driver CRITICAL
- ORANGE fixture → score ∈ (30, 70), tier ORANGE, ≥1 driver MED/HIGH
- RED fixture → score ∈ [70, 100], tier RED, ≥1 driver CRITICAL

### 7.5 Résultats live (5 tokens)

OBSERVED — voir Section 3.2 ci-dessus. Moteur fonctionnel, seuils respectés.

### 7.6 Notes de caution

- OBSERVED: Thresholds (35/70) et signal weights sont visibles dans le code source. Risque de gaming par des acteurs malveillants qui analyseraient le repo.
- OBSERVED: L'engine B (intel) retourne score=0 pour EKpQ là où l'engine A retourne 20. La signification de score=0 (safe vs unknown) mérite clarification dans la doc partenaires.

### Section verdict
- Verified: Scoring fonctionnel en local. Tests passent. Seuils corrects.
- Broken: Discrepancy Engine A vs B pour même token.
- Risk: Thresholds et weights exposés publiquement dans le code.
- Unknown: Comportement Engine B quand intel absent (score=0 = safe ou unknown ?).

---

## 8. INFRA / DEVOPS REVIEW

### 8.1 Build Result

OBSERVED: `pnpm build` — **SUCCESS**. Toutes les routes compilées (static + dynamic + SSG).

Types de routes générées :
- `○` Static — prerendered
- `●` SSG — generateStaticParams
- `ƒ` Dynamic — server-rendered on demand
- `ƒ Proxy (Middleware)` — middleware active

### 8.2 Test Result

OBSERVED: `pnpm test` (vitest) :
```
Test Files: 2 failed | 1556 passed (1558)
Tests:      2 failed | 13188 passed (13190)
Duration:   33.88s
```

**2 tests échouant :**
1. `.claude/worktrees/agent-a7a05614/packages/metamask-snap-v2/src/__tests__/snap.test.ts` — "returns panel with no warnings for plain transfer"
2. `.claude/worktrees/agent-a1e662dd/src/lib/wallets/walletconnect/__tests__/deeplinks.test.ts` — "builds Ledger WC URI"

OBSERVED: Les deux fichiers sont dans `.claude/worktrees/` — répertoires d'agents Claude précédents, **pas le code main**.
INFERENCE: Le test runner inclut les worktrees dans la découverte. Le code main est sain.

### 8.3 Vercel Config (vercel.json)

16 crons configurés :

| Cron | Schedule | Description |
|------|----------|-------------|
| `/api/cron/onchain/sync` | `0 0 * * *` | Sync on-chain quotidien |
| `/api/cron/social/discover` | `0 6 * * *` | Discovery sociale |
| `/api/cron/social/capture` | `0 7 * * *` | Capture sociale |
| `/api/cron/signals/run` | `0 8 * * *` | Run signaux |
| `/api/cron/alerts/deliver` | `0 9 * * *` | Livraison alertes |
| `/api/cron/watcher-v2` | `0 6 */3 * *` | Watcher (tous les 3 jours) |
| `/api/cron/daily-flow` | `0 2 * * *` | Daily flow |
| `/api/cron/watch-rescan` | `0 8 * * *` | Rescan watchlist |
| `/api/cron/weekly-digest` | `0 8 * * 1` | Digest hebdo (lundi) |
| `/api/cron/intel-rss` | `0 7 * * *` | Intel RSS |
| `/api/cron/intel-summarize` | `30 7 * * *` | Résumé intel |
| `/api/cron/helius-scan` | `0 4 * * *` | Helius scan Solana |
| `/api/cron/security-weekly-digest` | `0 8 * * 1` | Digest sécu hebdo |
| `/api/cron/watch-alerts` | `0 8 * * *` | Alertes watch |
| `/api/cron/digest` | `0 9 * * 1` | Digest lundi |
| `/api/cron/process-events` | `0 3 * * *` | Processing events |

**Crons dans le code mais PAS dans vercel.json :** `corroboration`, `intake-watch`, `mm-batch-scan`, `mm-calibration` — probablement déclenchés manuellement ou via admin.

### 8.4 DNS

NOT VERIFIED — `dig` non exécuté. Cloudflare confirmé via headers prod (`server: cloudflare`, `cf-ray`).

### 8.5 Git State

- **Branch active :** main
- **Remote :** `https://github.com/INTERLIGENS/interligens-app.git`
- **Tags :** `beta-investor-freeze-2026-05`, `pre-audit-2026-04-21`, `safety-before-constellation-3d-20260421-0845`, `security-baseline-2026-03-04`, `v2.0-investigators`
- **Branches feat actives :** 20+ branches feat/*, dont feat/case-intelligence-beta (mentionné CLAUDE.md comme branch active)
- **Untracked :** `packages/widget/package-lock.json`
- **Last 10 commits :** Série de fixes (internal links, crash null guard, scan result stability, stale scores)
- **`package.json` :** `{"name": "interligens-web", "version": "0.1.0", "engines": null}`

### 8.6 External Services

- OBSERVED: **Helius** (mainnet) — HELIUS_API_KEY présent
- OBSERVED: **Neon** (ep-square-band) — DATABASE_URL présent
- OBSERVED: **Upstash Redis** — UPSTASH_REDIS_REST_URL + TOKEN présents
- OBSERVED: **R2 Cloudflare** — R2_ACCESS_KEY_ID + SECRET présents
- OBSERVED: **Resend** — RESEND_API_KEY présent
- OBSERVED: **Anthropic** — ANTHROPIC_API_KEY présent
- OBSERVED: **Birdeye** — BIRDEYE_API_KEY présent
- OBSERVED: **Betterstack** — BETTERSTACK_API_TOKEN présent
- NOT VERIFIED: Alchemy, Metasleuth, Forta, 1inch, Discord (vars absentes localement)
- OBSERVED: **Watcher** sur Host-005 (krypt@MacBook-Pro-4, launchctl, 29 handles) — hors scope de cet audit

### Section verdict
- Verified: Build OK. Tests main OK. Crons configurés. Git sain. Services clés présents.
- Broken: 2 failing tests dans worktrees (cleanup requis). Crons corroboration/intake/mm absents de vercel.json.
- Risk: `packages/widget/package-lock.json` non committé.
- Unknown: DNS Cloudflare config. État réel des crons en prod.

---

## 9. DOCUMENTATION INVENTORY

### 9.1 Documentation trouvée

**`docs/` :** 27 fichiers markdown + 1 docx + 1 yaml + 1 sql + 1 répertoire `metamask-snap/`

| Fichier | Lignes | Freshness | Contenu |
|---------|--------|-----------|---------|
| `ARCHITECTURE.md` | 269 | 30 avr 2026 | Architecture globale |
| `SCORING_ENGINE.md` | 162 | 1 mai 2026 | Scoring engine |
| `PARTNER_API_V1.md` | 229 | 29 avr 2026 | Doc API partenaires |
| `PARTNER_API_V1.openapi.yaml` | — | 29 avr 2026 | OpenAPI spec |
| `SECURITY_BASELINE.md` | 148 | 4 mars 2026 | Baseline sécurité |
| `FINAL_SECURITY_LOCKDOWN.md` | 124 | 4 mars 2026 | Lockdown sécurité |
| `FINAL_API_SECURITY_VERIFICATION.md` | 110 | 4 mars 2026 | Vérification API |
| `OPS_ADMIN_PLAYBOOK.md` | 162 | 8 mars 2026 | Playbook ops |
| `MONITORING.md` | 153 | 9 mars 2026 | Monitoring |
| `MODULES.md` | 85 | 30 avr 2026 | Modules internes |
| `RUNBOOK.md` | 33 | 9 mars 2026 | Runbook (court) |
| `security-center-audit.md` | 267 | 21 avr 2026 | Audit security center |
| `security-center-runbook.md` | 226 | 21 avr 2026 | Runbook security center |
| `SECURE_SDLC.md` | 168 | 4 mars 2026 | SDLC sécurisé |
| `qa.md` | 279 | 1 mars 2026 | QA (potentiellement stale) |
| `INTERLIGENS_MM_TRACKER_Spec_v1_2_1_FINAL.docx` | — | 21 avr 2026 | Spec MM (binaire) |
| `TELEGRAM_WATCHER_V3.md` | 85 | 30 avr 2026 | Watcher Telegram |

**Racine :**
- `DECISIONS.md` — 488 lignes — historique décisions architecturales
- `INTELLIGENCE_MODE.md` — 220 lignes
- `INVESTIGATORS_FINALISATION_AUDIT.md` — 206 lignes
- `FINAL_PRE_FREEZE_REPORT.md` — 123 lignes (21 avr)
- `POST_FREEZE_POLISH_REPORT.md` — 93 lignes (1 mai)
- 9 `AUDIT_REPORT_*.md` dans la racine
- `MIGRATION_RETAILVISION.md` — 2000 lignes
- `MIGRATION_ASKLOG.md` — 250 lignes (indique que AskLog est une migration récente)
- `CLAUDE.md` — 16 lignes (instructions Claude Code)

### 9.2 Documentation manquante

- Pas de CHANGELOG maintenu automatiquement
- RUNBOOK.md trop court (33 lignes) pour un incident prod complet
- qa.md potentiellement stale (1 mars, avant beaucoup de features)
- Pas de doc API pour les endpoints `/api/investigators/*` (40+ routes)
- Pas de doc pour le système d'alertes watchlist
- Pas d'ADR formalisés (DECISIONS.md fait office de registre informel)

### Section verdict
- Verified: Documentation abondante. Scoring, partner API, security, architecture bien documentés.
- Broken: RUNBOOK.md insuffisant. qa.md stale.
- Risk: 40+ routes investigators non documentées.
- Unknown: Cohérence ARCHITECTURE.md vs état réel du code.

---

## 10. OPEN QUESTIONS / UNKNOWNS

1. **Cloudflare 403 prod** : Pourquoi `/api/health` retourne 403 en prod ? Est-ce une règle WAF intentionnelle sur toutes les IPs sans cookie ? Ou régression de config ?

2. **Score discrepancy** : Score 20 (public engine) vs 0 (partner engine) pour EKpQ. Le score=0 du partner engine signifie-t-il "safe" ou "inconnu" ? La doc partenaires `/docs/PARTNER_API_V1.md` le clarifie-t-elle ?

3. **AskLog table absente** : `MIGRATION_ASKLOG.md` indique une migration pour cette table. A-t-elle été appliquée en prod ? La fonctionnalité `/admin/ask-logs` est-elle silencieusement cassée ?

4. **casefiles schema** : La table `casefiles` existe en DB mais la colonne `slug` n'existe pas. Le schéma Prisma est-il désynchronisé pour ce modèle ?

5. **prisma db execute SELECT** : Pourquoi l'outil n'affiche jamais les données de retour des SELECT ? Limitation de la version 5.22 ?

6. **Watcher Host-005** : État opérationnel du watcher (krypt@MacBook-Pro-4, 29 handles). Non vérifié dans cet audit.

7. **feat/case-intelligence-beta branch** : CLAUDE.md indique cette branch comme "active" mais on est sur main. Y a-t-il des changements non mergés importants ?

8. **PARTNER_API_KEY_V** : Variable référencée dans le code mais absente localement. Quelle fonctionnalité couvre-t-elle ? Version B du partner key ?

9. **Investigators auth** : Les routes `/api/investigators/*` sont marquées NONE dans l'inventaire auto. L'authentification est-elle dans le handler lui-même ? Quelle est la surface d'attaque réelle ?

10. **Crons non dans vercel.json** : `corroboration`, `intake-watch`, `mm-batch-scan`, `mm-calibration` ont des routes cron mais ne sont pas dans vercel.json. Comment sont-ils déclenchés ?

11. **KOL registry** : CLAUDE.md dit 215 profils publiés mais l'API retourne 20+ avec `publishable: true/false` mélangés. Comment est géré le total de 215 ?

12. **X auth tokens rotation** : 2 paires de tokens X (TOKEN_1/2, CT0_1/2). Quelle est la politique de rotation ? Durée de validité des sessions X/Twitter ?

13. **Rate limiter Redis down** : En prod, si Upstash est down, PDF rate limit fail-closed (OK) mais SCAN/OSINT fail-open — comportement intentionnel documenté dans les tests mais à valider avec l'équipe.

---

## 11. HANDOFF PRIORITIES

### P0 — Immédiat / Bloquant

**~~P0.1 — Vérifier l'accessibilité prod~~ → RECLASSIFIED / NOT A FINDING**
- Status: **EXPECTED BEHAVIOR**
- Evidence: Tous les endpoints prod retournent 403 Cloudflare depuis IP externe sans session beta.
- Confirmed: Cloudflare Access Policy active sur le domaine entier — beta privée intentionnelle.
- Action: Aucune. Le comportement est correct.

---

**P0.2 — Table AskLog absente en prod**
- Status: **CONFIRMED REAL (soft)**
- Evidence (vérifié 2026-05-02) :
  - `grep "model AskLog" prisma/schema.prod.prisma` → ligne 1204, modèle défini
  - `/admin/ask-logs` → HTTP 200 (page rendue), mais `loadLogs()` catch l'erreur P1014 et retourne `[]` — affiche "No AskLog entries yet. See MIGRATION_ASKLOG.md"
  - `src/app/api/admin/stats/route.ts:53-55` appelle `prisma.askLog.count()` × 3 sans try/catch — endpoint `/api/admin/stats` crashe en prod avec P1014
  - `MIGRATION_ASKLOG.md` existe à la racine — migration jamais appliquée en prod
- Minimal action: Appliquer la migration via Neon SQL Editor (script dans MIGRATION_ASKLOG.md). Ne pas utiliser `prisma db push`.

---

**P0.3 — Score discrepancy public vs partner engine**
- Status: **CONFIRMED REAL (architectural)**
- Evidence (vérifié 2026-05-02) :
  - EKpQ (WIF) : public `/api/v1/score` → score=20, verdict=GREEN | partner `/api/partner/v1/score-lite` → score=0, tier=GREEN
  - BOTIFY (rug confirmé) : public → score=70, verdict=RED | partner → score=0, tier=GREEN ← **token scam retourne GREEN via partner API**
  - Root cause : `score-lite/route.ts:131-141` appelle `computeTigerScoreWithIntel({ chain:"SOL", scan_type:"token" }, address)` sans enrichissement préalable. Ni `getMarketSnapshot` (DexScreener), ni `loadCaseByMint` (CaseFiles DB) ne sont appelés. Le public engine (`/api/v1/score`) fait ces deux enrichissements avant d'appeler le même moteur.
  - `computeTigerScoreWithIntel` ne fait pas de lookup CaseFile interne — il utilise uniquement `lookupValue` (canonical intel entities), dataset différent de la CaseFiles table.
  - Score=0 partner = "aucun signal trouvé" ≠ "safe"
- Minimal action (2 options) :
  1. **Quick doc fix** : Mettre à jour `docs/PARTNER_API_V1.md` — clarifier que `score=0` signifie "insufficient data", pas "safe". Breaking change documentaire uniquement.
  2. **Fix réel** : Ajouter `loadCaseByMint` dans `score-lite/route.ts` avant d'appeler l'engine, comme le fait `/api/v1/score`. Résout le BOTIFY/rug case.

### P1 — Priorité haute / Cette semaine

**P1.1 — Rate limiter partner score-lite**
OBSERVED: In-memory rate limiter (Map JS) non distribué entre lambdas Vercel. À migrer vers Upstash Redis identique aux autres presets (pattern existant dans `src/lib/publicScore/rateLimit.ts`).

**P1.2 — Cleanup des worktrees Claude**
OBSERVED: 8 répertoires `.claude/worktrees/agent-*/` dans le repo. Le test runner les inclut, causant 2 failing tests. Supprimer ou exclure du vitest config.

**P1.3 — Variables d'env manquantes**
OBSERVED: 35+ vars absentes localement. Auditer lesquelles sont requises en prod vs optionnelles. Documenter la liste minimale dans CLAUDE.md ou un fichier `.env.example`.

**P1.4 — Vérifier casefiles schema**
OBSERVED: La table `casefiles` en prod n'a pas de colonne `slug` alors que le schéma Prisma en définit une. Vérifier si le schéma est désynchronisé avec la migration réelle.

### P2 — À planifier

**P2.1 — Headers de sécurité prod**
OBSERVED: Seuls x-frame-options et referrer-policy présents. CSP défini dans le code (`src/lib/security/headers.ts`) mais absent de la réponse prod. Vérifier si Cloudflare supprime ces headers, et si oui, les configurer côté Cloudflare WAF.

**P2.2 — `$queryRawUnsafe` audit**
OBSERVED: 6 routes admin utilisent `$queryRawUnsafe`. Vérifier que chaque usage est correctement paramétré (pattern `$1`, `$2`) et non interpolé avec des entrées utilisateur.

**P2.3 — Prisma major update**
OBSERVED: Prisma 5.22 → 7.8 disponible. Planifier la migration avec les breaking changes documentés sur pris.ly/d/major-version-upgrade. Ne pas faire en urgence.

**P2.4 — Documenter les routes investigators**
OBSERVED: 40+ routes `/api/investigators/*` non documentées dans `docs/`. Risque de surface d'attaque non évaluée.

**P2.5 — Rotation X auth tokens**
OBSERVED: 2 paires de tokens X actifs. Définir une politique de rotation et documenter.

---

## APPENDIX

### A. Branches git actives (feat/*)

```
feat/admin-design-unify
feat/admin-documents-r2
feat/admin-hub
feat/admin-stats-documents
feat/admin-threads-x
feat/advanced-signals-block
feat/cex-deposit-tracking
feat/constellation-visual-upgrade
feat/contradiction-alerts
feat/cross-case-linking
feat/csv-validation
feat/dead-letter-replay
feat/destination-risk
feat/domain-events
feat/e2e-validation
feat/enrich-public-score
feat/feedback-button
feat/foundations-audit-fix
feat/founding-intelligence-seed
feat/freshness-engine
[...et plus]
```

### B. Worktrees actives (.claude/worktrees/)

```
agent-a052fda2
agent-a1e662dd
agent-a47dc612
agent-a7522bdd
agent-a7a05614
agent-a8d36e48
agent-a9620f1b
agent-aa11c1e3
```

Ces 8 répertoires sont inclus dans le test runner → 2 tests failing.

### C. Middleware auth summary

Le middleware (`src/middleware.ts`) gère :
1. **Admin shortcut** : Si `verifyAdminSession` et path `/investigators/onboarding/*` → redirect `/investigators/box`
2. **Localized admin** : `/[locale]/admin/*` gated par `checkBasicAuth` ou redirect login
3. **Beta gate** : Toutes les pages publiques nécessitent le cookie `investigator_session`
4. **Exemptions** : `/access*`, `/simulator*`, `/api/*`, `/admin*`, `/_next*`, assets statiques, `/health`, `/sitemap.xml`, `/robots.txt`

### D. Rate limit presets

```typescript
pdf:     { windowMs: 5 * 60 * 1000, max: 10,  keyPrefix: "rl:pdf"     }  // 10 req / 5min
scan:    { windowMs: 60 * 1000,     max: 20,  keyPrefix: "rl:scan"    }  // 20 req / 1min
osint:   { windowMs: 60 * 1000,     max: 30,  keyPrefix: "rl:osint"   }  // 30 req / 1min
partner: { windowMs: 60 * 1000,     max: 120, keyPrefix: "rl:partner" }  // 120 req / 1min
public:  { windowMs: 60 * 1000,     max: 120, keyPrefix: "rl:public"  }  // 120 req / 1min
```

Behavior Redis down : PDF → fail-closed. SCAN, OSINT → fail-open. Comportement testé et documenté.

Partner score-lite : rate limiter local séparé (60 req/min, in-memory, non Redis).

### E. Vercel Crons (16 configurés)

Voir Section 8.3 pour le tableau complet.

Non dans vercel.json : `corroboration`, `intake-watch`, `mm-batch-scan`, `mm-calibration`.

### F. Stack summary

| Composant | Version |
|-----------|---------|
| Next.js | 16 (params async) |
| TypeScript | — |
| Tailwind | — |
| Prisma | 5.22 (→ 7.8 dispo) |
| Node | v20.20.0 |
| pnpm | 10.30.1 |
| Vitest | — |
| DB | Neon (ep-square-band, pgbouncer 6543) |
| CDN/WAF | Cloudflare |
| Hosting | Vercel |
| Storage | R2 (PDFs) + Rawdocs S3 |
| Cache | Upstash Redis |
| AI | Anthropic (ANTHROPIC_API_KEY présent) |
| Email | Resend |
| Blockchain | Helius (SOL), ETH publicnode, Birdeye, Etherscan |

---

*Rapport généré par audit READ ONLY. Aucune modification effectuée. Aucun commit. Aucun deploy.*
*Audit timestamp: 2026-05-02T10:45:00Z — Machine: Host-003*
