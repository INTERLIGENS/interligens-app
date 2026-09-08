# BUILD 10 · P0 — CONTAINMENT « ABSENCE → RASSURANCE »

Base `main = 4d5cdcc`, guard `ce13d0c0…13e50`, **0 exemption**. Aucun chemin
gelé franchi. 0 write prod, 0 DDL, 0 collecte, 0 RPC. **PR sans merge.**

## La règle appliquée

> Aucune donnée absente, erreur provider, timeout, collector périmé ou signal
> non évalué ne peut produire **par coercition** la valeur favorable
> correspondant à une observation **réellement mesurée**.

Et sa moitié symétrique, tenue elle aussi : **l'absence ne devient pas non plus
un facteur défavorable.** « Si on ne sait pas, mettons rouge » est aussi faux
que la coercition qu'on ferme.

---

## CHEMIN A — score absent → `0` → GREEN · **FERMÉ**

Le plus grave, et il est fermé.

```
avant   Number(data?.tiger_score ?? 0) || 0   →  0  →  getTier(0)  →  GREEN
après   readScore(...) → null                 →  getTierOrUnknown(null) → UNKNOWN
```

`getTier` est **intacte** : aucun seuil, aucun barème touché. La correction est
en amont — un appelant sans score n'appelle plus `getTier`.

### Une seconde coercition trouvée en chemin

`src/app/[locale]/demo/page.tsx` en portait **deux**, pas une :

```ts
String(data?.tier ?? data?.risk?.tier ?? "GREEN")          // palier ABSENT → favorable
["GREEN","ORANGE","RED"].includes(tierRaw) ? tierRaw : "GREEN"  // palier INCONNU → favorable
```

Un palier inattendu — réponse d'une version antérieure, champ renommé —
retombait sur le favorable, **en silence**. Les deux rendent désormais
`UNKNOWN`.

### L'absence est RENDUE, pas masquée

Les trois pages affichent un bloc **NOT EVALUATED / NON ÉVALUÉ** :

> *No risk score could be measured for this address. This is not a clean
> result: it means the data required to produce a verdict was unavailable.
> Absence of a score is not absence of risk.*

Masquer le verdict sans rien dire aurait été un blanc silencieux de plus. La
bannière de verdict et la carte de révélation ne sont **pas rendues** quand le
palier est inconnu : elles n'ont que trois paliers, tous des affirmations sur
le risque.

`UNKNOWN` est **gris** (`#6b7280`) — ni le vert, ni le rouge du produit.

| fichiers | gelé |
|---|---|
| `src/lib/risk/tier.ts` (ajout non destructif) | non |
| `src/app/[locale]/demo/page.tsx` · `en/demo` · `fr/demo` | non |

---

## CHEMIN C1 — échec base → « aucune lignée de scam » · **FERMÉ**

`computeVerdict.getScamLineage` rendait `"NONE"` dans son `catch` : une base
injoignable et un jeton sans lignée produisaient **la même sortie**.

```ts
catch { return { lineage: "NONE", measured: false }; }   // la valeur ne bouge pas
```

**La valeur passée au scoreur reste `"NONE"`.** Changer ce qui entre dans le
calcul serait modifier le scoring — ce que P0 s'interdit explicitement. Ce qui
change : on **sait** que c'est un défaut de mesure, et le verdict le porte.

`computeVerdictMeasured()` rend `{ verdict, degraded[] }`.
`computeVerdict()` conserve **exactement** sa signature et délègue : aucun
appelant cassé, calcul identique au caractère près.

L'indisponibilité du marché (`market.data_unavailable`, motif déjà présent
dans la maison) est nommée par le même canal.

---

## LE VOCABULAIRE — `src/lib/risk/degradation.ts`

Trois raisons, vocabulaire **fermé** : `PROVIDER_UNAVAILABLE` ·
`NOT_EVALUATED` · `PIPE_NOT_CONNECTED`.

Une dégradation **nomme le champ**, jamais la valeur — `degraded()` refuse
fail-closed tout ce qui n'a pas la forme d'un identifiant. Même règle que les
avis d'exclusion du CaseFile.

**Pourquoi un canal séparé et non une sentinelle** : poser `-1` ou `NaN` à la
place de `0` déplacerait le problème dans l'arithmétique — le premier
`Math.max` ou la première comparaison de seuil le retransformerait en verdict.
La dégradation voyage **à côté** du nombre, jamais dedans.

---

## PREUVE — 20 tests, 3 mutants exercés, 3 mordent

| mutant | tués |
|---|---|
| l'absence retombe sur GREEN | **2 tests** |
| un zéro **mesuré** devient UNKNOWN (**sur-correction**) | **1 test** |
| l'échec base se déclare mesuré | **2 tests** |

Le second est le plus important : il prouve que la correction **n'a pas
détruit une observation réelle** en même temps qu'elle fermait la coercition.
Un zéro mesuré reste GREEN.

Chaque chemin porte deux assertions symétriques — le zéro mesuré garde son
verdict favorable, l'absence n'en obtient aucun, et n'obtient pas non plus
RED.

```
suite       4949 verts / 4951, 0 rouge   (baseline 4927)
typecheck   vert
lint        0 erreur · 0 warning INTRODUIT (mesuré avant/après)
guard       ce13d0c0…13e50, aucun chemin gelé
```

---

## ⛔ CHEMIN B — GELÉ · INVENTAIRE, JE N'OUVRE RIEN

Constat de T1, convergent avec S0.

```
fetchHolders échoue → catch { return null }
  → parseFloat(holders?.top10_pct ?? "0") = 0
  → concentration_flags: []          ← identique à « aucune concentration »
```

| fichier | gelé | raison d'indivisibilité |
|---|---|---|
| `src/app/api/casefile/route.ts` (ligne 170) | **oui**, `^src/app/api/` | `fetchHolders` y est défini ET consommé. La coercition est dans la même fonction que l'appel provider : aucun fichier libre ne peut distinguer « holders null » de « top10 réel = 0 » sans que la route expose la différence |

**Un seul fichier gelé.** Le travail y est mécaniquement identique au chemin
C1 : porter `measured: boolean` à côté de la valeur, sans changer la valeur.

Ce que je propose de faire dans la fenêtre, si elle est accordée :

- `fetchHolders` rend `{ holders, measured }` au lieu de `null`
- `top10` reste `parseFloat(... ?? "0")` — **le calcul ne bouge pas**
- `concentration_flags` inchangé
- la réponse porte `degraded: [{ field: "holders", reason: "PROVIDER_UNAVAILABLE" }]`

**Je n'ouvre rien.** Aucune exemption n'est demandée par moi : l'inventaire
ci-dessus t'est rendu, tu le portes à l'architecte.

### Note — `src/lib/casefile/legacyCaseScore.ts` porte la même coercition, et je n'y touche PAS

Le fichier est **libre**, mais `parseFloat(onChain?.distribution?.top10_pct ?? "0")`
y alimente directement le score. Y toucher **changerait le scoring**, ce que
P0 interdit. Il est donc laissé tel quel, et il le restera tant que la
dégradation ne descend pas depuis la route.

---

## CE QUE JE N'AI PAS FAIT, ET POURQUOI

- **Aucun redécoupage de TigerScore.** Ni méthodologie, ni poids, ni seuil, ni
  calcul. `getTier` est intacte, les six entrées de `computeTigerScore` sont
  intouchées, `legacyCaseScore` n'a pas bougé d'une ligne.
- **Aucune valeur inventée** pour remplacer une absence.
- **Aucun risque inventé** : `UNKNOWN` n'est pas `RED`, et c'est testé.
- Les **97 occurrences** de `?? 0` relevées en S0 ne sont **pas** toutes
  traitées : la plupart sont légitimes (un compteur qui démarre à zéro EST
  zéro). Seuls les chemins qui produisent un **verdict** sont fermés ici.

## Restant, dans l'ordre annoncé

**P2** — les 5 blancs silencieux de la fiche nominative. Même famille : cinq
`.catch(() => {})` où l'échec de collecte se lit comme absence de signal sur
une personne nommée.
