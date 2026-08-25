# Pack migration `JobRunLog` — à exécuter À LA MAIN dans le Neon SQL Editor · 2026-08-25

**Objet :** ajouter à `JobRunLog` les 12 colonnes que la sonde C4 (`src/lib/watchdog/`)
doit lire pour juger la santé du Watcher sur un **run** et non sur une **écriture**.

**Branche :** `feat/cc-offline-101-watchdog-c4`
**Statut :** **NON APPLIQUÉE**. Ce document est un pack copiable ; aucune de ces
instructions n'a été exécutée par Claude Code. Toutes les mesures ci-dessous ont été
prises en lecture seule stricte (`SET default_transaction_read_only = on`, preuve
conservée §5) sur `ep-square-band`, le **2026-08-25 à 12:32 UTC**.

**Purement additif.** Aucun `DROP`, aucun `TRUNCATE`, aucun `DELETE`, aucun
`ALTER COLUMN`, aucun `SET NOT NULL`, aucun `USING …::`. Toutes les colonnes ajoutées
sont **nullables et sans défaut** : PostgreSQL n'a donc aucune ligne à réécrire
(`ADD COLUMN` nullable sans défaut est une opération de catalogue seul depuis PG 11).

---

## ⚠️ Deux points à connaître avant de commencer

**1. `trigger` est un nom de colonne légal.** Vérifié sur la base elle-même :
`SELECT word, catcode FROM pg_get_keywords() WHERE word='trigger'` rend
`catcode = 'U'` — **unreserved**. `SELECT 1 AS trigger` s'exécute sans guillemets.
Il n'y a donc pas de piège de mot réservé. On le met malgré tout entre guillemets
partout, comme toutes les colonnes camelCase de ce schéma.

**2. Les timestamps sont naïfs, et c'est délibéré.** Les 5 colonnes temporelles
existantes de `JobRunLog` sont `timestamp without time zone`, comme 341 des 413
colonnes temporelles de la base. Les 4 nouvelles le sont aussi. **Mélanger naïf et
`timestamptz` dans la même table produit des comparaisons dont le résultat dépend du
`TimeZone` de la session** — on ne fait pas ça en passager clandestin d'une migration
de sonde. Le sujet de fond est traité séparément (SI-01,
`docs/prep/AUDIT_SCHEMA_INTEGRITY_2026-08-22.md`).

> La conséquence côté lecture est réelle et **mesurée aujourd'hui** : lue par le
> driver `pg` depuis un process en `Europe/Paris`, la dernière ligne de `JobRunLog`
> sort à `2026-08-25T05:06:32.760Z` alors que la valeur stockée est
> `2026-08-25 07:06:32.760` UTC — **2 h d'écart**, 8 h depuis Lombok. Ce n'est pas
> un problème de migration, c'est un problème d'adaptateur : il est corrigé côté
> lecture par `AT TIME ZONE 'UTC'` (voir le rapport de clôture, §Étape 3). **Aucune
> requête de ce pack n'est affectée** — elles comparent des valeurs naïves entre
> elles, à l'intérieur de PostgreSQL.

---

# PARTIE 1 — RECOUPEMENT D'IDENTITÉ DB

**À lancer en premier. Si le résultat ne correspond pas exactement, ne rien exécuter d'autre.**

```sql
SELECT
  current_setting('neon.endpoint_id') AS endpoint,
  current_setting('neon.branch_id')   AS branche,
  current_setting('neon.project_id')  AS projet,
  current_database()                  AS base,
  current_user                        AS utilisateur,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public')    AS tables_publiques,
  (SELECT count(*) FROM "JobRunLog")  AS lignes_jobrunlog,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'JobRunLog')   AS colonnes_jobrunlog;
```

### Résultat attendu — une seule ligne, exactement

| colonne | valeur attendue |
|---|---|
| `endpoint` | **`ep-square-band-ag2lxpz8`** |
| `branche` | `br-square-dawn-agc8y2ih` |
| `projet` | `plain-hill-77595267` |
| `base` | `neondb` |
| `utilisateur` | `neondb_owner` |
| `tables_publiques` | `178` |
| `lignes_jobrunlog` | `134` *(ou 135/136 — voir ci-dessous)* |
| **`colonnes_jobrunlog`** | **`13`** |

### 🛑 SIGNAL D'ARRÊT — on ne continue pas

- `endpoint` **ne commence pas** par `ep-square-band` → **ARRÊT IMMÉDIAT**. En
  particulier, tout ce qui ressemble à **`ep-bold-sky`** est la mauvaise cible :
  ne rien exécuter, fermer l'onglet.
- `endpoint` correspond mais `branche` ou `projet` diffèrent → **ARRÊT**. Un endpoint
  homonyme sur une autre branche Neon reste une autre base.
- `tables_publiques` hors de la plage `175`–`182` → **ARRÊT**. La base n'a pas la forme attendue.
- **`colonnes_jobrunlog` ≠ `13` → ARRÊT.** S'il y en a **plus de 13**, la migration
  a **déjà été passée** (en tout ou partie) : ne pas la relancer à l'aveugle, aller
  directement à la **Partie 3** pour constater l'état réel. S'il y en a **moins de
  13**, ce n'est pas la table attendue.
- La requête échoue sur `current_setting('neon.endpoint_id')` → **ARRÊT**. Ce n'est
  pas un endpoint Neon.

> **`lignes_jobrunlog` légèrement SUPÉRIEUR à 134 n'est pas un signal d'arrêt.** Le
> cron `watcher_bridge_promote` écrit **1 ligne par jour** vers 06:06 UTC (mesuré :
> dernière ligne `2026-08-25 07:06:32` — le cron est déclaré à 06:30, Vercel le
> déclenche avec de la gigue). Une valeur de 134 à 137 est saine selon le jour où
> vous appliquez. **Une valeur INFÉRIEURE à 134 est en revanche un ARRÊT** : des
> lignes auraient été détruites.

---

# PARTIE 2 — LE SQL DE MIGRATION, VERBATIM

À copier tel quel dans le Neon SQL Editor, **en une seule fois**, sur
`ep-square-band-ag2lxpz8` uniquement.

```sql
-- ─── MIGRATION JobRunLog → sonde C4 « WATCHER HEALTH » ───────────────────────
-- Date        : 2026-08-25
-- Branche     : feat/cc-offline-101-watchdog-c4
-- Nature      : ADDITIVE STRICTE. 12 colonnes nullables sans défaut + 1 index.
-- Réversible  : oui (DROP COLUMN des 12 colonnes rend l'état initial exact).
-- Effet sur les lignes existantes : AUCUN. Les 134 lignes restent valides,
--   les 12 nouvelles colonnes y valent NULL. Pas de réécriture de heap.

ALTER TABLE "JobRunLog"
  -- ── Identité du run : QUI a tourné, DÉCLENCHÉ PAR QUOI, en QUEL MODE ──────
  -- Ces trois colonnes sont le cœur du correctif. Sans elles, la sonde ne peut
  -- pas distinguer un run cron LIVE d'un backfill manuel — c'est exactement ce
  -- qui a rendu le blackout du 17→24 août invisible.
  ADD COLUMN IF NOT EXISTS "source"              text,
  ADD COLUMN IF NOT EXISTS "trigger"             text,
  ADD COLUMN IF NOT EXISTS "ingestionMode"       text,

  -- ── Les 4 horodatages, dont aucun n'est déductible d'un autre ─────────────
  -- scheduledAt          : l'heure à laquelle ce run AURAIT dû partir.
  -- startedAt (existe)   : l'ordonnanceur a bien déclenché la route.
  -- collectionStartedAt  : la première lecture X a réellement commencé.
  -- finishedAt (existe)  : le run s'est terminé, quel que soit son statut.
  -- L'écart « startedAt non nul / collectionStartedAt nul » est la SIGNATURE
  -- d'un bail budgétaire. Aucune sonde à un seul horodatage ne peut le voir.
  ADD COLUMN IF NOT EXISTS "scheduledAt"         timestamp without time zone,
  ADD COLUMN IF NOT EXISTS "collectionStartedAt" timestamp without time zone,

  -- ── Les 7 métriques de rendement, par run ────────────────────────────────
  -- L'entonnoir mesurable : handlesAttempted ≥ handlesSucceeded, et
  -- tweetsFetched ≥ newPostsObserved ≥ candidatesProduced.
  ADD COLUMN IF NOT EXISTS "handlesAttempted"    integer,
  ADD COLUMN IF NOT EXISTS "handlesSucceeded"    integer,
  ADD COLUMN IF NOT EXISTS "tweetsFetched"       integer,
  ADD COLUMN IF NOT EXISTS "newPostsObserved"    integer,
  ADD COLUMN IF NOT EXISTS "candidatesProduced"  integer,
  ADD COLUMN IF NOT EXISTS "xApiErrors"          integer,
  ADD COLUMN IF NOT EXISTS "durationMs"          integer;

-- Index de lecture de la sonde. L'adaptateur borne sur ("source","startedAt").
CREATE INDEX IF NOT EXISTS "JobRunLog_source_startedAt_idx"
  ON "JobRunLog" ("source", "startedAt" DESC);
```

### Ce que ça ajoute, exactement — pour que la Partie 3 puisse le vérifier

**12 colonnes**, toutes `is_nullable = 'YES'`, toutes `column_default = NULL` :

| # | colonne | `data_type` attendu |
|---|---|---|
| 1 | `source` | `text` |
| 2 | `trigger` | `text` |
| 3 | `ingestionMode` | `text` |
| 4 | `scheduledAt` | `timestamp without time zone` |
| 5 | `collectionStartedAt` | `timestamp without time zone` |
| 6 | `handlesAttempted` | `integer` |
| 7 | `handlesSucceeded` | `integer` |
| 8 | `tweetsFetched` | `integer` |
| 9 | `newPostsObserved` | `integer` |
| 10 | `candidatesProduced` | `integer` |
| 11 | `xApiErrors` | `integer` |
| 12 | `durationMs` | `integer` |

**1 index** : `JobRunLog_source_startedAt_idx` sur `("source", "startedAt" DESC)`.

**0 contrainte.** Aucune `CHECK`, aucune `FOREIGN KEY`, aucune `UNIQUE` n'est posée
— voir §4 pour le pourquoi.

> **Honnêteté sur l'index :** avec 134 lignes et ~2 écritures/jour, PostgreSQL fera
> presque certainement un `Seq Scan` de toute façon. Cet index n'est **pas** une
> optimisation mesurée, c'est une précaution qui déclare l'intention de lecture et
> qui portera quand la table aura grossi. Il coûte quelques kilo-octets. Si vous
> préférez ne pas le poser, la sonde fonctionne à l'identique — retirez simplement
> la dernière instruction, et la vérification 3.2 attendra 2 index au lieu de 3.

---

# PARTIE 3 — VÉRIFICATION POST-MIGRATION

Les quatre requêtes sont à lancer **dans l'ordre**, après la Partie 2.

## 3.1 — Les 12 colonnes sont présentes, typées, nullables et sans défaut

```sql
SELECT column_name, data_type, is_nullable, coalesce(column_default,'(aucun)') AS defaut
  FROM information_schema.columns
 WHERE table_name = 'JobRunLog'
   AND column_name IN ('source','trigger','ingestionMode','scheduledAt',
                       'collectionStartedAt','handlesAttempted','handlesSucceeded',
                       'tweetsFetched','newPostsObserved','candidatesProduced',
                       'xApiErrors','durationMs')
 ORDER BY column_name;
```

### Résultat attendu — **exactement 12 lignes**

| `column_name` | `data_type` | `is_nullable` | `defaut` |
|---|---|---|---|
| `candidatesProduced` | `integer` | `YES` | `(aucun)` |
| `collectionStartedAt` | `timestamp without time zone` | `YES` | `(aucun)` |
| `durationMs` | `integer` | `YES` | `(aucun)` |
| `handlesAttempted` | `integer` | `YES` | `(aucun)` |
| `handlesSucceeded` | `integer` | `YES` | `(aucun)` |
| `ingestionMode` | `text` | `YES` | `(aucun)` |
| `newPostsObserved` | `integer` | `YES` | `(aucun)` |
| `scheduledAt` | `timestamp without time zone` | `YES` | `(aucun)` |
| `source` | `text` | `YES` | `(aucun)` |
| `tweetsFetched` | `integer` | `YES` | `(aucun)` |
| `trigger` | `text` | `YES` | `(aucun)` |
| `xApiErrors` | `integer` | `YES` | `(aucun)` |

### 🛑 Signal d'arrêt
- **Moins de 12 lignes** → la migration est **partielle**. Ne pas déployer l'écrivain :
  il écrirait dans des colonnes inexistantes et **chaque run planterait**. Relancer
  la Partie 2 en entier (`ADD COLUMN IF NOT EXISTS` est idempotent, la relancer est sûr).
- **Un `is_nullable = 'NO'`** → **ARRÊT**. Une colonne `NOT NULL` a été posée : les
  134 lignes existantes n'auraient pas pu survivre, donc quelque chose d'autre a été
  exécuté. Remonter avant toute écriture.
- **Un `defaut` différent de `(aucun)`** → **ARRÊT**. Un défaut aurait réécrit ou
  rempli les lignes existantes ; la vérification 3.4 doit trancher immédiatement.
- **Un `data_type` différent du tableau** (typiquement `timestamp with time zone`
  au lieu de `timestamp without time zone`) → **ARRÊT**. C'est le mélange de types
  décrit en tête de document ; la sonde lirait des instants faux.

## 3.2 — Les index : celui qu'on ajoute, et ceux qu'on ne touche pas

```sql
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE tablename = 'JobRunLog'
 ORDER BY indexname;
```

### Résultat attendu — **exactement 3 lignes**

| `indexname` | `indexdef` |
|---|---|
| `JobRunLog_jobName_startedAt_idx` | `CREATE INDEX … USING btree ("jobName", "startedAt" DESC)` |
| `JobRunLog_pkey` | `CREATE UNIQUE INDEX … USING btree (id)` |
| `JobRunLog_source_startedAt_idx` | `CREATE INDEX … USING btree ("source", "startedAt" DESC)` |

Les deux premiers **préexistaient** (mesurés le 2026-08-25) et doivent être
strictement inchangés. Le troisième est le seul ajout.

### 🛑 Signal d'arrêt
- `JobRunLog_pkey` ou `JobRunLog_jobName_startedAt_idx` **absent ou modifié** →
  **ARRÊT IMMÉDIAT**. La migration ne les touche pas ; s'ils ont bougé, autre chose
  a été exécuté.
- **Un 4ᵉ index inattendu** → **ARRÊT**, et le signaler : ce pack n'en crée qu'un.
- `JobRunLog_source_startedAt_idx` absent → pas un arrêt, mais la dernière
  instruction de la Partie 2 n'est pas passée. La relancer seule.

## 3.3 — Contraintes : ce qu'il y a, et surtout ce qu'il n'y a pas

```sql
SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS definition
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
 WHERE rel.relname = 'JobRunLog'
 ORDER BY con.conname;
```

### Résultat attendu — **exactement 1 ligne**

| `conname` | `contype` | `definition` |
|---|---|---|
| `JobRunLog_pkey` | `p` | `PRIMARY KEY (id)` |

C'est l'état mesuré **avant** migration, et il doit être l'état **après**. La
migration n'ajoute aucune contrainte.

### 🛑 Signal d'arrêt
- **Plus d'une ligne** → **ARRÊT**. Une contrainte a été créée. En particulier une
  `CHECK` sur `status` empêcherait l'écrivain d'écrire ses 5 nouveaux statuts et
  **ferait échouer chaque run du watcher** — c'est précisément le risque décrit en §4.
- **`JobRunLog_pkey` absent** → **ARRÊT IMMÉDIAT**, la table a été recréée.

## 3.4 — Aucune ligne altérée, aucune colonne préexistante touchée

```sql
SELECT
  (SELECT count(*) FROM "JobRunLog")                                   AS lignes_total,
  (SELECT count(*) FROM "JobRunLog"
    WHERE "startedAt" < timestamp '2026-08-25 06:00:00')               AS lignes_figees,
  (SELECT md5(string_agg(id||':'||"jobName"||':'||status||':'||"startedAt"::text||':'||
                         coalesce("finishedAt"::text,'-')||':'||processed::text,
                         '|' ORDER BY id))
     FROM "JobRunLog"
    WHERE "startedAt" < timestamp '2026-08-25 06:00:00')               AS empreinte_donnees,
  (SELECT md5(string_agg(column_name||':'||data_type||':'||is_nullable||':'||
                         coalesce(column_default,'-'), '|' ORDER BY column_name))
     FROM information_schema.columns
    WHERE table_name = 'JobRunLog'
      AND column_name IN ('id','jobName','dryRun','startedAt','finishedAt','status',
                          'limitN','processed','createdDrafts','ambiguous',
                          'conflicts','errors','summaryJson'))         AS empreinte_13_colonnes,
  (SELECT count(*) FROM "JobRunLog"
    WHERE "source" IS NOT NULL OR "trigger" IS NOT NULL
       OR "ingestionMode" IS NOT NULL OR "scheduledAt" IS NOT NULL
       OR "collectionStartedAt" IS NOT NULL OR "handlesAttempted" IS NOT NULL
       OR "handlesSucceeded" IS NOT NULL OR "tweetsFetched" IS NOT NULL
       OR "newPostsObserved" IS NOT NULL OR "candidatesProduced" IS NOT NULL
       OR "xApiErrors" IS NOT NULL OR "durationMs" IS NOT NULL)        AS lignes_avec_donnee_neuve;
```

### Résultat attendu — une seule ligne

| colonne | attendu | mesuré avant migration (2026-08-25 12:32 UTC) |
|---|---|---|
| `lignes_total` | **`≥ 134`** | 134 |
| `lignes_figees` | **`132`** *(exactement)* | 132 |
| **`empreinte_donnees`** | **`3136b3d2eb70a46dd72aff37089c6fa9`** | identique |
| **`empreinte_13_colonnes`** | **`82456597a6dd27a390ac511b9a3580cb`** | identique |
| `lignes_avec_donnee_neuve` | **`0`** | — |

**Les deux empreintes sont les preuves centrales.**

`empreinte_13_colonnes` est le md5 du type, de la nullabilité et du défaut des
**13 colonnes préexistantes**, trié par nom — donc **insensible à l'ajout des 12
nouvelles**. Si elle est identique, aucune colonne existante n'a changé de forme.

`empreinte_donnees` est le md5 du contenu des **132 lignes dont le `startedAt` est
antérieur au 2026-08-25 06:00 UTC**. Ce sous-ensemble est **définitivement figé** :
les lignes ne sont écrites qu'en append avec `startedAt = now()`, donc aucune ligne
future ne peut y entrer. L'empreinte est donc stable quel que soit le jour où vous
appliquez la migration — contrairement au simple `count(*)`, qui monte d'une unité
par jour.

`lignes_avec_donnee_neuve = 0` prouve qu'aucun backfill n'a eu lieu : les 12 colonnes
sont intégralement `NULL`, exactement ce qu'on attend d'un `ADD COLUMN` sans défaut.

### 🛑 Signal d'arrêt
- **`empreinte_13_colonnes` ≠ `82456597a6dd27a390ac511b9a3580cb`** → **ARRÊT
  IMMÉDIAT**. Une colonne préexistante a changé de type, de nullabilité ou de défaut.
  Remonter avec le détail :
  ```sql
  SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
   WHERE table_name = 'JobRunLog' ORDER BY ordinal_position;
  ```
- **`empreinte_donnees` ≠ `3136b3d2eb70a46dd72aff37089c6fa9`** → **ARRÊT IMMÉDIAT**.
  Le contenu de lignes historiques a été modifié. Une migration additive ne peut pas
  faire ça.
- **`lignes_figees` ≠ `132`** → **ARRÊT**. Ce nombre est immuable par construction.
- **`lignes_total` < 134** → **ARRÊT**. Des lignes ont été détruites. Une valeur
  *supérieure* est normale (1 ligne/jour par le bridge).
- **`lignes_avec_donnee_neuve` ≠ 0** → **ARRÊT** si la vérification a lieu *avant*
  le déploiement de l'écrivain. C'est le signe d'un backfill non prévu.

  > ⚠️ **Après** le déploiement de l'écrivain watcher-v2, ce compteur devient
  > légitimement non nul (chaque run remplit les 12 colonnes) et **cesse d'être un
  > signal**. Il n'est probant que dans la fenêtre migration → déploiement.

---

# 4. CE QUI N'EST **PAS** DANS LA MIGRATION, ET POURQUOI

**Aucune contrainte `CHECK` sur `status`.** Elle serait tentante : la sonde connaît
7 statuts, une `CHECK` les garantirait. Elle est écartée pour une raison précise —
la colonne `status` est **partagée** avec `watcher_bridge_promote`, qui y écrit
`running` / `success` / `completed_with_errors` / `error` / `disabled`. Une `CHECK`
devrait donc énumérer l'union des deux vocabulaires, et **le jour où un troisième job
écrit un statut non listé, c'est son `INSERT` qui échoue — c'est-à-dire que le job
meurt en silence pour une raison de forme.** Un garde-fou qui transforme une
divergence de vocabulaire en panne de production est un mauvais échange sur une table
d'audit. La sonde traite déjà un statut inconnu explicitement, sans se taire.

**Aucune contrainte `NOT NULL`.** Elle est structurellement impossible ici : les
134 lignes existantes n'ont aucune de ces valeurs.

**Aucun renommage, aucun backfill des lignes du bridge.** Les lignes
`watcher_bridge_promote` gardent `source = NULL` ; la sonde les ignore par
construction (§3.4 du build : « aucun repli sur `trigger` / `ingestionMode` /
`source` — une ligne sans ces trois champs est ignorée »). C'est voulu : le bridge
de 06:30 n'est pas le collecteur de 06:00, et le faire passer pour tel rouvrirait
exactement la faille C4-1.

---

# 5. TRAÇABILITÉ DES MESURES

Toutes les valeurs de ce pack (compte de lignes, compte de colonnes, types, index,
contraintes, les deux empreintes md5, la catégorie du mot-clé `trigger`) ont été
lues sur `ep-square-band-ag2lxpz8` le **2026-08-25 à 12:32 UTC**, via un client `pg`
qui pose `SET default_transaction_read_only = on` **avant** toute requête et qui
refuse de se connecter si l'hôte ne correspond pas à `ep-square-band`.

Preuve conservée : `SHOW default_transaction_read_only` → `on`.

Aucun secret n'apparaît dans ce document. Aucune valeur de variable d'environnement
n'a été imprimée. Aucun `vercel env pull`. **Aucune écriture, aucune migration
exécutée.**

---

# 6. APRÈS — et seulement après

L'ordre compte. Chaque étape suppose la précédente **vérifiée**, pas seulement lancée.

1. **Partie 1** → identité confirmée.
2. **Partie 2** → migration appliquée.
3. **Partie 3** → les 4 vérifications passent.
4. **Puis** autoriser les exemptions de guard et déployer l'écrivain
   (`docs/prep/WATCHER_CLOSURE_2026-08-25.md`).

> **La migration seule ne répare rien, et ne casse rien non plus.** Entre l'étape 3
> et l'étape 4, les 12 colonnes existent et sont vides : la sonde C4 voit une fenêtre
> vide et rend `CRITICAL`. C'est le comportement correct et attendu — un silence
> n'est pas une bonne nouvelle — mais il ne faut pas le lire comme un échec de
> migration. Le vert ne peut revenir qu'après le **premier run du watcher-v2 avec
> l'écrivain déployé**, c'est-à-dire au cron de 06:00 UTC suivant le déploiement.
