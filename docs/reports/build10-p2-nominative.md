# BUILD 10 · P2 — LES CINQ BLANCS SILENCIEUX DE LA FICHE NOMINATIVE

Empilée sur **P0** (`feat/cc-offline-167-p0-coercion`) : P2 réutilise le
vocabulaire de dégradation posé là, plutôt que d'en dupliquer un second.

Guard `ce13d0c0…13e50`, **0 exemption, aucun chemin gelé franchi**.
0 write, 0 DDL, 0 collecte, 0 RPC. **PR sans merge**, `main` figé à `4d5cdcc`.

## La règle appliquée

> Une surface qui nomme une personne ne doit **jamais** transformer un échec de
> collecte en absence de signal.

Et la doctrine d'instrumentation qui la fonde : ne jamais inférer
`empty result → no risk`. **Une charge vide n'est une information sur la
personne que si la réponse est `ok`.** Sinon elle est une information sur le
transport, et la présenter autrement serait une affirmation métier fabriquée.

---

## LE DÉFAUT, ET POURQUOI IL ÉTAIT INVISIBLE

```ts
fetch(url).then(r => r.json())
          .then(d => { if (d?.wallets?.length > 0) setX(d.wallets) })
          .catch(() => {})
```

`r.ok` n'était **jamais testé**. Un 401 nominatif était donc parsé comme une
charge normale, la garde `length > 0` échouait, et la section disparaissait —
strictement comme une absence réelle.

Trois situations, un seul écran :

| situation | ce que le lecteur voyait |
|---|---|
| collecte réussie, rien trouvé | section absente |
| API en panne / timeout / 500 | section absente |
| accès nominatif refusé (401) | section absente |

Sur une fiche qui **nomme quelqu'un**, cela se lit « rien à signaler sur cette
personne ».

---

## CE QUI EST FERMÉ

`classifyResponse(ok, status, body, isEmpty)` range en trois, et **l'ordre des
tests compte** :

```
401 ou code NOMINATIVE_ACCESS_REQUIRED   →  INTENTIONALLY_UNAVAILABLE
!ok                                       →  PROVIDER_FAILURE
ok + charge vide                          →  MEASURED_EMPTY   ← une INFORMATION
ok + charge pleine                        →  MEASURED
```

Le refus est examiné **avant** l'échec. L'inverse rangerait toute rétention
délibérée en incident, et ferait sonner une alarme là où le produit fait
exactement ce qu'on lui demande.

`isEmpty` est fourni par l'appelant : lui seul sait ce que « vide » veut dire
pour sa charge — tableau à zéro élément, drapeau `detected` faux, objet nul.
Le module ne le devine pas.

### Les cinq sections sont suivies nommément

`laundry` · `cluster` · `coordination` · `transparency` · `shill`

Le seul `.catch(() => {})` conservé est celui du **narratif secondaire**, qui
n'est pas une section de la fiche mais un enrichissement de l'une d'elles.

### Le non-constat est RENDU

Un bloc **SIGNAL NOT AVAILABLE / SIGNAL INDISPONIBLE** liste les sections
concernées, en distinguant les deux causes :

> *This section could not be collected. That is a collection failure, not a
> finding about this person — no conclusion should be drawn from its absence.*

> *This section requires authenticated nominative access. It is withheld by
> design, not because nothing was found.*

Mesurer la dégradation sans la montrer aurait laissé le blanc silencieux
intact : le lecteur aurait vu la même page.

---

## PREUVE — 18 tests, 3 mutants exercés, 3 mordent

| mutant | tests tués |
|---|---|
| une panne redevient une absence | 1 |
| **SUR-CORRECTION** — une absence réelle signalée comme dégradée | 1 |
| la rétention délibérée rangée en panne (ordre inversé) | 3 |

Le test central : **la même charge vide** rend `MEASURED_EMPTY` sur un 200 et
`PROVIDER_FAILURE` sur un 500. Charge identique, verdict opposé, parce que le
statut dit si le vide porte sur la personne ou sur le transport.

Le mutant de sur-correction est la symétrie de celui de P0 : si
`MEASURED_EMPTY` remontait une dégradation, chaque section vide crierait
« panne » et le signal deviendrait inaudible. **Un produit qui crie panne sur
chaque vide est aussi inutilisable qu'un produit qui se tait.**

```
suite       4967 verts / 4969, 0 rouge   (baseline 4949)
typecheck   vert
lint        0 erreur · 0 warning introduit
            (mesuré avant/après : 2 warnings des deux côtés)
guard       ce13d0c0…13e50, aucun chemin gelé
```

> **Une faute de ma main, corrigée avant commit.** Ma première version typait
> les rappels en `(d: any)` — 40 erreurs de lint introduites. Remplacé par des
> accesseurs typés sur `unknown`. Le comptage avant/après est la seule raison
> pour laquelle je l'ai vu : sans lui, j'aurais livré 40 erreurs en affirmant
> le contraire.

---

## CE QUE JE N'AI PAS FAIT

- **Aucun composant de section touché.** `src/components/kol/` et
  `src/components/LaundryTrailCard.tsx` sont **gelés** ; la dégradation est
  rendue **depuis la page**, qui est libre. Aucune exemption n'a été nécessaire.
- **Aucune valeur inventée, aucun risque inventé.** Un non-constat n'est ni
  favorable ni défavorable : il dit qu'il n'y a pas de constat.
- **Aucun scoring touché.** P2 ne traverse aucune chaîne de score.
- **Les APIs n'ont pas été modifiées.** Elles renvoient déjà de quoi
  distinguer les trois états (`status`, `code`) ; c'est la fiche qui ne les
  lisait pas. Aucune route — donc aucun chemin gelé — n'a eu besoin d'être
  ouverte.

## RÉSERVE — non mesuré

Je n'ai pas vérifié **en production** quel statut chaque route rend réellement
sur chaque cas. La classification est établie sur le CODE : le gate nominatif
rend 401 avec `NOMINATIVE_ACCESS_REQUIRED`
(`src/lib/security/nominativeApiGate.ts:253-262`), et les routes déclarent 404
et 500. Une route qui rendrait 200 avec un corps d'erreur serait classée
`MEASURED_EMPTY` à tort — **c'est la limite de ce containment**, et elle
appartient au régime de réponse des routes, pas à la fiche.
