# T1-INSCRIPTION-REELLE-VINE — L'ÉCRITURE IRRÉVERSIBLE

**Fenêtre** : 2026-09-15 · branche `feat/cc-offline-193-inscription-vine`
**Base** : `neondb` · `ep-square-band-ag2lxpz8.c-2.eu-central-1.aws.neon.tech`
**HEAD au moment de l'inscription** : `c20ac38`, arbre propre, vérifié juste avant.

> ⚠️ Cette fenêtre a POSÉ deux lignes permanentes. `evidence_provenance_journal`
> est append-only par deux triggers : 23001 sur UPDATE, DELETE et TRUNCATE. Les
> lignes **#3** et **#4** ne pourront JAMAIS être retirées ni corrigées.

Autorisation : le fondateur, sur les deux événements présentés en clair — pas sur
une autorisation générique.

---

## LES DEUX IDENTIFIANTS PERMANENTS

| journal | source | `evidence_snapshot_id` | `sha256` de la pièce |
|---|---|---|---|
| **#3** | `SRC-0xS-09` | `34f4068a-57d8-45c5-9c8a-47b29b931e1b` | `8c55dd83065ced33dbfd17a71c65f37df2ce366e2d8d4688399a27b5de39ace3` |
| **#4** | `SRC-0xS-18` | `f24e3252-7d16-41a3-8253-eb0c1be67654` | `c60be4bb3f9f8ff0f09032eace6330016612f6c40c75d97149d28ae1ed6c4f0e` |

Communes aux deux lignes :

```
provenance_kind      OPERATOR_DECLARED
reference_kind       QUERY_CONTEXT
source_url           https://x.com/search?q=from:0xSweep%20VINE
declared_by          David Douville
verified_by          NULL
verified_at          NULL
verification_method  NULL
recorded_at          2026-09-15 05:45:20.543201+00   (l'horloge de la base)
declared_at          #3 : 2026-09-15 05:45:20.551+00
                     #4 : 2026-09-15 05:45:20.620+00
```

La répétition à blanc avait prédit que les ids réels seraient **#3 et #4** — les
deux ids consommés puis perdus par son ROLLBACK étaient #1 et #2, une séquence
n'étant pas transactionnelle. La prédiction est vérifiée.

---

## ÉTAPE 1 — RELECTURE AVANT ÉCRITURE

En lecture seule, avant tout `BEGIN`. Les trois questions de la consigne, plus la
revérification que rien n'a bougé depuis la répétition.

| point | résultat |
|---|---|
| le journal est-il toujours à 0 ligne ? | `count = 0` · séquence `{"v":"2","is_called":true}` |
| les 2 `EvidenceSnapshot` existent-ils sous ces ids ? | les 2 trouvés |
| les 2 `sourceUrl` sont-elles celles mesurées, à l'octet près ? | `hex 6874747073…56494e45` identique sur les deux, 40 caractères |
| les `sha256` concordent-ils source ↔ snapshot ? | oui, 64 hex minuscules chacun, **relus** — jamais recopiés |

Et, AVANT toute connexion, la garantie que rien n'a divergé depuis la répétition :
les quatre constantes (`LU_ATTENDU`, `CANONIQUE`, `DECLARANT`, les deux couples
`sourceId → snapshotId`) sont **extraites du fichier de la répétition** et
comparées caractère par caractère. Une divergence aurait arrêté le script avant
même d'ouvrir la base.

Le localisateur : la valeur lue en production porte **un seul** caractère blanc
(`U+0020`, index 35). La forme canonique inscrite est cette valeur avec ce seul
blanc encodé `%20`, et rien d'autre — le `:` de `from:` n'est pas encodé, un seul
`%` dans toute la chaîne. Vérifié à l'exécution, pas promis en commentaire.

---

## ÉTAPE 2 — L'INSCRIPTION

Via `recordQualification` (`src/lib/casefile/journalWriter.ts`), le chemin
construit et prouvé en `d42a6dc`. Aucun `INSERT` ad hoc.

UNE transaction `REPEATABLE READ` pour les deux lignes, un `SAVEPOINT` par appel —
la forme exacte de la répétition. Toute la vérification est DANS la transaction ;
le `COMMIT` n'est atteint qu'après elle. Au moindre KO : `ROLLBACK`, deux lignes
ou aucune.

SQL réellement émis par l'écrivain : **4 requêtes** — 2 `INSERT`, 2 `SELECT` de
relecture. Aucun `UPDATE`, aucun `DELETE`, aucun `TRUNCATE`.

`declared_at` est venu de l'appelant et a été relu **identique** sur les deux
lignes : l'horloge du serveur ne s'est pas substituée au geste.

---

## ÉTAPE 3 — LA GATE, DIX POINTS

`npx tsx scripts/casefile/qualifications-vine-gate-post-inscription.mts --receipt=…`

### 1 · exactement 2 lignes, ids notés

```sql
SELECT count(*) FROM evidence_provenance_journal;
```
→ **2** · ids `#3`, `#4`. ✅

### 2 · `provenance_kind = OPERATOR_DECLARED` sur les deux

→ `#3 → OPERATOR_DECLARED` · `#4 → OPERATOR_DECLARED`. ✅

### 3 · `reference_kind = QUERY_CONTEXT` sur les deux

→ `#3 → QUERY_CONTEXT` · `#4 → QUERY_CONTEXT`. ✅

### 4 · `source_url` strictement égale à la canonique, comparée à l'OCTET

```sql
SELECT encode(convert_to(source_url,'UTF8'),'hex'), length(source_url) FROM …
```
attendu et relu sur les deux lignes :
`68747470733a2f2f782e636f6d2f7365617263683f713d66726f6d3a3078537765657025323056494e45`
(42 caractères). ✅ — comparée en hex, pas en chaîne : une normalisation Unicode
invisible ne passerait pas.

### 5 · `declared_by`, et `declared_at` DISTINCT de `recorded_at`

```sql
SELECT declared_by, (declared_at IS DISTINCT FROM recorded_at) FROM …
```
- `#3` · `David Douville` · `declared_at 05:45:20.551+00` ≠ `recorded_at 05:45:20.543201+00`
- `#4` · `David Douville` · `declared_at 05:45:20.620+00` ≠ `recorded_at 05:45:20.543201+00`

✅ Les deux `recorded_at` sont IDENTIQUES — c'est l'horloge de la transaction,
prise une fois. Les deux `declared_at` diffèrent : ce sont deux gestes distincts.

### 6 · `verified_by`, `verified_at`, `verification_method` à NULL

→ `#3 → [null,null,null]` · `#4 → [null,null,null]`. ✅

### 7 · APPEND-ONLY PROUVÉ EN VIF

Un verrou qu'on n'a pas essayé de forcer n'est pas un verrou mesuré. Dans une
transaction annulée, sur la **ligne réelle #3** :

```sql
BEGIN;
UPDATE evidence_provenance_journal SET declared_by = 'FORCE' WHERE id = 3;  -- → 23001
ROLLBACK;
BEGIN;
DELETE FROM evidence_provenance_journal WHERE id = 3;                       -- → 23001
ROLLBACK;
```

→ `23001` sur les deux. ✅
**7 bis** — après les deux tentatives : `{"n":2,"forces":0}`. Rien n'a été altéré. ✅

### 8 · le lecteur rend OPERATOR_DECLARED sur les deux sources VINE

```
SRC-0xS-09 → {"kind":"OPERATOR_DECLARED","derived":false,"journalId":"3","referenceKind":"QUERY_CONTEXT",…}
SRC-0xS-18 → {"kind":"OPERATOR_DECLARED","derived":false,"journalId":"4","referenceKind":"QUERY_CONTEXT",…}
```
✅ — `derived: false` : la qualification vient d'une LIGNE, pas d'une absence.

### 9 · le lecteur rend NO_SNAPSHOT_LINK sur les 8 sources BOTIFY — inchangé

`SRC-001` … `SRC-008` → `{"kind":"UNKNOWN","derived":true,"cause":"NO_SNAPSHOT_LINK","journalId":null}`. ✅

Conséquence acceptée, déjà déclarée en `d42a6dc` : BOTIFY n'a pas de pont
`snapshotId`, et cette fenêtre ne lui en fabrique pas.

### 10 · RIEN D'AUTRE N'A BOUGÉ

Les empreintes AVANT ont été prises dans le script d'inscription, avant le
`BEGIN`, et déposées dans un reçu hors dépôt. La gate les **compare** ; elle ne
les reconstruit pas.

**10.a** — md5 des trois tables voisines, identiques avant/après :

| table | md5 avant | md5 après |
|---|---|---|
| `CaseFileClaim` | `a245b69ba90a1389f79cd0cbcdea725c` | `a245b69ba90a1389f79cd0cbcdea725c` |
| `CaseFileSource` | `982d486221dffc48ee262852493809b7` | `982d486221dffc48ee262852493809b7` |
| `EvidenceSnapshot` | `b9d83bb0406307a312d4fc7326991e82` | `b9d83bb0406307a312d4fc7326991e82` |

✅ Aucune `sourceUrl` de projection n'a été réécrite. La qualification ne corrige
rien : `SRC-0xS-09."sourceUrl"` porte TOUJOURS son espace.

**10.b** — état gouverné, identique avant/après :
`{"claims":22,"sources":10,"decisions":6,"grants":3,"seq_decisions":"39","casefiles_non_draft":1}`. ✅

**10.c** — 0 claim PUBLIC : chaque `GRANT` est suivi d'un `REVOKE` postérieur.
`GRANT non révoqués = 0`. ✅

**10.d** — les dossiers PORTEURS de claims et de sources sont toujours `draft` :

```
IL-SHILL-VINE-001   = draft   (14 claims, 2 sources)
IL-SHILL-BOTIFY-001 = draft   ( 8 claims, 8 sources)
```
✅

**10.e — ÉCART DE FORMULATION, DÉCLARÉ.** La consigne dit
« `token_casefiles.publishStatus` toujours draft ». C'est vrai des dossiers sous
gouvernance ; **ça ne l'est pas de la table entière** :

```
IL-CONC-BLACKBULL-001 = draft      (0 claims, 0 sources)
IL-PND-LAB-001        = published  (0 claims, 0 sources)   ← non-draft
```

`IL-PND-LAB-001` (LAB) était `published` **avant** cette fenêtre — il figure dans
l'état AVANT, capté avant le `BEGIN` (`casefiles_non_draft: 1`), et il ne porte NI
claim NI source : il est hors du registre gouverné. Le décompte est identique
avant et après. La gate énonce donc ce qu'elle MESURE plutôt que la formule
générale, qui aurait été fausse. ✅

**GATE VERTE · KO = 0.**

---

## L'AMENDEMENT DU TÉMOIN — UNE LICENCE PAR VERBE

`__tests__/casefile/t1-lecteur-journal.test.ts` interdisait `UPDATE`, `DELETE` et
`TRUNCATE` sur le journal dans TOUT le dépôt, avec une exemption nominative : le
harnais PGlite. Le point 7 de cette gate a besoin de la même licence, pour la même
raison — prouver le refus.

Plutôt que d'ouvrir un second fichier en grand, l'exemption devient **nominative
par verbe** : chaque banc ne reçoit que les mutations qu'il déclare essayer, et
doit porter, pour chacune, l'attente du refus sous SA forme.

| banc | verbes licenciés | forme du refus exigée |
|---|---|---|
| `harnais-ecrivain-journal-pglite.mts` | UPDATE, DELETE, TRUNCATE | `!== "OK"` |
| `qualifications-vine-gate-post-inscription.mts` | UPDATE, DELETE | `=== "23001"` |

La gate ne demande pas `TRUNCATE` ; un témoin dédié vérifie qu'elle ne le porte
pas. C'est **strictement plus serré** que l'exemption par fichier d'avant.

Amendée aussi, la liste blanche des appelants du lecteur : les deux scripts s'y
ajoutent, et une assertion NOUVELLE fixe ce qui compte — dans `src/`, l'unique
appelant reste l'écrivain.

### Prouvé en vif, pas inféré

Une suite verte ne prouve pas le mécanisme : deux mutants ont été joués contre le
témoin amendé.

| mutant | attendu | mesuré |
|---|---|---|
| (A) un `UPDATE` dans le script d'inscription, **non** licencié | rouge | 1 rouge |
| (B) un `TRUNCATE` dans la gate, licenciée UPDATE+DELETE seulement | rouge | 2 rouges |
| contre-épreuve, tout restauré | vert | 33/33 |

---

## CE QUI N'A PAS ÉTÉ FAIT

- ⛔ Aucune bascule du contrat. La PHASE C / étape D attend son propre GO.
- ⛔ Aucun branchement du lecteur sur `decideFoundation` ni `decidePublicRelease` :
  `readProvenanceKind` reste l'autorité effective.
- ⛔ Aucune ligne pour BOTIFY ni pour aucune autre pièce. **Deux** lignes, pas trois.
- ⛔ Aucune variable `TSA_*`, aucun appel réseau hors la base, aucun déploiement.
- ⛔ `CaseFileSource` et `EvidenceSnapshot` ne sont ni touchés, ni relus comme
  autorité, ni corrigés.

---

## CE QUE CETTE INSCRIPTION N'AFFIRME PAS

> « Append-only provenance may record an honestly incomplete qualification;
> recording OPERATOR_DECLARED does not elevate it to VERIFIED. »
> — ruling GPT du 2026-09-15

`OPERATOR_DECLARED` dit **qui affirme**, pas **que c'est vérifié**. Les trois
colonnes de vérification sont NULL, et le type comme le CHECK refusent de les
remplir sans méthode nommée. Le localisateur inscrit est un `QUERY_CONTEXT` : un
contexte de découverte, jamais la référence de provenance individuelle vérifiée
d'un post (décision 4b) — c'est pourquoi `VERIFIED` + `QUERY_CONTEXT` est
impossible, au niveau du type comme du CHECK.

Une requalification future sera une **nouvelle ligne**, jamais une correction de
celles-ci.
