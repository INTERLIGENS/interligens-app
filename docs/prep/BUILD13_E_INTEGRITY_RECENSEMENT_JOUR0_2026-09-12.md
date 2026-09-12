# E-RC INTEGRITY — RECENSEMENT JOUR 0, ATTESTATION

**Date d'exécution** : 2026-09-12 · **Branche** : `feat/cc-offline-180-recensement-integrite`
**Nature** : exécution LECTURE SEULE sur la production + une écriture de contrôle
sous préfixe non probatoire.

> **L'ÉNONCÉ QUE CE RECENSEMENT REND DISPONIBLE** — et qui n'existait pas hier :
>
> « Au 2026-09-12, les 1 101 objets de preuve encore présents dans R2 ont été
>   RELUS, leur SHA-256 RECALCULÉ sur les octets relus, et opposé à l'empreinte
>   du registre. 1 070 d'entre eux sont en outre attestés par un horodateur
>   tiers vérifié hors ligne. Zéro divergence. Les 2 absences sont connues,
>   étiquetées, et inchangées depuis 23 jours. »
>
> Avant aujourd'hui, la même phrase n'était adossée à **aucun octet lu**.

---

## 1. CE QUI A ÉTÉ EXÉCUTÉ, DANS L'ORDRE IMPOSÉ

| étape | commande | octets d'objet lus |
|---|---|---|
| **1 — inventaire** | `census-integrity.ts --inventaire` | **0** |
| **2 — rodage `reports/`** | `--recensement --prefix reports/` | 5,2 Mio |
| **3 — sonde `evidence/`** | `--recensement --prefix evidence/ --limit 20` | 74,2 Mio |
| **4 — recensement complet** | `--recensement` | **4,85 Gio** |
| **5 — canari** | `integrity-canary.ts` | 4 Kio (objet de contrôle, détruit après) |

---

## 2. ÉTAPE 1 — L'INVENTAIRE, ET LA FOURCHETTE QUE J'AVAIS DONNÉE FAUSSE

**2 requêtes de classe A. Zéro octet d'objet téléchargé.**

```
objets dans le compartiment          1 136
lignes EvidenceItem avec r2Key       1 103
  présentes                          1 101
  absentes                               2
objets sans ligne de registre           35
```

| préfixe | objets | poids |
|---|---:|---:|
| `evidence/` | 1 096 | **4,85 Gio** |
| `reports/` | 38 | 6,3 Mio |
| `pointers/` | 1 | 122,3 Kio |
| `test-ping/` | 1 | 22 o |

### ⚠️ Ma fourchette était fausse, et dans le mauvais sens

J'avais déclaré `S ∈ [0,2 ; 3,2] Go`, « facteur 16 », en extrapolant depuis le
seul point mesuré (`reports/` ≈ 184 Ko/objet) et une hypothèse sur le poids des
captures PNG.

**Mesuré : 4,85 Gio, moyenne 4,5 Mio par objet — au-dessus de ma borne haute.**
Mon hypothèse sur les captures était basse d'un facteur ~3 à 20.

C'est exactement pourquoi l'ordre était imposé, et l'instruction a payé :
la mesure coûtait **2 requêtes**, l'extrapolation coûtait une erreur de
dimensionnement. **Un chiffre estimé n'a pas à survivre à une mesure qui coûte
deux requêtes.**

### La question ETag, tranchée par la mesure

```
mono-part (32 hex, = MD5 de l'objet)   1 136  ← la totalité
multipart (<hex>-<n>, PAS un MD5)          0
```

**L'ETag est exploitable comme empreinte calculée par le stockage sur TOUT le
compartiment.** C'était un `[NON MESURÉ]` de la conception, posé comme « à
vérifier, pas à supposer ». Il est vérifié. L'épinglage d'ETag (étage O1) est
donc praticable sans exception à déclarer — sous la réserve d'adversaire déjà
écrite : MD5 n'oppose rien à qui peut écrire dans le compartiment.

---

## 3. ÉTAPE 4 — LE RECENSEMENT COMPLET

```
VERDICT : OK                                    durée 469,7 s
observation complète : oui · octets réellement lus : 4,85 Gio

RÉCONCILIATION
  recalculés 1101 + absents connus 2 + non observés 0 = 1103
  dont chaîne ACTIVE 1094 · hors chaîne 7 — jamais fondus
  attendus 1103 → ÉQUILIBRÉE

PAR VERDICT
  1070  VERIFIED_ANCHORED        octets = colonne, ET un tiers atteste
    31  VERIFIED_UNANCHORED      octets = colonne, aucun TSA disponible
     2  ABSENT_KNOWN             absences déjà déclarées au registre

aucun constat.
```

**Débit effectif : ~10,6 Mio/s, 2,35 objets/s, 1 070 vérifications TSA hors
ligne** (une exécution `openssl ts -verify` chacune, contre la chaîne de
certificats archivée dans la ligne — aucun appel réseau).

### Le croisement avec les mesures de T1 — aucun écart

| grandeur | T1 (2026-09-12, matin) | recensement | |
|---|---:|---:|---|
| lignes avec `r2Key` | 1 103 | 1 103 | ✓ |
| présentes | 1 101 | 1 101 | ✓ |
| références mortes | 2 | 2 | ✓ **les mêmes clés** |
| pièces portant un TSA | 1 070 | **1 070 attestées** | ✓ |
| objets sans ligne | 35 | 35 | ✓ |

Les deux absences sont **nominalement identiques** à celles du 2026-08-20 et à
celles de ce matin :

```
evidence/5b/5b2dcac7…c990.png                             EXCLUDED
reports/GordonGekko/CASE_GordonGekko_2026-07-20T04-38-57.pdf   BYTES_LOST
```

**23 jours sans perte nouvelle — et pour la première fois, ce n'est pas une
absence de mauvaise nouvelle : c'est 1 101 empreintes recalculées.**

### Deux faits que seul le recalcul pouvait établir

1. **Les 31 `VERIFIED_UNANCHORED` sont TOUTES sous `reports/`.** Autrement dit :
   **100 % des 1 070 pièces `evidence/` sont ancrées à un tiers**, et le déficit
   d'ancrage est entièrement porté par les PDF de rapport. C'est une propriété
   de population, pas une moyenne — et elle dit où porter l'effort si
   l'ancrage des rapports devient un objectif.
2. **Zéro artefact malformé** (`bienForme === false` : 0 sur 1 101). La
   corroboration par nombres magiques ne contredit aucun verdict. Elle n'a
   servi à classer personne — c'était sa règle.

---

## 4. ÉTAPE 5 — LE CANARI : LE TÉMOIN EST POSITIF

Écrit **uniquement** sous `integrity-canary/<horodatage>/`, détruit en fin
d'exécution. **Aucune ligne `EvidenceItem` créée** — le script n'importe pas
`PrismaClient`, il en est structurellement incapable.

```
✅ 0. objet INTACT relu depuis R2              → VERIFIED_UNANCHORED
✅ 1. UN SEUL octet muté, longueur identique   → DIVERGENT_CORRUPTED
✅ 2. même objet, ingestion d'il y a 6 h       → DIVERGENT_SUBSTITUTED
✅ 3. objet TRONQUÉ (512 o contre 4 096)       → DIVERGENT_TRUNCATED
✅ 4. clé jamais écrite, ligne non étiquetée   → ABSENT_UNDECLARED
✅ 5. même clé absente, ligne BYTES_LOST       → ABSENT_KNOWN
```

**6 morsures, 6 cris attendus, sur le réseau réel.** La morsure **0** est le
contrôle négatif : sans elle, les cinq autres seraient vertes pour la mauvaise
raison — un comparateur qui crie toujours crie aussi sur un objet intact.

**Ce que le canari ajoute aux 36 tests.** Les tests prouvent que le comparateur
mord et que la chaîne mord sur un faux R2. Ils laissent dehors le réseau réel :
le client S3, la lecture en flux, le `GetObject` qui rend un corps, le 404
authentique de R2. Le canari couvre exactement ce reste.

**Et ce que le canari NE prouve pas** : il travaille sur un objet de 4 Kio qu'il
vient d'écrire. Il ne dit rien du comportement sur un objet de 50 Mio, ni d'une
lecture concurrente, ni d'une coupure en milieu de flux.

---

## 5. LE DÉFAUT QUE LE RECENSEMENT A TROUVÉ — DANS MA CONCEPTION

**Trouvé à la 3ᵉ étape, sur les 20 premières clés `evidence/`.**

`evidence/00/004306fc…` est étiquetée `EXCLUDED` et son objet **répond**. Ma
première version rendait `ABSENT_KNOWN_REAPPEARED` — « une pièce perdue qui
revient », un constat. **C'était faux**, et c'était le glissement sémantique
lui-même :

| statut | ce qu'il affirme | sur les octets |
|---|---|---|
| `BYTES_LOST` | **les octets ne sont plus là** | une affirmation |
| `EXCLUDED` | **la pièce ne participe pas à la chaîne active** (S4 : 5 conteneurs ZIP, 2 `.DS_Store`) | **rien** |

J'avais rangé les deux dans un seul seau « absence déclarée ». **8 des 9 lignes
`EXCLUDED` portent des octets parfaitement vivants** : la règle accusait le cas
normal.

**Le correctif sépare les deux faces, et une seule chacune :**

* **face ABSENCE** — `BYTES_LOST` **et** `EXCLUDED` rendent l'absence attendue.
  C'est le ruling (d), inchangé.
* **face PRÉSENCE** — seul `BYTES_LOST` fait d'une présence un constat.
* une pièce `EXCLUDED` présente est **vérifiée comme les autres**, et comptée
  **à part** (`horsChaineActive`, dérivé de `eligibility.ts` — la liste blanche
  canonique, pas un prédicat réécrit). **7 hors chaîne, 1 094 en chaîne active,
  jamais fondus.**

**Le recensement n'aurait pas trouvé ça sans tourner en vif.** Les 36 tests
passaient — ils testaient la règle que j'avais écrite, et la règle était fausse.

---

## 6. UN SECOND DÉFAUT, DANS LE TABLEAU DE BORD DU CANARI

Première exécution : **les 6 morsures annoncées EN ÉCHEC**, `obtenu:
undefined`, alors que les 6 `détail` portaient **les six classifications
justes**.

Cause : `verdictPour` rendait `{ verdict, detail }` là où le type attendait
`obtenu`. **Le spread d'un objet plus large dans un littéral n'active pas le
contrôle de propriétés excédentaires de TypeScript** — `tsc --noEmit` rendait 0
erreur.

Le tableau de bord mentait **dans le sens prudent** (échec annoncé, succès
réel), ce qui est le bon sens pour un témoin. Mais il mentait, et je n'ai pas
conclu depuis les chaînes de `détail` : **corrigé, puis rejoué**. Un témoin dont
on infère le verdict au lieu de le lire n'est plus un témoin.

---

## 7. CE QUI A ÉTÉ ÉCRIT, ET CE QUI NE L'A PAS ÉTÉ

| | |
|---|---|
| **écrit dans R2** | 3 objets de 4 Kio et moins, tous sous `integrity-canary/<horodatage>/`, **tous détruits** en fin d'exécution |
| **écrit en base** | **rien.** Un seul `SELECT` via `$queryRaw`. Aucun `$executeRaw` dans aucun des deux scripts |
| **octets de preuve modifiés** | **aucun.** Aucun `PutObject`, `DeleteObject` ni `CopyObject` ne peut viser une clé hors `integrity-canary/` — `assertPrefixeAutorise` arrête le processus, il n'avertit pas |
| **corrections pendant le recensement** | **aucune**, conformément au ⛔. Le module n'a pas la capacité : il reçoit deux fonctions — lire des octets, vérifier un token — et rien d'autre |

---

## 8. L'ATTESTATION, ET SON EMPREINTE

Le rapport complet — les 1 103 verdicts, chacun avec son empreinte recalculée,
sa taille observée, sa date d'écriture stockage et le verdict de l'arbitre — est
un fichier JSON de **846 758 octets** :

```
sha256  5aaa3230a71162e34b78bdaf6a79cbe0a3494e3c7af61fd33b84ad30da03f8a7
```

**Il n'est pas versionné dans le dépôt** — ce n'est pas du code, et le dépôt
n'est pas l'archive. Son empreinte est inscrite **ici**, ce qui permet de
vérifier plus tard, où qu'il soit conservé, que c'est bien ce rapport-là.
*(Une attestation qui prétend fonder l'intégrité et qu'on ne peut pas
elle-même vérifier serait la même faute, d'un étage plus haut.)*

### L'ANCRAGE — obtenu le 2026-09-12, après GO

**Une seule requête vers le tiers, sur le DIGEST seul. Le fichier n'a jamais
été transmis.**

```
autorité      freetsa.org          ← la MÊME que les 1 070 pièces du corpus
                                     (mesuré : 1 070/1 070 stampées freetsa.org
                                      le 2026-07-30). Pas une autorité nouvelle.
genTime       2026-09-12T19:13:56Z
token         4 645 octets   ·  chaîne PEM  7 939 octets
digest ancré  5aaa3230a71162e34b78bdaf6a79cbe0a3494e3c7af61fd33b84ad30da03f8a7
```

**Le digest a été RECALCULÉ sur les octets du fichier, jamais recopié depuis le
§ ci-dessus.** Ancrer un digest repris d'une note ancrerait la note, pas le
fichier — ce serait la faute de tout ce chantier, d'un étage plus haut. Les
deux valeurs coïncident, et c'est une confirmation indépendante, pas une
tautologie.

**L'ancrage mord.** Le token a été vérifié hors ligne contre le digest ancré
(`Verification: OK`) **et** contre un digest voisin d'UN SEUL caractère
hexadécimal (`message imprint mismatch` — rejeté). Un token qui attesterait les
deux ne prouverait rien ; le script sort en échec sans rien écrire
d'exploitable dans ce cas.

**Vérification par un tiers, sans aucun accès au système** — rejouée depuis le
lot seul :

```
shasum -a 256 census-jour0-complet.json
    → 5aaa3230a71162e34b78bdaf6a79cbe0a3494e3c7af61fd33b84ad30da03f8a7
openssl ts -verify -digest <ce digest> \
    -in census-jour0-complet.tsr -CAfile census-jour0-complet.chain.pem
    → Verification: OK
openssl ts -reply -in census-jour0-complet.tsr -text
    → Status: Granted. · Hash Algorithm: sha256 · Time stamp: Sep 12 19:13:56 2026 GMT
```

### Où le lot est conservé — et la question que je ne tranche pas

| | |
|---|---|
| **lot complet** (attestation 846 758 o + `.tsr` + `.chain.pem` + `.anchor.json`) | `~/interligens-attestations/census-jour0-2026-09-12/` — **un seul exemplaire, sur une seule machine** |
| **ancre inscrite au dépôt** | `docs/attestations/census-jour0-2026-09-12/` — `.tsr` + `.anchor.json` (~13 Ko). **Pas les 846 Ko** : le dépôt porte l'ancre, pas l'archive. |

**La chaîne de certificats est EMBARQUÉE dans `.anchor.json`, pas posée à
côté.** `.gitignore:25` écarte `*.pem` — une règle faite pour les clés privées,
et celle-ci est une chaîne publique. Plutôt que de forcer l'ajout d'un fichier
que git réignorera au prochain geste, elle est inscrite en clair dans le
procès-verbal, **exactement comme `EvidenceItem.tsaCertChain` le fait déjà en
base**. L'ancre du dépôt est donc AUTO-PORTANTE — vérifié en extrayant la
chaîne du seul `.anchor.json` : `Verification: OK` sur le digest ancré,
`Verification: FAILED` sur un digest voisin.

⚠️ **L'ancrage ne sauvegarde pas l'attestation.** Il établit qu'elle existait au
plus tard le 2026-09-12 19:13:56 UTC ; il ne la duplique pas. En l'état, le
fichier n'existe **qu'en un exemplaire local**, et le token inscrit au dépôt
serait alors une ancre sans navire. **Où cette baseline doit être archivée est
une décision d'archivage, pas une décision de mesure — je la pose, je ne la
prends pas.**

### Ce que l'ancrage NE prouve PAS

1. Il établit que **ce fichier-là** existait **au plus tard** au `genTime`. Il
   n'établit **ni** que le recensement a été exécuté à cette date, **ni** que
   ses constats sont exacts. Un horodateur atteste une existence, pas une
   vérité.
2. Il n'ancre **que l'attestation**. Les 1 101 objets du corpus n'ont été ni
   modifiés, ni re-horodatés, ni touchés.
3. **Il ne change rien au stockage.** Un recensement constate ; il n'empêche pas.

---

## 9. CE QUE CE RECENSEMENT NE PROUVE PAS

1. **Rien sur demain.** Une attestation est **datée**. Les étages O1 (épinglage
   quotidien) et O3 (recensement glissant) restent à câbler, et ils ne sont pas
   dans cette fenêtre.
2. **Rien sur les 35 objets sans ligne de registre.** Hors de la question
   d'intégrité **par construction** : il n'existe aucune empreinte à leur
   opposer. Déclarés, jamais comptés comme conformes.
3. **La période 2026-03-09 → 2026-07-20 reste `NOT_MEASURABLE`**, et le rester
   **est la conclusion**. Un artefact détruit sans ligne `EvidenceItem` est
   invisible à toute empreinte.
4. **Le compartiment n'offre aucun verrou d'écriture.** Mesuré par appel réel
   le 2026-07-30 et inscrit dans `r2.ts` : `CreateBucket ObjectLockEnabled` →
   `NotImplemented`, `GetObjectLock` / `Versioning` → `AccessDenied`. **Un
   recensement constate ; il n'empêche pas.**
5. **`VERIFIED_UNANCHORED` n'est pas `VERIFIED_ANCHORED`.** 31 pièces reposent
   sur la seule affirmation du registre. Intégrité attestée, **ancrage tiers
   indisponible** — affaibli, jamais invalide, et dit plutôt que tu.

---

## 10. CE QUI RESTE À FAIRE — non fait, non promis

| rang | quoi | pourquoi pas aujourd'hui |
|---|---|---|
| **O1** | épinglage ETag + taille, quotidien | exige un ordonnanceur : `vercel.json` et `package.json` sont **gelés par le guard**. Une lease, donc une fenêtre. |
| **O3** | recensement glissant, T = 30 j | idem |
| **O4a** | **relecture après ingestion** — clôt L-c | touche `ingest.ts`, hors de la fenêtre « aucune mutation du chemin d'écriture » |
| **O4b** | `verifyManifest` **par clé contre R2** — clôt L-b | le correctif change la sémantique d'un vérificateur déjà émis ; il demande son propre arbitrage |
| — | **archivage du lot d'attestation** | décision d'archivage, pas de mesure — posée au §8, non prise |
| — | rattrapage TSA des 31 `reports/` non ancrés | **retenu pour le Product Spine, PAS un chantier maintenant.** Remonte SI un report showcase RC (BOTIFY, VINE) se trouve parmi les 31 — non mesuré ce soir, délibérément |
| ~~—~~ | ~~horodatage TSA de l'attestation~~ | **FAIT** — voir §8, ancré chez freetsa.org le 2026-09-12T19:13:56Z |

---

## 11. LE FILTRE DES 38 JOURS

> « L'artefact que vous ouvrez est celui qui a été enregistré, et son intégrité
>   peut être vérifiée. »

Cette phrase est **dicible au 2026-09-12**, adossée à 1 101 empreintes
recalculées sur 4,85 Gio d'octets réellement relus, dont 1 070 attestées par un
tiers — et à un témoin qui a **mordu six fois** sur le chemin réel.

Elle ne l'était pas hier. **Rendre la démonstration plus convaincante : oui.**
