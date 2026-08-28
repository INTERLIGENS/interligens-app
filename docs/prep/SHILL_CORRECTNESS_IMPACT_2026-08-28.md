# Shill Correlation - impact des 2 correctifs de correctness

**Date :** 2026-08-28
**Branche jetable :** `t2-shill-correctness-fixes` - **non mergee, non poussee**
**Mode :** aucun appel API/reseau, Neon en **lecture seule**. L'impact est **simule hors ligne**
a partir des 2 169 observations et des 1 532 candidats stockes, jamais recalcule en base.
**Non touche :** l'exclusion `high_frequency` / `too_many_tokens` / `bot_infra` (arbitrage ouvert).

> Le PRE-BUY GUARD (`src/lib/prebuy/shill.ts:147`) consomme ce scorer. Rien ne part sans feu vert.

---

## Validation prealable - sans elle, aucun chiffre ne vaut

La simulation rejoue d'abord la logique **d'origine** (comptage par evenement + formule sans
plancher) et compare aux lignes reellement en base :

```
VALIDATION "avant" vs base : 1532 identiques / 0 divergents (sur 1532)
```

La reproduction est exacte. Les chiffres « apres » ci-dessous sont donc mesures contre une base
verifiee, pas contre une approximation.

*(Note de methode : ma premiere simulation ne matchait que 31/1532 - elle scorait le « avant »
avec le scoring deja corrige. Corrige avant de rapporter quoi que ce soit.)*

---

## Correction d'un chiffre de ma prep

La prep du 2026-08-28 annoncait **7** candidats a 77,00. Le compte reel est **218**. Je n'avais
regarde que le haut du classement, ou seuls 7 apparaissaient. Les 218 sont **tous
`deepnets_agent`** et **tous a `observed = 1`**.

La cause tient en une ligne : `deepnets_agent` n'a **qu'un seul evenement analysable**
(`analyzable = 1`). Tout wallet vu sur cet unique evenement obtient donc mecaniquement
`ratio = 1,00`. Ce n'est pas 7 anomalies, c'est une population entiere.

---

## Correctif #1 - l'unite de comptage devient l'OCCASION

`src/lib/shill-correlation/occasions.ts` (nouveau) + `aggregate.ts`.

Deux evenements du meme `(kolHandle, tokenMint)` dont les fenetres d'analyse se recouvrent
forment **une occasion**. Recouvrement ssi l'ecart entre tweets est inferieur a
`preSeconds + postSeconds` = **1 500 s**. Le chainage est **transitif** : trois tweets espaces de
10 min forment une seule occasion, pas deux.

Deux garde-fous voulus :
* un evenement **sans `tokenMint`** n'est jamais fusionne (les 29 `unresolved_ticker` de
  production) - ne pas savoir de quel token il s'agit interdit de decider que c'est le meme ;
* a l'interieur d'une occasion, une observation n'est comptee qu'une fois, dedupliquee sur
  **`firstBuyTxSignature`** - c'est litteralement la meme transaction on-chain, pas deux achats.
  Sans signature, repli prudent sur `(wallet, chain)`.

**Effet mesure sur le corpus :** 11 evenements -> **9 occasions** (2 replies). Les deux paires
sont exactement celles identifiees en prep : `empire_sol1` sur `3ghKZfLZJawW` (18:57 / 18:58) et
sur `2TbA8rPnVy6U` (22:51 / 22:53).

Denominateur `analyzableShillCount` par KOL :

| KOL | avant | apres |
|---|---|---|
| `empire_sol1` | 4 | **2** |
| `dexsignals` | 6 | 6 |
| `deepnets_agent` | 1 | 1 |

## Correctif #2 - plancher de n avant qu'un ratio vaille recurrence

`src/lib/shill-correlation/scoring.ts`.

Sous le plancher, `ratioObserved` **cesse d'alimenter** la composante recurrence (qui retombe sur
son seul terme de comptage) et `shortlistEligible` devient faux. Le candidat n'est ni supprime ni
exclu : il cesse d'etre credite d'une regularite qu'une seule observation ne peut pas etablir.
`ratioObserved` reste renvoye tel quel - c'est un fait, il ne disparait pas du dossier.

**Valeur PROPOSEE : 3. Non figee - a ratifier.**
Raison du 3 : `shortlist.minShills` vaut deja 3 ; aligner le plancher dessus n'introduit pas un
second seuil concurrent. **2** est defendable (deux occasions font deja une repetition).
**5** alignerait sur `serious.minShills` mais viderait la classe `candidate` du corpus actuel.

---

## Impact sur les 1 532 candidats

|  | watch | candidate | high_interest |
|---|---|---|---|
| **AVANT** | 1 512 | **19** | 1 |
| #1 seul (occasions) | 1 521 | **10** | 1 |
| #2 seul (plancher) | 1 512 | **19** | 1 |
| **APRES (#1 + #2)** | **1 521** | **10** | **1** |

* **9 candidats basculent `candidate` -> `watch`.** Aucun autre mouvement de classe.
* Aucune ligne creee ni supprimee : 1 532 avant, 1 532 apres. Les correctifs **rectifient un
  comptage**, ils ne filtrent rien.
* Baisse de score : **12,35 pts en moyenne**, **31,50 au maximum**, **19 candidats sur 1 532
  inchanges**.

### Ce que devient chacun des deux cas cites

**Les 218 a 77,00 (`obs = 1`)** - tous `deepnets_agent` :

```
obs=1/1  score 77,00  watch   ->   obs=1/1  score 54,50  watch     (-22,50 pts, x218)
```

Ils **ne changent pas de classe** : ils etaient deja `watch`. C'est important et c'est la limite
du correctif #2 - il corrige le **rang**, pas le **verdict**. Un candidat a 77 se lisait comme
plus fort que la moitie de la classe `candidate` ; a 54,5 il retrouve sa place. Aucun d'eux
n'atteignait `shortlistEligible`, donc aucun ne remontait a l'admin.

**`empire_sol1`, ratio = 1,00 sur paires redondantes** - le denominateur passe de 4 a 2 :

| wallet | avant | apres |
|---|---|---|
| `AUQAzeNnW4p2…` | obs=4/4, **90,50**, `candidate` | obs=2/2, **59,00**, `watch` |
| `C7ML4W7cegR8…` | obs=4/4, **90,50**, `candidate` | obs=2/2, **59,00**, `watch` |
| `kEFiAX3jo5Nm…` | obs=4/4, 75,00, `candidate` | obs=2/2, 43,50, `watch` |
| `7rbxsXchaL1J…` | obs=4/4, 66,25, `candidate` | obs=2/2, 34,75, `watch` |
| `CN4AG1iqQeLa…` | obs=4/4, 66,88, `watch` | obs=2/2, 35,38, `watch` |

Le ratio reste 1,00 - mais sur **2 occasions reelles** au lieu de 4 evenements dont 2 doublons.
Les deux tetes de classement d'`empire_sol1`, a 90,50, tombent a 59,00 et sortent de la classe
`candidate`. C'etait exactement le faux signal decrit en prep.

### Ce qui n'est PAS touche - et c'est le controle

`dexsignals` n'a aucune paire redondante (6 evenements, 6 occasions). Ses candidats sont
**strictement inchanges** :

| wallet | avant | apres |
|---|---|---|
| `pau23UpU2BFw…` | obs=5/6, **91,25**, `high_interest` | **identique** |
| `4zZRBMnMYMEW…` | obs=4/6, 78,63, `candidate` | **identique** |
| `7wBtZ982uR2c…` | obs=4/6, 78,63, `candidate` | **identique** |
| `HK3J9zTFz3qB…` | obs=3/6, 74,75, `candidate` | **identique** |

Les correctifs frappent les deux pathologies et **laissent le signal reel intact**. L'unique
`high_interest` du corpus survit sans une variation de score.

Rappel : ces memes candidats `dexsignals` portent `excludedReason = high_frequency`. Cet
arbitrage reste **ouvert et non touche**, comme demande.

---

## Etat de la branche

| Fichier | Nature |
|---|---|
| `src/lib/shill-correlation/occasions.ts` | nouveau - 106 lignes |
| `src/lib/shill-correlation/aggregate.ts` | modifie - unite de comptage + dedup intra-occasion |
| `src/lib/shill-correlation/scoring.ts` | modifie - plancher de n, valeur a ratifier |
| `src/lib/shill-correlation/__tests__/correctness-fixes.test.ts` | nouveau - 13 cas |

**Tests : 75/75 verts** (62 existants + 13 nouveaux), 294 ms, sans reseau ni base. Les 62 tests
preexistants passent **sans modification** - le plancher de 3 est compatible avec les attentes
deja ratifiees, puisque `shortlist.minShills` valait deja 3.

## Ce qui reste a trancher (GPT)

1. **La valeur du plancher** : 2, 3 ou 5. Proposition 3, argumentee ci-dessus.
2. **L'exclusion `high_frequency`** : non touchee. Les 5 meilleurs candidats du corpus restent
   scores ET exclus, et `prebuy/shill.ts` decide seul de ce qu'il en fait.
3. **Le rejeu** : ces correctifs ne changent la base que si `score-candidates.ts` est relance.
   Aucun rejeu n'a ete declenche - la base porte toujours les 1 532 lignes d'origine.

Rien merge, rien pousse, rien ecrit en base.
