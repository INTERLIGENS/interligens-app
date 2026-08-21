# LE REAPER ZOMBIES — conception, code, préparation de fermeture · 2026-08-21

1. **LA COLONNE `status` ACCEPTE-T-ELLE LES NOUVEAUX STATUTS — OUI.** `text`
   nu, sans enum, sans CHECK. Seule contrainte de la table : `PRIMARY KEY (id)`.
   **Aucune migration requise.**
2. **LE REAPER DISTINGUE-T-IL WRITES / NO-WRITES — OUI**, sur trois sondes à
   trace durable, et il refuse d'affirmer l'absence d'écriture (voir §3).
3. **COMBIEN DES 10 ZOMBIES ONT ÉCRIT DU CONTENU — 10.** Les dix. Écritures
   prouvées ligne à ligne, aucun n'est un fantôme sans effet.

**Branche `feat/reaper-zombies-batches`. Aucune migration, aucune fermeture,
aucun merge, aucun déploiement. La seule exécution en production a été un
dry-run en LECTURE — état vérifié inchangé après coup (§6).**

---

# 0. SCHEMA INTEGRITY · **VERIFIED**

## `status` : `text` nu — pas d'enum, pas de CHECK

```
column_name | data_type | udt_name | is_nullable | column_default
status      | text      | text     | NO          | (aucun)

contraintes de intel_ingestion_batches :
  intel_ingestion_batches_pkey | p | PRIMARY KEY (id)     ← la seule
```

`pg_type.typtype = 'b'` (type de base) et `pg_enum` vide pour cette colonne :
ce n'est pas un enum. Aucune contrainte `contype='c'` : aucun CHECK. **On peut
donc y écrire `timed_out_with_writes` sans migration.** C'est la réponse à la
question posée — mais elle a un revers, ci-dessous.

## Prisma vs DB réel — aucune dérive de type

Les 12 colonnes correspondent exactement. Classement : **12/12 EXPECTED**.

| Prisma | DB réel | verdict |
|---|---|---|
| `id String @id @default(cuid())` | `text NOT NULL`, pas de default DB | **EXPECTED** — `cuid()` est généré côté client Prisma, pas par Postgres |
| `sourceSlug String` | `text NOT NULL` | EXPECTED |
| `startedAt DateTime` | `timestamp without time zone NOT NULL` | EXPECTED |
| `completedAt DateTime?` | `timestamp` nullable | EXPECTED |
| `status String` | `text NOT NULL` | EXPECTED |
| `recordsFetched/New/Updated/Removed Int?` | `int4` nullable | EXPECTED (×4) |
| `errorMessage String?` | `text` nullable | EXPECTED |
| `triggeredBy String?` | `text` nullable | EXPECTED |
| `createdAt DateTime @default(now())` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` | EXPECTED |

**Rien à voir avec le cas `detectedTokens`** (typé `String` en Prisma, `jsonb`
en base). Ici Prisma dit la vérité sur les types.

## En revanche, une divergence de CONTRAT — classée **LEGACY**

`schema.prod.prisma:1114` porte le commentaire :

```prisma
// "running"|"success"|"partial"|"failed"
status         String
```

Ce commentaire **annonce un ensemble fermé de 4 valeurs que rien n'applique** :
ni enum, ni CHECK, ni validation applicative. Et les valeurs réellement
présentes en base sont **deux, pas quatre** :

| status | n | première | dernière |
|---|---|---|---|
| `running` | 10 | 2026-04-03 | 2026-08-21 |
| `success` | 10 | 2026-04-03 | 2026-08-21 |

**`partial` et `failed` n'ont JAMAIS été écrits.** Le `catch` d'`ingest.ts`
(l.202-206), seul producteur de ces deux statuts, **ne s'est jamais exécuté en
production** — ce qui est cohérent avec le mécanisme du défaut : la mort par
timeout n'est pas une exception JavaScript, elle ne déclenche aucun `catch`.

**Classement LEGACY** : le commentaire documente une intention de 2026-04, pas
l'état du système. La liberté qui nous arrange (§1 : pas de migration) est
exactement la même absence de contrainte qui a laissé le vocabulaire dériver.
**Ajouter deux statuts sans migration est un avantage aujourd'hui et une dette
demain** — un CHECK sur les 6 valeurs deviendra souhaitable une fois le
vocabulaire stabilisé. Non fait ici : ce serait une migration, hors mandat.

## Un point de fragilité latente relevé au passage — **BUG (latent)**

`ingest.ts` (bulkUpsert, l.253-258) écrit en SQL brut :

```sql
"lastSeenAt" = '${nowISO}'::timestamptz
```

…dans une colonne `lastSeenAt` de type **`timestamp WITHOUT time zone`** (les
10 colonnes horodatées de `intel_canonical_entities` /
`intel_source_observations` sont toutes `without time zone`). Le rabattement
`timestamptz → timestamp` **dépend de `TimeZone` de la session**. Mesuré :
`SHOW TimeZone` = **`GMT`** → décalage nul, **les valeurs stockées sont
correctes aujourd'hui**. Vérifié par recoupement indépendant : le cron ofac
(`0 1 * * *`) a bien déposé les littéraux `01:29:42`, `01:37:26`, `01:41:08`.

Mais la correction repose sur un réglage de session, pas sur le code. Si
`TimeZone` passait à `Europe/Paris`, les colonnes écrites par le chemin bulk
dériveraient de 2 h tandis que celles écrites par Prisma resteraient en UTC —
une corruption silencieuse et partielle. **Hors périmètre du reaper, signalé,
non corrigé.**

*Note de méthode : le client `pg` brut restitue ces colonnes en heure locale et
les décale de −2 h à l'affichage. Toutes les mesures temporelles de ce rapport
sont calculées **côté serveur** (`EXTRACT`, `to_char`) ou lues via Prisma, donc
insensibles à cet artefact.*

---

# 1. LE REAPER — `src/lib/intelligence/reaper.ts`

## Le mécanisme du défaut · **VERIFIED**, avec le chiffre exact

`src/app/api/intelligence/ingest/[slug]/route.ts:12` déclare :

```ts
export const maxDuration = 300; // 5 minutes
```

`startedAt` étant posé **à l'intérieur** de la fonction, un run dispose d'**au
plus 300 s** après `startedAt`. Passé ce délai la fonction est **tuée**. Un
kill n'est pas une exception : ni la finalisation `success` (l.164) ni le
`catch` (l.202) ne s'exécutent, et il n'y a **aucun `finally`**. Le batch reste
`running` indéfiniment.

**Le chiffre 300 n'est pas qu'une déclaration — il se lit dans les données.**
Dernière écriture observée, mesurée côté serveur sur les deux zombies dont les
traces n'ont pas encore été écrasées :

| batch | dernière écriture après `startedAt` |
|---|---|
| `cmt0wc5ag…` (08-20) | **300 s** |
| `cmt2awuom…` (08-21) | **299 s / 300 s** |

Les runs meurent **exactement au plafond serverless**. C'est la confirmation
empirique du mécanisme, et cela **clôt l'UNKNOWN n°2** du diagnostic du
2026-08-21 (`maxDuration` « non relevé »).

## Le TTL proposé : **900 s (15 min)** — `REAPER_TTL_SECONDS`

Justifié par la durée des runs **sains**, mesurée, et non par intuition :

| source | runs `success` | min | moy | max |
|---|---|---|---|---|
| `ofac` | 8 | 10 s | 28 s | 148 s |
| `scamsniffer` | 2 | 184 s | 190 s | **196 s** |

Le plafond d'un run sain jamais observé au-delà de **196 s**, et la borne dure
est **300 s** : au-delà de 300 s, **aucun run vivant ne peut exister**, son
processus n'existe plus. La borne de sûreté stricte serait donc 300 s.

**900 s = 3 × maxDuration.** Le facteur 3 absorbe le démarrage à froid, la mise
en file et la dérive d'horloge entre la fonction et Postgres. Il ne peut pas
faucher un run vivant, puisqu'il n'en existe aucun au-delà de 300 s. Le coût
d'un TTL généreux est nul (un zombie fermé 10 min plus tard reste fermé) ; le
coût d'un TTL trop serré serait de tuer un run en cours. Le réglage est
asymétrique, on choisit le côté sûr.

## Ce que le reaper écrit — et ce qu'il refuse d'écrire

Deux statuts, en minuscules pour rester cohérent avec le vocabulaire existant
(`running`/`success`/`partial`/`failed`) :

| statut | signification |
|---|---|
| `timed_out_with_writes` | **preuve positive** que le run a écrit avant sa mort |
| `timed_out_unknown_writes` | **aucune preuve** d'écriture — ce qui n'est pas « rien écrit » |

**Il n'existe volontairement PAS de statut `timed_out_no_writes`.** Un run qui
n'aurait fait que des `UPDATE` sur des lignes existantes et serait mort avant
le premier jalon de progression ne laisse **aucune trace durable
attribuable**. L'absence de preuve n'est pas la preuve de l'absence, et le
statut le dit. C'est un écart assumé à la formulation initiale (« n'a rien
écrit → failed / timed_out ») : le nom `no_writes` affirmerait un fait que les
données ne portent pas.

Aucun zombie ne reçoit jamais `success`. `completedAt` **n'est pas posé à
`now()`** — le run n'a pas fini maintenant, il est mort il y a longtemps : il
est ancré à `startedAt + 300 s`, la seule borne que les données garantissent.

## Les sondes — et le piège qu'elles évitent

Une sonde n'est retenue que si sa trace est **durable**, c'est-à-dire non
réécrite par les runs suivants.

| sonde | colonne | retenue ? |
|---|---|---|
| A | `recordsFetched > 0` | **OUI** — le jalon (l.309) n'est écrit qu'après commit d'un chunk ; figé à la mort du run |
| B | `intel_source_observations.ingestedAt` | **OUI** — posé par `DEFAULT now()` à l'INSERT, jamais touché par le `ON CONFLICT DO UPDATE` |
| C | `intel_canonical_entities.createdAt` | **OUI** — même raison |
| — | `lastSeenAt` / `updatedAt` / `lastVerifiedAt` | **REJETÉES** — réécrites par chaque run ultérieur |

Le rejet des trois dernières n'est pas théorique. **Mesuré :** le zombie du
08-20 ne « portait » plus que **3 612** entités au 08-21, le run suivant ayant
repris les ~260 000 autres. Une sonde qui s'efface transforme, avec le temps,
un zombie ayant écrit en zombie « sans écriture » : **elle ferait mentir le
reaper**, et d'autant plus qu'on l'interroge tard.

**Le piège `recordsFetched IS NULL`** — et c'est la correction principale au
diagnostic précédent. Le jalon de progression ne se déclenche qu'à
`processed % 5000 < 500` : **une source de moins de 5 000 lignes ne l'atteint
jamais**. Les 2 zombies `ofac` (864 lignes) ont `recordsFetched = NULL` **et
ont pourtant écrit 225 et 372 observations**. `NULL` y signifie « source trop
petite pour le jalon », **pas** « rien écrit ». Un reaper qui aurait utilisé
`recordsFetched` seul comme discriminant les aurait classés à tort.

**Fenêtre d'attribution** — les écritures ne sont comptées que jusqu'au
démarrage du batch **suivant de la même source** (borne haute :
`startedAt + 300 s + 120 s`). Sans cette borne, un zombie s'attribuerait les
écritures du lendemain et **tout** batch deviendrait `with_writes`. Le cas
n'est pas théorique : les 2 zombies `ofac` d'avril ne sont séparés que de
**136 s**, bien à l'intérieur de la fenêtre dure.

## Où le reaper doit tourner — **PROPOSITION, RIEN N'EST BRANCHÉ**

`vercel.json` n'a pas été touché, aucune route n'appelle le reaper.

**Recommandation : en tête d'`ingestSource()`, pas dans un cron dédié.**

- **Pourquoi pas un cron dédié :** le plan Vercel est **Hobby** — cron
  plafonné à 1×/jour. Un 15ᵉ cron ajouterait une surface de déploiement et une
  authentification pour un travail qui dure quelques millisecondes.
- **Pourquoi en tête d'ingestion :** c'est exactement le moment où la propreté
  compte, le zombie de la veille est fermé juste avant que le run du jour
  n'ouvre son propre batch, et **aucune entrée `vercel.json` n'est requise**.
- **Angle mort assumé :** si l'ingestion cesse complètement de tourner, plus
  rien ne fauche. Il est couvert par le watchdog, qui **compte déjà** les
  `running` > 1 h (`watcher-health.mjs:387`, `severity: warn`) sans les
  fermer — il continuerait d'alerter.

**Second choix** si le fondateur préfère la séparation des responsabilités :
un appel depuis un cron quotidien **existant** (`/api/cron/daily-flow`).

`reapZombieBatches()` est **dry-run par défaut** : l'appeler sans argument
n'écrit rien. L'écriture doit être demandée (`{ dryRun: false }`), jamais
subie.

---

# 2. LES 10 ZOMBIES — évaluation et fermeture préparée · **NON EXÉCUTÉE**

Verdicts produits par le **vrai reaper en dry-run contre la production**
(lecture seule), pas par un raisonnement à la main.

| # | id | source | `startedAt` (UTC) | âge | statut proposé | `recordsFetched` | entités créées | obs. créées | `recordsRemoved` |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `cmnj0eg6d…` | ofac | 2026-04-03 14:38 | 3356 h | `timed_out_with_writes` | NULL | 225 | 225 | **UNKNOWN** |
| 2 | `cmnj0hdk5…` | ofac | 2026-04-03 14:41 | 3356 h | `timed_out_with_writes` | NULL | 372 | 372 | **UNKNOWN** |
| 3 | `cmnj0ypdn…` | scamsniffer | 2026-04-03 14:54 | 3356 h | `timed_out_with_writes` | NULL | 1 000 | 1 000 | N/A |
| 4 | `cmstr5a4c…` | scamsniffer | 2026-08-15 02:23 | 152.6 h | `timed_out_with_writes` | 235 000 | 6 228 | 6 228 | N/A |
| 5 | `cmsv5mf2d…` | scamsniffer | 2026-08-16 01:56 | 129.1 h | `timed_out_with_writes` | 260 000 | 148 | 148 | N/A |
| 6 | `cmswkd8h5…` | scamsniffer | 2026-08-17 01:37 | 105.4 h | `timed_out_with_writes` | 245 000 | 84 | 84 | N/A |
| 7 | `cmsxzt351…` | scamsniffer | 2026-08-18 01:37 | 81.4 h | `timed_out_with_writes` | 260 000 | 204 | 204 | N/A |
| 8 | `cmszf8y3c…` | scamsniffer | 2026-08-19 01:37 | 57.4 h | `timed_out_with_writes` | 260 000 | 89 | 89 | N/A |
| 9 | `cmt0wc5ag…` | scamsniffer | 2026-08-20 02:23 | 32.6 h | `timed_out_with_writes` | 265 000 | 95 | 95 | N/A |
| 10 | `cmt2awuom…` | scamsniffer | 2026-08-21 01:59 | 9.0 h | `timed_out_with_writes` | 260 000 | 112 | 112 | N/A |

**Les 10 ont écrit. Aucun ne reçoit `unknown_writes`.** Aucun n'est un fantôme.

**Script de fermeture prêt, NON LANCÉ :
`docs/prep/FERMETURE_ZOMBIES_2026-08-21.sql`** — un `UPDATE` par batch, chacun
précédé de sa justification en commentaire, chacun gardé par
`AND status = 'running'` (rejouable sans risque, sans effet si déjà fermé).

## Deux corrections au diagnostic du 2026-08-21

1. **« tous `recordsFetched=NULL` » — FAUX.** **7 des 10** portent 235 000 à
   265 000. Seuls les 3 d'avril sont à NULL, et pour la raison expliquée
   (§1, jalon des 5 000).
2. **« 3 batches du 2026-04-03, source non identifiée » — IDENTIFIÉE :
   2 `ofac` + 1 `scamsniffer`.** La répartition « 7 scamsniffer + 3 vieux »
   est donc en réalité **8 scamsniffer + 2 ofac**. (Le commentaire de
   `watcher-health.mjs:380` l'indiquait déjà correctement.)

## `recordsRemoved` : perdu, ou jamais calculé ?

La distinction est tranchée par le code, `ingest.ts` l.144 :

```ts
if (unique.length < 10000) {   // marquage des observations périmées
```

- **`scamsniffer` (8 zombies) → N/A, rien n'a été perdu.** Le jeu fait
  ~347 000 lignes, le bloc est **sauté**. `recordsRemoved` n'a jamais été
  calculé pour cette source, **y compris sur les runs `success`** — vérifié :
  les 2 runs scamsniffer réussis d'avril portent `recordsRemoved = 0`, et
  `intel_source_observations` ne compte **0** ligne `removedAt`/inactive pour
  scamsniffer. **Ce n'est pas une perte du timeout, c'est une lacune de
  conception**, préexistante et distincte.
- **`ofac` (2 zombies) → UNKNOWN, réellement perdu.** 864 lignes < 10 000 : le
  bloc **se serait exécuté**. La valeur est **non reconstituable
  rétroactivement** — `removedAt` n'ayant jamais été posé par ces runs, rien
  ne subsiste à compter. Ordre de grandeur plausible : 0 ou 1 (la table ofac
  ne porte **1** seule observation retirée sur toute son histoire), mais
  **plausible n'est pas mesuré : UNKNOWN par batch.**

## Ce que la fermeture ne répare pas

Les zombies scamsniffer meurent à ~**260 000 / ~347 000** lignes traitées, soit
une couverture d'environ **75 %**. **Environ un quart du jeu scamsniffer n'est
pas rafraîchi chaque jour**, et le batch ne l'a jamais signalé. Fermer les
lignes rend le bookkeeping honnête ; **cela ne rend pas l'ingestion complète.**
Le défaut de fond — un run de 347 000 lignes qui ne tient pas dans 300 s —
reste entier et **n'est pas dans le mandat du reaper**.

---

# 3. LES TESTS — `__tests__/security/reaper-zombie-batches.test.ts`

**15 tests, 15 passés.** Suite complète du dépôt : **301 fichiers, 3 334 tests
passés, 0 échec** — aucune régression.

| groupe | ce qui est vérifié |
|---|---|
| **C2 — il mord** | un `running` au-delà du TTL est fermé ; jamais en `success` ; `completedAt` ancré à `startedAt+300 s`, **pas** à l'heure du reaper |
| **C3 — il épargne** | un `running` dans le TTL est laissé **strictement** intact (statut, `completedAt`, `errorMessage`) ; les batches déjà terminés ne sont pas touchés ; vivant + zombie ensemble → **seul le zombie tombe** |
| **C2b — writes ≠ no-writes** | statuts **distincts** ; `recordsFetched=NULL` sur petite source **n'est pas** lu comme « rien écrit » (cas ofac réel, 225 obs.) ; les écritures du run **suivant** ne sont pas attribuées au zombie |
| **C2c — sûreté** | dry-run est le **défaut** ; le dry-run rend malgré tout le verdict complet |

## Les tests mordent-ils vraiment ? — vérifié par mutation

Un test vert ne prouve rien tant qu'il n'a pas échoué sur du code cassé. **Cinq
mutations introduites dans le reaper, une à une :**

| mutation | résultat |
|---|---|
| TTL ignoré (fauche les vivants) | **2 échecs** ✅ |
| tout déclaré `with_writes` | **3 échecs** ✅ |
| `completedAt = now()` | **1 échec** ✅ |
| dry-run désactivé par défaut | **1 échec** ✅ |
| fenêtre d'attribution non bornée | **0 échec** ❌ → **test corrigé, puis 1 échec** ✅ |

La cinquième mutation **n'a d'abord tué aucun test** : mon test
d'anti-attribution plaçait le batch suivant à 24 h, déjà exclu par la borne
dure — il ne testait donc pas la borne « batch suivant ». Réécrit sur le cas
réel des 2 zombies ofac (**136 s** d'écart), il échoue désormais correctement
sous mutation. **Les 5 mutations sont tuées, code restauré, 15/15 au vert.**

---

# 4. CE QUI RESTE UNKNOWN

1. **`recordsRemoved` des 2 zombies `ofac`** — définitivement non
   reconstituable (§2). Plausible 0 ou 1, non mesurable.
2. **La couverture quotidienne exacte de scamsniffer.** Le plancher est
   solide (≥ 260 000 traitées, jalon des 5 000 près), mais la **taille du jeu
   servi chaque jour** n'est pas enregistrée : les ~347 000 viennent des runs
   d'avril. Le ratio ~75 % est donc un ordre de grandeur, pas une mesure.
3. **Ce qui a écrit les 3 zombies d'avril.** `triggeredBy = 'admin:cron'` mais
   déposés à 14:38/14:41/14:54 UTC, hors des créneaux cron (`0 1`, `30 1`), et
   voisins de runs `local-test` / `manual:dood`. Session de mise au point
   probable — **non tranché**, sans incidence sur le verdict (ils ont écrit,
   ils sont morts).
4. **Le déclencheur du 15 août** — non instruit ici, hors mandat. Le
   commit `bba3e6e` (2026-08-14) reste le suspect du diagnostic précédent,
   toujours non prouvé.
5. **La mort exacte des zombies 4 à 8** (08-15 → 08-19). Le plafond de 300 s
   est mesuré sur les zombies 9 et 10 ; pour les précédents, les traces
   `lastVerifiedAt` ont été **écrasées** par les runs suivants. Le mécanisme
   est le même et `recordsFetched` y est cohérent, mais **l'instant de mort
   n'est pas re-mesurable** pour ces cinq-là.

---

# 5. FICHIERS DE LA BRANCHE

| fichier | rôle |
|---|---|
| `src/lib/intelligence/reaper.ts` | le reaper — dry-run par défaut, **non branché** |
| `__tests__/security/reaper-zombie-batches.test.ts` | 15 tests C2/C3, vérifiés par mutation |
| `docs/prep/FERMETURE_ZOMBIES_2026-08-21.sql` | fermeture des 10 zombies — **non lancée** |
| `docs/prep/REAPER_ZOMBIES_2026-08-21.md` | ce rapport |

**Non touchés :** `vercel.json`, `prisma/schema.prod.prisma`, `ingest.ts`,
toute route. Aucun appel au reaper n'existe dans le code de production.

---

# 6. PREUVE DE NON-ÉCRITURE

Le dry-run a bien tourné **contre la production** (c'est ainsi que les 10
verdicts ont été produits). État de la table relu **après** :

```
status    | n  | completedAt non-NULL | errorMessage non-NULL
running   | 10 | 0                    | 0
success   | 10 | 10                   | 0
```

**Les 10 zombies sont toujours `running`, sans `completedAt`, sans
`errorMessage`.** Aucune migration lancée, aucun zombie fermé, aucun merge,
aucun déploiement.
