# DÉPLOIEMENT DU REAPER + CONFIRMATION DES CRONS · 2026-08-21

**DÉPLOIEMENT READY — OUI.** `readyState: READY`, `target: production`,
aliasé sur **`app.interligens.com`**.

**LES 3 CRONS (reaper + 2 watcher) SONT-ILS PLANIFIÉS — OUI.** Les trois sont
enregistrés sur le nouveau déploiement, `disabledAt: null`, sur les 15 crons
déclarés. Réserve de mesure au §3 : l'API Vercel n'expose **pas** de champ
« prochaine invocation » — les horaires ci-dessous sont **calculés** depuis les
expressions cron enregistrées, pas lus chez Vercel.

**Aucune écriture manuelle. `reapZombieBatches` n'a pas été lancé. Aucun zombie
fermé** — relu après déploiement : 10 `running`, 0 ligne au journal.

---

# 1. LE DÉPLOIEMENT

| | |
|---|---|
| **dernier commit** | **`6182975`** — `docs(prep): rapport de merge du reaper + cron dédié (CC-OFFLINE-94)` |
| **URL de déploiement** | `https://interligens-kkkb9f1s6-davidpandoraparis-2892s-projects.vercel.app` |
| **inspecteur** | `https://vercel.com/davidpandoraparis-2892s-projects/interligens-app/CWiQ6ctyxjx89nNHmXHGPDED3QMp` |
| **id** | `dpl_CWiQ6ctyxjx89nNHmXHGPDED3QMp` |
| **projet** | `interligens-app` (`prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ`) |
| **état** | `READY` · `target: production` |
| **alias** | **`app.interligens.com`** · `interligens-app.vercel.app` |
| **créé** | 2026-08-21 12:03:34 UTC |

## Une précaution avant de lancer la commande

`vercel --prod` expédie **l'arbre de travail**, pas le commit. L'arbre portait
une modification non commitée : `__tests__/reflex/calibration/last-report.json`,
dont seul le champ `generatedAt` avait changé — un artefact réécrit par la suite
de tests que j'avais fait tourner. **Restauré avant le déploiement**, pour que
ce qui part en production soit exactement `6182975` et rien d'autre.

Vérifié après restauration : `git status` ne montre plus aucun fichier modifié
ou indexé, et `git diff origin/main..HEAD` est vide.

*(23 fichiers `untracked` subsistent — `docs/prep/*.md`, `AGENTS.md` : des
documents, sans effet sur le build ni sur les routes.)*

---

# 2. LES CRONS SOUS PRO — **15 enregistrés, `disabledAt: null`**

Source : `GET /v9/projects/prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ` → objet `crons`.

```
enabledAt    : 2026-03-07 17:18:43 UTC
disabledAt   : null              ← rien n'est désactivé
updatedAt    : 2026-08-21 12:06:05 UTC
deploymentId : dpl_CWiQ6ctyxjx89nNHmXHGPDED3QMp   ← le déploiement de ce jour
definitions  : 15
```

**Le `deploymentId` de l'objet `crons` est celui du déploiement qu'on vient de
faire** : les crons ont bien été ré-enregistrés sur lui, ils ne pointent pas sur
un déploiement antérieur. Tous les `host` des 15 définitions sont ceux du
nouveau déploiement, sans exception.

| schedule | route | |
|---|---|---|
| `0 1 * * *` | `/api/intelligence/ingest/ofac` | |
| `0 2 * * *` | `/api/cron/daily-flow` | |
| **`30 2 * * *`** | **`/api/cron/reaper`** | ⬅ **nouveau** |
| `0 3 * * *` | `/api/cron/process-events` | |
| `0 4 * * *` | `/api/cron/helius-scan` | |
| `0 5 * * *` | `/api/cron/retail-process-queue` | |
| **`0 6 * * *`** | **`/api/cron/watcher-v2`** | ⬅ **intact** |
| **`30 6 * * *`** | **`/api/cron/watcher-bridge`** | ⬅ **intact** |
| `0 7 * * *` | `/api/cron/intel-rss` | |
| `30 7 * * *` | `/api/cron/intel-summarize` | |
| `0 8 * * *` | `/api/cron/watch-alerts` | |
| `0 8 * * *` | `/api/cron/watch-rescan` | |
| `0 8 * * 1` | `/api/cron/weekly-digest` | |
| `0 9 * * *` | `/api/cron/mm-batch-scan` | |
| `30 1 * * *` | `/api/intelligence/ingest/scamsniffer` | |

**Les deux crons watcher ne sont pas perturbés** : `0 6` et `30 6`, inchangés,
ré-enregistrés sur le nouveau déploiement, `disabledAt: null`. Le redéploiement
n'a rien retiré — 14 crons avant, **15 après**, la seule différence étant le
reaper. Plan **Pro** : 40 autorisés, 15 déclarés.

## Les routes existent vraiment et refusent l'accès non authentifié

Sondé **sans** secret — donc rien ne peut se déclencher :

| route | HTTP |
|---|---|
| `/api/cron/reaper` | **401** `{"error":"Unauthorized"}` |
| `/api/cron/watcher-v2` | **401** |
| `/api/cron/watcher-bridge` | **401** |
| `/api/cron/nexistepas` *(témoin)* | **404** |

Le témoin est ce qui rend la mesure concluante : un 404 sur une route absente
prouve que le **401** signifie « la route est déployée **et** fermée », pas
« la route n'existe pas ».

## Le garde d'écriture ne bloquera pas le reaper

`prodWriteGuardResponse` bloque quand `VERCEL_ENV != production`. Deux
vérifications :

- `autoExposeSystemEnvs: true` sur le projet — `VERCEL_ENV` est bien injectée.
- **Preuve empirique, plus forte que la configuration :** `/api/intelligence/ingest/ofac`
  porte le **même** garde et a écrit `success` ce matin même à **01:37:26 UTC**.
  Un garde qui bloquerait la production aurait empêché cette écriture.

---

# 3. QUAND ILS TOURNERONT — ET LA LIMITE DE CETTE MESURE

## ⚠️ Ce que je ne peux pas prouver

**L'API Vercel n'expose aucun champ « prochaine invocation ».** Les définitions
retournées ne portent que `host`, `path`, `schedule`. Trois autres endpoints
essayés (`/v1/crons`, `/v1/projects/…/crons`, `/v1/deployments/…/crons`)
renvoient tous `not_found`.

Les horaires ci-dessous sont donc **calculés** depuis les expressions cron
enregistrées — déterministes et fiables en tant que planification, mais **ce
n'est pas Vercel qui les annonce**. Je ne prétends pas les avoir lus.

Heure de référence : **2026-08-21 12:07:37 UTC**.

| route | schedule | prochaine occurrence (calculée) | dans |
|---|---|---|---|
| `/api/cron/reaper` | `30 2 * * *` | **2026-08-22 02:30:00 UTC** | 14 h 22 |
| `/api/cron/watcher-v2` | `0 6 * * *` | **2026-08-22 06:00:00 UTC** | 17 h 52 |
| `/api/cron/watcher-bridge` | `30 6 * * *` | **2026-08-22 06:30:00 UTC** | 18 h 22 |

**La preuve définitive reste le run de demain** — une fermeture visible dans
`intel_ingestion_batches` et une ligne `ingest.batch.reaped` dans
`intel_audit_log`.

## ⚠️ Correction d'une affirmation de mon rapport précédent

`MERGE_REAPER_2026-08-21.md` affirmait : *« un zombie né cette nuit est clos la
même nuit »*. **C'est vrai pour les 10 zombies existants, incertain pour celui
de cette nuit.** J'avais raisonné sur l'heure *planifiée* de l'ingestion (01:30)
sans mesurer sa **dérive réelle**.

Dérive mesurée des 7 derniers jours (départ réel − heure planifiée) :

| source | dérive min | dérive max |
|---|---|---|
| `ofac` (`0 1`) | 18 min | 41 min |
| `scamsniffer` (`30 1`) | **7 min** | **54 min** |

`scamsniffer` a donc démarré aussi tard que **02:23** (le 08-20) et **01:59**
(ce matin). Si cette nuit il démarre vers 02:24 et que le reaper part à 02:30,
le zombie frais n'aura que ~6 min — **sous le TTL de 900 s, donc épargné**, et
fauché la nuit suivante.

**Ce n'est pas un défaut :** le reaper ne peut pas distinguer « mort il y a une
minute » de « encore vivant ». Le TTL existe exactement pour ne rien toucher
qui pourrait vivre encore. Épargner un zombie de 6 minutes est le comportement
correct ; il sera clos au passage suivant, jamais perdu.

**Conséquence pratique : attends-toi à 10 OU 11 fermetures cette nuit.**

- **10 certaines** — les zombies existants ont de 32 h à 3 356 h, très
  au-delà du TTL. Aucune dérive ne peut les sauver.
- **la 11ᵉ (celle de cette nuit) dépend de l'écart réel** entre le départ de
  `scamsniffer` et celui du reaper.

Si tu veux la capture systématique dès la première nuit, le geste est de
déplacer le reaper plus tard (`0 4 * * *` laisserait ≥ 1 h 36 même dans le pire
cas de dérive mesuré). **Je n'ai rien changé** — c'est un arbitrage à ta main,
et le comportement actuel est sûr dans les deux cas.

---

# 4. CE QUI SE PASSERA CETTE NUIT

1. **~01:00–01:41 UTC** — `ingest/ofac` : réussit en ~10 s, comme les 8 runs
   précédents. Pas de nouveau zombie.
2. **~01:37–02:24 UTC** — `ingest/scamsniffer` : démarre, écrit ~260 000 lignes,
   est **tué à 300 s** par `maxDuration`. Un 11ᵉ zombie naît. *Le reaper ne
   corrige pas ce défaut de fond — il ne fait que le rendre visible.*
3. **~02:30 UTC** — `/api/cron/reaper` : scanne les `running` de plus de 900 s,
   ferme chacun en `TIMED_OUT_WITH_WRITES` ou `TIMED_OUT_UNKNOWN_WRITES`,
   ancre `completedAt` à `startedAt + 300 s`, et **écrit une ligne
   `ingest.batch.reaped` par fermeture** dans `intel_audit_log` — la règle GPT
   est tenue.
4. **06:00 / 06:30 UTC** — `watcher-v2` puis `watcher-bridge`, inchangés.

D'après le dry-run, les 10 zombies existants recevront **tous**
`TIMED_OUT_WITH_WRITES` : les dix ont écrit du contenu avant de mourir.

## Comment vérifier demain

```sql
-- doit renvoyer 0 ligne 'running' (ou 1 si le zombie frais a été épargné)
SELECT status, count(*) FROM intel_ingestion_batches GROUP BY status;

-- la trace exigée : une ligne par fermeture
SELECT "createdAt", "targetId",
       detail->>'writeState'  AS etat_ecriture,
       detail->>'sourceType'  AS type_source,
       detail->>'stuckSeconds' AS duree_bloque,
       detail->>'reason'      AS raison
FROM intel_audit_log
WHERE action = 'ingest.batch.reaped'
ORDER BY "createdAt";
```

---

# 5. PREUVE DE NON-ÉCRITURE

Relu sur `ep-square-band` **après** le déploiement :

```
status    | n  | completedAt non-NULL
running   | 10 | 0
success   | 10 | 10

lignes 'ingest.batch.reaped' au journal : 0
```

**Les 10 zombies sont intacts.** `reapZombieBatches` n'a pas été lancé à la
main, aucune route cron n'a été appelée avec un secret valide, aucun SQL de
fermeture n'a été exécuté. Les seuls accès à la production ont été des
**lectures**. Le cron fauchera cette nuit, seul, avec sa trace d'audit.
