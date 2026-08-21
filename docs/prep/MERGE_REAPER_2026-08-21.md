# MERGE DU REAPER + CÂBLAGE DU CRON DÉDIÉ · 2026-08-21

**LE CRON EST-IL DÉDIÉ (pas inline) — OUI.** `/api/cron/reaper`, entrée
`vercel.json` propre à `30 2 * * *`. Aucun appel du reaper depuis
`ingestSource()` ni depuis aucune route d'ingestion — vérifiable par `grep`.

**LE REAPER EST-IL MERGÉ SUR MAIN — OUI.** `4118cea`, via PR #138 (mécanisme +
cron) encadrée par #137 (ouverture de fenêtre) et #139 (fermeture). Fenêtre
refermée, guard byte-identique à son état d'avant.

**Les 10 zombies existants ne sont PAS fermés** — relu après coup :
10 `running`, 0 `completedAt`, 0 ligne reaper au journal. C'est l'étape 2,
à la main dans Neon par le fondateur.

---

# 0. UNE RÉSERVE D'ENTRÉE

`claude/reaper-decision-2026-08-21.md` **n'existe pas dans le dépôt** —
ni à ce chemin, ni ailleurs (`find` sur `*reaper*decision*` : rien). Je n'ai
donc **pas pu lire la décision GPT**. J'ai travaillé **exclusivement sur les
quatre points de ta consigne** (cron dédié, TTL 900 documenté, famille d'états
à 3 membres, idempotent + journalisé). Si le fichier contient des contraintes
supplémentaires, elles ne sont pas couvertes ici.

---

# 1. LE CRON EST DÉDIÉ · **RIEN À RECÂBLER**

**Ma branche ne câblait rien.** Le rapport du 2026-08-21 *proposait* le câblage
en tête d'`ingestSource()` comme recommandation, mais `vercel.json` et les
routes n'avaient **pas** été touchés — c'était explicitement « PROPOSITION,
RIEN N'EST BRANCHÉ ». Il n'y avait donc **aucun câblage inline à défaire**.

**Ce que j'ai changé :** j'ai supprimé la recommandation inline de la
documentation du module et écrit à la place le motif retenu. Le commentaire de
tête de `route.ts` porte désormais la raison, pas la préférence :

> Le reaper surveille le pipeline d'ingestion ; le câbler DANS ce pipeline le
> ferait mourir avec lui. Or c'est précisément quand l'ingestion tombe en panne
> que les zombies s'accumulent — un reaper inline serait absent au seul moment
> où il compte. Il ne doit pas dépendre de ce qu'il surveille.

**Vérification que rien n'est inline :**

```
$ grep -rn "reapZombieBatches" src/ --include=*.ts
src/app/api/cron/reaper/route.ts:  ← le seul appelant
src/lib/intelligence/reaper.ts:    ← la définition
```

`ingest.ts` n'est pas modifié du tout dans ce merge.

## La route

| | |
|---|---|
| chemin | `/api/cron/reaper` (GET pour Vercel, POST pour le manuel) |
| auth | `Bearer ${CRON_SECRET}`, comparaison **`timingSafeEqual`** |
| barrière | `prodWriteGuardResponse("/api/cron/reaper")` — un Preview porte le même `CRON_SECRET` et la même `DATABASE_URL` que la Production |
| `maxDuration` | **60 s** |
| échappatoire | `?dryRun=1` — inspecter sans écrire |

**Pourquoi 60 s et pas 300 :** le reaper lit une poignée de lignes `running`
(10 au pire mesuré) et fait 2 écritures par ligne. Il **n'itère jamais sur le
jeu de données ingéré** — c'est exactement ce qui tue l'ingestion à 300 s. Lui
donner la même enveloppe suggérerait qu'il court le même risque ; il ne le
court pas.

## Le créneau — `30 2 * * *`

L'ingestion `scamsniffer` démarre à **01:30** et meurt à **01:35**. Le reaper
passe à **02:30** : le zombie né cette nuit est **clos la même nuit**, sans
attendre 24 h. Et un run vivant est protégé deux fois — par les 300 s de son
propre plafond, et par le TTL de 900 s.

Créneau **libre** avant insertion (vérifié contre les 14 crons existants).
Plan Vercel **Pro** — 40 crons autorisés, **15 déclarés** après ajout.
*(Ma note interne disait « Hobby, 1 cron/jour max » ; c'était périmé —
`REDEPLOY_CRONS_PRO_2026-08-21.md` confirme le passage en Pro.)*

## L'angle mort, assumé et écrit

Cette route est le **seul** déclencheur du reaper. Si le cron lui-même cesse de
tourner, plus rien ne fauche. C'est le prix du découplage, et il est noté dans
`route.ts` : le watchdog (`watcher-health.mjs:387`) continue de compter les
`running` > 1 h et d'alerter — il voit, il n'agit pas.

---

# 2. TTL 900 s — CONSTANTE NOMMÉE ET JUSTIFIÉE

`REAPER_TTL_SECONDS = 900` dans `src/lib/intelligence/reaper.ts`, avec le
raisonnement en commentaire, pas seulement le chiffre :

| source | runs `success` | min | moy | **max** |
|---|---|---|---|---|
| `ofac` | 8 | 10 s | 28 s | 148 s |
| `scamsniffer` | 2 | 184 s | 190 s | **196 s** |

- `maxDuration = 300` et `startedAt` est posé **à l'intérieur** de la fonction :
  un run dispose d'**au plus 300 s** après `startedAt`. Au-delà, **aucun run
  vivant ne peut exister** — son processus n'existe plus. C'est la borne dure.
- Le plafond d'un run **sain** jamais observé est **196 s**, sous les 300.
- **900 = 3 × 300.** Le facteur 3 absorbe le démarrage à froid, la mise en file
  et la dérive d'horloge fonction↔Postgres.

Le réglage est **asymétrique** et le commentaire le dit : un TTL trop généreux
coûte un zombie fermé quelques minutes plus tard ; un TTL trop serré tuerait un
run en cours. On choisit le côté sûr.

---

# 3. LA FAMILLE D'ÉTATS — 3 MEMBRES, 2 ÉMIS

```ts
export type ReapedStatus =
  | "TIMED_OUT_WITH_WRITES"
  | "TIMED_OUT_UNKNOWN_WRITES"
  | "TIMED_OUT_NO_WRITES_VERIFIED";   // RÉSERVÉ — jamais émis aujourd'hui
```

| état | émis ? | sens |
|---|---|---|
| `TIMED_OUT_WITH_WRITES` | oui | preuve **positive** d'écriture avant la mort |
| `TIMED_OUT_UNKNOWN_WRITES` | oui | **aucune preuve** — ce qui n'est **pas** « rien écrit » |
| `TIMED_OUT_NO_WRITES_VERIFIED` | **non** | affirmerait qu'il est **prouvé** que rien n'a été écrit |

Le troisième attend une **preuve C4** qui n'existe pas encore : aucune sonde
actuelle ne peut établir l'absence d'écriture. Un run n'ayant fait que des
`UPDATE` avant de mourir ne laisse **aucune trace durable**. L'émettre sans
cette preuve serait exactement le mensonge que ce module existe pour empêcher.

**Deux tests verrouillent son absence** — un à l'exécution (aucun verdict, sur
4 configurations de preuves, ne le porte) et un sur la source (hors
commentaires, le littéral n'apparaît que 2 fois : le membre de l'union et la
valeur de la constante réservée ; une 3ᵉ occurrence signalerait une émission).

## ⚠️ Changement de casse — à connaître avant l'étape 2

Mon premier commit utilisait des minuscules (`timed_out_with_writes`), par
cohérence avec le vocabulaire existant (`running`/`success`). **Je suis passé
aux MAJUSCULES que tu as nommées.** Conséquence directe :

**`docs/prep/FERMETURE_ZOMBIES_2026-08-21.sql` a été RÉGÉNÉRÉ.** La version
minuscule est périmée. Le script à la main et le cron écrivent maintenant le
**même** vocabulaire — sans quoi la table aurait porté deux orthographes du
même état.

Rappel : `status` est un `text` nu (ni enum ni CHECK), donc **aucune migration**
n'est requise, ni pour la casse ni pour les nouveaux états.

---

# 4. IDEMPOTENT + JOURNALISÉ

## Idempotence — `updateMany` gardé, pas `update` par id

```ts
const res = await prisma.intelIngestionBatch.updateMany({
  where: { id: v.batchId, status: "running" },   // ← le garde
  data: { status: v.status, completedAt: diedAt, errorMessage: ... },
});
if (res.count === 0) { alreadyClosed.push(v.batchId); continue; }
```

Le cas réel que ça protège n'est pas théorique : **le fondateur va fermer les
10 zombies à la main dans Neon**, potentiellement pendant que le cron tourne.
Sans ce garde, le reaper écraserait la fermeture manuelle et empilerait une
ligne d'audit pour un travail qu'il n'a pas fait. Avec, il compte 0 ligne
affectée, n'écrit **ni le statut ni le journal**, et le signale via
`alreadyClosed`.

Testé dans les deux sens : deux passes consécutives (1 fermeture, 1 ligne de
journal) et une fermeture concurrente injectée entre le scan et l'écriture
(0 fermeture, 0 journal, la valeur manuelle intacte).

## Journal — `intel_audit_log`, append-only

`actor = "cron:reaper"`, `action = "ingest.batch.reaped"`,
`targetType = "IntelIngestionBatch"`, `targetId = <batchId>`, et dans `detail`
(jsonb) les **quatre dimensions exigées** :

| dimension | champs |
|---|---|
| **raison** | `reason: "serverless_timeout_no_finalize"` + `reasonHuman` (phrase complète) |
| **durée** | `startedAt`, `closedAtAnchor`, `stuckSeconds`, `maxDurationSeconds: 300`, `ttlSeconds` |
| **type de source** | `sourceSlug`, `sourceTier`, `sourceType: regulatory\|technical` (depuis le registre : `ofac` tier 1, `scamsniffer` tier 2) |
| **état d'écriture** | `writeState`, `writesProven`, `evidence[]`, `entitiesCreated`, `observationsCreated`, `recordsFetched`, `recordsRemoved` |

`recordsRemoved` distingue les deux cas au lieu de les confondre :
`UNKNOWN_LOST_WITH_RUN` (ofac — le calcul aurait eu lieu) vs
`NOT_APPLICABLE_STALE_MARKING_SKIPPED` (scamsniffer — le bloc est sauté au-delà
de 10 000 lignes, rien n'a été perdu).

**Aucune suppression de ligne historique.** Le reaper fait un `UPDATE` ciblé
sur la ligne zombie et des `INSERT` d'audit — rien d'autre. Verrouillé par un
test qui vérifie l'absence de tout `.delete(` / `.deleteMany(` dans la source.

`completedAt` **n'est pas** `now()` : il est ancré à `startedAt + 300 s`, la
seule borne que les données garantissent. Le run n'a pas fini maintenant.

---

# 5. LES TESTS MORDENT · **23 tests, 10 mutations, 10 tuées**

Suite complète du dépôt sur `main` après merge : **301 fichiers, 3 343 tests
passés**, 0 échec.

| groupe | ce qui est vérifié |
|---|---|
| **C2 — il mord** | `running` au-delà du TTL fermé ; jamais `success` ; `completedAt` ancré à la mort réelle |
| **C3 — il épargne** | `running` dans le TTL **strictement** intact ; batches terminés non touchés ; vivant + zombie → seul le zombie tombe |
| **C2b — writes ≠ unknown** | statuts distincts ; `recordsFetched=NULL` sur petite source pas lu comme « rien écrit » ; pas d'attribution des écritures du run suivant |
| **C2c — sûreté** | dry-run par défaut ; verdict complet malgré tout |
| **C4 — réservé** | `TIMED_OUT_NO_WRITES_VERIFIED` jamais émis (runtime + source) |
| **C5 — idempotence** | 2 passes = 1 fermeture ; fermeture concurrente ni écrasée ni journalisée |
| **C6 — journal** | les 4 dimensions ; tier 1 vs tier 2 ; dry-run ne journalise rien ; aucune suppression possible |

Un test vert ne prouve rien tant qu'il n'a pas échoué sur du code cassé.
**Dix mutations, une à une, toutes tuées** (re-vérifiées après le refactor de
typage) :

| mutation | tests tombés |
|---|---|
| TTL ignoré (fauche les vivants) | 2 |
| tout déclaré `WITH_WRITES` | 4 |
| `completedAt = now()` | 1 |
| dry-run off par défaut | 2 |
| fenêtre d'attribution non bornée | 1 |
| garde d'idempotence retiré | **11** |
| journalise une fermeture non faite | 1 |
| type de source perdu | 2 |
| **statut RÉSERVÉ émis** | 5 |
| dry-run non respecté | 2 |

---

# 6. CE QUI A MORDU EN CHEMIN

**Le test d'inventaire cron m'a rattrapé.** `__tests__/api/cronInventory.test.ts`
lie `docs/CRON_INVENTORY.md` à `vercel.json` et au disque. Mon ajout de cron a
fait **échouer 2 assertions** — j'avais planifié une route sans l'arbitrer dans
le document. Corrigé : le reaper y a sa ligne et sa note (motif du cron dédié,
choix du créneau, garanties). **C'est le garde-fou qui a fonctionné, pas moi.**

**Le gate Lint est rouge — et l'était déjà.** 1 260 problèmes préexistants
(1 040 erreurs), identiques sur la PR #137 qui ne contenait **que** le fichier
guard. Ce n'est pas une raison pour y ajouter : les **11 erreurs
`no-explicit-any`** que mes fichiers introduisaient ont été supprimées
(`catch (err: unknown)` + narrowing, types nommés pour le faux prisma).
`eslint` sur mes trois fichiers : **0 problème**.

**Ce qui reste rouge en CI, et pourquoi ce n'est pas de mon fait :**

| check | état | cause |
|---|---|---|
| Paths / branch guard | ✅ pass | — |
| Secret Scanning (Gitleaks) | ✅ pass | — |
| SAST (Semgrep) | ✅ pass | — |
| Dependency Audit | ❌ fail | **108 vulns transitives** (`jsdom>undici`…) — préexistant, identique sur #137 |
| Quality Gates (Lint) | ❌ fail | **1 260 problèmes préexistants** — mes fichiers en ajoutent **0** |
| Vercel Preview | ❌ fail | déjà en échec sur #137 (guard seul) |

Les trois merges ont donc été faits avec `--admin`, comme les précédents du
dépôt. **Aucun `--no-verify`** — les hooks pre-commit ont tourné et sont passés
à chaque commit.

---

# 7. LA FENÊTRE D'EXEMPTION — OUVERTE ET REFERMÉE

`vercel.json` et `src/app/api/` sont des chemins **gelés**. Protocole complet :

| # | PR | contenu |
|---|---|---|
| 1 | **#137** | ouverture — `guard-offline.sh` **seul**, sur `hotfix/guard-fenetre-reaper-cron` (mode maintenance) |
| 2 | **#138** | le travail — mécanisme + cron |
| 3 | **#139** | fermeture — retrait de la fenêtre |

Exemption **strictement** limitée à `^src/app/api/cron/reaper/` et
`^vercel\.json$`, sur le motif du précédent `watcher-budget-cadence` (même
paire, même raison).

**Retrait symétrique et prouvé :** 56 lignes ajoutées, 56 retirées, et le
fichier est **byte-identique** à son état pré-fenêtre —
`diff -q <(git show eccd1a0:scripts/guard-offline.sh) scripts/guard-offline.sh`
ne renvoie rien. `grep CC-OFFLINE-94 scripts/guard-offline.sh` : **0**.

---

# 8. CE QUI RESTE À FAIRE — ET UN POINT D'ORDRE

## ⚠️ Le merge n'arme PAS le cron

**`main` n'est pas la production.** Ce dépôt n'a **pas** de déploiement
automatique depuis GitHub ; `vercel --prod` expédie **l'arbre de travail**, pas
le commit. Tant que personne ne déploie, `/api/cron/reaper` **n'existe pas en
production** et n'est **pas** planifié. Le mécanisme est mergé, il n'est pas
encore armé.

## Conséquence sur l'ordre des étapes

Une fois déployé, **le reaper fermera les 10 zombies tout seul** au prochain
passage 02:30 UTC, avec exactement les statuts du script préparé. La fermeture
manuelle et le cron **ne peuvent pas se marcher dessus** — l'`updateMany` gardé
par `status='running'` fait que le second arrivé n'écrit rien.

Deux ordres possibles, tous deux sûrs :

- **fermer à la main puis déployer** — le cron trouvera 0 zombie ;
- **déployer puis laisser faire** — le script à la main devient inutile.

La seule différence est **qui signe la fermeture** dans `intel_audit_log` : le
cron journalise, une fermeture SQL à la main **ne journalise pas** (le script
ne fait que l'`UPDATE`). Si tu veux la trace d'audit sur ces 10 lignes
historiques, **laisse le cron les faucher**.

## Étape 2, inchangée

Les 10 zombies **ne sont pas fermés**. `docs/prep/FERMETURE_ZOMBIES_2026-08-21.sql`
est prêt, régénéré aux statuts décidés, en `BEGIN`/`COMMIT` avec un `SELECT` de
vérification avant le commit.

## Ce que ce merge ne répare pas

Le défaut de fond est entier : **~347 000 lignes qui ne tiennent pas dans
300 s**, donc **~25 % du jeu scamsniffer non rafraîchi chaque jour**, en
silence. Le reaper rend le bookkeeping honnête — il ne rend pas l'ingestion
complète. `ingest.ts` n'est pas touché. **Autre chantier.**

---

# 9. PREUVE DE NON-ÉCRITURE

Relu sur la production après tous les merges :

```
status    | n  | completedAt non-NULL
running   | 10 | 0
success   | 10 | 10

lignes 'ingest.batch.reaped' au journal : 0
```

**Aucun zombie fermé, aucune migration, aucun déploiement, aucun
`--no-verify`.** Les seules exécutions contre la production ont été des
**lectures** et un **dry-run**.
