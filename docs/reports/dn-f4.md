# DN-F4 — Le régime ROW lisait la mauvaise colonne

**Branche** : `feat/cc-offline-148-dn-f4-row-regime`
**Date** : 2026-09-05
**Périmètre** : le lecteur du régime ROW, et lui seul. Aucun audit Data Nature
général, aucune modification de données.

---

## Résumé

| Étape | Verdict |
|---|---|
| G1 — Impact-check (lecture seule) | ✅ **la prémisse tient** — et le bug est entièrement **latent** |
| G2 — Fix + tests ROW | ✅ `row.nature` → `row.rowNature`, 13 tests, dont 7 rouges avant le fix |

---

## G1 — Impact-check

### La prémisse, vérifiée

`src/lib/data-nature/registry.ts`, branche `case "ROW"` :

```ts
const v = row.nature;
return typeof v === "string" ? (v as NatureValue) : UNCLASSIFIED;
```

La colonne autoritaire est `rowNature`. Vérifié des deux côtés :

- **schéma** — 13 modèles déclarent `rowNature DataNature?` ; **aucun** ne
  déclare `nature`. Le commentaire de `persistence.ts:72` (« la convention du
  produit ») est confirmé par le décompte ;
- **base réelle**, `information_schema` sur ep-square-band le 2026-09-05 :

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='nature';
→ AUCUNE table n'a de colonne `nature` nue.
```

Aucun alias non plus : les seuls sites qui écrivent `rowNature: …`
(`aggregate.ts:488`, `ingest.ts:240`) utilisent le bon nom. **Il n'existe aucune
raison légitime de lire `nature`.**

> **Deux précisions sur les faits ratifiés**, sans conséquence sur le verdict :
> les déclarations `rowNature` sont **13**, pas 11 ; et **`MmClaim` n'a pas de
> colonne `rowNature`** — ni au schéma, ni en base. Cette table restera
> UNCLASSIFIED après le correctif, et c'est correct : le registre la classe en
> stage S6 précisément parce que « FACT n'est pas mappable sans jointure sur
> MmSource ». Le fix corrige donc 4 des 5 tables ROW ; la cinquième attend sa
> colonne, pas un lecteur.

### Consommateurs réels de `decorate()`

```
src/lib/labels/scanEnrich.ts:54   decorate('WalletLabel', …)   ← UNIQUE appel de production
```

`decorate()` a **un seul appelant hors tests**, et il décore `WalletLabel` —
régime **DECLARED**, pas ROW. Et `natureForRow` n'est appelé que depuis
`dto.ts` (par `decorate`, et par `natureForField` en retombée).

Les autres modules du produit passent par `natureForTable`, jamais par la ligne :

```
src/lib/shill-correlation/eventNature.ts:167      ShillEvent                  DECLARED
src/lib/shill-correlation/v2/persistence.ts:154   ShillCorrelationCandidate   DECLARED
src/lib/coordinated-exit/persistence.ts:149,188   ExitEvent, CoExitQualification  DECLARED
src/lib/funding-graph/persistence.ts:208,237      FundingEdge, FundingRelationshipObservation  DECLARED
```

### Actif vs latent

**Le bug est 100 % latent.** Aucun chemin de production n'appelle `decorate()`
— ni aucune autre fonction — sur une des cinq tables du régime ROW. Rien ne
casse aujourd'hui, et rien ne peut casser en corrigeant : il n'y a pas d'appelant
à casser.

Ce qui est cassé, c'est la **capacité** : le jour où une surface publique voudrait
sortir un `EvidenceItem` ou un `KolCase`, elle aurait reçu un `throw`, sans que
personne ne comprenne pourquoi une ligne pourtant classée en base refusait de
sortir.

### Comportement `throw` actuel

Chaîne complète, sur une table ROW :

```
natureForRow(table, row)   → lit row.nature → undefined → UNCLASSIFIED
  ↓
decorate()  → assertPublishable(UNCLASSIFIED)
  ↓
throw UnpublishableNatureError
  « sortie publique refusée : nature UNCLASSIFIED »
```

Le fail-closed fonctionne — il se déclenche simplement toujours, et pour une
raison fausse.

> **Une seconde faute, dans la même ligne.** Le cast `(v as NatureValue)` n'était
> pas vérifié : n'importe quelle chaîne — `"GARBAGE"`, `"primary_observation"` —
> ressortait comme une nature et **franchissait** `assertPublishable`, qui ne
> refuse que le littéral `UNCLASSIFIED`. Ce chemin était inatteignable puisque
> `row.nature` était toujours `undefined` ; il devient atteignable dès qu'on lit
> la vraie colonne. Le correctif valide donc la valeur — c'est ce qu'exige le
> test « invalide → reject ».

### Lignes reclassifiées par le fix

Mesuré en lecture seule le 2026-09-05 (`COUNT(*)` et `GROUP BY`, rien d'autre) :

| Table | lignes | `rowNature` renseigné | distribution |
|---|---:|---:|---|
| `EvidenceItem` | 1 104 | 1 104 | PRIMARY_OBSERVATION 1 052 · UNCLASSIFIED 41 · EDITORIAL_ASSERTION 11 |
| `KolTokenInvolvement` | 15 | 15 | UNCLASSIFIED 15 |
| `KolWallet` | 482 | 29 | THIRD_PARTY_DATA 29 |
| `KolCase` | 11 | 10 | ESTIMATE 7 · INFERENCE 3 |
| `MmClaim` | 10 | — | pas de colonne |
| **Total** | **1 622** | **1 158** | |

- **1 158 lignes** portent une valeur que le lecteur ne voyait pas.
- **1 102** d'entre elles portent une nature **publiable** : elles passent de
  « toujours UNCLASSIFIED, donc `throw` » à leur classification réelle.
- **56** portent littéralement `UNCLASSIFIED` (41 + 15) : elles restent refusées
  — mais désormais **pour la bonne raison**, parce qu'elles se déclarent non
  classées, et non parce que le lecteur regardait ailleurs.
- **464** lignes n'ont pas de valeur (453 `KolWallet`, 1 `KolCase`, 10 `MmClaim`) :
  elles restent UNCLASSIFIED, fail-closed, comportement voulu.

### Couverture de test avant

**Aucune.** `DECLARED_PREDICATE` et `FIELD` sont exercés dans
`__tests__/data-nature/invariants.test.ts` ; le régime ROW n'apparaissait dans
aucun test du dépôt. C'est ce qui a laissé la faute vivre.

**→ La prémisse tient. Aucune contradiction. Fix appliqué.**

---

## G2 — Le fix

```diff
     case "ROW": {
-      const v = row.nature;
-      return typeof v === "string" ? (v as NatureValue) : UNCLASSIFIED;
+      const v = row.rowNature;
+      return isNatureValue(v) ? v : UNCLASSIFIED;
     }
```

Deux changements, tous deux nécessaires :

1. **`row.nature` → `row.rowNature`** — la colonne autoritaire.
2. **`isNatureValue(v)` au lieu de `(v as NatureValue)`** — une valeur hors
   énumération devient UNCLASSIFIED, donc refusée. Sans ça, le premier
   changement rendrait *atteignable* un cast qui ne l'était pas.

**Aucun repli sur `nature`.** Un `row.rowNature ?? row.nature` rendrait le lecteur
compatible avec une colonne qui n'existe dans aucune table, et masquerait la
prochaine faute de nom au lieu de la faire apparaître. Un test le verrouille.

### Les tests ROW — `__tests__/data-nature/row-regime.test.ts`

Les quatre comportements exigés, plus la cohérence avec le reste du module :

| # | Test | Attendu |
|---|---|---|
| **1** | `rowNature` valide, ×5 tables ×5 natures | la nature portée |
| | cas réel : KolWallet THIRD_PARTY_DATA, KolCase ESTIMATE/INFERENCE | mesuré en base |
| **2** | `rowNature` absent / `null` / `undefined` | UNCLASSIFIED |
| | `decorate()` sur ligne sans nature, ×5 tables | `UnpublishableNatureError` |
| | `UNCLASSIFIED` explicite en base | refusé, pour la bonne raison |
| **3** | `""`, `"GARBAGE"`, `"primary_observation"`, `"Inference"` | UNCLASSIFIED |
| | `42`, `true`, `{}`, `[]`, objet à `toString` | UNCLASSIFIED |
| **4** | ligne ne portant que `nature`, ×5 tables | **UNCLASSIFIED — aucun repli** |
| | `rowNature` et `nature` en désaccord | `rowNature` gouverne |
| + | `natureForField` retombe sur la même lecture | cohérent |
| + | ligne classée → enveloppe `_nature` posée | traverse |
| + | ESTIMATE lue → Q5 s'applique | `methodRef` exigé |

**Preuve que ces tests attrapent la faute** : le correctif remis à l'état d'avant,
`7 des 13 tests échouent`. Restauré, `13 passed`.

### Un effet à signaler

Les 7 `KolCase` en `ESTIMATE` étaient invisibles ; elles sont maintenant lues,
donc soumises à Q5 — `methodRef` obligatoire, sinon `MissingMethodRefError`.
Lire correctement **resserre** le contrôle, il ne l'affaiblit pas. Aucun chemin
de production n'est concerné aujourd'hui (bug latent), mais le futur appelant
devra fournir la méthode. C'est la doctrine, pas un effet de bord.

---

## Validation

```
pnpm typecheck   → 0 erreur
pnpm test        → 362 fichiers, 4 462 tests (+11 vs 4 451 sur main)
guard-offline.sh → aucun chemin interdit modifié
```

---

## Attestation

| Point | État |
|---|---|
| Écriture de données | **aucune** — l'impact-check n'a exécuté que `SELECT` / `COUNT(*)` / `GROUP BY` sur `information_schema` et les 5 tables |
| DDL | **aucun** — aucun `ALTER`, `CREATE`, `DROP` |
| Écriture prod | **aucune** — zéro `INSERT`/`UPDATE`/`DELETE`, script d'impact supprimé après lecture |
| Helius / RPC | **aucun appel** |
| Audit DN général | **non fait** — périmètre tenu au lecteur ROW |
| Suite DN inventée | **non** — le fichier de test porte sur le régime existant, rien de neuf n'est déclaré |
| Données compensatoires | **aucune** — le lecteur est corrigé, la base n'est pas touchée |

Fichiers modifiés : `src/lib/data-nature/registry.ts` (2 lignes de code, plus le
commentaire qui dit pourquoi), `__tests__/data-nature/row-regime.test.ts`
(nouveau), ce rapport.

**DN-F4 = CLOSED.**

Reste ouvert, hors périmètre : `MmClaim` attend sa colonne `rowNature` (stage S6,
jointure `MmSource` requise), et 464 lignes des tables ROW attendent leur
classification — deux chantiers de données, pas de lecteur.
