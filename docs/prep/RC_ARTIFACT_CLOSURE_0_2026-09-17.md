# RC-ARTIFACT-CLOSURE-0 — F1 (STOP) PUIS F2 (LIVRÉ)

**2026-09-17 · CC-OFFLINE-264 / 266**

> **CORRIGER LE PRODUCTEUR NE RETIRE PAS CE QU'IL A DÉJÀ PRODUIT.**
> **LA SUPERSESSION RETIRE L'AUTORITÉ DE DÉLIVRANCE COURANTE ; ELLE N'EFFACE PAS L'HISTOIRE.**

---

## §1 · F1 — ⛔ STOP GPT · AUCUNE PRIMITIVE N'ÉCRIT UN ÉTAT D'INVALIDATION

La mesure read-only était la condition d'exécution. Elle **refuse** l'exécution.

### Les cinq points exigés

**1 · LA PRIMITIVE EXACTE — elle n'existe pas.**
`src/lib/storage/registre/registre.ts` exporte quatre opérations, et quatre seulement :
`allouer` · `confirmerEnregistrement` · `lireParCle` · `listerLignes`. **Aucune n'écrit
`invalidation_state`.**

Recensement exhaustif des `UPDATE governed_objects` du dépôt — **deux**, et ni l'un ni l'autre
n'écrit cette colonne :

| site | ce qu'il écrit | ce qu'il exige |
|---|---|---|
| `registre.ts:218` (`confirmerEnregistrement`) | `authority_state` → `REGISTERED` | `AND invalidation_state = 'NONE'` |
| `reconcilier-registre-r2.ts:179` | `authority_state = transitionProposee` | `AND invalidation_state = 'NONE'` |

Le réconciliateur ne peut **pas** exprimer la transition demandée : son champ est typé
`transitionProposee: EtatDAutorite | null` — un **état d'autorité**, jamais un **jugement**. Et sa
garde `invalidation_state = 'NONE'` montre qu'il refuse de toucher une ligne déjà jugée, sans jamais
juger lui-même.

**2 · LA TRANSITION EXACTE — le VOCABULAIRE existe, le CHEMIN D'ÉCRITURE n'existe pas.**
`SUPERSEDED` est une valeur ratifiée de `EtatDInvalidation` (`contrat.ts:110`, `ETATS_INVALIDATION`).
La cible `REGISTERED / NONE → REGISTERED / SUPERSEDED` est donc **exprimable dans le domaine**, et
**inatteignable par le code**. Le seul écrivain de la colonne est l'INSERT d'allocation, qui la pose
à `'NONE'`.

**3 · L'AUTORITÉ REQUISE — nommée en doctrine, non instrumentée.**
`contrat.ts:106` : *« LE JUGEMENT. Écrit par un humain ou une procédure nommée, jamais par un
flux. »* La procédure nommée n'a pas été écrite.

**4 · LE COMPORTEMENT DE DÉLIVRANCE APRÈS TRANSITION — déjà correct, et c'est le point heureux.**
`eligibilite.ts:84` : `if (faces.etatDInvalidation !== "NONE") return RETENU("AUTORITE_INVALIDEE")`
— et ce jugement passe **avant** l'état d'autorité. Un `SUPERSEDED` serait donc refusé à la
délivrance **sans qu'une ligne soit ajoutée**. **L'autorité de refus existe déjà ; seul l'acte de
juger manque.**

**5 · APPEND-ONLY / AUDIT.** Le registre n'est pas append-only : il porte `invalidation_reason`,
`invalidated_at`, `last_reconciled_at`, `reconcile_note` — la trace d'un jugement est **prévue par
le schéma**. Rien n'y est écrit aujourd'hui.

### L'état mesuré, en vif, au moment du STOP

```
DÉFECTUEUX 332f5291  REGISTERED/NONE · éligibilité DÉLIVRABLE · délivrance ÉMISE
CORRIGÉ    e91bd0fd  REGISTERED/NONE · éligibilité DÉLIVRABLE · délivrance ÉMISE
```

Le constat de T2 est **reproduit** : l'artefact défectueux reste **actuellement délivrable**.

### ⛔ STOP, et ce qui a été refusé

Écrire ce `SUPERSEDED` aujourd'hui exigerait un `UPDATE` artisanal sur `governed_objects` — donc
exactement ce que la mission interdit, et exactement ce que ce module refuse depuis sa naissance :
un jugement posé par un flux plutôt que par une procédure nommée. **Rien n'a été écrit.**

**SURFACE DE CORRECTION MINIMALE** — une primitive `superseder(identifiant, motif)` dans
`src/lib/storage/registre/registre.ts`, écrivant `invalidation_state`, `invalidation_reason` et
`invalidated_at` sous garde `authority_state = 'REGISTERED' AND invalidation_state = 'NONE'`.
**Un seul fichier. Aucun DDL** — les trois colonnes existent. **Aucune nouvelle doctrine** — le
vocabulaire et la règle de refus sont déjà ratifiés. C'est une décision d'architecte, pas la mienne.

### Conséquence sur les six gates de clôture du Showcase #2

| | gate | état |
|---|---|---|
| 1 | classification BOTIFY = A | ✅ établie |
| 2 | intégrité de l'artefact corrigé | ✅ **PASS** (§4) |
| 3 | artefact défectueux SUPERSEDED | ⛔ **BLOQUÉE — aucune primitive** |
| 4 | délivrance du défectueux REFUSÉE | ⛔ **BLOQUÉE** — mesurée ÉMISE |
| 5 | délivrance du corrigé AUTORISÉE | ✅ **PASS** (§4) |
| 6 | aucun contenu BOTIFY historique ressuscité | ✅ |

**SHOWCASE #2 CLOSED : NON.** Quatre gates sur six sont franchies ; les deux qui manquent dépendent
d'une primitive qui n'existe pas.

---

## §2 · F2 — LE TITRE ORPHELIN, CORRIGÉ

`h1,h2,h3{break-after:avoid;page-break-after:avoid}` — **une ligne**, dans la feuille de style, et
rien d'autre. Elle ne nomme ni `Audit information`, ni VINE, ni BOTIFY, ni un numéro de page, ni un
nombre de claims : **elle ne connaît que des balises**.

Témoins : la correction vit **entièrement** dans la feuille de style — le corps du document ne porte
ni `break-after`, ni `page-break`, ni `style=`, ni classe d'habillage. Et **rien d'autre n'a
bougé** : texte des claims mot pour mot, ordre des quatre titres de section (mesuré sur les `<h2>`,
car « Governed evidence » apparaît **aussi** comme étiquette dans chaque trace), catégories,
fondement, sceau, digest, provenance, `DERIVED_FROM`, audience, déterminisme.

### Le défaut, mesuré avant et après, sur les documents RÉELS

```
AVANT  (44524322…)   page 2 · 42 lignes · se termine par « AUDIT INFORMATION »
                     → lignes après le titre sur la même page : 0   ❌ ORPHELIN
                     page 3 · 3 lignes — le corps, sans sa rubrique

APRÈS  (c689890f…)   page 2 · 41 lignes · se termine par la dernière pièce
                     page 3 · 4 lignes — « AUDIT INFORMATION » ET son corps
                     → lignes après le titre sur la même page : 3   ✅ accompagné
```

---

## §3 · LE DÉPLOIEMENT ET LE NOUVEL ARTEFACT VINE

`pnpm deploy:prod`, chemin gouverné, une fois. `dpl_457M6og8FYNtgZwDK6SA4huM4nN6` · READY ·
production.

```
NEW SERVED SHA  462955af2eeeddf0410589e7c0af8f8c4a1c3e47
source-set servi ≡ main : sourceSetRoot 6f48fe6ac37a43b5… · commit 462955af… · fileCount 2033
                          · ignoreEngine 5.3.2 · cliVersion · generatedAt  — SIX champs en MATCH
santé : /api/health → 200
```

**DEPLOYED ≠ SERVED** — l'autorité servie est établie avant la génération.

```
NEW VINE   registry  c689890f3fd34d7eb06b441c60bc58b3
           octets    106 794 (registre) / 106 794 (relus indépendamment)  MATCH
           sha256    83a9b9d85445bd899884303466ecccb078f2a7f14fc52a82bcb9fc69abece279  MATCH
           en-tête   %PDF-  · 3 pages · 6 claims
```

**Contenu vérifié sur le document rendu** : les 5 observations sous `GOVERNED OBSERVATIONS`,
`VINE-CONCLUSION-01 v1 · INFERENCE` sous `GOVERNED CONCLUSIONS`, `CONSUMED GOVERNED ASSERTIONS` →
`DERIVED_FROM → VINE-MEASURE-01 v1`, traces de fondement, `GOVERNED EVIDENCE`, `AUDIT INFORMATION`
**non orphelin**. Le contenu de `VINE-MEASURE-01` est intact — `NOT_ESTABLISHED` et les trois causes
nommées. Absents : `What could not be established`, `What we established`, `UNDETERMINED`, `AVOID`,
`WARNING`, `/100`, `score`, `TigerScore`, `SmokingGun`.

**VINE REGRESSION : PASS.**

---

## §4 · BOTIFY APRÈS F2 — VÉRIFICATION CIBLÉE, PAS DE RÉGÉNÉRATION

BOTIFY n'a **pas** été regénéré : le changement est un CSS générique, couvert par des témoins, et
aucun risque de régression BOTIFY n'a été mesuré. Vérification ciblée de `e91bd0fd…` :

```
registre    REGISTERED / NONE · 68 010 octets · f2672f8ed81699c2…
délivrance  AUTORISÉE
relecture   HTTP 200 · 68 010 octets · DIGEST MATCH · TAILLE MATCH
```

---

## §5 · TABLE DES RÔLES D'ARTEFACTS — COMPTABILITÉ RC

Aucun mécanisme persisté de « référence courante » n'a été inventé. Ces rôles sont de la
**comptabilité**, pas un état en base.

| registry | octets | état réel | rôle RC |
|---|---|---|---|
| `7cfc5bbd…` | 107 576 | `REGISTERED/NONE` | témoin **historique CF-3**, immuable |
| `332f5291…` | 68 413 | `REGISTERED/NONE` | artefact BOTIFY **défectueux** — ⛔ **SUPERSESSION BLOQUÉE**, reste délivrable |
| `44524322…` | 106 720 | `REGISTERED/NONE` | témoin **daté** de régression du renderer |
| `c689890f…` | 106 794 | `REGISTERED/NONE` | candidat **référence RC VINE courante** |
| `e91bd0fd…` | 68 010 | `REGISTERED/NONE` | candidat **référence RC BOTIFY courante** |
| `b6946c55…` | 281 384 | `REGISTERED/NONE` | antérieur, hors périmètre de ce lot |

**Aucun autre objet gouverné n'a changé d'état** — les six lignes sont `REGISTERED/NONE`, comme
avant, puisque **rien n'a été jugé**.

---

## §6 · DÉCLARATION D'ÉCART

| Autorisé | Exercé |
|---|---|
| F1 · mesurer avant d'agir, cinq points | **exercé** — recensement exhaustif des écrivains, pas un échantillon |
| F1 · exécuter la supersession **si** l'autorité existante convient | **NON exercé — STOP GPT.** Aucune primitive n'écrit un état d'invalidation |
| F1 · SQL artisanal, changement de schéma, transition inventée, framework de cycle de vie | **aucun** |
| F2 · corriger le titre orphelin par le CSS, plus petite règle générique | **exercé** — une ligne, trois balises, zéro littéral |
| F2 · changer autorité, assemblage, schéma ou contenu | **aucun** |
| F2 · déployer par le chemin gouverné et établir le SHA servi | **exercé une fois** · `462955af…` |
| F2 · exactement UN nouveau CaseFile VINE | **un**, relu et redigéré hors du producteur |
| regénérer BOTIFY | **non exercé** — aucun risque de régression mesuré ; vérification ciblée seulement |
| supersédez d'anciens artefacts VINE | **non exercé** — aucun ne porte la contradiction sémantique de F1 ; la question n'est pas devenue matérielle |
| toucher le témoin historique CF-3 | **non exercé** — `7cfc5bbd…` inchangé |
| F3 · autorité générique de clause épistémique | **non créée** — backlog tranché |
| mécanisme persisté de « référence courante » | **non inventé** |

Aucun secret, aucun jeton, aucune URL signée dans ce dossier.
