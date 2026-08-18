# A15 — Le câblage complet

**Branche :** `feat/cc-offline-73-a15-cablage-complet` (depuis A14) — **non mergée, rien de déployé**
**Date :** 2026-08-18
`pnpm typecheck` vert · `pnpm test` **292 fichiers / 3 074 tests verts** (+18) · guard passé, aucun `--no-verify`

> **Aucun état basculé.** `monetaryClaimsPublication` reste `'published'` pour
> les 411 profils. `bkokoski` conserve ses 4 500 000 $ publiés.

---

## LE COMPTE FINAL SUR LES 36 PORTEURS D'A13

| | A13 (avant) | Après A12 + A14 + A15 |
|---|---|---|
| **Couverts par un interrupteur** | **4** | **14** |
| Exposés (public/bêta), **non couverts** | **21** | **14** |
| Admin / investigateur seulement | 6 | 6 |
| Sans surface | 2 | 2 |
| *(A12 en construction)* | *3* | *— intégrés* |

**Sept des vingt et un porteurs exposés sont passés côté couvert.** Ce sont
les sept qui portaient les montants : les quatorze qui restent sont **de la
prose, des constantes compilées, et trois scores calculés**.

### Ce qui est passé côté couvert

| Porteur | Par quoi |
|---|---|
| `KolProfile.totalScammed` | A14 — `monetaryClaimsPublication`, câblé dans `canonical.ts`, `/api/v1/kol/{h}`, `/api/watchlist` |
| `KolCase.paidUsd` | A14 (`/api/v1/kol/{h}`) + A15 (`class-action`) |
| `KolEvidence.amountUsd` | A14 (`/api/v1/kol/{h}`) + A15 (`class-action`, `pdf/kol`) |
| `KolTokenInvolvement.proceedsUsd` | A14 + `withdrawnHandles` déjà en place dans `/api/watchlist` |
| `KolProceedsEvent.amountUsd` | A15 — `cashout` rend 409, `pdf/kol` ne synthétise plus la preuve |
| `totalPaidUsd` (somme à la volée) | A14 — `sumPublishedMonetary` |
| `totalLoss` (somme à la volée) | A15 — idem |
| `LaundryTrail.narrativeText` + risque | A12 |
| `KolNarrative` — la phrase | A15 |

---

## LES NEUF SURFACES — CE QUE CHAQUE PATCH FAIT

Sept sur chemins gelés. **Correctifs écrits, appliqués, vérifiés (`typecheck`
vert, 291 fichiers / 3 056 tests verts), capturés, fichiers remis à l'origine.
Aucun `--no-verify`.**

| Surface | Ce que le patch change |
|---|---|
| `class-action` | `totalLoss` et `documentedProceeds` passent par le point de filtrage ; **409 sur le dossier entier** si l'encaissement est retiré — un paquet « class action » dont les montants sont retirés n'a pas d'objet, on ne sert pas une coquille |
| `cashout` | **409 avant tout calcul.** Les montants viennent en direct de Helius : ils ne sont dans aucune table, aucun filtre de requête ne peut les atteindre. Le seul point d'arrêt est avant de les produire |
| `watchlist` | `totalScammed` redacté (`proceedsUsd` l'était déjà par `withdrawnHandles`) |
| `pdf/kol` | chaque montant de preuve redacté, et **la preuve d'encaissement n'est plus synthétisée du tout** quand la publication est retirée — la calculer puis la masquer la laisserait transiter par le gabarit |
| **`KolNarrative`** | **la phrase entière disparaît, pas seulement le nombre** — voir ci-dessous |
| `ShillToExitCard` | `formatUsd` rend `""` sur `null`/`NaN` au lieu de `$NaN` |
| `CashoutProof` | `tx.amountUsd &&` laissait passer `NaN` (truthy) ; test explicite de finitude |
| `ProceedsCard` | **déjà couvert** — `if (!data?.found || !data.totalProceedsUsd) return null`, et la route rend 409 |
| `KolAlert` | **déjà couvert** — n'affiche que `proceedsLabel`, jamais le nombre |

### `KolNarrative` — le cas qui méritait plus qu'un `redact`

`fmtUsd(null)` rendait **« an undisclosed amount »**. La phrase devenait :

> *« Estimated proceeds from these activities: **an undisclosed amount** —
> derived from verifiable on-chain transactions. »*

**L'accusation reste, la source reste affirmée, seul le chiffre disparaît.**
C'est pire que tout retirer : on publie une imputation qu'on ne peut plus
étayer. Le patch supprime la phrase. `null` veut dire *« ne rien dire »*, pas
*« dire sans chiffrer »*.

*(La phrase sur `totalScammed` était déjà conditionnée par `if (kol.totalScammed)` —
elle disparaît d'elle-même. Par chance, pas par conception.)*

---

## `pdf/kol` — CE QUE LE CÂBLAGE NE COUVRE PAS

**Il faut le dire nettement, parce que la tentation est de croire l'inverse.**

Le patch filtre la **génération** : un PDF fabriqué à partir d'aujourd'hui ne
portera plus de montant retiré. **Il ne touche à aucun objet déjà écrit.**

| | |
|---|---|
| Archives PDF dans R2 sous `reports/{handle}/` | **34 objets** — 32 archives horodatées + 2 `latest.pdf` |
| Dont `GordonGekko`, dont la publication est retirée | **29 objets** |
| Inscrites dans la chaîne de conservation | **0** — `EvidenceItem` où `r2Key LIKE 'reports/%'` = 0 (A1, A5) |
| Atteintes par ce patch | **aucune** |

Ces documents portent **« CASHOUTS ON-CHAIN — TOTAL $579 645 »** sous la
mention **« CONFIDENTIEL — usage judiciaire »**, dont 485 000 $ provenant de la
ligne `SUMMARY_ARKHAM` retirée le 16 août. Ils sont figés, hors base, et le
code ne les voit pas.

**Ce qu'il faudrait pour les couvrir**, par ordre de coût croissant — **aucune
de ces options n'est prise ici, ce sont des décisions** :

1. **Fermer la route de service.** `/api/pdf/{handle}` redirige vers une URL R2
   signée ; y poser le même 409 rend `latest.pdf` injoignable **sans toucher
   l'objet**. Le moins destructif, et le plus rapide. Ne couvre pas les URL
   signées déjà distribuées, ni l'archive horodatée.
2. **Inventorier avant d'agir.** Aucune trace n'existe de qui a téléchargé
   quoi : `EvidenceAccessLog` est en écriture seule et personne ne le lit
   (audit § 5). Sans inventaire, retirer un objet efface aussi la preuve de ce
   qui a été affirmé et quand.
3. **Verser les 34 archives dans la chaîne de conservation** (`EvidenceItem`,
   empreinte, horodatage TSA) **avant** toute décision de retrait. C'est le
   seul ordre qui préserve la contestabilité : on ne peut pas retirer
   proprement un document dont on n'a pas d'abord établi l'existence.
4. **Retirer les objets R2.** Destructif, irréversible, et contraire à la
   doctrine du containment — *« aucun DELETE […] seule la publication
   bascule »*. Le rapport d'A1 note d'ailleurs que ces archives sont **la seule
   trace de ce qui a été affirmé et à quelle date**, et que le dossier BOTIFY
   en dépend.

**L'option 3 conditionne les autres.** Tant que les archives sont hors chaîne
de conservation, toute décision à leur sujet se prend à l'aveugle.

---

## LE TEST DES N PORTEURS

`__tests__/security/monetary-carrier-coverage.test.ts` — **18 tests**, deux
moitiés.

**1. La règle.** Douze porteurs du même fait d'encaissement, sous toutes leurs
formes : colonne, somme calculée à la volée, montant de preuve (type connu,
type de préjudice, **type inconnu**), agrégat PDF, montant Helius jamais
persisté, narratif, phrase. Chacun est évalué contre **un unique retrait**.

```
✗ 0 porteur(s) survivent au retrait
```

Et s'il en survivait un, le test **le nomme, avec sa surface** :

> *« Un porteur qui survit reconstruit le défaut du 16 août : une décision prise
> à un endroit, et le même chiffre servi par une table voisine. »*

Deux vérifications complémentaires : **aucun porteur ne rend `0` à la place de
`null`** — « 0 $ » n'est pas l'absence d'un chiffre, c'est un chiffre, et il
est faux — et un cliquet empêche de retirer discrètement une ligne du tableau
pour faire passer la suite.

**2. La couverture.** Les douze surfaces, chacune classée en trois régimes,
parce que les confondre serait mentir :

| Régime | Ce qui est exigé |
|---|---|
| `arbre` | le fichier importe un point de filtrage |
| `patch` | un patch vérifié l'importe, sur chemin gelé |
| **`patch-rendu`** | un patch durcit le **rendu** (`null`/`NaN` ne produisent plus de chiffre) **sans** importer de garde — ces composants sont couverts **en amont** par la route qui les alimente ; exiger d'eux un import reviendrait à leur faire refaire le travail de la route |

Le test vérifie aussi que les **trois correctifs de fixtures** existent et que
le **SQL d'enregistrement** est présent et non exécuté.

### Les fixtures, encore

Trois suites existantes ont échoué au premier passage —
`cashout.publish-gate`, `class-action.publish-gate`, `watchlist.publish-gate`.
Leurs profils simulés **n'ont pas d'état de publication** et attendent d'être
servis : c'est exactement la doctrine qui change. Leurs correctifs sont des
patches **séparés** (`A15-fixture-*.patch`), pour la même raison qu'en A12 :
*une assertion qui encode une doctrine ne change pas avant la décision qui la
change.*

---

## LE SQL D'ENREGISTREMENT DE L'ÉLARGISSEMENT

`docs/prep/patches/A15-REGISTRE_elargissement_portee.sql` — **affiché, NON
exécuté**, à lancer **le jour du déploiement d'A14 + A15, immédiatement après**.

**Le déploiement est lui-même une décision de publication.** Les six décisions
du 16 août portaient la portée `'profile_total'` — `totalDocumented`, et rien
d'autre. Le code d'A14/A15 étend leur effet à onze porteurs de plus. **Ça ne
s'écrit pas dans un commit** : un commit dit ce que le code fait, pas ce que
l'éditeur a décidé de ne plus publier. Sans cette entrée, un lecteur du journal
dans six mois verrait six retraits de portée `profile_total` et un produit qui
en tait bien davantage — sans trace de la décision intermédiaire.

Six lignes, `scope = 'monetary_all'`, `actorId = 'person:david-douville'`,
`reasonCode = 'evidence_withdrawn'` — **le motif d'origine ne change pas, seule
la portée s'étend**.

Trois garde-fous : la migration d'A14 doit être passée · les six handles
doivent être **encore** retirés (si l'un a été remis en publication,
l'élargissement ne le concerne plus) · et l'entrée ne peut être écrite
**qu'une fois** — un journal append-only empilerait sinon un doublon
indiscernable.

**`publishedValueUsd` est calculé par la requête**, pas recopié : le montant
nouvellement couvert doit dater de la décision, pas de la rédaction du fichier
— et `computeProceedsForHandle` réécrit les événements chaque nuit (A5).

Le texte du motif nomme explicitement **ce qui n'est PAS couvert** :
`totalScammed`, les constantes compilées, et les archives R2.

---

## CE QUI RESTE HORS DE PORTÉE D'UN INTERRUPTEUR

**14 porteurs exposés restants.** Ils se répartissent en trois familles, et
deux d'entre elles ne pourront jamais être couvertes par un interrupteur de
base de données.

### 1. Prose nominative chiffrée — 10 porteurs · *couvrables, non couverts*

`KolProfile.partialFacts` *(publie une revendication explicitement « pending »)*
· `documentedFacts` · `observedBehaviorSummary` · `summary` · `exitNarrative` ·
`KolWallet.label` *(60 lignes, jusqu'à 5,5 M$ de PnL affirmé)* · `sourceLabel`
· `attributionNote` · `KolTokenLink.note` · `KolCase.evidence`

Le patron d'A12 s'y transpose — colonne d'état, journal, point de filtrage —
mais **le chiffre est noyé dans du texte** : le retirer, c'est retirer la
phrase, comme pour `KolNarrative`. Chantier du bloc 4, pas d'A15.

### 2. Constantes compilées — 4 porteurs · **structurellement hors de portée**

`CASE_DB` (claims C1→C8) · les `cexTargets` de `class-action` *(montants,
scores de complicité, handle nommé)* · `pdfGeneratorPublic` *(62 % / 78 %, EN
et FR)* · les pages `en/cases/botify/evidence`, `en/demo/review`, `simulator`

**Aucun interrupteur ne peut les atteindre. Aucun `UPDATE` ne les corrigera.**
Ils ne sont dans aucune table : les retirer exige un **déploiement**, et les
recenser exige un **test**, pas une requête. C'est exactement ce que fait le
garde anti-récidive préparé en A14.

### 3. Scores calculés jamais persistés — 3 porteurs · *couvrables, non couverts*

`deriveTigerScore` *(plancher inconditionnel de 20, sort par l'API nominative
et l'app mobile)* · `computeScore` legacy *(constante 20 servie comme
`risk.score`)* · `max(legacy, tiger)` des trois pages de démo

Ce sont des **scores**, pas des montants : ils relèvent du bloc 3
(dégradation, `confidence`, `dataQuality`), pas du bloc 4.

### Et, hors du décompte : les archives R2

**34 objets figés**, dont 29 pour un handle dont la publication est retirée,
**aucun dans la chaîne de conservation**. Ni un interrupteur, ni un test, ni un
déploiement ne les atteint. Voir § `pdf/kol`.

---

## CONTRÔLE

| Contrainte | État |
|---|---|
| Bascule d'état, décision nominative | **aucune** — les interrupteurs sont posés, jamais actionnés |
| Migration exécutée, `INSERT` de registre, `db:*` | **aucun** — le SQL est affiché, non exécuté |
| Écriture en base, déploiement, merge | **aucun** |
| Variable d'environnement posée | **aucune** |
| `--no-verify`, chemin gelé forcé | **aucun** — 7 surfaces + 3 fixtures en patches, toutes remises à l'origine |
| Fichiers de l'arbre modifiés | **créé** : le test des N porteurs, les patches, ce rapport. **Aucun fichier existant modifié.** |
| `BOTIFY_MINT`, `TSA_*`, `R2_PUBLIC_BASE_URL` | non touchés |
| Nom civil | aucun transcrit |

---

# ADDENDUM — 2026-08-18 · corrigé par le balayage A4

## Ce que le test de couverture affirmait sans le vérifier

Trois surfaces étaient classées « couvertes **EN AMONT** par la route qui les
alimente ». C'était une **phrase de commentaire**, assertée nulle part : rien
ne vérifiait quelle route alimente le composant, ni si cette route porte un
garde.

Le balayage IDOR (A4) a trouvé que pour **`ShillToExitCard` la phrase est
fausse.**

`ShillToExitCard.tsx:109` appelle `/api/kol/{handle}/shill-to-exit`. Cette
route ne figure pas dans les douze surfaces, et ne porte **aucun** garde — ni
`PUBLIC_KOL_FILTER`, ni `proceedsGate`, ni `isProceedsPublished`, ni
`monetaryGate`. Elle sert `amountUsd` par événement de sortie, et une phrase :

```
src/lib/shill-to-exit/detector.ts:195  →  « Sold on 2026-03-14 — $210,900 »
```

Le montant sort **en texte**, pas en champ filtrable — la forme même que le
rapport d'août signale comme la plus difficile à rattraper après coup, à propos
de `/api/scan/ask`.

**Le test passait au vert pendant que la surface fuyait, et l'aurait redit à
chaque vérification.** C'est ce qu'il fallait corriger en premier : une lacune
qu'un test déclare couverte est plus coûteuse que la lacune seule.

## Ce qui a été changé — dans le test, nulle part ailleurs

Le champ **`amont`** nomme désormais la route qui alimente chaque composant, et
une section 3 l'exécute :

1. **le composant appelle-t-il vraiment cette route** — fragments littéraux du
   chemin, cherchés dans l'ordre dans la source ; survit à une réécriture de
   style, pas à un changement de cible ;
2. **cette route porte-t-elle un garde** — dans l'arbre, dans un module
   `@/lib/*` qu'elle importe (**un** saut, pas de fermeture transitive : au-delà,
   « couvert » cesserait d'être vérifiable à l'œil), ou dans un patch A14/A15 ;
3. **sinon**, la lacune doit être inscrite au registre `LACUNES_AMONT`, motivée.

Le registre est **à cliquet** : une lacune qui gagne un garde fait **tomber** le
test, qui exige alors sa radiation. Un décompte figé (`2 couvertes, 2 fuient`)
ferme la dernière porte : faire passer une surface d'une colonne à l'autre sans
toucher au registre est impossible en silence.

## Le décompte, dit plutôt que supposé

| Composant | Amont | État |
|---|---|---|
| `CashoutProof` | `/api/kol/[handle]/cashout` | **couvert** — patch A15, `monetaryGate` |
| `ProceedsCard` | `/api/kol/[handle]/proceeds` | **couvert** — arbre, `isProceedsPublished` |
| `ShillToExitCard` | `/api/kol/[handle]/shill-to-exit` | **LACUNE** — aucun garde |
| `KolAlert` | `/api/token/[chain]/[address]/kol-alert` | **LACUNE** — voir ci-dessous |
| `KolNarrative` | *(aucun `fetch` — props du rendu serveur)* | sans objet |

**`KolAlert` mérite sa propre phrase, parce qu'elle a l'air couverte.**
`src/lib/kol/alert.ts` filtre bien le **profil**
(`publishable && publishStatus === "published"`) — mais sert `proceedsUsd` et
`proceedsLabel` **sans garde monétaire**. Or c'est exactement la thèse d'A14 :
**publication du profil ≠ publication du chiffre.** Un profil publié peut
porter un chiffre retiré. Le filtre présent ne couvre pas ce que le test
prétendait couvrir.

## Ce qui n'a PAS été fait, et pourquoi

**Aucune des deux lacunes n'est corrigée.** `src/app/api/` est gelé par
`guard-offline.sh`, et couvrir une surface monétaire est une **décision** — la
même famille de décision que les douze autres, prise en connaissance de ce
qu'elle élargit. Ce sont des décisions de septembre.

**Ce que ça ouvre, dit d'avance :** verser
`/api/kol/{handle}/shill-to-exit` au lot d'A15 ferait **treize** surfaces, pas
douze — et le registre d'élargissement de portée (`A15-REGISTRE_*.sql`) décrit
douze. Les deux doivent bouger ensemble, ou le journal datera faux. C'est
précisément pourquoi la lacune est **inscrite** plutôt que rattrapée à la
sauvette.

| Contrainte | État |
|---|---|
| Fichier de production modifié | **aucun** — la correction vit dans le test |
| Vulnérabilité corrigée | **aucune** — deux lacunes inscrites, motivées |
| Écriture en base, déploiement, merge, `--no-verify` | **aucun** |
| Suite | **418 tests verts** (14 fichiers), `typecheck` vert |
