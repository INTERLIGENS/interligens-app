# BUILD 9 — P0 · resolver, formes de clef, symétrie des preuves

Suite de `build9-p0-qualification.md`. Lecture seule : 3 passes SELECT en
`READ ONLY` + `ROLLBACK`. **0 write, 0 DDL, 0 collecte.**

---

## CORRECTION PRÉALABLE — quatre blocs, trois structures

Mon rapport précédent écrivait « trois structures » sans nommer la réduction.
Elle est réelle, et vérifiée : **`claims` et `new_claims` sont une seule
structure sous deux noms.**

```
clefs communes : category · claim_id · description · description_fr
                 evidence_refs · severity · status · thread_url · title
BOTIFY seul    : title_fr
```

Et le renderer n'a **qu'un seul type**, `CaseFileClaim`, utilisé uniquement pour
`new_claims`. Le dédoublement est un artefact de nommage, pas deux objets.

| structure | blocs portés | éléments démontrés |
|---|---|---|
| `claims` + registre `sources` résolvable | `claims` **et** `new_claims` | 8 + 8 |
| `shillers` | `shillers` | 9 |
| `smoking_guns` | `smoking_guns` | **1** |

Seconde correction du même rapport : j'y comptais `wallets_onchain` parmi les
trois. Il n'est **pas** l'un des six blocs et n'exige **aucune structure
nouvelle** — `keyWallets` existe déjà dans `token_casefiles`, et il est bien
rempli.

Conséquence apparue en vérifiant : **`CaseFileClaim` ne porte ni
`evidence_refs`, ni `thread_url`.** La provenance qui rend ces claims
démontrables n'est pas rendue par le PDF.

---

## R1 — COUVERTURE RÉELLE DU RESOLVER

Jointure `token_casefiles.contractAddresses` → `EvidenceSnapshot.canonicalMint`,
appliquée aux 1 171 lignes :

| | lignes |
|---|---|
| **résolues vers un dossier** | **14** |
| mint présent, **aucun dossier** pour ce mint | 190 |
| aucun mint | 967 |
| **total** | 1 171 |

**1,2 % de couverture.** Mais la cause n'est pas le resolver :

| | |
|---|---|
| mints distincts dans `EvidenceSnapshot` | **88** |
| dont un dossier existe | **1** |
| mints déclarés par l'ensemble des dossiers | **2** |

**Le resolver n'est pas sous-dimensionné : le corpus de dossiers l'est.** Les
190 lignes non résolues pointent vers **87 sujets qui n'ont aucun dossier** —
aucune n'est publique. Il n'y a rien à réparer côté jointure ; il n'y a que deux
dossiers pour 88 sujets observés.

Les 967 sans mint ne sont pas démunies pour autant : 913 portent un
`tokenSymbol`, 947 un `kolHandle`, 927 un `sha256`, 906 un `sourceUrl`. Ce qui
leur manque est **l'identité**, pas la matière.

---

## R2 — UN `ref` STABLE SE DÉRIVE-T-IL D'UNE DES DEUX FORMES ?

**Non. D'aucune des deux.**

### Forme `TICKER` nu — 22 lignes, 6 clefs, les 20 publiques

```
clefs d'evidence : BOTIFY · BOTIFY-MAIN · GHOST · GHOST-RUG · GordonGekko · SERIAL-12RUGS
tickers dossier  : ANSEM · $LAB
codenames dossier: BLACKBULL · LAB
```

**Intersection vide.** Aucune des six clefs ne correspond à un ticker ni à un
codename de dossier.

Et la forme n'est même pas homogène : `GordonGekko` est un **handle**, pas un
ticker. `BOTIFY` et `BOTIFY-MAIN` désignent le même sujet sous deux clefs.
`SERIAL-12RUGS` n'est ni l'un ni l'autre — c'est un nom de dossier informel.

### Forme `handle:TICKER` — 1 149 lignes, 280 clefs

224 tickers distincts après extraction, **1 seul** recoupe un ticker de dossier.

### Conclusion

Aucune dérivation mécanique n'est possible, et ce n'est pas une question de
volume : les deux vocabulaires ne se rencontrent pas. Un `ref` stable ne peut
venir que du **mint**, qui est la seule identité partagée entre les deux
mondes — et c'est précisément le champ absent des 20 lignes publiques.

Le corollaire compte pour le build : **rattacher la preuve suppose d'abord que
le dossier existe.** L'ordre est dossier → mint → preuve, jamais l'inverse.

---

## R3 — LES 50 CAPTURES VINE : CE QUI MANQUE EXACTEMENT

| champ | rempli |
|---|---|
| `sha256` | **50 / 50** |
| `observedAt` | 50 / 50 |
| `sourceUrl` | 50 / 50 |
| `localFilePath` | 50 / 50 |
| `tokenSymbol` | 50 / 50 |
| `kolHandle` | 50 / 50 |
| `reviewStatus` (`approved`) | 50 / 50 |
| **`canonicalMint`** | **0 / 50** |
| `evidenceLevel` | 0 / 50 |
| `imageUrl` | 0 / 50 |
| `isPublic` | **0 / 50** |

**Il ne manque qu'un champ pour les rattacher : `canonicalMint`.** Tout le reste
est là, y compris le hash et l'horodatage.

Et ce champ n'est pas à découvrir : le mint VINE est déclaré dans
`vine-osint.json` (`case_meta.mint`). Le rattachement est donc **une décision,
pas une recherche** — poser une identité connue sur des captures qui portent
déjà `tokenSymbol = VINE`.

`evidenceLevel` n'est pas un obstacle : il est nul sur 947 des 1 171 lignes du
produit (`E1` 212, `E2` 12). Colonne peu utilisée, pas un discriminant.

La publication, elle, reste une décision distincte : les 50 sont `approved` mais
`isPublic = false`. **Rattacher n'est pas publier**, et le build n'a pas à
confondre les deux.

---

## R4 — LA SYMÉTRIE, ET POURQUOI C'EST LE CŒUR DU BUILD

| | lignes | `sha256` | `sourceUrl` | `canonicalMint` | publiques |
|---|---|---|---|---|---|
| les 20 `case` | 20 | **0** | **0** | 0 | **20** |
| les 50 VINE | 50 | **50** | **50** | 0 | **0** |

**Inversion exacte.** Ce qui est publié n'est pas vérifiable ; ce qui est
vérifiable n'est pas publié. Et **aucun des deux groupes n'a d'identité** — le
`canonicalMint` manque des deux côtés.

Ce n'est pas une coïncidence de remplissage, c'est la trace de deux chaînes
d'ingestion distinctes qui n'ont jamais été réconciliées : l'une pose des
captures publiables sans preuve d'intégrité, l'autre produit des artefacts
hachés que rien ne publie.

Le gate de clôture — *canonical identity → un CaseFile versionné → evidence
référencée → assertions gouvernées → une vérité* — bute exactement là. Les deux
groupes échouent au **premier** maillon, pour des raisons opposées.

---

## CE QUE P0 ÉTABLIT

1. **Le resolver fonctionne et n'est pas le problème.** 14 lignes résolues, et
   87 sujets sans dossier expliquent la quasi-totalité du reste.
2. **Aucun `ref` ne se dérive d'une clef existante.** Les vocabulaires ne se
   croisent pas. Le mint est la seule identité commune possible.
3. **Les 50 VINE ne demandent qu'un champ**, et il est connu. Rattachement =
   décision ; publication = décision séparée.
4. **La symétrie 20 / 50 est le vrai objet du build**, et elle ne se résout pas
   par un backfill : un côté manque de preuve, l'autre de publication.

---

## STOP — inchangé, toujours ouvert

Les 20 preuves publiques sans `sha256` restent l'arbitrage remonté à
l'architecte. P0 le renforce d'un point mesuré : elles n'ont **ni hash, ni
`sourceUrl`** — donc ni intégrité, ni origine. Les trois issues posées tiennent.

Aucun nouveau STOP. Le reste de P0 est clos.
