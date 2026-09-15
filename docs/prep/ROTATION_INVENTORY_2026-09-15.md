# INVENTAIRE DE ROTATION DES CREDENTIALS — 2026-09-15

**Statut : PRÉPARATION. Rien n'a été roté, créé, révoqué ni invalidé pendant la fenêtre qui a produit ce document.**
Aucun fournisseur n'a été appelé. Aucune valeur de secret n'a été lue, affichée ou écrite ici — seulement des
noms, des longueurs, des positions, et des verdicts d'égalité calculés par empreinte.

Ce document est fait pour être exécuté à la main par une personne non technique. Chaque ligne dit *quoi*,
*où*, *dans quel ordre*, et *comment vérifier*.

---

## 0. LE FAIT CENTRAL, ET IL CHANGE LA PRIORITÉ

Le `.env` parti en production contient **16 affectations + 1 ligne orpheline**. La question qui décide
de tout n'est pas « quels noms sont partis » mais **« les valeurs parties sont-elles encore les valeurs
vivantes ? »**. Elle a été tranchée par comparaison d'empreintes entre `.env` (exposé) et `.env.local`
(courant) — sans jamais afficher de valeur.

Réponse : **cinq credentials exposés sont encore vivants aujourd'hui.**

| Credential | Constat mesuré |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | ⚠️ **Le mot de passe est IDENTIQUE à celui de la base de production.** Voir §0.1 — c'est le point le plus grave. |
| `ADMIN_TOKEN` | **Identique** à la valeur courante. Vivant. |
| `ADMIN_BASIC_USER` | **Identique** à la valeur courante. Vivant. |
| `ETHERSCAN_API_KEY` | **Identique** à la valeur courante. Vivant. |
| ligne 18, sans nom de variable | ⚠️ **C'est le `X_BEARER_TOKEN` vivant actuel.** Voir §0.2. |

### 0.1 — `DATABASE_URL` : « différente » ne voulait pas dire « périmée »

La comparaison brute des chaînes dit que la `DATABASE_URL` exposée diffère de la courante. **C'est un piège.**
En décomposant l'URL, la seule différence est l'hôte : l'exposée vise le point de terminaison *pooler*, la
courante vise le point de terminaison direct. **L'utilisateur (`neondb_owner`), le point de terminaison
(`ep-square-band`) et le MOT DE PASSE sont les mêmes.**

`ep-square-band` est la base de **production** (cf. `CLAUDE.md`).

> **Le mot de passe de la base de production est parti en clair dans chaque déploiement retenu, et il est
> toujours valide.** C'est la priorité absolue de la rotation.

Un second mot de passe Neon, distinct, existe dans `.env.local` sur le point de terminaison `ep-bold-sky`
(porté par `DATABASE_URL_UNPOOLED`, `POSTGRES_*`, `PGPASSWORD`). **Celui-là n'a pas été exposé** — il n'est
que dans `.env.local`, que la CLI Vercel exclut par sa liste codée en dur.

### 0.2 — La ligne 18 : un secret que personne ne « lisait », et qui est quand même parti

La ligne 18 de `.env` ne contient **aucun `=`**. Aucun parseur dotenv ne la charge : elle n'a donc jamais
servi de variable, et elle n'apparaît dans aucune liste de variables. Mais c'est du texte dans un fichier,
et **le fichier est parti verbatim**. Sa valeur est, par comparaison d'empreinte, **exactement le
`X_BEARER_TOKEN` vivant** de `.env.local`.

Deux conséquences :
1. Ce jeton est à roter au même titre que les autres, bien qu'il ne figure sous aucun nom dans `.env`.
2. **Un inventaire par noms de variables l'aurait manqué.** Toute vérification future doit porter sur le
   *contenu expédié*, pas sur la liste des variables déclarées.

> ⚠️ **Incident de manipulation à consigner.** Lors de la toute première extraction des noms de `.env`,
> une commande mal formée (`awk -F=`, qui traite une ligne sans `=` comme un nom) a **imprimé cette ligne 18
> en clair dans le transcript de la session** qui a produit ce document. La commande a été corrigée
> immédiatement et toutes les extractions ultérieures retiennent le contenu des lignes non conformes.
> Le jeton était déjà dans le périmètre à roter ; il y reste, avec une raison de plus, et sa rotation doit
> être traitée comme **urgente** et non « de fond ».

### 0.3 — Ce qui était exposé mais a déjà été remplacé localement

`ADMIN_BASIC_PASS`, `CRON_SECRET`, `RESEND_API_KEY`, `X_CT0_1`, `X_CT0_2` : les valeurs exposées **diffèrent**
des valeurs courantes.

**Cela ne veut pas dire qu'elles sont mortes.** `.env.local` dit ce que *ce poste* utilise aujourd'hui ; il ne
dit **rien** de ce que le fournisseur accepte encore. Une clé Resend remplacée dans un fichier reste active
chez Resend tant qu'on ne l'a pas supprimée dans leur interface. **Ces valeurs doivent donc être invalidées
côté fournisseur, même si plus personne ne s'en sert ici.** C'est le point (3) de la fenêtre, et c'est la
distinction que l'on rate le plus souvent.

---

## 1. LE FILTRE EST-IL FERMÉ ?

Oui, et c'est vérifié dans le dépôt.

- `.vercelignore` couvre désormais la **forme** `.env*` et `.envrc` — pas l'instance trouvée.
- Le préflight (`scripts/preflight/vocabulary.mjs`, forme `dotenv`) **refuse** tout chemin correspondant à
  `^\.env($|[.\-_])` présent dans le manifeste d'upload. Un refus arrête le déploiement ; le CLI n'est pas lancé.
- `.env.example` a été contrôlé : **aucune valeur réelle**, uniquement des marqueurs de remplacement (la seule
  valeur non vide est `NEXT_PUBLIC_APP_URL`, une URL publique).

**Ce qui reste vrai :** fermer le robinet n'assèche pas ce qui est déjà parti. Les artefacts de build déjà
publiés contiennent toujours le fichier. C'est la rotation, et elle seule, qui éteint l'exposition.

---

## 2. INVENTAIRE COMPLET — UNE LIGNE PAR CREDENTIAL

**Colonne « Exposé »** : 🔴 = parti dans le `.env` ET encore vivant · 🟠 = parti, remplacé localement, statut
fournisseur inconnu · ⚪ = jamais dans `.env`.

**Colonne « Suffit de réécrire ? »** : **NON** signifie qu'il faut *en plus* supprimer/révoquer l'ancienne
valeur chez le fournisseur, sans quoi elle reste utilisable.

**Colonne « Coupure »** : *ROLLING* = ancienne et nouvelle valides en même temps, rotation sans interruption ·
*COUPURE* = l'ancienne meurt quand la nouvelle naît.

### 2.1 — Base de données

| Credential | Fournisseur / écran | Coupure | Réécrire suffit ? | Consommateurs |
|---|---|---|---|---|
| 🔴 `DATABASE_URL`<br>🔴 `DATABASE_URL_UNPOOLED` | **Neon** — console, projet `ep-square-band`, rôle `neondb_owner` → *Reset password* | **COUPURE** (voir §4.1) | **NON** — le reset du mot de passe Neon *est* l'invalidation ; c'est le seul cas où réécrire et invalider sont le même geste | Runtime Vercel (3), **watchdog (2)**, scripts locaux (29) |
| ⚪ `PGPASSWORD`, `POSTGRES_PASSWORD`, `POSTGRES_URL*`, `PGHOST*`, `POSTGRES_*` | Neon, point de terminaison `ep-bold-sky` | COUPURE | NON | **Lus par aucun code** (§3.2) — artefacts de `vercel env pull` |

### 2.2 — Secrets émis par nous-mêmes (aucun fournisseur à appeler)

Pour ceux-ci, **réécrire la valeur suffit** : il n'existe pas d'ancienne valeur « vivante ailleurs ».
La nouvelle valeur remplace l'ancienne à la relecture par l'application.

| Credential | Où | Coupure | Consommateurs |
|---|---|---|---|
| 🔴 `ADMIN_TOKEN` | Vercel → Settings → Environment Variables | COUPURE | Runtime Vercel (25). ⚠️ **et le sel d'IP — voir §4.2** |
| 🔴 `ADMIN_BASIC_USER`<br>🟠 `ADMIN_BASIC_PASS` | Vercel (idem) | COUPURE | Runtime (7), middleware `src/proxy.ts:20-21` |
| 🟠 `CRON_SECRET` | Vercel (idem) | COUPURE | **29 routes de cron** — les 18 crons déclarés dans `vercel.json` |
| ⚪ `TELEGRAM_WEBHOOK_SECRET` | Vercel + à redéclarer chez Telegram (`setWebhook`) | COUPURE | `src/app/api/telegram/webhook/route.ts` |
| ⚪ `LEGAL_PDF_TOKEN`, `MOBILE_API_TOKEN`, `MM_API_TOKEN`, `PARTNER_API_KEY`, `PARTNER_API_KEY_V2` | Vercel | COUPURE | Runtime. ⚠️ `PARTNER_API_KEY*` est **remis à des tiers** : sa rotation casse leurs intégrations tant qu'ils n'ont pas la nouvelle |
| ⚪ `VAULT_AUDIT_SALT`, `OSINT_RETAIL_IP_SALT` | Vercel | **cas à part** | ⚠️ **Ce sont des SELS, pas des clés — voir §4.2** |

### 2.3 — Clés d'API de fournisseurs tiers

Ici la règle est uniforme et c'est le cœur du point (3) : **créer une nouvelle clé ne tue jamais l'ancienne.**
Il faut la supprimer explicitement dans l'interface du fournisseur.

| Credential | Fournisseur / écran | Coupure | Réécrire suffit ? | Consommateurs |
|---|---|---|---|---|
| 🔴 `ETHERSCAN_API_KEY` | Etherscan → My API Keys | **ROLLING** (plusieurs clés coexistent) | **NON** — supprimer l'ancienne clé | Runtime (8), cron `daily-flow`, 1 script |
| 🟠 `RESEND_API_KEY` | Resend → API Keys | **ROLLING** | **NON** — supprimer l'ancienne | Runtime (12) — tous les envois d'e-mail |
| ⚪ `ANTHROPIC_API_KEY` | Console Anthropic → API Keys | **ROLLING** | **NON** — révoquer l'ancienne | Runtime (8), **watchdog (1)** |
| ⚪ `HELIUS_API_KEY` | Dashboard Helius | **ROLLING** *(à confirmer)* | **NON** | Runtime (36), cron (2), scripts (4) — **le plus large rayon du dépôt** |
| ⚪ `TELEGRAM_BOT_TOKEN` | BotFather → `/revoke` | **COUPURE** — `/revoke` tue l'ancien immédiatement | **NON** — mais `/revoke` fait les deux | Runtime (4), **watchdog (1)** |
| ⚪ `UPSTASH_REDIS_REST_TOKEN` | Console Upstash → base → Rotate | ROLLING *(à confirmer)* | **NON** | Runtime (5) — rate-limiting |
| ⚪ `STRIPE_SECRET_KEY` | Dashboard Stripe → API keys → Roll | **ROLLING** (Stripe propose une période de grâce réglable) | **NON** — expirer l'ancienne | `src/lib/billing/stripeClient.ts` |
| ⚪ `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → endpoint → Roll secret | ROLLING | NON | `src/app/api/stripe/webhook/route.ts` |
| ⚪ `TURNSTILE_SECRET` / `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → widget → Rotate | ROLLING *(à confirmer)* | **NON** | Runtime (5) |
| ⚪ `GOOGLE_APPS_SCRIPT_URL` | Google Apps Script → nouveau déploiement | COUPURE | **NON** — archiver l'ancien déploiement. ⚠️ **URL-capacité** : l'URL *est* le secret | `src/app/api/admin/export/sheets/route.ts` |
| ⚪ `BETTERSTACK_API_TOKEN`, `BIRDEYE_API_KEY` | — | — | — | ⚠️ **Valeur vide dans `.env.local`** (§3.3) |
| ⚪ `ALCHEMY_API_KEY`, `ARKHAM_API_KEY`, `BSCSCAN_API_KEY`, `FORTA_API_KEY`, `HYPER_API_KEY`, `METASLEUTH_API_KEY`, `ONE_INCH_API_KEY`, `TRONGRID_API_KEY`, `FCA_AUTH_KEY`/`FCA_AUTH_EMAIL`, `DISCORD_BOT_TOKEN` | Interface de chaque fournisseur | à établir | **NON** (règle générale) | Runtime, 1 à 3 lectures chacune. **Absentes de `.env.local`** (§3.1) |

### 2.4 — Identifiants de session X/Twitter — **le cas le plus mal compris**

| Credential | Nature | Coupure | Réécrire suffit ? | Consommateurs |
|---|---|---|---|---|
| 🔴 `X_BEARER_TOKEN` (= ligne 18 orpheline)<br>⚪ `TWITTER_BEARER_TOKEN` (même lecture, `src/lib/xapi/client.ts:12`) | Jeton applicatif du portail développeur X | COUPURE | **NON** — régénérer dans le portail X, ce qui invalide l'ancien | Runtime (2), scripts (2) |
| 🟠 `X_CT0_1`, `X_CT0_2`, ⚪ `X_AUTH_TOKEN_1`, `X_AUTH_TOKEN_2` | **Cookies de session d'un compte réel** (`src/lib/surveillance/social/providers/xAuthProvider.ts:10-13`) | COUPURE | ⚠️ **NON, ET C'EST LE PIÈGE DE LA FENÊTRE** | Runtime (2 chacun) |

> **Une variable de session ne se rote pas en la réécrivant.** Coller un nouveau cookie dans Vercel ne
> **révoque rien** : l'ancien cookie reste valide côté X jusqu'à ce que **la session soit terminée depuis le
> compte** (X → Paramètres → Sécurité → *Applications et sessions* → déconnecter les sessions, ou un
> changement de mot de passe du compte, qui invalide les sessions en cours).
>
> La séquence est donc : **(a)** se déconnecter de toutes les sessions du compte X → **(b)** se reconnecter →
> **(c)** relever les nouveaux cookies → **(d)** les écrire dans Vercel. Faire (d) sans (a) donne l'illusion
> d'une rotation : la valeur exposée reste utilisable par quiconque la détient.

### 2.5 — Points de terminaison RPC

`ETH_RPC_URL`, `ARB_RPC_URL`, `BASE_RPC_URL`, `NEXT_PUBLIC_HELIUS_RPC`, `NEXT_PUBLIC_HELIUS_API_KEY`.
Aucun n'était dans `.env`. À traiter comme des secrets **si et seulement si** l'URL contient une clé
d'API intégrée — ce qui est le cas de la forme Helius documentée dans `CLAUDE.md`.
⚠️ `NEXT_PUBLIC_*` est **servi au navigateur par conception** : ces valeurs sont publiques, et la seule
protection réelle est une restriction de domaine côté fournisseur, pas le secret.

---

## 3. LES DEUX ÉCARTS DEMANDÉS

### 3.1 — Lues par le code, **absentes** de `.env.local` (24)

`ALCHEMY_API_KEY`, `ARB_RPC_URL`, `ARKHAM_API_KEY`, `BASE_RPC_URL`, `BSCSCAN_API_KEY`, `DISCORD_BOT_TOKEN`,
`ETH_RPC_URL`, `FCA_AUTH_EMAIL`, `FCA_AUTH_KEY`, `FORTA_API_KEY`, `HYPER_API_KEY`, `METASLEUTH_API_KEY`,
`MM_API_TOKEN`, `NEXT_PUBLIC_HELIUS_API_KEY`, `NEXT_PUBLIC_HELIUS_RPC`, `ONE_INCH_API_KEY`,
`OSINT_RETAIL_IP_SALT`, `PARTNER_API_KEY_V2`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`TRONGRID_API_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_SECRET_KEY`, `TWITTER_BEARER_TOKEN`.

> **Cet écart ne prouve pas qu'elles manquent en production.** `.env.local` est l'environnement d'un poste ;
> l'environnement de production vit dans les réglages du projet Vercel, que cette fenêtre n'a pas consultés
> (aucun appel fournisseur). Ces 24 variables sont **très probablement définies dans Vercel** et invisibles ici.
> **Il faut les énumérer dans l'interface Vercel au moment de la rotation** — voir §7.

### 3.2 — Présentes dans `.env.local`, lues **nulle part** dans le code

Le bloc significatif : `INVESTIGATOR_TOKEN`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`,
`KV_REST_API_URL`, `KV_URL`, `REDIS_URL`, `PGPASSWORD`, `POSTGRES_PASSWORD`, `PGHOST`, `PGHOST_UNPOOLED`,
`PGUSER`, `PGDATABASE`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`,
`POSTGRES_URL_NO_SSL`, `POSTGRES_USER`, `POSTGRES_DATABASE`, `NEON_PROJECT_ID`, `VERCEL_OIDC_TOKEN`.

Le reste est du réglage non secret (`TURBO_*`, `NX_DAEMON`, `VERCEL_GIT_*`, `EXPORT_MAX_ROWS`,
`APPROVE_CHUNK_SIZE`, `DIGEST_RECIPIENTS`).

Lecture : ce sont des **artefacts de `vercel env pull`**. Ils ne sont lus par aucune ligne de ce dépôt, mais
ce sont **de vrais credentials vivants** (accès Neon `ep-bold-sky`, accès KV/Redis). Ils n'ont pas été exposés.
Deux d'entre eux méritent une décision explicite :

- `INVESTIGATOR_TOKEN` (64 caractères) — **aucune lecture nulle part.** Soit c'est un vestige à supprimer,
  soit un consommateur hors dépôt existe. **À trancher par une personne, pas par déduction.**
- `KV_REST_API_TOKEN` / `REDIS_URL` — le code utilise `UPSTASH_REDIS_REST_*`, pas ceux-ci. Probable doublon
  d'une intégration antérieure.

### 3.3 — Troisième écart, non demandé mais mesuré : **présentes et VIDES**

`BETTERSTACK_API_TOKEN` et `BIRDEYE_API_KEY` sont déclarées dans `.env.local` avec une **valeur vide**, alors
que le code les lit. Ce n'est ni « absente » ni « présente » : c'est un provisionnement à blanc, qui échoue
au moment de l'appel et non au démarrage. À traiter au même passage.

---

## 4. DÉPENDANCES ENTRE VARIABLES — À LIRE AVANT DE TOUCHER À QUOI QUE CE SOIT

### 4.1 — `DATABASE_URL` : une coupure qui ne coupe pas que le site

Réinitialiser le mot de passe du rôle Neon est **instantané et sans période de grâce** : toute connexion
ouverte avec l'ancien mot de passe échoue à la reconnexion. Sont touchés **en même temps** :

1. le **runtime Vercel** (le site) ;
2. les **18 crons** déclarés dans `vercel.json` ;
3. le **watchdog** (`src/scripts/watchdog/watcher-health.mjs` — 2 lectures) ;
4. les **29 scripts locaux** qui lisent `DATABASE_URL`, **y compris tout script en vol au moment de la bascule**.

Conséquences opérationnelles :

- **Choisir un creux.** Le cron le plus tardif tombe à 09:00 UTC, le plus matinal à 01:00 UTC. La fenêtre la
  plus calme est **entre 10:00 et 00:00 UTC** (seul `shill-feed` tourne à chaque heure pleine).
- **Aucun script long ne doit être en cours.** Une migration ou un seed interrompu au milieu laisse un état
  partiel — et cette fenêtre-ci n'a pas le droit d'écrire en base pour le réparer.
- **Le watchdog se taira.** Il faut le prévoir : un watchdog muet ressemble à un watchdog satisfait.
- Neon propose plusieurs rôles. **Créer un second rôle applicatif** avant la bascule transformerait cette
  coupure en rotation glissante. **Faisabilité non vérifiée dans cette fenêtre** (elle exige la console Neon).

### 4.2 — `ADMIN_TOKEN` a une seconde vie de **sel cryptographique**

Mesuré dans `src/lib/osint/retail/ipHash.ts:33-38` : quand `OSINT_RETAIL_IP_SALT` est absente — **et elle est
absente de `.env.local`, cf. §3.1** — le sel de hachage des IP retail **retombe sur `ADMIN_TOKEN`**.

> **Roter `ADMIN_TOKEN` re-clé donc silencieusement tous les hachages d'IP retail.** Les hachages déjà stockés
> deviennent incomparables avec les nouveaux. Rien ne casse, rien n'alerte : la corrélation cesse simplement
> d'être vraie.
>
> **Geste obligatoire, AVANT de roter `ADMIN_TOKEN` :** définir explicitement `OSINT_RETAIL_IP_SALT` à la
> valeur courante de `ADMIN_TOKEN`, pour figer le sel *avant* que le jeton ne bouge. Sans ce geste, la
> rotation détruit une continuité de données sans le dire.

Même nature pour `VAULT_AUDIT_SALT` (`src/lib/community/ipHash.ts:9`, `src/lib/vault/auditScan.ts:11`) :
**un sel ne se rote pas comme une clé.** Le roter invalide la comparabilité de tout l'historique haché.
Il n'était pas exposé — **la recommandation est donc de NE PAS le roter** dans cette campagne.

### 4.3 — Un seul geste, plusieurs variables

- Réinitialiser le mot de passe Neon de `ep-square-band` couvre `DATABASE_URL` **et** `DATABASE_URL_UNPOOLED`
  (même mot de passe, mesuré).
- Terminer les sessions du compte X couvre `X_CT0_1`, `X_CT0_2`, `X_AUTH_TOKEN_1`, `X_AUTH_TOKEN_2` d'un coup —
  mais **pas** `X_BEARER_TOKEN`, qui est applicatif et se régénère séparément.
- `TWITTER_BEARER_TOKEN` et `X_BEARER_TOKEN` sont lus **sur la même ligne** (`src/lib/xapi/client.ts:12`) :
  deux noms, un seul secret. Les écrire tous les deux, ou supprimer le nom mort.

---

## 5. ORDRE DE ROTATION PROPOSÉ

L'ordre est **déduit** de §2 et §4, pas d'une préférence : d'abord ce qui ne coupe rien, ensuite ce qui exige
une fenêtre, en dernier ce qui doit être invalidé une fois le nouveau chemin prouvé.

### Étape 0 — Préparatifs, sans rien roter

1. Ouvrir Vercel → projet **`interligens-app`** → Settings → Environment Variables, et **lister les noms**
   présents en Production. C'est ce qui comble l'angle mort du §3.1.
2. **Figer le sel** : poser `OSINT_RETAIL_IP_SALT` = valeur actuelle de `ADMIN_TOKEN` (§4.2).
3. Décider du sort d'`INVESTIGATOR_TOKEN` et des `KV_*`/`REDIS_URL` (§3.2).
4. Prévenir les éventuels consommateurs tiers de `PARTNER_API_KEY*`.

### Étape 1 — ROLLING : aucune coupure, à faire en premier et sans stress

`ETHERSCAN_API_KEY` 🔴 · `RESEND_API_KEY` 🟠 · `ANTHROPIC_API_KEY` · `HELIUS_API_KEY` ·
`STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `UPSTASH_REDIS_REST_TOKEN` · `TURNSTILE_SECRET*`

Pour chacun : **créer la nouvelle clé → l'écrire dans Vercel → redéployer → passer le smoke test du §6 →
seulement ensuite supprimer l'ancienne chez le fournisseur.** L'ancienne reste valide pendant tout l'intervalle,
donc aucune interruption. **Ne pas sauter la dernière étape : c'est elle, et elle seule, qui éteint l'exposition.**

### Étape 2 — Sessions X : invalidation d'abord, réécriture ensuite

`X_CT0_1`, `X_CT0_2`, `X_AUTH_TOKEN_1`, `X_AUTH_TOKEN_2`, puis `X_BEARER_TOKEN` 🔴.
Séquence obligatoire du §2.4 : **déconnecter les sessions → se reconnecter → relever → écrire.**
Placée tôt car le bearer exposé est le plus immédiatement exploitable par un tiers.

### Étape 3 — Secrets internes : coupure brève, sans fournisseur

`ADMIN_TOKEN` 🔴 (après l'étape 0.2), `ADMIN_BASIC_USER` 🔴, `ADMIN_BASIC_PASS` 🟠, `CRON_SECRET` 🟠,
`LEGAL_PDF_TOKEN`, `MOBILE_API_TOKEN`, `MM_API_TOKEN`, `PARTNER_API_KEY*`, `TELEGRAM_WEBHOOK_SECRET`
(+ re-déclaration du webhook chez Telegram), `TELEGRAM_BOT_TOKEN` via `/revoke`.

La coupure dure le temps d'un redéploiement. `CRON_SECRET` : le faire **hors de l'heure pleine**, sinon
`shill-feed` échoue sur la bascule.

### Étape 4 — `DATABASE_URL` : en dernier, dans une fenêtre choisie

En dernier parce que c'est la seule rotation qui **coupe tout à la fois** (§4.1) et parce qu'il faut que tout
le reste soit déjà prouvé : si quelque chose casse après, on sait que c'est la base.

Fenêtre recommandée : **10:00–00:00 UTC**. Séquence : arrêter/attendre les scripts en vol → réinitialiser le
mot de passe dans Neon → mettre à jour `DATABASE_URL` et `DATABASE_URL_UNPOOLED` dans Vercel → redéployer →
smoke test §6 → mettre à jour `.env.local` du poste → **vérifier que le watchdog reparle**.

### Étape 5 — Nettoyage

Supprimer les anciennes clés restées vivantes chez les fournisseurs, supprimer le fichier `.env` du poste,
décider du sort des variables mortes du §3.2.

---

## 6. SMOKE TESTS — ET CE QU'ILS NE PROUVENT PAS

Règle générale : **un `401` n'est pas une mesure.** Il peut vouloir dire « la clé est refusée » **ou** « la
requête était mal formée » **ou** « la variable n'est pas arrivée jusqu'au processus ». Un smoke test n'est
concluant que s'il distingue un **refus** (le fournisseur a répondu, en rejetant) d'un **échec de mesure**
(on n'a pas atteint le fournisseur, ou pas avec la bonne valeur). En pratique : exiger un **200 explicite**,
et traiter tout le reste comme non concluant plutôt que comme un échec.

Aucune commande ci-dessous n'affiche de valeur.

| Credential | Vérification la plus économe | Ce qu'elle ne prouve PAS |
|---|---|---|
| `DATABASE_URL` | Ouvrir une page publique qui lit la base (un profil KOL publié). 200 avec données = connexion vivante. | Ne prouve rien pour `DATABASE_URL_UNPOOLED` (autre hôte), ni pour le watchdog, ni pour les scripts locaux — **à vérifier séparément**. |
| `ADMIN_TOKEN`, `ADMIN_BASIC_*` | Se connecter à une page d'admin. | Ne prouve pas que l'**ancien** jeton est mort. Le vérifier exige un essai avec l'ancienne valeur — à faire consciemment, ou pas du tout. |
| `CRON_SECRET` | **Attendre le prochain cron** et vérifier qu'il s'est exécuté. | Un déclenchement manuel ne prouve pas que **Vercel** enverra le bon secret. Seul un vrai passage de cron le prouve. |
| `ETHERSCAN_API_KEY` | Un scan d'adresse ETH depuis le site. | Ne prouve pas le quota, ni que l'ancienne clé est supprimée. |
| `RESEND_API_KEY` | Envoyer un e-mail de test via le formulaire de feedback. | L'API accepte ≠ l'e-mail est délivré. Vérifier la réception. |
| `ANTHROPIC_API_KEY` | Une requête d'assistant sur un dossier. | Ne couvre pas le chemin **watchdog**, qui a sa propre lecture. |
| `HELIUS_API_KEY` | Un scan Solana. | 36 sites de lecture : un succès n'en couvre qu'un. |
| `TELEGRAM_BOT_TOKEN` | Attendre le prochain message du watchdog. | Un `/revoke` mal suivi laisse le bot muet sans erreur visible. |
| `X_BEARER_TOKEN` | Une lecture X depuis l'admin. | ⚠️ Un échec peut venir du **plafond mensuel de lecture** et non de la clé (`403` sur toutes les lectures). **Ne pas conclure à une mauvaise clé sans écarter le plafond.** |
| `X_CT0_*` / `X_AUTH_TOKEN_*` | Une capture sociale. | **Ne prouve JAMAIS que l'ancienne session est morte.** Seule la déconnexion côté compte le fait. |
| `STRIPE_*` | Mode test Stripe, ou l'écran de webhooks (livraisons récentes). | Le mode test ne prouve pas le mode live. |
| `UPSTASH_REDIS_REST_TOKEN` | Déclencher deux fois un point limité en débit ; la limite doit s'appliquer. | Si Redis est injoignable, le rate-limit peut **échouer en mode ouvert** — succès apparent, protection absente. |
| R2 (tous) | Un envoi puis une relecture d'un petit objet dans le compartiment visé. | **Ne prouve pas la portée du jeton** (§7). Prouve seulement écriture+lecture *sur ce compartiment-là*. |

---

## 7. INVENTAIRE R2 — NOMS ET PORTÉES *DÉCLARÉES*

Le dépôt matérialise **quatre paires de clés R2 distinctes** (vérifié par comparaison d'empreintes : les quatre
identifiants d'accès diffèrent deux à deux, et les quatre moitiés secrètes aussi). Les quatre visent **le même
point de terminaison de compte**.

| Variables | Portée **déclarée** | Consommateurs mesurés dans ce dépôt |
|---|---|---|
| `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (+ `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_BUCKET_NAME`) | compartiment principal, lecture/écriture | `src/app/api/admin/documents/presign/route.ts:19-21` + 8 scripts |
| `RAWDOCS_S3_ACCESS_KEY` + `RAWDOCS_S3_SECRET_KEY` | compartiment `rawdocs` (nom distinct du principal, mesuré) | `src/lib/config/env.ts:32-33` |
| `R2_EVIDENCE_ACCESS_KEY_ID` + `R2_EVIDENCE_SECRET_ACCESS_KEY` | compartiment `evidence`, **écriture** | ⚠️ **lue uniquement par un test** dans ce dépôt (`src/lib/evidence-chain/__tests__/r2Config.test.ts:114-115`) — le consommateur réel est ailleurs |
| `R2_EVIDENCE_RO_ACCESS_KEY_ID` + `R2_EVIDENCE_RO_SECRET_ACCESS_KEY` | compartiment `evidence`, **lecture seule** | `src/scripts/evidence-chain/mesure-localisation.ts:151-152` |

**Sept jetons de compte R2 sont déclarés actifs, dont un « tous les compartiments » en lecture/écriture objet.**
Quatre sont matérialisés ici ; **les trois autres ne le sont pas** — ils n'apparaissent dans aucune variable lue
par ce dépôt, et cette fenêtre ne peut donc rien en dire au-delà de leur existence déclarée.

> **Limite à écrire telle quelle : ce dépôt ne peut pas vérifier la portée réelle d'un jeton R2.**
> Une portée est **reçue, pas mesurée**. Un jeton nommé `_RO` peut parfaitement porter des droits d'écriture ;
> le nom de la variable est une intention, pas un contrôle. La seule vérification possible est une tentative
> d'écriture avec le jeton dit « lecture seule » — **hors périmètre de cette fenêtre**, qui n'appelle aucun
> fournisseur.
>
> Un précédent mesuré existe dans le projet : le credential `evidence` a été observé porteur de
> **WRITE + READ + DELETE**. Le supposer plus étroit que cela serait une erreur.

**Pour la rotation :** les quatre paires se rotent dans Cloudflare → R2 → *Manage API Tokens*. Création et
suppression sont deux gestes séparés — donc **ROLLING**, et **réécrire ne suffit jamais** : l'ancien jeton
reste valide tant qu'il n'est pas supprimé. Aucune n'était dans le `.env` exposé : **ce sont des rotations
d'hygiène, pas d'urgence** — à placer après l'étape 4.

---

## 8. CE QUE CETTE PRÉPARATION N'ÉTABLIT PAS

Écrit sans adoucissement : une procédure qui repose sur une supposition casse la production au pire moment.

1. **L'inventaire des variables de production.** Le point (2) demandait ce qui était dans l'ensemble expédié.
   Ce qui est établi : le **contenu actuel** de `.env` est parti. Ce qui ne l'est **pas** : l'environnement
   de production lui-même (réglages du projet Vercel), jamais consulté ici — aucun appel fournisseur.
   **Les 24 variables du §3.1 sont un angle mort tant que cette liste n'est pas ouverte à l'écran.**

2. **L'historique de `.env`.** Le fichier n'est pas suivi par git. Il porte une date de modification du
   **22 avril**, mais rien ne dit quelles valeurs il contenait lors des déploiements **antérieurs** à cette date.
   **Des valeurs plus anciennes des mêmes noms ont pu être exposées et rester valides.** Seule la suppression
   côté fournisseur de *toutes* les clés antérieures ferme ce risque — pas la rotation de la seule valeur courante.

3. **La liste des déploiements retenus.** Établir *quels* déploiements portent le fichier exigerait
   d'interroger Vercel. Non fait, délibérément. **Non établi.**

4. **Le caractère ROLLING ou COUPURE de plusieurs fournisseurs** (Helius, Upstash, Turnstile) est marqué
   *à confirmer* : il est déduit de la pratique courante, **pas mesuré**. À vérifier à l'écran au moment de roter.

5. **La portée réelle des jetons R2** — §7. Reçue, pas mesurée.

6. **Le statut fournisseur des valeurs « périmées »** (§0.3). `.env.local` dit ce que ce poste utilise ;
   il ne dit rien de ce que le fournisseur accepte encore. **Supposer qu'une valeur remplacée est morte est
   exactement l'erreur que cette fenêtre existe pour empêcher.**

7. **Les consommateurs hors dépôt.** `INVESTIGATOR_TOKEN` n'est lu par aucune ligne ici, et
   `R2_EVIDENCE_*` (écriture) n'est lue que par un test. Leurs vrais consommateurs sont ailleurs — watchdog,
   poste distant, ou plus personne. **Une seule personne peut le trancher ; la déduction ne le peut pas.**

8. **La réversibilité.** Rien dans cette préparation ne dit comment **revenir en arrière** si une rotation
   casse un chemin. Pour les fournisseurs ROLLING, l'ancienne valeur existe encore et le retour est possible
   tant qu'on ne l'a pas supprimée. **Pour `DATABASE_URL` et les sessions X, il n'y a pas de retour :
   l'ancienne valeur est détruite au moment même de la rotation.** Ces deux-là exigent que la nouvelle valeur
   soit en main **avant** de lancer le geste.

---

*Fenêtre en lecture seule. Aucune rotation, aucune écriture en base, aucun déploiement, aucun appel
fournisseur authentifié. Les fichiers d'environnement n'ont pas été modifiés.*
