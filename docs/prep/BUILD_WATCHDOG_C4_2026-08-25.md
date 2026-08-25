# BUILD — SONDE « WATCHER HEALTH C4 »

**Date :** 2026-08-25
**Branche :** `feat/cc-offline-101-watchdog-c4`
**Mode :** construction sur branche. Aucun merge, aucun déploiement, aucune migration
exécutée, aucune écriture en base. Les mesures en base sont en lecture seule stricte
(`ep-square-band`, session `default_transaction_read_only = on` — preuve conservée §5).

---

## 0. Résumé en cinq lignes

La logique de la sonde C4 est **écrite, typée, lintée et prouvée sur fixtures** :
2 fichiers de code, 1 fichier de tests, **31 tests verts**, dont les **6 invariants
C4 prouvés par mutation**. La suite complète du dépôt reste verte (302 fichiers,
3 374 tests). **Aucun chemin gelé n'est touché** — `src/lib/watchdog/` et `docs/`
ne figurent dans aucun `FORBIDDEN_PATTERNS` de `scripts/guard-offline.sh` : ni
`.patch` ni bloc d'exemption ne sont nécessaires pour cette tâche.

Ce qui **n'est pas** fait, et ne pouvait pas l'être : le câblage à la vraie base.
La table `JobRunLog` en production ne porte **aucune** des 12 colonnes dont la spec
a besoin, et **aucun run du watcher-v2 n'y écrit quoi que ce soit** (§3).

---

## 1. Ce qui est construit

| Fichier | Rôle | Lignes |
|---|---|---|
| `src/lib/watchdog/watcherRunTypes.ts` | Vocabulaire d'un run : `TRIGGER`, `INGESTION_MODE`, `RUN_STATUS`, `WatcherRunRecord`, prédicats `isCronLiveWatcherRun` / `isHealthyRun` | 163 |
| `src/lib/watchdog/watcherHealthProbe.ts` | Les 4 sondes + rendement + synthèse structurée + rendu texte | 567 |
| `src/lib/watchdog/__tests__/watcherHealthC4.test.ts` | 31 tests, dont les 6 invariants C4 par mutation | 470 |

### 1.1 Les trois fraîcheurs, jamais fusionnées (spec §1)

```
schedulerFreshness  = MAX(startedAt)            sur les runs CRON+LIVE+WATCHER_V2
collectorFreshness  = MAX(collectionStartedAt)  idem
successfulFreshness = MAX(finishedAt)           idem, ET seulement sur les runs SAINS
```

Le filtre `trigger=CRON AND ingestionMode=LIVE AND source=WATCHER_V2` est appliqué
**à l'entrée** (`selectLiveCronRuns`), pas en fin de calcul. Un backfill n'est donc
pas « écarté du score » : il n'existe pas pour la sonde. C'est ce qui rend C4-1
structurel plutôt que conditionnel. Les runs écartés sont malgré tout **comptés**
(`ignoredRunCount`) : invisible dans le verdict, visible dans l'audit.

`capped` est absent de `HEALTHY_STATUSES`. Un run capé ne peut donc pas porter
`successfulFreshness`, quelle que soit la suite du calcul.

### 1.2 Les quatre sondes (spec §3), et pourquoi elles raisonnent en créneaux

Le Watcher a une cadence : un rendez-vous par jour à 06:00 UTC. Un compteur
« heures depuis le dernier succès » facturerait la cadence elle-même comme un
retard — 12 h après un succès de 06:05, il est 18:05 et le run suivant n'est même
pas dû. Chaque sonde regarde donc **quel rendez-vous a été honoré**, et compte le
retard **depuis le plus ancien rendez-vous manqué** (`oldestUnsatisfiedSlot`).
Effet mesurable : une panne de trois jours pèse trois jours, pas « depuis ce matin ».

| Sonde | Question | Seuils | Composant exposé |
|---|---|---|---|
| **A** | Le cron a-t-il démarré pour le rendez-vous ? | +1 h WARNING · +3 h CRITICAL | `Scheduler` |
| **B** | Ce run a-t-il commencé à lire chez X ? | `startedAt` non nul + `collectionStartedAt` nul → WARNING | `Collector` |
| **C** | Un run **sain** a-t-il honoré le rendez-vous ? | +12 h WARNING · +24 h CRITICAL, puis reste CRITICAL | `Persistence` |
| **D** | Combien de runs capés consécutifs ? | 1 → WARNING · 2 → CRITICAL | `Budget` |

La remontée de créneaux est **bornée par le run le plus ancien de la fenêtre reçue**.
Sans cette borne, une base neuve verrait des rendez-vous « manqués » antérieurs à
l'existence du Watcher et la sonde crierait au feu le jour de son installation.

### 1.3 Rendement — sonde séparée, jamais `WATCHER_DOWN` (spec §4)

`Detection` porte `LOW_VOLUME_WARNING` sous `candidatesProduced < 45` (p10 des runs
d'août avant le blackout : 62→85/jour), **et uniquement sur un run qui a réellement
collecté**. Un run qui n'a jamais collecté n'a pas « un rendement faible », il n'a
pas de rendement du tout : confondre les deux ferait passer une panne de collecte
pour un problème de qualité de signal — l'erreur exacte que le diagnostic du 24 août
a dû écarter à la main. `collectionYield` et `detectionYield` sont exposés bruts ;
aucun seuil statistique ne leur est appliqué pour l'instant, comme demandé.

`Detection` remonte **tous** ses motifs, pas le premier trouvé : un rendement bas et
une métrique incohérente peuvent coexister, et le second ne doit pas être masqué par
le premier.

### 1.4 Sortie structurée (spec §5)

```
Scheduler | Collector | Persistence | Detection | Budget   → HEALTHY | WARNING | CRITICAL
+ expectedRunAt, schedulerFreshness, collectorFreshness, successfulFreshness
+ consecutiveCappedRuns, consecutiveFailedRuns
+ liveCronRunCount, ignoredRunCount
→ overall : HEALTHY | DEGRADED | CRITICAL  + reasons[]
```

Règle de synthèse : un `CRITICAL` quelconque → `CRITICAL` ; sinon un `WARNING`
quelconque → `DEGRADED` ; sinon `HEALTHY`. **`DEGRADED` n'est pas `DOWN`** — c'est
la traduction globale d'un WARNING, et c'est ce que rendent C4-2 et C4-4.

---

## 2. Les 6 invariants C4 — prouvés par mutation

Protocole : on construit un monde, on y injecte **la ligne qui aurait dû tromper la
sonde**, et on vérifie que le verdict ne bouge pas. C'est le seul protocole qui
aurait attrapé le blackout du 17→24 août : la sonde de l'époque passait tous les
tests « la fraîcheur est bien calculée » et échouait uniquement au test « et si un
humain écrivait 261 lignes à la main ? », que personne n'avait écrit.

| # | Invariant | Mutation injectée | Résultat prouvé |
|---|---|---|---|
| **C4-1** | LIVE vieux 72 h + backfill maintenant → reste CRITICAL | Run `BACKFILL/BACKFILL`, 261 candidats, à l'instant | `overall` CRITICAL identique ; `successfulFreshness` **inchangée à la seconde** (2026-08-22T06:04:52Z) ; `ignoredRunCount = 1` |
| **C4-2** | Cron capé aujourd'hui → scheduler frais, collector non sain, WARNING | Statut réécrit `CAPPED` (majuscules) | `Scheduler` HEALTHY · `Collector` WARNING · `Budget` WARNING · `overall` DEGRADED ; la casse ne rend pas la sonde aveugle |
| **C4-3** | 2 capés consécutifs → CRITICAL | Un run sain intercalé dans la série | `consecutiveCappedRuns` 2 → CRITICAL ; avec le run sain intercalé : 0 → HEALTHY. Le scheduler reste VERT dans les deux cas |
| **C4-4** | 50 handles + tweets + 0 candidat → LIVE frais, LOW_VOLUME, pas DOWN | Le même run **sans** métriques (`handlesAttempted=0`, `tweetsFetched=0`) | Scheduler/Collector/Persistence/Budget HEALTHY, `Detection` WARNING ; le rendu texte ne contient jamais « down ». Muté : le run n'est plus sain, `successfulFreshness` retombe à la veille |
| **C4-5** | Aucun `JobRunLog` du run attendu → scheduler CRITICAL | Fenêtre **entièrement vide** | CRITICAL à +4 h ; paliers vérifiés à +0h30 (HEALTHY), +1h05 (WARNING), +3h05 (CRITICAL) ; fenêtre vide → CRITICAL, jamais un silence rassurant |
| **C4-6** | Un run manuel LIVE réussi ne remet pas le scheduler au vert | Le **même** run avec `trigger=CRON` | Verdict **`toEqual` bit-à-bit identique** avec et sans le run manuel ; le même run en CRON remet bien tout au vert (preuve que le test ne passe pas par accident) |

Exécution :

```
$ npx vitest run src/lib/watchdog
 Test Files  1 passed (1)
      Tests  31 passed (31)

$ npx vitest run          # suite complète du dépôt
 Test Files  302 passed (302)
      Tests  3374 passed | 2 skipped (3376)

$ npx tsc --noEmit        # 0 erreur
$ npx eslint src/lib/watchdog --ext .ts   # 0 warning
```

---

## 3. Ce qui dépend de la migration `JobRunLog` — NON appliquée

### 3.1 Le schéma réel, mesuré et non présumé

`information_schema.columns` sur `ep-square-band`, 2026-08-25 07:07 UTC. Les
13 colonnes réelles **coïncident exactement** avec `prisma/schema.prod.prisma` :
il n'y a pas de dérive Prisma↔DB sur cette table (contrairement à `XApiUsage`).

| Colonne réelle | Type réel | Utilisée par C4 ? |
|---|---|---|
| `id` | `text` | oui |
| `jobName` | `text` | remplacée par `source` (voir 3.3) |
| `dryRun` | `boolean` | non |
| `startedAt` | `timestamp without time zone` (déf. `now()`) | **oui** |
| `finishedAt` | `timestamp without time zone` | **oui** |
| `status` | `text` (déf. `'running'`) | **oui**, mais 5 valeurs à ajouter |
| `limitN`, `processed`, `createdDrafts`, `ambiguous`, `conflicts`, `errors` | `integer` | non |
| `summaryJson` | `jsonb` | non |

### 3.2 Les 12 colonnes manquantes

Aucune n'existe. La sonde les lit toutes.

| Colonne cible | Type proposé | Sans elle, la sonde… |
|---|---|---|
| `source` | `text` | ne peut pas distinguer WATCHER_V2 d'une autre source |
| `trigger` | `text` | **ne peut pas prouver C4-1 ni C4-6** — c'est le cœur du correctif |
| `ingestionMode` | `text` | **ne peut pas exclure un backfill** — idem |
| `scheduledAt` | `timestamp` | perd l'ancrage au rendez-vous (repli sur `startedAt`, cf. 3.4) |
| `collectionStartedAt` | `timestamp` | **perd la sonde B en entier** — un bail budgétaire redevient invisible |
| `handlesAttempted` | `integer` | ne peut pas valider `SUCCESS_ZERO_CANDIDATES` |
| `handlesSucceeded` | `integer` | perd `collectionYield` |
| `tweetsFetched` | `integer` | ne peut pas valider `SUCCESS_ZERO_CANDIDATES` |
| `newPostsObserved` | `integer` | perd une métrique de §4 |
| `candidatesProduced` | `integer` | **perd `LOW_VOLUME_WARNING`** |
| `xApiErrors` | `integer` | perd une métrique de §4 |
| `durationMs` | `integer` | perd une métrique de §4 |

### 3.3 Le trou plus grave que les colonnes : **personne n'écrit**

`SELECT "jobName", count(*) FROM "JobRunLog" GROUP BY 1` rend **une seule ligne** :

```
watcher_bridge_promote   134 runs   dernier 2026-08-25 07:06:32 UTC
```

Statuts présents : `disabled` (124) et `success` (10, dernier le 2026-08-16).

**`/api/cron/watcher-v2` n'écrit RIEN dans `JobRunLog`.** L'unique écrivain est
`src/lib/watcher-bridge/runBridgeJob.ts`, qui journalise le *bridge* de 06:30 —
pas le collecteur de 06:00. Conséquence directe : **même si la migration des
12 colonnes était appliquée à l'instant, la sonde C4 verrait une fenêtre vide et
rendrait CRITICAL en permanence.** Le test « fenêtre entièrement vide » (§2, C4-5)
décrit littéralement l'état actuel de la production.

C'est aussi la confirmation, par un autre chemin, du point 7.1 du diagnostic du
24 août : la sortie sur `capReached` est silencieuse **côté base**. Le bridge, lui,
a déjà le bon motif — il écrit `status='disabled'` quand son kill switch est fermé,
« visible dans l'audit, jamais un skip silencieux ». Le watcher-v2 doit faire pareil.

### 3.4 Le repli assumé, et sa date de péremption

`runAnchor()` retombe sur `startedAt` puis `finishedAt` quand `scheduledAt` est nul.
Ce n'est pas de la complaisance : pendant la fenêtre entre la migration (colonnes
ajoutées, nullables) et le déploiement de l'écrivain, les lignes fraîches n'auront
pas encore de `scheduledAt`, et une sonde qui devient aveugle pendant sa propre
mise en service ne sert à rien. **À retirer une fois l'écrivain déployé et une
semaine de lignes complètes observée.**

En revanche il n'y a **aucun repli sur `trigger` / `ingestionMode` / `source`** :
une ligne sans ces trois champs est ignorée. C'est délibéré — un repli permissif
sur ces colonnes-là rouvrirait exactement la faille de C4-1.

### 3.5 La migration proposée — **NON APPLIQUÉE, NON EXÉCUTÉE**

Strictement additive, toutes colonnes nullables, aucun `DROP`, aucun `ALTER TYPE`,
aucune réécriture de ligne existante. À passer par David dans le SQL Editor Neon,
jamais par `prisma migrate` (verrou A9).

```sql
-- PROPOSITION — NON APPLIQUÉE au 2026-08-25.
-- Additive stricte : les 134 lignes existantes restent valides (tout est NULL).
ALTER TABLE "JobRunLog"
  ADD COLUMN IF NOT EXISTS "source"              text,
  ADD COLUMN IF NOT EXISTS "trigger"             text,
  ADD COLUMN IF NOT EXISTS "ingestionMode"       text,
  ADD COLUMN IF NOT EXISTS "scheduledAt"         timestamp without time zone,
  ADD COLUMN IF NOT EXISTS "collectionStartedAt" timestamp without time zone,
  ADD COLUMN IF NOT EXISTS "handlesAttempted"    integer,
  ADD COLUMN IF NOT EXISTS "handlesSucceeded"    integer,
  ADD COLUMN IF NOT EXISTS "tweetsFetched"       integer,
  ADD COLUMN IF NOT EXISTS "newPostsObserved"    integer,
  ADD COLUMN IF NOT EXISTS "candidatesProduced"  integer,
  ADD COLUMN IF NOT EXISTS "xApiErrors"          integer,
  ADD COLUMN IF NOT EXISTS "durationMs"          integer;

-- La sonde filtre sur (source, trigger, ingestionMode) puis trie sur l'ancre.
CREATE INDEX IF NOT EXISTS "JobRunLog_c4_probe_idx"
  ON "JobRunLog" ("source", "trigger", "ingestionMode", "scheduledAt" DESC);
```

**`timestamp without time zone` et pas `timestamptz` : c'est un choix de cohérence,
pas de confort.** Les 5 colonnes temporelles existantes de la table sont naïves,
comme 341 des 413 colonnes temporelles de la base. Mélanger les deux types dans une
même table produit des comparaisons dont le résultat dépend du `TimeZone` de la
session. Le sujet de fond (naïf vs `timestamptz`) est traité comme **SI-01** dans
`docs/prep/AUDIT_SCHEMA_INTEGRITY_P1_2026-08-25.md` — il ne doit pas être arbitré
en passager clandestin d'une migration de sonde.

### 3.6 Casse des statuts — la spec dit MAJUSCULES, la colonne dit minuscules

Mesuré : `JobRunLog.status` ne contient que `disabled` et `success`, et le code en
produit cinq, tous minuscules (`running`, `success`, `completed_with_errors`,
`error`, `disabled`). Les constantes `RUN_STATUS` portent donc les **valeurs
minuscules** ; la casse majuscule de la spec est celle du document, pas de la
colonne. `normalizeLabel()` accepte quand même les deux casses à la lecture : le
jour où un écrivain pose `CAPPED`, la sonde doit le **reconnaître**, pas le laisser
tomber dans « statut inconnu » et se taire. Une sonde qui devient aveugle sur une
différence de casse reproduit exactement la panne qu'elle surveille. Prouvé par le
test de mutation de C4-2.

Cinq valeurs nouvelles à produire côté écrivain : `capped`,
`success_zero_candidates`, `partial`, `timed_out_with_writes`,
`timed_out_unknown_writes`. Aucune valeur existante n'est renommée — les filtres
SQL déjà écrits continuent de fonctionner.

---

## 4. Ce qui reste à câbler — dans l'ordre, avec le fondateur

| # | Étape | Chemin | Gelé ? | Bloqueur |
|---|---|---|---|---|
| 1 | Appliquer la migration §3.5 dans Neon | — | — | Décision David |
| 2 | Refléter les 12 colonnes dans `prisma/schema.prod.prisma` | `prisma/` | **OUI** | `.patch` + bloc d'exemption |
| 3 | Faire écrire `JobRunLog` au watcher-v2 (dont sur `capReached` / `spendCapped` / `usageUnavailable`) | `src/app/api/cron/watcher-v2/route.ts` | **OUI** | `.patch` + exemption. **C'est la fenêtre sensible — à faire avec David, pas en session autonome** |
| 4 | Écrire l'adaptateur SQL `JobRunLog → WatcherRunRecord[]` | `src/lib/watchdog/` | non | dépend de 1 |
| 5 | Brancher la sonde sur `watcher-health.mjs` (remplacer le check n°1) | `src/scripts/watchdog/` | non | dépend de 4 |
| 6 | Retirer le repli `runAnchor` (§3.4) | `src/lib/watchdog/` | non | +1 semaine de lignes complètes |

L'étape 5 mérite une précaution : le check n°1 actuel (`MAX(discoveredAtUtc)`) ne
doit **pas** être supprimé le jour où la sonde C4 est branchée. Les deux doivent
tourner en parallèle le temps que `JobRunLog` accumule assez de lignes pour que C4
soit crédible — sinon on remplace une sonde falsifiable par une sonde muette, ce
qui est pire. Le retrait de l'ancien check est une décision distincte, à prendre
sur données.

> ⚠️ L'ancien check n°1 souffre par ailleurs d'un défaut **indépendant** de tout
> ceci : `social_post_candidates.discoveredAtUtc` est `timestamp without time zone`
> (mesuré), et `pg` parse ce type dans le fuseau **local du process Node**. Sur
> Host-001 (Lombok, UTC+8), un instant stocké 08:34 UTC est lu comme 00:34 UTC :
> l'âge calculé est **surestimé de 8 h**. Le sens du décalage est heureux — la
> sonde alerte trop tôt plutôt que trop tard — mais le nombre affiché dans
> l'alerte Telegram est faux, et le seuil de 3,5 j se déclenche en réalité à
> 3,17 j. Détaillé et classé dans
> `docs/prep/AUDIT_SCHEMA_INTEGRITY_P1_2026-08-25.md` (SI-01).

---

## 5. Traçabilité des mesures

Toutes les lectures de cette session ont été faites via un client `pg` posant
`SET default_transaction_read_only = on` **avant** toute requête, sur une chaîne
dont l'hôte est vérifié par regex `ep-square-band` (refus et sortie 1 sinon).
Preuve conservée : `SHOW default_transaction_read_only` → `on`.

Aucun secret n'apparaît dans ce rapport. Aucune valeur de variable d'environnement
n'a été lue ni écrite. Aucun `vercel env pull`.

---

## 6. UNKNOWN honnêtes

1. **Le seuil `lowVolumeCandidates = 45` est un p10 reconstruit**, pas mesuré sur la
   distribution complète : il vient des 6 jours pleins d'août (62→85 candidats/jour,
   `docs/prep/DIAG_WATCHER_2026-08-24.md` §1) et du chiffre p10 annoncé dans la spec.
   Il est **configurable** (`WatcherHealthConfig.lowVolumeCandidates`), prouvé
   surchargeable par test. À recalibrer sur `candidatesProduced` réel quand la
   colonne existera — c'est-à-dire après l'étape 3 du §4.
2. **Le rattachement d'un run à son créneau suppose une cadence quotidienne unique.**
   Si le watcher passe un jour à deux runs/jour, `cadenceMs` doit suivre, sinon deux
   runs tomberaient dans le même créneau et le second masquerait l'échec du premier.
   La configuration existe, l'invariant n'est pas testé sur une cadence non
   quotidienne.
3. **Je n'ai pas pu vérifier que le run 06:00 UTC part réellement les 22–25 août.**
   Même limite qu'au §6.2 du diagnostic du 24 : les logs runtime Vercel ne sortent
   pas par l'API sur ce plan. La sonde C4 est précisément ce qui rendra cette
   question mesurable en base — mais elle ne peut pas y répondre rétroactivement.
4. **Aucun test ne couvre le comportement sous horloge décalée** (dérive NTP du
   host, `now` fourni par l'appelant). La sonde prend `now` en paramètre, ce qui rend
   la chose testable ; le test n'est pas écrit.
