# BUILD 10 · S0 — CARTE DU CODE

**Reconnaissance en LECTURE SEULE.** 0 write, 0 DDL, 0 collecte, 0 RPC, 0 provider.
Aucun chemin gelé franchi. Aucune correction proposée : on nomme et on classe.

Base : `main = 4d5cdcccb4b4977bf676ffd33bbfe62fd7d8c4c7`, guard
`ce13d0c0…13e50`, aucune exemption ouverte — les trois vérifiés, pas supposés.

---

## LES SIX CATÉGORIES

| catégorie | ce qu'elle veut dire |
|---|---|
| `DATA_ABSENT` | la donnée pourrait exister, elle n'est pas là |
| `NOT_MEASURABLE` | rien dans le système ne peut la produire |
| `PIPE_NOT_CONNECTED` | source et surface existent, le câble entre les deux, non |
| `COLLECTOR_MISSING` | aucun collecteur ne remplit la source |
| `BUG` | le comportement contredit son propre contrat |
| `INTENTIONALLY_NOT_SHOWN` | retiré par décision, et la décision est traçable |

Un **BLANC SILENCIEUX** est signalé à part, quelle que soit sa catégorie : un
champ vide qui ne dit pas qu'il est vide. Un « — » explicite est acceptable ;
un vide muet ne l'est pas.

---

## 1 · ÉNUMÉRATION DES SURFACES — MESURÉE, NON PRÉSUMÉE

| famille | compte | mesure |
|---|---|---|
| pages publiques (locales fusionnées) | **98** routes distinctes / 135 fichiers | `find src/app -name page.tsx`, hors `admin/` |
| pages admin | **62** routes distinctes | idem, `admin/` |
| routes API | **365** `route.ts` | dont **182** hors `admin/` et `cron/`, **157** admin, **26** cron |
| PDF / exports | **21** producteurs | `application/pdf`, `text/csv`, `PutObjectCommand` |
| extensions navigateur | **2** | `interligens-guard/`, `packages/chrome-guard/` |
| e-mail / notification | **1 chaîne** identifiée | `src/lib/security/email/digest.ts` + routes d'envoi |

### Le gate de requêtes change l'ordre de lecture

`src/proxy.ts` place **quasiment toute page publique derrière un cookie
`investigator_session` validé** (hash SHA-256, `revokedAt: null`,
`expiresAt > now`, accès actif, fail-closed).

Ce qui est atteignable **sans session** :

```
/access*  ·  /simulator*  ·  /legal/*  ·  /<loc>/legal/*
/health   ·  /sitemap.xml ·  /robots.txt  ·  assets statiques
/api/*    → exempté du gate beta, chaque route porte sa propre garde
```

Conséquence pour l'ordre : un lecteur Investor/Counsel **sans session** ne voit
que le flux d'accès et les pages légales. Avec session, il ouvre les dossiers.
Les deux cas sont traités, dans cet ordre de valeur.

---

## 2 · ORDRE DE TRAITEMENT

Ordonné par ce qu'un lecteur Investor/Counsel ouvre en premier. Je descends
cette liste ; si le contexte s'épuise, ce qui compte est fait.

| # | surface | pourquoi ce rang |
|---|---|---|
| 1 | `/<loc>/cases/lab`, `/cases/cbex`, `/cases/botify`, `/cases` | le dossier lui-même — la sortie de BUILD 9 |
| 2 | `/api/casefile/public` · `/api/casefile/pdf` | le PDF, ce que counsel emporte |
| 3 | `/shared/case/[token]` | le lien qu'on transmet à un tiers |
| 4 | `/<loc>/kol/[handle]` | surface NOMINATIVE — le risque juridique le plus direct |
| 5 | `/<loc>/methodology/*` · `/dataroom/score` | « comment ce score est-il fait » |
| 6 | `/<loc>/transparency` · `/<loc>/investors` | ce que l'entreprise affirme d'elle-même |
| 7 | `/<loc>/explorer` · `/explorer/[caseId]` | la navigation dans le corpus |
| 8 | `/<loc>/watchlist` · `/watchlist/signals/[id]` | le flux vivant |
| 9 | `/legal/*` | atteignable SANS session — un régulateur commence souvent là |
| 10 | extensions + e-mail | surfaces distribuées, hors navigateur |

Le reste (admin, investigateurs, mm, guard, intégrations) vient après : ce ne
sont pas les surfaces qu'un lecteur externe ouvre.

---

## 3 · LES COLLECTEURS — CE QUI TOURNE, ET CE QUI N'EST PAS ARMÉ

Premier passage transversal, parce qu'il conditionne **toutes** les surfaces :
un champ dont le collecteur ne tourne pas est vide partout à la fois.

### 3.a · Crons armés

**17 crons déclarés dans `vercel.json`, et les 17 ont un handler.**

> **Correction d'une erreur de ma première mesure.** J'avais compté
> `/api/intelligence/ingest/ofac` et `/api/intelligence/ingest/scamsniffer`
> comme « crons sans handler » : mon `find` était scopé sur `src/app/api/cron`
> et ne voyait pas la route **dynamique** `ingest/[slug]/route.ts`, qui les
> capte. Vérifié : les deux slugs sont dans `SOURCES`.

### 3.b · Onze handlers cron ORPHELINS

Handler présent dans le code, **aucun cron déclaré** dans `vercel.json`.

| handler | autres références au chemin |
|---|---|
| `api/cron/mm-calibration` | **0** |
| `api/cron/onchain/sync` | **0** |
| `api/cron/signals/run` | **0** |
| `api/cron/social/capture` | **0** |
| `api/cron/social/discover` | **0** |
| `api/cron/alerts/deliver` | 1 |
| `api/cron/corroboration` | 1 |
| `api/cron/intake-watch` | 1 |
| `api/cron/digest` | 2 |
| `api/cron/price-cache-refresh` | 2 |
| `api/cron/security-weekly-digest` | 5 |

**Catégorie provisoire : `PIPE_NOT_CONNECTED`** — le collecteur EXISTE, il
n'est pas déclenché. À confirmer surface par surface : un handler orphelin
n'est un trou que si une surface attend ce qu'il produit. Les cinq à zéro
référence sont les plus suspects.

*Chiffre non vérifié :* je n'ai pas mesuré si un déclencheur externe
(GitHub Actions, appel manuel, autre plateforme) les appelle. Le comptage
porte sur le dépôt seul.

### 3.c · Sources d'intelligence déclarées mais NON armées

`src/lib/intelligence/sources/registry.ts` déclare six sources **avec leur
horaire**. `vercel.json` n'en arme que deux.

| source | horaire déclaré au registre | armé |
|---|---|---|
| `ofac` | `0 6 * * *` | **oui** (à `0 1 * * *`) |
| `scamsniffer` | `0 7 * * *` | **oui** (à `30 1 * * *`) |
| `amf` | `0 8 * * 1` | **non** |
| `fca` | `30 7 * * *` | **non** |
| `forta` | `0 */6 * * *` | **non** |
| `goplus` | `realtime` | **non** |

Deux constats distincts, à ne pas confondre :

1. **quatre sources sur six ne sont jamais collectées** — `COLLECTOR_MISSING`
   du point de vue de toute surface qui les attendrait ;
2. **les horaires du registre et ceux de `vercel.json` divergent** pour les
   deux qui tournent. Le registre déclare un horaire qui n'est pas celui qui
   s'applique : c'est une deuxième source de vérité sur la cadence.

À instruire : quelles surfaces citent `amf`, `fca`, `forta`, `goplus` ? Si une
UI les annonce, l'écart est un blanc silencieux. Si aucune ne les cite, c'est
un registre en avance sur le produit — pas un trou.

---

*Document écrit au fil de l'eau. Les surfaces suivent, une section par surface.*

---

# SURFACE 1 · LES PAGES DE DOSSIER

`/<loc>/cases`, `/<loc>/cases/lab`, `/<loc>/cases/cbex`, `/en/cases/botify/evidence`

## 1.1 · La chaîne, mesurée

```
UI  TokenCasefileView  ──→  page.tsx (lab | cbex)
                            ├─ prisma.tokenCaseFile.findUnique(ref)   ← bloc legacy
                            └─ loadPublicProjection(ref)              ← bloc canonique
                                 └─ CaseFileClaim + CaseFileSource
```

### Le writer de l'autorité canonique

**Il n'existe aucun writer applicatif de `token_casefiles`.**

| ref | ce qui l'écrit |
|---|---|
| `IL-PND-LAB-001` | `prisma/seed-lab.ts` — un **seed**, 38 champs, `upsert` |
| `IL-PON-CBEX-001` | `prisma/seed-cbex.ts` — un **seed** |
| `IL-SHILL-BOTIFY-001` | aucun seed ; SQL rendu à la main (`docs/prep/patches/BUILD9/`) |
| `IL-SHILL-VINE-001` | idem |

Un seul `tokenCaseFile.upsert` dans tout `src/` + `prisma/` : celui de
`seed-lab.ts`. Les pages, l'API, le lecteur canonique et l'audit **lisent**.

**Catégorie : `COLLECTOR_MISSING`** — au niveau de la table entière. Aucun
pipeline ne crée ni ne rafraîchit un dossier. Ce n'est pas un défaut de
qualité des données : c'est l'absence de chaîne d'alimentation. Tout dossier
futur naîtra d'un seed écrit à la main ou d'un SQL exécuté en console.

*Conséquence directe :* les colonnes de marché (`ath`, `atl`, `fdvPeakUsd`,
`marketCapMinUsd/MaxUsd`, `circulatingSupply`) sont figées à la valeur du seed.
Rien ne les rafraîchit. Une page de dossier affiche donc un instantané dont
**la date n'est pas rendue**.

### Huit colonnes qu'aucun writer applicatif ne pose

`insiderExitNotionalValueUsd` · `insiderExitNotionalValueUsdNature` ·
`insiderExitNotionalBasis` · `claimedRaiseUsdNature` ·
`estimatedRetailHarmUsdNature` · `rowNature` · `createdAt` · `updatedAt`

`createdAt`/`updatedAt` ont un défaut base — hors sujet. Les six autres sont
posées par des **packs SQL exécutés à la main** (S3, S5, S6, W2). Un dossier
créé demain par un seed les aurait à `NULL`.

**Catégorie : `PIPE_NOT_CONNECTED`.** La colonne existe, la surface la rend
(`insiderExitNotionalValueUsd` est affiché par la fiche), aucun code ne la
remplit.

## 1.2 · Comportement quand un champ est absent — la mesure

Croisement de la nullabilité du schéma avec les gardes réelles du rendu.

**Aucun champ scalaire non gardé n'est nullable.** Les 9 champs sans garde
(`ref`, `codename`, `ticker`, `title`, `family`, `subtype`, `primaryChain`,
`status`, `verdict`) sont tous `NOT NULL`. Les nullables ont tous un repli
explicite. **Zéro blanc silencieux sur les scalaires.**

En revanche, sur les **listes**, le même composant se comporte de deux façons :

| champ liste | comportement quand vide |
|---|---|
| `secondaryChains`, `backers`, `exchanges`, `exitExchanges`, `linkedTokens` | rend **« — »** — explicite |
| `founders` | **la section disparaît** |
| `keyWallets` | **la section disparaît** |
| `sources` (sources de l'investigation) | **la section disparaît** |
| bloc canonique (claims + retraits) | **le bloc disparaît** |

**Quatre blancs silencieux**, dans un composant qui sait pourtant écrire « — »
cinq lignes plus haut. Le plus lourd est `sources` : un dossier sans sources
d'investigation listées ne se distingue pas d'un dossier dont la section
n'existe pas. Pour `keyWallets`, BOTIFY porte `[]` de façon **ratifiée** — la
section s'évanouirait sans dire pourquoi.

Le bloc canonique est **mon propre choix de conception** (BUILD 9) : « ne pas
afficher une section vide qui donnerait à croire qu'on a cherché et rien
trouvé ». Sous la lentille de BUILD 10, l'intention n'est pas visible du
lecteur — je le classe comme les autres.

## 1.3 · `/en/cases/botify/evidence` — une TROISIÈME autorité CaseFile

`/en/cases/botify` **redirige** vers `/en/cases/botify/evidence`. Cette page ne
lit ni `token_casefiles`, ni le lecteur canonique, ni même le JSON : elle porte
**ses propres constantes**, `CASE`, `CLAIMS`, `WALLETS`, `EDGES`, avec le
commentaire « Static data from data/cases/botify.json ».

BUILD 9 a supprimé deux autorités concurrentes. Celle-ci n'a jamais été
inventoriée, parce qu'elle n'était pas dans la carte des surfaces CaseFile.

| constat | mesure | catégorie |
|---|---|---|
| 8 claims dupliqués en dur | copies des titres canoniques, sans lien | `PIPE_NOT_CONNECTED` |
| tous rendus `CONFIRMED` (× 9) | l'autorité canonique les porte en `ATTACHED`, aucun n'est `PUBLIC` | `BUG` — contredit la doctrine des trois états sur une surface publique |
| `mint` publié = **clé synthétique 43 car.** | canonique = 44 car. (`…UnZac**i**ja4…`) ; la page publie `…UnZacja4…` | `BUG` |
| « rug-pull » × 1, `rug_pull` × 1 | mot **interdit** par le contrat de wording du PDF, rendu ici | `BUG` |
| 7 adresses tronquées de démonstration | `7xKQ…mN2u`, `4xZ9…kQMM`, `9Th6…BYZ9`, `DezX…PB26`, `RAY…mmLP`, `5KJe…xFG2` — dont deux sont des fragments du **mint**, pas des wallets | `DATA_ABSENT` maquillé en donnée |
| 8 arêtes de graphe à montants non quantifiés | `"— SOL"`, `"Equal"`, `"~90s window"` présentés dans une colonne « amount » | `DATA_ABSENT` maquillé en donnée |

> **Le containment de BUILD 9 ne couvrait pas cette page.** Il scannait `src/`
> pour les **valeurs exactes** retirées du PDF. Ces marqueurs-ci sont d'autres
> chaînes, sur une autre surface. Le test de non-réintroduction est donc vrai
> et insuffisant : il protège des valeurs, pas d'une classe.

## 1.4 · Asymétrie de locale

`botify` n'existe que sous `en/`. Il n'y a pas de `src/app/fr/cases/botify/`.
Un lecteur francophone qui suit un lien `/fr/cases/botify` obtient un 404.

`lab`, `cbex` et l'index existent dans les deux locales.

**Catégorie : `DATA_ABSENT`** (la page fr n'a pas été écrite), et **blanc
silencieux** au sens du produit : rien n'indique au lecteur fr que le dossier
existe en anglais.

## 1.5 · L'index `/cases`

Liste `platformCaseFile` et `tokenCaseFile` filtrés sur
`publishStatus: "published"`. Le filtre est explicite et fail-closed : un
dossier non publié n'apparaît pas — comportement correct, pas un blanc.

*Non mesuré :* combien de lignes portent `publishStatus = "published"` en base.
Je n'ai pas de connexion ; le chiffre ne peut pas être avancé ici.

---

# SURFACE 2 · LE PDF — `/api/casefile/public` et `/api/casefile/pdf`

## 2.1 · La chaîne, mesurée

```
route → canonicalRefForMint(mint|handle) → loadPublicProjection(ref)
      → generateCaseFilePdfPublic(lang, dossier)
        ├─ claims PUBLIC uniquement       ← CaseFileClaim
        ├─ sources citées et publiables   ← CaseFileSource
        └─ faits statiques par dossier    ← constante FACTS_BY_REF
```

Depuis BUILD 9, le générateur ne lit aucune autorité : il reçoit la projection.
Le fail-closed est en place, l'absence de dossier lève. **Rien à redire sur la
chaîne elle-même.** Ce qui suit porte sur ce que la chaîne TRANSPORTE.

## 2.2 · Le `tigerScore` d'un dossier n'est pas produit par le moteur

C'est le constat le plus lourd de cette surface.

| ref | valeur | ce qui la pose |
|---|---|---|
| `IL-PND-LAB-001` | `91` | **littéral en dur**, `prisma/seed-lab.ts:378` |
| `IL-SHILL-BOTIFY-001` | `NULL` | rien |
| `IL-SHILL-VINE-001` | `NULL` | rien |

`computeTigerScore` existe, il tourne sur les surfaces de scan
(`buildTigerInput/solana.ts`, `evm.ts`, `/api/scan/evm`) — et **il n'écrit
jamais dans `token_casefiles`**. Aucun `update` de cette colonne dans le dépôt.

Le « 91 » affiché sous le libellé **TigerScore**, à côté d'un lien vers
`/methodology/tigerscore`, n'est donc pas une sortie du moteur documenté par
cette page. C'est un nombre écrit à la main dans un seed.

**Catégorie : `COLLECTOR_MISSING`.** Le moteur existe, la colonne existe,
aucune chaîne ne va de l'un à l'autre.

*Ce n'est pas un blanc silencieux* — le nombre est bien affiché. C'est le cas
inverse, plus difficile : une valeur présente dont la PROVENANCE est autre que
celle que la surface laisse entendre.

## 2.3 · Les faits statiques n'ont aucune date d'observation

`FACTS_BY_REF` porte pour BOTIFY : autorités mint/freeze/update actives
(source `rugcheck.xyz`), concentration top-3 62 % / top-10 78 % (source
`Solscan holder queries`).

Ces faits portent leur **source nommée** — c'est ce qui les rend publiables —
mais **aucune date**. BUILD 9 a retiré `TODAY_ISO` de la phrase parce qu'il
maquillait la date de génération en date d'observation. Le résultat correct est
qu'il n'y a plus de date du tout, parce qu'aucune n'a jamais été stockée.

**Catégorie : `DATA_ABSENT`.** L'horodatage d'observation n'existe dans aucune
structure. Et **blanc silencieux** : le lecteur ne voit pas de champ « date »
vide, il ne voit pas de champ du tout. Rien ne lui dit que ces faits peuvent
dater de n'importe quand.

**Catégorie associée : `COLLECTOR_MISSING`** — aucun collecteur ne rafraîchit
ces faits. Ils sont figés dans une constante du code.

## 2.4 · Ce que le PDF publie aujourd'hui, mesuré

Aucun claim n'est `PUBLIC` en base. Le PDF rend donc, pour BOTIFY :

- index des preuves → **vide, avec sa raison** (`evIdxEmpty` + avis nommant le champ)
- catalogue OSINT → **vide, avec sa raison**
- chronologie, cluster, projets liés → **retirés**, `txSignature` nommé
- contrôle du token, métriques → les faits statiques ci-dessus
- couverture → score « non établi », décompte de claims = 0

**Aucun blanc silencieux.** Chaque absence porte sa raison. C'est le résultat
de BUILD 9, et il tient.

---

# TRANSVERSAL · LA VALEUR PAR DÉFAUT QUI SE FAIT PASSER POUR UNE DONNÉE

Ce n'est pas une surface, c'est une **classe**, et elle traverse le produit.

**97 occurrences** de `?? 0` sur des champs de score, montant, compte ou
pourcentage, hors tests, dans `src/app` et `src/lib`.

Le cas le plus net, sur une surface publique — les trois pages `/demo` :

```ts
const tigerScore = Number(data?.tiger_score ?? 0) || 0;
const score = Math.max(baseScore, tigerScore);
const tier = getTier(score);        // src/lib/risk/tier.ts
```

et le barème :

```ts
if (score >= 70) return "RED";
if (score >= 35) return "ORANGE";
return "GREEN";                     // couleur #22c55e
```

**Un score absent devient 0, et 0 rend GREEN.** Une donnée qui manque produit
le verdict le plus rassurant que le produit sache écrire — en vert.

C'est l'exacte inversion de la doctrine posée en BUILD 9 sur `tigerScore` :
*« NULL = score non établi. 0 = calculé à zéro et démontrable. Ne JAMAIS
convertir NULL en 0. »* La doctrine tient dans la couche CaseFile ; elle n'a
jamais été appliquée à la couche scan.

| | |
|---|---|
| catégorie | `BUG` — le comportement contredit une doctrine ratifiée du produit |
| blanc silencieux | **oui, et de la pire espèce** : pas un vide, une affirmation fausse |
| portée non mesurée | je n'ai pas classé les 97 une par une. Le chiffre est un **comptage**, pas un audit : certaines occurrences sont légitimes (un compteur qui démarre à zéro EST zéro). Les quatre pages `/demo` sont vérifiées ligne à ligne. |

---

# SURFACE 3 · `/shared/case/[token]` — LE LIEN QU'ON TRANSMET

## 3.1 · La chaîne

```
/shared/case/<token> → prisma.vaultCaseShare.findUnique({ token })
                     → expiresAt vérifié ligne 111, expiration RENDUE
créé par : POST /api/investigators/cases/[caseId]/share (rate-limité 20/h)
```

L'expiration est explicite, affichée deux fois sur la page. **Bon
comportement** : un lien périmé le dit.

## 3.2 · Le lien de partage est derrière le gate beta

Mesuré dans `src/proxy.ts`, en recompilant le matcher :

| chemin | capté par le matcher | exempté du gate |
|---|---|---|
| `/shared/case/<token>` | **oui** | **non** |
| `/legal/terms` | non | — |
| `/access` | non | — |
| `/api/casefile/public` | non (autre entrée) | — |

`isBetaExempt("/shared/case/…")` rend `false`, et le catch-all du matcher
capte le chemin. Un destinataire **sans cookie `investigator_session` valide
est donc redirigé vers `/access`.**

C'est la surface conçue pour être transmise à un tiers — counsel, régulateur,
confrère — et c'est celle qu'un tiers ne peut pas ouvrir.

| | |
|---|---|
| catégorie | `BUG` — la surface contredit sa raison d'être |
| blanc silencieux | non : le tiers voit une page d'accès, pas un blanc |
| **non vérifié** | **mesuré dans le CODE uniquement.** Je n'ai pas exercé le comportement en production, et je n'ai pas de session pour le faire. Un déploiement peut porter une exemption d'infrastructure (règle Cloudflare, rewrite) que le dépôt ne montre pas. |

---

# SURFACE 4 · `/<loc>/kol/[handle]` — LA SURFACE NOMINATIVE

C'est la surface au risque juridique le plus direct : elle nomme des personnes.

## 4.1 · La chaîne — six appels, un seul avec chemin d'échec

```
/api/kol/<handle>                    → setNotFound(true) si absent   ✔ explicite
/api/laundry/<handle>                → .catch(() => {})              ✘ muet
/api/cluster/<handle>                → .catch(() => {})              ✘ muet
/api/coordination/<handle>           → .catch(() => {})              ✘ muet
/api/transparency/wallets?handle=…   → .catch(() => {})              ✘ muet
/api/v1/shill-to-exit?handle=…       → .catch(() => {})              ✘ muet
   └─ POST /api/v1/narrative         → .catch(() => {})              ✘ muet
```

Et le rendu n'est posé que si la charge est **non vide** :

```ts
.then(d => { if (d && d.relatedActors?.length > 0) setCluster(d) })
.then(d => { if (d && d.signals?.length > 0) setCoordination(d) })
.then(d => { if (d?.wallets?.length > 0) setTransparency(d.wallets) })
.then(d => { if (d?.detected) setShillResult(d) })
```

**Trois états produisent le même écran :**

1. la donnée n'existe pas pour ce compte,
2. l'API a répondu vide,
3. l'API a échoué — réseau, 500, rate-limit, gate nominatif.

Dans les trois cas, **la section n'apparaît pas et rien ne le dit**.

| | |
|---|---|
| catégorie | `BUG` — l'échec est indistinguable de l'absence |
| blanc silencieux | **oui, cinq fois, sur la surface nominative** |

C'est le cœur de BUILD 10. Sur une fiche qui **nomme une personne**, une
section absente se lit « rien à signaler sur elle ». Le produit ne peut pas
tenir cette lecture : il ne sait pas la distinguer de « le collecteur n'a
jamais tourné ».

*Rappel de la carte des collecteurs (§3.b) :* `api/cron/corroboration`,
`api/cron/social/capture` et `api/cron/social/discover` sont des handlers
**orphelins**. Si l'une de ces sections en dépend, l'écran vide est permanent
et muet. Le lien exact entre chaque section et son collecteur reste à établir —
je le note, je ne le suppose pas.

## 4.2 · Ce que la page promet et que l'API peut refuser

La page construit trois liens de sortie :

- `/api/report/v2?mint=…` (si `mint` connu) sinon `/api/pdf/kol?handle=…`
- `/api/casefile/public?handle=…`

`/api/casefile/public` rend **404** pour tout handle qui ne résout pas vers un
dossier canonique — soit tous les handles hors des 10 de `BOTIFY_KOLS`. Le
bouton est-il conditionné à cette résolution ? **À vérifier** : si le lien est
rendu inconditionnellement, un lecteur clique et reçoit un 404 brut.

*Non vérifié à ce stade* — je le note et je poursuis.

---

# LES DEUX RÉSERVES CONNUES — INSTRUITES

## R1 · Les `evidenceRefs: []` de VINE

**La distinction demandée est réelle, et elle est plus nette que prévu.**

Les 8 claims VINE en base portent `evidenceRefs = '[]'`. L'audit d'intégrité
est vert. Il l'est **parce qu'il n'y a aucune référence à casser**, pas parce
que des références résolvent : `auditClaims` ne produit `BROKEN_REFERENCE`
qu'en parcourant `evidenceRefs`, et parcourir une liste vide ne produit rien.

Mais la source, elle, n'est pas vide. Mesuré dans `src/data/vine-osint.json` :
**les 9 claims portent tous des `evidence_refs` non vides** — de 1 à 11
entrées chacun, 39 au total.

Le vide vient de la **migration**, et il est délibéré. `generate-migration-sql.mjs` :

```
-- Retenus sur `thread_url`. `evidenceRefs` est laissé VIDE : les 39 références
-- de VINE sont à 33 de la prose (« screenshots TBC », descriptions de méthode)
-- et le fichier ne porte AUCUN registre `sources`. Les insérer comme si elles
-- résolvaient serait leur donner une valeur probante qu'elles n'ont pas.
```

La décision est juste et elle est tracée. Mais elle laisse deux choses :

| constat | catégorie |
|---|---|
| 39 références existent en amont et n'atteignent pas la base | `PIPE_NOT_CONNECTED` |
| VINE n'a **aucun registre `sources`** — rien contre quoi résoudre | `COLLECTOR_MISSING` |
| l'audit vert ne distingue pas « rien à casser » de « tout résout » | **blanc silencieux dans l'INSTRUMENT lui-même** |

Le troisième point est le plus important pour BUILD 10 : ce n'est pas une
donnée qui manque, c'est **un indicateur qui rend la même couleur pour deux
situations opposées**. Un dossier sans aucune référence et un dossier dont
toutes les références résolvent produisent le même rapport d'intégrité.

`summarizeFindings` compte `BROKEN_REFERENCE = 0` dans les deux cas. Rien ne
distingue 0 sur 0 de 0 sur 39.

## R2 · C13 — la réserve était mal posée, et la mesure le montre

L'énoncé disait : *« C13 est absent de la série C9–C17 de VINE. »*

**Mesuré : la série est COMPLÈTE dans la source.** `src/data/vine-osint.json`
porte 9 `new_claims`, C9 à C17, sans trou :

```
serie : [9, 10, 11, 12, 13, 14, 15, 16, 17]
manquants dans l'intervalle : aucun
```

C13 n'est pas absent de la série. **Il est absent de la MIGRATION**, et la
règle qui l'écarte est explicite :

```js
const vClaims = (vine.new_claims ?? []).filter((c) => c.thread_url);
```

**C13 est le seul des neuf sans `thread_url`.** Il a pourtant trois
`evidence_refs`. La règle de rétention retient sur `thread_url` — donc C13
tombe, et le compte passe de 9 à 8.

| | |
|---|---|
| catégorie | **`PIPE_NOT_CONNECTED`** — le claim existe en amont, la règle de transfert l'écarte |
| **pas** `DATA_ABSENT` | la donnée existe, complète, dans la source |
| **pas** `BUG` | le filtre fait exactement ce qu'il déclare faire |
| blanc silencieux | **oui** — nulle part, ni en base ni sur une surface, il n'est écrit qu'un claim a été écarté au transfert. Le dossier VINE porte 8 claims et rien ne dit qu'il y en avait 9. |

C'est le cas d'école du build : **une décision juste, tracée dans le script qui
l'applique, et invisible partout où le résultat est lu.** Le SQL de migration
est un artefact d'exécution ; le dossier, lui, ne porte aucune trace du
neuvième claim.

---

# SURFACES 5 À 8 · MÉTHODOLOGIE, TRANSPARENCE, EXPLORER, WATCHLIST

## 5 · `/methodology/tigerscore` — 194 lignes, **0 appel de donnée**

Page entièrement statique. Elle décrit le moteur de score.

Le trou n'est pas dans la page : il est dans l'**écart** avec la surface 2. La
page explique comment un TigerScore est calculé ; le dossier voisin affiche un
`91` qui vient d'un littéral de seed, et deux dossiers affichent « non établi »
parce qu'aucune chaîne ne relie le moteur à la table.

**Catégorie : `PIPE_NOT_CONNECTED`** — entre la méthodologie publiée et les
valeurs publiées. Ce n'est pas un blanc silencieux ; c'est une promesse dont
l'exécution n'est pas branchée.

## 6 · `/dataroom/score` — une redirection vers un HTML statique

14 lignes. `window.location.href = "/dataroom-score-architecture.html"`.

Le fichier existe : `public/dataroom-score-architecture.html`, **647 Ko**.
C'est un artefact **statique**, hors du pipeline applicatif : tout chiffre
qu'il contient est figé à sa date d'écriture, et rien ne le rafraîchit.

**Catégorie : `COLLECTOR_MISSING`** pour tout chiffre qu'il porterait.
*Non mesuré :* je n'ai pas inventorié son contenu — 647 Ko de HTML, et le
lire n'apporterait rien tant que la question « quel chiffre est vivant » a la
même réponse pour tous : aucun.

## 7 · `/transparency` — ce n'est pas un rapport, c'est un formulaire

`POST /api/transparency/submit`. La page est un **dépôt volontaire d'adresses
de wallet** par un tiers, pas une publication de l'entreprise sur elle-même.

Un lecteur Investor/Counsel qui ouvre « Transparency » attend le second.
**Catégorie : `INTENTIONALLY_NOT_SHOWN`** — la page fait ce qu'elle annonce
en sous-titre (« Voluntary Disclosure »), il n'y a pas de trou de donnée.
Signalé pour l'écart de lecture, pas comme défaut.

## 8 · `/explorer` et `/watchlist` — le même motif que la fiche nominative

```ts
// explorer
.then(d => { setItems(d.items ?? []); setStats(d.stats ?? null) })
.catch(() => {})

// watchlist
.then(d => setEntries(d.entries ?? []))
.catch(() => {})
```

Échec réseau, 500, gate nominatif : la liste reste vide, et l'écran est
**identique** à « aucun résultat ». Deux blancs silencieux de plus, sur les
deux surfaces de navigation du corpus.

---

# SYNTHÈSE S0

## Comptage par catégorie

Ne sont comptés que les constats **mesurés** dans ce document. Ce n'est pas un
inventaire exhaustif du dépôt : c'est ce qui a été remonté sur les surfaces
traitées, dans l'ordre Investor/Counsel.

| catégorie | constats | lesquels |
|---|---|---|
| `COLLECTOR_MISSING` | **5** | aucun writer de `token_casefiles` · `tigerScore` jamais écrit par le moteur · faits statiques du PDF jamais rafraîchis · VINE sans registre `sources` · `/dataroom/score` figé |
| `PIPE_NOT_CONNECTED` | **6** | 11 handlers cron orphelins · 6 colonnes posées par SQL manuel · claims dupliqués en dur sur `/cases/botify/evidence` · 39 `evidence_refs` VINE non transférées · C13 écarté au transfert · méthodologie publiée ↔ score publié |
| `BUG` | **5** | claims `CONFIRMED` alors qu'`ATTACHED` · mint synthétique publié · « rug-pull » interdit et rendu · lien de partage derrière le gate · `?? 0` → GREEN |
| `DATA_ABSENT` | **4** | date d'observation des faits statiques · adresses de démonstration · montants non quantifiés · page `fr/cases/botify` inexistante |
| `INTENTIONALLY_NOT_SHOWN` | **2** | filtre `publishStatus` de l'index · `/transparency` est un formulaire |
| `NOT_MEASURABLE` | **0** | aucun constat de cette nature à ce stade |
| **sources non armées** | **4** | `amf`, `fca`, `forta`, `goplus` — à classer quand une surface les citera |

## Les BLANCS SILENCIEUX — la liste

Un champ vide qui ne dit pas qu'il est vide. **16 recensés.**

| # | où | ce qu'un lecteur ne peut pas distinguer |
|---|---|---|
| 1 | fiche dossier · `founders` vide | pas de fondateurs / section inexistante |
| 2 | fiche dossier · `keyWallets` vide | pas de wallets / personne n'a cherché |
| 3 | fiche dossier · `sources` vide | pas de sources d'investigation / section inexistante |
| 4 | fiche dossier · bloc canonique vide | pas de claims / chaîne débranchée |
| 5 | PDF · faits statiques | aucun champ de date n'est rendu — rien ne dit qu'ils peuvent dater de n'importe quand |
| 6 | KOL · `/api/laundry` | absence / API en échec |
| 7 | KOL · `/api/cluster` | absence / API en échec |
| 8 | KOL · `/api/coordination` | absence / API en échec |
| 9 | KOL · `/api/transparency/wallets` | absence / API en échec |
| 10 | KOL · `/api/v1/shill-to-exit` + narrative | absence / API en échec |
| 11 | `/explorer` | aucun résultat / échec |
| 12 | `/watchlist` | aucun résultat / échec |
| 13 | `/demo` × 4 | **pire espèce** — score absent rendu `0`, donc **GREEN** |
| 14 | dossier VINE | 8 claims affichés, rien ne dit qu'il y en avait 9 |
| 15 | audit d'intégrité | `0 sur 0` indistinguable de `0 sur 39` — le blanc est dans l'**instrument** |
| 16 | `/fr/cases/botify` | 404 sans indication que le dossier existe en `en` |

**Six d'entre eux (6 à 10, 13) sont sur des surfaces nominatives ou de
verdict** — c'est-à-dire là où une absence muette se lit comme un constat
favorable sur une personne ou un actif.

## Ce que je n'ai pas traité

Par épuisement de la file, pas par choix : 62 pages admin, ~90 pages publiques
hors des 8 traitées, 157 routes API admin, les 2 extensions, la chaîne e-mail.
Les surfaces traitées sont celles du haut de la file Investor/Counsel.

## Chiffres explicitement NON vérifiés

- le comptage `?? 0` (97) est un **comptage**, pas un audit ligne à ligne ;
  seules les 4 pages `/demo` sont vérifiées ;
- les 11 handlers cron orphelins le sont **au regard du dépôt** — un
  déclencheur externe n'est pas exclu ;
- le gate sur `/shared/case/<token>` est mesuré **dans le code**, jamais
  exercé en production ;
- aucun comptage de lignes en base : pas de connexion, et je n'en ai pas
  cherché.

---

# SURFACE 9 · `/legal/*` — LA SEULE ATTEIGNABLE SANS SESSION

Cinq pages, `disclaimer`, `kol-data-doctrine`, `mentions-legales`, `privacy`,
`terms`. **Zéro appel de donnée** : prose statique. C'est correct pour du
juridique.

## 9.1 · La date de mise à jour est une constante manuelle

Chaque page porte `const updated = "April 2026"` (ou `"May 2026"`), écrit en
dur, et l'affiche comme *« Last updated »*.

Comparaison avec la date de modification **réelle** du fichier (git) :

| page | affiché | git |
|---|---|---|
| `disclaimer` | April 2026 | 2026-04-09 |
| `kol-data-doctrine` | May 2026 | 2026-05-11 |
| `mentions-legales` | April 2026 | 2026-04-09 |
| `privacy` | April 2026 | 2026-04-09 |
| `terms` | April 2026 | 2026-04-09 |

**Les cinq concordent aujourd'hui.** Le constat n'est donc pas « la date est
fausse » — elle est juste. Il est que **rien ne la maintient juste** : le jour
où le texte change sans qu'on touche la constante, la page affirmera une date
de révision périmée sur un document juridique, et rien ne le signalera.

| | |
|---|---|
| catégorie | `PIPE_NOT_CONNECTED` — la vraie date existe (git), rien ne l'y relie |
| blanc silencieux | **non, pas aujourd'hui.** Latent : il le deviendra à la première divergence |

## 9.2 · Une exemption de gate qui ne protège aucune page

`src/proxy.ts:65` exempte `pathname.startsWith("/legal/")`. Or
`src/app/legal/` **n'existe pas** : les pages vivent toutes sous
`/<loc>/legal/`, couvert par la ligne 69.

La ligne 65 ne dessert donc aucune page. Elle reste utile pour d'éventuels
fichiers statiques sous `/legal/`. Signalé pour exactitude de la carte, sans
conséquence de donnée.

---

# SURFACE 10 · LES DEUX EXTENSIONS

| | `interligens-guard/` | `packages/chrome-guard/` |
|---|---|---|
| version | **1.0.0** | **0.1.0** |
| base API | `https://app.interligens.com/api/v1` | `https://interligens.com` |
| appel | `/score?mint=…` → `/api/v1/score` **existe** | `/api/v1/score-lite?address=…` |
| host_permissions | 6 hôtes DEX + `app.interligens.com` | `interligens.com` seul |

## 10.1 · `chrome-guard` appelle une route qui n'existe pas à ce chemin

`GET /api/v1/score-lite` : **aucun `route.ts` à ce chemin.** La route existe,
mais à `/api/partner/v1/score-lite`.

## 10.2 · `chrome-guard` vise le mauvais hôte

`API_BASE = "https://interligens.com"`. L'hôte de production est
`app.interligens.com` (celui qu'utilise `interligens-guard`).

**Deux défauts cumulés : mauvais hôte ET mauvais chemin.** L'extension ne peut
pas obtenir de score.

| | |
|---|---|
| catégorie | `PIPE_NOT_CONNECTED` |
| blanc silencieux | **à vérifier** — que rend `content.ts` quand le fetch échoue ? Non mesuré. |

Lecture la plus probable, **non vérifiée** : `packages/chrome-guard` en 0.1.0
est un prototype supplanté par `interligens-guard` en 1.0.0. Deux extensions
portent le même nom affiché, « INTERLIGENS Guard ». Laquelle est distribuée
n'est pas déterminable depuis le dépôt.

---

# SURFACE 11 · LA CHAÎNE E-MAIL

`src/lib/security/email/digest.ts` · `sendDigest()` via Resend.

```ts
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.warn(`[security-digest] RESEND_API_KEY missing — skipped (...)`);
```

**Envoi ignoré en silence quand la clef manque** — un `console.warn`, puis
retour normal. L'appelant ne peut pas distinguer « envoyé » de « sauté ».

Et le handler `api/cron/security-weekly-digest` est **orphelin** (§3.b) :
aucun cron ne le déclenche. Le cron `/api/cron/weekly-digest` qui est armé est
un **autre** handler.

| | |
|---|---|
| catégorie | `PIPE_NOT_CONNECTED` (handler non armé) + `BUG` (échec silencieux) |
| blanc silencieux | **oui** — un digest non envoyé ne se voit nulle part |
| non vérifié | la présence de `RESEND_API_KEY` en production. Je n'ai pas accès aux variables d'environnement, et je n'en ai pas cherché. |
