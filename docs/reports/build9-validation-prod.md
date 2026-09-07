# BUILD 9 — validation production

Validation **lecture seule** de ce qu'un serveur répond. `0 écriture · 0 DDL ·
0 appel Helius · 0 POST.` Lectures base en `BEGIN TRANSACTION READ ONLY` +
`ROLLBACK`, cible `ep-square-band` assertée avant connexion.

| | |
|---|---|
| `main` | `6b9df7f30508d9639c6aff0534340ac14af0f082` |
| guard | `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50` — 0 exemption |
| déploiement | **`interligens-bq91lp0pz`** · Ready · Production · émis depuis `6b9df7f` |
| horodatage | 2026-09-07, 20:20–20:40 UTC+2 |

---

## VERDICT

> ## Tous les points passent.
>
> Les sept signatures fabriquées ne sont plus servies. Une observation à
> arbitrer, sans incidence sur le containment : une occurrence de « /100 » dans
> la prose d'un claim VINE, qui désigne une métrique distincte du tigerScore.

| domaine | verdict |
|---|---|
| containment des 7 signatures | **PASS** |
| avis de retrait sur les 3 sections | **PASS** |
| absence de substitution | **PASS** |
| absence de CTA résolvable | **PASS** |
| autorité canonique | **PASS** |
| provenance des claims PUBLIC | **PASS** |
| champs internes non exposés | **PASS** |
| tigerScore NULL | **PASS** — 1 observation |
| classement des non-scorés | **PASS** |
| scoring inchangé | **PASS** |

---

## PRÉALABLES

### Contrôles avant vol

| # | contrôle | attendu | observé | |
|---|---|---|---|---|
| 3 | `git rev-parse HEAD` | `6b9df7f` | **`6b9df7f3050…f082`** | OK |
| 4 | `status --porcelain -uno` | vide | vide **après stash** de la fixture REFLEX | OK |
| 5 | `grep -c LEGACY_SCORING_INPUT` | ≥ 1 | **3** | OK |
| 6 | `projectName` | `interligens-app` | **`interligens-app`** | OK |

Le contrôle 4 avait d'abord échoué sur `__tests__/reflex/calibration/last-report.json`
(une ligne). Signalé avant toute action, stashé sur instruction, non écarté
unilatéralement.

### Contrôle bloquant de version servie

Le marqueur de BUILD 9 est `engine_version: "CaseFile-v2.0"` (v1.2 en BUILD 8).

| surface | observé | |
|---|---|---|
| `interligens-bq91lp0pz….vercel.app` | **`CaseFile-v2.0`** | OK |
| `app.interligens.com` | **`CaseFile-v2.0`** | OK |

Les deux servent le même artefact.

### Incident de déploiement, résolu

Le premier `npx vercel --prod` a rendu `{"status":"error","reason":"deploy_failed",
"message":"Not authorized"}` **sans créer de déploiement**. `vercel whoami`
(`davidpandoraparis-2892`) et `vercel ls interligens-app` fonctionnaient : la
session était authentifiée et lisait le projet. Le retry avec
`--scope davidpandoraparis-2892s-projects` a abouti. **À retenir pour le
protocole** : ajouter `--scope` explicite, l'inférence de scope est instable.

---

## 1 · CONTAINMENT DES 7 SIGNATURES — le point prioritaire

### Les valeurs, caractérisées indépendamment

| # | longueur | base58 | valeur (tronquée) |
|---|---|---|---|
| 1 | 57 | **non** | `3BotifyDeployTxA7xkMN2uDsKcQMM9UnZ…` |
| 2 | 55 | **non** | `5ClusterFundTx9bxpNKdavkdDVjQ5GwwB…` |
| 3 | 51 | **non** | `2RaydiumOpenTxcfcxBRdoNYrL6MQSuTFW…` |
| 4 | 47 | **non** | `7InsiderSellTxMUoP79hKx3Y47ihd5c8K…` |
| 5 | 49 | oui | `9PeakSnapshotTxuv6wkrhV46fbELzh7cu…` |
| 6 | 50 | **non** | `6LiquidityPullTxJsnEWp4S3f6mvQ1je3…` |
| 7 | 50 | **non** | `8CollapseTxKrtsCGvEWBk3yRXnCqM91HM…` |

**Longueurs 47–57 contre 87–88 attendues · 6 sur 7 hors alphabet base58.** Ma
mesure reproduit le briefing au caractère près. Ces valeurs ne sont pas « non
vérifiées » : elles sont **impossibles**.

Sept marqueurs de cluster ont été cherchés en plus
(`cluster-source-wallet-xxx…DEM0`, `recipient-wallet-01/02/03`, `FundTxAA01/02/03`),
soit **14 valeurs** au total, plus 10 fragments distinctifs pour attraper une
valeur tronquée ou réécrite.

### Recherche exhaustive

| surface | nature | valeurs | fragments | |
|---|---|---|---|---|
| `/api/casefile?mint=<44>` | JSON 7 140 o | **0** | **0** | OK |
| `/api/casefile?mint=<43>` | JSON 7 206 o | **0** | **0** | OK |
| `/api/casefile/public?mint=<44>` | PDF → 5 617 o de texte | **0** | **0** | OK |
| `/api/casefile/pdf?mint=<44>&lang=en` | PDF → 5 617 o | **0** | **0** | OK |
| `/api/casefile/pdf?mint=<44>&lang=fr` | PDF → 6 159 o | **0** | **0** | OK |
| `/api/casefile/pdf?mint=<43>` | PDF → 5 617 o | **0** | **0** | OK |
| source déployée `src/` entière | statique | **0** hors tests | **0** | OK |

**PDF contrôlés sur le texte extrait par `pdftotext`**, jamais sur le flux
binaire. L'extraction a réussi sur les quatre documents.

### UI — non mesurable au rendu, contrôlée statiquement

`/en/cases/lab` et `/fr/cases/lab` redirigent vers `/access` — gate beta NDA.
**Aucun code d'accès n'a été saisi.** Le contrôle au rendu reste à faire par un
porteur de code.

À défaut, contrôle statique sur la source du commit déployé :

| fichier | occurrences |
|---|---|
| `src/components/cases/TokenCasefileView.tsx` | **0** |
| `src/app/en/cases/lab/page.tsx` | **0** |
| `src/app/fr/cases/lab/page.tsx` | **0** |

Les 14 valeurs et 10 fragments sont **absents de tout `src/`** hors le fichier de
test qui les énumère comme interdites — ce qui est sa fonction.

### Aucun CTA ni lien résolvable

| contrôle | observé | |
|---|---|---|
| liens `/tx/`, `solscan.io/tx`, `explorer.solana.com/tx` | **0** sur les 4 PDF | OK |
| liens `/tx/` dans le JSON | **0** | OK |
| `[tx]` résiduel | **0** | OK |

Deux mentions de « Solscan » subsistent, en **attribution de source** :
« source: Solscan holder queries » et « Source: Solscan holder queries,
cross-checked with rugcheck.xyz ». Elles nomment d'où vient une observation de
concentration de holders — elles ne promettent aucun lien transactionnel.

### Aucune substitution

| contrôle | observé | |
|---|---|---|
| valeur de remplacement | **aucune** | OK |
| signature nouvellement inventée | **aucune** | OK |
| chaînes longues (40–95 car.) hors mint canonique | **1** — `BourCfkdGsr55XAVzDeU6tci7twRTiCGRvCLioENnBBX`, le pool Raydium primaire, donnée on-chain légitime | OK |

### Les trois sections retirées

Chacune rend un avis structuré **nommant le champ, jamais une valeur** :

| section | EN | FR |
|---|---|---|
| **On-chain Timeline** | `Withheld from publication` · `Reason : Insufficient provenance · Field : txSignature` | `Motif : Provenance insuffisante · Champ : txSignature` |
| **Wallet Cluster Summary** | idem | idem |
| **Related Projects (elevated risk)** | idem | idem |

Texte porté par les trois :

> *This section is withheld from publication. The material it relied on does not
> meet the provenance requirements, and no substitute has been introduced.
> Absence of provenance is not a finding of falsity.*

Le retrait est **signalé, jamais silencieux**, et le contenu exclu n'est pas
republié pour l'expliquer — conforme à la doctrine ratifiée.

---

## 2 · AUTORITÉ CANONIQUE

| contrôle | attendu | observé | |
|---|---|---|---|
| `offchain_source` — BOTIFY | canonique | **`canonical`** | OK |
| `offchain_source` — VINE | canonique | **`canonical`** | OK |
| `offchain_source` — mint inconnu (WSOL) | pas de repli | **`none`**, `GREEN/0`, 0 claim | OK |
| repli silencieux vers `CASE_DB` / preset / JSON legacy | aucun | **aucun** | OK |

Un mint sans dossier canonique **dit qu'il n'en a pas** au lieu de retomber sur
une autre autorité. C'était le défaut de fond de BUILD 8 : il est fermé.

### Provenance des claims

| contrôle | BOTIFY | VINE | |
|---|---|---|---|
| claims | 8 | 8 | — |
| `state` | **8/8 `ATTACHED`** | **8/8 `ATTACHED`** | OK |
| `unresolved_refs` non vides | **0** | **0** | OK |
| provenance résolue (ref + caption + captured_at) | 8/8 | 8/8 | OK |

Aucun claim PUBLIC ne sort sur une provenance composée uniquement de références
non résolues. `unresolvedRefs` est rendu comme non résolu quand il est peuplé
(`pdfGeneratorPublic.ts:524`, boucle dédiée) — non exercé ici, faute de cas avec
refs non résolues sur les deux dossiers publiés.

### Champs internes

| champ | BOTIFY | VINE | |
|---|---|---|---|
| `localFilePath` | **absent** | **absent** | OK |
| `sessionId` | **absent** | **absent** | OK |
| `notes` | **absent** | **absent** | OK |

### Un refus correct, à signaler

`/api/casefile/pdf?mint=<VINE>` **refuse** de produire le document :

> `[casefile] gabarit public refusé pour IL-SHILL-VINE-001 : ses sections
> statiques (chronologie, contrôle du token, métriques, cluster, projets liés)
> documentent IL-SHILL-BOTIFY-001`

Le gabarit public est encore spécifique à BOTIFY. Plutôt que de servir le
contenu d'un dossier sous le nom d'un autre, la route **s'arrête**. C'est le bon
comportement, et c'est exactement l'inverse du défaut d'origine de BUILD 8, où
une identité en ouvrait une autre.

---

## 3 · TIGERSCORE

| dossier | attendu | observé en base | `publishStatus` | |
|---|---|---|---|---|
| **BOTIFY** | NULL | **`null`** | draft | OK |
| **VINE** | NULL | **`null`** | draft | OK |
| BLACKBULL | inchangé | **`0`** | draft | OK |
| LAB | inchangé | **`91`** | published | OK |

Conforme à l'attendu documenté dans `docs/prep/patches/BUILD9/04_migration_38.sql`
(§4.7) : *« BOTIFY NULL · VINE NULL · BLACKBULL 0 · LAB 91 »*.

| contrôle de surface | BOTIFY | VINE | |
|---|---|---|---|
| `off_chain.tiger_score` | **`null`** | **`null`** | OK |
| fallback vers `0` | **aucun** | **aucun** | OK |
| occurrences de `/100` | **0** | **1** | voir ci-dessous |

### L'observation à arbitrer

Une occurrence de `/100` dans la réponse VINE, **dans la prose du claim C11** :

> *« The full INTERLIGENS coordination score is 100/100 based on: (a) synchronous
> wallet creation, (b) single c… »*

`C11` · `state=ATTACHED` · `status=ON_CHAIN_CONFIRMED` · topic *« Single-operator
6-wallet sybil network »*.

Ce n'est **pas** un rendu du tigerScore : le champ `tiger_score` vaut `null` et
n'est affiché nulle part. C'est une **métrique éditoriale distincte** — un score
de coordination — citée dans le texte d'un claim.

Sur la lecture littérale du critère (« aucune apparition de /100 »), c'est un
écart. Sur la lecture de son intention (un score absent ne doit pas prendre
l'apparence d'un score), il n'y en a pas. **Je le rapporte tel quel et je ne
tranche pas** : deux métriques différentes portant la même notation sur la même
surface est une question de doctrine, pas un défaut mesurable.

Cette occurrence n'apparaît pas sur PDF — le PDF VINE est refusé (voir §2).

### Classement

```ts
// src/app/en/cases/page.tsx:73  et  src/app/fr/cases/page.tsx:73
orderBy: { tigerScore: { sort: "desc", nulls: "last" } }
```

`nulls: "last"` explicite, sur les deux locales. Postgres place les `NULL` en
PREMIER en `DESC` : sans cette clause, un dossier non scoré aurait ouvert la
liste comme s'il était le plus sévère. **Les non-scorés se rangent après.**

---

## 4 · SCORING INCHANGÉ

| dossier | attendu | observé | |
|---|---|---|---|
| **BLACKBULL** | inchangé | **`0`** | OK |
| **LAB** | inchangé | **`91`** | OK |

Les patches SQL de BUILD 9 ont été examinés : **un seul** mentionne `tigerScore`
(`04_migration_38.sql`), et il ne fait qu'un `SELECT` de vérification —
`SELECT ref, "tigerScore", CASE WHEN … THEN 'score non etabli' …`. **Aucun
`UPDATE`, aucune conversion de `NULL` en `0`, aucun score fabriqué.**

---

## CE QUI RESTE NON MESURÉ, ET ANNONCÉ COMME TEL

1. **UI au rendu** — `/en/cases/lab` et `/fr/cases/lab` derrière le gate beta
   `/access`. Contrôlée statiquement (0 occurrence), pas au rendu. À confirmer
   par un porteur de code.
2. **`unresolvedRefs` peuplé** — le rendu « non résolu » existe dans le
   générateur mais n'a pas de cas à exercer sur les deux dossiers publiés.
3. **`/api/casefile/generate`** — exige un `POST`, hors périmètre d'une
   validation en lecture seule. Le garde de publication n'a pas été exercé,
   comme en BUILD 8.

---

## MÉTHODE

- Contrôles avant vol exécutés et **rapportés avant action** quand l'un a
  échoué ; aucun contrôle assoupli unilatéralement.
- Contrôle de version servie **avant toute mesure**, sur l'URL du déploiement
  puis sur le domaine.
- Base : `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`, host asserté, valeurs de
  connexion jamais imprimées.
- HTTP : `GET` uniquement — 8 surfaces, 4 PDF, 3 mints de contrôle.
- PDF : `pdftotext` sur le document, jamais `grep` sur le flux.
- Recherche par valeur **et** par fragment, pour attraper une valeur tronquée.
- Aucun code d'accès saisi, aucun formulaire soumis.
- `0 écriture · 0 DDL · 0 appel Helius · 0 POST.`
