# BUILD 13 — LOT COURT

Branche `main`, depuis `01f642f`. **Commit local, aucun `push`, aucun déploiement.**
Chantier 1 : correctif + preuve. Chantier 2 : **lecture seule, aucune remédiation.**
Chemins gelés : **aucun touché** — `git status` sur les dix préfixes gelés est vide.

---

# CHANTIER 1 — LES SIX GARDES À FAUX POSITIF

## Le critère, et où il vit

> *A semantic enforcement guard must inspect executable semantics, not textual
> mention of the prohibited mechanism.*

`__tests__/casefile/codeSeul.ts` reste l'**exemplaire unique**. Il reçoit le
critère lui-même :

```ts
export function emisParLeCode(src: string, symbole: string | RegExp): boolean
```

`.match()` et non `.test()` : un motif portant `g` garde un `lastIndex`, et deux
appels successifs ne rendraient pas la même réponse. Un critère ne se souvient
pas de la question précédente.

## Les six, et le septième que je déclare

| # | garde | cible interrogée | état AVANT |
|---|---|---|---|
| 1 | `data-nature/claims-invariants.test.ts` | `TokenCasefileView.tsx` | source **BRUTE**, aucun dépouillement |
| 2 | `kol-memory/wiring.test.ts` (identity) | `src/lib/kol/identity.ts` | ligne à ligne |
| 3 | `kol-memory/wiring.test.ts` (route) | `api/kol/[handle]/route.ts` | ligne à ligne |
| 4 | `kol-memory/wiring.test.ts` (canonical) | `src/lib/kol/canonical.ts` | ligne à ligne |
| 5 | `prebuy/failopen-containment.test.ts:299` | 3 routes `partner/v1/*` | source **BRUTE** |
| 6 | `security/evidence-bytes-probe.test.ts:367` | `evidence-chain/bytesProbe.ts` | source **BRUTE** |
| **7** | `kol-memory/e1-e2-wiring.test.ts:17` | 4 routes casefile + canonical | ligne à ligne |

**Le septième est déclaré, pas dissimulé.** Ta liste dit « wiring (×3) » ; la
famille `wiring` en compte **quatre** — trois dépouillements en ligne dans
`wiring.test.ts` (l. 28, 68, 83) et un quatrième dans `e1-e2-wiring.test.ts:17`.
Ce dernier est précisément celui que l'en-tête de `codeSeul.ts` cite comme
« l'idiome historique du dépôt » : le laisser aurait fait pointer la doctrine
vers un exemplaire défectueux encore vivant. Corrigé, et signalé ici pour que tu
puisses le refuser.

## `failopen-containment:299` — pourquoi le dépouillement n'y était pas

**Instruit avant d'agir, comme demandé. Verdict : ce n'était pas délibéré.**

* `git log -L 288,305` : le bloc « COMPATIBILITÉ `/api/partner/v1/*` » **et** le
  `codeSeul` local de la l. 39 sont nés dans le **même commit**, `83266b0`.
* Le `codeSeul` local y est appliqué deux fois (l. 257 `SRC_SCHEMA`, l. 268
  `canonicalDecision.ts`) et **jamais** sur les trois routes partenaires.
* Aucune prose du fichier ne revendique l'écart, et rien ne distingue ces routes
  des deux fichiers dépouillés : la propriété défendue — « ne consomme pas » —
  est **exécutable** des deux côtés.

C'était l'idiome d'avant l'exemplaire, pas un choix. Le `codeSeul` local est
retiré au profit de l'exemplaire, et le critère est appliqué aux trois routes.

## La preuve — `__tests__/garde/semantique-executable.test.ts`

**40 tests.** 16 cas (les symboles réels des sept gardes), chacun dans les deux
sens, sur des corpus **synthétiques** : aucune violation n'est écrite dans le
dépôt, et aucune garde ne lit `__tests__/`.

* **SENS ROUGE** — le symbole émis par du code exécutable → `emisParLeCode` vrai.
* **SENS VERT** — le même symbole dans les **cinq** formes de prose → faux.
* **Borne anti-vacuité** : chaque forme est d'abord vérifiée **plantée** dans la
  source brute. Une forme qui ne porterait pas le symbole rendrait le sens vert
  vrai pour rien — « verte parce qu'il n'y a rien » serait indiscernable de
  « verte parce qu'elle regarde ». C'est la forme que tu m'as demandé de garder
  comme modèle.
* **Structure** : les sept gardes importent l'exemplaire, et aucune ne conserve
  de dépouillement local — vérifié **par `emisParLeCode` lui-même** sur les
  fichiers de garde, pour que l'assertion ne se sanctionne pas elle-même.
* **Dépôt réel** : assertion **agrégée** — au moins un chemin gardé porte
  aujourd'hui le symbole en prose. Agrégée délibérément : elle dit que la
  famille sert à quelque chose, pas que telle prose doive rester écrite. Une
  garde qui exigerait qu'un en-tête ne soit jamais réécrit serait exactement le
  défaut que ce lot referme.

### La forme complète, ratifiée comme doctrine

> *An absence guard is probative only if it independently proves that the
> prohibited phenomenon exists in its controlled positive witness.*

Trois branches exigées désormais, et « grep rend zéro » n'en est aucune :

| branche | où elle vit |
|---|---|
| contrôle d'absence | les sept gardes, via `emisParLeCode` sur la cible réelle |
| témoin positif contrôlé | **SENS ROUGE** — 16 émissions exécutables synthétiques |
| **mutation discriminante** | **ENCODÉE dans la suite**, pas jouée à la main |

La mutation était d'abord un contrôle manuel. **Elle vit maintenant dans le
fichier** : `fautes(dépouillement)` mesure les deux sens sur les seize cas, et
trois dégénérés doivent échouer — **chacun dans le sens attendu**, sans quoi ce
serait le corpus, et non le dépouillement, qui porterait le défaut.

| dépouillement | fautes | sens |
|---|---|---|
| `codeSeul` | **0** | — |
| identité (source brute) | > 0 | **VERT** uniquement |
| table rase (`""`) | > 0 | **ROUGE** uniquement |
| ligne à ligne (idiome historique) | > 0, et **strictement moins** que l'identité | **VERT** uniquement |

La dernière ligne est la mesure du gain : le témoin historique se place *entre*
la source brute et `codeSeul`, ce qui est exactement ce qu'on lui reproche.

Une vérification qui ne vit pas dans la suite n'est pas un critère, c'est un
souvenir : elle ne protège que le jour où quelqu'un pense à la rejouer.

**Le fichier passe de 35 à 40 tests.**

### Contrôle de mutation manuel — les deux sens tuent

| mutant | effet | résultat |
|---|---|---|
| `codeSeul` → identité (ne dépouille rien) | la prose redevient visible | **17 échecs** (16 sens vert + le dépôt réel) |
| `codeSeul` → `""` (efface tout) | le code devient invisible | **16 échecs** (les 16 sens rouge) |
| restauré | — | **35 verts** |

L'asymétrie est attendue : sous le mutant B, l'assertion « dépôt réel » passe
pour la mauvaise raison, et c'est justement pourquoi le mutant A existe.

### Mesure du dépôt, 2026-09-12

Cinq chemins portent **aujourd'hui** le symbole interdit en **prose**, tous en
commentaire de ligne entière — donc déjà neutralisés par l'idiome ligne à ligne,
donc **aucune garde n'était aveugle** :

| chemin | prose |
|---|---|
| `identity.ts:10` | cite `confidence: "exact"` **et** `source: "manual"` |
| `api/kol/[handle]/route.ts:33` | cite `kolWallets: true` |
| `canonical.ts:122` et `:150` | citent `attributionSource === "manual"` |
| `api/casefile/route.ts:17`, `:24`, `:290` | citent `CASE_DB` |

Les onze autres cas sont **latents** : le symbole n'apparaît nulle part dans la
cible, ni en code ni en prose. Direction de défaillance confirmée sur les
dix-sept : **faux positif, jamais faux vert.** Lot de propreté, traité comme tel.

## Hors périmètre, noté au backlog — non touché

* `scripts/legal-wording-check.sh` — **consultatif**, ne décide de rien.
* Les **cinq runners de mutation** — localisent par `includes` + `replace` brut,
  mais défaillent **BRUYAMMENT**. Bruyant = détectable = pas la même classe.

## Observé en passant, non corrigé — à ton arbitrage

`evidence-bytes-probe.test.ts:349` compte `console.log(` dans la source **brute**
du runner : un `console.log` mis en commentaire ferait passer le compte de 1 à 2
et rougir la garde. Même classe que les six, même direction. **Hors de la borne
que tu as posée — je ne l'ai pas touché.**

## Vérifications

| contrôle | résultat |
|---|---|
| suite complète | **444 fichiers · 5 937 verts** · 1 échec attendu · 2 ignorés |
| `npx tsc --noEmit` | **0 erreur** |
| `eslint` sur les 7 fichiers modifiés | **0** |
| chemins gelés | **aucun touché** |

---

# CHANTIER 2 — DEUX MESURES EN LECTURE SEULE

**Aucune action. Aucune modification de configuration. Aucune suppression, aucun
déplacement, aucun changement de permission, aucun Public Access.**
Appels employés : `GetBucketLifecycleConfiguration`, `ListObjectsV2`,
`HeadObject`, et des `SELECT`. **Aucun `GetObject`, aucune URL signée, aucun
`Put`/`Delete`/`Copy`, aucune écriture en base.**

## MESURE 1 — `auto-delete-30d`

### Rien n'est en train d'être détruit

**0 objet sur 1 136 ne porte `x-amz-expiration`.** Aucune destruction en cours.

### a. Est-elle encore active aujourd'hui ?

**Non — sur tout ce qui est observable, et la réponse est un proxy, pas une
lecture de configuration.**

`GetBucketLifecycleConfiguration` rend toujours **`AccessDenied`** avec ce jeton
(inchangé depuis le 2026-08-20). Le seul observable reste l'en-tête
`x-amz-expiration`, **recalculé à chaque requête depuis les règles en vigueur** :

| périmètre | mesure du 2026-09-12 |
|---|---|
| 4 préfixes de tête + 262 sous-préfixes, objet le plus ancien de chacun | **0 en-tête d'expiration** |
| 1 103 clés `r2Key` du registre `EvidenceItem` | **0 en-tête d'expiration** |
| objets de 160, 149, 53, 44, 43 jours | présents, **sans expiration** |

Un objet de **0 jour** sous une règle active porterait déjà l'en-tête, avec sa
date future : `reports/production/` (2 objets, 0 jour) n'en porte aucun.

**Ce que je ne peux pas dire :** que la règle a été *supprimée*. Je peux dire
qu'**aucune règle d'expiration n'est en vigueur sur aucun préfixe observé**. La
distinction « désactivée » / « supprimée » exige la console.

### b. Depuis quand, et par quel commit

**Aucune trace dans le dépôt. C'est la réponse, et elle est nette.**

* Aucun commit, sur **aucune branche**, ne contient de `PutBucketLifecycle*` ni
  d'écriture de `LifecycleConfiguration`.
* La chaîne `auto-delete-30d` n'apparaît **que** dans des documents datés du
  **2026-08-20 ou après**, plus la sonde et son test — qui **citent** l'en-tête
  capturé. Jamais dans du code qui la poserait.

→ **Action console (ou API hors dépôt), sans trace versionnée.** Ni auteur ni
date de création ne sont établissables d'ici, et aucune ne le sera sans la
console Cloudflare.

Ce que l'observation borne quand même :

| fait | source |
|---|---|
| dernière émission observée | 2026-08-19 **20:12:33 UTC** — 31/31 clés `reports/` |
| échéance annoncée sur la pièce détruite | `expiry-date="Thu, 20 Aug 2026 04:38:57 GMT"` = création **+31 j** |
| première non-émission observée | 2026-08-20 **10:08 UTC** |

La pièce `…2026-07-21T04:38:57` (créée **un jour après** celle qui a été
détruite) est **toujours là**, 53 jours. Son échéance eût été le 2026-08-21. La
règle a donc cessé d'agir **entre le 2026-08-20 04:38 et le 2026-08-21 04:38**.

### c. Quels préfixes elle couvre aujourd'hui

**Aucun.** Le compartiment porte **1 136 objets** en 4 préfixes de tête :

| préfixe | objets | plus ancien | expiration |
|---|---|---|---|
| `evidence/` | 1 096 | **2026-04-04** | aucune |
| `reports/` | 38 | **2026-07-21** | aucune |
| `pointers/` | 1 | 2026-09 | aucune |
| `test-ping/` | 1 | **2026-03-26** | aucune |

`reports/production/` (2 objets) : **couvert par la mesure, sans expiration.**
Les 1 103 objets portant une ligne `EvidenceItem` : **couverts, sans expiration.**

### ⚠️ Ce que la mesure corrige dans notre récit

**« Elle a détruit rétroactivement tout objet > 30 j le 2026-08-19 » n'est pas
ce que montre le compartiment.**

* `evidence/` conserve **26 objets** datés **2026-04-04 (19)** et **2026-04-16
  (7)** — quatre mois d'âge, en plein dans la fenêtre dite non mesurable.
* `test-ping/smoke-test.txt` date du **2026-03-26** et existe toujours.
* `evidence/` a une falaise nette : **19 + 7 en avril, puis 1 070 le 2026-07-30**,
  et rien entre les deux. Cette forme est celle d'une **ingestion en lots**, pas
  celle d'une destruction par ancienneté.
* `reports/`, en revanche, a une falaise **au 2026-07-21**, et la seule pièce
  manquante de la série quotidienne est celle du **2026-07-20** — exactement
  celle dont l'en-tête annonçait l'échéance.

→ **La destruction observée porte sur `reports/`, et sur une seule pièce
constatée.** Une règle véritablement globale sur 30 jours aurait emporté les 27
objets d'avril et de mars : ils sont là. Lecture la plus économe : **règle
portée par le préfixe `reports/`**. Je la donne comme **inférence**, pas comme
fait — nous n'avons jamais interrogé une clé `evidence/` pendant que la règle
émettait.

**Ce qui reste réellement non mesurable** : combien de PDF `reports/` antérieurs
au 2026-07-21 ont existé. R2 ne les a plus, et le registre ne les a **jamais**
eus — c'est le défaut `uploadPdf` déjà en arbitrage. La non-mesurabilité vient
du **registre manquant**, pas de la règle.

### d. Lignes de preuve pointant vers des octets détruits

**Deux, et les deux sont déjà signalées dans le registre.**

| `r2Key` | objet R2 | `evidentiaryStatus` |
|---|---|---|
| `reports/GordonGekko/CASE_GordonGekko_2026-07-20T04-38-57.pdf` | **absent** | `BYTES_LOST` |
| `evidence/5b/5b2dcac7…c990.png` | **absent** | `EXCLUDED` |

**1 103 lignes portent un `r2Key` · 1 101 présentes · 2 absentes · 0 illisible ·
0 sous expiration.** Chiffres **identiques** à ceux du 2026-08-20 : 23 jours sans
aucune perte nouvelle.

**Aucune ligne de preuve ne pointe silencieusement vers des octets détruits.**
Les deux absences sont l'une comme l'autre étiquetées. Sur ce critère —
l'urgence — **il n'y en a pas.**

*Réserve, et elle est la même que pour (c) : ce compte ne borne que les octets
que le registre connaît. Un PDF détruit sans ligne `EvidenceItem` est invisible
à cette mesure, par construction.*

**Rien n'a été désactivé, déplacé ni supprimé. La remédiation attend le ruling.**

## APPLICATION DU GATE GPT — `auto-delete-30d`

**Classification retenue : E — STORAGE PUBLICATION & RETENTION AUTHORITY,
sous-classe UNGOVERNED RETENTION / DESTRUCTIVE LIFECYCLE.** Face destructive du
même problème, pas un défaut RC séparé.

> *Retention and destruction are governed mutations. Infrastructure lifecycle
> policy must not destroy governed evidence or artifacts without an explicit
> retention authority applicable to those objects.*

Le gate se résout sur des mesures déjà en main. Je le déroule branche par
branche, **et aucune n'appelle de mutation.**

| branche du gate | mesure | déclenche ? |
|---|---|---|
| règle **inactive**, ou préfixes non gouvernés → aucune action | 0 en-tête d'expiration sur 1 136 objets, 266 préfixes, 1 103 clés du registre | **OUI → aucune action** |
| règle active, aucun objet gouverné menacé → finir la mesure, puis ruling | — | non (règle non active) |
| **règle active + objet gouverné vivant éligible → STOP IMMÉDIAT** | aucun objet ne porte d'échéance ; le plus vieux (160 j) est sans expiration | **non — pas de STOP à déclencher** |
| **références `EvidenceItem.r2Key` MORTES > 0 → RC BLOCKER CONFIRMÉ** | **2** | **OUI** |
| références mortes = 0 mais destruction future possible → design blocker | sans objet : elles ne sont pas à 0 | — |

### Verdict : **E = RC BLOCKER CONFIRMÉ**

**Cardinal complet, sur le périmètre du registre : 2 références mortes sur
1 103.** L'intégrité référentielle de la preuve est **matériellement cassée** —
deux lignes `EvidenceItem` portent un `r2Key` dont les octets n'existent plus.

| `r2Key` | objet | `evidentiaryStatus` | cause |
|---|---|---|---|
| `reports/GordonGekko/CASE_GordonGekko_2026-07-20T04-38-57.pdf` | absent | `BYTES_LOST` | échéance `auto-delete-30d` annoncée puis exécutée |
| `evidence/5b/5b2dcac7…c990.png` | absent | `EXCLUDED` | **non établie** — aucune expiration observée sur ce préfixe |

**Nuance qui ne change pas le verdict :** les deux sont **étiquetées**, donc
aucune ne pointe *silencieusement* vers des octets détruits. Le gate porte sur
le **cardinal**, pas sur l'étiquetage : 2 > 0, le blocker est confirmé. L'écart
entre « cassée » et « cassée en silence » relève de l'urgence, pas de la
qualification — et l'urgence, elle, reste basse.

### Ce que le verdict ne couvre pas, et c'est la même réserve qu'en (c)

Ce cardinal ne borne que les octets **que le registre connaît**. Un artefact
détruit sans ligne `EvidenceItem` est invisible à cette mesure **par
construction** — c'est le défaut `uploadPdf`, en arbitrage. La période
**2026-03-09 → 2026-07-20** reste donc **NOT_MEASURABLE**, et le rester est la
conclusion, pas une étape : **je ne peux ni affirmer ni exclure** qu'elle ait
porté des artefacts gouvernés détruits. Elle ne devient jamais « il n'y en avait
pas ».

### Aucune mutation

`auto-delete-30d` **n'a pas été désactivée**, ni globalement ni par préfixe, ni
lue en écriture. Elle couvre peut-être du temporaire légitimement éphémère : le
scope exact reste **inconnu** (`GetBucketLifecycleConfiguration` → `AccessDenied`),
et mon « inactive » est un **proxy d'en-tête**, pas une lecture de configuration.
Aucune mutation de configuration sans ruling.

## MESURE 2 — retrouver le « 14 »

**Je ne trouve rien qui dise « 14 pièces exclues ». Troisième issue.**

Recherche menée une fois, proprement : arbre de travail complet (suivi **et** non
suivi), `git log -S` sur six formulations, et les **trois seuls** `.md` jamais
supprimés de l'historique (`design-`, `layout-`, `routes-audit`) relus dans leur
dernier état.

**Deux `14` existent dans nos notes. Ni l'un ni l'autre ne compte des pièces exclues.**

| document | date | ce que « 14 » compte |
|---|---|---|
| `docs/prep/HIGH_FREQUENCY_MATRIX_FINALE.md:79` | **2026-08-29** | `Exclus / libérés : 6 / 20 — 14 / 20` → **14 wallets LIBÉRÉS** sur 20 |
| `docs/reports/build9-p0-qualification.md:174` | 2026-09-07 | **14 preuves JOIGNABLES** par `canonicalMint` sur `IL-CONC-BLACKBULL-001` |

Le premier est le seul candidat d'août, et c'est le seul de tout le dépôt où
« 14 » côtoie « exclu ». **Il compte des wallets, et il compte les LIBÉRÉS** — le
complément des 6 exclus. Une note qui en tirerait « 14 pièces exclues » aurait
inversé deux fois : l'objet (wallets → pièces de preuve) et le sens (libérés →
exclus).

**Je le donne comme candidat, pas comme source.** Rien ne relie ce tableau à nos
notes d'exclusion, et fabriquer ce lien serait le piège même que tu nommes.

Contre-mesure du jour, base de production, lecture seule :

```
EvidenceSnapshot.reviewStatus   : approved=925  internal=224  excluded=20  pending=2
EvidenceItem.evidentiaryStatus  : NULL=1094  EXCLUDED=9  BYTES_LOST=1
```

**Aucun critère existant ne rend 14**, et je n'en ai construit aucun qui le
rendrait.

### RÉTRACTÉ — origine retrouvée, hors de mes deux candidats

**`14 EXCLUDED PIECES = RETRACTED / NON VERIFIED`.**

Le chiffre venait d'une mesure rapportée comme **« 14 pieces carrying R2 URL have
`sha256=false` »**, puis a **glissé** vers « 14 pièces exclues ». Ni mon candidat
d'août (14 wallets *libérés*) ni celui de septembre (14 preuves *joignables*)
n'étaient la source : les trois sont des « 14 » distincts, et c'est précisément
ce qui rend ce genre de chiffre migrateur.

**Le défaut était le glissement sémantique, pas le chiffre.** « Portant une URL
R2 sans `sha256` » et « exclue » ne se recouvrent pas : la première dit qu'on ne
peut pas vérifier l'artefact, la seconde qu'on a décidé de ne pas le retenir.
L'une est un état de vérifiabilité, l'autre un acte de gouvernance.

Les deux mesures restent **SÉPARÉES, aucune agrégation** :

```
EvidenceSnapshot.reviewStatus = 'excluded'      → 20
EvidenceItem.evidentiaryStatus = 'EXCLUDED'     →  9
```

Recherche de provenance : **une passe, close.** Chiffre retiré des notes.

---

# `uploadPdf` — RÈGLE TRANCHÉE, CHANTIER NON OUVERT

Enregistré ici pour que la règle ne se reperde pas. **Rien n'est construit.**

Règle **FORTE** retenue, la large écartée :

> *A governed artifact must not be persisted outside the governed object
> registry. Successful object persistence and successful authority registration
> form one governed operation.*

Et non « toute écriture R2 doit créer une ligne » : tous les objets R2 ne sont
pas des artefacts gouvernés — `test-ping/`, `pointers/` en témoignent.

**Le piège, nommé d'avance, et il est pour moi :** la base et R2 **n'ont pas de
transaction ACID commune**. Le chantier ne devra donc **pas** poser le faux
invariant « les deux écritures sont atomiques » — elles ne peuvent pas l'être.
Ce qu'il faudra construire est un **protocole explicite de compensation /
réconciliation** : un téléversement réussi dont l'enregistrement échoue ne
devient **jamais** publiable, et doit rester **détectable et réconciliable**.

Pour l'orphelin unique : **aucune suppression, aucun déplacement.** Inventorié
**GENERATED INVALID ARTIFACT**, exposition **0**. Son invalidation future agira
sur son **ÉLIGIBILITÉ**, pas sur ses octets.

> *Preservation of an invalid artifact does not preserve its publication
> authority.*

---

# CE QUI N'A PAS BOUGÉ

Aucune remédiation storage · `uploadPdf` non corrigé · Artifact CLOSED, non
rouvert · `report/v2` clos · `loadCaseByMint` intact · `pdfRenderer.ts` et
`templateV2.ts` intouchés · aucun chemin gelé · aucune écriture de masse, aucun
DDL, aucune suppression de ligne de preuve · `ADMIN_TOKEN` jamais manipulé ·
Watchlist, Explorer et Telegram `/kol` non touchés.
