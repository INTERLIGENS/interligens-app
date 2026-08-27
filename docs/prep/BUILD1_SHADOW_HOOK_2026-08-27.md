# BUILD 1 V3 — MISE EN SHADOW

Branche `feat/cc-offline-109-token-resolution-v2` (rebasée sur `main`) ·
**rien mergé, rien déployé, rien poussé** · Neon `ep-square-band` en lecture
seule · aucune écriture DB · aucune migration · aucun chemin gelé touché, donc
**aucune exemption demandée**.

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `vitest run` | **330 fichiers · 3 896 tests · 0 échec** (2 ignorés) |
| `eslint .` | **0 erreur** (226 avertissements préexistants) |
| `guard-offline.sh` | ✅ 52 fichiers au diff, aucun chemin interdit |

---

## 1. RÉ-ÉTIQUETAGE ET GEL DU CORPUS

### Ce qui était faux

Deux cas portaient une étiquette `PENDING_POLICY` qui désignait l'option **non
retenue** à l'arbitrage du 2026-08-27. Les compter comme de fausses résolutions,
c'était compter le désaccord d'une étiquette périmée avec la doctrine qui l'avait
remplacée.

| Cas | Étiquette abandonnée | Doctrine ratifiée |
|---|---|---|
| **I3** | `AMBIGUOUS` | **RESOLVED, plafonné MODERATE** — une source sans marché peut IDENTIFIER, jamais CERTIFIER |
| **R22** | écarté comme temporellement impossible | **RETENU** — 10 j d'écart sur une preuve d'ACTIVITÉ tombent sous la tolérance de 30 j, également ratifiée |

R22 mérite un mot : ce qui a été ratifié est le **mécanisme** — hors tolérance,
on ÉCARTE, on ne déclasse pas. Le cas qui a motivé ce mécanisme tombe, lui, du
côté retenu. Les deux décisions sont cohérentes ; la seconde décide du sort de la
première.

Chaque fiche conserve son `supersededLabel`, et un test vérifie qu'il **diffère**
du verdict ratifié — une ré-étiquette dont on efface la trace ne se conteste plus.

### Le gel

`__tests__/anti-regression/token-resolution-v3-corpus.test.ts` — 20 tests.

- **Corpus factuel** : les 5 faux CRITICAL (E4, E5, S01, S05, K6). **FRR = 0,
  aucune exception tolérée.**
- **Corpus doctrinal** : I3, R22-in, R22-out, E7b, S04-in-scope, S04-out-of-scope,
  chacun confronté au verdict ratifié.

**Déterminisme prouvé, pas affirmé** : aucun réseau (le client sur fixtures
échoue explicitement sur une URL non enregistrée, il ne retombe jamais sur le
vrai DexScreener), aucune base (`createFakeDb` applique les filtres du SQL réel),
aucune horloge. Un test compare deux passages **champ pour champ**, un autre
vérifie qu'aucune URL demandée n'échappe aux fixtures.

**Mutation vérifiée** : tolérance faible ramenée de 30 j à 1 j → **2 tests
tombent**.

### Ce que ce gel NE couvre PAS

Le backtest de 91 cas cité dans `BUILD1_V3_READY_FOR_SHADOW` **n'a jamais été
versionné** — il vivait dans la session du harnais T2. Ce qui est gelé ici est le
corpus présent dans le dépôt : **5 cas factuels et 6 doctrinaux**, pas les 91. La
distinction compte, et elle est écrite en tête du fichier : ce gel prouve que les
cas connus tiennent, il ne rejoue pas un taux mesuré sur un corpus qu'il n'a pas.

---

## 2. HOOK SHADOW

`src/lib/watcher-bridge/shadowResolveV3.ts` (290 lignes) + 41 lignes dans
`promoteWatcherSignalsToDraft.ts`. **`src/lib/watcher-bridge/` n'est pas gelé.**

V3 est lancé **avant** l'await de V1, pour tourner pendant lui et ne rien coûter
en temps de mur. `allowedChains: ["SOL"]` — pas de sondage EVM, aucune chaîne que
V1 n'aurait pas regardée.

### Garanties

- **Jamais consommé.** Le hook ne renvoie rien d'utilisable comme résolution : il
  produit une ligne de journal. Ni TigerScore, ni REFLEX, ni la publication, ni
  Decision ne voient ce qui en sort.
- **Ne lève jamais.** Toute erreur devient un champ `agreement: "v3_error"`.
- **Journal applicatif seul** — `[token-resolution:shadow]`. Pas de table, pas de
  migration.
- **Zéro donnée nominative** : ni handle KOL, ni texte de post, ni identifiant de
  candidat ou de campagne, ni URL. Seulement le ticker, les adresses de contrat
  (données publiques de chaîne) et des compteurs.

### La ligne de comparaison

`policyVersion` · `input` (ticker, adresses, présence de texte brut, observedAt,
allowedChains) · `v1` (status, confidence, method, mint, chain) · `v3` (idem +
callerSupport, candidateCount, excludedCount) · `agreement` · `reason` ·
`exclusionReasons` · `conflictKinds` · `limitations` · `providerUsage` (appels,
cache, échecs, dbQueries, refus de budget) · `latencyMs` · `error`.

`agreement` ∈ `same_mint` · `different_mint` · `v1_only` · `v3_only` ·
`both_none` · `v3_error`.

---

## 3. LE CHEMIN V1 NE CHANGE PAS — prouvé

`shadowHookIsolation.test.ts` rejoue **le même candidat** dans trois régimes et
compare les résultats champ pour champ :

| Régime | Résultat |
|---|---|
| ombre éteinte | référence |
| ombre allumée, V3 rendant un mint **divergent** | **identique** |
| ombre allumée, V3 **qui explose** | **identique** |

Plus : le mint servi reste celui de V1 (`MINT_V3` absent du résultat sérialisé),
V1 est appelé exactement une fois avec ses arguments d'origine, et ombre éteinte
⇒ V3 n'est pas appelé du tout.

**Mutation vérifiée** : faire fuiter `shadow.v3.selected.address` dans
`resolution.canonicalMint` → **3 tests tombent**.

---

## 4. UN INVARIANT QUE J'AI DÛ RÉÉCRIRE

`module-naming.test.ts` interdisait qu'un fichier importe à la fois V1 et V3.
Le hook shadow le viole **par construction** — comparer, c'est toucher les deux.

L'invariant existait pour empêcher un mélange **accidentel**. Il en existe
désormais un **délibéré**. Plutôt que d'assouplir la règle, je l'ai inscrit
nommément : la liste des fichiers autorisés à toucher les deux contient
exactement `shadowResolveV3.ts`, sans joker. Tout NOUVEAU mélange reste donc une
régression visible. Un test supplémentaire vérifie que l'ombre n'exporte aucun
verdict V3 consommable.

---

## 5. CE QUI RESTE À TON ARBITRAGE

**L'ombre est allumée par défaut**, avec un coupe-circuit
`TOKEN_RESOLUTION_V3_SHADOW=0`. Il existe pour une raison précise, et c'est le
seul chemin par lequel l'ombre pourrait atteindre V1 : **V3 et V1 tapent les
mêmes fournisseurs depuis la même IP**. Le couplage n'est pas dans le code — il
est dans un quota partagé. Si un run collecte des 429, DexScreener peut
commencer à refuser les appels de V1 aussi.

Le code est isolé, c'est prouvé. Le quota ne l'est pas. Je recommande d'armer sur
un run à faible volume et de lire `providerUsage` avant d'ouvrir en grand.
