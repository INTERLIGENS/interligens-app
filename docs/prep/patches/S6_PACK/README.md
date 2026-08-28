# PACK S6 — l'enforcement côté base

**À APPLIQUER À LA MAIN, UN FICHIER À LA FOIS. Rien n'a été exécuté.**
Neon SQL Editor uniquement, jamais `prisma migrate` (verrou A9).

## ⛔ Un préalable

**La PR #193 (S6-0 à S6-4) doit être mergée.** Le CHECK du fichier 01 recopie
la grammaire canonique de `src/lib/data-nature/methodRef.ts` :

```
^[a-z][a-z0-9-]{1,63}/[a-z][a-z0-9-]{1,63}@v[0-9]+$
```

La base **reproduit** ce corps, elle ne le redérive pas — c'est la duplication
de cette règle en deux endroits qui avait produit deux grammaires
incompatibles. Un test applicatif vérifie l'égalité des deux chaînes ; poser le
CHECK avant que la source existe casserait ce lien.

## Ordre d'exécution

| # | Fichier | Effet | Lignes réécrites |
|---|---|---|---|
| 0 | `00_S6-1_drop_stale_default.sql` | `DROP DEFAULT` sur `KolCase.methodologyRef` | **0** |
| 1 | `01_S6-5_check_kolcase_estimate.sql` | `CHECK … NOT VALID` — 7/7 conformes | **0** |
| 2 | `02_S6-5_check_token_casefiles_estimate.sql` | `CHECK … NOT VALID` — 1/1 conforme | **0** |

**Aucun `UPDATE`, aucun `DELETE`, aucune donnée réécrite.** Trois `ALTER TABLE`,
c'est tout.

**Le fichier 00 précède le 01 impérativement.** Sans le `DROP DEFAULT`, une
nouvelle ligne naîtrait avec `/en/methodology` et le CHECK serait satisfait
d'office par une route morte : le garde passerait, et ne garderait rien.

## Inventaire `methodologyRef` (S6-1) — aucune réécriture

Mesuré le 2026-08-29, en lecture seule :

| Valeur | `rowNature` | n | dont chiffrées |
|---|---|---|---|
| `financial-estimates/est-proceeds@v1` | `ESTIMATE` | **7** | 7 |
| `/en/methodology` | `INFERENCE` | **3** | 0 |
| `/en/methodology` | *(NULL)* | **1** | 1 |

Les 4 lignes legacy **restent inchangées**. Les 3 `INFERENCE` n'ont pas de
montant, donc rien à justifier ; la 11ᵉ porte un consumer réel
(`checkPublishability`, S5-E) et sa référence n'est pas retirée à l'aveugle.
Le fichier 00 ferme le robinet, il ne touche pas à l'eau déjà dans la baignoire.

## `NOT VALID` d'abord, `VALIDATE` seulement après preuve

`NOT VALID` n'empêche rien à l'écriture : la contrainte s'applique
immédiatement aux nouvelles lignes. Il diffère seulement la revalidation de
l'existant. Les deux prédicats sont **déjà satisfaits à 100 %** (7/7 et 1/1) —
ce n'est donc pas un aveu de dette, mais la garantie qu'un `VALIDATE` ne
surprenne pas au milieu d'une migration.

Chaque fichier porte son post-check et laisse le `VALIDATE` **en commentaire** :
on lit les comptes, puis on valide.

## Ce que les CHECK ne couvrent PAS

Ils contraignent la **forme**, pas la **véracité**.
`financial-estimates/est-proceeds@v1` passera même si l'artefact `v1` disparaît
du dépôt. Fermer cela demande un test applicatif (`resolveMethodRef` sur chaque
valeur distincte en base), pas une contrainte SQL.

## Ce qui n'est PAS contraint, et pourquoi

- **`KolTokenInvolvement.retailLossEstimateUsd`** — 0/15 renseignées, aucun
  writer. Déjà tranché : le `CHECK` attend le premier writer réel et ses tests.
- **Aucun `CHECK` global multi-tables** — impossible : `KolCase` porte
  `methodologyRef` sans basis, `token_casefiles` porte un basis sans methodRef.
  Aucune table n'a les deux.
- **Les autres colonnes de nature de `token_casefiles`** — aucun porteur
  d'auditabilité. Les inclure interdirait une `ESTIMATE` légitime future faute
  de colonne pour la justifier, et une contrainte qui bloque le travail
  légitime finit désactivée. Une contrainte désactivée est pire qu'absente.

## Après exécution

S6 est complet : la doctrine ne tient plus par omission, ni côté application
(PR #193) ni côté base (ce pack). **BUILD 2 est fermable.**
