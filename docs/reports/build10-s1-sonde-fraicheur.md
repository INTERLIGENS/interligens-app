# BUILD 10 / S1 — fermeture du faux positif de la sonde de fraîcheur

`BUG INSTRUMENTATION` fermé. `0 write prod · 0 DDL · 0 collecte déclenchée ·
0 Helius · 0 RPC.` Aucun cron relancé, aucun drainage, TSA non activée.
`main` figé à `4d5cdccc`, aucun merge.

---

## 1 · Inventaire des chemins gelés — **aucun**

Livré avant toute ouverture, comme demandé. Test des motifs de
`FORBIDDEN_PATTERNS` (`scripts/guard-offline.sh`) sur chaque fichier touché :

| fichier | verdict |
|---|---|
| `src/scripts/watchdog/watcher-health.mjs` | **LIBRE** |
| `src/lib/watchdog/sourceFreshness.ts` | **LIBRE** |
| `__tests__/watchdog/source-freshness.test.ts` | **LIBRE** |
| `__tests__/api/intelFreshness.test.ts` | **LIBRE** |
| `docs/reports/build10-s1-sonde-fraicheur.md` | **LIBRE** |

Le motif gelé le plus proche est `^src/lib/watcher/` — il exige un `/` après
`watcher` et ne couvre donc pas `src/lib/watchdog/`. Vérifié par exécution des
motifs, pas par lecture.

**Aucune fenêtre d\'exemption n\'est nécessaire. Je n\'ai donc rien ouvert.**

---

## 2 · Ce que la sonde mesurait, et pourquoi c\'était faux

La sonde `intel_stale` lisait :

```sql
SELECT "sourceSlug", max("ingestedAt") AS last,
       (now()::date - max("ingestedAt")::date)::int AS age_days
  FROM intel_source_observations GROUP BY "sourceSlug"
```

Mesuré le 2026-09-08 :

| source | `ingestedAt` (la sonde) | dernier batch réussi (la réalité) |
|---|---|---|
| **ofac** | 2026-08-25 → **14 j** → `crit` | **2026-09-08 01:00:51 → 0 j** |
| scamsniffer | 2026-09-08 → 0 j | 2026-09-08 01:31:13 → 0 j |
| forta | 2026-04-08 → 153 j → `warn` | **aucun run** |

`ingestedAt` date l\'**insertion** d\'une observation. Une liste de sanctions
stable n\'insère rien : ses lignes existent déjà. Et depuis la garde
`IS DISTINCT FROM` de `bulkUpsert`, les lignes inchangées ne sont plus
réécrites — `ingestedAt`, `lastVerifiedAt` et `lastSeenAt` datent donc **le
dernier changement, pas la dernière observation**.

`src/lib/intelligence/ingest.ts` le déclare en tête de fichier et demande
qu\'« aucune sonde ne s\'y adosse et ne produise un faux positif ». C\'était
exactement cette sonde.

**La garde `IS DISTINCT FROM` n\'est pas touchée.** Elle est correcte : elle
supprime ~340 000 `UPDATE` inutiles par cycle. C\'est la mesure qui change de
champ.

---

## 3 · Le champ retenu, et la démonstration qu\'il mesure le phénomène

`intel_ingestion_batches`, colonne `completedAt` filtrée sur `status = \'success\'`.

Trois propriétés le rendent valide là où les horodatages d\'observation ne le
sont pas :

1. **il est écrit à chaque run**, que la source ait changé ou non — la garde
   `IS DISTINCT FROM` porte sur l\'upsert des entités et des observations, pas
   sur ce journal ;
2. **il porte un `status`** — « a tourné » et « a réussi » se distinguent ;
3. **une source jamais exécutée n\'y a aucune ligne** — c\'est un état à part
   entière, pas un âge infini.

La démonstration est arithmétique : sur OFAC, le champ d\'observation rend 14 j
et le journal d\'exécution rend 0 j, le même jour, sur la même base. Un seul des
deux peut décrire « le collecteur a-t-il tourné ».

---

## 4 · Le contrat, et la règle de dégradation

| état | condition | `ageDays` |
|---|---|---|
| **`FRESH`** | dernier succès dans la fenêtre | l\'âge |
| **`STALE`** | dernier succès hors fenêtre | l\'âge |
| **`UNKNOWN`** | des runs existent, **aucun succès** | **`null`** |
| **`NOT_ARMED`** | source déclarée, **aucun run** | **`null`** |

**La dégradation voyage à côté du nombre, jamais dedans.** Aucun `-1`, aucun
`NaN`, aucune sentinelle : `ageDays` vaut `null` dès que l\'âge n\'est pas
mesurable, et c\'est `state` qui qualifie le champ. Un test le fige.

`NOT_ARMED` est distinct de `STALE` par construction : **un collecteur jamais
branché n\'a pas d\'âge.** Dire « périmée » d\'une source jamais exécutée serait
la même faute d\'instrumentation que celle qu\'on ferme, un cran plus bas.

---

## 5 · Preuve — test mutant

`__tests__/watchdog/source-freshness.test.ts` — **15 tests, tous verts**.

Le cas nommé « MUTANT » reproduit la forme exacte de la production : observations
figées depuis 14 jours, collecteur exécuté ce matin. Toute sonde adossée à un
horodatage d\'observation rend `STALE` et échoue ; seule une sonde adossée à
l\'exécution rend `FRESH`.

### Mutation réelle exécutée — trois mutants, trois tués

| mutant | tests en échec | verdict |
|---|---|---|
| `NOT_ARMED` traité comme `STALE` (âge 9999) | **3** | **TUÉ** |
| `UNKNOWN` porte `0` au lieu de `null` | **2** | **TUÉ** |
| mesure `lastStartedAt` au lieu de `lastSuccessAt` | **1** | **TUÉ** |
| *témoin, source intacte* | *0* | *15/15 verts* |

Source restaurée et vérifiée par empreinte après chaque mutation.

---

## 6 · Comportement de la sonde corrigée sur les données réelles

Requête exécutée en lecture seule, verdicts calculés par le module :

| source | ancienne sonde | **sonde corrigée** |
|---|---|---|
| **ofac** | **14 j → `crit` PÉRIMÉE** | **`FRESH` (0 j / seuil 7 j)** |
| scamsniffer | 0 j | `FRESH` (0 j / seuil 14 j) |
| forta | 153 j → `warn` périmée | **`NOT_ARMED`** |
| **amf** | **invisible** | **`NOT_ARMED`** |
| **fca** | **invisible** | **`NOT_ARMED`** |
| **goplus** | **invisible** | **`NOT_ARMED`** |

**Le faux positif OFAC est fermé.**

### Et la correction révèle un second défaut

L\'ancienne sonde faisait `GROUP BY "sourceSlug"` sur les observations : une
source qui n\'a **jamais produit d\'observation** ne renvoyait aucune ligne et
**n\'apparaissait donc nulle part**. `amf`, `fca` et `goplus` étaient invisibles.

**`amf` et `fca` sont des sources TIER 1 réglementaires** (`INTEL_TIER1_SLUGS`).
Deux listes de sanctions déclarées au registre, jamais exécutées, et le watchdog
ne le disait pas — parce qu\'une source absente ne peut pas être « vieille ».

C\'est le même motif que celui déjà mesuré deux fois dans BUILD 10 :
**une absence qui se lit comme une absence de risque.**

Le libellé suit désormais l\'état — cinq clés distinctes au lieu de deux :

| clé | sévérité | quand |
|---|---|---|
| `intel_stale_tier1` | `crit` | source réglementaire **périmée** |
| `intel_not_armed_tier1` | `crit` | source réglementaire **jamais exécutée** |
| `intel_unknown_tier1` | `crit` | source réglementaire **sans succès** |
| `intel_stale` | `warn` | autre source périmée |
| `intel_not_armed` | `warn` | autre source sans exécution mesurable |

---

## 7 · Périmètre — les autres sondes

Recherche de `lastSeenAt|ingestedAt|lastVerifiedAt|updatedAt` dans tous les
modules de sonde :

| module | occurrences |
|---|---|
| `llmVeilleProbe.ts` | **0** |
| `watcherHealthProbe.ts` | **0** |
| `probeArming.ts` | **0** |
| `jobRunLogAdapter.ts` | **0** |

Et une seule sonde datée existe dans `watcher-health.mjs` — celle-ci.
**Le lot se limite à une sonde.** Aucun élargissement.

---

## 8 · Non-régression

| contrôle | résultat |
|---|---|
| `node --check watcher-health.mjs` | **valide** |
| tests watchdog | **128/128** |
| **suite complète** | **4 949 verts · 0 échec · 2 skipped** (389 fichiers) |
| typecheck sur mes fichiers | **0 erreur** |

`__tests__/api/intelFreshness.test.ts` figeait la structure de l\'ancienne sonde
et a dû être actualisé : son intention est conservée et **cinq assertions ont été
ajoutées**, dont une qui interdit explicitement la réintroduction d\'un
horodatage d\'observation comme sonde.

> ~~**Défaut préexistant signalé, non corrigé** : `npx tsc --noEmit` échoue sur
> `src/app/fr/cases/page.tsx:73` — le `orderBy: { tigerScore: { sort, nulls } }`
> relevé en S7 n'est pas typé par le client Prisma généré. Vérifié présent sur
> `main` avec mes modifications remisées. Hors périmètre de ce correctif.~~
>
> ## ⚠ ERRATUM — 2026-09-08
>
> **Ce qui était affirmé ci-dessus est FAUX.** Le texte est barré et non
> supprimé : un retrait silencieux serait la faute que ce rapport ferme.
>
> **Affirmé** : `tsc` échoue sur `main`, sur `src/app/fr/cases/page.tsx:73`.
>
> **Mesuré** : `pnpm typecheck` rend **exit 0** sur `main` (`ba47972`) **et** sur
> cette branche (`177ba4b`). `git diff main..HEAD` sur les fichiers concernés est
> vide. **Il n'y a aucun défaut de typecheck sur `main`.**
>
> Deux erreurs de fait dans la mention initiale :
> 1. l'échec portait sur **DEUX** fichiers — `src/app/en/cases/page.tsx:73` **et**
>    `src/app/fr/cases/page.tsx:73`. Mon `tail -3` avait coupé le premier ;
> 2. il ne venait pas de `main`.
>
> **Cause** : le client Prisma de mon `node_modules` était **périmé**. Généré
> pendant la validation d'étape 9 de BUILD 8, `main` à `b4642fc`, il embarquait
> `tigerScore Int` (non-nullable). La colonne est devenue nullable **après**, par
> `859a453 fix(casefile): tigerScore nullable` en BUILD 9. Prisma n'émet
> `SortOrderInput` — le type qui porte `nulls` — que pour les colonnes nullables :
> d'où `nulls: "last"` non typé. Après `pnpm prisma:generate`, `exit 0`.
>
> La CI ne pouvait pas le voir : `security.yml` lance `pnpm prisma:generate`
> (étape `id: prisma`) **avant** `pnpm typecheck`, et gate le typecheck sur
> `steps.prisma.outcome == 'success'`.
>
> **Ce que la manipulation prouvait réellement** : rien sur `main`. `git stash` ne
> remise **ni `node_modules`, ni un client généré, ni un cache** — le client
> périmé a survécu au stash. J'ai mesuré mon poste et attribué le défaut à `main`.
>
> C'est la règle d'instrumentation de ce rapport, appliquée contre son auteur :
> **le compteur était exact, le champ mesuré n'était pas celui que j'annonçais.**
>
> **Protocole mis à jour** : `pnpm prisma:generate` rejoint les contrôles avant
> vol. Un client périmé produit des faux positifs locaux **et** peut masquer une
> vraie erreur. Et, plus généralement : avant d'attribuer un défaut à `main`,
> vérifier que ce qu'on mesure vient bien de `main`.

---

## 9 · Ce que je n\'ai pas fait

- **Aucune réécriture** des 874 lignes pour rafraîchir un horodatage legacy.
- **Garde `IS DISTINCT FROM` intacte.**
- **Aucun collecteur relancé**, aucun drainage, **TSA non activée**.
- **Aucun élargissement** en refonte du watchdog.
- **P2 nominatif non touché** — il est à T2.
