# BUILD 8 — validation finale de clôture, en production

Validation **lecture seule** de ce qu'un serveur répond. `0 écriture · 0 DDL ·
0 appel Helius.` Lectures base en `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`,
cible `ep-square-band` assertée avant connexion.

| | |
|---|---|
| `main` | `a4cff7c576eec8f82a7b1e19fcb0cbf38c02cfbd` |
| guard | `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50` — byte-identique, `git diff cccac57` **vide**, **0** exemption ouverte |
| déploiement | `interligens-br2036r28` · **Ready** · build 2 min · mesuré 11 min après |
| horodatage | 2026-09-07, 11:14–11:22 UTC |

---

## VERDICT — 8 points sur 9

> ## BUILD 8 RESTE OUVERT.
>
> **Le point 5 ne passe pas.** La clé de route synthétique est encore
> INTERPRÉTÉE comme un mint, pas résolue en alias vers le canonique. Deux
> vérités casefile concurrentes subsistent — atténuées, mais mesurées et
> stables : `RED/75` contre `RED/70`.

| # | point | verdict |
|---|---|---|
| 1 | 0 wallet `isPubliclyUsable=false` servi | **PASS** |
| 2 | partition d'attribution complète 482/482 | **PASS** |
| 3 | nature 5 602/5 602 cohérente | **PASS** |
| 4 | le mint canonique ouvre le bon CaseFile | **PASS** |
| 5 | la clé synthétique n'est plus acceptée comme mint | **ÉCHEC** |
| 6 | 32/32 profils publiés joignables | **PASS** |
| 7 | aucun nouveau défaut de casse | **PASS** |
| 8 | guard byte-identical | **PASS** |
| 9 | CI verte | **PASS** |

Les points 1, 6 et 7 — les trois que le rapport d'étape 9 avait mis en défaut —
sont **tous redressés et vérifiés sur le serveur**, pas seulement en base.

---

## 1 · Aucun wallet non publiable servi

Balayage des **32 handles publiés** sur `/api/kol/[handle]`.

| mesure | attendu | observé | |
|---|---|---|---|
| wallets servis, total | 164 | **164** | OK |
| `isPubliclyUsable !== true` servi | 0 | **0** | OK |
| `status !== 'active'` servi | 0 | **0** | OK |
| wallets publiables en base | 164 / 229 | **164 / 229** | OK |

**C'est le redressement de l'écart E1.** À l'étape 9, l'API servait 38 wallets
pour 164 publiables. Elle en sert maintenant **164** — le chiffre de la base et
celui du serveur coïncident enfin. `38 + 126 = 164` est refermé.

---

## 2 · Partition d'attribution 482/482

Prouvé hors serveur par T2 (`exact` 15 · `strong` 246 · `probable` 215 ·
`candidate` 6 = **482**), non redérivé ici. Contrôles serveur complémentaires :

| contrôle | attendu | observé | |
|---|---|---|---|
| `"confidence":"exact"` en dur dans les 32 réponses | 0 | **0** | OK |
| `"source":"manual"` en dur dans les 32 réponses | 0 | **0** | OK |

`identityConfidence` servi, agrégé sur les 32 profils : `exact` 6 · `strong` 17 ·
`candidate` 8 · `probable` 1 = **32**. Aucun palier n'est ni saturé ni vide —
le rang se dérive, il n'est pas affirmé.

---

## 3 · Nature 5 602/5 602

Reconfirmé en exécutant `amountUsdNature()` sur les 5 602 lignes réelles :

| contrôle | attendu | observé | |
|---|---|---|---|
| accord lecteur ↔ colonne | 5 602 | **5 602** | OK |
| désaccords | 0 | **0** | OK |
| lignes colonne `NULL` | 76 | **76** | OK |
| dont le lecteur rend `UNCLASSIFIED` | 76 | **76** | OK |
| `ESTIMATE` inauditable | 0 | **0** | OK |

`INFERENCE` 5 407 · `ESTIMATE` 112 · `THIRD_PARTY_DATA` 7 · `NULL` 76.
Côté serveur, les 164 wallets servis portent tous `natureValue: "UNCLASSIFIED"`
— l'absence est déclarée, jamais masquée.

---

## 4 · Le mint canonique ouvre le bon CaseFile

`GET /api/casefile?mint=<44 canonique>`

| mesure | attendu | observé (étape 9) | observé (maintenant) | |
|---|---|---|---|---|
| `offchain_source` | `case_db` | `none` | **`case_db`** | OK |
| `verdict.tier` | `RED` | `GREEN` | **`RED`** | OK |
| `verdict.score` | ≈ 70 | `0` | **`75`** | OK |
| `retail_summary` | 3 lignes | « Aucun signal majeur detecte » | **3 lignes** | OK |
| données on-chain | présentes | présentes | **présentes** (supply, decimals, pool `raydium`, prix, liquidité, FDV) | OK |

**L'identité réelle ouvre enfin le dossier.** C'était la moitié la plus grave de
E2 : le mint que la base porte sur 262/5/3 lignes rendait un dossier vide et
GREEN. C'est corrigé.

---

## 5 · La clé synthétique — **ÉCHEC**

`GET /api/casefile?mint=<43 synthétique>`

La nuance à trancher était : le 43 est-il **résolu en alias vers le canonique**,
ou encore **interprété comme un mint** ? La mesure tranche — **les deux, dans
deux moitiés différentes de la même réponse.**

### Ce qui est résolu

| mesure | observé | |
|---|---|---|
| `offchain_source` | `case_db` (était `case_db` déjà) | — |
| `verdict.tier` | `RED` | OK |
| `retail_summary` | identique au canonique | OK |

`casefileLookupKey()` fait converger la lecture `CASE_DB` : le récit retail est
désormais commun aux deux entrées. C'est réel et c'est un progrès.

### Ce qui ne l'est pas

| champ | attendu si résolu en alias | observé | |
|---|---|---|---|
| `case.input.type` | `alias`, ou marqueur de résolution | **`"mint"`** | ÉCHEC |
| `case.input.value` | le canonique (44) | **le 43, verbatim** | ÉCHEC |
| `on_chain.asset.mint` | le canonique (44) | **le 43, longueur 43** | ÉCHEC |
| champ `alias` / `resolved_from` / `canonical` | présent | **AUCUN, à aucun niveau** | ÉCHEC |
| `verdict.score` | identique au canonique | **70 vs 75** | ÉCHEC |
| `report_hash` | identique | **`7e2049df…` vs `0b59f8e6…`** | ÉCHEC |
| enrichissement on-chain | celui du canonique | **`null` partout** (decimals, supply, pool, prix, liquidité, FDV, volume) | ÉCHEC |

**La réponse affirme qu'une chaîne de 43 caractères EST un mint.** Elle ne
déclare la résolution nulle part, et elle interroge la chaîne sur cette valeur —
d'où un enregistrement on-chain entièrement creux, exactement ce qu'on obtient
en demandant un mint qui n'existe pas.

### Mécanisme — `src/app/api/casefile/route.ts`

```
222   const lookupKey = casefileLookupKey(sanitizeMint)   // 43 → canonique
223   const caseEntry = CASE_DB[lookupKey] ?? null        // ← résolu ✔

244   fetchMetadata(sanitizeMint)                         // ← brut ✘
245   fetchMarkets(sanitizeMint)                          // ← brut ✘
246   fetchHolders(sanitizeMint)                          // ← brut ✘
256   asset: { mint: sanitizeMint }                       // ← brut ✘
285   computeScore(claims, linking, onChain, sanitizeMint)
301   input: { type: "mint", value: sanitizeMint }        // ← brut ✘
```

`casefileLookupKey` est appliqué **à la seule lecture `CASE_DB`**. Les trois
appels on-chain, la déclaration d'actif et la déclaration d'entrée reçoivent la
valeur brute. Le score étant nourri par `onChain`, l'écart de 5 points est la
conséquence mécanique de l'enrichissement manquant.

### Deux vérités concurrentes : atténuées, pas supprimées

| | étape 9 | maintenant |
|---|---|---|
| 44 canonique | `GREEN / 0` | `RED / 75` |
| 43 synthétique | `RED / 70` | `RED / 70` |
| écart | **inversion complète du verdict** | **5 points, 2 `report_hash`, 1 dossier on-chain contre 0** |

L'écart n'est **pas** un aléa de provider : **stable sur 3 passes consécutives**,
`75 / 70` à chaque fois, `on_chain.asset.mint` de longueur 44 puis 43.

> Le test livré par T2 compare `case_id` et **nombre de claims** obtenus par les
> deux entrées. Ces deux grandeurs convergent bien — le test dit vrai. Il ne
> couvre simplement ni la moitié on-chain, ni le score, ni ce que la réponse
> déclare être le mint.

**Le point 5 exige la résolution explicite. Elle n'a lieu que pour la carte.**

---

## 6 · 32/32 profils publiés joignables

| mesure | attendu | observé | |
|---|---|---|---|
| profils publiés en base | 32 | **32** | OK |
| joignables en HTTP 200 | 32 | **32** | OK |
| en 404 | 0 | **0** | OK |

Les 21 profils que l'étape 9 trouvait injoignables répondent tous.

### L'exclusion `0xsweep` — démontrée, pas constatée

La note de T2 est vérifiée en base :

| handle | `publishStatus` | `publishable` | wallets | publié ? |
|---|---|---|---|---|
| `0xSweep` | `draft` | `false` | 1 | **non** |
| `0xsweep` | `draft` | `false` | 2 | **non** |

Aucun des deux ne passe `PUBLIC_KOL_FILTER` : `publishStatus` n'est pas
`published`, et la branche de repli exige `publishable = true`. **Ils ne font
donc pas partie des 32**, et leur refus ne retire aucun profil publié du compte.
Ce n'est pas une exclusion tolérée — c'est une paire hors périmètre.

De plus, **collisions de casse parmi les profils publiés : aucune.** L'unique
collision de toute la table `KolProfile` est `0xsweep` / `0xSweep`, et les deux
sont en `draft`. La règle « refuser plutôt que choisir » est donc, aujourd'hui,
sans effet observable sur une surface publiée — ce qui est le résultat correct :
elle protège sans rien coûter.

---

## 7 · Aucun nouveau défaut de casse

| demandé | attendu | HTTP | handle servi | wallets | |
|---|---|---|---|---|---|
| `GordonGekko` | 200, `GordonGekko` | **200** | `GordonGekko` | 9 | OK |
| `gordongekko` | 200, `GordonGekko` | **200** | `GordonGekko` | 9 | OK |
| `GORDONGEKKO` | 200, `GordonGekko` | **200** | `GordonGekko` | 9 | OK |
| `gOrDoNgEkKo` | 200, `GordonGekko` | **200** | `GordonGekko` | 9 | OK |
| `bkokoski` | 200, `bkokoski` | **200** | `bkokoski` | 20 | OK |
| `BKOKOSKI` | 200, `bkokoski` | **200** | `bkokoski` | 20 | OK |
| `0xBossman` | 200, `0xBossman` | **200** | `0xBossman` | 1 | OK |
| `0xbossman` | 200, `0xBossman` | **200** | `0xBossman` | 1 | OK |
| `0xsweep` | 404 (ambiguë) | **404** | — | — | OK |
| `0xSweep` | 404 (ambiguë) | **404** | — | — | OK |

Toute casse mène au **handle canonique**, avec un décompte de wallets constant.
La paire ambiguë est refusée dans les deux sens — jamais l'une servie pour
l'autre. Aucune sur-résolution : le correctif ne rend joignable rien qui ne
doive l'être.

---

## 8 · Guard

| contrôle | attendu | observé | |
|---|---|---|---|
| sha256 sur `origin/main` | `ce13d0c0…3e50` | **`ce13d0c0f98748…9013e50`** | OK |
| `git diff cccac57 -- guard` | vide | **vide** | OK |
| exemptions ouvertes | 0 | **0** | OK |
| branches résiduelles BUILD 8 | 0 | **0** | OK |

Fenêtre d'exemption : `a512efc` 10:40:48Z → `964a562` 10:48:06Z → `39345a3`
10:53:15Z, soit **12 min 27 s**, refermeture **−54 lignes** exactement.

---

## 9 · CI

| commit | résultat |
|---|---|
| `a4cff7c` clôture E2/E1 | **success** |
| `39345a3` refermeture du guard | **success** |
| `964a562` câblage des 4 fichiers gelés | **success** |
| `a512efc` ouverture d'exemption | **success** |

Suite T2 : 4 743 verts / 4 745, 2 skipped, typecheck vert, 12/12 mutants tués.

> `15313cd` (mon rapport d'étape 9) apparaît en `cancelled` : run superseded par
> le push suivant. Le commit a été mergé avec ses checks verts, constatés avant
> merge. Sans effet sur le point 9.

---

## CE QUI RESTE POUR FERMER BUILD 8

**Un seul correctif**, sur `src/app/api/casefile/route.ts` — chemin gelé,
nécessitant une nouvelle fenêtre d'exemption :

1. Faire passer les trois appels on-chain (`fetchMetadata`, `fetchMarkets`,
   `fetchHolders`) sur `lookupKey` et non sur `sanitizeMint`. C'est ce qui
   supprime l'écart de score et l'enregistrement on-chain creux.
2. Déclarer l'actif sur le canonique : `asset.mint = lookupKey`.
3. Rendre la résolution **visible** dans la réponse — `input.type: "alias"` avec
   `input.value` canonique, ou un champ `resolved_from`. Une résolution
   silencieuse reste une résolution non auditable.
4. Vérifier `pdf/route.ts` et `public/route.ts`, câblés au même commit et
   susceptibles de porter la même moitié manquante.

Le contrat d'alias lui-même (`casefileLookupKey`, `assertCanonicalKeys`,
`isSyntheticRouteKey`) est correct et n'est pas en cause : il est appliqué à un
seul des deux consommateurs.

**Non traité, et hors périmètre :** `presets.ts` et `osint/signals`, retirés de
l'inventaire par T2 pour un motif que je n'ai pas réexaminé. Il reste vrai que
`/api/osint/signals` porte le 43 en dur ; sa qualification appartient à
l'arbitrage rendu, pas à cette validation.

---

## MÉTHODE

- Base : `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`, host asserté avant
  connexion, valeurs de connexion jamais imprimées.
- HTTP : `GET` uniquement — 32 handles, 10 variantes de casse, 8 appels
  casefile (dont 3 passes de stabilité), en-tête `x-admin-token`.
- Lecteur de nature exécuté depuis la source du commit déployé, sur les lignes
  réelles.
- Attente explicite du passage `Building → Ready` avant toute mesure : le
  déploiement précédent (`7a18jsiz0`) portait encore les défauts.
- Aucun code d'accès saisi, aucun formulaire soumis, aucun `POST`.
- `0 écriture · 0 DDL · 0 appel Helius.`
