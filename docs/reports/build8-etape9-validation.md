# BUILD 8 — ÉTAPE 9 · validation produit/API après déploiement

Validation **lecture seule**. 0 écriture, 0 DDL, 0 Helius. Toutes les lectures
base en `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`, cible `ep-square-band`
assertée avant connexion. Aucun code d'accès saisi.

| | |
|---|---|
| `main` | `b4642fc` — conforme au contexte ratifié |
| guard | `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50` — conforme |
| déploiement | `interligens-7a18jsiz0`, **Ready**, Production, 9 min avant la mesure |
| base | `ep-square-band` · 3 colonnes + 2 CHECK + 1 index présents |
| horodatage | 2026-09-07, ~10:02–10:12 UTC |

---

## VERDICT D'ENSEMBLE

**3 items sur 4 conformes. 1 item KO, 1 item conforme avec une réserve
mesurée.** Les deux écarts sont rapportés tels quels ; aucun n'est une
régression BUILD 8, les deux préexistaient au câblage.

| # | objet | verdict |
|---|---|---|
| 1 | wallets 229 → 164 · aucun non publiable servi | **CONFORME avec réserve** — filtre exact, mais 126 des 164 sont injoignables en HTTP |
| 2 | rang `exact` 482 → 15 · aucun `exact`/`manual` en dur | **CONFORME** |
| 3 | mint BOTIFY 44 car. · le 43 jamais accepté | **KO** — `/api/casefile` accepte le 43 et n'accepte que lui |
| 4 | 76 lignes NULL → `UNCLASSIFIED` · non exposées | **CONFORME** |

---

## 1 · `/api/kol/[handle]` — publiabilité des wallets

### Vérité terrain (ep-square-band, lecture seule)

| mesure | attendu | observé | |
|---|---|---|---|
| profils publiés (`PUBLIC_KOL_FILTER`) | 32 | **32** | OK |
| wallets avant filtre | 229 | **229** | OK |
| wallets après `PUBLISHABLE_WALLET_FILTER` | 164 | **164** | OK |
| retirés | 65 | **65** | OK |
| dont via `isPubliclyUsable` | 65 | **65** | OK |
| dont via `status <> 'active'` | 0 | **0** | OK |
| profils touchés | 21 | **21** | OK |

La base confirme le chiffre ratifié **au wallet près**.

### Ce qui est réellement servi en HTTP

| mesure | attendu | observé | |
|---|---|---|---|
| profils joignables sur 32 | 32 | **11** | **ÉCART** |
| profils en HTTP 404 | 0 | **21** | **ÉCART** |
| wallets servis, total | 164 | **38** | **ÉCART** |
| wallets `isPubliclyUsable=false` servis | 0 | **0** | OK |
| wallets `status <> active` servis | 0 | **0** | OK |

**Le filtre lui-même est exact.** Sur les 11 profils joignables, l'API sert
**38** wallets et la base en attend **38** — correspondance parfaite, profil par
profil :

| handle | en base | attendu servi | servi par l'API |
|---|---|---|---|
| `bkokoski` | 22 | 20 | **20** |
| `ghostwareos` | 6 | 6 | **6** |
| `lynk0x` | 8 | 6 | **6** |
| `sxyz500` | 8 | 4 | **4** |
| `sibeleth` | 1 | 1 | **1** |
| `wulfcryptox` | 1 | 1 | **1** |
| `deployer_pool` | 29 | 0 | **0** |
| `ravedao` | 6 | 0 | **0** |
| `planted` | 1 | 0 | **0** |
| `dione-protocol` | 0 | 0 | **0** |
| `loud_token_victims` | 0 | 0 | **0** |
| **total** | **82** | **38** | **38** |

Les **126 wallets publiables restants** vivent sur les 21 profils injoignables.
`38 + 126 = 164` : l'arithmétique boucle, le chiffre ratifié est juste, mais il
décrit la base — pas ce que l'API sert.

### Cause de l'écart — antérieure à BUILD 8

```
src/app/api/kol/[handle]/route.ts:17
  const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, "")

src/lib/kol/canonical.ts:297
  const row = await prisma.kolProfile.findUnique({ where: { handle }, ... })
```

La route abaisse la casse ; `findUnique` fait une égalité stricte. **Tout profil
dont le handle porte une majuscule est structurellement injoignable**, quelle
que soit la casse de l'URL. Les 11 profils qui répondent sont exactement les 11
handles entièrement en minuscules.

Les 21 en 404 : `0xBossman`, `Barbie`, `Blackbeard`, `Brommy`, `CoachTY`,
`CryptoZin`, `DonWedge`, `EduRio`, `ElonTrades`, `Exy`, `Geppetto`,
`GordonGekko`, `HalieyWelch`, `HaydenDavis`, `JMilei`, `James`, `Myrrha`,
`Nekoz`, `OrbitApe`, `Ronnie`, `SolanaRockets`.

**Ce n'est pas une régression BUILD 8.** `git show cccac57:…/route.ts` porte déjà
le `.toLowerCase()` et le même `findUnique`. BUILD 8 n'a ajouté que le `where`
de publiabilité. Le défaut est antérieur et hors périmètre du câblage.

> La seconde requête de la route (`relations`) utilise, elle,
> `mode: "insensitive"` — les deux lectures du même handler ne suivent pas la
> même règle de casse. C'est la contradiction qui rend le défaut invisible en
> relecture.

**Verdict : filtre CONFORME · couverture NON CONFORME.** Aucun wallet non
publiable ne sort — l'exigence de sécurité est tenue. Mais « 164 servis » n'est
pas observable : 77 % des wallets publiables sont derrière un 404.

---

## 2 · Attribution — le rang `exact`

Règle réelle appliquée (`deriveAttributionConfidence`) :
`attributionStatus = 'confirmed'` **ET** `claimType = 'verified_onchain'`.

| mesure | attendu | observé | |
|---|---|---|---|
| lignes `KolWallet` | 482 | **482** | OK |
| rang `exact` | 15 | **15** | OK |
| rang `strong` | 246 | **246** | OK |
| rang `probable` | 215 | **215** | OK |
| rang `candidate` | 6 | **6** | OK |
| revue humaine requise | 232 | **232** | OK |
| `source = on_chain_footprint` | 19 | **19** | OK |

`15 + 246 + 215 + 6 = 482` — la partition est complète, sans reste.

### Aucun `exact` / `manual` codé en dur dans une réponse

| contrôle | attendu | observé | |
|---|---|---|---|
| `"confidence":"exact"` dans les 11 réponses | 0 | **0** | OK |
| `"source":"manual"` dans les 11 réponses | 0 | **0** | OK |
| colonne `confidence` valant `exact` en base | 0 | **0** | OK |
| `attributionSource` dans le vocabulaire mort¹ | 0 | **0** | OK |

¹ `manual`, `on_chain_footprint`, `airdrop`, `promotion_tx`, `inferred` — les
cinq valeurs que la colonne ne porte pas. Confirmé : **0 sur 482**.

La colonne `confidence` porte `high` 259 · `medium` 215 · `low` 5 ·
`suspected` 2 · `confirmed` 1. Jamais `exact`.

> **À noter, sans que ce soit un écart** : les objets wallet servent les
> colonnes brutes verbatim (`confidence: "high"`, `attributionSource:
> "leaked_doc"`). C'est le comportement voulu de `declaredSourceLabel` — la
> provenance déclarée, jamais normalisée. Le rang dérivé sort séparément, dans
> `identityConfidence` au niveau du snapshot.

**Verdict : CONFORME.**

---

## 3 · Mint BOTIFY — 44 caractères

```
mint canonique   BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb   44 car.
clé synthétique  BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb    43 car.
```

### Base — conforme

| colonne | 44 car. attendu | 44 car. observé | 43 car. |
|---|---|---|---|
| `KolProceedsEvent.tokenAddress` | 262 | **262** | **0** |
| `KolTokenLink.contractAddress` | 5 | **5** | **0** |
| `KolTokenInvolvement.tokenMint` | 3 | **3** | **0** |

### Garde d'identité — conforme

| appel | attendu | observé | |
|---|---|---|---|
| `isTokenMint(44)` | `true` | **`true`** | OK |
| `isTokenMint(43)` | `false` | **`false`** | OK |
| `isSyntheticRouteKey(43)` | `true` | **`true`** | OK |
| `assertTokenMint(43)` | lève | **`SyntheticKeyAsMintError`** | OK |
| `resolveToCanonicalMint(43)` | → 44 | **→ 44** | OK |
| `kolHandleToCanonicalMint(bkokoski\|GordonGekko\|gordongekko\|planted)` | 44 | **44** | OK |

### `/api/casefile` — **KO**

| requête | attendu | observé |
|---|---|---|
| `?mint=<44 car.>` | dossier BOTIFY | HTTP 200 · `offchain_source: "none"` · **verdict GREEN, score 0**, « Aucun signal majeur detecte » · données on-chain réelles (supply, decimals, pool) |
| `?mint=<43 car.>` | **refus** | HTTP 200 · `offchain_source: "case_db"` · **verdict RED, score 70** · `name: "Botify"`, `symbol: "BOTIFY"` · récit retail complet · **aucune donnée on-chain** |

**Le 43 caractères est accepté comme mint, et c'est la seule clé qui rend le
dossier BOTIFY.** Le mint canonique, lui, rend un dossier vide et GREEN. La
contradiction que BUILD 8 décrit — deux identités à un caractère près servant le
même écran — reste ouverte sur cette surface, et dans le sens le plus fâcheux :
la clé qui n'existe dans aucune ligne de la base est celle qui porte le verdict.

Cause, `src/app/api/casefile/route.ts:6` :

```ts
const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";   // 43 car.
```

Constante locale, 43 caractères, aucun import de `tokenIdentity`, aucun appel au
garde. Le même littéral est codé en dur dans **9 autres fichiers** :

```
src/app/api/casefile/pdf/route.ts:44
src/app/api/casefile/public/route.ts:43
src/app/api/osint/signals/route.ts:51
src/app/[locale]/demo/page.tsx:183
src/app/fr/demo/page.tsx:334, 349
src/app/en/demo/page.tsx:334, 356
src/app/en/demo/review/page.tsx:9
```

**Hors périmètre BUILD 8**, et donc pas une régression : `42be59a` n'a touché que
4 fichiers (`api/kol/[handle]/route.ts`, `canonical.ts`, `handleToMint.ts`,
`identity.ts`). Le garde a été construit ; il n'a pas encore été branché ici.

### Pages KOL `/en` et `/fr` — non observable

Les deux pages importent `kolHandleToCanonicalMint` et résolvent donc sur le 44 :

```
src/app/en/kol/[handle]/page.tsx:15,249
src/app/fr/kol/[handle]/page.tsx:13,255
```

**Vérifié dans la source du commit déployé, pas observé au rendu.**
`/en/kol/bkokoski`, `/fr/kol/bkokoski` et `/kol/bkokoski` redirigent vers
`/access` — gate beta NDA exigeant un code d'accès. Aucun code n'a été saisi.
La vérification au rendu reste **à faire par un porteur de code**.

**Verdict : base et garde CONFORMES · `/api/casefile` KO · pages NON OBSERVÉES.**

---

## 4 · Colonnes de nature

### Migration

| objet | attendu | observé | |
|---|---|---|---|
| `amountUsdNature` | enum, nullable | **`USER-DEFINED` (`DataNature`), nullable** | OK |
| `amountUsdBasis` | jsonb, nullable | **`jsonb`, nullable** | OK |
| `amountUsdMethodRef` | text, nullable | **`text`, nullable** | OK |
| CHECK | 2 | **2** (`_estimate_auditable`, `_methodRef_grammar`) | OK |
| index | 1 | **1** (`KolProceedsEvent_amountUsdNature_idx`) | OK |

### Répartition — conforme au chiffre près

| nature | lignes attendues | lignes observées | somme attendue | somme observée | |
|---|---|---|---|---|---|
| `INFERENCE` | 5 407 | **5 407** | 15 292 470,58 $ | **15 292 470,58 $** | OK |
| `THIRD_PARTY_DATA` | 7 | **7** | 2 104 408,00 $ | **2 104 408,00 $** | OK |
| `ESTIMATE` | 112 | **112** | 93 048,19 $ | **93 048,19 $** | OK |
| `NULL` | 76 | **76** | — | 63 105,16 $ | OK |
| **total** | 5 602 | **5 602** | | | OK |

### Le lecteur applicatif

`amountUsdNature()` exécutée sur **les 5 602 lignes réelles** — le lecteur dérive
depuis `pricingSource`, il ne lit pas la colonne :

| contrôle | attendu | observé | |
|---|---|---|---|
| accord lecteur ↔ colonne | 5 602 | **5 602** | OK |
| désaccords | 0 | **0** | OK |
| lignes colonne `NULL` | 76 | **76** | OK |
| dont le lecteur rend `UNCLASSIFIED` | 76 | **76** | OK |
| dont le lecteur rend autre chose | 0 | **0** | OK |
| `ESTIMATE` inauditable | 0 | **0** | OK |
| nature sans montant | 0 | **0** | OK |

Les 76 lignes NULL rendent **toutes** `UNCLASSIFIED`, sans exception.

### Exposition publique

| surface (sans jeton) | attendu | observé | |
|---|---|---|---|
| `/api/kol/bkokoski` | pas de nature | **HTTP 401** | OK |
| `/api/v1/kol/bkokoski` | pas de nature | **HTTP 401** | OK |
| `/api/casefile/public?mint=<44>` | pas de nature | **HTTP 401** | OK |
| `/api/casefile/public?mint=<43>` | pas de nature | **HTTP 401** | OK |

Aucune sortie publique n'existe sans jeton. `natureValue: "UNCLASSIFIED"`
n'apparaît que dans la réponse authentifiée — porté par le wallet, aux côtés de
`rowNature: null` : le lecteur assume l'absence au lieu de la masquer.

**Verdict : CONFORME.**

---

## LES DEUX ÉCARTS — ce qu'ils sont, ce qu'ils ne sont pas

| | E1 — 21 profils en 404 | E2 — le 43 accepté par `/api/casefile` |
|---|---|---|
| effet | 126 des 164 wallets publiables injoignables | le dossier BOTIFY ne sort que sur une clé absente de la base |
| régression BUILD 8 ? | **non** — présent à `cccac57` | **non** — fichier hors des 4 du câblage |
| cause | `.toLowerCase()` + `findUnique` strict | constante locale 43 car., garde non branché |
| sécurité | aucune fuite : le filtre ne laisse rien passer | aucune fuite : verdict RED sur clé de démo |
| corrigeable | 1 ligne (`findFirst` + `insensitive`) | brancher `resolveToCanonicalMint` sur 10 fichiers |

Aucun des deux ne remet en cause les cinq contrôles de sortie de l'étape 8, tous
reconfirmés ici indépendamment.

---

## RESTE À FAIRE

1. **Pages KOL au rendu** — `/en/kol/*` et `/fr/kol/*` derrière le gate beta.
   À vérifier par un porteur de code d'accès. La source dit 44 ; le rendu n'a pas
   été observé.
2. **E1** — décider si la casse des handles entre dans BUILD 8 CLOSE ou part en
   ticket propre.
3. **E2** — brancher le garde d'identité sur les 10 fichiers qui portent encore
   le 43 en dur.

---

## MÉTHODE

- Lectures base : `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`, host asserté
  `ep-square-band` avant connexion, valeurs de connexion jamais imprimées.
- Lectures HTTP : `GET` uniquement, 32 handles + 4 surfaces publiques + 2
  casefile, en-tête `x-admin-token`.
- Lecteur de nature exécuté depuis la source du commit déployé, sur les lignes
  réelles.
- Aucun code d'accès saisi, aucun formulaire soumis, aucun `POST`.
- `0 écriture · 0 DDL · 0 appel Helius.`
