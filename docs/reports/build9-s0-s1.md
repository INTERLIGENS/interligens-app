# BUILD 9 — CASEFILE SYSTEM · S0 mesure → S1 contrat

Branche `feat/cc-offline-159-build9-casefile`, depuis `main = 2f3761b`.
Lecture seule : 4 passes SELECT en `READ ONLY` + `ROLLBACK`, 0 Helius, 0 write,
0 DDL, 0 code.

Prolonge `casefile-s0-reconnaissance.md` — ne le refait pas.

---

## STATUS

**S0 clos, S1 proposé.** Aucun STOP.

L'autorité canonique est ratifiée, et la mesure confirme qu'elle est le bon
choix — mais elle révèle que `token_casefiles` **ne peut pas encore alimenter le
renderer** : six des champs qu'il consomme n'y existent pas. Le build n'est pas
une migration de données, c'est d'abord un travail de contrat.

---

## DONE — ce que S0 ajoute à la reconnaissance

### 1. L'écart renderer ↔ autorité

`CaseFileInput` consomme onze blocs. `token_casefiles` en porte **deux** :

| exigé par le renderer | présent dans `token_casefiles` |
|---|---|
| `keyWallets` | ✅ |
| `sources` | ✅ |
| `timeline` · `shillers` · `claims` · `new_claims` · `smoking_guns` · `requisitions` | ❌ |
| `version` · `supersedes` · `contentHash` | ❌ |

**Les six blocs narratifs qui font le dossier n'existent que dans les presets.**
Élire l'autorité ne suffit pas : sans eux, un PDF rendu depuis la base serait
vide de tout ce qui constitue un CaseFile.

À l'inverse, ce que la table porte est de bonne qualité. `keyWallets` de
BLACKBULL déclare son attribution en toutes lettres —
*« Propriétaire non attribué — aucune identité établie »* — avec `balance`,
`first_in`, `outflows`, `pct_supply`. C'est déjà la doctrine appliquée.

Remplissage des 2 lignes : 24 colonnes sur 26 renseignées ; `bodyMarkdown`,
`diagram` et `insiderExitNotionalValueUsd` sur 1 seule ;
`estimatedRetailHarmUsd` sur **aucune**.

### 2. Le pont vers la preuve existe — et il est vide là où il faut

`EvidenceSnapshot` porte **déjà** une colonne `canonicalMint`. Mais :

| relationType | lignes | avec `canonicalMint` | dont publics |
|---|---|---|---|
| `kol_token` | 1 105 | 192 (17,4 %) | 0 |
| `token_onchain` | 12 | 12 (100 %) | 0 |
| **`case`** | **20** | **0 (0 %)** | **20** |
| `kol_activity` | 32 | 0 | 0 |
| `kol` | 2 | 0 | 0 |

**Les 20 seules preuves publiques du produit sont exactement celles qui n'ont
aucun mint canonique.** Elles vivent sur cinq clefs de ticker legacy —
`BOTIFY-MAIN`, `BOTIFY`, `GHOST`, `GHOST-RUG`, `SERIAL-12RUGS`.

Et sur les 1 171 lignes de la table, **zéro** `relationKey` ressemble à un `ref`
de dossier (`IL-%`). La preuve n'est jamais rattachée à un dossier ; elle est
rattachée à un symbole.

### 3. BOTIFY et VINE — ce qui est réellement migrable

**BOTIFY** — l'identité canonique porte des faits :

| | |
|---|---|
| `KolProceedsEvent` | **262**, dont **188 classés** (`amountUsdNature`) |
| `KolTokenLink` | 5, dont 5 `visibility='public'` |
| `KolTokenInvolvement` | 3 |
| `EvidenceSnapshot` | 13, publics, **sans `canonicalMint`** |
| `KolWallet` publiables porteurs d'événements | **3** |

Les 74 événements non classés sont exactement les lignes sans `amountUsd` —
cohérent avec la partition de BUILD 8, aucun écart.

**VINE** — l'identité canonique ne porte **rien** on-chain :

| | |
|---|---|
| `KolProceedsEvent` · `KolTokenLink` · `KolTokenInvolvement` · `ShillEvent` | **0** |
| `EvidenceSnapshot` | **50**, en `kol_token`, clefs `0xSweep:VINE` (40), `solana_daily:VINE` (7), `fuelkek:VINE` (2), `CookerFlips:VINE` (1) |

VINE a donc **50 captures** — la reconnaissance de ce matin les avait manquées
en ne regardant que `relationType='case'`. Ce sont des preuves horodatées avec
`sha256`, mais **aucune n'est publique**, et aucune ne porte de `canonicalMint`.

> `0xSweep` est l'un des deux profils en collision de casse identifiés en E1.
> Sa clef d'evidence hérite donc de la même ambiguïté. Signalé, pas traité.

### 4. Les gates de publication existants

| surface | gate |
|---|---|
| `token_casefiles` / `platform_casefiles` | `publishStatus` |
| `EvidenceSnapshot` | `isPublic` + `reviewStatus` — **20 publics sur 1 171** |
| `KolTokenLink` | `visibility` (verrouillé par test) |
| wallets nominatifs | `isPubliclyUsable` (BUILD 8 / P1) |
| montants KOL | `proceedsPublication` · `monetaryClaimsPublication` |
| presets / JSON / `CASE_DB` | **aucun** |

Cinq régimes distincts, plus une zone sans régime. Aucun ne parle aux autres.

### 5. La provenance des 12 M$ existe — la nature, non

`platform_casefiles` porte `confirmedLossUsd = 12 000 000` avec
`sourceInvestigator = @SpecterAnalyst` et un `sourceThreadUrl` résolvable.

**La provenance est là ; c'est la nature qui manque** — la table n'a aucune
colonne `*Nature`. Ce n'est donc pas une donnée orpheline à instruire, c'est un
relais tiers à déclarer.

### 6. Versioning : rien

Ni `version`, ni `supersedes`, ni `contentHash` sur aucune des deux tables. Un
dossier corrigé écrase le précédent, et rien ne dit ce qui était publié à une
date donnée.

---

## PROOF

| | |
|---|---|
| mesures | 4 passes SELECT, `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`, cible asserted |
| prod-write / réseau | **0 écriture, 0 DDL, 0 Helius, 0 collecte** |
| code | **aucun** |
| `main` | libéré — worktree sur `feat/cc-offline-159-build9-casefile` |

---

## DISCOVERED

**D1 — Le renderer ne peut pas encore être branché sur l'autorité.** Six blocs
narratifs manquent. C'est le vrai chemin critique du build, avant toute
migration.

**D2 — Les 20 preuves publiques sont les 20 qui n'ont pas de mint.** Le pont
`canonicalMint` existe et fonctionne (100 % sur `token_onchain`) mais n'a jamais
été appliqué là où la publication a lieu.

**D3 — VINE a 50 captures, aucune publique.** Le dossier n'est pas vide : il est
non publié. La distinction compte, et elle appartient à BUILD 10.

**D4 — La provenance des 12 M$ existe déjà.** Contrairement à ce que la
reconnaissance laissait supposer, il n'y a rien à instruire : il y a à déclarer.

---

## S1 — CONTRAT PROPOSÉ

### Sept garanties

| | garantie | dérivée de |
|---|---|---|
| **G1** | Une seule autorité rend un CaseFile. Presets, JSON et `CASE_DB` cessent d'être consultés comme sources. | objectif central |
| **G2** | Un sujet canonique résout vers **un** `ref` + **une** version. L'alias résout, il ne définit pas. | contrat d'alias BUILD 8 / E2 |
| **G3** | Une preuve est rattachée par `ref` stable. Une clef de ticker n'est plus une adresse de dossier. | D2 |
| **G4** | Un même sujet rend la même vérité sur API, UI et PDF. | gate de clôture |
| **G5** | Toute assertion publiée porte sa nature et sa provenance, ou n'est pas publiée. | Data Nature I3/I5 |
| **G6** | Une version publiée est **immuable**. Une correction crée une version, elle n'écrase pas. | D6 / Investigator |
| **G7** | Une exclusion est **signalée sans être republiée**. | doctrine ratifiée |

### G7 — le contrat d'exclusion, précisément

C'est la garantie la plus facile à mal implémenter : expliquer un retrait en
citant ce qu'on retire annule le retrait.

Forme proposée — une **raison structurée**, jamais la valeur :

```
{ excluded: true,
  reason: "INSUFFICIENT_PROVENANCE" | "EXCLUDED_FROM_PUBLICATION",
  field: "confirmedLossUsd" }        ← le CHAMP, jamais son contenu
```

Rendu public : une mention sobre disant qu'une donnée a été exclue faute de
satisfaire les critères de publication INTERLIGENS. **Ni le montant, ni
l'assertion, ni une approximation, ni un zéro** — la doctrine `proceedsGate`
s'applique : `null` est une absence, `0` est une affirmation.

Le containment de BOTIFY a posé la moitié du geste (retirer) ; G7 pose l'autre
(le dire). `WITHDRAWN_NOTICE` existe déjà et sera remplacé par la raison
structurée.

### Phases gatées

| phase | contenu | DDL |
|---|---|---|
| **P0** | resolver de sujet canonique → `ref` ; détection de références cassées | non |
| **P1** | contrat de dossier : les 6 blocs narratifs + `version`/`supersedes`/`contentHash` — **rédigé**, DDL rédigée non exécutée | oui (rédigée) |
| **P2** | nature + provenance de `platform_casefiles.confirmedLossUsd` — déclaration, la provenance existe déjà | oui (rédigée) |
| **P3** | rattachement de la preuve par `ref` ; backfill `canonicalMint` sur les 20 publiques | oui (rédigée) |
| **P4** | régime de publication unique + G7 sur API, UI et PDF | non |
| **P5** | renderers branchés sur l'autorité ; presets rétrogradés en fixtures | non |
| **P6** | acceptation BOTIFY et VINE de bout en bout | non |

P0, P4, P5 et P6 sont réalisables **sans une seule écriture**. P1 à P3 exigent
une DDL — rédigée ici, exécutée par T1, comme BUILD 8.

### BOTIFY et VINE — ce qui migre, ce qui reste manquant

**Migre** (déjà démontré et admissible) : l'identité canonique ; pour BOTIFY les
262 événements dont 188 classés, les 5 liens publics, les 3 wallets publiables,
les 13 captures publiques ; pour VINE les 50 captures horodatées et hachées.

**Ne migre pas, et reste explicitement manquant** : les 4 montants nominatifs
BOTIFY (contenus, `EXCLUDED_FROM_PUBLICATION`) ; les agrégats non reproductibles ;
le on-chain VINE, inexistant — `NOT_MEASURABLE`, pas `DATA_ABSENT`, la
distinction revenant à BUILD 10 ; les blocs narratifs des presets non adossés à
une source, qui restent `UNCLASSIFIED` jusqu'à instruction.

**Aucune collecte, aucun Helius, aucune investigation.** Un champ vide reste
vide et le déclare.

### Le point qui décidera du build

**D1, pas la migration.** Tant que `token_casefiles` ne porte pas les six blocs
narratifs, brancher le renderer dessus produirait un dossier vide — et la
tentation serait alors de garder les presets « juste pour le narratif », ce qui
recréerait la seconde autorité que le build existe pour supprimer.

Le contrat de dossier (P1) précède donc tout le reste.

---

## NEXT

P0 — resolver de sujet canonique et détection de références cassées, sans
écriture.

## STOP

Aucun. La frontière est ratifiée, les phases DDL sont rédigées et non exécutées,
et rien dans P0 n'exige d'arbitrage.
