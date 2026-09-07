# D12 — le flake `contradictionDetector`, fermé

Branche `feat/cc-offline-152-flake-contradiction-detector`, depuis `main = b4642fc`.

---

## STATUS

**Fermé.** Le défaut était dans la fixture, pas dans le détecteur — vérifié
avant de toucher quoi que ce soit. Aucun changement de comportement produit.

---

## LA CAUSE

Les deux fabriques du fichier de test appelaient `Date.now()` **chacune, à
chaque invocation** :

```ts
function mkTweet(minsAgo) { postedAtUtc: new Date(Date.now() - minsAgo * 60_000) }
function mkSell (minsAgo) { eventDate:   new Date(Date.now() - minsAgo * 60_000) }
```

Le cas `same tweet+sell pair produces exactly one alert` construit deux tweets
censés être **identiques** :

```ts
const tweets = [mkTweet(600), mkTweet(600)];
```

Sous charge, les deux appels tombent sur deux millisecondes différentes. La clé
de dédup du détecteur est exacte à la milliseconde — donc deux alertes, et
`toHaveLength(1)` échoue.

**Vert en isolation, rouge sous charge.** C'est ce qui l'a rendu invisible en
local pendant des mois et visible en CI : il a fait rougir la PR #254 de
BUILD 8, sans aucun rapport avec les changements de cette PR-là.

---

## POURQUOI CE N'EST PAS UN DÉFAUT PRODUIT

Le périmètre imposait un STOP si le défaut venait du code. Vérifié, il n'en
vient pas :

1. **`computeContradictions` est pur.** Il ne lit jamais l'horloge — il compare
   entre elles les dates qu'on lui passe. Aucun comportement ne dépend de
   l'instant d'exécution.
2. **Sa clé de dédup reproduit la contrainte de la base.** En mémoire :
   `tokenMint : tweetAt.toISOString() : sellAt.toISOString()`. En base :
   `ON CONFLICT ("kolHandle", "tokenMint", "tweetAt", "sellAt")`. Les deux sont
   exactes à la milliseconde, et le sont **ensemble**.
3. Donc deux tweets à une milliseconde d'écart **sont** deux lignes distinctes.
   Les fusionner en mémoire masquerait une ligne que la base accepterait.

Le détecteur avait raison. C'est la fixture qui n'exprimait pas son intention.

---

## LE CORRECTIF

Une seule source de temps, **figée** :

```ts
const BASE_MS = Date.UTC(2026, 0, 15, 12, 0, 0, 0);
function at(minsAgo: number): Date { return new Date(BASE_MS - minsAgo * 60_000); }
```

Pas de faux timers : le code testé ne lit pas l'horloge, il n'y aurait rien à
intercepter.

**Trois tests ajoutés**, tous sur le même fichier :

| test | ce qu'il tient |
|---|---|
| `deux appels au même décalage rendent le MÊME instant` | la propriété dont dépendait le cas de dédup, et qui n'était pas tenue |
| `aucune fixture ne dépend de l'heure d'exécution` | `at(0)` vaut exactement `2026-01-15T12:00:00.000Z` |
| `deux tweets à une milliseconde d'écart ne sont PAS dédupliqués` | le pendant : la dédup exacte est **voulue**, et reste vérifiée |

Et le cas historique vérifie désormais **sa propre prémisse** avant de
conclure :

```ts
expect(tweets[0].postedAtUtc.toISOString()).toBe(tweets[1].postedAtUtc.toISOString());
```

Sans cette ligne, une régression future réintroduisant une lecture d'horloge
échouerait à nouveau sur `toHaveLength`, en accusant le détecteur d'un défaut
que la fixture aurait introduit. Avec elle, le test dit *où* est le problème.

---

## PROOF

```
$ node scripts/intelligence/flake-check.mjs 50

## 1. STABILITÉ — 50 exécutions d'affilée
  ✅ 50/50 verts, aucune variation.

## 2. MUTATION — réintroduction de la lecture d'horloge
  ✅ mutant TUÉ à la tentative 1/12.
```

Le mutant réintroduit **exactement** le défaut historique — `at()` relisant
`Date.now()`. Il est tué **du premier coup**, et c'est le point : l'assertion de
prémisse le rend détectable de façon déterministe, là où l'ancien test ne le
détectait que par malchance. Le harnais laissait pourtant 12 tentatives, parce
qu'un mutant probabiliste peut survivre plusieurs essais au repos — c'est
précisément ce qui rendait le défaut d'origine si difficile à voir.

| | |
|---|---|
| suite complète | **4 707 verts / 4 709**, 2 skipped, 0 rouge |
| typecheck | vert |
| fichiers touchés | **2** — le test, et le harnais de preuve |
| comportement produit | **inchangé** — `contradictionDetector.ts` n'est pas modifié |

---

## PÉRIMÈTRE

Aucun autre test touché. Aucun élargissement. Les autres fixtures du fichier
bénéficient de la base figée sans changer de sens : elles utilisaient déjà des
décalages distincts, donc aucune assertion ne dépendait de la dérive.

Le reste du backlog D12 (`CLAUDE.md` « 215 profils », `pnpm test` qui salit
l'arbre, branche `handle` de `ingestion/pipeline.ts`) n'est pas traité ici.
