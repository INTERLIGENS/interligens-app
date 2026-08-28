# HIGH_FREQUENCY — matrice FINALE avec D2 réelle, et DRY-RUN des 21

**Date :** 2026-08-29
**Branche :** `feat/cc-offline-45-shill-indiscriminate` — **non mergée**
**Coût Helius :** **20 appels exactement**, un par wallet, `getSignaturesForAddress(limit=1000)`,
**aucune pagination**. `fetchWalletProfile` en aurait fait trois par wallet (60) : on ne rappelle
pas ce qu'on détient déjà.
**Écritures :** **aucune**. Les 24 exclusions sont intactes, les 1 532 candidats en `draft`.
**Tests :** 97 verts.

---

## ⚠️ SURPRISE MAJEURE — la fréquence ne sépare rien

Le re-profilage contredit l'hypothèse implicite qui portait toute l'ancienne règle.

* **20 wallets sur 20 ont un échantillon saturé** (1 000 signatures). Aucun ne s'y soustrait.
* **16 sur 20 dépassent 200 tx/jour.** Les densités vont de **17,5/j à 121 348/j** — quatre
  ordres de grandeur.
* **Le meilleur signal du corpus tourne à 914 transactions par jour.** `pau23UpU2BFw`, l'unique
  `high_interest` à 91,25, couvre ses 1 000 signatures en **1,09 jour**.

Conséquence directe : **les profils « ciblés » ne sont pas des wallets lents.** Neuf des dix
tournent à un rythme de machine. Ce qui les sépare des indiscriminés n'est pas la fréquence — c'est
**ce qu'ils détiennent** (0 à 23 comptes de tokens) et **combien de KOL ils suivent** (un seul).

**Une règle de densité seule aurait exclu le meilleur signal du corpus.** C'est le quorum de deux
dimensions qui l'en empêche — et cette matrice le démontre sur données réelles, pas sur principe.

---

## 1. Densité réelle des 20

| | |
|---|---|
| Densité mesurable | **20 / 20** (aucune indéterminée) |
| Densité > 200/j (seuil R2) | **16 / 20** |
| Minimum | **17,5/j** (`HesCZFsE7KQW`, span 57,1 j) |
| Maximum | **121 348/j** (`8psNvWTrdNTi`, 1 000 signatures en **14 minutes**) |

Les spans extrêmes — 0,01 jour pour mille signatures — ne laissent aucun doute sur la nature
machinique de plusieurs de ces adresses. Mais ils ne disent pas *pour qui* elles travaillent.

## 2. MATRICE FINALE — R2 avec les trois dimensions réelles

`holdings > 100` · `density > 200/j` · `cross-KOL ≥ 3` · **quorum 2 dimensions**

| wallet | grp | score | classe | avoirs | KOL | densité/j | dimensions | verdict |
|---|---|---|---|---|---|---|---|---|
| `pau23UpU2BFw` | B | **91,25** | high_interest | 7 | 1 | 914,4 | `density` | **libéré** |
| `4zZRBMnMYMEW` | B | 78,63 | candidate | 2 | 1 | 41,2 | — | **libéré** |
| `7wBtZ982uR2c` | B | 78,63 | candidate | 15 | 1 | 402,0 | `density` | **libéré** |
| `HK3J9zTFz3qB` | B | 74,75 | candidate | 23 | 1 | 298,6 | `density` | **libéré** |
| `5UwMWJfVsgTK` | B | 74,75 | candidate | 4 | 1 | 386,2 | `density` | **libéré** |
| `omegoMAe1AMY` | B | 74,75 | candidate | 9 | 1 | 8 106,6 | `density` | **libéré** |
| `HesCZFsE7KQW` | B | 71,19 | candidate | 7 | 1 | 17,5 | — | **libéré** |
| `5veTCy9eDaL6` | B | 68,92 | candidate | 3 | 1 | 1 358,2 | `density` | **libéré** |
| `DbEh3Yah8wPt` | B | 64,83 | candidate | 23 | 1 | 23,6 | — | **libéré** |
| `4Zjbpf8TaJoS` | C | 63,13 | candidate | 2 | 2 | 770,6 | `density` | **libéré** |
| `BggnH7CGFp4X` | C | 63,13 | candidate | 6 | 2 | 509,5 | `density` | **libéré** |
| `AUQAzeNnW4p2` | B | 59,00 | watch | 0 | 1 | 64,3 | — | **libéré** |
| **`C7ML4W7cegR8`** | **A** | 59,00 | watch | **1 510** | 1 | **1 091,5** | `holdings`+`density` | **`indiscriminate_activity`** |
| `kEFiAX3jo5Nm` | C | 43,50 | watch | 11 | 2 | 37 305,7 | `density` | **libéré** |
| `7rbxsXchaL1J` | C | 34,75 | watch | 24 | 2 | 2 378,6 | `density` | **libéré** |
| `BGzLYcFcUZkW` | A | 28,63 | watch | 193 | 2 | 3 936,2 | `holdings`+`density` | **`indiscriminate_activity`** |
| `8psNvWTrdNTi` | A | 22,83 | watch | **567 495** | 3 | **121 348,3** | les 3 | **`indiscriminate_activity`** |
| `2tgUbS9UMoQD` | A | 17,00 | watch | 1 784 | 3 | 113 684,2 | les 3 | **`indiscriminate_activity`** |
| `1aDerPKk87xJ` | A | 17,00 | watch | 15 | 3 | 1 455,4 | `density`+`cross_kol` | **`indiscriminate_activity`** |
| `DZbgq3yE3r41` | A | 2,13 | watch | 209 | 3 | 8 269,5 | les 3 | **`indiscriminate_activity`** |

### Bilan

| | |
|---|---|
| **Faux signal évité** | **6 / 6** profils du groupe A restent exclus |
| **Ciblés (B) exclus à tort** | **0 / 10** |
| **Intermédiaires (C) exclus** | **0 / 4** |
| **Signal réel récupéré** | **11 surfaçants libérés**, dont l'unique `high_interest` |
| Exclus / libérés | **6 / 20** — **14 / 20** |

La séparation est **exacte** contre la lecture A/B/C : les six exclus sont exactement les six du
groupe A, ni plus, ni moins.

### Ce que D2 apporte, mesuré

Sans densité, R2 n'excluait que **3** wallets. Avec la densité réelle, elle en exclut **6** — et
les trois gagnés sont ceux que le seul critère d'avoirs manquait :

* **`C7ML4W7cegR8`** — 1 510 avoirs mais **un seul KOL** : sans D2, une dimension, donc libéré.
* **`BGzLYcFcUZkW`** — 193 avoirs, 2 KOL : sous le seuil `cross-KOL ≥ 3`.
* **`1aDerPKk87xJ`** — **15 avoirs seulement**, mais 3 KOL et 1 455/j. Aucun critère d'avoirs ne
  l'aurait attrapé. C'est le cas qui justifie à lui seul d'avoir persisté la mesure.

## 3. Le sort de `C7ML4W7cegR8`

**Exclu, et par la règle générale — pas par une exception nominative.**

```
avoirs   1 510  >  100   → dimension holdings  ✓
densité  1 091,5/j > 200 → dimension density   ✓
cross-KOL    1   <    3  → non satisfaite
                            quorum 2/3 atteint → indiscriminate_activity
```

C'est exactement le scénario anticipé : sa densité réelle dépasse le seuil, `holdings + density`
forment deux dimensions indépendantes, et le quorum tombe. Aucune clause ne le nomme.

Le contraste avec `pau23UpU2BFw` est ce qui rend le verdict défendable : **même ordre de densité**
(1 091 contre 914), et pourtant l'un est exclu et l'autre libéré — parce que l'un détient
1 510 tokens et l'autre 7. La dimension qui tranche est celle que la doctrine désigne comme
séparateur primaire.

## 4. DRY-RUN des 21 lignes historiques — AUCUNE ÉCRITURE

| KOL | wallet | score | avant | après (R2) |
|---|---|---|---|---|
| dexsignals | `pau23UpU2BFw` | 91,25 | `high_frequency` | **NULL (libéré)** |
| dexsignals | `4zZRBMnMYMEW` | 78,63 | `high_frequency` | **NULL** |
| dexsignals | `7wBtZ982uR2c` | 78,63 | `high_frequency` | **NULL** |
| dexsignals | `HK3J9zTFz3qB` | 74,75 | `high_frequency` | **NULL** |
| dexsignals | `5UwMWJfVsgTK` | 74,75 | `high_frequency` | **NULL** |
| dexsignals | `omegoMAe1AMY` | 74,75 | `high_frequency` | **NULL** |
| dexsignals | `HesCZFsE7KQW` | 71,19 | `high_frequency` | **NULL** |
| dexsignals | `5veTCy9eDaL6` | 68,92 | `high_frequency` | **NULL** |
| dexsignals | `DbEh3Yah8wPt` | 64,83 | `high_frequency` | **NULL** |
| dexsignals | `4Zjbpf8TaJoS` | 63,13 | `high_frequency` | **NULL** |
| dexsignals | `BggnH7CGFp4X` | 63,13 | `high_frequency` | **NULL** |
| empire_sol1 | `AUQAzeNnW4p2` | 59,00 | `high_frequency` | **NULL** |
| empire_sol1 | **`C7ML4W7cegR8`** | 59,00 | `high_frequency` | **`indiscriminate_activity`** |
| empire_sol1 | `kEFiAX3jo5Nm` | 43,50 | `high_frequency` | **NULL** |
| empire_sol1 | `7rbxsXchaL1J` | 34,75 | `high_frequency` | **NULL** |
| empire_sol1 | `BGzLYcFcUZkW` | 28,63 | `high_frequency` | **`indiscriminate_activity`** |
| dexsignals | `8psNvWTrdNTi` | 22,83 | `high_frequency` | **`indiscriminate_activity`** |
| empire_sol1 | `8psNvWTrdNTi` | 17,00 | `high_frequency` | **`indiscriminate_activity`** |
| empire_sol1 | `2tgUbS9UMoQD` | 17,00 | `high_frequency` | **`indiscriminate_activity`** |
| empire_sol1 | `1aDerPKk87xJ` | 17,00 | `high_frequency` | **`indiscriminate_activity`** |
| empire_sol1 | `DZbgq3yE3r41` | 2,13 | `high_frequency` | **`indiscriminate_activity`** |

**14 lignes libérées, 7 conservées** (`8psNvWTrdNTi` compte deux fois : il apparaît sous deux KOL).

| Exclusions | avant | après R2 |
|---|---|---|
| `high_frequency` | 21 | **0** (motif supprimé) |
| `indiscriminate_activity` | 0 | **7** |
| **`known_router`** | **3** | **3 — INTOUCHÉES** |
| **total** | **24** | **10** |

`known_router` repose sur une liste statique et une preuve directe : aucune dimension, aucun seuil,
aucun re-profilage ne la touche.

## 5. État de la persistance de D2

**D2 est déjà opérante dans le chemin de décision** : `classifyWalletProfile` lit
`profile.sampleSpanDays`, que `wallet-profile.ts` calcule à chaque profilage. Tout vetting futur
en bénéficie **sans un appel de plus**.

Ce qui manque est la **persistance**, pour rejouer un vetting sans rappeler Helius et pour auditer
si une exclusion passée reposait sur une mesure ou sur un plafond. Elle exige un DDL sur
`prisma/`, **chemin gelé par le guard** — donc préparée, non exécutée :

* `docs/prep/patches/MIGRATION_shill_sample_span_2026-08-28.sql` — additif, `ADD COLUMN IF NOT
  EXISTS` sur `walletSampleSpanDays` / `walletSampleSize` / `walletSampleSaturated`, réversible,
  sans backfill. À passer au Neon SQL Editor (`prisma migrate` verrouillé, A9).
* `docs/prep/patches/SCHEMA_shill_sample_span_2026-08-28.patch` — vérifié par `git apply --check`.

Les 20 spans mesurés aujourd'hui sont conservés hors base (scratchpad) et pourront être écrits au
même moment que la réévaluation, en une seule passe.

## 6. STOP

Aucune écriture. Aucun `UPDATE excludedReason`. Aucun merge. Les 24 exclusions et les 1 532
`reviewStatus = 'draft'` sont dans l'état où le replay du 2026-08-28 les a laissés.

**La réécriture contrôlée des 21 attend le feu vert sur cette matrice.**
