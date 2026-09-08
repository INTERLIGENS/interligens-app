# BUILD 10 · P3 — FERMETURE DU PDF CASEFILE · **PRÉPARÉE, NON APPLIQUÉE**

**Aucune fenêtre n'est ouverte. Rien n'est mergé. Ces patches ne sont pas
appliqués** — l'arbre de la branche est identique à `main` sur les chemins
gelés, et la suite y est verte sans eux.

## Comment appliquer, quand la fenêtre sera ouverte

```bash
git apply docs/prep/patches/BUILD10/P3-report-casefile-route.patch
git apply docs/prep/patches/BUILD10/P3-pdfRenderer.patch
git apply docs/prep/patches/BUILD10/P3-i18n.patch
cp    docs/prep/patches/BUILD10/P3-tests-pdf-report-authority.test.ts.prepared \
      __tests__/casefile/pdf-report-authority.test.ts
```

Les trois patches sont **interdépendants** : `P3-i18n` change la signature de
`claimsSubtitle`, que `P3-pdfRenderer` appelle. Appliquer l'un sans l'autre ne
compile pas — c'est voulu, ça empêche une demi-application.

| fichier | gelé |
|---|---|
| `src/app/api/report/casefile/route.ts` | **oui** |
| `src/components/pdf/pdfRenderer.ts` | **oui** |
| `src/lib/i18n/{en,fr}.ts` | non |
| `__tests__/casefile/pdf-report-authority.test.ts` | non |

**Deux fichiers gelés. Ni un de plus.** `/api/scan/solana` n'est pas touché.

---

## 1 · Ce que la route cesse de faire

`LEGACY_SCORING_INPUT` n'alimente plus le PDF CaseFile.

Le PDF publiait le corpus legacy **par deux chemins distincts** :

1. ses claims venaient de `/api/scan/solana`, qui les tire de `loadCaseByMint`
   et pose `off_chain.source = "case_db"` ;
2. un `require("data/cases/botify.json")` enrichissait les titres FR — une
   **seconde lecture de la même autorité**, dans le même fichier.

Les deux sont partis. Les claims viennent de `loadPublicProjection`, dans la
locale demandée : la projection porte `titleFr` et `descriptionFr`, il n'y a
plus rien à enrichir, et `_raw_claims` n'est plus injecté.

**Aucun repli** : si aucun dossier canonique ne répond pour ce mint,
`off_chain.source = "none"` et la liste est vide. Se rabattre sur ce que le
scan avait rempli republierait le corpus legacy par la porte de derrière.

---

## 2 · Pourquoi le score est RETIRÉ, et non séparé

L'arbitrage autorisait la séparation de présentation, avec repli sur le retrait
« si cette séparation n'est pas possible mécaniquement ». **Elle ne l'est pas
proprement, et voici la mesure.**

Le score et le nombre de claims ne sont pas voisins par accident : ils occupent
**deux cellules de la même grille à trois colonnes** du bloc d'en-tête —
`RISK SCORE` · `STATUS` · `CLAIMS`. L'adjacence est structurelle.

Et la seconde page l'écrivait noir sur blanc :

```
claimsSubtitle(penalty, mult, score, count)
  → « 8 referenced claims — score: penalty=… × … = … »
```

Une phrase qui **affirme la dérivation**, juste sous le tableau des claims.
Plus un `${off_chain.claims.length} / 8` : le dénominateur `8` est la taille du
corpus legacy, figée dans le gabarit.

Séparer aurait exigé de conserver le nombre en le qualifiant. Or `risk.score`
est calculé depuis `rawClaims` — **le corpus que ce document cesse
précisément de publier**. Le qualifier honnêtement reviendrait à écrire « score
calculé sur un corpus absent de ce document », ce qui n'est pas une séparation
mais un aveu qu'il n'a pas sa place ici.

**Il est donc retiré.** Rien n'est recalculé, rien n'est remplacé par `0` ni par
`null`, aucun poids, seuil ou formule n'est touché. Le retrait est **signalé** et
**nomme le champ** :

> *Score withheld — this document does not publish the corpus it was computed
> from. Field: `off_chain.source`*

C'est la hiérarchie ratifiée hier sur les signatures fabriquées : **une pièce
qu'on ne peut pas présenter honnêtement ne se présente pas.**

---

## 3 · Le scoring n'a pas bougé — la mesure

`off_chain.claims` est un **champ de sortie**, pas une entrée de score. Dans
`/api/scan/solana` :

```
226  const rawClaims = caseFile?.claims ?? [];      ← lu de loadCaseByMint
227  const scoring   = computeScore(rawClaims);
251  no_casefile: !caseFile,
260  confirmedCriticalClaims: rawClaims.filter(...)
```

`off_chain.claims` (ligne 185) est un mapping **séparé** de la même source.
Aucun des deux scoreurs ne le lit — vérifié argument par argument, et épinglé
par test. La substitution est donc mécanique : valeur TigerScore, poids,
seuils, agrégation et contribution des signaux mesurés sont inchangés.

---

## 4 · Preuve — 15 tests, 5 mutants, 5 mordent

| mutant | tests tués |
|---|---|
| le score revient dans le bloc d'en-tête | 1 |
| la phrase de dérivation revient | 2 |
| **sur-correction** — le score remplacé par `0` | 1 |
| repli vers le corpus du scan quand le dossier manque | 1 |
| l'autorité servie est mal déclarée (`case_db`) | 1 |

Le mutant de sur-correction est celui qui compte : remplacer le score par `0`
réintroduirait par la porte du rendu la coercition « absence → rassurance »
que P0 a fermée.

```
suite (patches APPLIQUÉS)     5073 verts / 5075, 0 rouge
suite (arbre NON patché)      5058 verts / 5060, 0 rouge
typecheck  vert dans les deux états
lint       0 erreur
```

---

## 5 · Ce qui reste ouvert

Le lot **ne referme pas** l'export CSV admin
(`src/app/api/admin/export/botify/route.ts`, 1 fichier gelé, fermable seul).
Il attend le résultat de T1 sur le containment des montants — si des montants
contenus y réapparaissent, c'est un containment P0 à rouvrir, et le périmètre
de la fenêtre change.
