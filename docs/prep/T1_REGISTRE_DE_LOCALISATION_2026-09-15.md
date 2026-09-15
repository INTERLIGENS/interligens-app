# T1-REGISTRE-DE-LOCALISATION — 2026-09-15

> **An evidence object's storage key does not establish its storage compartment.
> Storage location requires its own governed authority.**

Branche : `feat/cc-offline-190-registre-localisation`, depuis `origin/main` = `c451ad5`.

**Aucun DDL posé. Aucune écriture de production. Aucun octet déplacé. Aucun déploiement.**
Rien de `package.json`, `scripts/preflight/` ni `.vercelignore` n'est touché (T2 y travaille).

---

## 1 · Le DDL, et les trois points de conception tranchés

`docs/prep/MIGRATION_STORAGE_LOCATION_JOURNAL_2026-09-15.sql` — table
`evidence_storage_location_journal`, append-only, deux triggers, `23001` sur UPDATE,
DELETE et TRUNCATE. Même motif que `evidence_provenance_journal`, avec une fonction
**propre à cette table** : le message nomme la table, et retirer l'une ne désarme pas
les autres.

| colonne | | |
|---|---|---|
| `id` | `BIGINT GENERATED ALWAYS AS IDENTITY` PK | l'ordre, et la **seule** autorité d'ordre |
| `evidence_item_id` | `TEXT NOT NULL` → FK | l'identité de la pièce |
| `bucket` | `TEXT NOT NULL` + CHECK nommage R2 | **le compartiment** |
| `storage_key` | `TEXT NOT NULL` + CHECK de forme | la clé telle qu'établie par cet événement |
| `establishment_mode` | `TEXT NOT NULL` + CHECK énuméré | `DECLARED_AT_WRITE` \| `VERIFIED_BY_HEAD` |
| `declared_by` / `declared_at` | `NOT NULL`, **sans DEFAULT** | l'autorité, et sa date |
| `observed_by` / `observed_at` | nullables, liés par CHECK | qui a mesuré, quand |
| `recorded_at` | `NOT NULL DEFAULT now()` | documente, **n'ordonne pas** |

### 1.a — La FK : vers quoi, exactement ? → `"EvidenceItem"(id)`

Quatre cibles étaient concevables. Elles ont été **mesurées**.

- **`"EvidenceItem"(id)` — RETENUE.** C'est l'objet dont on cherche les octets : il porte
  `r2Key`, il porte `tsaToken`, c'est lui que `tsaPendingUniverseSql()` sélectionne et lui
  que `resoudreLocalisation` reçoit. Journaliser ailleurs créerait un saut d'identité au
  milieu du chemin.
- **`governed_objects(id)` — ÉCARTÉE**, et c'était le candidat sérieux : elle porte déjà
  `(bucket, storage_key)` avec un index unique. Mesure : **1 ligne** (`CASEFILE_RENDER`),
  **aucune** colonne ni FK vers `EvidenceItem`, et `bucket` y est une colonne **mutable
  sans trigger** — elle retomberait sous l'objection même qui écarte l'option A. L'y
  rattacher exigerait d'abord d'y inscrire 1 103 objets, c'est-à-dire un backfill depuis
  un compartiment deviné. NO-GO.
- **`"EvidenceSnapshot"(id)` — ÉCARTÉE.** C'est la cible du journal de *provenance* : une
  autre identité, l'observation, qui ne porte pas `r2Key`.
- **le `sha256` — ÉCARTÉE**, et l'argument est ici plus fort qu'ailleurs : un hash identifie
  des **octets**, or la question est *dans quel compartiment* ils sont. Des octets
  identiques peuvent vivre dans deux compartiments — c'est même le cas `PRESENT_AUX_DEUX`
  que la mesure doit savoir rapporter. Le `sha256` n'apparaît donc **pas du tout** dans la
  table, même comme attribut.

`ON UPDATE RESTRICT ON DELETE RESTRICT` — volontairement **plus dur** que les deux FK
existantes vers `EvidenceItem`, qui sont en CASCADE. Un lien de dossier peut disparaître
avec la pièce ; l'historique de l'endroit où vivaient ses octets, non : c'est exactement ce
qu'on consulterait pour savoir ce qui a été supprimé.

### 1.b — `VERIFIED_BY_HEAD` doit porter plus, et il le porte

`observed_by` et `observed_at` sont non nuls **si et seulement si**
`establishment_mode = 'VERIFIED_BY_HEAD'`. Un CHECK, **dans les deux sens**.

Pourquoi : `DECLARED_AT_WRITE` est une assertion *contemporaine* de l'écriture, par
l'écrivain — l'acte et sa déclaration sont le même événement, `declared_by`/`declared_at`
suffisent. `VERIFIED_BY_HEAD` est une **mesure**, et une mesure a trois propriétés que la
déclaration n'a pas : elle est faite par quelqu'un qui n'est pas forcément l'écrivain, à un
instant qui n'est pas celui de l'écriture, et **elle périme**. Une mesure sans date de
mesure est invérifiable : on ne saurait pas de quand date la dernière fois qu'on a vu
l'objet. Replier la mesure sur `declared_at` ferait passer une observation pour une
déclaration et perdrait la seule chose qui fait sa valeur.

L'autre sens compte autant : une `DECLARED_AT_WRITE` qui porterait une observation n'est
pas une déclaration renforcée, c'est une ligne **incohérente** — quelqu'un aurait mesuré
sans le déclarer comme tel. Le lecteur la refuse aussi.

**Ce que la table n'enregistre pas, délibérément : le code HTTP observé.** Une colonne
`observed_status` inviterait à inscrire des 404 et des 403 comme des « événements de
localisation ». Or un 404 n'établit aucune localisation, et un 403 n'établit **rien du
tout**. Une sonde qui n'a pas rendu 200 ne produit **aucune ligne** — même discipline que
« UNKNOWN n'est pas une valeur stockée ».

### 1.c — Deux événements du même instant, deux compartiments

**Réponse structurelle : ce n'est pas une ambiguïté, et c'est un choix.** L'autorité d'ordre
de cette table n'est aucune horloge — c'est `id`, `BIGINT GENERATED ALWAYS AS IDENTITY`.
Deux horodatages peuvent être égaux ; deux valeurs d'IDENTITY ne le peuvent pas. Deux
événements « du même instant » ont donc un ordre total, et le dernier est `max(id)`.
Il aurait été facile de mettre en scène le traitement d'une ambiguïté qui n'existe pas à ce
niveau ; on ne l'a pas fait. La preuve (e) le montre en vif : deux événements rigoureusement
simultanés désignant deux compartiments se **résolvent**, sans arbitrage.

**Mais l'ambiguïté existe ailleurs, et elle est réelle — côté lecteur.** Si le tableau reçu
contient deux lignes portant le **même `id` maximal** et désignant des localisations
différentes, la base ne peut pas l'avoir produit (`id` est PK) : le jeu de résultats est
malformé. Prendre la première serait arbitrer → `AMBIGUOUS_LATEST`, fail closed. Une
doublure *strictement identique*, elle, ne fait rien refuser : rien ne s'oppose.

**Et la seconde moitié de la règle — « incohérence = fail closed » :** si le dernier
événement désigne une clé différente de celle que la pièce porte, deux autorités se
contredisent sur l'endroit où regarder → `KEY_DIVERGENCE`. On ne préfère ni le registre ni
la colonne. C'est aussi pourquoi `storage_key` **n'est pas** contraint à égaler `r2Key` par
un CHECK : une migration qui déplace un objet change sa clé, et un registre incapable de
l'enregistrer ne serait pas un registre d'historique. La divergence est légitime à écrire,
et refusée à lire. Un CHECK l'aurait rendue inexprimable, un silence l'aurait rendue
invisible.

### ⚠️ Un écart attrapé par le post-check, pas par relecture

`…_verified_iff_observation_check` faisait **64 octets** : Postgres l'aurait tronqué
silencieusement à 63, et la contrainte aurait été posée sous un autre nom que celui écrit
dans le fichier. Le post-check l'a signalée à la fois `ABSENTE` et `INATTENDUE` au premier
rejeu PGlite. Renommée `…_head_iff_observation_check` (60 octets) ; les dix autres
identifiants ont été vérifiés un par un.

---

## 2 · Le lecteur, branché sur le resolver

`src/lib/evidence-chain/storageLocationJournal.ts` — pur, synchrone, sans `process.env`,
sans réseau. `max(id)` en `BigInt` (au-delà de 2^53 deux ids distincts deviendraient égaux
en flottant — une preuve le montre). L'ordre du tableau reçu n'est jamais présumé ; la
requête SQL trie pareil, sans que la résolution s'y fie.

Quatre causes de refus, **distinctes** : `NO_LOCATION_EVENT`, `ROW_OUT_OF_DOMAIN`,
`AMBIGUOUS_LATEST`, `KEY_DIVERGENCE`. Une valeur hors domaine rend une cause propre et **ne
remonte jamais** à un événement antérieur plus pratique.

### Le pont, et le trou qu'il a fallu combler d'abord

`autoriteDuRegistreDeLocalisation(...)` transforme ce que le lecteur a résolu en
`AutoriteDeLocalisation`. La correspondance :

| résolution | → | autorité |
|---|---|---|
| établie | → | **revendication** du compartiment |
| `NO_LOCATION_EVENT` | → | **abstention** |
| `ROW_OUT_OF_DOMAIN` / `AMBIGUOUS_LATEST` / `KEY_DIVERGENCE` | → | **objection** |

`objecter` a dû être **ajouté** à l'interface, et c'est le point non trivial de la fenêtre :
avec `localiser` seul (`string | null`), une autorité confrontée à une ligne hors domaine
n'avait qu'un moyen de le dire — rendre `null`, c'est-à-dire *une absence*. Une anomalie de
la base se serait donc lue comme un simple trou de couverture : exactement la dégradation
que M3 sanctionne, et elle aurait été **inexprimable**, donc invérifiable. L'ajout est
strictement additif (`objecter?`) : aucun appelant existant ne change.

Les objections sont examinées **avant** les revendications. Une incohérence constatée ne se
contourne pas en interrogeant une autre autorité.

### La discipline de bascule, respectée

`AUTORITES_DE_LOCALISATION` reste `[]` et gelé. La table sera **posée vide**, donc une
autorité branchée dessus ne revendique rien, donc pièce par pièce le comportement est
**identique à aujourd'hui** : absence d'événement → `STORAGE_LOCATION_UNRESOLVED`. Une
preuve compare les deux chemins et vérifie que le refus rendu est celui d'avant, **mot pour
mot** — et pas une objection.

Aucun repli n'a été ajouté. La convention de préfixe reste un NO-GO : les 31 clés commencent
**toutes** par `reports/`, et c'est précisément pourquoi on ne la lit pas.

---

## 3 · Les 62 HEAD : où sont les 31

`src/scripts/evidence-chain/mesure-localisation.ts` — `HeadObject` uniquement, **0 octet
transféré**, aucun `GetObject`, aucune écriture.

**Nombre exact d'appels : 62.** 31 pièces × 2 compartiments.

| compartiment | résultat |
|---|---|
| `interligens-reports` | **31 / 31 → HTTP 200** |
| `interligens-evidence` | **31 / 31 → HTTP 403** |

### ⚠️ La discrimination demandée n'est qu'à moitié obtenue, et je ne la complète pas d'office

GPT attendait « reports positif / evidence négatif ». Le positif est **mesuré** : les octets
des 31 sont dans `interligens-reports`, constaté, pas déduit. Le négatif **ne l'est pas** :
les credentials de `.env.local` n'ont pas accès à `interligens-evidence` (`ListBuckets`
renvoie également `403`). Or **un refus d'intermédiaire n'est pas une absence** — c'est la
doctrine `object_unreadable` face à `object_absent`, et elle s'applique à ma propre mesure
comme au reste. Le verdict du script est donc `NON_MESURABLE` pour les 31, et non
`PRESENT_A_UN_SEUL`.

Ce qui est établi : *les octets sont dans `interligens-reports`*.
Ce qui ne l'est pas : *ils n'y sont **que** là.*

Aucune anomalie `PRESENT_AUX_DEUX` ni `ABSENT_DES_DEUX` n'a été observée — mais la seconde
n'aurait pas pu l'être, faute d'accès.

**Ce qu'il faudrait pour clore :** un token R2 en lecture sur `interligens-evidence`, puis
31 HEAD de plus. C'est le fondateur qui décide s'il veut cette moitié avant d'autoriser
l'inscription, ou s'il inscrit sur la moitié positive. Je ne tranche pas à sa place : la
règle de la fenêtre est que l'anomalie se **rapporte**, pas qu'elle s'arbitre.

Note d'inférence, signalée comme telle : rien n'a jamais pu écrire dans
`interligens-evidence` par l'application, puisque `R2_EVIDENCE_BUCKET_NAME` n'est
provisionnée nulle part et que la porte gouvernée refuse sans elle. C'est un **raisonnement**,
pas une mesure, et il ne remplace pas les 31 HEAD manquants.

**⛔ Rien n'est inscrit.** La mesure prépare des lignes `VERIFIED_BY_HEAD` ; leur inscription
est une écriture de production qui attend le DDL posé et l'autorisation du fondateur.

---

## 4 · Les six preuves et les cinq mutants

`__tests__/evidence-chain/registre-de-localisation.test.ts` — **42 tests verts**.

| | preuve | |
|---|---|---|
| (a) | absence de ligne → `STORAGE_LOCATION_UNRESOLVED`, **inchangé** | ✅ + comparaison mot pour mot avec le chemin actuel |
| (b) | une `DECLARED_AT_WRITE` → résolution, **mode rendu** | ✅ + `VERIFIED_BY_HEAD` rend aussi son observation |
| (c) | deux lignes, **la plus récente par `id`** gagne | ✅ dans les deux ordres de tableau, contre l'horloge, et au-delà de 2^53 |
| (d) | hors domaine → fail closed, **cause distincte** | ✅ + les deux sens du CHECK + « ne remonte jamais » |
| (e) | deux concurrents → fail closed | ✅ + doublure identique tolérée + le même instant se **résout** |
| (f) | append-only : UPDATE/DELETE/TRUNCATE → `23001` | ✅ en vif, en transaction annulée (harnais PGlite) |

Mutants — `bash scripts/evidence-chain/mutants-registre-localisation.sh` : **5 / 5 rouges.**

| | faute réintroduite | |
|---|---|---|
| M1 | repli par préfixe (`reports/` élit son compartiment) | 🔴 |
| M2 | `min(id)` au lieu de `max(id)` | 🔴 |
| M3 | `ROW_OUT_OF_DOMAIN` dégradé en abstention | 🔴 |
| M4 | ambiguïté arbitrée (on prend le premier) | 🔴 |
| M5 | repli vers `R2_BUCKET_NAME` | 🔴 |

Un témoin structurel supplémentaire vérifie que **l'instrument de mesure reste hors du
chemin gouverné** : aucun module de `src/lib/evidence-chain/` ne l'importe. Sonder deux
compartiments pour voir « lequel répond » est légitime pour un humain qui mesure, et serait
le repli si la résolution s'en servait.

Suite complète : **508 fichiers, 7 436 tests verts.** `tsc --noEmit` : 0 erreur. ESLint : 0.

---

## 5 · La répétition à blanc

`scripts/evidence-chain/harnais-registre-localisation-pglite.mts` — **tout vert**.

**PGlite, et non `BEGIN … ROLLBACK` contre la production** : une transaction annulée
n'écrirait rien, mais elle *exécuterait* le DDL sur `ep-square-band` et y prendrait des
verrous. L'interdit de la fenêtre est plus fort que la commodité, et PGlite était
l'alternative explicitement prévue.

- **(A)** le DDL se joue, le post-check rend 29 points, **tous verts**. Les formes rendues
  par `pg_get_constraintdef` sont mesurées ici, jamais écrites à la main.
- **(B)** 18 règles exercées en vif : vocabulaire clos (`INFERRED_FROM_PREFIX`,
  `BY_CONVENTION`, `UNKNOWN` → `23514`), les deux sens du CHECK d'observation, formes de
  bucket et de clé, FK (`23503` dans les deux sens), `declared_at` sans défaut (`23502`).
  Une clé à **espace interne** est acceptée : S3 l'autorise, on n'invente pas la contrainte.
- **(B bis)** append-only en transaction annulée : `23001` sur les trois verbes, la ligne
  toujours là après, et un déplacement qui produit une **nouvelle** ligne sans effacer
  l'ancienne.
- **(C)** le post-check **sait rougir** : 6 sabotages, au moins 3 lignes `ok = false` chacun.
- **(D)** la répétition à blanc des 31 : `31/31 UNRESOLVED` avant → inscription des 31
  `VERIFIED_BY_HEAD` avec les valeurs mesurées → relecture par la requête de production →
  **31/31 résolues**, dans `interligens-reports`, avec mode et observation → `ROLLBACK` →
  table vide, **31/31 revenues à `UNRESOLVED`**, les 31 pièces intactes.

---

## 6 · Le SQL prêt à coller

Deux blocs, dans l'ordre, dans l'éditeur SQL Neon (`ep-square-band`), après snapshot de
branche. Jamais `prisma db push`, jamais `prisma migrate` — verrou A9, `P1012`.

1. `docs/prep/MIGRATION_STORAGE_LOCATION_JOURNAL_2026-09-15.sql` (`BEGIN … COMMIT`)
2. `docs/prep/POSTCHECK_STORAGE_LOCATION_JOURNAL_2026-09-15.sql` (lecture seule)

Attendu au post-check : **10 colonnes · 1 PK · 6 CHECK · 1 FK · 1 index cible · 2 triggers
`tgenabled = 'O'` · 0 ligne.** La colonne `ok` doit être `true` partout ; `ORDER BY ok`
remonte les `false` en tête.

**⛔ STOP.** Le fondateur pose. L'inscription des 31 lignes est une écriture de production
séparée, et la moitié négative de la mesure n'est pas faite.

---

## Ce qui reste ouvert

1. **31 HEAD manquants** sur `interligens-evidence` — bloqués par un `403`. Décision
   fondateur : obtenir un token en lecture, ou inscrire sur la moitié positive.
2. **`D` reste en HOLD**, `A` et la convention de préfixe restent NO-GO. Aucun octet déplacé.
3. Les **1 103** ne sont pas résolues, et ne devaient pas l'être dans cette fenêtre.
4. `evidence_storage_location_journal` est une **table en SQL brut** : à déclarer dans
   l'inventaire S24, comme les précédentes.
