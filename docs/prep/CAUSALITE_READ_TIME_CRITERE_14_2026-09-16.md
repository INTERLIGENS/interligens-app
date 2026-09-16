# CRITÈRE 14 — LA CAUSALITÉ EST VÉRIFIÉE À LA LECTURE

**2026-09-16 · CC-OFFLINE-250 · FAIL causal rendu par la passe adversariale T2**

> **UNE DÉPENDANCE VÉRIFIÉE À L'INSERTION NE GOUVERNE PAS À ELLE SEULE UNE PROJECTION FUTURE.**
> **LA PROJECTION D'UNE INFÉRENCE DOIT ÊTRE CONDITIONNÉE PAR L'AUTORITÉ ACTUELLE DES CLAIMS
> QU'ELLE CONSOMME.**

---

## §1 · LE DÉFAUT, TEL QUE MESURÉ

`projectAssembly` et `projectConclusions` ne consommaient de la dépendance que son **compte** :

```ts
decideFoundationContract(entree, registre, deps.length)
```

`sourceClaimId` n'était **jamais** rapproché des claims admises. Une inférence restait donc projetée
aussi longtemps qu'une **ligne** existait dans `casefile_claim_dependencies` — même si la claim
qu'elle déclare consommer avait perdu son autorité.

L'exécuteur gouverné (`CC-OFFLINE-232`) vérifie bien la chaîne, et ses mutants le prouvent — mais
leur `describe` le dit lui-même : *« la consommation causale est dans l'EXÉCUTEUR »*. C'est-à-dire
**à l'écriture**.

> **LE CRITÈRE 14 PORTE SUR LE RETRAIT DU FINDING, QUI EST READ-TIME.**
> Une garantie write-time ne retire jamais rien.

---

## §2 · LE CONTRAT OBTENU

Pour qu'une claim soit projetée côté `COUNSEL_INVESTOR` :

| | |
|---|---|
| **A** | elle satisfait son propre contrat `decideFoundationContract` |
| **B** | le compte passé au contrat est celui des dépendances **réellement validées**, jamais des lignes |
| **C** | chaque dépendance déclarée résout **exactement** `casefileRef + sourceClaimId + sourceVersion` |
| **D** | la claim source est **actuellement** fondable, selon **son propre** contrat |
| **E** | si une source nécessaire ne l'est plus : **l'inférence n'est pas projetée** |

**`casefileRef`** n'est pas revérifié dans la projection parce qu'il est déjà l'unique périmètre de
la lecture : `loadClaimDependencies` filtre `WHERE casefile_ref = ${ref}` et `loadCanonicalCaseFile`
charge le dossier de cette même ref. Une dépendance d'un autre dossier n'entre pas dans l'assemblage,
et une source d'un autre dossier n'y est pas résolvable.

### ALL, pas ANY

**Toutes** les dépendances déclarées pour cette version doivent résoudre vers des sources
actuellement fondables. **Une seule invalide ⇒ non projetable.** Il n'y a pas de « une sur deux
suffit » : une sémantique alternative serait une autre sémantique, explicite, et ce n'est pas
celle-ci.

### Le point fixe, et pourquoi le plus petit

Une source peut elle-même être une inférence. Le calcul part de l'ensemble **vide** et ne fait que
**croître** : une claim n'entre que lorsque tout ce qu'elle consomme y est déjà. **Un cycle n'entre
jamais** — et c'est correct : un fondement circulaire n'est pas un fondement.

### Ce n'est pas un second moteur

L'autorité qui décide si une claim est fondable **reste `decideFoundationContract`**, la même qu'à
l'écriture, appelée telle quelle. Ce qui est ajouté est **uniquement la résolution** de la
dépendance — exactement ce que l'écrivain nomme déjà `DEPENDENCY_UNRESOLVED` et
`DEPENDENCY_NOT_FOUNDABLE`. La projection **consomme** une autorité ; elle n'en fabrique pas.

---

## §3 · LE TÉMOIN DÉCISIF

Dans **chacun** des mutants causaux, la ligne `casefile_claim_dependencies` **est toujours là**,
intacte, épinglée sur la bonne version. Seule l'autorité de la source est dégradée.

```
NOMINAL   VINE-CONCLUSION-01 v1 → DERIVED_FROM → VINE-MEASURE-01 v1
          source foundation MET            → COUNSEL PRESENT ✅
          publication authority ABSENTE    → PUBLIC  ABSENT  ✅

MUTANT CAUSAL — la ligne de dépendance N'EST PAS TOUCHÉE
  pièce de la source DÉQUALIFIÉE (UNKNOWN)     → COUNSEL ABSENT
  pièce de la source RETIRÉE du dossier        → COUNSEL ABSENT
  source DÉCLASSIFIÉE (rowNature null)         → COUNSEL ABSENT
  source SUPERSÉDÉE, seule la v2 subsiste      → COUNSEL ABSENT
  source DISPARUE du dossier                   → COUNSEL ABSENT

MUTANT COMPLÉMENTAIRE — FK EXISTENCE ≠ FOUNDATION AUTHORITY
  ligne présente + claim source présente + version EXACTE, fondement UNMET
                                               → COUNSEL ABSENT
  chaîne à deux étages, dernier étage rompu    → COUNSEL ABSENT
  fondement CIRCULAIRE                         → COUNSEL ABSENT

ALL, PAS ANY
  deux dépendances fondées                     → PRÉSENTE, avec les deux
  une seule des deux rompue                    → ABSENTE

LES QUATRE INTERDITS
  repli vers une version antérieure            → ABSENTE
  claim « équivalente »                        → ABSENTE
  résurrection par supersedes                  → ABSENTE
  re-raisonnement sur les preuves              → aucun : le contrat seul juge
```

### Test de suffisance — exercé, pas supposé

> *Si retirer la validation read-time laisse le test vert, le test est insuffisant.*

Le contre-factuel a été **posé puis retiré** : en remettant `decideFoundationContract(entree,
registre, deps.length)` à la place de la résolution, **13 des 18 témoins rougissent**. Le témoin
mesure donc bien la consommation causale, et non une propriété déjà vraie.

---

## §4 · CE QUI N'A PAS BOUGÉ

`decidePublicationContract` **n'est pas modifié**. Une inférence ne devient pas `PUBLIC` parce que
ses dépendances sont fondables :

```
COUNSEL : foundation chain current
PUBLIC  : foundation chain current  +  publication authority
```

L'ajout côté `PUBLIC` ne peut **rien** rejeter que la publication acceptait déjà sur ses pièces —
`isPublicationEligibleSource` est strictement plus fort que `isFoundationEligibleSource`, donc
publication MET ⇒ fondement MET. Il ne mord que là où la **chaîne consommée** est rompue, ce qui est
exactement l'objet du critère 14. `VINE-CONCLUSION-01` reste **COUNSEL PRESENT · PUBLIC ABSENT**.

### Les fixtures de CC-OFFLINE-234 ont dû porter la donnée réelle

Elles déclaraient la dépendance vers `VINE-MEASURE-01 v1` **sans jamais porter cette claim**. Tant
que la projection ne consommait que `deps.length`, cela passait — **c'était précisément le défaut**.
La claim source a été ajoutée au dossier de test, telle qu'elle existe en production. Aucune
assertion n'a été affaiblie.

---

## §5 · DETTE CONSIGNÉE, NON RÉPARÉE

> **READ BUT NOT CONSUMED ≠ AUTHORITATIVE PRODUCT INPUT.**

`loadCanonicalCaseFile` (`canonicalReader.ts:295`) sélectionne encore `tigerScore`, `verdict` et
`keyWallets`. Mesuré par T2 : **lus, non propagés, non consommés**. Ils ne causent pas le FAIL, leur
retrait n'améliorerait pas le witness, et le faire ici mélangerait hygiène et correction causale.
**Décision architecte : BACKLOG.** Non touchés, y compris là où le correctif passait à côté.

Rappel de la dette voisine, déjà consignée en `CC-OFFLINE-248` : **LEGACY RECONCILIATION DOES NOT
ESTABLISH BODY INTEGRITY** — le réconciliateur historique compare deux déclarations du même écrivain.
BACKLOG également.

---

## §6 · DÉCLARATION D'ÉCART

| Autorisé | Exercé |
|---|---|
| mesurer le périmètre réel avant de toucher quoi que ce soit | **exercé** — l'assemblage transportait déjà tout : claims versionnées, pièces qualifiées, dépendances épinglées des deux côtés. `canonicalReader.ts` **n'a pas eu à être modifié** |
| `canonicalReader.ts` · `audienceProjection.ts` (hypothèse architecte) | **un seul fichier de production touché** : `audienceProjection.ts` |
| chemins gelés → STOP le temps d'une lease | **non exercé** — mesuré : `src/lib/casefile/` n'est pas gelé par `guard-offline.sh`. **Aucune lease ouverte**, résiduel 0. Ouvrir une lease sur un chemin libre serait une fiction |
| réutiliser le contrat d'autorité existant | **exercé** — `decideFoundationContract`, inchangé. Aucun second moteur de fondement |
| mutant décisif | **exercé**, plus le mutant complémentaire, la sémantique ALL, les quatre interdits, les deux chaînes multi-étages, le cycle, et **les deux surfaces** (`projectAssembly` et `projectConclusions`) |
| test de suffisance | **exercé réellement** — contre-factuel posé, 13/18 rouges, contre-factuel retiré |
| `decidePublicationContract` intouché | **exercé** — aucune ligne modifiée ; le témoin COUNSEL PRESENT / PUBLIC ABSENT reste vert |
| surface latente `tigerScore` · `verdict` · `keyWallets` | **non touchée**, consignée §5 |
| preflight · déploiement | **NON EXERCÉ — interdit par l'ordre du 15:45.** Aucun preflight lancé, aucun déploiement |

Aucun DDL, aucune migration, aucune autorité nouvelle, aucun cron, aucun service, aucun coût.

**528 fichiers · 7879 tests verts** (+18). `tsc --noEmit` propre.
