# BUILD 12 · S5 — PLAN DE MESURE, RÉVISÉ

**Base du plan d'origine** : `3ec1d9e` sur `feat/cc-offline-174-build12-s0-s1`, branche
NON MERGÉE. Entrée seule, recopiée — la branche n'est pas fusionnée.

**Base d'aujourd'hui** : `main = 4607b7b`, guard `ce13d0c0…3e50`, 0 exemption, déployé.

Le plan d'origine a été écrit **avant S3, S3.1, S3.2 et S4**. Ce document dit ce
que j'en ai changé et pourquoi. Un plan de mesure qu'on révise en silence ne
mesure plus rien.

---

## 0 · CHAQUE ATTENTE MODIFIÉE, CLASSÉE — ET POURQUOI ELLE CHANGE

La taxonomie qui gouverne est celle du ruling : **RATIFIED CONTRACT CHANGE ·
BUG FIX · STALE ASSUMPTION**. Aucune attente n'est réécrite « pour la rendre
verte » : chacune porte sa cause.

| § | attente d'origine | classe | pourquoi elle change |
|---|---|---|---|
| 3 | « 21 clés, aucune ne s'ajoute » | **RATIFIED CONTRACT CHANGE** | S3 a ajouté `intelligenceCoverage`, champ ADDITIF ratifié. 22 clés sur A. |
| 3 | le jeu de clés est invariant entre cibles | **DÉFAUT DU PLAN** — voir ci-dessous | `name`/`symbol` sont conditionnels ; 20 clés sur B/C/D. Vrai AVANT que le plan soit écrit. |
| 3 | domaine partenaire inchangé | **RATIFIED CONTRACT CHANGE** | S4 a changé la CONDITION D'ÉMISSION du jeton, pas son domaine. |
| 1 | cible D sert `ALLOW` | **STALE ASSUMPTION** | la phase 2 a basculé D en `ORANGE`/`WARN`. Le plan décrit un état quitté. |
| 2 | témoin A « byte-identique sur tout l'objet » | **DÉFAUT DU PLAN** | sur-spécification : aurait déclenché un arrêt sur l'ajout LÉGITIME d'`intelligenceCoverage`. Voir §3. |
| 3bis | motif `NOT_REQUESTED_BY_CONTRACT` | **BUG FIX** | le motif est émis conditionnellement à l'échec. Correctif §5. |

### La quatrième case, et pourquoi je ne force pas les deux lignes dedans

**« DÉFAUT DU PLAN » n'est aucune des trois.** Ce n'est pas un changement de
contrat ratifié — rien n'a changé. Ce n'est pas un correctif de produit — le
produit n'a jamais eu ce comportement. Ce n'est pas une hypothèse périmée — elle
n'a jamais été vraie, pas même le jour où elle a été écrite.

C'est une affirmation **fausse à l'écriture**, sur un plan de mesure. La
distinction n'est pas académique : une hypothèse périmée signale qu'un
déploiement est passé et qu'il faut re-mesurer ; un défaut du plan signale que
**le plan lui-même n'a jamais mesuré ce qu'il croyait mesurer**, et que sa
conclusion, si elle avait été verte, n'aurait rien prouvé.

Les deux lignes concernées auraient l'une et l'autre déclenché un **arrêt pour
une raison sans rapport avec la migration**.

Le second point mérite d'être dit : le plan affirmait un jeu de clés invariant
alors qu'il ne l'était **déjà pas** au moment où il a été écrit. `name` et
`symbol` ne sortent que lorsqu'ils sont connus. Une comparaison de clés stricte
entre deux cibles différentes aurait donc échoué pour une raison sans rapport
avec la migration.

---

## 1 · LE CONTRAT SERVI DE `/api/v1/score`, CLÉ PAR CLÉ

Mesuré en production, 2026-09-09, GET non authentifié.

**Noyau — 20 clés, présentes sur TOUTES les cibles :**

```
api_version · cached · communityScans · freezeAuthority · intelligenceCoverage
liquidityUsd · mint · mintAuthority · pairAgeDays · phantom_disclaimer
phantom_warning_level · score · signals · sources · timestamp · topHolderPct
topHolderSource · topHolderUnavailableReason · verdict · website
```

**Conditionnelles — 2 clés**, présentes seulement quand l'actif est connu
(`knownBad` ou dossier) : `name` · `symbol`.

**`intelligenceCoverage`** est le champ ajouté par S3. Sa forme, sur les quatre
cibles : `expected` · `consultedMeasured` · `notConsulted` · `declaredNotArmed` ·
`denominator` · `state` · `negativeConclusive`. Valeur servie aujourd'hui :
`denominator: 2`, `state: COMPLETE`, `negativeConclusive: true`.

**Règle de comparaison révisée** : le noyau de 20 clés ne bouge pas. Les deux
conditionnelles se comparent **cible par cible**, jamais entre cibles.

---

## 2 · LES QUATRE CIBLES, RE-MESURÉES

| # | mint | mesuré aujourd'hui | ce qu'elle exerce |
|---|---|---|---|
| **A** | `BYZ9…69xb` (BOTIFY) | `70` `RED` `BLOCK` · `topHolderSource=helius` · 22 clés | **TÉMOIN.** Seule cible dont la concentration aboutit. |
| **B** | `EPjF…Dt1v` (USDC SOL) | `20` `GREEN` `ALLOW` · 20 clés | jeton établi, concentration en échec |
| **C** | `So11…1112` (wSOL) | `0` `GREEN` `ALLOW` · 20 clés | capacité `holders` éteinte des deux côtés |
| **D** | `1111…1111` (43 car.) | `0` **`ORANGE`** **`WARN`** · 20 clés | non résolvable — **a DÉJÀ basculé en phase 2** |

**Ce que le plan attendait de C et B ne s'est pas produit, et T2 avait
lui-même conclu qu'il avait tort** : `holders` est délibérément hors du
dénominateur, sinon toute réponse SOL sortirait dégradée. Cette conclusion
tient, et je ne la rouvre pas.

---

## 3 · LE TÉMOIN A — SUR QUELS CHAMPS EXACTEMENT

**« Byte-identique sur tout l'objet » était une sur-spécification, et T2 l'a
reconnue de lui-même.** Elle confondait le TÉMOIN avec le CONTRAT : elle aurait
déclenché un arrêt sur l'ajout parfaitement légitime d'`intelligenceCoverage`
par S3.

La promesse d'identité byte-à-byte porte sur les **quatre champs de décision**,
et sur eux seuls :

```
score · verdict · phantom_warning_level · topHolderSource
```

Mesuré aujourd'hui sur A : `70` · `RED` · `BLOCK` · `helius`. **A tient sur les
quatre.**

Le reste de la charge utile peut recevoir des champs ADDITIFS ratifiés sans que
le témoin soit rompu. Ce qui reste interdit : qu'une clé du noyau **disparaisse**,
ou qu'un des quatre champs de décision **bouge**.

---

## 3bis · LE DISCRIMINANT APPARIÉ, ACTUALISÉ

| branche | cible | attendu |
|---|---|---|
| **NE DOIT PAS BOUGER** | **A** BOTIFY | `70` / `RED` / `BLOCK` **byte-identique**. S'il bouge, **on s'arrête.** |
| NE DOIT PAS BOUGER | `0xa5b0edf6…` | `100` / `RED` / `BLOCK` |
| NE DOIT PAS BOUGER | USDC · USDT · WSOL | `ALLOW`, `den=2 COMPLETE` |
| NE DOIT PAS BOUGER | Tornado · `"1"×44` | `WARN` |
| NE DOIT PAS BOUGER | routes sanctions | `TA3941uF…` `PARTIAL`/`false` · `0xa5b0edf6…` `COMPLETE`/`true` |
| distribution | | **3 ALLOW / 2 WARN / 2 BLOCK** |

`timestamp`, `cached` et `communityScans` restent hors comparaison : ils varient
sans rapport avec le code. **Tout le reste doit être expliqué ligne par ligne.**

Le plan d'origine notait `cached: true` sur la cible D. La consigne tient :
purger ou attendre l'expiration avant la mesure APRÈS, sinon on mesure le cache.

---

## 4 · LE CONTRAT PARTENAIRE, AVEC LA CONDITION D'ÉMISSION DE S4

La forme et les domaines sont inchangés :

| endpoint | domaines |
|---|---|
| `transaction-check` | `Verdict = SAFE\|WARNING\|AVOID` · `Recommendation = ALLOW\|WARN\|BLOCK` |
| `score-lite` | `Verdict` · `Tier = GREEN\|ORANGE\|RED` |
| `batch-score` | idem, par item |

**Ce que S4 a changé, et qu'un plan non révisé lirait comme une casse :**

- `verdict: "SAFE"` n'est émis que si `negativeConclusive` est vrai. Sur
  couverture incomplète il devient `WARNING`.
- `recommendation` **ne bouge pas** — `ALLOW` reste `ALLOW`.
- `reason` perd sa clause rassurante sur couverture incomplète, et ne **nomme**
  aucune source.

> Un plan qui attend `SAFE` là où la couverture ne conclut pas échouera **pour
> la bonne raison**. Ne pas le lire comme un défaut.

**Aujourd'hui la couverture est `COMPLETE`** : le jeton sort donc `SAFE`, et la
bascule n'est **pas observable en production**. Elle est prouvée par le
mécanisme — 6 mutants de bibliothèque, 6 mutants de route.

### Ce que la mesure doit prouver sur le contrat partenaire

1. le domaine reste à **trois** valeurs ;
2. `SAFE` est **préservé** sur un cas sûr à couverture complète et concluante ;
3. `WARNING` sort sur couverture **non concluante** ;
4. la sémantique de blocage est préservée ;
5. **la recommandation ne change PAS du seul fait que la couverture change.**

Les points 2, 3 et 5 ne sont **pas** mesurables en production sans clé : ils
sont prouvés par le mécanisme, et le rapport doit le dire au lieu de compter un
401 pour une mesure.

---

## 5 · LA RÉSERVE DE T2, TRANCHÉE

**Sa réserve est fondée, et le défaut est plus précis qu'il ne l'a écrit.**

Mesuré, chemin SOL de `/api/v1/score` :

```ts
...(holders.available ? [] : [{ engine: "holders", reason: "NOT_REQUESTED_BY_CONTRACT" }])
```

L'entrée est ajoutée **parce que la tentative a échoué**. Une capacité
réellement « non demandée par le contrat » le serait **toujours**, pas seulement
quand elle échoue. Le chemin EVM, lui, l'émet inconditionnellement (l. 182–185)
— le contraste est mesurable dans le même fichier.

Donc : le jeton ne décrit pas un fait de contrat, il décrit un refus de
provider en le nommant « hors contrat ».

### Pourquoi on ne peut PAS simplement changer le mot

Mesuré dans `canonicalDecision.ts` : `HORS_CONTRAT = ["NOT_APPLICABLE",
"NOT_REQUESTED_BY_CONTRACT"]`. **Tout autre motif dégrade.** Relabelliser en
`FAILURE` ou `NOT_MEASURABLE` mettrait `degraded: true` sur **toute** réponse
SOL — exactement la dégradation permanente que BUILD 11.1 a fermée, et que S3.1
a refermée aujourd'hui sur un autre axe. Le remède serait pire.

### LA PRÉMISSE, MESURÉE — c'est elle qui décide

Mon correctif rend l'affirmation STABLE. Il ne la rend VRAIE que si le contrat
SOL n'attend réellement pas `holders`. Deux lectures étaient possibles :

  (a) le contrat ne l'exige pas, l'implémentation le tente en bonus → le motif
      est VRAI, le correctif est le bon
  (b) le contrat l'attend et le code échoue → le motif est FAUX quelle que soit
      la condition d'émission, et le correctif stabiliserait un mensonge

**MESURÉ : c'est (a), sur trois preuves indépendantes.**

1. **Le dénominateur est un littéral.** `expected: 3` sur le chemin SOL, sans
   condition. Sur BOTIFY, où `holders` RÉUSSIT (`topHolderSource: helius`), le
   dénominateur reste **3**. Si le contrat l'attendait, il vaudrait 4 en cas de
   succès. Il ne le vaut jamais.
2. **L'absence est déjà consommée par le moteur.** La route passe
   `holders_unavailable: !holders.available` (l. 308) ; le moteur l'agrège dans
   `rpcDown` et baisse la confiance (l. 397).
3. **Le moteur porte déjà sa propre dégradation.** `missing.push("holders")` et
   trois signaux marqués non évalués (l. 435). La compter au dénominateur
   pré-achat serait une **troisième** pénalité pour un seul fait.

Le motif est donc VRAI sur l'axe DÉNOMINATEUR. Ce qui est faux est sa
CONDITION D'ÉMISSION, qui le fait ressembler à une conséquence de l'échec.

**Une incohérence relevée au passage** : le commentaire de ce bloc s'ouvre sur
« Quatre capacités sont ATTENDUES sur ce chemin » alors que le contrat déclare
`expected: 3`. Le commentaire est faux, pas le code.

### MON ARBITRAGE

**Il y a deux faits distincts, et un seul champ pour les porter :**

| fait | axe | où il doit vivre |
|---|---|---|
| `holders` est hors du dénominateur attendu | CONTRAT | `missing[].reason` |
| le provider a été appelé et a refusé | TENTATIVE | `topHolderUnavailableReason` |

Le second **est déjà servi** : mesuré sur B, C et D,
`topHolderUnavailableReason = "helius:Too many accounts requested | …"`. Le
refus est donc bien dit, et il l'est au bon endroit.

**Ce qui doit changer est la CONDITION, pas le mot** : l'entrée `holders` doit
sortir **inconditionnellement** sur le chemin SOL, comme sur le chemin EVM. Elle
cesse alors d'être une conséquence de l'échec et redevient ce qu'elle prétend
être — un fait de contrat, vrai que l'appel réussisse ou non.

Coût : nul sur les valeurs servies aujourd'hui, puisque l'appel échoue toujours.
Bénéfice : le champ cesse de mentir, et un jour où `holders` fonctionnera, il ne
basculera pas silencieusement dans le dénominateur.

**Ce que je ne fais PAS** : introduire un champ `cause` à côté de `reason` pour
porter les deux axes dans la même structure. Ce serait la solution la plus
expressive, et c'est une **décision de méthodologie** — un nouvel axe dans un
vocabulaire ratifié. Je la signale, je ne la prends pas.

### LA FORME CORRECTE A DÉJÀ UN NOM

T2 dit la même chose un cran plus haut, et sa formulation est la bonne : le
jeton est juste sur l'axe **DÉNOMINATEUR** et faux sur l'axe **CAUSE**, et un
seul champ porte les deux. La structure qui les sépare **existe déjà** —
`IntelligenceCoverage` distingue `expected` (appartenance au dénominateur) de
`reason` (état observé).

Ma correction est l'implémentation ; la sienne est le nom de la structure. Les
deux se prennent ensemble, et **aucune n'exige un état nouveau**.

**Statut** : arbitrage rendu, correctif **non appliqué**. `src/app/api/` est
gelé et cette correction ne vaut pas une fenêtre à elle seule — **à joindre au
prochain chantier qui en ouvre une, probablement l'option 2 de AM**. Inscrit au
backlog pour qu'il ne se perde pas.

---

## 6 · LIMITES, INCHANGÉES ET RE-VÉRIFIÉES

| surface | obtenu aujourd'hui | conséquence |
|---|---|---|
| `/api/partner/v1/score-lite` | **401** | un 401 n'est jamais une mesure |
| `/api/partner/v1/transaction-check` · `batch-score` | **405** (POST attendu) | idem |

`PARTNER_API_KEY` est **vide** dans `.env.local`. Les trois routes partenaires
restent prouvées **par le mécanisme, jamais en production** — et S4 l'a déclaré
ainsi.

`WAIT` et `VERIFY` projettent tous deux sur `WARN` et **aucune cible publique**
ne produit l'un ou l'autre de façon reproductible. Leur distinction reste une
preuve unitaire, jamais une preuve de production. Inchangé.

---

## 7 · ORDRE D'EXÉCUTION, RÉVISÉ

1. Déclarer les limites du §6 dans le rapport — ce qui **ne sera pas** mesuré.
2. Capturer l'AVANT sur les 4 cibles **et** les 7 témoins du §3.
3. Déployer.
4. **Purger le cache — obligatoire, pas optionnel.** Les quatre cibles
   répondent `cached: true`. Sans purge, on mesure le cache et non le code.
5. Capturer l'APRÈS, `diff`, expliquer **chaque** ligne.
6. Comparer le noyau de 20 clés ; comparer les 2 conditionnelles **cible par
   cible**.
7. Vérifier que **A** est byte-identique. **Si A a bougé, s'arrêter.**
8. *(ajouté)* Vérifier que la distribution reste **3 ALLOW / 2 WARN / 2 BLOCK**
   et que les deux routes sanctions n'ont pas bougé — S3.2 ne doit pas être
   défait par un chantier voisin.
