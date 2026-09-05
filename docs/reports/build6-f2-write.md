# BUILD 6 — F2 : registre appliqué + premier write prod

Branche `feat/cc-offline-140-coexit-f2-write`, depuis `main = 83f23f2`.
**STOP avant tout `VALIDATE`.**

## 1. La DDL, relue avant d'y toucher

| | |
|---|---|
| `ExitEvent` | 16 colonnes, 5 index |
| `CoExitQualification` | 23 colonnes, 4 index |
| CHECK | 3, tous `convalidated = false` |

## 2. Snapshot remesuré

`src/lib/data-nature/__schema-snapshot.json`, relu depuis `information_schema`
d'ep-square-band (`table_schema='public'`, `BASE TABLE`) :

| | |
|---|---|
| avant | **180** tables, mesuré 2026-09-04 |
| après | **182** tables, mesuré 2026-09-05 |
| ajoutées | `ExitEvent`, `CoExitQualification` |
| **disparues** | **aucune** |

La disparition est vérifiée autant que l'ajout : un snapshot qui gagne deux
tables mais en perd d'autres serait une régression invisible.

## 3. Registre appliqué

| table | regime | nature | basis |
|---|---|---|---|
| `ExitEvent` | DECLARED | **PRIMARY_OBSERVATION** | — |
| `CoExitQualification` | DECLARED | **INFERENCE** | PRIMARY_OBSERVATION |

`natureForTable` : `PRIMARY_OBSERVATION` / `INFERENCE` / `UNCLASSIFIED` sur une
table inconnue. **I5 vert.**

### Un test à recentrer

Le test « FAIL-CLOSED : sans entrée au registre, aucune ligne n'est construite »
affirmait que le registre **ne contenait pas** ces tables. C'était vrai avant la
migration — et faux le jour de la déclaration. L'assertion tenait par accident
sur l'état du dépôt, pas sur le mécanisme.

Il **retire** désormais l'entrée, constate le refus, puis la restaure. Un second
test fait de même pour la qualification. Ce qui est prouvé est la règle — sans
déclaration, rien ne s'écrit — indépendamment de ce que le registre contient à
un instant donné.

Suite : **4 441 tests verts** (361 fichiers), tsc propre.

## 4. Write réel

| | avant | passe 1 | passe 2 |
|---|---|---|---|
| `ExitEvent` | 0 | **+458** | **0 inséré**, 458 déjà présents |
| `CoExitQualification` | 0 | **+6** | **0 inséré**, 6 déjà présentes |
| conflits | — | 0 | 0 |

**Idempotence prouvée en prod.**

### En base, relu après coup

`ExitEvent` — **458 lignes**, toutes `PRIMARY_OBSERVATION` :

| type | n | signatures | sujets | avec `observedCounterpartyMeaning` |
|---|---|---|---|---|
| SELL | 453 | 453 | 15 | **453** |
| OUTGOING_TRANSFER | 5 | 5 | 3 | 0 |

Le sens n'est porté que par les SELL — un transfert n'a pas de contrepartie, et
lui coller un meaning aurait suggéré qu'il en existait une.

`CoExitQualification` — **6 lignes**, toutes `INFERENCE` :

| catégorie | sujets | paires | span | venue | SELL/OUT | matérialité |
|---|---|---|---|---|---|---|
| NARROW_WINDOW_CLUSTER | **9** | 334 | 191 s | RAYDIUM | 37/0 | NOT_MEASURABLE |
| NARROW_WINDOW_CLUSTER | 4 | 53 | 185 s | RAYDIUM | 22/0 | NOT_MEASURABLE |
| NARROW_WINDOW_CLUSTER | 5 | 19 | 49 s | RAYDIUM | 7/0 | NOT_MEASURABLE |
| NARROW_WINDOW_CLUSTER | 2 | 2 | 55 s | — | 2/1 | NOT_MEASURABLE |
| NARROW_WINDOW_CLUSTER | 2 | 16 | 337 s | — | 25/0 | NOT_MEASURABLE |
| NARROW_WINDOW_CLUSTER | 2 | 1 | 62 s | — | 3/0 | NOT_MEASURABLE |

**Audit des 6, lu en base :**

- `inputNatures` contenant `INFERENCE` : **0**
- `methodRef = coordinated-exit/qualify@v1` : **6/6**
- démenti *« NARROW_WINDOW_CLUSTER IS NOT COORDINATED_EXIT »* dans le
  `natureBasis` : **6/6**
- `naturePolicyVersion` non vide : **6/6**

**14 destinations distinctes** persistées comme adresses, **sans label** — aucun
champ d'identité sémantique n'existe sur la table.

## 5. Aucun VALIDATE

```
coexitqual_rownature_auditable_chk   convalidated=false
coexitqual_rownature_declared_chk    convalidated=false
exitevent_rownature_declared_chk     convalidated=false
```

Les trois CHECK gardent les écritures à venir sans avoir été ratifiés. Le
`VALIDATE` reste une étape séparée, à votre main dans Neon.

## Attestation

- **0 appel Helius.**
- Aucune DDL exécutée par Claude Code — la migration était déjà en base.
- Aucun chemin gelé touché hors registre et snapshot.
- **Aucun verdict** : ni coordination, ni dump, ni intention. Les lignes portent
  des dimensions et leurs réserves.

**STOP conditions : aucune.**
