# Isolation Preview → Production

Fermeture de l'écriture depuis un déploiement Preview vers la base de
production `ep-square-band`.

Ce document couvre le **volet configuration**, qui reste une action humaine
dans l'UI Vercel. Le **volet code** est déjà livré : `src/lib/ops/prodWriteGuard.ts`
rend la faille inoffensive même si la configuration n'est pas touchée.

Projet concerné : **`interligens-app`** (`prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ`).
Le projet `interligens-web` est un projet parasite — ne rien y toucher.

---

## ⚠️ À lire avant de poser la moindre valeur

Trois valeurs ont déjà été posées dans ce projet avec un défaut **invisible dans
l'UI Vercel** : un `"101\n"` avec retour à la ligne, un secret tronqué au
copier-coller, un caractère non hexadécimal. L'UI n'affiche ni les espaces de
fin, ni les sauts de ligne, ni la longueur.

**Avant chaque Save, valider la valeur hors de l'UI**, dans un terminal :

```bash
# Coller la valeur entre les quotes simples, puis lire les trois lignes.
V='...'
printf '%s' "$V" | wc -c                 # longueur exacte, sans le \n final
printf '%s' "$V" | od -c | tail -3       # révèle \n, \r, espaces, tabulations
printf '%s' "$V" | LC_ALL=C grep -nP '[^\x20-\x7E]' && echo "CARACTÈRE NON IMPRIMABLE" || echo "jeu de caractères OK"
```

Attendus par type de valeur :

| Type | Longueur | Jeu de caractères | Piège connu |
|---|---|---|---|
| Chaîne de connexion Postgres | > 60 | commence par `postgres://` ou `postgresql://` | `?sslmode=require` perdu au copier-coller |
| Secret hexadécimal | pair, ≥ 32 | `[0-9a-f]` uniquement | un `g`/`l`/`O` collé depuis une police ambiguë |
| Token (Stripe, Resend, X…) | selon vendeur | pas d'espace, pas de `\n` | troncature en fin de sélection |
| Booléen / entier | 1–5 | `true`/`false` ou `[0-9]` | `"101\n"` — le `\n` casse `parseInt` en silence |

Règle générale : **`od -c` doit se terminer sur le dernier caractère utile**,
jamais sur `\n` ou un espace.

---

## 1. Inventaire des variables par scope

Relevé du 2026-08-15 via `npx vercel env ls`, colonne `value` supprimée à la
source (voir §5.1 : cette commande **affiche** une colonne de valeur).

Familles :

- **A — jamais en Preview.** Donne un accès en écriture à une ressource réelle,
  ou consomme un quota facturé.
- **B — nécessaire au build Preview.** Sans elle la PR ne compile plus. Doit
  recevoir une valeur de substitution inoffensive, pas une suppression.
- **C — indifférente.** Peut rester en l'état.

### 1.1 Famille A — présentes en Preview, à retirer

| Variable | Scopes actuels | Ressource atteinte | Gravité |
|---|---|---|---|
| `DATABASE_URL` | Production, **Preview** | écriture `ep-square-band` | **critique** |
| `DATABASE_URL_UNPOOLED` | Prod, **Preview**, Dev | écriture `ep-square-band` (directUrl Prisma) | **critique** |
| `POSTGRES_PRISMA_URL` | Prod, **Preview**, Dev | même base | **critique** |
| `POSTGRES_URL` | Prod, **Preview**, Dev | même base | **critique** |
| `POSTGRES_URL_NON_POOLING` | Prod, **Preview**, Dev | même base | **critique** |
| `POSTGRES_URL_NO_SSL` | Prod, **Preview**, Dev | même base | **critique** |
| `PGPASSWORD` / `PGUSER` / `PGHOST` / `PGHOST_UNPOOLED` / `PGDATABASE` | Prod, **Preview**, Dev | même base, par client `psql` | **critique** |
| `POSTGRES_PASSWORD` / `POSTGRES_USER` / `POSTGRES_HOST` / `POSTGRES_DATABASE` | Prod, **Preview**, Dev | même base | **critique** |
| `NEON_PROJECT_ID` | Prod, **Preview**, Dev | identifie le projet Neon | moyenne |
| `CRON_SECRET` | ligne **Preview** distincte | déclenche toute route `/api/cron/*` | **critique** |
| `ADMIN_TOKEN` | ligne **Preview** distincte | ouvre les routes admin | **critique** |
| `ADMIN_BASIC_USER` / `ADMIN_BASIC_PASS` | Prod, **Preview**, Dev | Basic auth admin | **critique** |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_ACCOUNT_ID` | Prod, **Preview**, Dev | écriture bucket R2 réel | haute |
| `RAWDOCS_S3_SECRET_KEY` / `RAWDOCS_S3_ACCESS_KEY` / `RAWDOCS_S3_BUCKET` / `RAWDOCS_S3_ENDPOINT` | Prod, **Preview**, Dev | écriture bucket rawdocs | haute |
| `KV_REST_API_TOKEN` / `KV_URL` / `KV_REST_API_URL` / `REDIS_URL` / `UPSTASH_REDIS_REST_TOKEN` / `UPSTASH_REDIS_REST_URL` | Prod, **Preview**, Dev | état partagé, rate-limits | haute |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Prod, **Preview** | **paiements réels** | **critique** |
| `X_BEARER_TOKEN` / `X_AUTH_TOKEN_1` / `X_CT0_1` / `X_AUTH_TOKEN_2` / `X_CT0_2` | Prod, **Preview**(, Dev) | quota mensuel X partagé | haute |
| `ANTHROPIC_API_KEY` | Prod, **Preview** | API facturée | haute |
| `HELIUS_API_KEY` | ligne **Preview** distincte | API facturée | haute |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | Prod, **Preview**, Dev | envoie de vrais messages | haute |
| `BETTERSTACK_API_TOKEN` | Prod, **Preview** | modifie le monitoring réel | moyenne |
| `DIGEST_RECIPIENTS` | Prod, **Preview** | emails à de vraies personnes | moyenne |
| `MOBILE_API_TOKEN` / `INVESTIGATOR_TOKEN` / `LEGAL_PDF_TOKEN` / `GOOGLE_APPS_SCRIPT_URL` / `TURNSTILE_SECRET` | Prod, **Preview**(, Dev) | accès applicatifs réels | moyenne |

### 1.2 Famille B — obligatoires au build Preview

Prouvé (voir §5.2) : `src/lib/config/env.ts` appelle `requireInProd()` sur
exactement ces cinq clés, et un build Preview tourne avec `NODE_ENV=production`.
Les vider ou les supprimer casse la compilation de toute PR.

| Variable | Substitution Preview |
|---|---|
| `DATABASE_URL` | URL syntaxiquement valide pointant nulle part (voir §3) |
| `ADMIN_TOKEN` | valeur aléatoire dédiée Preview, jamais celle de Production |
| `VAULT_AUDIT_SALT` | sel aléatoire dédié Preview |
| `ADMIN_BASIC_USER` | valeur dédiée Preview |
| `ADMIN_BASIC_PASS` | valeur dédiée Preview |

`CRON_SECRET` **n'est pas** dans cette famille — prouvé §5.2. Il se supprime de
Preview sans substitut.

### 1.3 Famille C — indifférentes

`BILLING_ENABLED`, `BETA_CAP_REACHED`, `BETA_FOUNDER_CAP`, `STRIPE_TAX_ENABLED`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_TIGRE_BASE_URL`, `NITTER_BASE_URL`,
`ALERT_EMAIL`, `ALERT_FROM_EMAIL`, `BETA_FROM_EMAIL`, `PDF_STORAGE_ENABLED`,
`R2_ENDPOINT`, `RAWDOCS_S3_REGION`, `RAWDOCS_STORAGE`, `MM_SCAN_BLOCK_LIVE`,
`EXPORT_MAX_ROWS`, `APPROVE_CHUNK_SIZE`, `SCAN_RATE_LIMIT`, `IP_HASH_SALT`,
`NODE_ENV`.

> `NODE_ENV` est posée manuellement comme variable de projet sur les trois
> scopes. Vercel la pose déjà lui-même. Doublon à examiner **dans un chantier
> séparé** — y toucher ici changerait le comportement du build.

---

## 2. Ce que le code garantit déjà, sans toucher à Vercel

`src/lib/ops/prodWriteGuard.ts` est branché sur **22 routes** : les 21 routes
`/api/cron/**` actives et `/api/intelligence/ingest/[slug]`. Les deux seules
routes non gardées, `/api/cron/digest` et `/api/cron/security-weekly-digest`,
sont des no-op dépréciés qui ne touchent ni la base ni aucune API.

Règle appliquée : **une route refuse de s'exécuter (403) quand la base visée est
`ep-square-band` et que `VERCEL_ENV` ne vaut pas `production`.**

- `VERCEL_ENV` est injectée par Vercel, pas par le projet : un Preview ne peut
  pas se la réattribuer.
- Fail-closed : `VERCEL=1` avec `VERCEL_ENV` absente, vide ou inconnue → blocage.
- Le garde inspecte **toutes** les variables de connexion connues, pas seulement
  `DATABASE_URL` : retirer `DATABASE_URL` de Preview sans retirer les alias
  `POSTGRES_*` ne suffirait pas.
- La chaîne de connexion n'est jamais comparée en entier ni journalisée ; seul
  l'hôte apparaît dans le 403.

Couverture verrouillée par `__tests__/anti-regression/cronRoutesProdWriteGuard.test.ts` :
une nouvelle route cron sans garde fait échouer la CI.

**Conséquence assumée** : si l'option *Enable access to System Environment
Variables* est décochée dans les réglages du projet, `VERCEL_ENV` disparaît et
les crons de production se coupent — bruyamment et réversiblement — au lieu de
rouvrir l'écriture depuis les Preview. Ne pas décocher cette option.

### 2.1 Ce que le garde ne couvre PAS — mesuré, pas estimé

Le garde ferme le vecteur cron. Il ne retire pas la **capacité** d'écrire : il
gate 22 call-sites. Relevé du 2026-08-15 sur l'arborescence réelle :

| | Routes |
|---|---|
| Routes API totales | 361 |
| Routes qui écrivent en base | **159** |
| Couvertes par le garde | 22 (14 %) |
| **Non couvertes** | **137** |

Répartition des 137 :

| Protection | Routes | Clé présente en Preview ? |
|---|---|---|
| `ADMIN_TOKEN` | 84 | oui |
| Session investigateur (`INVESTIGATOR_TOKEN`) | 37 | oui |
| **Aucun token** | **16** | sans objet — ouvertes |

Quatre de ces seize font un `INSERT` sans la moindre authentification :

```
/api/community/submit      prisma.communitySubmission.create
/api/feedback              prisma.feedbackReport.create
/api/transparency/submit   prisma.transparencySubmission.create
/api/billing/waitlist      prisma.waitlistEntry.create
```

Un `curl` anonyme sur l'URL d'un déploiement Preview écrit donc aujourd'hui
dans `ep-square-band`, et le garde du §2 n'y peut rien.

**C'est la raison pour laquelle le §3 n'est pas facultatif.** Seul le retrait de
`DATABASE_URL` (et de ses quinze alias) du scope Preview est catégoriel : il
supprime la capacité au lieu de garder les appels. Le garde de code reste utile
pour une autre raison — il est dans le diff, il passe en revue de PR, et il
échoue en CI ; une variable d'environnement se re-coche en un clic sans laisser
de trace.

---

## 3. Séquence exacte des actions dans l'UI Vercel

Chemin : **Vercel → projet `interligens-app` → Settings → Environment Variables**.

> Vercel ne permet pas deux entrées de même nom sur des scopes qui se
> chevauchent. Retirer Preview d'une entrée existante **puis** créer l'entrée
> Preview dédiée est donc obligatoire dans cet ordre. Entre les deux, les builds
> Preview échouent — c'est court, visible et réversible.

Faire les étapes **dans l'ordre**. Après chaque étape, `npx vercel env ls`
(voir §5.1 pour la version sans fuite) doit refléter le changement.

### Étape 1 — Supprimer `CRON_SECRET` de Preview

- **Action** : sur la ligne `CRON_SECRET` scopée *Preview* (créée il y a ~118 j),
  cliquer *Remove*. **Ne pas toucher** à la ligne scopée *Production*.
- **Ce que ça change** : un Preview ne peut plus authentifier un appel `/api/cron/*`.
- **Si on l'oublie** : n'importe qui connaissant l'URL du Preview et le secret
  peut déclencher les crons. Le garde du §2 les bloque désormais, mais on
  conserve deux barrières plutôt qu'une.
- **Ne casse rien** : le scheduler Vercel n'appelle **que l'URL de production**
  (doc Vercel *Cron Jobs*), et la variable n'est pas requise au build (§5.2).
- **Vérifier** : `CRON_SECRET` n'apparaît plus qu'avec le scope `Production`.

### Étape 2 — Supprimer `ADMIN_TOKEN` de Preview, puis reposer une valeur dédiée

- **Action a** : supprimer la ligne `ADMIN_TOKEN` scopée *Preview*.
- **Action b** : *Add New* → nom `ADMIN_TOKEN`, scope **Preview uniquement**,
  valeur = secret aléatoire **différent** de celui de Production
  (`openssl rand -hex 32`). Valider avec le bloc de §⚠️ avant Save.
- **Si on saute l'action b** : tout build Preview échoue sur
  `[env] Missing required env var in prod: ADMIN_TOKEN`.
- **Vérifier** : deux lignes `ADMIN_TOKEN`, l'une *Production*, l'autre *Preview*.

### Étape 3 — Découpler `DATABASE_URL`

- **Action a** : sur la ligne `DATABASE_URL` scopée *Production, Preview*,
  éditer et **décocher Preview**. Production reste cochée.
- **Action b** : *Add New* → `DATABASE_URL`, scope **Preview uniquement**,
  valeur :
  ```
  postgresql://preview:preview@127.0.0.1:5432/preview?sslmode=disable
  ```
  Cette valeur satisfait `requireInProd`, laisse `prisma generate` passer, et
  toute tentative de connexion échoue immédiatement au lieu d'atteindre la prod.
- **Si on saute l'action b** : builds Preview cassés (prouvé §5.2).
- **Vérifier** : `DATABASE_URL` apparaît sur deux lignes de scopes disjoints.

> **Décision du 2026-08-15 : c'est la valeur inerte qui est retenue.** Les PR
> sont relues sur le diff, pas sur le déploiement Preview. Conséquence assumée :
> toute page Preview adossée à la base répond en 500. C'est le comportement
> voulu — un Preview n'a aucune raison de lire la production.
>
> L'alternative « branche Neon dédiée Preview » est décrite en §6 comme
> chantier ultérieur (C′). Tant que l'hôte d'une telle branche ne contient pas
> `ep-square-band`, le garde du §2 la laisse passer — le cas est déjà prévu.

### Étape 4 — Découpler les alias Neon

Même geste que l'étape 3, pour **chacune** de ces entrées scopées
*Production, Preview, Development* : décocher Preview.

`DATABASE_URL_UNPOOLED`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL`,
`POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_HOST`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `PGHOST`,
`PGHOST_UNPOOLED`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `NEON_PROJECT_ID`.

- **Substitution nécessaire** : uniquement pour `DATABASE_URL_UNPOOLED`
  (`directUrl` du schéma Prisma) — reposer la même valeur factice qu'à
  l'étape 3b, scope Preview. Les autres peuvent rester absentes de Preview.
- **Si on l'oublie** : c'est le point aveugle principal. Retirer `DATABASE_URL`
  seul laisse **quatorze** autres chemins vers la même base.
- **Vérifier** : `npx vercel env ls` ne montre plus `Preview` sur aucune de ces
  lignes.

### Étape 5 — Découpler les identifiants admin

`ADMIN_BASIC_USER` et `ADMIN_BASIC_PASS` : décocher Preview sur l'entrée
partagée, puis recréer une entrée Preview avec des identifiants dédiés
(famille B — le build échoue sans eux).

### Étape 6 — Découpler `VAULT_AUDIT_SALT`

Décocher Preview, puis recréer une entrée Preview avec un sel aléatoire dédié
(`openssl rand -hex 32`). Famille B.

> Un sel Preview identique à celui de Production rendrait les hachages calculés
> en Preview comparables à ceux de Production. Valeur distincte obligatoire.

### Étape 7 — Découpler les écritures externes

Décocher Preview sur : `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `RAWDOCS_S3_ACCESS_KEY`,
`RAWDOCS_S3_SECRET_KEY`, `RAWDOCS_S3_BUCKET`, `RAWDOCS_S3_ENDPOINT`,
`KV_REST_API_TOKEN`, `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_READ_ONLY_TOKEN`,
`REDIS_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

Aucune substitution : le code retombe sur `hasS3()` / `hasRedis()` qui rendent
`false` quand les valeurs manquent.

### Étape 8 — Découpler les APIs facturées et les canaux sortants

Décocher Preview sur : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`X_BEARER_TOKEN`, `X_AUTH_TOKEN_1`, `X_CT0_1`, `X_AUTH_TOKEN_2`, `X_CT0_2`,
`ANTHROPIC_API_KEY`, `HELIUS_API_KEY` (ligne Preview : supprimer),
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `BETTERSTACK_API_TOKEN`,
`DIGEST_RECIPIENTS`, `MOBILE_API_TOKEN`, `INVESTIGATOR_TOKEN`,
`LEGAL_PDF_TOKEN`, `GOOGLE_APPS_SCRIPT_URL`, `TURNSTILE_SECRET`.

- **Ce qui casse** : les écrans Preview dépendant de Stripe ou de Turnstile
  affichent un état dégradé. C'est le comportement voulu : une PR ne doit pas
  encaisser un paiement réel.

### Étape 9 — Redéployer un Preview et vérifier

Ouvrir une PR triviale, laisser le Preview se construire, puis §5.3.

---

## 4. Ce qu'il ne faut jamais faire

- ❌ `vercel env pull` — a déjà supprimé `ADMIN_TOKEN` par le passé.
- ❌ Toucher au projet `interligens-web`.
- ❌ `prisma db push` sur `ep-square-band`. Migrations via Neon SQL Editor, additives.
- ❌ Décocher *Enable access to System Environment Variables* (§2).
- ❌ Recopier une valeur de Production dans une entrée Preview.

---

## 5. Vérifications

### 5.1 Lister les variables sans faire fuiter de valeur

`npx vercel env ls` **affiche une colonne `value`** : `Hidden` pour les
variables de type *Sensitive*, mais un préfixe de charge utile pour les
*Non-sensitive* — et la majorité des variables de ce projet sont
*Non-sensitive*. Ne jamais lancer la commande nue dans un terminal partagé,
un transcript ou un log de CI.

```bash
npx vercel env ls > /tmp/envls.raw 2>/dev/null
HDR=$(head -2 /tmp/envls.raw | tail -1)
VS=$(awk '{print index($0,"value")}' <<< "$HDR")
TS=$(awk '{print index($0,"type")}'  <<< "$HDR")
awk -v vs="$VS" -v ts="$TS" 'NF{print substr($0,1,vs-1) substr($0,ts)}' /tmp/envls.raw
rm -f /tmp/envls.raw
```

### 5.2 Prouver quelles variables le build Preview exige

Sans déployer, en local :

```bash
# Build complet avec DATABASE_URL vidée → doit ÉCHOUER
env DATABASE_URL="" DATABASE_URL_UNPOOLED="" pnpm vercel-build
#   → Error: [env] Missing required env var in prod: DATABASE_URL

# Même build avec la valeur de substitution → doit RÉUSSIR
env DATABASE_URL="postgresql://preview:preview@127.0.0.1:5432/preview?sslmode=disable" \
    DATABASE_URL_UNPOOLED="postgresql://preview:preview@127.0.0.1:5432/preview?sslmode=disable" \
    pnpm vercel-build
```

Pour tester une clé isolément sans build complet :

```bash
NODE_ENV=production ADMIN_TOKEN="" npx tsx -e "import('./src/lib/config/env.ts')"
```

Résultat mesuré le 2026-08-15 : `DATABASE_URL`, `ADMIN_TOKEN`,
`VAULT_AUDIT_SALT`, `ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS` sont exigées ;
`CRON_SECRET` et `IP_HASH_SALT` ne le sont pas.

### 5.3 Prouver qu'un Preview n'atteint plus la base de production

Après l'étape 9, sur l'URL du déploiement Preview (jamais sur la prod) :

```bash
PREVIEW_URL="https://<deployment>-<hash>.vercel.app"

# 1. Sans secret → 401 attendu (la route reste fermée)
curl -s -o /dev/null -w '%{http_code}\n' "$PREVIEW_URL/api/cron/watcher-bridge"

# 2. Avec l'ancien secret de Production → 401 attendu.
#    Un 403 signifierait que CRON_SECRET est encore en Preview et que seul le
#    garde de code bloque : l'étape 1 n'a pas pris effet.
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $ANCIEN_SECRET_PROD" \
  "$PREVIEW_URL/api/cron/watcher-bridge"
```

Puis vérifier que **rien n'a été écrit**, depuis une machine ayant accès à la
base, en lecture seule :

```sql
-- Aucune ligne ne doit être apparue pendant le test.
SELECT id, status, started_at
FROM "JobRunLog"
ORDER BY started_at DESC
LIMIT 5;
```

> C'est la vérification qui compte le plus : `/api/cron/watcher-bridge` écrit
> une ligne `JobRunLog` **même quand son kill switch `WATCHER_BRIDGE_ENABLED`
> est absent** (`runBridgeJob` insère `status='disabled'` avant de sortir). Le
> kill switch n'a donc jamais protégé la base — seulement les drafts.

### 5.4 Vérifier le garde de code

```bash
pnpm test __tests__/security/prodWriteGuard.test.ts
pnpm test __tests__/anti-regression/cronRoutesProdWriteGuard.test.ts
```

---

## 6. Hors périmètre

Vus pendant l'audit, volontairement laissés :

- **C′ — branche Neon dédiée Preview.** Chantier ultérieur, décidé le
  2026-08-15 comme « plus tard ». Si un jour les PR doivent être relues sur le
  déploiement Preview, la forme à retenir est **une seule** branche Neon longue
  durée, partagée par tous les Preview, créée **schéma seul** — jamais depuis
  `ep-square-band`. Deux raisons : l'intégration Neon↔Vercel crée sinon une
  branche *par déploiement*, chacune avec son compute dédié (le coût suit le
  nombre de PR) ; et une branche créée depuis un parent contient par défaut
  toutes les données du parent, ce qui transformerait un risque d'écriture en
  risque d'exposition en lecture derrière une URL Preview. Coût non chiffré :
  le plan Neon du projet n'a pas été consulté.
- Les **16 routes écrivantes sans authentification** listées au §2.1. Elles
  sortent du périmètre de ce chantier, mais quatre d'entre elles acceptent un
  `INSERT` anonyme et méritent leur propre revue.
- `NODE_ENV` posée à la main sur les trois scopes alors que Vercel la pose déjà.
- Aucun garde équivalent côté **routes admin** (`x-admin-token`) : un Preview
  portant `ADMIN_TOKEN` atteint la base par cette voie aussi. L'étape 2 ferme
  la configuration, mais aucune barrière de code ne double la protection.
- Les scripts `scripts/**` et `src/scripts/**` lisent `.env.local` et écrivent
  en prod par conception ; ils ne sont pas concernés par `VERCEL_ENV`.
- La CI `Security Gates` est rouge sur `main` pour des raisons antérieures et
  indépendantes de ce chantier.
