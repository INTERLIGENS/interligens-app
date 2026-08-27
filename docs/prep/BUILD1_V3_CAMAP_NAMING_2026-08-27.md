# BUILD 1 V3 — étapes a + b
## a. Correction du bug de construction CA_MAP (UR-12) · b. Nommage unifié
### 2026-08-27

Branche : `feat/cc-offline-109-token-resolution-v2` (locale, jamais poussée)
**Nom canonique du module : `src/lib/token-resolution/v3/`** — marqué `@canonical-resolver`
État : `tsc` 0 erreur · `vitest run` **321 fichiers, 3 735 tests verts, 0 échec** ·
`eslint` **0 erreur** · `guard-offline.sh` ✅

Rien mergé, rien déployé, rien poussé. Neon en lecture seule, aucune écriture DB,
aucune migration. **V3 reste inerte** : zéro consommateur.

---

# a. CA_MAP — un index de dossiers lu comme un index de tickers

## Ce que la structure est réellement

`CA_MAP` (`src/lib/kol/proceeds.ts`) est un index **identifiant de dossier → contrat**.
Son producteur le dit sans ambiguïté, ligne 238 du même fichier :

```ts
const caseIds = profile.kolCases.map((c) => c.caseId);
caseIds.map((id) => ({ caseId: id, ca: CA_MAP[id] }))
```

V3 la consommait comme un mapping ticker → contrat :
`findCaMapByTicker(ticker)` faisait `CA_MAP[cleanTicker(ticker)]`.

Le piège est que ses clés **ressemblent** à des tickers :

```
CA_MAP["BOTIFY"]        = BYZ9CcZ…
CA_MAP["GHOST"]         = De4ULou…
CA_MAP["SERIAL-12RUGS"] = BYZ9CcZ…   ← le contrat de BOTIFY
CA_MAP["DIONE-RUG"]     = De4ULou…   ← le contrat du dossier GHOST
CA_MAP["GHOST-RUG"]     = De4ULou…   ← même contrat, autre clé
```

« SERIAL-12RUGS » est un identifiant de dossier — *douze rugs en série*, un motif
de comportement. **Ce n'est le ticker d'aucun token.** Et six clés pointent trois
contrats : la structure n'est pas une bijection ticker↔contrat, et n'a jamais
prétendu l'être.

Vérifié en lecture seule sur `ep-square-band` le 2026-08-27 —
`KolCase.caseId` distincts en base : **`BOTIFY` · `GHOST` · `RAVE-DUMP-APR2026` ·
`SERIAL-12RUGS`**. Ce sont bien des dossiers.

## Les deux dégâts, reproduits avant correction

### `$SERIAL-12RUGS` → RESOLVED / HIGH sur le contrat de BOTIFY

Chaîne d'événements, tous mesurés en prod :

1. `KolTokenLink` porte bien une ligne publique `tokenSymbol = "SERIAL-12RUGS"` —
   mais son `contractAddress` est `"PENDING:SERIAL-12RUGS"`, un marqueur
   éditorial, correctement rejeté. **Aucun candidat.**
2. `findCaMapByTicker("SERIAL-12RUGS")` renvoie le contrat de **BOTIFY**,
   étiqueté du symbole `SERIAL-12RUGS`.
3. Le tier interne est donc non vide ⇒ **DexScreener n'est jamais appelé**.
4. L'enrichissement attache `TokenScanAggregate` (scanCount 4) et
   `KolTokenInvolvement` (3 KOL) au contrat de BOTIFY. Ces deux sources ne sont
   pas « sans marché » ⇒ le garde-fou I3 **ne se déclenche pas**.
5. Candidat unique, soutien interne, correspondance exacte
   (`SERIAL-12RUGS` == `SERIAL-12RUGS`) ⇒ **`RESOLVED` / `HIGH` / méthode `ca_map`**.

Un nom de dossier résolvait vers un token sans rapport, annoncé comme certain.

### `$GHOST` → CONFLICT, alors que la V1 résolvait

- `KolTokenLink` public : `GHOST` → `BBKPiLM9…GHST`, **5 KOL**. C'est la réponse
  de la V1.
- `CA_MAP["GHOST"]` → `De4ULou…pump`, un contrat qui **n'apparaît dans aucune
  ligne `KolTokenLink`** (vérifié : 0 ligne).

Le second fabriquait un **rival fantôme** sous le symbole `$GHOST`. Deux contrats,
un symbole, deux sources internes ⇒ collision d'identité E5 avec contestation
interne ⇒ **`CONFLICT`**. Le bug CA_MAP faisait donc régresser un cas que la V1
traitait correctement — et il le faisait *via* une règle saine.

## Le correctif

**`src/lib/token-resolution/v3/sources/caseIndex.ts`** — seul fichier de V3
autorisé à lire `CA_MAP`.

- **Type nominal `CaseId`** (marque de type unique). Une chaîne quelconque n'est
  pas un `CaseId` : il faut passer par `asCaseId()`, qui est le point où
  l'intention devient explicite et relisible en revue. **Le compilateur porte
  l'invariant.**
- `contractForCaseId(caseId: CaseId)` et `findContractsByCaseIds(caseIds)` — les
  seuls accès. Il n'existe **aucun** chemin par ticker.
- Les candidats produits **ne portent aucun symbole**. L'index n'a pas de ticker ;
  en inventer un les rendrait comparables à une requête par symbole et recréerait
  le défaut. Le candidat vaut par son **contrat**, conformément à E5.
- `findCaMapByTicker` **supprimé** de `sources/db.ts`, avec son import de `CA_MAP`.
- `ResolutionRequest.caseIds?: readonly string[]` ajouté : l'index reste utilisable
  **pour sa vraie sémantique** par un appelant qui détient de vrais identifiants
  de dossier (contexte bridge / proceeds). Ce n'est pas une fonctionnalité
  supprimée, c'est une sémantique remise à l'endroit.

> **Pourquoi aucune transformation ticker → caseId n'a été écrite** : elle n'est
> pas dérivable des données. `KolCase` ne porte que `(kolHandle, caseId, role,
> paidUsd, evidence, …)` — **aucune colonne symbole**. Fabriquer la
> correspondance à la main aurait reproduit exactement le défaut, avec une
> couche de bonne conscience en plus.

`src/lib/kol/proceeds.ts` n'est **pas modifié** (chemin gelé `^src/lib/kol/`) :
il est importé, jamais réécrit.

## UR-12 — INDEX SEMANTICS, invariant contractuel

> Une structure indexée par `caseId` ne peut **jamais** être consommée comme un
> mapping ticker/symbole **sans transformation explicite**.

`__tests__/ur12-index-semantics.test.ts` — 10 tests, deux étages.

**Étage comportemental** (données de prod reproduites) :

| Test | Attendu |
|---|---|
| `$SERIAL-12RUGS` | ne résout **jamais** vers le contrat de BOTIFY |
| `$SERIAL-12RUGS` | n'est **pas** servi comme certain |
| `$DIONE-RUG` | ne résout pas vers le contrat du dossier GHOST |
| `$GHOST` | résout sur `BBKPiLM9…GHST`, méthode `curated` — **comme la V1** |
| `$GHOST` | le contrat fantôme n'apparaît ni en candidat ni en écarté |

**Étage statique** — pour le jour où quelqu'un rebranche l'index « juste pour
dépanner » :

- `CA_MAP` n'est importée que par `sources/caseIndex.ts`, et par lui seul ;
- aucun `CA_MAP[…]` dans V3 dont la clé ne soit pas un `caseId` (commentaires
  retirés avant analyse — ils *citent* le défaut pour l'expliquer) ;
- le module d'index ne contient, **dans son code**, ni `ticker` ni `cashtag` ;
- `sources/db.ts` ne mentionne plus ni `CA_MAP` ni `findCaMapByTicker`.

### RED → GREEN, vérifié dans les deux sens

**RED avant correction** — 9 tests sur 10 rouges, reproduisant précisément le
bug : `expected 'BYZ9CcZ…' not to be 'BYZ9CcZ…'` sur `$SERIAL-12RUGS`,
`expected 'CONFLICT' to be 'RESOLVED'` sur `$GHOST`.

**GREEN après correction** — 10/10.

**Mutation dirigée** — réintroduction d'une seule ligne
(`findContractsByCaseIds([asCaseId(ticker)])`) : **les 5 tests comportementaux
redeviennent rouges**. L'invariant est porteur, pas décoratif.

## Effet de bord : le harnais de test était trop permissif

En corrigeant, `$SERIAL-12RUGS` restait `RESOLVED` — mais pour une autre raison :
`createFakeDb` renvoyait **toutes** les lignes déclarées quelle que soit la
requête, donc une recherche `$SERIAL-12RUGS` recevait aussi les lignes `$GHOST`.

`createFakeDb` applique désormais **les mêmes filtres que le SQL réel** :
préfiltre de préfixe de symbole (`LIKE $1`) et restriction par adresse (`IN (…)`).
Une fausse base plus permissive que la vraie ne teste rien : elle flatte. Les 85
tests antérieurs restent verts après ce durcissement — ils ne s'appuyaient pas
sur la permissivité.

---

# b. Nommage — un seul module canonique

## État constaté

| Chemin | Rôle | Consommateurs |
|---|---|---|
| `src/lib/token-resolution/v3/` | **module canonique** | **0** (inerte, voulu) |
| `src/lib/token-resolution/{resolveCanonicalToken,normalizeSolanaMint,scoreTokenCandidate}.ts` | résolveur V1 du bridge, **encore en production** | 1 — `src/lib/watcher-bridge/promoteWatcherSignalsToDraft.ts` |
| `src/lib/token-resolution/v2/` | — | **n'existe pas** : l'itération intermédiaire a été *renommée* en v3, jamais dupliquée |

Aucun barillet `index.ts` à la racine du module : `@/lib/token-resolution` n'est
pas importable — le chemin le plus court ne désigne donc pas le module périmé.

## Ce qui a été posé

Le V1 **ne peut pas être retiré** : il tourne pour le bridge. Il est donc marqué,
pas supprimé.

- les 3 fichiers V1 portent en tête `@legacy-v1-do-not-extend`, avec le renvoi
  explicite vers `v3/` et la raison de leur survie ;
- `v3/index.ts` porte `@canonical-resolver` ;
- `__tests__/module-naming.test.ts` — 8 tests qui ferment l'ambiguïté :

| Invariant |
|---|
| un seul dossier de module versionné, et c'est `v3` |
| aucun chemin `token-resolution/v0..v2` dans toute la source |
| `v3/index.ts` se déclare canonique |
| **tous** les fichiers `.ts` de la racine portent le marqueur legacy |
| pas de barillet racine ; aucun import de `@/lib/token-resolution` |
| le V1 n'a qu'**un** consommateur, et c'est le bridge |
| **aucun fichier n'importe à la fois le V1 et le V3** |

Le dernier est le vrai verrou : un fichier qui touche les deux est le point exact
où un harnais peut comparer, confondre, puis conclure sur la mauvaise
implémentation.

---

# Vérifications

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `vitest run` | **321 fichiers · 3 735 tests · 0 échec** (2 ignorés) |
| module V3 seul | **103 tests · 0 échec** |
| `eslint src/lib/token-resolution` | **0 erreur** (3 avertissements : paramètres d'interface non utilisés dans le client HTTP de fixtures) |
| `guard-offline.sh` | ✅ aucun chemin interdit modifié |
| Écritures DB | **aucune** — `SET default_transaction_read_only = on` sur chaque session |
| Migrations | **aucune** |
| `marketProviders.ts` / `getMarketSnapshot` / route B | **non touchés** |
| `src/lib/kol/proceeds.ts` (gelé) | **non modifié** — importé seulement |

---

# Pour T2

Le backtest doit viser **`src/lib/token-resolution/v3/`** (`@canonical-resolver`),
point d'entrée `resolveToken` depuis `src/lib/token-resolution/v3/index.ts`.

Trois rappels d'appel :

1. **`allowedChains` est obligatoire** — pas de valeur par défaut. Un périmètre
   vide (`[]`) accepte toutes les chaînes, mais il doit être déclaré.
2. **`observedAt`** conditionne D2. Sans lui, aucune contrainte temporelle n'est
   appliquée et les plafonds de confiance liés au temps ne jouent pas — un
   backtest historique qui l'omet ne teste pas ce qu'il croit tester.
3. **`caseIds`** n'est pas un champ de tickers. C'est l'objet de UR-12.

Les seuils de `policy.ts` restent **NON RATIFIÉS** — dossier de décision dans
`docs/prep/BUILD1_V3_1_4_2026-08-27.md`, section V3-5. Un backtest lancé
maintenant mesure les **valeurs proposées par défaut**, pas des valeurs validées.
