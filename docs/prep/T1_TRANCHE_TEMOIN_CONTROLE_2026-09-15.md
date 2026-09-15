# CC-OFFLINE-214 — Retrait du gate d'amorçage, puis tranche verticale

**Date** : 2026-09-15 · **Branche** : `feat/cc-offline-214-temoin-controle-rc`
**Base** : `main` = `ba136c0` · **Aucun déploiement.**

---

## Doctrine ratifiée, inscrite là où elle gouverne

> An irreversible downstream operation must be gated by authorities causally
> required for that operation. Requiring unrelated configuration is not
> fail-closed governance; it is false coupling.

Elle est écrite en tête de `src/scripts/evidence-chain/stamp-pending.ts` et
dans `__tests__/evidence-chain/gate-amorcage-retire.test.ts`.

---

# TEMPS 1 — Le gate d'amorçage `stamp-pending` est retiré

## Ce qui a été retiré, et pourquoi il n'autorisait rien

`stamp-pending.ts:81` appelait `ouvrirCompartimentGouverne()` — la porte de
**naissance** — et refusait tout le run quand elle était fermée. Quatre constats,
mesurés lors de `T1-TÉMOIN-TSA-LEGACY` et rendus permanents ici :

| # | Constat |
|---|---------|
| 1 | La valeur rendue n'était utilisée nulle part. Le lecteur employé est `lieu.readObject`, lié au compartiment que le **registre** désigne. |
| 2 | Les variables exigées (`R2_EVIDENCE_*`) ne sont pas celles que le chemin legacy consomme (la fente `reports`, seule). |
| 3 | Aucune écriture R2 n'a lieu dans ce job. L'irréversible est un jeton chez un tiers et quatre colonnes. |
| 4 | Le contrôle est déjà rendu **par pièce** par `ouvrirCompartimentDesigne`, en `CAPABILITY_UNAVAILABLE`. |

`stamp-pending` dépend désormais de **la pièce** :

```
EvidenceItem → autorité de localisation → capacité READ du compartiment
             → octets persistés → digest recalculé → concordance → TSA
```

## Ce qui n'a PAS été retiré

**Aucun refus.** Ce qui disparaît est une exigence de configuration étrangère.
Le refus qui protège l'opération irréversible vit dans `stampOne`, par pièce :
`storage_location_unresolved`, octets absents, digest discordant.

Et la porte de naissance **reste exigée** sur les cinq chemins où une pièce naît
(`ingest.ts`, `ingest-capture.ts`, `run-auto-evidence.ts`, `evidenceCommitBridge.ts`,
`evidenceChainBridge.ts`) — témoin (f).

## Le témoin permanent

`__tests__/evidence-chain/gate-amorcage-retire.test.ts` — 7 cas.

L'environnement du témoin n'a **aucune** variable `R2_EVIDENCE*`, et le témoin (0)
le **vérifie** plutôt que de s'y fier. La chaîne de décision traverse le
constructeur canonique `assemblerResolutionDeStockage` ; seule la lecture d'octets
est remplacée, et seulement **après** que l'autorité a décidé.

| Témoin | Ce qu'il établit |
|--------|------------------|
| (0) | L'absence des variables Evidence est TOTALE, et assertée |
| (a) | La localisation résout vers `interligens-reports` sans une seule fente Evidence |
| (b) | Le gate traverse jusqu'à la TSA et soumet le digest RECALCULÉ |
| (c) | **NÉGATIF** — retirer `R2_ACCESS_KEY_ID` (la fente réellement consommée) → refus, **et aucun appel TSA** |
| (d) | **NÉGATIF** — une pièce que le registre situe dans `interligens-evidence` exige toujours sa fente |
| (e) | Structurel — le job ne porte plus aucune porte de naissance |
| (f) | Structurel — la porte de naissance reste exigée là où une pièce naît |

## Mutant rejoué

Réintroduire le gate fait rougir **trois** témoins :
`gate-amorcage-retire (e)`, `tsa-predicat-et-readback › le job CÂBLE les capacités`,
et `compartiment-autorite › le recensement des sites gouvernés est EXACT`.

## Deux assertions INVERSÉES

`tsa-predicat-et-readback` **exigeait** `ouvrirCompartimentGouverne` dans le job :
elle verrouillait le faux couplage au lieu de le mesurer. Et `stamp-pending.ts`
sort de `SITES_GOUVERNES` au même titre que `readback-verify.ts` avant lui.

Les témoins structurels lisent désormais **le code, pas la prose** : l'en-tête
nomme le gate retiré, et une garde qui punit la documentation d'un correctif
laisserait passer le correctif lui-même.

---

# TEMPS 2 — La tranche verticale

## ⚠️ La mesure d'arrêt, faite AVANT toute création — PAS DE BLOCKER

La condition de STOP était : « si aucune exclusion structurelle n'est
représentable avec le modèle actuel, s'arrêter avant création ». **Elle est
représentable.**

`token_casefiles.publishStatus` est lu par **`publicationAuthority.decidePublication`** :
une autorité **fermée**, **fail-closed** et **typée** — le dossier n'est
atteignable qu'à travers la branche `PUBLISHABLE`, un appelant qui ignore la
décision ne compile pas. Elle refuse nommément `ABSENT_ROW`, `ABSENT_STATUS`,
`NOT_A_STRING`, `EMPTY`, `LOOKALIKE`, `NOT_PUBLISHED`.

Toutes les surfaces business/publiques mesurées la consomment :

| Surface | Consommation |
|---------|--------------|
| `/en/cases`, `/fr/cases` | `keepPublishable` + `PUBLISHED_ONLY_WHERE` |
| `/api/casefile/public` (PDF retail) | `resolvePublicCasefile` → `loadPublicProjectionIfPublished` → `decidePublication` |
| `/en/cases/botify/evidence` | `loadPublicProjectionIfPublished` |
| `src/lib/prebuy/casefile.ts` (PRE-BUY GUARD) | `keepPublishable` |
| `src/lib/token-resolution/v3/sources/db.ts` | `keepPublishable` |
| `/en/cases/lab`, `/fr/cases/cbex` | refs **codés en dur** — un témoin n'a pas de page |

Ce n'est pas « personne ne clique sur GRANT » : `GRANT` est la publication d'un
**claim** ; `publishStatus` est l'autorité du **dossier**, et les deux sont
indépendantes.

**Deux absences indépendantes s'y ajoutent** (aucune n'est la règle) :
le témoin n'est dans aucune entrée de la carte fermée `CANONICAL_REF_BY_MINT` ;
et `contractAddresses = {}`, donc les deux lecteurs indexés par adresse ne
peuvent pas le joindre.

**Aucune DDL n'a été exécutée. Aucun marqueur de test n'a été inventé.**

## ⛔ Le point le plus important : le témoin ne CHOISIT pas d'être exclu

Le script **ne pose aucun `publishStatus`**. Il ne contient **aucun littéral de
statut**. Le dossier hérite du **DEFAULT de la colonne**, et la tranche demande
ensuite à l'autorité si cette ligne est publiable. Poser « draft » aurait fait de
l'exclusion une décision de ce script — et une troisième écriture de la règle de
publication, que `s1-autorite-unique` interdit à juste titre.

## Le dossier témoin

```
ref          IL-RC-CONTROLLED-WITNESS-001     (draft, par défaut)
codename     RC-CONTROLLED-WITNESS
ticker       RCWITNESS
« mint »     RC-CONTROLLED-WITNESS-NOT-A-MINT (sentinel — pas une adresse base58)
```

Synthétique, non nominatif, aucune assertion sur une personne, un projet ou un
jeton réel. **Ni VINE, ni BOTIFY ne sont nommés nulle part dans le code du script.**

## ⚠️ Un maillon manquait, et il n'était pas dans le brief

`evidence_storage_location_journal` — l'autorité qui répond « où vivent les
octets de cette pièce », consommée par le chemin d'horodatage — **n'avait aucun
écrivain dans `src/`**. Ses 31 lignes ont été posées par du SQL que
`discrimination.ts` *génère* et qu'un humain colle dans l'éditeur Neon.

Conséquence exacte, mesurée : **une pièce nouvellement née, correctement
archivée, était structurellement inhorodatable** — sa localisation ne pouvait
être établie par aucun chemin de production.

`src/lib/evidence-chain/storageLocationWriter.ts` ferme ce défaut. **Aucune DDL** :
le mode `DECLARED_AT_WRITE` est déjà dans le CHECK de la table.

⛔ Il **ne peut pas** écrire `VERIFIED_BY_HEAD`. Pas « ne le fait pas » : le mode
est un littéral dans le gabarit SQL, les colonnes d'observation sont `NULL` en
dur, et l'intention ne porte aucun champ de mode. **Déclarer où l'on a écrit
n'est pas avoir mesuré où c'est** — la seconde exige des `HeadObject` que ce
module n'émet pas.

## La chaîne DONE — maillon par maillon, et par quelle mesure

Run final : `EvidenceItem cmu2lqtm20000s5czowqd0e79` · claim `CLM-RCWIT-11HVGD29`.

| # | Maillon | Établi par | Preuve |
|---|---------|-----------|--------|
| 1 | charge synthétique | PNG 1×1 valide + nonce | 176 o · `36631b35…61f1f5` |
| 2 | identité gouvernée | `assignRef` (siège, n'alloue pas) | `IL-RC-CONTROLLED-WITNESS-001` · `decidePublication` → REFUSED |
| 3 | naissance Evidence canonique | `ingestBuffer` + `ouvrirCompartimentGouverne` | `interligens-evidence` (READ+WRITE) |
| 4 | **PUT conditionnel** | `faireNaitreLesOctets` (IfNoneMatch:*) | clé LIBRE → accepté ; **négatif ci-dessous** |
| 5 | localisation déclarée | `declarerLocalisationALEcriture` | registre **#35** · `DECLARED_AT_WRITE` · aucune observation |
| 6 | relecture des octets **persistés** | `stampOne` étape 0-1, compartiment DÉSIGNÉ | autorité `registre-de-localisation` |
| 7 | SHA-256 recalculé | `readbackDigest` | 176 o relus |
| 8 | concordance | `stampOne` étape 3 | `36631b35…61f1f5` = attendu |
| 9 | TSA sur le hash **recalculé** | `timestampWithRouting` | freetsa.org · genTime `2026-09-15T11:42:17Z` |
| 10 | jeton persisté | `store.setTsa` + relecture | 4 643 o · chaîne 7 939 o |
| 11 | **vérif RFC 3161 offline** | `openssl ts -verify`, jeton + chaîne archivée | **`Verification: OK`** (revérifié hors script) |
| 12 | journal de provenance VERIFIED | `recordQualification` | journal **#6** · VERIFIED / DOCUMENT / `ARCHIVE_SNAPSHOT_MATCHES` |
| 13 | `CaseFileSource` | `executeFoundation` | `SRC-RCWIT-11HVGD29` |
| 14 | claim **explicitement classifié** | `executeFoundation` | `rowNature = PRIMARY_OBSERVATION`, jamais `UNCLASSIFIED` |
| 15 | fondement **MET** | `decideFoundationContract` sur le dossier **relu** | MET · nature `PRIMARY_OBSERVATION` |
| 16 | gate de publication **MET** | `decidePublicationContract` sur le dossier **relu** | MET (provenance VERIFIED) |

Les contrats 15-16 sont mesurés sur le dossier **relu par `loadCanonicalCaseFile`** —
le même lecteur que les surfaces — et non sur ce qu'on croyait avoir écrit.

### ⚠️ Le point délicat, déclaré : pourquoi `ARCHIVE_SNAPSHOT_MATCHES`

La pièce est **synthétique** : il n'existe ni post capturé, ni enregistrement de
plateforme. Inscrire `URL_MATCHES_CAPTURED_POST` ou `PLATFORM_API_RECORD_MATCHES`
aurait été un **mensonge dans un journal append-only**.

Ce qui a réellement été vérifié : le localisateur désigne l'objet archivé
(`r2://interligens-evidence/…`, `referenceKind = DOCUMENT`), et cet objet a été
**relu** et son empreinte **recalculée** avec concordance. C'est, mot pour mot,
`ARCHIVE_SNAPSHOT_MATCHES`. **La vérification inscrite est celle qui a eu lieu**,
pas une case cochée pour atteindre VERIFIED.

## ⛔ « MET » n'est pas « FRANCHI »

| Mesure | Valeur |
|--------|--------|
| `decidePublication(dossier relu)` | **REFUSED [NOT_PUBLISHED]** |
| claims `PUBLIC` sur le témoin | **0** |
| lignes ajoutées à `casefile_claim_publication_decisions` | **0** (total inchangé : 6) |
| `EvidenceSnapshot.isPublic` | **false** (0 snapshot public en base) |
| état du claim | **ATTACHED** |

Le script **ne peut pas** publier : il n'importe ni `executeRelease`, ni
`executeRevoke`, ni `decidePublicRelease`, ni `attestPersistedDecision`, et
n'atteint pas la table des décisions. Témoins dans
`__tests__/casefile/tranche-temoin-controle.test.ts`.

---

# Les négatifs — qui couvre quoi

Le brief demandait de **nommer** les témoins couvrant chaque frontière plutôt que
d'en ajouter par habitude. Trois des quatre étaient déjà couvertes.

| Frontière | Témoin | Comportement |
|-----------|--------|--------------|
| **Digest retiré / corrompu** | `spine-00-revoke-eligibility.test.ts:134-135` | `SOURCE_DIGEST_MISSING` → refuse **fondement ET publication** |
| **Provenance absente** | `spine-00-revoke-eligibility.test.ts:171` | UNKNOWN → `SOURCE_PROVENANCE_UNQUALIFIED` → refuse **fondement** |
| **Provenance non VERIFIED** | `rc-spine-00-ecrivain-gouverne.test.ts:384` | OPERATOR_DECLARED → `SOURCE_PROVENANCE_NOT_VERIFIED` → refuse **publication seule** (le fondement tolère) |
| **Classification retirée** | `rc-spine-00-ecrivain-gouverne.test.ts:259-263, 379` | `CLAIM_UNCLASSIFIED` → refuse **les deux** |
| **Collision de clé R2** | mesuré en vif (ci-dessous) | `OBJECT_ALREADY_EXISTS` → refuse, **n'adopte pas, n'écrase pas** |
| **Jeton TSA sur un autre digest** | mesuré en vif (ci-dessous) | `message imprint mismatch` |

**Aucun mutant n'a été ajouté pour les quatre premières** : elles sont déjà
couvertes causalement.

### Les deux mesurés en vif dans cette fenêtre

**Collision de clé** — mêmes octets ? non : **octets différents, même clé**.

```
AVANT  : 176 o · sha256 0337b854…104f9d28 (concorde)
PUT    : REFUSÉ [OBJECT_ALREADY_EXISTS]
APRÈS  : 176 o · sha256 0337b854…104f9d28
VERDICT: les octets d'origine sont INTACTS — ni écrasés, ni adoptés
```

**Jeton sur un faux digest** :
```
openssl ts -verify -digest 000…001 → error:17800067: message imprint mismatch
```

---

# Le corollaire : six gardes existantes ont attrapé le nouveau code

Aucune n'a été affaiblie. Chacune disait quelque chose de vrai.

| Garde | Ce qu'elle a dit | Réponse |
|-------|------------------|---------|
| `s1-autorite-unique` × 2 | le script réécrivait la règle de publication (`publishStatus: "draft"`, comparaison directe) | **littéraux supprimés** — le défaut de la colonne, puis `decidePublication` |
| `spine-00-b-sceau-canonique` | jour de date coupé à la main | `claimDate: null` — l'instant est déjà porté deux fois |
| `t1-lecteur-journal` × 2 | qui a le droit de poser `provenanceKind` / d'inscrire une qualification | **déclaré nominativement**, avec la raison |
| `s19` — écrivains de `token_casefiles` | un troisième écrivain est apparu | **déclaré**, avec la raison |
| `compartiment-autorite` | deux fichiers non recensés | la tranche → **site gouverné** ; l'écrivain de localisation → nouvelle catégorie **site de vocabulaire**, dont la contrainte est **plus stricte** : il n'a le droit d'ouvrir **aucune** porte |

## ⚠️ Un défaut de recensement, trouvé par accident

`s19` découvrait les refs par `/IL-[A-Z]+-[A-Z0-9]+-\d{3}/` — **exactement trois
segments**. Cette forme avait été écrite sur les cinq refs existants, alors que
`ref.ts` dit l'inverse : « les segments ne signifient rien », et « le dépôt porte
trois conventions incompatibles ».

`IL-RC-CONTROLLED-WITNESS-001` (quatre segments) serait passé **invisible** — le
pire défaut d'un recensement : il aurait dit qu'il avait regardé. La découverte
est corrigée, et le témoin est le **sixième** ref déclaré.

---

# Delta de production — mesuré avant / après

| | avant | après |
|---|---|---|
| dossiers | 4 (LAB published) | **5** — le témoin, `draft` |
| claims BOTIFY | 8 · 0 public · **8 non classifiées** | **identique** |
| claims VINE | 14 · 0 public · **8 non classifiées** | **identique** |
| claims témoin | — | 2 · 0 public · **0 non classifiée** |
| sources BOTIFY / VINE | 8 / 2 | **identiques** |
| journal de provenance | 2 (#3, #4) | **4** — #5 et #6, VERIFIED |
| registre de localisation | 31 `VERIFIED_BY_HEAD` (reports) | **33** — +2 `DECLARED_AT_WRITE` (evidence) |
| décisions de publication | 6 | **6** |
| snapshots `isPublic` | 0 | **0** |
| `EvidenceItem` / horodatés | 1 104 / 1 071 | 1 106 / 1 073 |
| **TSA pending** | **33** | **33** — aucune des 30 legacy touchée |
| lignes pour l'objet préexistant `evidence/5b/5b2dcac7…` | 0 | **0** |

Les 16 claims historiques non classifiées sont **intactes**.
`evidence/5b/5b2dcac7…png` reste `PREEXISTING_UNGOVERNED` et intact — **aucune
ligne de journal, aucun backfill**.

---

# Interdits — état

| Interdit | État |
|----------|------|
| Déploiement production | **aucun** |
| `GRANT PUBLIC` / `isPublic` | **aucun** · isPublic = 0 partout |
| Enrichissement VINE / BOTIFY / watchdog / 30 TSA / 1 071 | **aucun** |
| Modification des 16 claims non classifiées | **aucune** |
| Ligne de journal pour l'objet préexistant / backfill | **aucune** |
| `backfill-evidence` / `migrate-snapshots` / `recover-snapshots-d` | **non exécutés**, non atteints (témoin) |
| DDL | **aucune** |
| `.env.local` | **non modifié** — `TSA_URL_FALLBACK` / `TSA_CA_URL_FALLBACK` fournies au seul processus de cette fenêtre |
| Secrets révélés | **aucun** |
| `src/scripts/watchdog/` · `src/lib/watchdog/` | **non touchés** |
| Vocabulaire interdit | non employé — « timestamp RFC 3161 avec vérification offline et chaîne archivée » |

---

# Suite verte

`517 fichiers · 7 670 tests` — dont 300 sur `__tests__/evidence-chain/`.

---

# Ce que cette tranche n'établit PAS

- Elle ne dit rien de la capacité du pipeline **retail** (`/api/osint/submit`)
  ni du **watcher bridge** : ils n'ont pas été exercés.
- Le témoin est **synthétique**. Il démontre l'infrastructure, pas une méthode
  d'investigation.
- Les **30 pièces TSA legacy** restent en attente. Elles n'ont pas été touchées.
- `interligens-evidence` n'est pas WORM. La rétention reste `degraded:no-object-lock`.
