# HIGH_FREQUENCY — retrait de la règle invalide, matrice des règles candidates

**Date :** 2026-08-28
**Branche :** `feat/cc-offline-45-shill-indiscriminate` — **non mergée**
**Mode :** aucune écriture base, **aucun appel Helius**, aucune pagination. Neon lecture seule.
Les 24 exclusions sont intactes, les 1 532 candidats restent en `reviewStatus = 'draft'`.
**97 tests verts.**

---

## 1. La règle invalide est retirée (branche seulement)

`VET_THRESHOLDS.highFrequencyTx30d = 750` et le motif `high_frequency` **n'existent plus**.
Le motif `too_many_tokens` disparaît aussi comme cause autonome : il devient une *dimension*.

Motifs restants : **`indiscriminate_activity`** (comportemental, multi-dimensions) et
**`bot_infra`** (preuve directe : interaction avec une adresse d'infrastructure connue).

## 2. `sampleSaturated` devient explicite — et inoffensif

Deux invariants sont désormais **structurels**, pas documentaires.

### SHILL-C1 — une valeur plafonnée n'est pas une mesure

`measurement.ts` introduit un type qui porte sa propre censure :

```ts
interface Measurement { value: number; censored: boolean; censoredBy: string | null }
compareToThreshold(m, seuil): "above" | "below" | "indeterminate"
```

Une comparaison sur valeur censurée **ne rend pas un booléen** — elle rend `indeterminate`, et
l'appelant doit en faire quelque chose. `assertUsableAsCount()` lève sur toute tentative de lire
une valeur censurée comme un comptage. Le cas réel est verrouillé par test :
`txCount30d = 1000` saturé n'exclut plus rien à lui seul.

### SHILL-C2 — l'état de la collecte n'est pas une affirmation comportementale

`sampleSaturated` est **rapporté** dans le verdict (`collectionSaturated`) pour l'audit, et
**consulté par aucune décision**. Un test vérifie que les dimensions du vetting sont exactement
`["holdings", "density", "cross_kol"]` — la saturation n'en fait pas partie, et ne peut donc pas
en devenir une par inadvertance.

## 3. `indiscriminate_activity` — trois dimensions indépendantes, deux requises

| Dim | Mesure | Rôle |
|---|---|---|
| **D1 `holdings`** | `distinctTokenAccounts` | **séparateur primaire** — non plafonné par le sampler |
| **D2 `density`** | `sampleSize / sampleSpanDays` (tx/jour) | signal secondaire |
| **D3 `cross_kol`** | KOL distincts touchés | contexte de corrélation |

Trois garde-fous inscrits dans le code :

* **`requiredDimensions < 2` lève.** Une exclusion sur une seule dimension est structurellement
  impossible — c'est ce qui a produit l'accident précédent.
* **Une dimension indéterminée ne contribue jamais.** On n'exclut pas sur une donnée absente.
* **`zone_a` est absent des dimensions, à dessein.** S'en servir fermerait la boucle : on
  écarterait les wallets *parce qu'ils présentent le phénomène étudié*. Il reste disponible pour
  l'analyse.

**Ce que la densité récupère.** Le plafond détruit le comptage sur 30 jours mais **pas la
densité** : 1 000 signatures couvrant 3 jours font 333/jour, exactement, pour cette fenêtre.
Un test le montre — deux wallets portant le même `1000` saturé, l'un sur 2 jours, l'autre sur
29, sont désormais **séparés** ; l'ancien seuil les confondait. Zéro appel supplémentaire.

## 4. DRY-RUN — avant / après sur les exclusions actuelles

Population : les **20 wallets** aujourd'hui `high_frequency`. Données **persistées uniquement**.

> **Limite à connaître avant de lire la matrice.** `sampleSpanDays` n'a **jamais été persisté** :
> D2 est donc **indéterminée pour les 20**, et ne peut contribuer à aucune exclusion dans ce
> backtest. La matrice mesure donc les règles avec **2 dimensions sur 3 disponibles**. C'est
> pessimiste sur l'exclusion, jamais permissif sur la libération.

| | avant | R1 | R2 | R3 |
|---|---|---|---|---|
| `high_frequency` | **21** | — | — | — |
| `indiscriminate_activity` | — | **0** | **3** | **4** |
| `known_router` | 3 | **3** | **3** | **3** |
| **total exclusions** | 24 | 3 | 6 | 7 |

## 5. LA MATRICE

Lecture des groupes : **A** = profil indiscriminé (≥3 KOL ou >100 comptes de tokens),
**B** = profil ciblé (1 KOL, ≤25 comptes), **C** = intermédiaire (2 KOL).
*Ce classement est une lecture proposée le 2026-08-28, pas une vérité terrain.*

| Règle | Seuils | Population exclue | Faux signal évité | Signal réel récupéré | Ciblés exclus à tort |
|---|---|---|---|---|---|
| **R1** `holdings-legacy` | avoirs > 50 · une seule dimension exploitable | **0 / 20** | **0 / 6** | 11 surfaçants (dont le `high_interest`) | 0 / 10 |
| **R2** `two-of-three-conservative` | avoirs > 100 · densité > 200/j · KOL ≥ 3 | **3 / 20** — `8psNvWTrdN`, `2tgUbS9UMo`, `DZbgq3yE3r` (tous A) | **3 / 6** | **11 surfaçants (dont le `high_interest`)** | **0 / 10** |
| **R3** `two-of-three-permissive` | avoirs > 50 · densité > 100/j · KOL ≥ 2 | **4 / 20** — les 3 ci-dessus + `BGzLYcFcUZ` (A) | **4 / 6** | **11 surfaçants (dont le `high_interest`)** | **0 / 10** |

### Contrôles exigés

| Contrôle | R1 | R2 | R3 |
|---|---|---|---|
| `pau23UpU2BFw` — 91,25, `high_interest` | **libéré** ✅ | **libéré** ✅ | **libéré** ✅ |
| Les 10 profils ciblés (groupe B) | 10 libérés ✅ | 10 libérés ✅ | 10 libérés ✅ |
| Les 6 indiscriminés (groupe A) | 0 retenus ❌ | 3 retenus | **4 retenus** |
| `C7ML4W7cegR8` — 1 510 comptes de tokens | **libéré** ⚠️ | **libéré** ⚠️ | **libéré** ⚠️ |
| `known_router` (3) | intactes ✅ | intactes ✅ | intactes ✅ |

### Les trois enseignements

1. **R1 ne peut structurellement rien exclure.** Avec une seule dimension exploitable et deux
   requises, elle n'atteint jamais le quorum. C'est le témoin nul de la matrice : il montre que
   l'exigence multi-dimensions n'est pas décorative.
2. **Aucune des trois n'exclut un profil ciblé.** Les 11 candidats surfaçants — dont l'unique
   `high_interest` à 91,25 — sont libérés par les trois. Le signal réel est intégralement récupéré
   dans tous les scénarios.
3. **Le prix à payer est nommé : `C7ML4W7cegR8` s'échappe.** 1 510 comptes de tokens, mais un seul
   KOL — donc une seule dimension satisfaite, donc pas de quorum. **Et c'est précisément le wallet
   que D2 trancherait** : avec `sampleSpanDays` persisté, avoirs + densité feraient deux
   dimensions. `1aDerPKk87xJ` (3 KOL, 15 comptes) s'échappe symétriquement, par l'autre bout.

## 6. Ce que la matrice ne peut pas dire

* **D2 n'est pas testée sur données réelles.** Elle est testée sur fixtures, où elle sépare bien
  ce que l'ancien seuil confondait. Pour la mesurer sur les 20, il faudrait **persister
  `sampleSpanDays`** — la valeur est déjà calculée par `wallet-profile.ts`, simplement jetée.
  **Aucun appel Helius supplémentaire n'est requis pour les futurs vettings** ; seuls les
  20 wallets déjà vettés demanderaient un re-profilage (20 appels, pas de pagination).
* **Le groupement A/B/C est une lecture, pas une vérité.** La matrice mesure les règles contre
  cette lecture. Un désaccord sur le groupement déplace les chiffres.
* **20 wallets ne fondent pas un seuil.** Le trou 0–24 vs 193–567 495 est net, mais il est mesuré
  sur la population même qu'il doit trancher. Aucun seuil n'est figé ici, conformément à la consigne.

## 7. STOP

Rien n'est écrit en base. Aucun `UPDATE excludedReason`. Les 21 `high_frequency` et les
3 `known_router` sont intactes. La branche n'est pas mergée.

La réévaluation des 21 attend la validation de cette matrice.
