# PACK W2 — la correction tracée des 482 M$

**À APPLIQUER À LA MAIN, UN FICHIER À LA FOIS. Rien n'a été exécuté.**
Neon SQL Editor uniquement, jamais `prisma migrate` (verrou A9).

## Ce qui est corrigé, et ce qui ne l'est pas

Le montant **est juste**. `100 000 000 LAB × ~4,82 $ ≈ 482 M$`, l'arithmétique
se reproduit, le prix tombe dans la fourchette documentée du 11–12 mai 2026, et
l'observation de départ est tracée et datée par ZachXBT.

Ce qui était faux, c'est ce qu'il **affirmait**. Il mesure ce que des insiders
ont sorti ; il était publié comme ce que des particuliers ont perdu. Le casefile
le nomme pourtant lui-même « Estimated exit value (100M LAB) ».

**Aucun chiffre n'est corrigé, inventé ou recalculé.** Le montant est *déplacé*
vers un champ qui le décrit, et le préjudice retail redevient **non estimé**.

## Ordre d'exécution

| # | Fichier | Écrit | Lignes | Dépend de |
|---|---|---|---|---|
| 0 | `00_DDL_insider_exit_notional.sql` | 3 colonnes | 0 | — |
| 1 | `01_move_notional_value.sql` | montant + nature + basis | **1** | 00 |
| 2 | `02_null_retail_harm.sql` | `estimatedRetailHarmUsd = NULL` | **1** | **01** |

**Le 02 ne peut pas passer avant le 01** — son prédicat exige
`insiderExitNotionalValueUsd = 482000000`. Si le 01 n'a pas tourné, le 02 écrit
0 ligne. C'est le garde qui empêche de vider l'ancien champ sans destination.

## Les deux étages de nature

| Étage | Affirmation | Nature | Pourquoi |
|---|---|---|---|
| 1 | « 100M LAB attribués/tracés à la sortie insiders » | `THIRD_PARTY_DATA` | Observation attribuée à **ZachXBT**, pas une observation primaire INTERLIGENS |
| 2 | « 100M LAB × ~4,82 $ ≈ 482 M$ » | `ESTIMATE` | Valorisation notionnelle **dérivée** — la multiplication est notre opération, même si son entrée ne l'est pas |

C'est l'étage 2 que porte la colonne. Le `natureBasis`
(`insiderExitNotionalBasis`, jsonb) rend l'étage 1 relisible depuis l'étage 2 :
quantité, attribution, fenêtre d'observation, prix de référence et sa
dérivation, formule, caveat de flottant.

## Aucune méthodologie n'est associée

Le basis inscrit les deux exclusions **explicitement**, pour que personne ne les
recolle plus tard par ressemblance :

- `financial-estimates/est-proceeds@v1` — **non applicable** : son composant
  `realized-unrealized` exclut le non-réalisé, et un retrait vers des wallets
  neufs est un transfert sans flux de valeur en regard.
- `financial-estimates/est-investor-losses@v1` — **non applicable** : il mesure
  la valeur des tokens achetés par des wallets **non-insiders**, autre grandeur
  et autre population.

## `estimatedRetailHarmUsd` redevient NULL

`UNKNOWN / NOT ESTIMATED` est la réponse honnête aujourd'hui. Le calculer
exigerait des données non-insiders qu'on n'a pas. Inventer un ordre de grandeur
« plus prudent » serait refaire la faute d'origine dans l'autre sens.

Ce n'est pas une suppression : le fichier 01 a déjà copié le montant, et le
garde du 02 refuse de vider l'ancien champ tant que le nouveau n'est pas peuplé.
La doctrine « NEVER DELETE » est tenue **par déplacement** — garder 482 M$ dans
les deux colonnes laisserait la surface libre de continuer à lire la mauvaise.

## Les propriétés tenues

**Additif** — 3 `ADD COLUMN IF NOT EXISTS` nullables sans `DEFAULT`. Aucun
`DROP`, **aucun `DELETE`**.

**Rejouable** — le 01 est gardé par `insiderExitNotionalValueUsd IS NULL`, le 02
par la présence du montant déplacé. Relancer ne produit rien.

**Jamais d'`UPDATE` global** — 2 `UPDATE`, chacun sur `ref = 'IL-PND-LAB-001'`,
compte attendu 1. **Une cardinalité différente = ARRÊT.** Un contrôle de
non-régression vérifie que `IL-CONC-BLACKBULL-001` n'est jamais touchée.

## État final attendu

| Champ | Valeur |
|---|---|
| `estimatedRetailHarmUsd` | **NULL** — non estimé |
| `estimatedRetailHarmUsdNature` | NULL |
| `insiderExitNotionalValueUsd` | **482000000** |
| `insiderExitNotionalValueUsdNature` | `ESTIMATE` |
| `insiderExitNotionalBasis` | jsonb — quantité `THIRD_PARTY_DATA` / ZachXBT |
| `claimedRaiseUsd` | 1500000 · `THIRD_PARTY_DATA` — **inchangé** |

## Après le fichier 00

Merger **#190** (schema, draft), puis **#189** (surface, draft), puis refermer
l'exemption **#188** (`ffcf740`) byte-identique.

## Les deux invariants gravés

`src/lib/data-nature/claims.ts` (PR #189) :

- **DN-C1 — Correct calculation ≠ correct claim.** Vérifier une arithmétique ne
  valide pas l'affirmation qu'elle porte. La justesse du calcul rend l'erreur
  *plus* crédible, pas moins.
- **DN-C2 — Monetary quantities require semantic identity.** Huit grandeurs
  distinctes — market cap, FDV, notional, realized proceeds, documented
  transfers, investor losses, retail harm, estimate. « 482 M$ » seul ne suffit
  jamais.

## Après cette correction, W2 est fermable → S6 / Q5
