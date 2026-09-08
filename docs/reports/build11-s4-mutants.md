# BUILD 11 · REFLEX V2 — S4 : MUTANTS SÉMANTIQUES ET PREUVE ADVERSE

Base `main = a8850ed`. Guard `ce13d0c0…3e50`. 0 source touchée, 0 fenêtre,
0 merge. **Le corpus S1 (`242fd53`) n'a pas été modifié** — vérifié par
`git diff` : aucun critère n'a bougé pendant que T1 code contre.

Livrable : `__tests__/reflex/s4-mutants-semantiques.test.ts` — **19 tests,
14 mutants, tous tués par le critère attendu**, plus un témoin de
satisfiabilité.

## Ce que S4 mute, et pourquoi pas la source

S2 n'existe pas encore. Muter un fichier non écrit est impossible ; muter le
fichier actuel ne prouverait rien, puisqu'il viole déjà douze critères. Les
mutants sont donc des **implémentations plausibles et fausses** du contrat.
La batterie est le livrable ; l'implémentation reste à T1.

`TEMOIN` démontre que la batterie est **satisfiable** — une batterie que rien
ne peut passer serait indistinguable d'une batterie exigeante. C'est un témoin,
**pas une proposition de design**.

## Les 14 mutants

| famille | mutant | critère |
|---|---|---|
| A · absence → safe | 0/8 réussis produit quand même le verdict rassurant | A1 |
| | panne et mesure propre rendues indistinguables | A2 |
| | `error` jeté avant le consommateur | A3 |
| | couverture partielle rendue complète | A4 |
| | score 0 réintroduit pour encoder « rien mesuré » | A5 |
| B · divergence | un STOP légitime écrasé par la dégradation | B1 |
| | l'action cesse d'être indexée par le verdict | B2 |
| | un verdict rendu sans explication | B3 |
| | une dégradation rendue sans dire ce qui manque | B4 |
| C · sur-correction | couverture COMPLÈTE rendue partielle par excès de prudence | C1 |
| | verdict rassurant supprimé sur mesure propre complète | C2 |
| | état inventé hors vocabulaire | C3 |
| | **WITHHELD posé sur l'axe MESURE au lieu de NOT_MEASURED** | C4 |
| | **STALE affirmé sans instant d'observation** | C5 |

Chaque test exige deux choses : que le mutant soit tué, **et** qu'il le soit
par le critère qu'il visait. Un mutant tué par accident, via un critère sans
rapport, ne prouve pas la propriété visée.

## Deux défauts trouvés dans ma propre batterie

**B1 a d'abord SURVÉCU.** Ma sonde STOP n'utilisait qu'une couverture
complète ; le mutant, qui n'écrase le verdict qu'en couverture trouée, passait
à travers. Corrigé en ajoutant une sonde STOP + couverture trouée. Ceci ne
fixe aucun seuil : un signal critique fondé ne peut pas être effacé par la
panne d'un moteur **sans rapport**, quel que soit le nombre de manquants.

**Une assertion était FAUSSE.** `not.toMatch(/actionEn\s*=\s*(?!ACTION_WORDING)/)`
rougissait sur du code correct : `\s*` peut matcher zéro caractère, donc la
lookahead voyait l'espace avant `ACTION_WORDING` et réussissait toujours.
Remplacée par une extraction des affectations et une lecture de leur membre
droit. Un test faux ment dans les deux sens.

## Constat à traiter AVANT l'arbitrage U

`src/lib/publication/absenceVocabulary.ts` existe déjà — et **il collapse les
deux axes** que l'arbitrage interdit de confondre :

- `MONETARY_STATES` mélange `WITHHELD` (publication) avec `NOT_MEASURED` et
  `NOT_APPLICABLE` (mesure) dans un seul type ;
- `monetaryState(publiable, valeur)` rend les deux axes depuis une seule
  fonction, et son en-tête pose explicitement que **`WITHHELD` l'emporte sur
  `NOT_MEASURED`** — une absence de mesure est donc délibérément masquée par
  un état de publication.

Ce choix est défendable là où il est né : une cellule de tableur ne rend qu'un
jeton, et masquer la lacune derrière la décision évite de publier l'existence
d'un chiffre retiré. Il devient faux dès qu'on l'étend à REFLEX, où la
couverture de mesure est justement ce qu'il faut rendre lisible.

Étendre ce fichier en ajoutant `NOT_MEASURABLE`, `FAILURE`, `STALE` et
`UNKNOWN` à `MONETARY_STATES` **approfondirait le collapse**. Le mutant C4
mord précisément là. Je ne tranche pas la forme — séparer en deux types dans
le même module, ou autre — c'est le périmètre de T1.

## STOP METHODOLOGY — ce que la batterie ne teste pas

Un seul critère de couverture est gouverné : `measured === 0` ne peut pas
produire un verdict rassurant (A1). Ne sont **ni testés ni impliqués** :

- le verdict correct pour 1/8, 4/8 ou 7/8 moteurs mesurés ;
- l'activation de `GLOBAL_CONFIDENCE_NO_SIGNAL_THRESHOLD = 0.5`, morte dans le
  source. Son existence n'est pas une ratification : la rendre vivante fixerait
  une limite que personne n'a arbitrée.

Tout mutant qui ne pourrait être jugé qu'en fixant cette limite est
volontairement absent de la liste.

## Enveloppe

S4 tient. `__tests__/reflex/` : **519 tests, 507 verts, 12 rouges** — les 12
rouges sont exactement ceux de S1, inchangés et voulus. Aucune source modifiée.
