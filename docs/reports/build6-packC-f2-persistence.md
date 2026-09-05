# BUILD 6 — PACK C : F2 persistance (schéma + writer + dry-run)

Branche `feat/cc-offline-139-coexit-f2-persistence`, depuis `main = ef64ce5`.
**STOP avant la migration Neon et avant tout write prod.**

## 1. Schéma — deux tables, deux niveaux

| table | ce qu'elle porte | nature |
|---|---|---|
| `ExitEvent` | un acte **constaté** | PRIMARY_OBSERVATION |
| `CoExitQualification` | une règle **appliquée** | INFERENCE + basis + methodRef |

**Choix de colonnes défendus :**

- **`amount` et `observedCounterpartyAmount` en BigInt** — les unités de token
  dépassent le `Number` sûr ; un arrondi silencieux sur une quantité de preuve
  serait indéfendable.
- **`observedCounterpartyMeaning` stocké en colonne** — le sens voyage avec le
  champ jusqu'en base. Le stocker sans son sens laisserait la requête suivante
  l'additionner.
- **`type` et `category` en `text`, pas enum** — le vocabulaire est versionné par
  la règle (`coordinated-exit/extract@v1`, `qualify@v1`) ; un enum imposerait une
  DDL à chaque révision de méthodologie.
- **Les 7 dimensions en colonnes, pas en JSON** — elles se filtrent, se trient et
  se contestent une par une. Les enfouir dans un blob les aurait rendues
  illisibles à quiconque n'ouvre pas le JSON.
- **`groupKey` dérivé** (`mint@earliestBlockTime`) — un identifiant tiré d'un
  compteur aurait changé d'un run à l'autre, et l'idempotence se serait évaporée
  au premier rejeu.

Unicité : `ExitEvent.txSignature` · `CoExitQualification(contextRef, groupKey,
methodRef)`.

Client régénéré : **165 modèles**, `prisma.exitEvent` et
`prisma.coExitQualification` présents.

## 2. Writer — gates de mutation

Store **injecté** : le module n'importe ni prisma ni réseau (testé sur les
6 fichiers). `dryRun: true` par défaut, et le plan du dry-run est asserté **égal**
à celui du réel.

| mutation | rougit si… |
|---|---|
| **fail-closed registre** | une ligne est construite alors que la table n'est pas déclarée |
| duplication au rejeu | un `insert` de plus au second passage |
| écrasement silencieux (événement) | `amount` divergent écrase au lieu de refuser |
| écrasement silencieux (groupe) | `distinctSubjects` divergent écrase |
| `groupKey` instable | deux appels donnent des clés différentes |
| `INFERENCE` dans `inputNatures` | accepté |
| basis absent / vide / policyVersion vide | `auditable` reste vrai |
| `methodRef` non résolvable | accepté (4 variantes testées) |
| write contournant S6 | une nature fabriquée hors `persistence.ts` |
| write réel sans store | dégradé en dry-run au lieu de lever |
| **destination promue en identité** | un label (`exchange`, `treasury`, `pool`, `cex`, `deployer`, `insider`…) apparaît, ou un champ `destinationLabel` existe |
| **`observedCounterpartyAmount` sommé** | `reduce` / `sum` / `pnl` dans le code exécutable, ou la clé apparaît dans une qualification |
| invariant SELL | un SELL sans provenance démontrée s'écrit |

**87 tests** sur le module.

### Le refus fail-closed est prouvé sans simulation

Le premier test constate l'état **réel** du dépôt : les deux tables ne sont pas
au registre, et `buildExitEventRow` lève `CoExitNatureRegistryMismatchError`
(« le registre déclare UNCLASSIFIED »). Les tests suivants **simulent** l'état
post-migration pour éprouver le chemin d'écriture ; la simulation est déclarée,
bornée au fichier, et défaite après.

## 3. Migration — émise, vérifiée, **non exécutée**

`docs/prep/MIGRATION_COORDINATED_EXIT_2026-09-05.sql` : 2 `CREATE TABLE`,
7 index, **3 CHECK `NOT VALID`** :

- `exitevent_rownature_declared_chk` — `PRIMARY_OBSERVATION`
- `coexitqual_rownature_declared_chk` — `INFERENCE`
- `coexitqual_rownature_auditable_chk` — prédicat **copié à l'identique** de
  `shillevent_rownature_auditable_chk`

Pas de CHECK auditable sur `ExitEvent` : une observation n'a pas de piste
d'inférence à produire, elle *est* la piste.

**Vérifiée sous transaction annulée** — 12 instructions parsées, `ROLLBACK`,
puis `information_schema` confirme : **aucune table créée**. Aucun `VALIDATE`.

Patch registre **préparé, non appliqué** :
`docs/prep/REGISTRY_PATCH_COORDINATED_EXIT_2026-09-05.txt`. L'invariant I5 exige
que le registre ne nomme que des tables présentes au snapshot, et le snapshot est
une **mesure** de ep-square-band. L'appliquer avant la migration falsifierait une
mesure pour faire passer un test.

**Ordre imposé :** DDL → snapshot rafraîchi (180 → 182) → registre → S6 accepte.

## 4. Dry-run VINE — les lignes exactes

Corpus F1 déjà collecté, paramètres ratifiés inchangés. **0 appel Helius.**

- **`ExitEvent` planifiés : 458** — 453 SELL, 5 OUTGOING_TRANSFER
- **`CoExitQualification` planifiées : 6**

| groupKey | catégorie | sujets | paires | min | span | venue | dest | SELL/OUT | matérialité |
|---|---|---|---|---|---|---|---|---|---|
| `…@1737595696` | NARROW_WINDOW_CLUSTER | **9** | 334 | 0 s | 191 s | RAYDIUM | `5Q544fKrFo…` | 37/0 | NOT_MEASURABLE |
| `…@1737596356` | NARROW_WINDOW_CLUSTER | 4 | 53 | 0 s | 185 s | RAYDIUM | `5Q544fKrFo…` | 22/0 | NOT_MEASURABLE |
| `…@1737597101` | NARROW_WINDOW_CLUSTER | 5 | 19 | 3 s | 49 s | RAYDIUM | `5Q544fKrFo…` | 7/0 | NOT_MEASURABLE |
| `…@1737607946` | NARROW_WINDOW_CLUSTER | 2 | 2 | 37 s | 55 s | — | — | 2/1 | NOT_MEASURABLE |
| `…@1743216544` | NARROW_WINDOW_CLUSTER | 2 | 16 | 13 s | 337 s | — | — | 25/0 | NOT_MEASURABLE |
| `…@1743217414` | NARROW_WINDOW_CLUSTER | 2 | 1 | 53 s | 62 s | — | — | 3/0 | NOT_MEASURABLE |

**Conformité locale : 464/464 lignes.** `ExitEvent` 458/458 `declared`, `amount`
et contrepartie en bigint, meaning porté sur tous les SELL, aucune destination
labellisée. `CoExitQualification` 6/6 `declared` + `auditable`, `inputNatures`
sans `INFERENCE`, `methodRef` gelé résolvable. **0 conflit.**

Le démenti *« NARROW_WINDOW_CLUSTER IS NOT COORDINATED_EXIT »* est **persisté**
dans `natureBasis.reservations` des 6.

La destination unanime `5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1` est
persistée **comme adresse observée, sans label** — vérifié structurellement : la
clé `observedCounterpartyAmount` n'existe dans aucune qualification, et aucun
champ d'identité n'existe sur `ExitEvent`.

## 5. Attestation

- **0 appel Helius** sur ce pack.
- **Aucun write de données prod.**
- **Aucune migration exécutée** — la DDL est émise, parsée sous rollback,
  et `information_schema` confirme 0 table créée.
- Registre **non modifié** — patch préparé seulement.
- Pack A et Pack B non rouverts ; aucun seuil, aucune méthodo touchée.
- Aucun cast masquant dans le module.

### Point ouvert à refermer

L'exemption guard (PR #237) est **encore ouverte**. Elle doit être refermée
byte-identique (`ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50`)
**après** le merge de cette branche.

**STOP conditions : aucune.** La migration Neon et le premier write attendent
votre GO.
