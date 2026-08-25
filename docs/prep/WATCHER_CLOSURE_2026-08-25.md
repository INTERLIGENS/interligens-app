# CLÔTURE DU WATCHER — rendre la sonde C4 vivante

**Date :** 2026-08-25
**Branche :** `feat/cc-offline-101-watchdog-c4`
**Mode :** construction sur branche. **Rien de mergé, rien de déployé, migration
non exécutée.** Toutes les lectures en base sont read-only strictes
(`SET default_transaction_read_only = on` sur `ep-square-band`, preuve §7).

---

## 0. Résumé en cinq lignes

La sonde C4 était construite mais **aveugle** : `JobRunLog` n'avait pas les
colonnes, et `watcher-v2` n'y écrivait rien. Les trois manques sont désormais
couverts : le **pack de migration** est prêt à copier (§1), l'**écrivain** est
construit et testé (§2), la **sonde est branchée sur la vraie base** et remplace
`MAX(discoveredAtUtc)` dans le watchdog Telegram (§3).

**3 416 tests verts** (304 fichiers, +42 tests, aucune régression), `tsc` 0 erreur,
`eslint` 0 warning, guard vert, et **tout le SQL parsé par PostgreSQL lui-même**.
Le chemin gelé est livré en `.patch` vérifié aller-retour (§4), avec son bloc
d'exemption (§5). Il reste **3 gestes fondateur** : migration, exemption, deploy.

---

## 1. ÉTAPE 1 — Pack de migration `JobRunLog` — **PRÊT, NON APPLIQUÉ**

📄 **`docs/prep/PACK_MIGRATION_JOBRUNLOG_2026-08-25.md`**

Trois parties copiables, sur le modèle du pack chunker :

| Partie | Contenu | Preuve |
|---|---|---|
| **1 — Identité DB** | La requête qui prouve `ep-square-band-ag2lxpz8` + branche + projet, et **`colonnes_jobrunlog = 13`** | Tout `ep-bold-sky` → ARRÊT. Plus de 13 colonnes → la migration est déjà passée, aller directement en Partie 3 |
| **2 — SQL verbatim** | 12 colonnes **nullables, sans défaut** + 1 index. Aucun `DROP`, `ALTER COLUMN`, `SET NOT NULL`, `USING ::` | Additif strict : `ADD COLUMN` nullable sans défaut ne réécrit aucune ligne (opération de catalogue) |
| **3 — Vérification** | 4 requêtes : colonnes typées, index, contraintes, **et deux empreintes md5** | Chacune avec résultat attendu + signal d'arrêt |

**Les deux empreintes sont le cœur de la Partie 3**, toutes deux mesurées sur la
production le 2026-08-25 à 12:32 UTC :

- `empreinte_13_colonnes = 82456597a6dd27a390ac511b9a3580cb` — type, nullabilité
  et défaut des 13 colonnes **préexistantes**, trié par nom, donc **insensible à
  l'ajout des 12 nouvelles**. Identique ⇒ aucune colonne existante n'a bougé.
- `empreinte_donnees = 3136b3d2eb70a46dd72aff37089c6fa9` sur **132 lignes figées**
  (`startedAt < 2026-08-25 06:00:00`). Ce sous-ensemble est **définitivement
  clos** : les lignes ne s'écrivent qu'en append avec `startedAt = now()`. Elle
  est donc stable quel que soit le jour d'application — contrairement au simple
  `count(*)`, qui monte d'une unité par jour (cron bridge de 06:06 UTC).

**Deux points vérifiés sur la base plutôt que supposés :**

1. **`trigger` est un nom de colonne légal** — `pg_get_keywords()` le classe
   `unreserved`, et `SELECT 1 AS trigger` s'exécute. Pas de piège de mot réservé.
2. **Les 4 nouvelles colonnes temporelles sont naïves**, comme les 5 existantes.
   Mélanger naïf et `timestamptz` dans une même table produit des comparaisons
   dépendantes du `TimeZone` de session ; ce n'est pas un arbitrage à faire en
   passager clandestin d'une migration de sonde (SI-01).

**Aucune contrainte `CHECK` sur `status`** — décision explicite, argumentée §4 du
pack : la colonne est **partagée** avec `watcher_bridge_promote`, et une `CHECK`
transformerait une future divergence de vocabulaire en `INSERT` qui échoue,
c'est-à-dire en job qui meurt pour une raison de forme.

---

## 2. ÉTAPE 2 — L'écrivain `JobRunLog` — **CONSTRUIT ET TESTÉ**

### 2.1 Où vit la logique, et pourquoi

`src/app/api/cron/watcher-v2/route.ts` est **gelé** (`^src/app/api/`). Tout ce qui
pouvait être décidé et testé hors de la route l'a été, dans `src/lib/watchdog/`
qui ne l'est pas :

| Fichier | Gelé ? | Rôle |
|---|---|---|
| `src/lib/watchdog/jobRunLogWriter.ts` | non | Ouverture/fermeture de la ligne, **table de décision des statuts**, résolution du `trigger` |
| `src/lib/watchdog/__tests__/jobRunLogWriter.test.ts` | non | **28 tests** — chaque statut sur son chemin, par mutation |
| `src/lib/watchdog/jobRunLogAdapter.ts` | non | Lecture `JobRunLog` → `WatcherRunRecord[]` (§3.1) |
| `src/lib/watchdog/__tests__/jobRunLogAdapter.test.ts` | non | **14 tests** — dont le verrou `AT TIME ZONE 'UTC'` |
| `src/scripts/watchdog/watcher-health.mjs` | non | Check n°1 remplacé par la sonde C4 (§3.2) |
| `src/scripts/watchdog/c4-selftest.ts` | non | Rejoue les scénarios ③/④ de la checklist |
| `src/app/api/cron/watcher-v2/route.ts` | **OUI** | **+102 / −2 lignes**, livrées en `.patch` (§4) |

Résultat : le patch sur le fichier gelé est petit, relisible d'un coup d'œil, et
**ne contient aucune décision** — seulement des appels.

### 2.2 La table de décision — chaque chemin de sortie a son statut

L'ordre des tests **est** la spécification : un run peut satisfaire plusieurs
conditions à la fois, et c'est le premier test qui gagne. Il est choisi pour que
le statut nomme la **cause la plus actionnable**, pas la conséquence la plus visible.

| # | Condition | Statut | Pourquoi |
|---|---|---|---|
| 1 | exception traversante | `failed` | On ne sait pas ce qui a été écrit — ça prime sur tout |
| 2 | `usageUnavailable` | **`failed`** | ⚠️ **Pas `capped`** — voir ci-dessous |
| 3 | `spendCapped` | `capped` | Latch 403 sur la sonde d'entrée |
| 4 | `capReached` avant boucle | `capped` | Plafond POSTS, 0 handle traité |
| 5 | plafond franchi **en cours** | `partial` | Le run a collecté puis s'est arrêté court |
| 6 | handles tentés, **aucun** abouti | `failed` | Pas « sans résultat » : n'a pas fonctionné |
| 7 | candidats > 0 | `success` | |
| 8 | sinon | `success_zero_candidates` | La sonde décidera s'il est *sain* |

> **Le choix qui mérite d'être discuté : `usageUnavailable → failed`, jamais `capped`.**
> Ce chemin se déclenche quand `/2/usage/tweets` reste illisible après retries :
> le budget est **inconnu**, pas épuisé. L'étiqueter `capped` ferait monter la
> sonde Budget (1 run → WARNING, 2 → CRITICAL) et enverrait David dans la console
> de facturation X **pour un incident réseau**. `failed` nomme ce qui s'est passé
> et alimente `consecutiveFailedRuns`, qui est le bon compteur. Le motif exact
> reste dans `summaryJson.exitReason`, donc rien n'est perdu.

**Sur le cas 8 et `tweetsFetched = 0` :** l'écrivain écrit le statut honnêtement
même quand rien n'a été lu, sans maquiller en `success`. C'est `isHealthyRun` qui
exige `tweetsFetched > 0 ET handlesAttempted > 0` et **refuse alors de faire
porter `successfulFreshness` à ce run**. La prudence appartient à la sonde, pas à
l'écrivain — un écrivain qui arrondit rejouerait le mensonge d'août.

### 2.3 `collectionStartedAt` : posé au bon endroit, et seulement là

L'horodatage est posé **juste avant la boucle sur les handles**, et surtout **pas**
sur la sonde d'entrée du spend-cap — qui est un *contrôle*, pas une *collecte*.

C'est cette distinction qui donne à la sonde B sa signature de bail budgétaire
(`startedAt` non nul, `collectionStartedAt` nul) et qui rend **l'invariant C4-2**
vrai en production. Le poser plus haut rendrait la sonde Collecteur définitivement
aveugle au seul état qu'elle existe pour voir.

### 2.4 `trigger` : on ne marque `CRON` que sur preuve positive

L'invariant **C4-6** (« un run manuel réussi ne remet pas l'ordonnanceur au vert »)
ne tient que si `trigger` est juste. Les deux erreurs ne coûtent pas la même chose :

- défaut `CRON` + détection ratée → un curl manuel passe pour un cron. La sonde
  croit l'ordonnanceur vivant alors qu'il est mort. **Silencieux, faux — le mode
  de panne exact du blackout d'août.**
- défaut `MANUAL` + détection ratée → les crons passent pour manuels, la sonde ne
  voit plus aucun run et crie CRITICAL. **Bruyant, faux, visible en une nuit.**

Une sonde doit échouer fort, pas en silence. `resolveTrigger()` marque donc `CRON`
**uniquement** sur `user-agent` commençant par `vercel-cron/` ou sur l'en-tête
`x-vercel-cron`, et retombe sur `MANUAL` sinon. ⚠️ **C'est le point à vérifier en
premier après le déploiement** (checklist §6, point 2).

### 2.5 Les métriques, et l'entonnoir qu'elles rendent lisible

`handlesAttempted = scanned + failed` · `handlesSucceeded = scanned` ·
`tweetsFetched` · **`newPostsObserved = candidates + skipped`** ·
`candidatesProduced = candidates` · `xApiErrors = failed` · `durationMs`.

`newPostsObserved` compte les posts **porteurs de signal** vus (neufs + déjà
connus). Les trois nombres forment un entonnoir monotone —
`tweetsFetched ≥ newPostsObserved ≥ candidatesProduced` — qui permettra enfin de
distinguer « la collecte est morte » de « le signal s'est tari », les deux
hypothèses que le diagnostic du 24 août a dû départager à la main.

### 2.6 Une panne du journal ne tue jamais le scan

Les trois écritures (`open`, `markCollectionStarted`, `close`) avalent leurs
erreurs, les loguent, et rendent la main. `openWatcherRun` rend `null` et le scan
continue sans journal. **Une sonde qui tue le collecteur qu'elle surveille serait
un très mauvais échange** — et l'absence de ligne est elle-même le signal que la
sonde remontera au watchdog suivant.

### 2.7 Où la ligne est ouverte dans la route

Après `CRON_SECRET`, **après `prodWriteGuardResponse`**, après `hasToken`. Un
déploiement Preview bloqué par la barrière d'écriture production **n'écrit donc
aucune ligne** et ne pollue pas la fenêtre de la sonde.

---

## 3. ÉTAPE 3 — La sonde branchée sur la vraie base

### 3.1 L'adaptateur — `src/lib/watchdog/jobRunLogAdapter.ts` (non gelé)

Le seul endroit du système où la sonde touche la base. `watcherHealthProbe.ts`
reste une fonction pure sur des données : c'est ce qui permet de prouver ses
6 invariants par mutation, sans base.

> ### ⚠️ Le piège que l'adaptateur existe pour désamorcer — mesuré, pas supposé
>
> Les 4 colonnes temporelles sont `timestamp without time zone`, et les drivers
> Node (`pg`, Prisma) parsent ce type **dans le fuseau local du process**.
> Mesuré sur la production aujourd'hui :
>
> | lecture | valeur |
> |---|---|
> | valeur réellement stockée | `2026-08-25 07:06:32.760` |
> | lue par `pg` depuis Europe/Paris | `2026-08-25T05:06:32.760Z` — **2 h d'écart** |
> | lue avec `AT TIME ZONE 'UTC'` | `2026-08-25T07:06:32.760Z` — **correcte** |
>
> Depuis Host-001 (Lombok, UTC+8), l'écart serait de **8 h**. C'est le défaut
> **SI-01**, celui-là même qui fausse l'ancien check n°1 (seuil affiché 3,5 j, se
> déclenchant en réalité à 3,17 j). **Une sonde de fraîcheur qui se trompe de 8 h
> sur ses propres mesures ne vaut pas mieux que celle qu'elle remplace.**
>
> Les 4 colonnes passent donc toutes par `"col" AT TIME ZONE 'UTC'`, et la borne
> de fenêtre aussi. **Deux tests verrouillent ça**, dont un qui échoue si
> quelqu'un ajoute plus tard une colonne temporelle en la copiant sur les
> colonnes entières.

**Un écart assumé avec la lettre de la consigne, et sa raison.** La consigne
demandait un filtre SQL `trigger=CRON AND ingestionMode=LIVE AND source=WATCHER_V2`.
Le filtre **effectif est bien celui-là**, mais appliqué en deux temps : `source`
dans le SQL, `trigger`/`ingestionMode` par `selectLiveCronRuns()` dans la sonde.

Si le SQL écartait déjà les backfills, la sonde n'en verrait aucun,
`ignoredRunCount` vaudrait 0 en permanence, et **l'invariant C4-1 — « un backfill
de 261 lignes n'a pas bougé la fraîcheur, ET il a été compté » — deviendrait
invérifiable en production** : vrai sur fixtures, indémontrable sur le réel.
C'est le genre de garantie qui s'érode sans bruit. Le tri par trigger appartient à
la sonde, qui le documente comme sa porte d'entrée. **Si tu préfères la lettre à
l'esprit ici, dis-le — c'est une ligne à changer.**

### 3.2 Le watchdog Telegram — `MAX(discoveredAtUtc)` ne décide plus rien

`src/scripts/watchdog/watcher-health.mjs` (**non gelé**) :

- **Check n°1** est désormais la sonde C4 : elle lit `JobRunLog`, produit le
  verdict structuré, et c'est **elle seule** qui pousse un problème.
- **Check n°1bis** garde `MAX(discoveredAtUtc)` en **ligne informative qui
  n'alerte plus**. Ce n'est pas de la timidité : en cas d'alerte C4, c'est le
  moyen le plus rapide de trancher entre « le watcher est mort » (les deux sont
  vieux) et « le watcher va bien, son journal est cassé » (C4 crie, les signaux
  sont frais). La ligne est étiquetée `±offset local` — elle est fausse de
  l'offset, et le dire vaut mieux que l'afficher comme une vérité.
- `WATCHDOG_SILENCE_DAYS` est **retiré** : il réglait le seuil d'une mesure qui
  ne décide plus rien. Laisser traîner une variable d'env sans effet est pire que
  la supprimer — on la tournerait en croyant agir. Remplacée par
  `WATCHDOG_C4_WINDOW_DAYS` (déf. 14) ; les seuils vivent dans `DEFAULT_C4_CONFIG`,
  avec les tests qui les prouvent.

**Le `.plist` launchd n'a pas à changer.** Il lance `node` nu sur un `.mjs`, et la
sonde est en TypeScript. Plutôt que de dupliquer sa logique en JS — deux sondes
qui divergeraient au premier correctif, et celle qui alerte serait justement celle
qui n'est pas testée — le script enregistre `tsx/cjs/api` et charge le TS à la
volée. **Vérifié en exécution réelle** (§3.3).

### 3.3 L'armement — la sonde ne crie pas avant d'avoir de quoi juger

Sans précaution, déployer le watchdog avant la migration produirait un CRITICAL
permanent. Deux états sont donc nommés explicitement, tous deux **WARNING** :

| État | Détection | Message |
|---|---|---|
| Migration non appliquée | erreur PG **`42703`** (colonne absente) | `SONDE C4 NON ARMÉE — la migration JobRunLog n'est pas appliquée` |
| Écrivain non déployé | `liveCronRunCount + ignoredRunCount === 0` | `SONDE C4 NON ARMÉE — aucun run watcher-v2 journalisé sur 14j` |

**Une alerte qui crie faux pendant une journée est une alerte qu'on apprend à
ignorer** — exactement ce qu'on essaie de réparer. La sonde s'arme d'elle-même au
premier run journalisé, ce qui rend l'ordre migration/deploy **indifférent**.

**Exécuté pour de vrai contre la production aujourd'hui**
(`WATCHDOG_DRY_RUN=1`, état dans un fichier temporaire, aucune écriture) :

```
🟠 WATCHDOG INTERLIGENS

🟠 SONDE C4 NON ARMÉE — la migration JobRunLog n'est pas appliquée (column "source" does not exist)
⚠️ Source intel périmée — forta 139j (seuil 30j)

— État complet —
• Watcher C4 : migration absente
• Signaux x_api_v2 (indicatif, ±offset local) : dernier il y a 8.7h
• Spend X API : $69.68 / $140 (50%)
```

Le chargement `tsx` fonctionne, le chemin `42703` est nommé correctement, et il
est bien **WARNING** et non CRITICAL. La ligne 1bis montre au passage que le
watcher **tourne actuellement** (dernier signal ~6,7 h réelles).

### 3.4 Les invariants tiennent à travers l'adaptateur

Les 31 tests C4 d'origine sont **inchangés et verts**. S'y ajoute un test qui
rejoue **C4-1 de bout en bout** — lignes brutes « venant de la base », passées par
le mapping réel, pas par une fixture construite pour plaire :

```
successfulFreshness reste 2026-08-22T06:04:52.000Z  (inchangée à la seconde)
overall = CRITICAL                                   (le backfill n'a rien sauvé)
ignoredRunCount = 1                                  (invisible au verdict, visible à l'audit)
```

---

## 4. LE `.patch` — vérifié aller-retour

📄 **`docs/prep/patches/C4-writer-src-app-api-cron-watcher-v2-route.ts.patch`**
`sha256 = 784b1b146437686ea569f9d2e586e6d9887476c650376b2e09582e6c67c88f01`
**+102 / −2 lignes**, un seul fichier.

Protocole de vérification exécuté :

| Contrôle | Résultat |
|---|---|
| `git apply --check` | OK |
| Empreinte de l'arbre patché vs réappliqué | **identique bit-à-bit** (`de39f40a…`) |
| `git apply -R` rend l'original | **identique bit-à-bit** (`3cf6c2a2…`) |
| Suite complète **sur l'arbre patché** | **304 fichiers / 3 416 tests verts** |
| `tsc --noEmit` sur l'arbre patché | 0 erreur |
| `eslint` sur les chemins touchés | 0 warning |

**Le fichier gelé a ensuite été remis à l'identique** : `git status` ne le
mentionne pas, et `scripts/guard-offline.sh` rend
`✅ GUARD: aucun chemin interdit modifié.` sur les 5 fichiers de la branche.

**Tout le SQL du chantier a été parsé par PostgreSQL lui-même**
(`@libpg-query/parser` via `src/lib/sql/parseGuard.ts`) — la migration verbatim du
pack (2 instructions), les 6 requêtes de vérification, la requête de l'adaptateur
et les 3 requêtes de l'écrivain : **11 blocs, tous `VALID`**.

---

## 5. LE BLOC D'EXEMPTION — pour David

⚠️ **`scripts/guard-offline.sh` se gèle lui-même.** Cette modification doit passer
par la **voie de maintenance** : branche `^hotfix/guard-[a-z0-9-]+$` **et le guard
seul dans le diff**. Les deux conditions sont vérifiées par le guard lui-même.

⚠️ **Il faut DEUX insertions**, pas une : la déclaration *et* la boucle de
consommation. Le guard n'a pas de collecte générique des `EXEMPT_*_PATTERNS`.

### 5.1 Déclaration — à insérer près des autres blocs `if [[ "$BRANCH" =~ … ]]` (vers la ligne 219)

```bash
# Exceptions pour l'écrivain JobRunLog du watcher-v2 (sonde C4 « WATCHER HEALTH »).
# Additif : la route ouvre une ligne JobRunLog par run, pose collectionStartedAt
# au début de la boucle, et la ferme avec un statut terminal + 7 métriques. Toute
# la logique (table de décision des statuts, résolution du trigger, SQL) vit dans
# src/lib/watchdog/ qui n'est PAS gelé ; la route ne contient que des appels.
# Aucune logique de scan modifiée, aucun appel X API supplémentaire, aucune
# migration exécutée par le code (colonnes posées à la main dans Neon).
# Autorisation humaine explicite (David) — voir PR description.
# Exemption ciblée UNIQUEMENT sur la route cron watcher-v2 ;
# ne couvre PAS le reste de src/app/api/.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-watchdog-c4$ ]]; then
    EXEMPT_WATCHDOG_C4_PATTERNS=(
        "^src/app/api/cron/watcher-v2/route\.ts$"
    )
fi
```

### 5.2 Consommation — à insérer à la suite des autres blocs de la boucle (vers la ligne 640)

```bash
    # Sur la branche watchdog-c4, exempter la route cron watcher-v2.
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-watchdog-c4$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_WATCHDOG_C4_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi
```

> La branche active `feat/cc-offline-101-watchdog-c4` correspond bien à
> `^feat/cc-offline-[0-9]+-watchdog-c4$` — vérifié.

**Une seule exemption est nécessaire.** `prisma/schema.prod.prisma` **n'a pas
besoin d'être touché** : l'écrivain et l'adaptateur passent par `$queryRawUnsafe`,
donc aucun modèle Prisma n'est requis pour que ça marche. Refléter les 12 colonnes
dans le schema reste de l'**hygiène anti-dérive**, à faire dans une PR séparée —
ce n'est **pas un bloqueur** et ça n'appelle pas d'exemption dans ce chantier.

---

## 6. ORDRE D'APPLICATION ET CHECKLIST DE VÉRIF POST-DEPLOY

### 6.1 L'ordre

| # | Geste | Qui | Bloquant pour |
|---|---|---|---|
| 1 | Appliquer le pack de migration dans le **Neon SQL Editor** (Parties 1 → 2 → 3) | **David** | 4 |
| 2 | Ajouter le bloc d'exemption via `hotfix/guard-…` (guard seul dans le diff) | **David** | 3 |
| 3 | Appliquer le `.patch` sur la branche, commiter, merger | — | 4 |
| 4 | `npx vercel --prod` | **David** | 5 |
| 5 | Vérifier au cron de 06:00 UTC suivant (§6.2) | — | — |

> **1 et 2 sont indépendants** et peuvent se faire dans n'importe quel ordre :
> l'armement automatique (§3.3) fait que la sonde dit « non armée » en WARNING
> tant que les deux ne sont pas là, sans jamais crier CRITICAL à tort.

> ⚠️ Rappel : `npx vercel --prod` **expédie l'arbre de travail, pas le commit**.
> L'arbre porte aujourd'hui une trentaine de fichiers non suivis, tous des
> `docs/prep/*.md` et un `.sql` — sans effet sur le build.

### 6.2 La checklist — au prochain cron de 06:00 UTC

**① Un `JobRunLog` LIVE est écrit**

```sql
SELECT id, "jobName", "source", "trigger", "ingestionMode", "status",
       "scheduledAt", "startedAt", "collectionStartedAt", "finishedAt",
       "handlesAttempted", "handlesSucceeded", "tweetsFetched",
       "newPostsObserved", "candidatesProduced", "xApiErrors", "durationMs"
  FROM "JobRunLog"
 WHERE "source" = 'WATCHER_V2'
 ORDER BY "startedAt" DESC
 LIMIT 5;
```

Attendu sur la ligne du jour : `source = WATCHER_V2`, **`trigger = CRON`**,
`ingestionMode = LIVE`, `scheduledAt` = le 06:00 UTC du jour, `startedAt` peu
après, `collectionStartedAt` non nul, `finishedAt` non nul, statut `success` (ou
`success_zero_candidates`), et l'entonnoir
`tweetsFetched ≥ newPostsObserved ≥ candidatesProduced`.

> 🛑 **`trigger = 'MANUAL'` sur une ligne écrite par le cron = LE point de
> vigilance n°1.** Ça veut dire que la détection `vercel-cron` n'a pas mordu, et
> la sonde ne verra **aucun** run CRON+LIVE → CRITICAL permanent alors que le
> watcher va bien. Diagnostic immédiat, l'en-tête brut est conservé :
> ```sql
> SELECT "trigger", "summaryJson" FROM "JobRunLog"
>  WHERE "source"='WATCHER_V2' ORDER BY "startedAt" DESC LIMIT 1;
> ```
> Correctif : ajuster `VERCEL_CRON_UA` dans `src/lib/watchdog/jobRunLogWriter.ts`
> (**non gelé** — pas d'exemption nécessaire).

**② La sonde le lit**

```bash
WATCHDOG_DRY_RUN=1 node src/scripts/watchdog/watcher-health.mjs
```

Attendu : `• Watcher C4 : HEALTHY — dernier run sain 3.2h (runs LIVE+CRON retenus : 1, écartés : 0)`
et **plus aucune** mention de « non armée ».

**③ et ④ — un `CAPPED` déclenche un WARNING, un backfill ne rafraîchit rien**

Ces deux scénarios sont scriptés. **Aucun accès base, aucun réseau, aucune
écriture** — la sonde est pure, on lui donne un monde et on lit son verdict :

```bash
npx tsx src/scripts/watchdog/c4-selftest.ts
```

Sortie attendue : `✅ AUTO-TEST C4 : tous les scénarios de la checklist passent.`
(code de sortie 0). Il imprime les deux rapports en entier, pour qu'on puisse
**relire le raisonnement** et pas seulement voir passer un point vert.

Ce qu'il vérifie, et qui a été exécuté aujourd'hui :

| Scénario | Vérification |
|---|---|
| **③** 1 run capé aujourd'hui, 1 run sain hier | `Scheduler` 🟢 (le cron a bien démarré) · `Collector` 🟠 · `Budget` 🟠 · **`overall = DEGRADED`**, et `successfulFreshness` reste celle d'hier |
| **③b** 2 runs capés consécutifs | `consecutiveCappedRuns = 2` · `Budget` **CRITICAL** · `Scheduler` reste 🟢 |
| **④** backfill de 261 candidats à l'instant, sur un LIVE vieux de 5 j | `overall` reste **CRITICAL** · `successfulFreshness` **inchangée à la seconde** · `ignoredRunCount = 1` · verdict **bit-à-bit identique** avec et sans le backfill · le texte ne contient jamais « down » |

> **③ mérite une précaution de lecture.** Le scénario a besoin d'un run **sain
> antérieur** pour rendre `DEGRADED`. Un monde qui ne contiendrait *que* le run
> capé rend `CRITICAL` — et c'est correct : sans aucun run sain dans la fenêtre,
> `Persistence` n'a rien sur quoi s'appuyer. Ne pas lire ce `CRITICAL`-là comme
> une régression de C4-2.

**⑤ Aucune ligne historique n'a bougé** — rejouer la requête 3.4 du pack : les
deux empreintes doivent être identiques.

---

## 7. TRAÇABILITÉ ET GARDE-FOUS RESPECTÉS

| Garde-fou | État |
|---|---|
| Travail sur branche `feat/cc-offline-101-watchdog-c4` | ✅ |
| **Aucune migration exécutée** | ✅ pack produit, non appliqué |
| **Aucun merge, aucun deploy** | ✅ |
| **Aucune auto-autorisation de guard** | ✅ chemin gelé livré en `.patch`, fichier remis à l'identique, guard vert |
| Neon **lecture seule** `ep-square-band` | ✅ `SET default_transaction_read_only = on` avant toute requête, hôte vérifié par regex, refus et sortie 1 sinon. Preuve : `SHOW default_transaction_read_only` → `on` |
| Jamais `ep-bold-sky` | ✅ refus explicite dans le client de lecture |
| Pas de `--no-verify`, pas de `vercel env pull`, aucun secret | ✅ aucune valeur d'env imprimée |

**Écritures en base pendant la session : zéro.** Le seul exécutable ayant touché
la production est le watchdog lui-même, en `DRY_RUN`, avec son fichier d'état
redirigé vers un répertoire temporaire — il est read-only par conception.

---

## 8. UNKNOWN HONNÊTES ET DETTE OUVERTE

1. **`TIMED_OUT_WITH_WRITES` / `TIMED_OUT_UNKNOWN_WRITES` ne sont écrits par
   personne.** Un run fauché par le timeout Vercel (300 s) ne peut pas écrire sa
   propre épitaphe, et le reaper (`/api/cron/reaper`) **ne couvre que
   `intel_ingestion_batches`** — vérifié, il ne connaît pas `JobRunLog`.
   *Conséquence réelle, et elle est acceptable :* la ligne reste en `running`,
   donc elle ne porte pas `successfulFreshness` et la sonde **Persistence** passe
   WARNING à +12 h puis CRITICAL à +24 h. **Le run zombie est donc bien détecté** —
   simplement nommé « aucun run sain » plutôt que « fauché ». C'est une perte de
   *qualité de diagnostic*, pas un angle mort. Étendre le reaper à `JobRunLog`
   touche `src/lib/intelligence/reaper.ts` (non gelé) et la route (gelée) : **hors
   périmètre de cette session, à faire ensuite.**
2. **Le repli `runAnchor` (`scheduledAt` → `startedAt` → `finishedAt`) est toujours
   là**, et il doit y rester pendant la transition. À retirer après une semaine de
   lignes complètes, comme prévu au §3.4 du build.
3. **Le seuil `lowVolumeCandidates = 45` reste un p10 reconstruit**, pas mesuré sur
   la distribution complète. Il devient recalibrable dès que `candidatesProduced`
   aura une semaine de valeurs réelles.
4. **La détection `vercel-cron` n'a pas pu être vérifiée contre un vrai
   déclenchement Vercel** — les logs runtime ne sortent pas par l'API sur ce plan.
   C'est précisément le point ① de la checklist, et le repli choisi (`MANUAL`)
   garantit que l'erreur, si elle existe, sera **bruyante et non silencieuse**.
5. **`prisma/schema.prod.prisma` ne reflétera pas les 12 colonnes** après
   migration. Sans effet fonctionnel (tout passe en SQL brut), mais ça allonge la
   liste de dérive Prisma↔DB déjà connue. PR d'hygiène séparée.
6. **`WATCHDOG_C4_WINDOW_DAYS = 14` n'a pas été éprouvé sur une base chargée** :
   avec ~2 lignes/jour la fenêtre reste minuscule, mais aucun test ne couvre le
   cas où `LIMIT 200` tronquerait la fenêtre.
