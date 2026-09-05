# BUILD 7 — `similarity/compare@v2`

Branche `feat/cc-offline-150-similarity-compare-v2`, depuis `main = 94bbe13`.

| | |
|---|---|
| **@v1** | `similarity/compare@v1` — **gelé, INTACT**, sha `4395fddbd6336a240278c3214938a48a1697a610bd3b4d2e306550d4e3155d94` |
| **@v2** | `similarity/compare@v2` — gelé, sha `5a1affa89dab3ca058034041f9731a901c4a144dcd49ee512f2d7864ce81ef51` |
| corpus | ep-square-band, lecture seule 2026-09-05 — **identique** pour les deux versions |
| rejeu | `npx tsx scripts/similarity/v2-delta-run.ts` |
| verrou | `src/lib/similarity/v2/__tests__/delta.test.ts` |

> **@v1 n'est pas retiré.** `supersedes: v1` dit la filiation, pas la mise au
> rebut : les deux versions restent gelées et résolvables. Un correctif qui
> effacerait la version corrigée rendrait sa propre correction invérifiable.
> Un test le prouve à chaque run — sha inchangé, miroir octet pour octet,
> résultat S3 identique à celui publié.

---

## 1. Ce que @v2 change

**Même contrat** : les 17 mêmes clés, dans le même ordre, avec les mêmes natures,
sortes et familles — vérifié par test. Une seule feature voit son vocabulaire
étendu, et c'est C1.

**Mêmes verdicts** : `MATCH` · `PARTIAL_MATCH` · `DIFFERENT` · `NOT_COMPARABLE`.
**Mêmes interdits** : aucun score, aucun seuil, aucun poids, aucun pourcentage.
**Les neuf invariants de @v1 sont repris à l'identique** — ce sont littéralement
les mêmes fonctions, importées.

Quatre ajouts, un par priorité du pack :

| | ajout | ce que ça ferme |
|---|---|---|
| **P0** | une **règle d'agrégation groupe→sujet déclarée par feature**, avec sa portée (`ALL_GROUPS` · `SOME_GROUPS` · `CONFLICTING_GROUPS` · `NO_GROUP` · `PER_GROUP_ONLY` · `NOT_AGGREGATED`) et les faits de groupe préservés | C3 |
| **P1** | un **sixième état, `INADMISSIBLE`**, avec sa cause fermée (`DATA_NATURE_MISSING` · `DATA_NATURE_MISMATCH` · `PROVENANCE_UNSATISFIED`), ce qui a été trouvé et ce qui était exigé | C2 |
| **P2** | une **résolution temporelle explicite** (`INSTANT` / `DAY`), `date_only` admis comme provenance d'ancre, et l'interdiction mécanique de toute heure fabriquée | C1 |
| **P3** | une **attribution** sur toute feature nommant une adresse ou une entité (`UNATTRIBUTED` · `DECLARED_BY_SOURCE` · `ATTRIBUTED`) | destination |

**Quatre invariants nouveaux, cinq gardes, cinq mutants** —
`node scripts/similarity/mutation-check-v2.mjs` :

```
✅ INV-10  · InadmissibleDowngradedError → rouge : MUTANT 10
✅ INV-11a · MajorityVoteError           → rouge : MUTANT 11a
✅ INV-11b · ScopeLaunderedError         → rouge : MUTANT 11b
✅ INV-12  · FabricatedInstantError      → rouge : MUTANT 12
✅ INV-13  · UnattributedIdentityError   → rouge : MUTANT 13
```

Correspondance 1:1, vérifiée dans les deux sens. Les 9 gardes de @v1 restent
portantes (`mutation-check.mjs`, 9/9).

### Les règles d'agrégation, et d'où elles viennent

Aucune n'est choisie « au mieux » : chacune se lit dans ce que la feature
**affirme déjà**.

| feature | règle | motif |
|---|---|---|
| `exit.cluster_category` | `ALL_OR_NOTHING` | la catégorie décrit la forme d'un groupe ; dire qu'un sujet « est » de cette catégorie n'a de sens que si tous ses groupes le sont |
| `exit.composition_profile` | `ALL_OR_NOTHING` | deux groupes de compositions différentes ne font pas un sujet à composition unique |
| `exit.demonstrated_venue` | `DEMONSTRATED_BY_ANY` | l'unanimité est **déjà** exigée *à l'intérieur* du groupe ; l'exiger une seconde fois entre les groupes ajouterait une règle que rien ne soutient |
| `exit.demonstrated_destination` | `DEMONSTRATED_BY_ANY` | même raison |
| `exit.distinct_subjects`, `temporal.exit_cluster_*`, `exit.materiality` | `PER_GROUP_MAGNITUDE` | « wallets différents **dans le groupe** », « du premier au dernier acte **du groupe** » |
| les 10 autres | `SUBJECT_LEVEL` | calculées directement sur le sujet |

**Il n'existe aucune règle « la valeur la plus fréquente gagne ».** Ce serait un
seuil déguisé — pourquoi 5/6 et pas 4/6 ? — et il écraserait le groupe
divergent. INV-11 le refuse mécaniquement : une observation dont l'agrégation
enregistre plus d'une valeur distincte ne peut pas être `OBSERVED`.

---

## 2. Résultats par feature — VINE ↔ BOTIFY

| feature | @v1 VINE | @v2 VINE | @v1 BOTIFY | @v2 BOTIFY | verdict | delta |
|---|---|---|---|---|---|---|
| `identity.token_resolution_status` | MISSING | MISSING | NOT_OBSERVED | **INADMISSIBLE** | NOT_COMPARABLE | motif → `SIDE_INADMISSIBLE` |
| `identity.chain_demonstrated` | `solana` | `solana` | `solana` | `solana` | **MATCH** | — |
| `temporal.anchor_provenance` | MISSING | MISSING | NOT_OBSERVED | **INADMISSIBLE** | NOT_COMPARABLE | motif → `SIDE_INADMISSIBLE` |
| `temporal.exit_cluster_span_seconds` | NOT_MEASURABLE | NOT_MEASURABLE | MISSING | MISSING | NOT_COMPARABLE | — |
| `temporal.exit_cluster_min_gap_seconds` | NOT_MEASURABLE | NOT_MEASURABLE | MISSING | MISSING | NOT_COMPARABLE | — |
| `funding.shared_funder_addresses` | 4 adresses | 4 adresses | MISSING | MISSING | NOT_COMPARABLE | + `UNATTRIBUTED` |
| `funding.relationship_categories` | 3 catégories | 3 catégories | MISSING | MISSING | NOT_COMPARABLE | — |
| `funding.external_funder_count` | 3 funders | 3 funders | MISSING | MISSING | NOT_COMPARABLE | — |
| `shill.promotion_qualification` | MISSING | MISSING | MISSING | MISSING | NOT_COMPARABLE | — |
| `shill.kol_handles` | MISSING | MISSING | NOT_OBSERVED | **INADMISSIBLE** | NOT_COMPARABLE | motif → `SIDE_INADMISSIBLE` |
| `exit.cluster_category` | `NARROW_WINDOW_CLUSTER` | idem **(6/6)** | MISSING | MISSING | NOT_COMPARABLE | + portée |
| `exit.demonstrated_venue` | **NOT_OBSERVED** | **`RAYDIUM` (3/6)** | MISSING | MISSING | NOT_COMPARABLE | **fait rendu** |
| `exit.demonstrated_destination` | **NOT_OBSERVED** | **`5Q544fKrFo…` (3/6)** | MISSING | MISSING | NOT_COMPARABLE | **fait rendu** |
| `exit.distinct_subjects` | NOT_MEASURABLE | NOT_MEASURABLE | MISSING | MISSING | NOT_COMPARABLE | + 6 faits de groupe |
| `exit.composition_profile` | NOT_OBSERVED | NOT_OBSERVED **(conflit nommé)** | MISSING | MISSING | NOT_COMPARABLE | + `CONFLICTING_GROUPS` |
| `exit.materiality` | NOT_MEASURABLE | NOT_MEASURABLE | MISSING | MISSING | NOT_COMPARABLE | — |
| `preshill.front_run_wallets` | MISSING | MISSING | MISSING | MISSING | NOT_COMPARABLE | — |

### Comptes agrégés — par état de comparateur uniquement

```
                @v1                                  @v2
verdicts        MATCH=1  NOT_COMPARABLE=16           MATCH=1  NOT_COMPARABLE=16
motifs          EQUAL_VALUE=1                        EQUAL_VALUE=1
                SIDE_NOT_OBSERVABLE=16               SIDE_INADMISSIBLE=3
                                                     SIDE_NOT_OBSERVABLE=13
états VINE      OBSERVED=5  NOT_OBSERVED=3           OBSERVED=7  NOT_OBSERVED=1
                NOT_MEASURABLE=4  MISSING=5          NOT_MEASURABLE=4  MISSING=5
états BOTIFY    OBSERVED=1  NOT_OBSERVED=3           OBSERVED=1  INADMISSIBLE=3
                MISSING=13                           MISSING=13
```

> **Aucun pourcentage n'est dérivé de ces comptes, et aucun ne doit l'être.**

**Le résultat central : @v2 change ce qu'on SAIT, pas ce qu'on CONCLUT.** Les
verdicts sont identiques — `MATCH=1`, `NOT_COMPARABLE=16` — parce que BOTIFY n'a
toujours ni sortie ni financement en base. Ce qui change, c'est la lisibilité :
trois refus disent désormais **pourquoi** ils refusent, et VINE rend deux faits
que @v1 détruisait.

### Contrôles intra-VINE — aucune régression

| paire | @v1 | @v2 |
|---|---|---|
| `@1737595696 ↔ @1737597101` | MATCH=5 · PARTIAL_MATCH=1 · NOT_COMPARABLE=11 | **identique** |
| `@1737595696 ↔ @1737607946` | MATCH=1 · DIFFERENT=1 · NOT_COMPARABLE=15 | **identique** |

Verdicts **et** motifs identiques sous les deux versions, y compris les quatre
`ORDINAL_REQUIRES_UNDECLARED_THRESHOLD` (191 s contre 49 s, 9 sujets contre 5).
Ce que @v2 ajoute ici est de la base : la portée `(1/1)`, l'attribution
`DECLARED_BY_SOURCE` du venue, l'`UNATTRIBUTED` de la destination et des
bailleurs, et leurs réserves.

---

## 3. C1 / C2 / C3

### C1 — `date_only` hors du vocabulaire fermé → **RÉSOLUE, sans effet ici**

`temporal.anchor_provenance` admet désormais `date_only` aux côtés de
`snowflake` et `source_timestamp`. La date est transportée **comme une date** :
`TemporalDetail` de résolution `DAY` doit être une date nue, et `INV-12` refuse
toute valeur portant une composante horaire — **y compris minuit, qui est
exactement ce que la colonne BOTIFY porte** (`2025-01-11T00:00:00.000Z`). Une
comparaison qui exigerait la résolution `INSTANT` face à une source datée au
jour rend `TEMPORAL_RESOLUTION_INSUFFICIENT`.

**Mais sur ce corpus, P2 ne débloque rien**, et c'est logique : les mêmes cinq
lignes n'ont **aucune nature**, et une ligne sans nature ne soutient aucune
feature. L'admissibilité tranche avant la valeur. P2 est donc implémenté et
démontré par tests unitaires ; il débloquera le jour où ces lignes seront
classées. **Le dire est plus utile que de le masquer.**

### C2 — pas d'état pour « trouvé, mais inadmissible » → **RÉSOLUE**

Trois features BOTIFY passent de `NOT_OBSERVED` à `INADMISSIBLE`, chacune avec
sa cause, ce qui a été trouvé et ce qui était exigé :

| feature | cause | trouvé | exigé |
|---|---|---|---|
| `identity.token_resolution_status` | `DATA_NATURE_MISSING` | 5/5 ShillEvent `rowNature` NULL, `sourcePostCandidateId` NULL | une nature classée (INFERENCE) et un post rattaché |
| `temporal.anchor_provenance` | `DATA_NATURE_MISSING` | 5/5 `rowNature` NULL ; `tweetId` construits ; horodatages à minuit | une nature classée (INFERENCE) |
| `shill.kol_handles` | `DATA_NATURE_MISMATCH` | 5/5 KolTokenLink en `EDITORIAL_ASSERTION` | `PRIMARY_OBSERVATION`, tel que le registre le déclare |

La différence n'est pas cosmétique : sous `NOT_OBSERVED` un lecteur conclut
qu'il faut **collecter davantage** ; sous `INADMISSIBLE` il sait que c'est la
**qualification** qui bloque, et que collecter la même chose n'y changera rien.

### C3 — pas de règle d'agrégation groupe→sujet → **RÉSOLUE**

`RAYDIUM` et `5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1`, démontrés par
**3 groupes sur 6**, étaient détruits par l'unanimité qu'@v1 n'avait jamais
ratifiée. Ils sont rendus, avec leur portée `SOME_GROUPS (3/6)`, les six faits de
groupe intacts, `basis.scopeRestricted = true` et la réserve
`PARTIAL SCOPE — … is NOT a whole-subject truth`.

Symétriquement, `exit.composition_profile` reste refusé — mais il est désormais
**nommé** : `CONFLICTING_GROUPS`, valeurs distinctes `[MIXED, SELL_ONLY]`, et le
motif dit explicitement que retenir la plus fréquente serait un vote majoritaire.

---

## 4. Régressions sémantiques

### R1 — trouvée par le rejeu, **refermée avant livraison**

La première écriture de @v2 rendait `PER_GROUP_MAGNITUDE` inconditionnel : au
niveau **groupe**, `191 s` contre `49 s` devenait `NOT_MEASURABLE / SIDE_NOT_OBSERVABLE`.
Le lecteur perdait ce que @v1 lui montrait — et le pack demande justement de
**préserver les faits de niveau groupe**.

**Correction** : une grandeur définie par groupe est `OBSERVED` quand le sujet
**EST** un groupe unique, et sans valeur sujet dès qu'il en agrège plusieurs. Ce
n'est pas un seuil : c'est la différence entre l'unité de définition et un
agrégat qui n'en est pas une. Dans les deux cas la grandeur reste **transportée
et jamais jugée** — INV-8 y veille.

> **Le gel de @v2 a donc été re-scellé UNE fois**, avant toute ratification et
> avant tout merge : sha `94717bdb…` → `5a1affa8…`. Ce n'est pas un ajustement
> vers un résultat désiré, et c'est vérifiable : **le résultat VINE↔BOTIFY est
> rigoureusement identique avant et après la correction** (`MATCH=1`,
> `SIDE_INADMISSIBLE=3`, `SIDE_NOT_OBSERVABLE=13`). Seul le contrôle intra-VINE
> était touché. Le sha de **@v1 n'a pas bougé**.

### R2 — aucune autre

Verdicts et motifs des deux contrôles intra-VINE sont **identiques** sous @v1 et
@v2, assertion par assertion. Aucun `MATCH`, `PARTIAL_MATCH` ou `DIFFERENT` de
@v1 n'a disparu ; aucun n'est apparu.

### Un incident à consigner : `demonst-RATING`

`assertNoAggregateScore`, partagé avec @v1, refuse toute clé contenant `rating`.
Le champ d'agrégation s'appelait `groupsDemonstrating` — et la garde l'a
**bloqué au premier run**. La garde fonctionne par sous-chaîne et elle est
délibérément large ; @v1 est gelé et on ne l'assouplit pas pour un faux positif.
**Le champ a été renommé `groupsWithValue`**, et la raison est écrite dans le
type pour que personne ne « corrige » la garde plus tard.

---

## 5. Limites restantes

1. **P2 est latent sur ce corpus.** `date_only` est admis et l'heure fabriquée
   est refusée, mais les cinq lignes concernées échouent d'abord sur
   l'admissibilité. Aucune feature ne déclare aujourd'hui
   `requiresTemporalResolution: "INSTANT"`, donc le motif
   `TEMPORAL_RESOLUTION_INSUFFICIENT` n'est exercé que par tests unitaires.
2. **Aucune étiquette n'est posée sur `5Q544fKrFo…`.** @v2 encadre l'ignorance,
   il ne la lève pas. La corrélation venue/destination reste parfaite sur ce
   corpus — les trois groupes qui nomment cette destination sont exactement ceux
   dont le venue est `RAYDIUM` — ce qui reste le comportement attendu d'une
   infrastructure d'AMM. **Trancher exigerait une étiquette auditable que le
   produit ne possède pas** ; en inventer une serait la faute que cette
   méthodologie existe pour empêcher.
3. **`shill.promotion_qualification` et `preshill.front_run_wallets` restent
   MISSING des deux côtés.** @v2 ne crée pas de données : le verdict du prédicat
   de qualification n'est persisté nulle part, et aucune occasion n'est
   rattachable à ces deux dossiers.
4. **La persistance reste hors périmètre.** Aucune table, aucun DDL, aucun
   écrit. Le conflit `InferenceEnvelope` relevé en S2 (une comparaison a des
   entrées de nature `INFERENCE`, que l'enveloppe refuse comme sources) n'est
   **pas** tranché ici.
5. **`identity.chain_demonstrated` reste sans pouvoir discriminant** sur un
   produit Solana-only. @v2 ne la retire pas — retirer une feature serait
   élargir le périmètre du correctif.
6. **BOTIFY reste sans donnée on-chain.** Le benchmark est structurellement
   asymétrique, et aucune version de méthode ne peut y remédier.

---

## 6. Attestation

- **0 écriture, 0 DDL, 0 migration, 0 Helius, 0 appel réseau, 0 nouveau corpus.**
  Le run vit en mémoire et dans un test ; le corpus est celui de S3, verbatim.
- **0 score, 0 seuil, 0 poids, 0 pourcentage, 0 embedding.**
  `assertNoAggregateScore` balaie récursivement chaque sortie — et a d'ailleurs
  bloqué un nom de champ innocent, ce qui prouve qu'elle tourne.
- **@v1 est INTACT** : sha identique, miroir octet pour octet, résultat S3
  inchangé — trois assertions dans `delta.test.ts`.
- **@v2 re-scellé une fois**, avant ratification, pour refermer R1. Le résultat
  du benchmark n'a pas bougé d'un caractère à cette occasion.
- **0 chemin gelé touché.** Ajouts : `src/lib/similarity/v2/**`,
  `content/methodologies/similarity/v2.md`, `scripts/similarity/v2-delta-run.ts`,
  `scripts/similarity/mutation-check-v2.mjs`, ce rapport. Modifications :
  `src/lib/methodology/artifact.ts` et `registry.ts` (enregistrement de @v2).
- **Suite complète : 369 fichiers, 4 603 tests verts**, 2 skipped. `tsc` 0 erreur,
  `lint:ci` 0 erreur, `mutation-check` 9/9, `mutation-check-v2` 5/5.

**Conditions de MASTER STOP : aucune atteinte.** Aucune contradiction NOUVELLE
n'est apparue : les trois de S3 sont fermées, la seule surprise du rejeu était
une régression de ma propre première écriture, refermée avant livraison et
documentée ci-dessus. Aucune décision produit ne restait à prendre — les règles
d'agrégation se dérivent du texte que chaque feature affirme déjà, et le pack
avait ratifié les états. Aucune persistance, aucun DDL, aucune frontière gelée
n'est devenue nécessaire.

**BUILD 7 = CLOSED.** Il n'y a pas de @v3 à écrire.
